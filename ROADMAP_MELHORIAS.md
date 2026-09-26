# SAVI — Roadmap de melhorias (pós-piloto técnico)

> Criado em 25/09/2026, atualizado em 26/09/2026. Complementa `CLAUDE.md` —
> não o substitui. `CLAUDE.md` continua a ser a fonte da verdade sobre o
> estado atual da infraestrutura (inclui o detalhe técnico de cada correção
> e teste); este documento organiza o que falta a partir daqui, por bloco e
> por prioridade. Itens que passarem a decisão fechada ou a trabalho em
> curso devem migrar para `CLAUDE.md`.

## Estado num relance (26/09/2026)

| Item | Estado |
|---|---|
| 1.1 Gestão de contas desde a app | ✅ Feito, testado e validado em produção |
| 1.2 Recuperação/reset de PIN + reenvio | ⏸️ Bloqueado por #17 (Resend) |
| 1.3 Gravação de pulseiras NFC | 🟡 Código pronto — falta testar em Android físico |
| #17 Configurar Resend | ⬜ Por fazer |
| A2 (timeout de sessão por inatividade real) | ⬜ Por começar |
| 2.1–2.4 (bloco legal/regulatório) | ⬜ Por fazer — não se resolve com código |

## Como ler isto

Três blocos, porque têm donos e prazos diferentes:

1. **Bloco produto/app** — resolve-se com código, dentro do controlo da
   equipa técnica.
2. **Bloco legal/regulatório** — não se resolve com código; precisa de
   DPO, jurídico, e possivelmente entidades externas (CNPD, comissão de
   ética, organismo de certificação). É o mesmo bloco que `CLAUDE.md` já
   assinala como bloqueante para o primeiro paciente real — os itens
   novos aqui (dispositivo médico, comissão de ética) juntam-se a esse
   bloco, não são uma pista à parte.
