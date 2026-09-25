# SAVI — Roadmap de melhorias (pós-piloto técnico)

> Criado em 25/09/2026. Complementa `CLAUDE.md` — não o substitui. `CLAUDE.md`
> continua a ser a fonte da verdade sobre o estado atual da infraestrutura;
> este documento organiza o que falta a partir daqui, por bloco e por
> prioridade. Itens que passarem a decisão fechada ou a trabalho em curso
> devem migrar para `CLAUDE.md`.

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

### 1.1 Gestão de contas desde a app (CRUD + papéis)

Hoje, criar/editar/eliminar contas passa por `scripts/criar-conta.js`
(fora do cliente, de propósito, porque exige Admin SDK/custom claims — ver
`CLAUDE.md`). Isto foi aceitável para um punhado de contas de teste; não
escala para o piloto real (50 pacientes, várias contas de profissional e
utilizador).

O que falta:
- Decidir onde vive a lógica de Admin SDK que hoje está no script:
  Cloudflare Worker novo (endpoint `admin/contas`) é o candidato natural,
  já que o Worker já tem acesso de service account e já é o único
  componente autorizado a falar com o Admin SDK neste projeto.
- UI de superadmin: criar conta (nome, nº de Ordem, papel(éis), PIN
  inicial), editar (nome, papéis, ativar/desativar — isto já existe),
  eliminar conta (com confirmação e efeito em cascata a decidir: o que
  acontece aos pacientes que essa conta criou?).
- Decisão em aberto do próprio `CLAUDE.md` que isto obriga a fechar: como
  se registam contas novas — superadmin cria diretamente, ou o
  profissional pede e o superadmin aprova. Enquanto não decidido, manter
  só criação direta (é o que já está documentado).

**Depende de:** nada tecnicamente novo — é a extensão natural do que já
existe no Worker. Não depende do bloco legal.

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

### 1.3 Módulo de gravação de pulseiras NFC

Resposta direta à pergunta: **sim**, dá para gravar chips NTAG213 a
partir de um telemóvel Android com a **Web NFC API**, correndo no Chrome
para Android — é exatamente a tecnologia que `CLAUDE.md` já tinha
decidido para isto ("Web NFC API (Chrome/Android)... Não há alternativa
em iOS; assumir que a gravação é feita sempre num Android"). Não é uma
decisão nova, é destravar um item que já estava no stack técnico mas
fora de âmbito da iteração anterior.

O que falta construir:
- Ecrã/ferramenta interna (só acessível a superadmin/profissional, nunca
  ao papel utilizador) que: gera um token opaco novo, grava **apenas
  esse token** no chip via NDEF (nunca dado clínico — regra não
  negociável já existente), e cria o registo correspondente em
  `pulseiras` com `estado = 'inativa'` até ser associado a um paciente.
- Fluxo de associação pulseira↔paciente (parte disto já existe do lado
  de `solicitarPulseiraParaPaciente`, falta o lado da gravação física).
- Testar em, pelo menos, dois modelos de Android diferentes — a Web NFC
  API tem variação de suporte entre fabricantes/versões do Chrome.
- QR continua a ser gerado/impresso à parte (já fora de âmbito, mantém-se
  assim).

**Depende de:** nada do bloco legal. Pode avançar em paralelo.

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

## Prioridade sugerida (não vinculativa)

1. Fechar 1.1 (gestão de contas) — desbloqueia o piloto a crescer além
   das poucas contas de teste manuais.
2. Configurar Resend (#17, já em curso) — desbloqueia 1.2 (reset de PIN
   com reenvio) e a notificação obrigatória de acesso, que já é regra não
   negociável e ainda não está ativa.
3. 1.3 (gravação NFC) — em paralelo com o acima, sem dependências.
4. Arrancar em paralelo 2.2 (documentação RGPD/termo) e 2.3 (parecer
   sobre dispositivo médico) — são os que mais tempo de terceiros
   consomem, por isso quanto mais cedo entrarem na fila, melhor.
5. 2.4 (comissão de ética) — depois de 2.2/2.3 terem material para anexar.
6. 2.1 (ISO 27001) — gap analysis pode começar já, certificação fica para
   depois do piloto.
7. Bloco 3 (marca) — sem prazo, retomar quando o resto estiver estável.
