/**
 * backend/cloudflare-worker/src/index.js
 * SAVI — Cloudflare Worker: lógica de break-glass, autorização e audit log.
 * Pivô de produção, revisão de 15/09/2026 — 3 métodos de acesso
 * (pulseira / número de utente / identidade), sem Nível 2 (eliminado).
 *
 * Revisão de 19/09/2026 — saída do scaffolding: a lógica de troca de
 * token da service account e o envio real ao Resend já estão
 * implementados. O que falta para isto correr em produção não é mais
 * código, é configuração:
 *   wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY   (JSON completo da chave)
 *   wrangler secret put RESEND_API_KEY
 * e depois `wrangler deploy`. Nenhuma chave nem segredo foi inventado —
 * onde falta uma decisão real (domínio verificado no Resend, origem do
 * email de contacto do paciente) o código fica com um TODO explícito, não
 * com um valor inventado. A simulação funcional desta iteração continua a
 * viver em `docs/js/worker-sim.js` (corre inteiramente no browser) até a
 * tarefa de ligar o frontend real (ver README) estar feita.
 *
 * Responsabilidades deste Worker (nunca do frontend, que nunca fala
 * diretamente com o Firestore para o fluxo de break-glass):
 *   1. Validar o ID token do Firebase Auth da conta que faz o acesso.
 *   2. Impor o timeout de sessão de 5 min de inatividade.
 *   3. Validar o PIN alfanumérico de 5 caracteres (hash — nunca texto
 *      simples) associado à conta, para o papel 'utilizador'.
 *   4. Localizar o paciente pelo método usado — pulseira (token opaco),
 *      número de utente, ou identidade (nome + data de nascimento + sexo).
 *   5. Devolver `dados_nivel1` (nunca bloqueando a leitura por falta de
 *      verificação clínica).
 *   6. Escrever sempre um registo em `acessos` — mesmo em caso de negação
 *      — para os 3 métodos, sem excepção.
 *   7. O método por identidade exige motivo obrigatório antes de mostrar
 *      qualquer dado.
 *   8. Disparar, de forma assíncrona, a notificação Resend ao titular/
 *      gestor do caso (nunca com dados clínicos no corpo do email).
 *
 * Nível 2 não existe mais — não há nenhum handler equivalente a
 * `/nivel2` neste ficheiro.
 *
 * Dependências previstas (adicionar ao package.json quando este Worker for
 * implementado a sério):
 *   - "jose" — verificação de JWT (ID tokens do Firebase Auth) em runtime
 *     de Workers (não há Node.js completo disponível).
 */

import { jwtVerify, createRemoteJWKSet, SignJWT, importPKCS8 } from "jose";

// ---------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------

// FIREBASE_PROJECT_ID vem de `[vars]` em wrangler.toml (não é segredo, é
// um identificador público) — lido em cada função como `env.FIREBASE_PROJECT_ID`,
// nunca hardcoded aqui.

// Chave pública do Firebase Auth para verificação de ID tokens (JWKS).
// IMPORTANTE (bug encontrado e corrigido a 25/09/2026, ao testar o
// primeiro paciente fictício): NÃO confundir com o endpoint "x509"
// (.../service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com)
// — esse devolve certificados PEM ({kid: "-----BEGIN CERTIFICATE-----..."}),
// um formato que `createRemoteJWKSet` (jose) não sabe interpretar como
// JWKS. O endpoint correto para verificação de JWT via JWKS é o "robot/jwk"
// abaixo, que devolve o documento {"keys":[...]} no formato JWK esperado.
// Usar o endpoint errado faz `jwtVerify` falhar SEMPRE, com qualquer token
// (mesmo válido e dentro da janela de sessão) — apareceu disfarçado de
// "Token de autenticação inválido ou expirado." em todos os 3 métodos de
// acesso.
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com";

const SESSAO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inatividade (CLAUDE.md)

// ---------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------

