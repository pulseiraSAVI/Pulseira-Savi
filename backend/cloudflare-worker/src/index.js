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
  const headers = { "access-control-allow-methods": "POST, PATCH, OPTIONS", "access-control-allow-headers": "content-type, authorization" };
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

// ---------------------------------------------------------------------
// PIN: hash com sal (PBKDF2-SHA256) + rate limiting — substitui o SHA-256
// simples sem sal (achado C1 da auditoria de segurança de 25/09/2026).
// A password do Firebase Auth deixa de ser derivada do PIN (ver
// criarCustomToken abaixo); o PIN passa a ser validado exclusivamente
// aqui, com sal por conta e função de derivação lenta.
// ---------------------------------------------------------------------

const PBKDF2_ITERACOES = 100000;
const PIN_MAX_TENTATIVAS = 5;
const PIN_BLOQUEIO_MS = 15 * 60 * 1000; // 15 minutos

function bufParaHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexParaBuf(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function gerarSaltHex() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return bufParaHex(buf);
}

/**
 * PBKDF2-SHA256, 100 000 iterações, saída de 256 bits — muito mais lento
 * de atacar offline do que o SHA-256 simples anterior, e o sal por conta
 * impede pré-computação (rainbow tables) contra todas as contas de uma
 * vez. Usado tanto para gravar como para verificar o PIN.
 */
async function pbkdf2Hex(pin, saltHex) {
  const chaveBase = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexParaBuf(saltHex), iterations: PBKDF2_ITERACOES, hash: "SHA-256" },
    chaveBase,
    256
  );
  return bufParaHex(bits);
}

/**
 * Gera um PIN alfanumérico de 5 caracteres (maiúsculas + dígitos) — usado
 * na criação de conta e no reset de PIN pelo superadmin. Nunca fica
 * guardado em texto simples: só é devolvido uma vez, na resposta do
 * pedido que o gerou, para o superadmin comunicar por um canal seguro.
 */
function gerarPinAleatorio() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I, para reduzir erros de leitura
  const buf = new Uint8Array(5);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => alfabeto[b % alfabeto.length]).join("");
}

/**
 * Verifica o PIN com sal para uma conta já localizada, aplicando rate
 * limiting: incrementa tentativas_pin_falhadas em cada falha e bloqueia a
 * conta durante PIN_BLOQUEIO_MS ao fim de PIN_MAX_TENTATIVAS seguidas.
 * Reposta a zero em caso de sucesso. Usado tanto no novo /auth/login como
 * na validação de PIN do break-glass (validarPapelUtilizadorEPin).
 *
 * Contas ainda no esquema antigo (sem pin_salt, migradas antes da
 * auditoria de 25/09/2026) são recusadas com um erro explícito — não há
 * fallback silencioso para SHA-256 sem sal; a conta tem de ser
 * reemitida com scripts/criar-conta.js (esquema novo).
 */
