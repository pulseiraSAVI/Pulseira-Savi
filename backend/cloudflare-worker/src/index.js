/**
 * backend/cloudflare-worker/src/index.js
 * SAVI — Cloudflare Worker: lógica de break-glass, autorização e audit log.
 *
 * ⚠️ ESTE FICHEIRO É SCAFFOLDING COMENTADO PARA PRODUÇÃO, NÃO CÓDIGO
 * FUNCIONAL SEM CREDENCIAIS REAIS. Não foram inventadas chaves, segredos
 * nem endpoints reais — cada ponto que precisa de configuração real está
 * marcado com TODO. A demo funcional desta iteração vive em
 * `frontend/js/worker-sim.js` (simulação no browser).
 *
 * Responsabilidades deste Worker (nunca do frontend, que nunca fala
 * diretamente com o Firestore para o fluxo de scan):
 *   1. Validar o ID token do Firebase Auth (autenticação do profissional).
 *   2. Impor o timeout de sessão de 5 min de inatividade.
 *   3. Consultar `pulseiras` pelo token, confirmar estado === 'ativa'.
 *   4. Obter `paciente_id` e devolver `dados_nivel1` (nunca bloqueando a
 *      leitura por falta de verificação clínica).
 *   5. Escrever sempre um registo em `acessos` — mesmo em caso de negação.
 *   6. Disparar, de forma assíncrona, a notificação Resend ao titular
 *      (nunca com dados clínicos no corpo do email).
 *   7. Nível 2: exigir motivo obrigatório; devolver apenas
 *      `referencia_sistema_ext` (nunca o histórico completo).
 *
 * Dependências previstas (adicionar ao package.json quando este Worker for
 * implementado a sério):
 *   - "jose" — verificação de JWT (ID tokens do Firebase Auth) em runtime
 *     de Workers (não há Node.js completo disponível).
 */

import { jwtVerify, createRemoteJWKSet } from "jose";

// ---------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------

// TODO: substituir pelo project ID real do projeto Firebase (europe-west),
// definido como variável de ambiente no wrangler.toml / painel Cloudflare.
// const FIREBASE_PROJECT_ID = env.FIREBASE_PROJECT_ID;

// Chave pública do Firebase Auth para verificação de ID tokens (JWKS).
// TODO: confirmar o endpoint exato antes do deploy — este é o endpoint
// documentado pela Google para verificação de ID tokens do Firebase Auth.
// Não inventar nem assumir sem verificar a documentação oficial no momento
// da implementação real.
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const SESSAO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inatividade (CLAUDE.md)

// ---------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
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

  // Custom claims esperadas (definidas no momento da criação da conta —
  // ver backend/firestore.rules para a lista completa e regras de acesso).
  return {
    uid: payload.sub,
    papel: payload.papel, // 'profissional' | 'admin' | 'familia'
    profissionalId: payload.profissional_id,
    funcaoAuditor: !!payload.funcao_auditor
  };
}

/**
 * Impõe o timeout de sessão de 5 min de inatividade. Numa implementação
 * real, o "último instante de atividade" tem de ser mantido nalgum lado
 * persistente entre pedidos — TODO: decidir entre (a) um valor `iat`/
 * `auth_time` recente o suficiente no próprio ID token (renovado no
 * cliente a cada interação), ou (b) um registo de sessão em Durable
 * Object / KV com TTL de 5 min. Esta função assume a opção (a) por ora.
 */
function validarJanelaDeSessao(claimsToken) {
  const agora = Date.now();
  const authTimeMs = (claimsToken.authTime || 0) * 1000;
  if (agora - authTimeMs > SESSAO_TIMEOUT_MS) {
    throw new ErroSAVI("sessao_expirada", "Sessão expirada por inatividade.", 401);
  }
}

function ErroSAVI(tipo, mensagem, status) {
  this.tipo = tipo;
  this.message = mensagem;
  this.status = status || 400;
}
ErroSAVI.prototype = Object.create(Error.prototype);

// ---------------------------------------------------------------------
// Acesso ao Firestore via REST API
// ---------------------------------------------------------------------
// TODO: nesta primeira iteração de scaffolding, optámos por documentar o
// acesso via REST API do Firestore (autenticado com uma service account,
// gerando um access token OAuth2 — não implementado aqui, ver TODO
// abaixo) em vez do Admin SDK completo, que não corre nativamente em
// Cloudflare Workers. Alternativa a avaliar: usar a biblioteca
// "firebase-rest-firestore" ou construir os pedidos manualmente com
// fetch(), como esboçado abaixo.

const FIRESTORE_BASE_URL = (projectId) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

/**
 * TODO: implementar a obtenção de um access token OAuth2 para a service
 * account do Worker (JWT assinado com a chave privada da service account,
 * trocado no endpoint token do Google OAuth2). Nunca hardcodar a chave
 * privada no código-fonte — deve vir de um secret configurado via
 * `wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY`.
 */
