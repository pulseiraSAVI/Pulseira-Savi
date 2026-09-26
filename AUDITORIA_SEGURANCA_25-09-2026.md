# SAVI — Auditoria de código e de aplicação (25/09/2026)

> Âmbito: repositório completo (`docs/`, `backend/`, `scripts/`) + app em
> produção (`https://pulseirasavi.github.io/Pulseira-Savi/`), com testes
> ativos usando as contas fictícias já existentes (TESTE01/02, UTIL01,
> ADMIN01, paciente "Maria Fictícia Teste"). Não tive acesso a Firebase
> nem Cloudflare neste ambiente — os achados de infraestrutura vêm de ler
> as Rules/Worker no repositório e de testar o comportamento real via
> chamadas ao Worker já implantado.

## Resultado em uma frase

O esqueleto de segurança está bem desenhado — negar por defeito nas
Rules, service account isolada no Worker, auditoria de todos os acessos,
nunca gravar dado clínico no chip — mas há **duas falhas exploráveis
hoje, em produção**: o PIN de 5 caracteres pode ser testado sem limite
nenhum contra o Worker, e vários ecrãs inserem dados escritos por
profissionais/utilizadores em HTML sem escapar, abrindo XSS armazenado —
num dos casos, de um `utilizador` comum até ao browser do superadmin.
Nenhuma das duas exigia acesso a sistemas fora do meu alcance para
corrigir ou documentar; o XSS já está corrigido nesta sessão, o PIN fica
como a prioridade nº 1 do plano abaixo.

**Nota de escopo, não achado:** as pendências legais/organizativas
(EIPD/DPIA, DPAs, dispositivo médico, comissão de ética) já estão
cobertas em `ROADMAP_MELHORIAS.md` — esta auditoria é só código e
segurança técnica, não repete esse conteúdo.

---

## Classificação e pontuação

| | Antes desta auditoria | Depois das correções desta sessão |
|---|---|---|
| Qualidade/segurança do código | ~6/10 | ~7/10 — falta a correção do PIN (item crítico) para chegar a 8/10 |
| Segurança/robustez da app | ~6/10 | ~7/10 — mesma dependência acima para chegar a 9/10 |

Não chega a 8/9 sozinho: os dois itens que faltam (PIN/password e rate
limiting) exigem alterações coordenadas ao Worker + `scripts/criar-
conta.js` + um deploy que não consigo fazer neste ambiente (sem
credenciais Firebase/Cloudflare) — ver checklist de implementação no
final.

**Atualização (26/09/2026):** a correção do C1 já está feita no código
(ver achado C1), mas continua sem deploy — por isso a pontuação acima
não sobe ainda. A nota de segurança poderá subir após o deploy e a
reemissão coordenada das contas de teste estarem confirmados.

---

## Achados críticos (corrigir antes do primeiro paciente real, mesmo fictício)

### C1 — O PIN funciona como a própria password do Firebase Auth, sem sal, e sem limite de tentativas

**Onde:** `docs/js/auth-real.js` (`identificar`), `scripts/criar-
conta.js`, `backend/cloudflare-worker/src/index.js`
(`validarPapelUtilizadorEPin`).

**O problema, em três partes que se multiplicam:**

1. A password do Firebase Auth de cada conta **é literalmente**
   `SHA-256(PIN)` em hexadecimal — não uma segunda credencial, o próprio
   hash. Isso significa que o campo `profissionais.pin_hash`, visível a
   qualquer superadmin e presente em qualquer cópia de segurança do
   Firestore, **é a password válida** para entrar como essa conta — sem
   nunca precisar de saber o PIN real. Não é preciso quebrar o hash, só
   copiá-lo.
2. O hash é SHA-256 simples, sem sal. Um PIN de 5 caracteres
   alfanuméricos tem um espaço pequeno (± 60 milhões de combinações se
   só maiúsculas+dígitos) — trivial de atacar offline se o `pin_hash`
   alguma vez sair do Firestore (backup, exportação, bug de regra).
3. **Confirmei ao vivo** que o Worker não tem nenhum limite de
   tentativas: usando a conta de teste UTIL01, fiz 8 pedidos seguidos com
   PIN errado contra `/acesso/numero-utente` e todos voltaram
   `401 pin_invalido` sem atraso crescente nem bloqueio de conta. Ver
   `Anexo A` para os números exatos.

