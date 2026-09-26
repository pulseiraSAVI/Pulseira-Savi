/**
 * scripts/criar-conta.js
 * SAVI — cria (ou reemite) uma conta de profissional/utilizador/superadmin,
 * escrevendo diretamente o documento em `profissionais/{uid}` no Firestore.
 *
 * Existe porque é o caminho de bootstrap da PRIMEIRA conta superadmin,
 * antes de existir qualquer conta capaz de usar os endpoints de gestão de
 * contas do Worker (`POST /admin/contas`, ver backend/cloudflare-worker/
 * src/index.js) — a partir da segunda conta em diante, o caminho normal
 * passa a ser a vista de superadmin "Contas" na app (que fala com esses
 * endpoints), não este script.
 *
 * CORRIGIDO em 26/09/2026 (ver AUDITORIA_SEGURANCA_25-09-2026.md, achado
 * C1): já não toca no Firebase Auth (createUser/setCustomUserClaims)
 * nem deriva nenhuma "password" do PIN. O PIN passa a ser guardado com
 * PBKDF2-SHA256 + sal por conta (100 000 iterações, o mesmo esquema e os
 * mesmos parâmetros do Worker — ver pbkdf2Hex em
 * backend/cloudflare-worker/src/index.js, têm de ficar sempre
 * sincronizados). O login (`/auth/login` no Worker) autentica-se com
 * Firebase Custom Tokens assinados só depois de validar o PIN — a conta
 * Firebase Auth correspondente a este uid é criada automaticamente no
 * primeiro login, nunca aqui.
 *
 * Alinhado com backend/firestore-schema.md e backend/firestore.rules —
 * qualquer alteração de campos tem de ser feita nos dois sítios.
 *
 * Uso:
 *   cd scripts
 *   npm install
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json node criar-conta.js
 *
 * A service account JSON é a mesma que vai para
 * `wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY` (Firebase Console >
 * Definições do projeto > Contas de serviço > Gerar nova chave privada).
 * Nunca commitar esse ficheiro no repositório.
 */

const readline = require("readline");
const crypto = require("crypto");
const admin = require("firebase-admin");

const PAPEIS_VALIDOS = ["profissional", "utilizador", "superadmin"];
const PBKDF2_ITERACOES = 100000; // tem de ser IGUAL a PBKDF2_ITERACOES no Worker

// Tem de replicar exatamente pbkdf2Hex() em
// backend/cloudflare-worker/src/index.js (PBKDF2-HMAC-SHA256, mesmo
// número de iterações, saída de 256 bits/32 bytes) — Node e Web Crypto
// implementam o mesmo standard (PKCS#5/RFC 2898), por isso o mesmo PIN +
// sal produz sempre o mesmo hash nos dois lados.
function pbkdf2Hex(pin, saltHex) {
  return crypto.pbkdf2Sync(pin, Buffer.from(saltHex, "hex"), PBKDF2_ITERACOES, 32, "sha256").toString("hex");
}

function gerarSaltHex() {
  return crypto.randomBytes(16).toString("hex");
}

function pergunta(rl, texto) {
  return new Promise((resolve) => rl.question(texto, (resposta) => resolve(resposta.trim())));
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      "\nErro: falta a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS,\n" +
        "apontando para o JSON da service account do projeto Firebase.\n\n" +
        "Exemplo:\n" +
        "  GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json node criar-conta.js\n"
    );
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
  const db = admin.firestore();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n=== SAVI — criar/reemitir conta ===\n");

  const nome = await pergunta(rl, "Nome completo: ");
  const credencialOrdem = (await pergunta(rl, "Nº de Ordem (identificador de login): ")).trim();

  // Se já existir uma conta com este nº de Ordem, reemite-a (novo PIN,
  // novo sal) em vez de criar uma duplicada — útil sobretudo para migrar
  // as contas do esquema antigo (SHA-256 sem sal) para o esquema novo.
  const existente = await db.collection("profissionais").where("credencial_ordem", "==", credencialOrdem).limit(1).get();
  const uidExistente = existente.empty ? null : existente.docs[0].id;
  if (uidExistente) {
    console.log(`\nJá existe uma conta com este nº de Ordem (uid ${uidExistente}) — vai ser reemitida com um PIN novo.`);
  }

  let pin = "";
  while (pin.length !== 5) {
    pin = (await pergunta(rl, "PIN alfanumérico (exatamente 5 caracteres): ")).trim().toUpperCase();
    if (pin.length !== 5) console.log("  -> O PIN tem de ter exatamente 5 caracteres. Tenta outra vez.");
  }

  let papeisInput = [];
  while (papeisInput.length === 0) {
    const resposta = await pergunta(
      rl,
      `Papéis, separados por vírgula (opções: ${PAPEIS_VALIDOS.join(", ")}): `
    );
    papeisInput = resposta
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter((p) => PAPEIS_VALIDOS.includes(p));
    if (papeisInput.length === 0) console.log("  -> Pelo menos um papel válido é obrigatório. Tenta outra vez.");
  }

  let funcaoAuditor = false;
  if (papeisInput.includes("superadmin")) {
    const resposta = (await pergunta(rl, "Esta conta tem função de auditor? (s/N): ")).trim().toLowerCase();
    funcaoAuditor = resposta === "s" || resposta === "sim";
  }

  let servico = "";
  let especialidade = "";
  let instituicaoServico = "";
  let telefoneInstitucional = "";
  if (papeisInput.includes("profissional") || papeisInput.includes("utilizador")) {
    servico = await pergunta(rl, "Serviço (ex.: \"Urgência Pediátrica\"): ");
    especialidade = await pergunta(rl, "Especialidade (mostrada como gestor do caso): ");
    instituicaoServico = await pergunta(rl, "Instituição + serviço: ");
    telefoneInstitucional = await pergunta(rl, "Telefone institucional: ");
  }

  rl.close();

  const uid = uidExistente || crypto.randomUUID();
  const salt = gerarSaltHex();
  const pinHash = pbkdf2Hex(pin, salt);

  await db.collection("profissionais").doc(uid).set(
    {
      nome,
      credencial_ordem: credencialOrdem,
      pin_hash: pinHash,
      pin_salt: salt,
      tentativas_pin_falhadas: 0,
      bloqueado_ate: null,
      papeis: papeisInput,
      funcao_auditor: funcaoAuditor,
      servico: servico || null,
      especialidade: especialidade || null,
      instituicao_servico: instituicaoServico || null,
      telefone_institucional: telefoneInstitucional || null,
      ativo: true,
      criado_em: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  console.log(`\nDocumento profissionais/${uid} escrito no Firestore (esquema de PIN com sal).`);
  console.log("\nConcluído. Esta conta já pode identificar-se na app com:");
  console.log(`  Nº de Ordem: ${credencialOrdem}`);
  console.log(`  PIN: ${pin}`);
  console.log("\n(O PIN nunca fica guardado em texto simples em lado nenhum — só aqui, no teu terminal, agora.");
  console.log("Não é preciso tocar no Firebase Auth: a conta é criada automaticamente no primeiro login,");
  console.log("via Custom Token assinado pelo Worker depois de validar este PIN.)\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("\nErro:", e.message || e);
  process.exit(1);
});