async function verificarPinDaConta(env, contaId, campos, pinRecebido) {
  const agora = Date.now();
  if (campos.bloqueado_ate) {
    const bloqueadoAteMs = new Date(campos.bloqueado_ate).getTime();
    if (agora < bloqueadoAteMs) {
      throw new ErroSAVI(
        "conta_bloqueada",
        "Demasiadas tentativas falhadas. Tente novamente mais tarde.",
        423
      );
    }
  }
  if (!campos.pin_salt) {
    throw new ErroSAVI(
      "erro_configuracao",
      "Esta conta ainda usa o esquema de PIN antigo — peça ao superadmin para a reemitir (scripts/criar-conta.js).",
      500
    );
  }

  const hashCalculado = await pbkdf2Hex(String(pinRecebido || "").toUpperCase(), campos.pin_salt);
  if (hashCalculado !== campos.pin_hash) {
    const tentativas = (campos.tentativas_pin_falhadas || 0) + 1;
    const camposPatch = { tentativas_pin_falhadas: { integerValue: String(tentativas) } };
    if (tentativas >= PIN_MAX_TENTATIVAS) {
      camposPatch.bloqueado_ate = { timestampValue: new Date(agora + PIN_BLOQUEIO_MS).toISOString() };
    }
    await firestorePatch(env, `profissionais/${contaId}`, camposPatch);
    throw new ErroSAVI("pin_invalido", "PIN incorreto.", 401);
  }

  if (campos.tentativas_pin_falhadas || campos.bloqueado_ate) {
    await firestorePatch(env, `profissionais/${contaId}`, {
      tentativas_pin_falhadas: { integerValue: "0" },
      bloqueado_ate: { nullValue: null }
    });
  }
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
 * CORRIGIDO em 26/09/2026 (ver AUDITORIA_SEGURANCA_25-09-2026.md, achado
 * C1): passou a delegar em verificarPinDaConta (PBKDF2 com sal + rate
 * limiting/bloqueio), em vez de comparar SHA-256 simples sem sal e sem
 * limite de tentativas. Continua a exigir migração das contas já em
 * produção (TESTE01/02, UTIL01, ADMIN01) — ver checklist de deploy em
 * AUDITORIA_SEGURANCA_25-09-2026.md / CLAUDE.md: precisam de ser
 * reemitidas com scripts/criar-conta.js (esquema novo, com sal) antes de
 * o deploy desta versão do Worker entrar em produção, senão ficam sem
 * pin_salt e o Worker recusa-as com "erro_configuracao".
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
  await verificarPinDaConta(env, claims.profissionalId, profissional, pinRecebido);
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
/**
 * Lê e valida FIREBASE_SERVICE_ACCOUNT_KEY uma única vez — partilhado
 * entre obterAccessTokenServiceAccount (troca por access token OAuth2,
 * para falar com o Firestore) e criarCustomToken (assina diretamente um
 * Firebase Custom Token, para o novo /auth/login — ver achado C1 da
 * auditoria de 25/09/2026).
 */
function lerCredenciaisServiceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new ErroSAVI(
      "erro_configuracao",
      "FIREBASE_SERVICE_ACCOUNT_KEY não está configurado (wrangler secret put).",
      500
    );
  }
  try {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (e) {
    throw new ErroSAVI(
      "erro_configuracao",
      "FIREBASE_SERVICE_ACCOUNT_KEY não é um JSON válido.",
      500
    );
  }
}

async function obterAccessTokenServiceAccount(env) {
  const agora = Math.floor(Date.now() / 1000);
  if (_accessTokenCache && _accessTokenCache.expiraEm > agora + 60) {
    return _accessTokenCache.token;
  }

  const credenciais = lerCredenciaisServiceAccount(env);

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

// Cria um documento com um ID escolhido por nós (em vez de auto-gerado)
// — usado para criar profissionais/{uid} com o mesmo uid que vai ser
// usado no Custom Token (ver handleAdminCriarConta).
async function firestoreCreateComId(env, collectionId, docId, fields) {
  const accessToken = await obterAccessTokenServiceAccount(env);
  const resp = await fetch(
    `${FIRESTORE_BASE_URL(env.FIREBASE_PROJECT_ID)}/${collectionId}?documentId=${encodeURIComponent(docId)}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ fields })
    }
  );
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    if (resp.status === 409) throw new ErroSAVI("ja_existe", "Já existe uma conta com este nº de Ordem.", 409);
    console.error("firestoreCreateComId falhou:", resp.status, corpo);
    throw new ErroSAVI("erro", "Erro ao escrever no Firestore.", 502);
  }
  return resp.json();
}

// Atualiza só os campos indicados (updateMask) — nunca substitui o
// documento inteiro. `campos` já vem no formato REST do Firestore
// ({ nomeCampo: { stringValue/integerValue/... } }).
async function firestorePatch(env, path, campos) {
  const accessToken = await obterAccessTokenServiceAccount(env);
  const mask = Object.keys(campos).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const resp = await fetch(`${FIRESTORE_BASE_URL(env.FIREBASE_PROJECT_ID)}/${path}?${mask}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ fields: campos })
  });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    console.error("firestorePatch falhou:", resp.status, corpo);
    throw new ErroSAVI("erro", "Erro ao atualizar o Firestore.", 502);
  }
  return resp.json();
}