**Risco real:** alguém com uma conta break-glass válida (ou que consiga
criar uma) pode tentar exaustivamente o PIN de qualquer outra conta
diretamente contra a Firebase Auth REST API (a chave web do Firebase não
é secreta, está sempre embutida no frontend) usando o hash como password
candidata — sem limite, sem alarme.

**Como corrigir (desenho já pronto, falta implementar + deploy):**
- Deixar de usar `SHA-256(PIN)` como password do Firebase Auth. Duas
  alternativas, a segunda é a mais limpa:
  - (a) Gerar uma password aleatória forte por conta no momento da
    criação (guardada só uma vez, nunca derivada do PIN), e passar a
    validar o PIN **exclusivamente** no Worker contra um hash com sal e
    função lenta (ver abaixo) — a Firebase Auth passa a servir só para
    obter um ID token, não para provar o PIN.
  - (b) Migrar para **Firebase Custom Tokens**: o cliente envia nº de
    Ordem + PIN ao Worker num pedido de "login"; o Worker valida o PIN
    (hash com sal) contra o Firestore e, só depois de validar, usa o
    Admin SDK para emitir um Custom Token com `admin.auth().
    createCustomToken(uid, claims)`; o cliente troca esse token por uma
    sessão com `signInWithCustomToken`. Mais trabalho de migração, mas
    remove de vez qualquer necessidade de uma "password" derivada do PIN.
- Independentemente da opção escolhida: mudar o hash do PIN de SHA-256
  simples para PBKDF2/scrypt com sal por conta (Web Crypto API já
  suporta `PBKDF2` nativamente, tanto no browser como no Worker — não
  precisa de biblioteca nova).
- Adicionar limite de tentativas: contador por conta em Firestore
  (`tentativas_pin_falhadas`, `bloqueado_ate`) incrementado pelo próprio
  Worker a cada `pin_invalido` — não depende de nenhuma infraestrutura
  nova, só de mais um campo e uma escrita. Um bloqueio de 5 tentativas /
  15 minutos já elimina o ataque de força bruta online.
- Ação adicional, zero código: configurar uma **Cloudflare Rate Limiting
  Rule** no dashboard (não no Worker) para o caminho `/acesso/*` — ex.:
  máximo 10 pedidos/minuto por IP. Isto é configuração de infraestrutura,
  não código, por isso não precisa de deploy do Worker.

**Estado:** CORRIGIDO NO CÓDIGO em 26/09/2026, PENDENTE DE DEPLOY —
migração completa para Firebase Custom Tokens (o login já não usa
`signInWithEmailAndPassword` nem deriva uma password do PIN). O PIN
passa a ser validado no backend (Worker) com PBKDF2-SHA256 + sal por
conta (100 000 iterações) e fica sujeito a bloqueio de 15 minutos ao
fim de 5 tentativas erradas (campos novos `pin_salt`/
`tentativas_pin_falhadas`/`bloqueado_ate` em `profissionais`). Só
depois de validado o PIN é que o Worker assina um Firebase Custom
Token (RS256), trocado no cliente via `signInWithCustomToken` — elimina
por completo o vetor descrito neste achado. **Este fix só se torna
real após `wrangler deploy` do Worker E reemissão coordenada das contas
de teste existentes (ADMIN01/TESTE01/TESTE02/UTIL01) via
`scripts/criar-conta.js` atualizado** — ver checklist de deploy em
`CLAUDE.md`, secção "Execução do roadmap de melhorias — sessão de
26/09/2026". Até esse deploy acontecer, o comportamento em produção
permanece o descrito no Anexo A abaixo (teste de força bruta
pré-correção).

### C2 — XSS armazenado em vários ecrãs (CORRIGIDO nesta sessão)

**Onde:** `resultado-nivel1.js` (ecrã de break-glass — o mais crítico do
projeto), `nivel1-form.js` (incluindo dentro de `<textarea>`, onde nem
sequer havia o escaping parcial que já existia nos `value=""`),
`pacientes-lista.js`, `admin-tokens.js`, `admin-contas.js`,
`admin-auditoria.js`.

