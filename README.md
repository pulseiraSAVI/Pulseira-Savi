# SAVI — Sistema de Acesso Virtual a Informação Clínica

Primeira iteração (mockup navegável + infraestrutura base) do SAVI: uma
camada de acesso rápido de emergência a dados clínicos essenciais de
pacientes crónicos de alto risco, para o piloto num único serviço de
urgência em Portugal — **não** uma nova base de dados clínica paralela,
mas um complemento ao RSE/SPMS para os primeiros minutos de uma urgência.

Ver `CLAUDE.md` para o contexto completo do projeto (visão, arquitetura,
schema, regras não negociáveis, questões em aberto). Este README cobre
apenas "como correr e o que existe nesta iteração".

## Como abrir a demo

Não há build nem servidor: `frontend/` é tudo vanilla JS (sem frameworks,
sem bundler), com `<script>` normais carregados por ordem no
`index.html`. Basta abrir o ficheiro diretamente no browser:

```
frontend/index.html
```

(duplo clique, ou `file:///caminho/para/savi/frontend/index.html`).

Os dados são simulados em `frontend/js/mockdb.js` e persistidos em
`localStorage` do browser — cada browser/perfil mantém o seu próprio
estado da demo. Para repor os dados de demonstração ao estado inicial,
abrir a consola do browser nessa página e correr `mockdb._reset()`.

## Credenciais de demonstração

**Profissional clínico** (login: nº de Ordem + password, com 2FA — o
código de 6 dígitos é mostrado no próprio ecrã para efeitos de demo):
- Nº de Ordem `12345M` / password `demo123` — Dr.ª Ana Silva (Urgência Pediátrica)

**Equipa administradora** (mesmo ecrã de login profissional):
- Nº de Ordem `ADMIN01` / password `admin123` — Rui Ferreira (também tem `funcao_auditor = true`, vê a secção Segurança/Auditoria)
- Nº de Ordem `ADMIN02` / password `admin123` — Carla Nunes (sem função de auditor)

**Família** (login por email + password, ecrã próprio):
- `sofia.sousa@exemplo.pt` / password `familia123` — mãe/tutora da paciente Matilde Sousa

Pacientes de demonstração já com pulseira ativa (visíveis no ecrã de
scan): Matilde Sousa (pediátrica, epilepsia), João Ribeiro (adulto,
doença renal crónica). Rodrigo Alves tem uma pulseira já marcada como
`perdida`, e há uma pulseira `nao_atribuida`, para testar os ecrãs de
erro correspondentes.

## PWA (instalável)

`frontend/` é uma PWA completa: `manifest.webmanifest` + `sw.js` (cache-first
dos assets, versionado em `SW_VERSION` dentro de `sw.js` — bump esse valor
sempre que alterares CSS/HTML/JS, senão quem já tem a app instalada continua
a ver a versão antiga) + ícones em `frontend/icons/`. O service worker só se
regista quando servido por http(s) (GitHub Pages, por exemplo); ao abrir por
`file://` localmente isso é ignorado de propósito, sem erros na consola.

## Responsivo (PC, Mac, Android, iPhone, iPad)

Os ecrãs de login profissional, scan, Nível 1 e erro usam uma moldura de
telemóvel decorativa acima de 640px de largura (útil ao rever a app num
Mac/PC — mostra exatamente o que um profissional vê no telemóvel dele); em
ecrãs mais estreitos, ou com a app instalada em modo standalone num
iPhone/Android, a moldura desaparece e o ecrã ocupa o viewport todo, como
qualquer app nativa. As restantes vistas (família, equipa administradora)
já eram responsivas por defeito.

Também tratado: `env(safe-area-inset-*)` para não ficar por baixo do
Dynamic Island/entalhe nem da barra de gestos em iPhone; `font-size:16px`
nos campos de formulário (evita o zoom automático do Safari iOS ao focar
um input); alvos de toque com pelo menos 44px de altura em botões e
campos; tabelas da equipa administradora deslizam horizontalmente em vez
de espremer colunas em ecrãs estreitos.

## Desplegar em GitHub Pages

Este repositório ainda não tem histórico git nem remoto configurado — a
sessão que construiu isto corre num ambiente remoto sem acesso à tua conta
GitHub, por isso os passos finais são para correres tu, no Terminal, dentro
desta pasta:

```bash
cd "/Users/daniellanzasmartin/Documents/Claude/Projects/SAVI"

# 1. Limpar 3 ficheiros/pastas residuais que o ambiente remoto não
#    conseguiu apagar (permissões da pasta partilhada) — no teu Mac local
#    apagas sem problema:
rm -rf .git .DS_Store savi-demo-final.zip

# 2. Inicializar o repositório
git init
git branch -m main
git add -A
git commit -m "SAVI: primeira iteração — demo PWA + scaffolding Firestore/Worker"

# 3. Criar o repositório no GitHub (nome recomendado pelo CLAUDE.md: savi,
#    idealmente sob a organização delfos-iq) — via web (github.com/new) ou,
#    se tiveres o GitHub CLI instalado e autenticado:
gh repo create delfos-iq/savi --private --source=. --remote=origin

# 4. Push
git push -u origin main
```

Depois, em **Settings → Pages** do repositório no GitHub, define **Source:
GitHub Actions** (não "Deploy from a branch"). O workflow
`.github/workflows/deploy-pages.yml`, já incluído, publica automaticamente o
conteúdo de `frontend/` a cada push para `main` — a demo fica acessível em
`https://delfos-iq.github.io/savi/` (ou o URL correspondente ao teu utilizador/
organização).

Nada disto liga a dados reais: continua a ser a mesma demo simulada descrita
abaixo, só que agora acessível por URL em vez de `file://` — o que também é
o pré-requisito para poder ser instalada como PWA num telemóvel.

## Simulação vs. scaffolding real

Esta iteração tem duas partes de natureza muito diferente:

**`frontend/js/*-sim.js` — simulação, corre inteiramente no browser:**
- `mockdb.js` simula o Firestore (persistido em `localStorage`).
- `auth-sim.js` simula o Firebase Auth (login + custom claims de papel +
  timeout de sessão de 5 min real, medido no próprio browser).
- `worker-sim.js` simula o Cloudflare Worker: é o único módulo que fala
  com o `mockdb` durante o fluxo de scan, replicando exatamente os passos
  1-8 do fluxo de break-glass descrito no `CLAUDE.md`.

Isto permite navegar os três fluxos (profissional, família, equipa
administradora) de ponta a ponta sem qualquer infraestrutura externa.

**`backend/` — scaffolding comentado para produção, não funcional sem
credenciais reais:**
- `backend/firestore.rules` — Firestore Security Rules reais, prontas
  para deploy (`firebase deploy --only firestore:rules`), mas que
  precisam de um projeto Firebase real com as custom claims configuradas
  para fazer sentido.
- `backend/firestore-schema.md` — schema completo das coleções Firestore
  da Fase 1, com tipos de campo e índices sugeridos.
- `backend/cloudflare-worker/` — esqueleto do Worker real (`src/index.js`
  + `wrangler.toml`), com todos os pontos que precisam de configuração
  real assinalados com `TODO` (chave pública do Firebase para verificar
  ID tokens, `FIREBASE_PROJECT_ID`, credenciais da service account,
  `RESEND_API_KEY`). Não inventa segredos nem chaves — está desenhado
  para ser preenchido quando a infraestrutura real existir.

## Próximos passos para sair da demo

1. Criar o projeto Firebase em `europe-west` (Firestore + Auth), com as
   coleções descritas em `backend/firestore-schema.md`.
2. Configurar as custom claims (`papel`, `funcao_auditor`,
   `profissional_id`, `conta_familia_id`) no momento da criação de cada
   conta — nunca editáveis pelo próprio utilizador.
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
6. Substituir `frontend/js/worker-sim.js` e `frontend/js/auth-sim.js` por
   chamadas reais ao Worker e ao Firebase Auth SDK, respetivamente — o
   resto do frontend (views, router, styles) não deve precisar de
   alterações estruturais, já está desenhado para essa transição.
7. Resolver as pendências legais/organizativas não bloqueadas por código:
   EIPD/DPIA formal, DPAs com subprocessadores, clarificação do
   responsável pelo tratamento de dados (ver `CLAUDE.md`, secção inicial).

## Fora de âmbito nesta iteração

Por decisão explícita do `CLAUDE.md` do projeto ("Fase ativa: SOMENTE
Fase 1"), não foram implementados nem construídos como scaffolding:

- Fases 2, 3 e 4 do roadmap (profissionais externos, famílias sem relação
  prévia/acesso por pesquisa, integração nativa com RSE/SNS 24) — nem
  código, nem coleções Firestore, nem regras de segurança.
- App de família completa (esta iteração cobre apenas o essencial: ver
  pacientes, consentimento, contacto, revogar pulseira, histórico de
  acessos, pedido de eliminação RGPD art. 17.º).
- Ferramenta de gravação NFC (Web NFC API).
- Geração/impressão de QR.
- Qualquer integração real com o RSE.
