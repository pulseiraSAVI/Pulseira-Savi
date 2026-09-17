# SAVI — Sistema de Acesso Virtual a Informação Clínica

Camada de acesso rápido de emergência a dados clínicos essenciais de
pacientes crónicos de alto risco, para o piloto num único serviço de
urgência em Portugal — **não** uma nova base de dados clínica paralela,
mas um complemento ao RSE/SPMS para os primeiros minutos de uma urgência.

Ver `CLAUDE.md` para o contexto completo do projeto (visão, arquitetura,
schema, regras não negociáveis). Este README cobre apenas "como correr e
o que existe nesta iteração".

> **Pivô de 15 de setembro de 2026.** Esta versão substitui por completo
> o modelo anterior (família / profissional clínico / equipa
> administradora / auditor). O modelo atual é **utilizador / profissional
> / superadmin** (auditor é um sub-papel do superadmin) — ver secção
> "Credenciais" abaixo. **A app de família está suspensa** e o **Nível 2
> foi eliminado por completo**: não há nenhum ecrã além do Nível 1.

## Como abrir a simulação

Não há build nem servidor: `docs/` é tudo vanilla JS (sem frameworks,
sem bundler), com `<script>` normais carregados por ordem no
`index.html`. Basta abrir o ficheiro diretamente no browser:

```
docs/index.html
```

(duplo clique, ou `file:///caminho/para/savi/docs/index.html`).

Os dados são simulados em `docs/js/mockdb.js` e persistidos em
`localStorage` do browser (chave `savi_db_v2`) — cada browser/perfil
mantém o seu próprio estado. Para repor os dados de demonstração ao
estado inicial, abrir a consola do browser nessa página e correr
`mockdb._reset()`.

## Identificação e os 3 métodos de acesso

A app já não tem "login profissional" e "login família" em ecrãs
separados: existe uma **identificação única** por **nº de Ordem + PIN
alfanumérico de 5 caracteres** (real, com hash SHA-256 — nunca guardado
em texto simples, mesmo nesta simulação em browser). Uma mesma conta
pode ter os papéis **profissional** e **utilizador** ao mesmo tempo; se
tiver os dois, a app pergunta com qual quer entrar nesta sessão (nunca
mostra os dois em simultâneo).

Depois de identificado como **utilizador** (break-glass), escolhe um de
3 métodos para chegar ao Nível 1 de um paciente — todos ficam sujeitos
às mesmas regras de auditoria (`acessos`, mesmo em caso de negação):

1. **Leitura de pulseira** (NFC ou QR) — lista de tokens de demonstração,
   sem hardware real nesta simulação.
2. **Número de utente** — introdução manual.
3. **Identidade** — nome completo + data de nascimento + sexo. Exige
   **motivo obrigatório** antes de mostrar qualquer dado.

## Credenciais de demonstração

Todas usam nº de Ordem + PIN de 5 caracteres no mesmo ecrã de
identificação:

| Nº de Ordem | PIN | Nome | Papéis |
|---|---|---|---|
| `12345M` | `A1B2C` | Dr.ª Ana Silva | Profissional + Utilizador (escolhe ao entrar) |
| `54321C` | `T4G05` | Dr. Tiago Mendes | Só Profissional |
| `99887E` | `M3D1C` | Enf.º Marco Pinto | Só Utilizador (break-glass) |
| `ADMIN01` | `9XZQ7` | Rui Ferreira | Superadmin + função de auditor |
| `ADMIN02` | `7YTR2` | Carla Nunes | Superadmin (sem auditor) |

Pacientes de demonstração já com pulseira ativa (visíveis no método de
acesso por pulseira): Matilde Sousa (pediátrica, epilepsia, nº utente
`3001445982`), João Ribeiro (adulto, doença renal crónica, nº utente
`1122334455`). Rodrigo Alves (pediátrico, cardiopatia congénita, nº
utente `5566778899`) tem uma pulseira marcada como `perdida`, e há duas
pulseiras `nao_atribuida`, para testar o botão "Solicitar pulseira" e o
ecrã de erro correspondente.