**O problema:** todos estes ecrãs constroem HTML por concatenação de
string e inserem diretamente em `innerHTML` texto escrito por
profissionais (nome/morada/contactos do paciente, notas clínicas,
esquema de dose, nome de gestor do caso) ou por utilizadores (campo
`motivo`, obrigatório no acesso por identidade) — sem qualquer escaping.

**O pior caso, especificamente:** `admin-auditoria.js` mostrava
`a.motivo` sem escapar na tabela de Segurança/Auditoria — um campo de
texto livre que **qualquer conta com papel `utilizador`** preenche ao
fazer acesso por identidade. Isso é um `utilizador` a conseguir correr
JavaScript no browser do **superadmin/auditor** só ao escrever
`<img src=x onerror=...>` como motivo de um acesso de emergência — uma
escalada de privilégio real, não teórica.

**Correção aplicada agora:** criei `docs/js/dom-util.js`
(`domUtil.escapeHtml`) e apliquei-o em todos os pontos de interpolação
identificados nos 6 ficheiros acima (ver commit desta sessão para o
diff completo). `nivel1-form.js` já tinha uma função `escapeAttr` local
— só escapava aspas, o suficiente para `value="..."` mas não para dentro
de `<textarea>...</textarea>`; passou a delegar em `domUtil.escapeHtml`
(escapa também `< > & '`), corrigindo os dois contextos de uma vez.

**Por que ficou 7/10 e não 9/10 mesmo com isto corrigido:** esta é a
correção mais visível, mas o C1 (PIN/password) pesa mais no risco geral
— continua a ser o item que bloqueia a pontuação alvo.

---

## Achados de risco alto

### A1 — Firestore Rules não validam o *conteúdo* dos campos, só a posse

As regras (`backend/firestore.rules`) verificam sempre "este profissional
é o dono deste paciente", mas nunca "este campo tem um valor válido". Um
cliente modificado (não a UI normal, mas alguém a chamar o SDK do
Firestore diretamente) pode escrever, por exemplo, `estado_consentimento:
"<qualquer string>"` em vez de um dos 3 valores esperados. Isto amplia a
superfície do C2 (mais um vetor de dados não confiáveis a chegar aos
ecrãs) e é, de forma independente, uma falta de validação de schema.
**Mitigação parcial já aplicada (25/09):** os campos deste tipo (`estado_
consentimento`, `estado_verificacao`) passaram a ser escapados como os
restantes nesta sessão.

**Estado (26/09/2026): CORRIGIDO E VALIDADO EM PRODUÇÃO.**
`backend/firestore.rules` ganhou `estadoConsentimentoValido()` (aplicada
a `pacientes`, superadmin incluído — não só profissional) e
`dadosNivel1Validos()` (aplicada a `dados_nivel1`, valida
`estado_verificacao` e `limitacao_terapeutica`). A regra de leitura de
`pacientes` foi separada da de update/delete para a validação de
conteúdo não interferir com a verificação estática de list queries (a
mesma técnica já usada para o bug de list de 25/09). Deploy feito
(`firebase deploy --only firestore:rules`) e confirmado ao vivo: registo
de uma nova paciente fictícia ("Barbara Ficticia, teste") pela conta
`TESTE01`, com `estado_consentimento` válido, sem qualquer erro de regra.

### A2 — `auth_time` não serve para medir inatividade

`validarJanelaDeSessao` no Worker usa `claims.authTime`, que no Firebase
Auth é fixado no momento do **login original** e não muda quando o SDK
renova o ID token silenciosamente em segundo plano. Na prática, isto não
implementa "5 minutos de inatividade" (CLAUDE.md) — implementa "5
minutos desde o login", ponto final, mesmo que o profissional esteja a
usar a app sem parar. Duas consequências, uma de segurança e uma
funcional: (a) não protege contra um dispositivo desbloqueado deixado
sem vigilância por mais de 5 min mas em uso constante (a sessão do
Firebase Auth continua válida no cliente, só o Worker é que vai começar
a recusar depois desse tempo) e (b) na prática, um profissional que
atenda várias emergências seguidas ao longo de mais de 5 minutos vai
começar a levar "sessão expirada" mesmo a meio do trabalho — um bug
funcional que só não apareceu no teste E2E porque este foi rápido.
**Correção correta:** um registo de sessão do lado do servidor (Workers
KV ou Durable Object) com TTL renovado a cada pedido — já estava
esboçado como TODO em `wrangler.toml`, precisa de decisão + binding novo
(infraestrutura, não só código).