// CORS — o frontend (docs/) corre num origin diferente do Worker (GitHub
// Pages vs. workers.dev), por isso o browser faz sempre um preflight
// OPTIONS antes do POST real. Sem isto, o browser bloqueia a resposta
// mesmo que o Worker a tenha processado corretamente — nunca usar "*"
// aqui: só refletir o Access-Control-Allow-Origin quando o origin do
// pedido está nesta lista, para não abrir o endpoint a qualquer site.
const ORIGENS_PERMITIDAS = [
  "https://pulseirasavi.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
];

function corsHeaders(request) {
  const origin = request && request.headers.get("origin");
  const headers = { "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, authorization" };
  if (origin && ORIGENS_PERMITIDAS.includes(origin)) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function ErroSAVI(tipo, mensagem, status) {
  this.tipo = tipo;
  this.message = mensagem;
  this.status = status || 400;
}
ErroSAVI.prototype = Object.create(Error.prototype);

/**
 * Calcula o hash SHA-256 (hex) de uma string, usando a Web Crypto API
 * nativa do runtime de Workers. Usado para validar o PIN de 5 caracteres
 * — nunca é comparado ou guardado em texto simples, mesmo aqui.
 */
async function sha256Hex(texto) {
  const buf = new TextEncoder().encode(texto);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Valida o ID token do Firebase Auth enviado no cabeçalho Authorization.
 * TODO: esta é a forma correta de verificar tokens do Firebase Auth num
 * Worker (JWKS + emissor/audiência esperados), mas precisa de
 * FIREBASE_PROJECT_ID real para validar `aud`/`iss` corretamente. Sem essa
 * configuração, esta função não deve ser considerada segura para produção.
 */
async function verificarIdToken(request, env) {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    throw new ErroSAVI("nao_autenticado", "Token de autenticação em falta.", 401);
  }
  const token = match[1];

  // TODO: cachear o JWKS entre invocações (createRemoteJWKSet já faz cache
  // interno por processo, mas confirmar comportamento em edge runtime).
  const JWKS = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

  let payload;
  try {
    const resultado = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`, // TODO: requer FIREBASE_PROJECT_ID configurado
      audience: env.FIREBASE_PROJECT_ID // TODO: idem
    });
    payload = resultado.payload;
  } catch (e) {
    throw new ErroSAVI("token_invalido", "Token de autenticação inválido ou expirado.", 401);
  }

  // Custom claims esperadas (definidas no momento da criação da conta pelo
  // superadmin — ver backend/firestore.rules para a lista completa).
  return {
    uid: payload.sub,
    papeis: payload.papeis || [], // array: 'profissional' | 'utilizador' | 'superadmin'
    profissionalId: payload.profissional_id,
    funcaoAuditor: !!payload.funcao_auditor,
    authTime: payload.auth_time
  };
}

/**
 * Impõe o timeout de sessão de 5 min de inatividade. Numa implementação
 * real, o "último instante de atividade" tem de ser mantido nalgum lado
 * persistente entre pedidos — TODO: decidir entre (a) um valor `auth_time`
 * recente o suficiente no próprio ID token (renovado no cliente a cada
 * interação), ou (b) um registo de sessão em Durable Object / KV com TTL
 * de 5 min. Esta função assume a opção (a) por ora.
 */
function validarJanelaDeSessao(claims) {
  const agora = Date.now();
  const authTimeMs = (claims.authTime || 0) * 1000;
  if (agora - authTimeMs > SESSAO_TIMEOUT_MS) {
    throw new ErroSAVI("sessao_expirada", "Sessão expirada por inatividade.", 401);
  }
}

/**
 * Valida que a conta autenticada tem o papel 'utilizador' e que o PIN de
 * 5 caracteres enviado no pedido corresponde ao pin_hash guardado em
 * `profissionais/{profissionalId}`. Nunca compara texto simples.
 * TODO: `env` precisaria de acesso ao Firestore já autenticado (ver
 * firestoreGet abaixo) para ler o pin_hash real da conta.
 */
/**
 * TODO CRÍTICO (auditoria de segurança, 25/09/2026 — ver
 * AUDITORIA_SEGURANCA_25-09-2026.md, achado C1): esta função compara
 * SHA-256 simples sem sal, e não há limite de tentativas — confirmado ao
 * vivo (8 pedidos com PIN errado seguidos, todos aceites sem atraso nem
 * bloqueio). Corrigir, coordenado com auth-real.js e scripts/criar-
 * conta.js:
 *   1. Migrar o hash do PIN para PBKDF2/scrypt com sal por conta (Web
 *      Crypto API tem PBKDF2 nativo, sem biblioteca nova).
 *   2. Adicionar contador de tentativas falhadas + bloqueio temporário
 *      por conta (campos novos em profissionais/{id}, incrementados
 *      aqui a cada pin_invalido).
 *   3. Configurar uma Cloudflare Rate Limiting Rule em /acesso/* (painel,
 *      sem código) como mitigação imediata enquanto 1-2 não estão prontos.
 * Não implementado nesta sessão porque mexe na credencial de login das
 * contas já em produção (TESTE01/02, UTIL01, ADMIN01) — precisa de
 * migração coordenada, não de um commit isolado.
 */
async function validarPapelUtilizadorEPin(env, claims, pinRecebido) {
  if (!claims.papeis.includes("utilizador")) {
    throw new ErroSAVI("acesso_negado", "Esta conta não tem o papel de utilizador (break-glass).", 403);
  }
  if (!pinRecebido) {
    throw new ErroSAVI("pin_invalido", "PIN em falta.", 400);
  }
  const docProfissional = await firestoreGet(env, `profissionais/${claims.profissionalId}`);
  const profissional = docProfissional ? extrairCampos(docProfissional) : null;
  if (!profissional || !profissional.ativo) {
    throw new ErroSAVI("acesso_negado", "Conta inativa ou não encontrada.", 403);
  }
  const hashRecebido = await sha256Hex(pinRecebido);
  if (hashRecebido !== profissional.pin_hash) {
    throw new ErroSAVI("pin_invalido", "PIN incorreto.", 401);
  }
  return profissional;
}

// ---------------------------------------------------------------------
// Acesso ao Firestore via REST API
// ---------------------------------------------------------------------
// TODO: nesta primeira iteração de scaffolding, optámos por documentar o
// acesso via REST API do Firestore (autenticado com uma service account,
// gerando um access token OAuth2 — não implementado aqui, ver TODO
// abaixo) em vez do Admin SDK completo, que não corre nativamente em
// Cloudflare Workers.

const FIRESTORE_BASE_URL = (projectId) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

// Cache do access token entre invocações no mesmo isolate do Worker —
// best-effort (não garantido entre pedidos, mas evita assinar um JWT novo
// e chamar o Google OAuth2 em cada pedido quando o isolate é reutilizado).
let _accessTokenCache = null;

/**
 * Obtém um access token OAuth2 para a service account do Worker: assina um
 * JWT com a chave privada da service account e troca-o no endpoint token
 * do Google OAuth2 (grant_type urn:ietf:params:oauth:grant-type:jwt-bearer).
 * A chave privada nunca está hardcoded — vem sempre de
 * `env.FIREBASE_SERVICE_ACCOUNT_KEY`, configurado com
 * `wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY` (o JSON completo da
 * chave da service account, copiado de Firebase Console > Definições do
 * projeto > Contas de serviço > Gerar nova chave privada).
 */
async function obterAccessTokenServiceAccount(env) {
  const agora = Math.floor(Date.now() / 1000);
  if (_accessTokenCache && _accessTokenCache.expiraEm > agora + 60) {
    return _accessTokenCache.token;
  }

  if (!env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new ErroSAVI(
      "erro_configuracao",
      "FIREBASE_SERVICE_ACCOUNT_KEY não está configurado (wrangler secret put).",
      500
    );
  }

  let credenciais;
  try {
    credenciais = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (e) {
    throw new ErroSAVI(
      "erro_configuracao",
      "FIREBASE_SERVICE_ACCOUNT_KEY não é um JSON válido.",
      500
    );
  }

  const chavePrivada = await importPKCS8(credenciais.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/datastore" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(credenciais.client_email)
    .setSubject(credenciais.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(agora)
    .setExpirationTime(agora + 3600)
    .sign(chavePrivada);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!resp.ok) {
    throw new ErroSAVI(
      "erro_configuracao",
      "Não foi possível obter access token da service account junto do Google OAuth2.",
      502
    );
  }
  const dados = await resp.json();
  _accessTokenCache = {
    token: dados.access_token,
    expiraEm: agora + (dados.expires_in || 3600)
  };
  return dados.access_token;
}

async function firestoreGet(env, path) {
  const accessToken = await obterAccessTokenServiceAccount(env);
  const resp = await fetch(`${FIRESTORE_BASE_URL(env.FIREBASE_PROJECT_ID)}/${path}`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new ErroSAVI("erro", "Erro ao consultar o Firestore.", 502);
  return resp.json();
}

async function firestoreQueryUm(env, collectionId, fieldPath, value) {
  const accessToken = await obterAccessTokenServiceAccount(env);
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op: "EQUAL",
          value: { stringValue: value }
        }
      },
      limit: 1
    }
  };
  const resp = await fetch(`${FIRESTORE_BASE_URL(env.FIREBASE_PROJECT_ID)}:runQuery`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new ErroSAVI("erro", `Erro ao consultar ${collectionId}.`, 502);
  const resultados = await resp.json();
  const doc = resultados.find((r) => r.document);
  return doc ? doc.document : null;
}

/**
 * Método de acesso por identidade: nome completo + data de nascimento +
 * sexo. Sem índice composto na Fase 1 (≤50 pacientes) — lê a coleção toda
 * e filtra em memória. TODO: se o piloto crescer, criar índice composto
 * e usar uma query estruturada com 3 fieldFilters em AND.
 */
async function firestoreQueryPorIdentidade(env, nomeCompleto, dataNascimento, sexo) {
  const accessToken = await obterAccessTokenServiceAccount(env);
  const resp = await fetch(`${FIRESTORE_BASE_URL(env.FIREBASE_PROJECT_ID)}/pacientes`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) throw new ErroSAVI("erro", "Erro ao consultar pacientes.", 502);
  const resultado = await resp.json();
  const docs = resultado.documents || [];
  const alvo = docs.find((doc) => {
    const campos = extrairCampos(doc);
    return (
      (campos.nome || "").trim().toLowerCase() === nomeCompleto.trim().toLowerCase() &&
      campos.data_nascimento === dataNascimento &&
      campos.sexo === sexo
    );
  });
  return alvo || null;
}

async function firestoreCreate(env, collectionId, fields) {
  const accessToken = await obterAccessTokenServiceAccount(env);
  const resp = await fetch(`${FIRESTORE_BASE_URL(env.FIREBASE_PROJECT_ID)}/${collectionId}`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ fields })
  });
  if (!resp.ok) throw new ErroSAVI("erro", "Erro ao escrever no Firestore.", 502);
  return resp.json();
}

// ---------------------------------------------------------------------
// Audit log — escreve SEMPRE em `acessos`, mesmo em negações (passo 6),
// para os 3 métodos de acesso.
// ---------------------------------------------------------------------

async function registarAcesso(env, { metodoAcesso, pulseiraId, pacienteId, utilizadorId, nivelAcedido, motivo, servico, ipOuLocalizacao }) {
  return firestoreCreate(env, "acessos", {
    metodo_acesso: { stringValue: metodoAcesso }, // 'pulseira' | 'numero_utente' | 'identidade'
    pulseira_id: pulseiraId ? { stringValue: pulseiraId } : { nullValue: null },
    paciente_id: pacienteId ? { stringValue: pacienteId } : { nullValue: null },
    utilizador_id: utilizadorId ? { stringValue: utilizadorId } : { nullValue: null },
    nivel_acedido: { stringValue: nivelAcedido }, // 'nivel_1' | 'negado' — nivel_2 removido
    motivo: motivo ? { stringValue: motivo } : { nullValue: null },
    servico: servico ? { stringValue: servico } : { nullValue: null },
    ip_ou_localizacao: ipOuLocalizacao ? { stringValue: ipOuLocalizacao } : { nullValue: null },
    notificado_titular_em: { nullValue: null },
    acedido_em: { timestampValue: new Date().toISOString() }
  });
}

// ---------------------------------------------------------------------
// Notificação Resend — assíncrona, NUNCA com dados clínicos no corpo
// ---------------------------------------------------------------------

/**
 * Notifica o gestor do caso/família do acesso de emergência (art. 29.º
 * n.º 6, Lei 58/2019). Disparado com `ctx.waitUntil()` para não bloquear
 * a resposta ao utilizador. Nunca inclui dados clínicos no corpo —
 * apenas o facto de que houve um acesso, quando e por que método.
 *
 * Duas configurações têm de existir antes disto enviar algo de verdade,
 * nenhuma delas inventada aqui:
 *   1. `wrangler secret put RESEND_API_KEY`
 *   2. `env.RESEND_FROM_EMAIL` — um remetente num domínio verificado no
 *      Resend (Resend > Domains). Enquanto não houver domínio verificado,
 *      esta função regista um aviso e não envia, em vez de falhar o
 *      pedido — a leitura de Nível 1 nunca deve ficar bloqueada por causa
 *      da notificação.
 *
 * TODO real, não de código: decidir de onde vem `emailContacto` — o
 * schema atual (`pacientes.contacto_familia` / `contacto_emergencia`) é
 * texto livre, não necessariamente um email. Ver nota no README/CLAUDE.md
 * antes de assumir que esse campo é sempre um endereço de email válido.
 */
async function notificarTitularResend(env, { emailContacto, nomePaciente, metodoAcesso }) {
  if (!emailContacto) {
    console.warn("Notificação Resend ignorada: sem email de contacto para este paciente.");
    return;
  }
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    console.warn("Notificação Resend ignorada: RESEND_API_KEY ou RESEND_FROM_EMAIL não configurados.");
    return;
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: emailContacto,
      subject: "SAVI — acesso de emergência ao registo clínico",
      text:
        `Houve um acesso de emergência (método: ${metodoAcesso}) aos dados de ${nomePaciente} ` +
        `em ${new Date().toLocaleString("pt-PT")}. Este é um alerta automático — não contém dados clínicos.`
    })
  });
  if (!resp.ok) {
    // Nunca deixar a falha de notificação afetar o fluxo de break-glass —
    // só regista, não lança erro.
    console.error("Falha ao enviar notificação Resend:", resp.status, await resp.text().catch(() => ""));
  }
}

// ---------------------------------------------------------------------
// Núcleo comum aos 3 métodos: dado um documento de paciente já
// localizado, devolve dados_nivel1 + regista o acesso + notifica.
// ---------------------------------------------------------------------

async function responderComNivel1(env, ctx, { metodoAcesso, pulseiraId, docPaciente, utilizadorId, servico, motivo, ip }) {
  const pacienteId = docPaciente.name.split("/").pop();
  const paciente = extrairCampos(docPaciente);
  const dadosNivel1 = await firestoreGet(env, `dados_nivel1/${pacienteId}`);

  const acesso = await registarAcesso(env, {
    metodoAcesso,
    pulseiraId: pulseiraId || null,
    pacienteId,
    utilizadorId,
    nivelAcedido: "nivel_1",
    motivo: motivo || null,
    servico,
    ipOuLocalizacao: ip
  });

  ctx.waitUntil(
    notificarTitularResend(env, {
      emailContacto: null, // TODO: obter do gestor do caso / contacto de familiares do paciente
      nomePaciente: paciente.nome,
      metodoAcesso
    })
  );

  return jsonResponse({
    paciente,
    dados: dadosNivel1 ? extrairCampos(dadosNivel1) : null,
    acessoId: acesso.name ? acesso.name.split("/").pop() : null
  });
}

async function negarERegistar(env, ctx, { metodoAcesso, pulseiraId, utilizadorId, servico, motivo, ip, erroTipo, erroMensagem, erroStatus }) {
  ctx.waitUntil(
    registarAcesso(env, {
      metodoAcesso,
      pulseiraId: pulseiraId || null,
      pacienteId: null,
      utilizadorId,
      nivelAcedido: "negado",
      motivo: motivo || null,
      servico,
      ipOuLocalizacao: ip
    })
  );
  throw new ErroSAVI(erroTipo, erroMensagem, erroStatus);
}

// ---------------------------------------------------------------------
// POST /acesso/pulseira — método 1: leitura de pulseira (NFC ou QR)
// ---------------------------------------------------------------------

async function handleAcessoPulseira(request, env, ctx) {
  const claims = await verificarIdToken(request, env);
  validarJanelaDeSessao(claims);

  const body = await request.json().catch(() => ({}));
  const token = body.token;
  const pin = body.pin;
  const servico = body.servico || null;
  const ip = request.headers.get("cf-connecting-ip");

  const profissional = await validarPapelUtilizadorEPin(env, claims, pin);

  if (!token) {
    throw new ErroSAVI("token_invalido", "Token de pulseira em falta no pedido.", 400);
  }

  const docPulseira = await firestoreQueryUm(env, "pulseiras", "token", token);
  if (!docPulseira) {
    return negarERegistar(env, ctx, {
      metodoAcesso: "pulseira", pulseiraId: null, utilizadorId: claims.profissionalId, servico, ip,
      erroTipo: "token_invalido", erroMensagem: "Esta pulseira não está registada no sistema.", erroStatus: 404
    });
  }
  const pulseira = extrairCampos(docPulseira);
  const pulseiraId = docPulseira.name.split("/").pop();

  if (pulseira.estado !== "ativa") {
    return negarERegistar(env, ctx, {
      metodoAcesso: "pulseira", pulseiraId, utilizadorId: claims.profissionalId, servico, ip,
      erroTipo: "pulseira_revogada", erroMensagem: "Esta pulseira não está ativa.", erroStatus: 403
    });
  }

  const docPaciente = await firestoreGet(env, `pacientes/${pulseira.paciente_id}`);
  if (!docPaciente) {
    return negarERegistar(env, ctx, {
      metodoAcesso: "pulseira", pulseiraId, utilizadorId: claims.profissionalId, servico, ip,
      erroTipo: "erro", erroMensagem: "Pulseira ativa sem paciente associado (inconsistência de dados).", erroStatus: 500
    });
  }

  return responderComNivel1(env, ctx, {
    metodoAcesso: "pulseira", pulseiraId, docPaciente, utilizadorId: claims.profissionalId, servico, motivo: null, ip
  });
}

// ---------------------------------------------------------------------
// POST /acesso/numero-utente — método 2
// ---------------------------------------------------------------------

async function handleAcessoNumeroUtente(request, env, ctx) {
  const claims = await verificarIdToken(request, env);
  validarJanelaDeSessao(claims);

  const body = await request.json().catch(() => ({}));
  const numeroUtente = (body.numero_utente || "").trim();
  const pin = body.pin;
  const servico = body.servico || null;
  const ip = request.headers.get("cf-connecting-ip");

  await validarPapelUtilizadorEPin(env, claims, pin);

  if (!numeroUtente) {
    throw new ErroSAVI("dados_invalidos", "Número de utente em falta.", 400);
  }

  const docPaciente = await firestoreQueryUm(env, "pacientes", "numero_utente", numeroUtente);
  if (!docPaciente) {
    return negarERegistar(env, ctx, {
      metodoAcesso: "numero_utente", pulseiraId: null, utilizadorId: claims.profissionalId, servico, ip,
      erroTipo: "nao_encontrado", erroMensagem: "Não foi encontrado nenhum paciente com este número de utente.", erroStatus: 404
    });
  }

  return responderComNivel1(env, ctx, {
    metodoAcesso: "numero_utente", pulseiraId: null, docPaciente, utilizadorId: claims.profissionalId, servico, motivo: null, ip
  });
}

// ---------------------------------------------------------------------
// POST /acesso/identidade — método 3: nome completo + data de nascimento
// + sexo. Exige motivo obrigatório (regra não negociável, CLAUDE.md).
// ---------------------------------------------------------------------

async function handleAcessoIdentidade(request, env, ctx) {
  const claims = await verificarIdToken(request, env);
  validarJanelaDeSessao(claims);

  const body = await request.json().catch(() => ({}));
  const nomeCompleto = (body.nome_completo || "").trim();
  const dataNascimento = body.data_nascimento;
  const sexo = body.sexo;
  const motivo = (body.motivo || "").trim();
  const pin = body.pin;
  const servico = body.servico || null;
  const ip = request.headers.get("cf-connecting-ip");

  await validarPapelUtilizadorEPin(env, claims, pin);

  if (!motivo) {
    // Motivo obrigatório ANTES de mostrar qualquer dado — regra não
    // negociável, igual à antiga exigência do Nível 2 (agora eliminado),
    // aplicada aqui ao método de acesso por identidade.
    throw new ErroSAVI("motivo_obrigatorio", "É obrigatório indicar um motivo para o acesso por identidade.", 400);
  }
  if (!nomeCompleto || !dataNascimento || !sexo) {
    throw new ErroSAVI("dados_invalidos", "Nome completo, data de nascimento e sexo são obrigatórios.", 400);
  }

  const docPaciente = await firestoreQueryPorIdentidade(env, nomeCompleto, dataNascimento, sexo);
  if (!docPaciente) {
    return negarERegistar(env, ctx, {
      metodoAcesso: "identidade", pulseiraId: null, utilizadorId: claims.profissionalId, servico, motivo, ip,
      erroTipo: "nao_encontrado", erroMensagem: "Não foi encontrado nenhum paciente com esta identidade.", erroStatus: 404
    });
  }

  return responderComNivel1(env, ctx, {
    metodoAcesso: "identidade", pulseiraId: null, docPaciente, utilizadorId: claims.profissionalId, servico, motivo, ip
  });
}

// ---------------------------------------------------------------------
// Utilitário: converte um Document do formato REST do Firestore
// ({ fields: { campo: { stringValue: ... } } }) num objeto JS simples.
// ---------------------------------------------------------------------

function extrairCampos(doc) {
  const out = {};
  const fields = doc.fields || {};
  Object.keys(fields).forEach((k) => {
    const v = fields[k];
    if ("stringValue" in v) out[k] = v.stringValue;
    else if ("doubleValue" in v) out[k] = v.doubleValue;
    else if ("integerValue" in v) out[k] = Number(v.integerValue);
    else if ("booleanValue" in v) out[k] = v.booleanValue;
    else if ("timestampValue" in v) out[k] = v.timestampValue;
    else if ("nullValue" in v) out[k] = null;
    else if ("mapValue" in v) out[k] = extrairCampos({ fields: v.mapValue.fields || {} });
    else out[k] = null;
  });
  return out;
}

// ---------------------------------------------------------------------
// Router principal do Worker
// ---------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Preflight CORS — o browser envia sempre isto antes do POST real,
    // porque o pedido tem um cabeçalho Authorization personalizado. Nunca
    // passa pelos handlers de negócio, responde já aqui.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    let resposta;
    try {
      if (request.method === "POST" && url.pathname === "/acesso/pulseira") {
        resposta = await handleAcessoPulseira(request, env, ctx);
      } else if (request.method === "POST" && url.pathname === "/acesso/numero-utente") {
        resposta = await handleAcessoNumeroUtente(request, env, ctx);
      } else if (request.method === "POST" && url.pathname === "/acesso/identidade") {
        resposta = await handleAcessoIdentidade(request, env, ctx);
      } else {
        // Nota: não existe /nivel2 nem qualquer rota equivalente — Nível 2
        // foi eliminado por completo desta revisão (CLAUDE.md).
        resposta = jsonResponse({ erro: "nao_encontrado", mensagem: "Rota desconhecida." }, 404);
      }
    } catch (e) {
      if (e instanceof ErroSAVI) {
        resposta = jsonResponse({ erro: e.tipo, mensagem: e.message }, e.status);
      } else {
        // Nunca expor detalhes internos (stack traces, etc.) ao cliente.
        console.error(e);
        resposta = jsonResponse({ erro: "erro", mensagem: "Ocorreu um erro interno." }, 500);
      }
    }

    // Junta os cabeçalhos CORS à resposta real, seja ela qual for — feito
    // aqui, uma única vez, para não ter de passar `request` a cada chamada
    // de jsonResponse() nos handlers acima.
    const headersComCors = new Headers(resposta.headers);
    const extra = corsHeaders(request);
    Object.keys(extra).forEach((k) => headersComCors.set(k, extra[k]));
    return new Response(resposta.body, { status: resposta.status, headers: headersComCors });
  }
};