async function obterAccessTokenServiceAccount(env) {
  throw new Error(
    "TODO: gerar access token OAuth2 a partir do secret FIREBASE_SERVICE_ACCOUNT_KEY " +
      "(wrangler secret put). Não implementado neste scaffolding — requer " +
      "credenciais reais do projeto Firebase que não devem ser inventadas."
  );
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

async function firestoreQueryPulseiraPorToken(env, token) {
  const accessToken = await obterAccessTokenServiceAccount(env);
  const body = {
    structuredQuery: {
      from: [{ collectionId: "pulseiras" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "token" },
          op: "EQUAL",
          value: { stringValue: token }
        }
      },
      limit: 1
    }
  };
  const resp = await fetch(
    `${FIRESTORE_BASE_URL(env.FIREBASE_PROJECT_ID)}:runQuery`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );
  if (!resp.ok) throw new ErroSAVI("erro", "Erro ao consultar pulseiras.", 502);
  const resultados = await resp.json();
  const doc = resultados.find((r) => r.document);
  return doc ? doc.document : null;
}

async function firestoreCreate(env, collectionId, fields) {
  const accessToken = await obterAccessTokenServiceAccount(env);
  const resp = await fetch(
    `${FIRESTORE_BASE_URL(env.FIREBASE_PROJECT_ID)}/${collectionId}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ fields })
    }
  );
  if (!resp.ok) throw new ErroSAVI("erro", "Erro ao escrever no Firestore.", 502);
  return resp.json();
}

// ---------------------------------------------------------------------
// Audit log — escreve SEMPRE em `acessos`, mesmo em negações (passo 6)
// ---------------------------------------------------------------------

async function registarAcesso(env, { pulseiraId, profissionalId, nivelAcedido, motivo, servico, ipOuLocalizacao }) {
  // Alinhado com o schema em backend/firestore-schema.md (coleção `acessos`).
  return firestoreCreate(env, "acessos", {
    pulseira_id: pulseiraId ? { stringValue: pulseiraId } : { nullValue: null },
    profissional_id: profissionalId ? { stringValue: profissionalId } : { nullValue: null },
    nivel_acedido: { stringValue: nivelAcedido }, // 'nivel_1' | 'nivel_2' | 'negado'
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
 * Notifica o titular/família do acesso de emergência (art. 29.º n.º 6,
 * Lei 58/2019). Disparado sem `await` no fluxo principal para não
 * bloquear a resposta ao profissional — usar `ctx.waitUntil()` no
 * handler do Worker para garantir que a Promise corre até ao fim mesmo
 * depois da resposta ser enviada.
 *
 * TODO: configurar RESEND_API_KEY como secret (`wrangler secret put
 * RESEND_API_KEY`) antes de ativar este código. Manter comentado /
 * stub até essa configuração existir, para não falhar silenciosamente
 * em produção.
 */
async function notificarTitularResend(env, { emailContacto, nomePaciente, nivel }) {
  // Exemplo de payload (NUNCA incluir dados clínicos — alergias, diagnóstico,
  // medicação, etc. — apenas o facto de que houve um acesso):
  //
  // await fetch("https://api.resend.com/emails", {
  //   method: "POST",
  //   headers: {
  //     authorization: `Bearer ${env.RESEND_API_KEY}`,
  //     "content-type": "application/json"
  //   },
  //   body: JSON.stringify({
  //     from: "SAVI <notificacoes@savi-piloto.pt>", // TODO: domínio real verificado no Resend
  //     to: emailContacto,
  //     subject: "SAVI — acesso de emergência à pulseira",
  //     text:
  //       `Houve um acesso de emergência (${nivel}) aos dados de ${nomePaciente} ` +
  //       `em ${new Date().toLocaleString("pt-PT")}. Este é um alerta automático — ` +
  //       "não contém dados clínicos."
  //   })
  // });
  //
  // TODO: implementar a chamada real quando RESEND_API_KEY estiver
  // configurado; por agora, este é apenas o esboço documentado.
  return Promise.resolve();
}

// ---------------------------------------------------------------------
// POST /scan
// ---------------------------------------------------------------------

async function handleScan(request, env, ctx) {
  const claims = await verificarIdToken(request, env);
  validarJanelaDeSessao(claims);

  const body = await request.json().catch(() => ({}));
  const token = body.token;
  const servico = body.servico || null;

  if (!token) {
    throw new ErroSAVI("token_invalido", "Token de pulseira em falta no pedido.", 400);
  }

  const docPulseira = await firestoreQueryPulseiraPorToken(env, token);

  if (!docPulseira) {
    // Passo 6: regista SEMPRE, mesmo em negação por token desconhecido.
    ctx.waitUntil(
      registarAcesso(env, {
        pulseiraId: null,
        profissionalId: claims.profissionalId,
        nivelAcedido: "negado",
        motivo: `Token inválido: ${token}`,
        servico,
        ipOuLocalizacao: request.headers.get("cf-connecting-ip")
      })
    );
    throw new ErroSAVI("token_invalido", "Esta pulseira não está registada no sistema.", 404);
  }

  const pulseira = extrairCampos(docPulseira); // TODO: implementar parser de Firestore Document -> objeto JS simples
  const pulseiraId = docPulseira.name.split("/").pop();

  if (pulseira.estado !== "ativa") {
    ctx.waitUntil(
      registarAcesso(env, {
        pulseiraId,
        profissionalId: claims.profissionalId,
        nivelAcedido: "negado",
        motivo: `Pulseira em estado '${pulseira.estado}'`,
        servico,
        ipOuLocalizacao: request.headers.get("cf-connecting-ip")
      })
    );
    throw new ErroSAVI("pulseira_revogada", "Esta pulseira não está ativa.", 403);
  }

  const dadosNivel1 = await firestoreGet(env, `dados_nivel1/${pulseira.paciente_id}`);
  const paciente = await firestoreGet(env, `pacientes/${pulseira.paciente_id}`);

  const acesso = await registarAcesso(env, {
    pulseiraId,
    profissionalId: claims.profissionalId,
    nivelAcedido: "nivel_1",
    motivo: null,
    servico,
    ipOuLocalizacao: request.headers.get("cf-connecting-ip")
  });

  // Passo 7: notificação assíncrona, nunca bloqueia a resposta.
  ctx.waitUntil(
    notificarTitularResend(env, {
      emailContacto: null, // TODO: obter da conta de família ligada ao paciente
      nomePaciente: paciente ? extrairCampos(paciente).nome : "paciente",
      nivel: "Nível 1"
    })
  );

  return jsonResponse({
    paciente: paciente ? extrairCampos(paciente) : null,
    dados: dadosNivel1 ? extrairCampos(dadosNivel1) : null,
    acessoId: acesso.name ? acesso.name.split("/").pop() : null
  });
}

// ---------------------------------------------------------------------
// POST /nivel2
// ---------------------------------------------------------------------

async function handleNivel2(request, env, ctx) {
  const claims = await verificarIdToken(request, env);
  validarJanelaDeSessao(claims);

  const body = await request.json().catch(() => ({}));
  const motivo = (body.motivo || "").trim();
  const pulseiraId = body.pulseiraId;
  const servico = body.servico || null;

  if (!motivo) {
    // Nível 2 exige motivo obrigatório — regra não negociável (CLAUDE.md).
    return jsonResponse(
      { erro: "motivo_obrigatorio", mensagem: "É obrigatório indicar um motivo clínico para aceder ao Nível 2." },
      400
    );
  }

  const docPulseira = await firestoreGet(env, `pulseiras/${pulseiraId}`);
  const pulseira = docPulseira ? extrairCampos(docPulseira) : null;

  if (!pulseira || pulseira.estado !== "ativa") {
    ctx.waitUntil(
      registarAcesso(env, {
        pulseiraId,
        profissionalId: claims.profissionalId,
        nivelAcedido: "negado",
        motivo,
        servico,
        ipOuLocalizacao: request.headers.get("cf-connecting-ip")
      })
    );
    throw new ErroSAVI("pulseira_revogada", "Pulseira não está ativa.", 403);
  }

  const paciente = await firestoreGet(env, `pacientes/${pulseira.paciente_id}`);
  const pacienteFields = paciente ? extrairCampos(paciente) : {};

  await registarAcesso(env, {
    pulseiraId,
    profissionalId: claims.profissionalId,
    nivelAcedido: "nivel_2",
    motivo,
    servico,
    ipOuLocalizacao: request.headers.get("cf-connecting-ip")
  });

  ctx.waitUntil(
    notificarTitularResend(env, {
      emailContacto: null, // TODO: idem handleScan
      nomePaciente: pacienteFields.nome || "paciente",
      nivel: `Nível 2 (motivo: ${motivo})`
    })
  );

  // Nunca o histórico completo — apenas a referência textual (regra não
  // negociável, CLAUDE.md).
  return jsonResponse({
    referencia_sistema_ext: pacienteFields.referencia_sistema_ext || "Sem referência registada no sistema do hospital."
  });
}

// ---------------------------------------------------------------------
// Utilitário: converte um Document do formato REST do Firestore
// ({ fields: { campo: { stringValue: ... } } }) num objeto JS simples.
// TODO: cobrir todos os tipos de valor usados no schema (stringValue,
// doubleValue, integerValue, booleanValue, timestampValue, nullValue,
// mapValue) — versão mínima ilustrativa abaixo, não exaustiva.
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

    try {
      if (request.method === "POST" && url.pathname === "/scan") {
        return await handleScan(request, env, ctx);
      }
      if (request.method === "POST" && url.pathname === "/nivel2") {
        return await handleNivel2(request, env, ctx);
      }
      return jsonResponse({ erro: "nao_encontrado", mensagem: "Rota desconhecida." }, 404);
    } catch (e) {
      if (e instanceof ErroSAVI) {
        return jsonResponse({ erro: e.tipo, mensagem: e.message }, e.status);
      }
      // Nunca expor detalhes internos (stack traces, etc.) ao cliente.
      console.error(e);
      return jsonResponse({ erro: "erro", mensagem: "Ocorreu um erro interno." }, 500);
    }
  }
};