### A3 — Método de acesso por identidade lê a coleção `pacientes` inteira para a memória do Worker

`firestoreQueryPorIdentidade` (Worker) fazia um `GET` a toda a coleção
`pacientes` e filtrava em JavaScript, em vez de uma query estruturada.
Aceitável a 50 pacientes (Fase 1), mas: (a) não escala, e (b) mantinha
temporariamente na memória do Worker os dados administrativos de TODOS
os pacientes só para responder a um pedido sobre um.

**Estado (26/09/2026): CORRIGIDO E VALIDADO EM PRODUÇÃO.** Passa a usar
uma query estruturada (`runQuery`) com filtro composto em
`data_nascimento` + `sexo` (igualdade em dois campos não exige índice
composto no Firestore) — reduz o conjunto candidato a um punhado de
documentos antes de comparar `nome` em memória (essa comparação continua
em JS, porque é case-insensitive/trim, algo que uma `EQUAL` do Firestore
não faz). Deploy feito (`wrangler deploy`) e confirmado ao vivo: acesso
por identidade a "Barbara Ficticia, teste" (nome + data de nascimento +
sexo) devolveu `200` com os dados completos.

---

## Achados de risco médio

- **CORS do Worker inclui origens de desenvolvimento em produção**
  (`http://localhost:8000`, `http://127.0.0.1:8000` na mesma lista que o
  domínio real do GitHub Pages). Não é um risco direto (CORS só limita
  JavaScript de browser, não `curl`), mas é uma prática a corrigir —
  separar por ambiente quando existir um processo de deploy com
  variáveis de ambiente. **Decisão (26/09/2026): mantido deliberadamente
  por agora** (documentado no próprio código) — corrigir isto a sério
  exige `wrangler.toml` com ambientes (`[env.production]`/`[env.dev]`) e
  um pipeline que escolha o ambiente certo, mudança de processo maior do
  que o risco justifica hoje.
- **Chave de service account do Firebase Admin SDK existe em disco**
  localmente (`scripts/pulseira-savi-firebase-adminsdk-fbsvc-
  5972a2b955.json`) — confirmei que está corretamente listada no
  `.gitignore` e **nunca foi commitada** (verifiquei o histórico do
  git), por isso não é uma fuga real, mas é uma chave com acesso total
  de escrita ao Firestore a viver sem cifra no disco de um computador
  pessoal. Considerar mover para um gestor de segredos local (ex.:
  chaveiro do macOS) em vez de um ficheiro solto, sobretudo depois de
  ISO 27001 entrar na agenda (ver `ROADMAP_MELHORIAS.md`).
- **Sem validação de tamanho/tipo no upload de documentos**
  (`nivel1-form.js`, `input type="file"`) — aceita qualquer PDF/imagem
  sem limite de tamanho explícito no cliente; as Storage Rules também não
  impunham `request.resource.size` nem `contentType`. **Estado
  (26/09/2026): CORRIGIDO E IMPLANTADO** —
  `backend/storage.rules` passou a exigir `request.resource.size < 10 *
  1024 * 1024 && request.resource.contentType.matches('application/
  pdf|image/.*')` na escrita. Deploy feito (`firebase deploy --only
  storage`); não retestado com um upload real nesta sessão (não bloqueia
  nada que já estivesse a funcionar, só passa a rejeitar ficheiros fora
  do limite).

## Achados de risco baixo (higiene de código — corrigidos nesta sessão)

- **Código órfão/morto:** 10 ficheiros de uma iteração de demo anterior
  (`auth-sim.js`, `worker-sim.js`, `admin-nivel1-form.js`, `admin-
  pacientes.js`, `admin-profissionais.js`, `familia-paciente-detalhe.js`,
  `familia-pacientes.js`, `login-familia.js`, `login-profissional.js`,
  `scan.js`) continuavam no repositório, já documentados no próprio
  `index.html` como "não carregados, inalcançáveis" — confirmei via
  `router.js` que nenhuma rota os referencia e removi-os nesta sessão.
- **`console.log` residual:** nenhum encontrado fora de `node_modules/`
  (só `console.error`/`console.warn`, uso correto).
