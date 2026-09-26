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
| 1.5 Notificações em tempo real (Telegram + Web Push) + PDF de envio | ⬜ Desenhado em 26/09/2026, por implementar |
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

### 1.5 Centro de notificações + Telegram + Web Push + PDF de envio de pulseira (com ativação mediada)

Proposta do Daniel em 26/09/2026, desenho fechado com ele ao longo de
várias trocas (ver histórico de conversa para o raciocínio completo —
resumo aqui). Contexto explícito do Daniel: arranca com um piloto numa
população muito controlada, no hospital onde trabalha, e o desenho evolui
à medida que surgirem necessidades reais — não é para sobre-construir já
tudo, é para ter a arquitetura certa desde o início.

**Problema:** hoje, quando um profissional atribui uma pulseira (ou
qualquer outro evento relevante acontece — revogação, reenvio, contacto,
acesso break-glass), nenhum superadmin sabe até entrar manualmente na app
e verificar. Não escala.

**Decisões fechadas:**

1. **Centro de notificações dentro da app ("campanita").** Não basta um
   toast que só aparece se a app já estiver aberta — precisa de persistir
   entre sessões. Nova coleção Firestore `notificacoes`: cada evento
   (pulseira atribuída/revogada/reenviada, contacto novo, acesso
   break-glass, etc.) escreve um documento curto — `tipo`, `titulo`
   breve, `criado_em`, `lida` (bool), `lida_por`. Ícone de sino no header
   da vista de superadmin (`adminNav`), com contador de não lidas em
   tempo real (`onSnapshot`) e um painel com a lista, cada item a apontar
   para a vista relevante (Auditoria, Pacientes, etc.). Mesmo princípio
   de conteúdo minimalista do Telegram aplica-se aqui: o resumo não leva
   dado identificável do paciente — quem quiser o detalhe entra na vista
   correspondente, já autenticado.
2. **Telegram — minimalista, confirmado.** Só: "Pulseira atribuída" +
   data/hora. Nenhum outro dado. Mantém o Telegram fora do registo de
   atividades de tratamento (Art. 30º RGPD) e fora da lista de
   subprocessadores que precisam de DPA, porque não leva consigo nenhum
   dado do paciente.
3. **Canal push — os dois em paralelo:** Telegram (mais rápido de
   construir) e Web Push nativo do PWA (não acrescenta um terceiro novo,
   mas é mais trabalhoso). Telegram primeiro, Web Push depois.
4. **PDF de envio — só logística, ao estilo etiqueta de envio (Vinted
   como referência visual).** Destinatário, código opaco da pulseira,
   instruções de uso, contacto de suporte — o equivalente à etiqueta que
   leva o pacote ao destino certo, nada mais. Os documentos do próprio
   projeto (RGPD, política de privacidade, FAQ) vão dentro do envelope
   em papel, à parte — são conteúdo estático, não gerado por paciente;
   se ainda não existirem redigidos, é uma tarefa separada (jurídica, não
   técnica) a fazer uma vez e reutilizar em todos os envios.
5. **Ativação da pulseira — mediada pelo hospital, não self-service pela
   família.** A pulseira chega inativa (dado clínico real vive na
   própria pulseira via break-glass, nunca no PDF). Novo estado
   intermédio em `pulseiras.estado`: `atribuida_pendente_ativacao` —
   entre `nao_atribuida` e `ativa`. Fluxo: superadmin atribui + gera o
   PDF de envio → pulseira fica `atribuida_pendente_ativacao` (não
   funcional para break-glass) → quando o hospital confirma que a
   família recebeu (telefone, ou outro canal já existente), o
   profissional/superadmin carrega em "Ativar" (mesmo padrão já usado
   para ativar/desativar contas) → pulseira passa a `ativa`. Decidido
   deliberadamente contra um link/QR de auto-ativação pela família: sem
   app de família (suspensa, ver "Pivô para produção"), não há forma de
   verificar identidade de quem ativa, e um envelope interceptado no
   correio poderia ativar a pulseira antes de chegar ao destino certo.
   Para a escala do piloto (população controlada, canal hospital↔família
   já ativo), a confirmação manual é mais segura e não acrescenta
   trabalho significativo.