3. **Bloco marca** — explicitamente de baixa prioridade agora ("esto más
   adelante" — decisão do utilizador). Fica registado para não se perder,
   mas não compete com o resto.

Dentro de cada bloco, a ordem reflete dependências e risco, não é só uma
lista solta.

---

## Bloco 1 — Produto / App

### 1.1 Gestão de contas desde a app (CRUD + papéis) — ✅ testado e validado em 26/09/2026

Concluído: `POST /admin/contas` (criar), `PATCH /admin/contas/:id`
(editar nome/papéis/dados), `POST /admin/contas/:id/reset-pin` (reiniciar
PIN) implementados no Worker e testados de ponta a ponta a partir da vista
"Contas" — criação de conta com PIN gerado, reset de PIN com novo login
confirmado, e edição de papéis persistida. Ativar/desativar continua a ser
escrita direta no Firestore, como já estava.

No caminho deste teste, 2 bugs reais foram encontrados e corrigidos (ver
`CLAUDE.md` para o detalhe técnico): o botão "Editar" nunca mostrava o
formulário (erro de sequência de render), e o service worker podia
precachear ficheiros desatualizados logo após um deploy (corrigido a
forçar `{cache: "reload"}`). `sw.js` → `savi-v11`.

**Continua deliberadamente fora de âmbito:** eliminar conta — o efeito em
cascata sobre pacientes/acessos já criados por essa conta ainda não foi
decidido. Também por decidir: como se registam contas novas (superadmin
cria diretamente vs. profissional pede e superadmin aprova) — por agora
mantém-se só criação direta.

### 1.2 Recuperação de PIN + reset pelo superadmin

Duas necessidades distintas, não confundir:
- **Auto-recuperação** (o profissional/utilizador esqueceu o PIN): decidir
  se existe de todo nesta fase, ou se o caminho é sempre "pede ao
  superadmin para reiniciar" — dado que não há email de recuperação
  configurado (Resend ainda pendente, ver `CLAUDE.md` #17) nem 2FA neste
  modelo. Provavelmente mais simples e mais seguro, nesta escala de
  piloto (uma equipa pequena, um único serviço), ficar só com reset pelo
  superadmin.
- **Reset + reenvio pelo superadmin**: gera um PIN novo (hash, nunca em
  texto simples — regra não negociável já existente), força alteração no
  próximo login, e notifica o titular da conta. O canal de reenvio
  depende de Resend estar configurado (#17) — este item fica portanto
  **bloqueado por #17**, não em paralelo com ele.

### 1.3 Módulo de gravação de pulseiras NFC — 🟡 código pronto, falta testar em hardware

Implementado: botão "Gravar chip" na vista "Pulseiras / Lotes"
(`admin-tokens.js`), Web NFC API (`NDEFReader`, Chrome/Android), grava
apenas o token opaco já existente — nunca dado clínico, como manda a
regra não negociável.

**O que falta, e é o único bloqueante real deste item:** testar em
hardware físico. Não há Android disponível neste ambiente de
desenvolvimento — isto só pode ser feito pelo Daniel, num telemóvel real
com Chrome, antes de gravar qualquer pulseira que vá para um paciente
(fictício ou real). Sugestão: testar em pelo menos dois modelos/versões
de Android diferentes, dado que o suporte a Web NFC varia por fabricante.

QR continua a ser gerado/impresso à parte (fora de âmbito, mantém-se
assim).

**Depende de:** nada do bloco legal. Só depende de acesso a um Android.

### 1.4 A2 — Timeout de sessão por inatividade real (não por 5 min desde o login)

Achado da auditoria de segurança, ainda não corrigido. Hoje o timeout de
5 minutos (`CLAUDE.md`, Fluxo de acesso) é medido a partir do `auth_time`
do token, não de inatividade real — um utilizador ativo pode ser
desligado a meio de uma emergência, e um token roubado pode continuar
válido até ao fim da janela mesmo sem uso. Correção desenhada mas não
implementada: um registo de sessão do lado do servidor (Workers KV ou
Durable Object) com TTL renovado a cada pedido ao Worker.

**Depende de:** o Daniel criar um namespace Workers KV nas credenciais
Cloudflare dele antes do deploy — o código pode ser escrito já, mas o
deploy final precisa dessa peça.

---

## Bloco 2 — Legal / Regulatório (gate para paciente real)

Este bloco já existe em `CLAUDE.md` (EIPD/DPIA, DPAs, validação DPO/CNPD).
Os itens abaixo são adições/detalhamentos a esse mesmo bloco — não o
duplicam.

### 2.1 ISO 27001

Não é um pré-requisito de dia-um para um piloto de 50 pacientes fictícios,
mas é razoável começar a mapear o gap agora, porque toca infraestrutura já
implantada (Firestore Rules, Storage Rules, Worker, gestão de secrets) e é
muito mais barato construir com a norma em mente do que refazer depois.
Sugestão de sequência:
- Gap analysis informal primeiro (o que já está alinhado por acidente:
  cifra em repouso e trânsito, negação por defeito nas rules, hashing de
  PIN — vs. o que falta: política formal de gestão de acessos, registo de
  incidentes, plano de continuidade).
- Certificação formal só faz sentido depois do piloto validar o produto —
  não bloquear o piloto fictício à espera disto.

### 2.2 RGPD, confidencialidade, termo de responsabilidade — documentação

Distinto da EIPD/DPIA (que é uma avaliação de impacto formal, já
mencionada em `CLAUDE.md`): isto é a produção dos próprios documentos que
a família assina em papel (consentimento RGPD + termo de responsabilidade
— já contemplados no fluxo, digitalizados e arquivados no Storage), mais
a política de privacidade e o registo de atividades de tratamento
(Art. 30º RGPD). Sem isto, a EIPD não tem base para se apoiar.
- Minuta do termo de responsabilidade e do consentimento RGPD (conteúdo
  jurídico, não técnico — precisa de advogado/DPO).
- Registo de atividades de tratamento: que dados, que finalidade, que
  subprocessadores (Google/Firebase, Cloudflare — já identificados em
  `CLAUDE.md`), que prazo de conservação.
- Política de confidencialidade interna para quem acede ao sistema
  (profissionais, superadmin) — cobre também o dever de sigilo já
  implícito no acesso break-glass.

### 2.3 Classificação: dispositivo médico?

Pergunta que precisa de resposta jurídica/regulatória antes de avançar
para paciente real, não só de boa vontade técnica. Enquadramento
(Regulamento (UE) 2017/745, MDR):
- SAVI **não trata nem diagnostica** — é uma camada de acesso rápido a
  dados já existentes/introduzidos por um profissional. Isto pesa contra
  a classificação como dispositivo médico.
- Mas o MDR classifica também **software que apoia decisão clínica** em
  função do resultado que produz para o utilizador. O ecrã de Nível 1
  (esquema de atuação perante crise, esquema de dose, medicação
  contraindicada) tem um perfil que se aproxima de "informação de apoio
  à decisão em emergência" — mesmo sem processar nem inferir nada, só
  exibir o que o profissional escreveu.
- **Não assumir a resposta** — isto tem de ser uma opinião formal (do
  DPO/jurídico, possivelmente com parecer de um consultor em MDR), não
  uma dedução feita aqui. Se vier "é dispositivo médico", isso muda o
  caminho de certificação inteiro (marcação CE, classe de risco, etc.) e
  atrasa significativamente o piloto — por isso convém obter esta
  resposta cedo, em paralelo com a EIPD, não depois dela.

### 2.4 Parecer da comissão de ética

Prática habitual para qualquer piloto com dados de pacientes num hospital,
mesmo fictícios na primeira fase — e torna-se obrigatório assim que
entrar o primeiro paciente real. Depende de:
- Ter a EIPD/DPIA e o registo de atividades de tratamento prontos (a
  comissão vai pedir isto como anexo).
- Ter a resposta de 2.3 (dispositivo médico ou não) — muda o tipo de
  parecer e o comité relevante.
- Identificar já qual é a comissão de ética competente (a do
  hospital-alvo do piloto, presumivelmente) e o prazo médio de resposta,
  para não ser a surpresa que atrasa tudo no fim.

---

## Bloco 3 — Marca (explicitamente para depois)

Fica registado, não iniciar agora:
- Rever o logótipo novo (arco + cruz + sinal, criado nesta revisão) —
  já é uma primeira versão original, mas o pedido é para revisitar com
  mais tempo, possivelmente com mais alternativas.
- Rever a paleta de cores (`--navy`, `--paper`, `--accent` atuais) —
  mesma lógica, sem pressa.

---

## Prioridade sugerida (não vinculativa, atualizada em 26/09/2026)

1. ~~Fechar 1.1 (gestão de contas)~~ — ✅ feito e validado.
2. **Configurar Resend (#17)** — passa a ser o item técnico nº1 em aberto:
   desbloqueia 1.2 (reset de PIN com reenvio) e a notificação obrigatória
   de acesso, que já é regra não negociável e ainda não está ativa.
3. **Testar 1.3 (gravação NFC) num Android físico** — código já pronto,
   só falta esta validação; sem dependências do resto.
4. A2 (timeout de sessão por inatividade real) — pode ser escrito em
   paralelo, mas o deploy espera por um namespace Workers KV a criar
   pelo Daniel.
5. Arrancar em paralelo 2.2 (documentação RGPD/termo) e 2.3 (parecer
   sobre dispositivo médico) — são os que mais tempo de terceiros
   consomem, por isso quanto mais cedo entrarem na fila, melhor.
6. 2.4 (comissão de ética) — depois de 2.2/2.3 terem material para anexar.
7. 2.1 (ISO 27001) — gap analysis pode começar já, certificação fica para
   depois do piloto.
8. Bloco 3 (marca) — sem prazo, retomar quando o resto estiver estável.