/**
 * Assina diretamente um Firebase Custom Token (JWT RS256 com a chave
 * privada da service account) — substitui, para o novo /auth/login, a
 * antiga estratégia de "password do Firebase Auth = hash do PIN" (achado
 * C1 da auditoria de 25/09/2026). O cliente troca este token por uma
 * sessão real com `signInWithCustomToken`, e as claims aqui incluídas
 * (papeis, profissional_id, funcao_auditor) ficam disponíveis no ID token
 * resultante, exatamente como as Firestore Rules já esperam
 * (request.auth.token.papeis, etc.) — sem precisar de
 * `admin.auth().setCustomUserClaims()` à parte.
 *
 * `uid` é sempre o ID do documento profissionais/{uid} já existente (ou
 * recém-criado) — o Firebase Auth cria ou reutiliza automaticamente o
 * utilizador com esse uid ao trocar o custom token, por isso as
 * referências existentes (pacientes.criado_por_id, etc.) nunca
 * precisam de migração.
 */
async function criarCustomToken(env, uid, claims) {
  const credenciais = lerCredenciaisServiceAccount(env);
  const chavePrivada = await importPKCS8(credenciais.private_key, "RS256");
  const agora = Math.floor(Date.now() / 1000);
  // "uid" e "claims" são campos específicos do formato de Custom Token do
  // Firebase (fora do standard JWT) — SignJWT aceita-os como payload
  // normal, tal como qualquer outro claim.
  return new SignJWT({ uid, claims })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(credenciais.client_email)
    .setSubject(credenciais.client_email)
    .setAudience("https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit")
    .setIssuedAt(agora)
    .setExpirationTime(agora + 3600)
    .sign(chavePrivada);
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
// POST /auth/login — substitui signInWithEmailAndPassword(hash do PIN)
// (achado C1 da auditoria de 25/09/2026): o cliente nunca mais precisa de
// conhecer nenhuma "password" — envia nº de Ordem + PIN, o Worker valida
// o PIN (PBKDF2 com sal + rate limiting) e devolve um Custom Token para
// o cliente trocar por uma sessão real do Firebase Auth.
// ---------------------------------------------------------------------

async function handleAuthLogin(request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const credencialOrdem = String(body.credencial_ordem || "").trim();
  const pin = body.pin;

  if (!credencialOrdem || !pin) {
    throw new ErroSAVI("dados_invalidos", "Nº de Ordem e PIN são obrigatórios.", 400);
  }

  const doc = await firestoreQueryUm(env, "profissionais", "credencial_ordem", credencialOrdem);
  if (!doc) {
    // Mensagem genérica de propósito — nunca revelar se foi a credencial
    // ou o PIN que estava errado (evita enumerar contas existentes).
    throw new ErroSAVI("credenciais_invalidas", "Nº de Ordem ou PIN incorretos.", 401);
  }
  const contaId = doc.name.split("/").pop();
  const campos = extrairCampos(doc);

  if (!campos.ativo) {
    throw new ErroSAVI("acesso_negado", "Esta conta está inativa. Contacte o superadmin.", 403);
  }

  try {
    await verificarPinDaConta(env, contaId, campos, pin);
  } catch (e) {
    if (e instanceof ErroSAVI && e.tipo === "pin_invalido") {
      // Mesma mensagem genérica do caso "conta não encontrada" acima.
      throw new ErroSAVI("credenciais_invalidas", "Nº de Ordem ou PIN incorretos.", 401);
    }
    throw e;
  }

  const customToken = await criarCustomToken(env, contaId, {
    papeis: campos.papeis || [],
    profissional_id: contaId,
    funcao_auditor: !!campos.funcao_auditor
  });

  return jsonResponse({ customToken });
}

// ---------------------------------------------------------------------
// Gestão de contas (superadmin) — POST /admin/contas, PATCH
// /admin/contas/:id, POST /admin/contas/:id/reset-pin. Substitui, para
// estas três operações, a necessidade de correr scripts/criar-conta.js
// manualmente (ver CLAUDE.md, roadmap "gestão de contas desde a app").
// Eliminar contas fica de fora de propósito — o efeito em cascata sobre
// pacientes já criados por essa conta ainda não foi decidido (ver
// ROADMAP_MELHORIAS.md, 1.1).
// ---------------------------------------------------------------------

function exigirSuperadmin(claims) {
  if (!claims.papeis.includes("superadmin")) {
    throw new ErroSAVI("acesso_negado", "Só o superadmin pode gerir contas.", 403);
  }
}

function campoTexto(v) {
  return { stringValue: String(v || "") };
}

async function handleAdminCriarConta(request, env, ctx) {
  const claims = await verificarIdToken(request, env);
  exigirSuperadmin(claims);

  const body = await request.json().catch(() => ({}));
  const nome = String(body.nome || "").trim();
  const credencialOrdem = String(body.credencial_ordem || "").trim();
  const papeis = Array.isArray(body.papeis) ? body.papeis.filter((p) => ["profissional", "utilizador", "superadmin"].includes(p)) : [];
  const funcaoAuditor = !!body.funcao_auditor && papeis.includes("superadmin");

  if (!nome || !credencialOrdem || papeis.length === 0) {
    throw new ErroSAVI("dados_invalidos", "Nome, nº de Ordem e pelo menos um papel são obrigatórios.", 400);
  }

  const existente = await firestoreQueryUm(env, "profissionais", "credencial_ordem", credencialOrdem);
  if (existente) {
    throw new ErroSAVI("ja_existe", "Já existe uma conta com este nº de Ordem.", 409);
  }

  const uid = crypto.randomUUID();
  const pin = gerarPinAleatorio();
  const salt = gerarSaltHex();
  const pinHash = await pbkdf2Hex(pin, salt);

  await firestoreCreateComId(env, "profissionais", uid, {
    nome: campoTexto(nome),
    credencial_ordem: campoTexto(credencialOrdem),
    pin_hash: campoTexto(pinHash),
    pin_salt: campoTexto(salt),
    tentativas_pin_falhadas: { integerValue: "0" },
    bloqueado_ate: { nullValue: null },
    papeis: { arrayValue: { values: papeis.map((p) => ({ stringValue: p })) } },
    funcao_auditor: { booleanValue: funcaoAuditor },
    servico: campoTexto(body.servico),
    especialidade: campoTexto(body.especialidade),
    instituicao_servico: campoTexto(body.instituicao_servico),
    telefone_institucional: campoTexto(body.telefone_institucional),
    ativo: { booleanValue: true },
    criado_em: { timestampValue: new Date().toISOString() }
  });

  return jsonResponse({ uid, credencial_ordem: credencialOrdem, pin }, 201);
}

async function handleAdminEditarConta(request, env, ctx, contaId) {
  const claims = await verificarIdToken(request, env);
  exigirSuperadmin(claims);

  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (body.nome !== undefined) patch.nome = campoTexto(body.nome);
  if (body.servico !== undefined) patch.servico = campoTexto(body.servico);
  if (body.especialidade !== undefined) patch.especialidade = campoTexto(body.especialidade);
  if (body.instituicao_servico !== undefined) patch.instituicao_servico = campoTexto(body.instituicao_servico);
  if (body.telefone_institucional !== undefined) patch.telefone_institucional = campoTexto(body.telefone_institucional);
  if (Array.isArray(body.papeis)) {
    const papeis = body.papeis.filter((p) => ["profissional", "utilizador", "superadmin"].includes(p));
    patch.papeis = { arrayValue: { values: papeis.map((p) => ({ stringValue: p })) } };
  }
  if (body.funcao_auditor !== undefined) patch.funcao_auditor = { booleanValue: !!body.funcao_auditor };

  if (Object.keys(patch).length === 0) {
    throw new ErroSAVI("dados_invalidos", "Nenhum campo para atualizar.", 400);
  }

  await firestorePatch(env, `profissionais/${contaId}`, patch);
  return jsonResponse({ ok: true });
}

async function handleAdminResetPin(request, env, ctx, contaId) {
  const claims = await verificarIdToken(request, env);
  exigirSuperadmin(claims);

  const doc = await firestoreGet(env, `profissionais/${contaId}`);
  if (!doc) throw new ErroSAVI("nao_encontrado", "Conta não encontrada.", 404);

  const pin = gerarPinAleatorio();
  const salt = gerarSaltHex();
  const pinHash = await pbkdf2Hex(pin, salt);

  await firestorePatch(env, `profissionais/${contaId}`, {
    pin_hash: campoTexto(pinHash),
    pin_salt: campoTexto(salt),
    tentativas_pin_falhadas: { integerValue: "0" },
    bloqueado_ate: { nullValue: null }
  });

  return jsonResponse({ pin });
}

// ---------------------------------------------------------------------
// Utilitário: converte um Document do formato REST do Firestore
// ({ fields: { campo: { stringValue: ... } } }) num objeto JS simples.
// ---------------------------------------------------------------------

// Converte um único "Value" do formato REST do Firestore
// (https://firebase.google.com/docs/firestore/reference/rest/v1/Value)
// para o valor JS equivalente — usada tanto para campos de topo como para
// os elementos de um arrayValue (recursiva, para poderes ter arrays de
// mapas, etc.).
//
// CORRIGIDO em 26/09/2026: faltava o caso "arrayValue" — qualquer campo
// array (como `papeis` em profissionais/{id}) vinha sempre a null,
// silenciosamente. Não tinha sido detetado até agora porque o único sítio
// que lia `papeis` de um documento Firestore através de extrairCampos era
// o endpoint novo POST /auth/login (a validação do break-glass em
// validarPapelUtilizadorEPin lê `papeis` diretamente das claims do ID
// token, nunca via extrairCampos) — por isso todas as contas entravam com
// `papeis: []` no Custom Token, e qualquer leitura que dependesse de
// isSuperadmin()/isProfissional() nas Firestore Rules falhava com
// "Missing or insufficient permissions", mesmo com login bem sucedido.
function converterValorFirestore(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("doubleValue" in v) return v.doubleValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return extrairCampos({ fields: v.mapValue.fields || {} });
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(converterValorFirestore);
  return null;
}

function extrairCampos(doc) {
  const out = {};
  const fields = doc.fields || {};
  Object.keys(fields).forEach((k) => {
    out[k] = converterValorFirestore(fields[k]);
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
      const matchContaId = url.pathname.match(/^\/admin\/contas\/([^/]+)$/);
      const matchResetPin = url.pathname.match(/^\/admin\/contas\/([^/]+)\/reset-pin$/);

      if (request.method === "POST" && url.pathname === "/acesso/pulseira") {
        resposta = await handleAcessoPulseira(request, env, ctx);
      } else if (request.method === "POST" && url.pathname === "/acesso/numero-utente") {
        resposta = await handleAcessoNumeroUtente(request, env, ctx);
      } else if (request.method === "POST" && url.pathname === "/acesso/identidade") {
        resposta = await handleAcessoIdentidade(request, env, ctx);
      } else if (request.method === "POST" && url.pathname === "/auth/login") {
        resposta = await handleAuthLogin(request, env, ctx);
      } else if (request.method === "POST" && url.pathname === "/admin/contas") {
        resposta = await handleAdminCriarConta(request, env, ctx);
      } else if (request.method === "PATCH" && matchContaId) {
        resposta = await handleAdminEditarConta(request, env, ctx, matchContaId[1]);
      } else if (request.method === "POST" && matchResetPin) {
        resposta = await handleAdminResetPin(request, env, ctx, matchResetPin[1]);
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