- **`eval`/`new Function`/`document.write`:** nenhuma ocorrência.
- Dependências diretas (`jose` no Worker) estão em versão atual; não há
  `package.json` do frontend (vanilla JS sem bundler, por desenho do
  projeto) por isso não há superfície de dependências npm no browser.

---

## Anexo A — Evidência do teste de força bruta ao PIN (25/09/2026)

Autenticado como UTIL01 (conta de teste, papel `utilizador`), 8 pedidos
consecutivos a `POST /acesso/numero-utente` com `pin: "XXXXX"`
(incorreto):

| Tentativa | Status | Erro | Latência |
|---|---|---|---|
| 1 | 401 | pin_invalido | 368 ms |
| 2 | 401 | pin_invalido | 1143 ms |
| 3 | 401 | pin_invalido | 169 ms |
| 4 | 401 | pin_invalido | 113 ms |
| 5 | 401 | pin_invalido | 160 ms |
| 6 | 401 | pin_invalido | 335 ms |
| 7 | 401 | pin_invalido | 207 ms |
| 8 | 401 | pin_invalido | 114 ms |

Nenhum atraso crescente, nenhum bloqueio, nenhuma resposta diferente de
`401 pin_invalido`. Confirma o achado C1.

> **Nota (26/09/2026):** este teste reflete o estado pré-correção do
> C1. A correção (PBKDF2 + sal + bloqueio de 5 tentativas/15 min +
> migração para Custom Tokens) já está no código mas ainda não foi
> implantada — ver estado atualizado no achado C1 acima. Este anexo
> fica como registo histórico do comportamento observado em produção
> nesta data, não é reexecutado.

---

## O que já foi corrigido e commitado nesta sessão

1. `docs/js/dom-util.js` — novo utilitário `escapeHtml`.
2. Escaping aplicado em `resultado-nivel1.js`, `nivel1-form.js`,
   `pacientes-lista.js`, `admin-tokens.js`, `admin-contas.js`,
   `admin-auditoria.js` (C2).
3. Remoção de 10 ficheiros órfãos + atualização do comentário em
   `index.html`.
4. `sw.js` → `savi-v9` (bump obrigatório pela convenção do projeto,
   inclui `dom-util.js` no precache).
5. `TODO`s detalhados deixados em `backend/cloudflare-worker/src/
   index.js`, `docs/js/auth-real.js` e `scripts/criar-conta.js` com o
   desenho da correção do C1, prontos para implementação numa sessão
   dedicada.

## O que falta — checklist de implementação/deploy (para executar quando decidido)

Nada disto precisa de mim para ser decidido — só de acesso a Firebase/
Cloudflare que não tenho neste ambiente:

```
# Depois de implementar a correção do C1 (PIN com sal + rate limit + nova
# estratégia de password/custom token):
cd scripts && npm install
GOOGLE_APPLICATION_CREDENTIALS=<caminho> node criar-conta.js   # re-emitir contas de teste com o novo esquema

cd backend/cloudflare-worker
npx wrangler deploy                                             # nova lógica de PIN no Worker

# Depois de adicionar validação de enums às Firestore Rules (A1) e
# limites de tamanho/tipo às Storage Rules (A2 do roadmap de storage):
cd backend
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only storage

# Zero código, só dashboard:
# Cloudflare > savi-worker > Rate Limiting Rules — limitar /acesso/* a
# ~10 pedidos/min por IP.
```

## Prioridade sugerida (junta-se à de `ROADMAP_MELHORIAS.md`, não a substitui)

1. **C1 (PIN/password)** — antes de qualquer paciente real, mesmo
   fictício adicional além dos já testados. É o único achado desta
   auditoria que considero um verdadeiro bloqueador.
2. Rate Limiting Rule no Cloudflare (zero código, mitiga C1 parcialmente
   enquanto a correção completa não está pronta).
3. A1 (validação de enums nas Rules) e o limite de tamanho/tipo no
   Storage — pequenos, encaixam bem na mesma sessão que o deploy do C1.
2. A2 (sessão real por inatividade) — também corrige o bug funcional das
   sessões longas, vale a pena juntar ao roadmap de "gestão de contas"
   (`ROADMAP_MELHORIAS.md`, bloco 1.1/1.2).
3. A3 (query de identidade) — só urgente se o piloto crescer além de 50
   pacientes; documentar e revisitar nessa altura.