**Desenho técnico (por implementar):**

1. **Mover a atribuição de pulseira para o Worker.** Hoje
   `atribuirPulseira`/`solicitarPulseiraParaPaciente`
   (`docs/js/firestore-real.js`) escrevem diretamente no Firestore a
   partir do cliente. Para disparar os efeitos secundários (Telegram,
   Web Push, escrita em `notificacoes`) sem expor segredos (bot token,
   chave VAPID privada) ao cliente, isto passa a ser um novo endpoint
   `POST /pulseiras/:id/atribuir` no Worker — mesma lógica de posse já
   existente (profissional só atribui a pacientes que criou; superadmin
   sem restrição) — que escreve no Firestore com `estado =
   'atribuida_pendente_ativacao'` E dispara os avisos.
2. **Novo endpoint `POST /pulseiras/:id/ativar`** (só superadmin/
   profissional-criador) — troca `atribuida_pendente_ativacao` → `ativa`.
   Pode ser uma escrita direta do cliente (não precisa de segredos), na
   linha do que já existe para ativar/desativar contas.
3. **Telegram:** secrets novos no Worker (`TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_CHAT_ID` — grupo dos superadmins). Chamada simples a
   `api.telegram.org/bot<token>/sendMessage` depois de escrever no
   Firestore, com o conteúdo minimalista já decidido acima.
4. **Centro de notificações:** escrita em `notificacoes` no mesmo
   endpoint do Worker (para eventos que já passam por lá) ou diretamente
   do cliente com as Firestore Rules já existentes (para eventos que já
   são escritas diretas, como ativar/desativar) — não precisa de
   segredos, ao contrário do Telegram/Web Push.
5. **Web Push:** precisa de (a) par de chaves VAPID gerado uma vez, (b)
   nova coleção Firestore `push_subscriptions/{profissionalId}` a
   guardar a subscrição do browser de cada superadmin (feita no
   primeiro login, pedindo permissão de notificações), (c) o Worker a
   assinar e enviar o payload cifrado (RFC 8291) a cada subscrição
   guardada. Mais laborioso do que o Telegram — pode ficar para uma
   segunda iteração sem bloquear o resto.
6. **PDF de envio:** novo botão na vista de pulseiras/lotes (no momento
   de atribuição), gera um PDF simples a partir dos dados já existentes
   em `pacientes`/`pulseiras`. Sem dependência do Worker, gerado
   inteiramente no cliente.

**Depende de:** nada do bloco legal, desde que o conteúdo minimalista
acima se mantenha — é precisamente essa escolha que evita abrir uma nova
frente legal. Se no futuro se quiser incluir dado identificável do
paciente no Telegram ou no centro de notificações, isso teria de voltar
a ser avaliado com o DPO antes de implementar. A ativação self-service
pela família fica registada como possibilidade futura, só se a app de
família for retomada com um mecanismo de verificação de identidade.

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
4. **1.5 (notificações Telegram + Web Push + PDF de envio)** — desenho já
   fechado com o Daniel em 26/09; começar pelo Telegram (mais rápido) e
   pelo PDF (sem dependências), Web Push pode vir a seguir.
5. A2 (timeout de sessão por inatividade real) — pode ser escrito em
   paralelo, mas o deploy espera por um namespace Workers KV a criar
   pelo Daniel.
6. Arrancar em paralelo 2.2 (documentação RGPD/termo) e 2.3 (parecer
   sobre dispositivo médico) — são os que mais tempo de terceiros
   consomem, por isso quanto mais cedo entrarem na fila, melhor.
7. 2.4 (comissão de ética) — depois de 2.2/2.3 terem material para anexar.
8. 2.1 (ISO 27001) — gap analysis pode começar já, certificação fica para
   depois do piloto.
9. Bloco 3 (marca) — sem prazo, retomar quando o resto estiver estável.