## Papéis (pivô de 15/09/2026)

- **Utilizador** — break-glass, os 3 métodos acima, só leitura do
  Nível 1 de qualquer paciente.
- **Profissional** — cria pacientes, escreve/edita os dados clínicos,
  solicita pulseira — mas só vê/edita os pacientes que ele próprio
  criou.
- **Superadmin** — acesso ilimitado de leitura/escrita, vê/edita
  qualquer paciente (sem a restrição "só os meus"), e tem uma secção
  extra "Contas" para criar/editar/eliminar profissionais e
  utilizadores (papéis, PIN).
- **Auditor** — sub-papel do superadmin (`funcao_auditor = true`), dá
  acesso a um botão extra "Segurança / Auditoria" (lê a tabela
  `acessos`).
- **Família — suspensa.** Os ficheiros `login-familia.js`,
  `familia-pacientes.js` e `familia-paciente-detalhe.js` continuam em
  `docs/js/views/` (não foi possível eliminá-los neste ambiente — falha
  de permissões) mas não são carregados por `index.html` nem têm
  nenhuma rota alcançável no `router.js`. É o profissional quem cria o
  paciente agora, não a família — a família assina o termo de
  responsabilidade e o RGPD em papel, arquivados como "documentos" no
  perfil do paciente.

## Estrutura do Nível 1 (pivô de 15/09/2026)

Cabeçalho fixo (nome + último apelido, idade em anos e/ou meses, peso,
altura, superfície corporal — fórmula de Mosteller — e hora atual) +
4 secções no menu de footer: **Dados do utente**, **Algoritmo**
(alergias, biometria, condição crítica, esquema de dose, medicação
contraindicada, limitação terapêutica, notas — grupo sanguíneo e
calendário vacinal foram removidos), **Medicação Habitual** (medicação
crónica + horário, e a lista de documentos RGPD/termo de
responsabilidade digitalizados), e **Configuração** (dados da sessão,
versão da app, email de suporte).

**Não existe Nível 2** — nenhum botão, modal, ou lógica de "aceder a
histórico completo" no fluxo de break-glass.

## PWA (instalável)

`docs/` é uma PWA completa: `manifest.webmanifest` + `sw.js` (cache-first
dos assets, versionado em `SW_VERSION` dentro de `sw.js` — bump esse valor
sempre que alterares CSS/HTML/JS, senão quem já tem a app instalada continua
a ver a versão antiga) + ícones em `docs/icons/`. O service worker só se
regista quando servido por http(s) (GitHub Pages, por exemplo); ao abrir por
`file://` localmente isso é ignorado de propósito, sem erros na consola.

## Responsivo (PC, Mac, Android, iPhone, iPad)

Os ecrãs de identificação, escolha de papel/método, e Nível 1 usam uma
moldura de telemóvel decorativa acima de 640px de largura (útil ao rever
a app num Mac/PC); em ecrãs mais estreitos, ou com a app instalada em
modo standalone num iPhone/Android, a moldura desaparece e o ecrã ocupa
o viewport todo. As vistas de profissional/superadmin (tabelas,
formulários) já eram responsivas por defeito.

Também tratado: `env(safe-area-inset-*)` para não ficar por baixo do
Dynamic Island/entalhe nem da barra de gestos em iPhone (incluindo o
novo menu de footer do Nível 1); `font-size:16px` nos campos de
formulário (evita o zoom automático do Safari iOS ao focar um input);
alvos de toque com pelo menos 44px de altura.

## Simulação vs. scaffolding real

Esta iteração continua a ter duas partes de natureza muito diferente —
**tudo o que está em `docs/` corre inteiramente no browser, sem qualquer
ligação a Firebase ou Cloudflare reais**. Ligar a infraestrutura real é
um passo seguinte, ainda não feito:

**`docs/js/*.js` — simulação, corre inteiramente no browser:**
- `mockdb.js` simula o Firestore (persistido em `localStorage`),
  incluindo `profissionais` com `pin_hash`, `pacientes` com
  `numero_utente`/`sexo`/`gestor_do_caso`, `dados_nivel1` no formato
  novo, e a nova coleção `documentos`.
- `hash-util.js` calcula o hash SHA-256 do PIN via Web Crypto API — o
  PIN nunca é guardado nem comparado em texto simples, mesmo aqui.
- `auth-sim.js` simula o Firebase Auth: identificação por nº de Ordem +
  PIN, escolha de papel quando a conta tem mais de um, timeout de
  sessão de 5 min real.
- `worker-sim.js` simula o Cloudflare Worker: é o único módulo que fala
  com o `mockdb` durante os 3 métodos de acesso, escrevendo sempre em
  `acessos` (mesmo em negação).

Isto permite navegar os três fluxos (utilizador, profissional,
superadmin) de ponta a ponta sem qualquer infraestrutura externa.

**`backend/` — scaffolding comentado para produção, não funcional sem
credenciais reais:**
- `backend/firestore.rules` — Firestore Security Rules reais, já no
  modelo novo de papéis, prontas para deploy (`firebase deploy --only
  firestore:rules`), mas que precisam de um projeto Firebase real com
  as custom claims configuradas para fazer sentido.
- `backend/firestore-schema.md` — schema completo das coleções
  Firestore desta revisão, com tipos de campo e índices sugeridos.
- `backend/cloudflare-worker/` — esqueleto do Worker real (`src/index.js`
  + `wrangler.toml`) com os 3 endpoints de acesso (`/acesso/pulseira`,
  `/acesso/numero-utente`, `/acesso/identidade`) e validação do PIN por
  hash — todos os pontos que precisam de configuração real assinalados
  com `TODO` (chave pública do Firebase para verificar ID tokens,
  `FIREBASE_PROJECT_ID`, credenciais da service account,
  `RESEND_API_KEY`). Não inventa segredos nem chaves.

## Próximos passos para sair da simulação

1. Criar o projeto Firebase em `europe-west` (Firestore + Auth + Storage
   para os documentos digitalizados), com as coleções descritas em
   `backend/firestore-schema.md`.
2. Configurar as custom claims (`papeis`, `funcao_auditor`,
   `profissional_id`) no momento da criação de cada conta pelo
   superadmin — nunca editáveis pelo próprio utilizador.
3. Deploy das regras: `firebase deploy --only firestore:rules` a partir
   de `backend/firestore.rules`.
4. Preencher os `TODO` de `backend/cloudflare-worker/src/index.js`
   (verificação real de ID tokens via JWKS, obtenção de access token da
   service account, chamadas REST ao Firestore) e configurar os secrets:
   ```
   wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY
   wrangler secret put RESEND_API_KEY
   ```
5. Deploy do Worker: `wrangler deploy` a partir de
   `backend/cloudflare-worker/`.
6. Substituir `docs/js/worker-sim.js` e `docs/js/auth-sim.js` por
   chamadas reais ao Worker e ao Firebase Auth SDK — o resto do
   frontend (views, router, styles) não deve precisar de alterações
   estruturais.
7. Resolver as pendências legais/organizativas não bloqueadas por
   código: EIPD/DPIA formal, DPAs com subprocessadores, validação
   formal do DPO (ver `CLAUDE.md`, aviso no topo do documento) — nenhum
   paciente real (fictício ou não) antes disso.

## Fora de âmbito nesta iteração

- App de família (suspensa — ver secção "Papéis" acima).
- Nível 2 (eliminado por completo).
- Ferramenta de gravação NFC (Web NFC API).
- Geração/impressão de QR.
- Integração real com o RSE/SNS 24 ou com a Chave Móvel Digital/PEM.
- Fluxo de auto-registo de profissionais (só o superadmin cria contas
  por agora).
