/**
 * scripts/criar-conta.js
 * SAVI — cria (ou atualiza) uma conta de profissional/utilizador/superadmin:
 * regista o utilizador no Firebase Auth, define as custom claims (papeis,
 * profissional_id, funcao_auditor) e escreve o documento correspondente em
 * `profissionais/{uid}` no Firestore.
 *
 * Existe porque as custom claims só podem ser definidas com o Admin SDK
 * (nunca a partir do cliente) — por isso este é também o script usado para
 * o bootstrap da PRIMEIRA conta superadmin, antes de existir sequer uma
 * vista de superadmin funcional na app para criar as seguintes.
 *
 * Alinhado com backend/firestore-schema.md e backend/firestore.rules —
 * qualquer alteração de campos tem de ser feita nos três sítios.
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

function sha256Hex(texto) {
  // Tem de replicar exatamente docs/js/hash-util.js (SHA-256 hex, UTF-8,
  // sem sal) e a validação equivalente no Worker — o PIN nunca é guardado
  // em texto simples em lado nenhum, incluindo aqui.
  return crypto.createHash("sha256").update(String(texto), "utf8").digest("hex");
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

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n=== SAVI — criar/atualizar conta ===\n");

  const nome = await pergunta(rl, "Nome completo: ");
  const credencialOrdem = (await pergunta(rl, "Nº de Ordem (identificador de login): ")).trim();

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

  const email = `${credencialOrdem.toLowerCase()}@savi.local`;
  const pinHash = sha256Hex(pin);
  // A password do Firebase Auth É o mesmo hash do PIN — nunca uma segunda
  // credencial que o profissional teria de memorizar à parte. O Worker
  // volta a validar o PIN de forma independente (profissionais/pin_hash)
  // em cada pedido de break-glass — dupla verificação, não redundância
  // inútil.
  const passwordAuth = pinHash;

  console.log(`\nA criar/atualizar utilizador Firebase Auth: ${email} ...`);

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(userRecord.uid, { password: passwordAuth, displayName: nome, disabled: false });
    console.log(`Utilizador já existia (uid ${userRecord.uid}) — password e nome atualizados.`);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    userRecord = await admin.auth().createUser({ email, password: passwordAuth, displayName: nome });
    console.log(`Utilizador criado (uid ${userRecord.uid}).`);
  }

  const claims = {
    papeis: papeisInput,
    profissional_id: userRecord.uid,
    funcao_auditor: funcaoAuditor
  };
  await admin.auth().setCustomUserClaims(userRecord.uid, claims);
  console.log("Custom claims definidas:", claims);

  const db = admin.firestore();
  await db
    .collection("profissionais")
    .doc(userRecord.uid)
    .set(
      {
        nome,
        credencial_ordem: credencialOrdem,
        pin_hash: pinHash,
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

  console.log(`\nDocumento profissionais/${userRecord.uid} escrito no Firestore.`);
  console.log("\nConcluído. Esta conta já pode identificar-se na app com:");
  console.log(`  Nº de Ordem: ${credencialOrdem}`);
  console.log(`  PIN: ${pin}`);
  console.log("\n(O PIN nunca fica guardado em texto simples em lado nenhum — só aqui, no teu terminal, agora.)\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("\nErro:", e.message || e);
  process.exit(1);
});
