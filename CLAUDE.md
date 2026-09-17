# SAVI — Sistema de Acesso Virtual a Informação Clínica

> Contexto para desenvolvimento. Condensado a partir de três documentos fonte:
> `SAVI_Resumo_do_Projeto.docx` (visão e negócio), `SAVI_Arquitetura_Tecnica.docx`
> (arquitetura e schema completo), `SAVI_Design_App_Papel.docx` (especificação de
> ecrãs). Em caso de dúvida ou detalhe em falta, consultar o documento fonte
> correspondente antes de assumir — não inventar decisões que não constam aqui.

## O que é o SAVI, em uma frase

Uma camada de acesso rápido de emergência a dados clínicos essenciais de
pacientes crónicos de alto risco — **não** uma nova base de dados clínica
paralela, mas um complemento ao RSE/SPMS para os primeiros minutos de uma
urgência.

> ⚠️ **Construir não é o único bloqueante do piloto.** Há pendências
> legais/organizativas que não se resolvem com código: EIPD/DPIA formal,
> DPAs com os subprocessadores, e a clarificação de quem é o responsável
> pelo tratamento de dados (projeto privado vs. hospital). Ver Resumo do
> Projeto §11-12. Não assumir que "está pronto para pacientes reais"
> apenas porque a infraestrutura funciona.

## Fase ativa: SOMENTE Fase 1 (piloto). Não construir além disto.

- População-alvo: 50 pacientes crónicos de alto risco (25 pediátricos — 10
  cardiologia, 10 neurologia, 5 mistos/outra tipologia — e 25 adultos).
- Um único serviço de urgência.
- **Nível 2 eliminado do produto** (revisão de 15/09/2026) — só existe
  Nível 1. Ver secção "Pivô para produção" abaixo.
- **As Fases 2 e 4 (profissionais externos, integração nativa com o
  RSE/SNS 24) continuam visão de futuro, não implementar.** A Fase 3
  (acesso por pesquisa de identidade) foi **antecipada para a Fase 1
  ativa** — ver "Pivô para produção" abaixo — deixa de ser dormente.

## Pivô para produção (revisão de 15 de setembro de 2026)

A partir desta revisão o projeto sai do modo demo/simulado e entra em
modo produção real, com o objetivo de incluir pacientes piloto
fictícios. Isto substitui partes do modelo original dos três documentos
fonte — as secções abaixo já refletem o modelo novo; onde há conflito
com os documentos fonte originais, **este CLAUDE.md manda**.

- **App/vista de família — em suspenso.** Não construir nem manter a
  app de família nesta iteração; retomar só com nova informação. A
  família passa a intervir apenas fora da app: assina em papel o termo
  de responsabilidade e o RGPD, cuja cópia digitalizada fica arquivada
  no perfil do paciente (ver secção de armazenamento de documentos).
- É o **profissional** quem cria o paciente, introduz os dados clínicos
  e solicita a pulseira — não a família.
- Responsável pelo tratamento de dados: o hospital, por agora (decisão
  já registada, mantém-se).

## Stack técnico decidido (não trocar sem discutir)

- **Firestore (Firebase), região `europe-west`** — base de dados principal.
  GDPR-first, mesma decisão usada noutros projetos da equipa.
- **Firebase Auth**, uma única conta por profissional (papel de
  profissional e/ou utilizador vive na mesma conta — ver secção de
  Papéis). Conta de família suspensa (ver Pivô para produção).
- **Identificação do utilizador (break-glass) — PIN alfanumérico de 5
  caracteres**, real, associado ao nº de Ordem médico. Substitui, por
  agora, a integração com Chave Móvel Digital/PEM da SPMS — essa
  integração oficial fica para uma fase posterior, quando houver acesso
  aos sistemas do Estado. O PIN não é decorativo: é validado a sério no
  backend (hash, nunca texto simples), mesmo sendo simples de usar.
- **Firebase Storage** — armazenamento dos documentos digitalizados
  (RGPD + termo de responsabilidade assinados em papel pela família),
  ligados ao perfil do paciente. Adicionado ao stack nesta revisão.
- **Cloudflare Worker** — toda a lógica de break-glass, autorização e audit
  log, para os 3 métodos de acesso (ver Fluxo de acesso). O frontend nunca
  fala diretamente com o Firestore para esse fluxo.
- **Resend** — notificações, incluindo notificação obrigatória ao titular a
  cada acesso (assíncrona, nunca com dados clínicos no corpo do email).
- **Web NFC API** (Chrome/Android) — ferramenta interna de gravação de
  pulseiras. Não há alternativa em iOS; assumir que a gravação é feita
  sempre num Android.
- **GitHub** — repositório e CI/CD.
- Chip: **NTAG213** (NFC Forum Tag Type 2, suporte NDEF nativo — é a única
  opção correta entre as avaliadas). QR gerado e impresso internamente em
  vinil laminado, não pedido personalizado ao fornecedor.

## Convenções

- **Idioma da interface e dos textos**: português de Portugal (PT-PT), em
  linha com os três documentos fonte e o hospital-alvo do piloto. Não usar
  inglês nem português do Brasil na UI.
- **Nomenclatura de código e schema**: seguir o português já usado no
  schema (`dados_nivel1`, `escrito_por_id`, `esquema_atuacao_crise`, etc.)
  — manter consistência, não misturar nomes de campos em inglês com um
  schema em português.
- **Nome do repositório**: `delfos-iq/savi` (substitui a referência antiga
  `delfos-iq/pulseira-vital` que ainda consta do roadmap da Arquitetura
  Técnica — desatualizada, o projeto chama-se SAVI).
- **Framework de frontend**: ainda não decidido em nenhum documento fonte.
  Escolher o mais adequado (React, Vue, ou HTML/JS simples) mantendo
  consistência com o resto do stack (Firebase, Cloudflare Worker) — não é
  uma omissão, é uma decisão em aberto.
- **Mockup de referência**: `savi_mockup_nivel1.html` (HTML autónomo do
  ecrã de resultado de Nível 1) — usar como base visual para a iteração 4
  abaixo.

## Papéis (revisão de 15/09/2026 — substitui o modelo anterior)

Uma mesma pessoa/conta pode ter os papéis de **profissional** e
**utilizador** ao mesmo tempo, mas escolhe com qual entra em cada sessão —
nunca vê os dois ao mesmo tempo:

| Papel | Pode | Não pode |
|---|---|---|
| **Utilizador** (break-glass) | Identificar-se (nº de Ordem + PIN de 5 caracteres) e aceder a Nível 1 de **qualquer** paciente, por NFC/QR, número de utente, ou nome+data de nascimento+sexo | Editar dados clínicos; aceder a pacientes fora do break-glass |
| **Profissional** | Criar pacientes, introduzir/editar dados clínicos, solicitar pulseira — **só dos pacientes que ele próprio criou** | Ver ou editar pacientes criados por outro profissional; aceder a break-glass de pacientes de terceiros neste papel |
| **Superadmin** (equipa gestora do projeto) | Acesso ilimitado de leitura/escrita a tudo; entra na vista de profissional sem a restrição de "só os meus pacientes"; gere contas (criar/eliminar/modificar utilizadores e profissionais) | — |
| **Auditor** (sub-papel do superadmin, `funcao_auditor = true`, botão extra no menu do superadmin) | Ler a tabela `acessos` | Escrever dados clínicos |

Não existe uma quarta vista de "painel de controlo" — é exatamente o conteúdo
da vista de superadmin.

Como se registam profissionais/utilizadores novos ainda não está decidido
— duas opções em avaliação (o superadmin cria a conta diretamente, ou o
próprio profissional pede registo e o superadmin aprova); não implementar
nenhuma das duas até decisão explícita, usar por agora só criação direta
pelo superadmin.

Família: papel suspenso nesta revisão — ver "Pivô para produção".

## Dados de Nível 1 — estrutura nova (revisão de 15/09/2026)

Substitui por completo a estrutura "cabeçalho + 4 separadores" original.
Ecrã de leitura em segundos para o utilizador em break-glass, organizado
em cabeçalho fixo + 4 secções no menu de footer.

**Cabeçalho (sempre visível, sem scroll):** nome + último apelido do
paciente, idade (anos e/ou meses), peso, altura, superfície corporal
(calculada a partir de peso/altura — fórmula de Mosteller). Data e hora
atual num canto do ecrã.

**Footer — 4 secções:**

1. **Dados do utente** — informação completa do paciente:
   - Nome completo, morada, número de utente.
   - Contacto de familiares + contacto de emergência.
   - Dados do gestor do caso (o médico assistente): nome completo, nº de
     Ordem médica, especialidade, instituição+serviço, telefone
     institucional.
2. **Algoritmo** — cartões clínicos, substitui os antigos 4 separadores:
   - Alergias — cartão de destaque próprio, mantido (decisão anterior).
   - Biometria.
   - Condição crítica.
   - Esquema de dose.
   - Medicação contraindicada.
   - Limitação terapêutica (`sim`/`não`/`não aplicável`).
   - Notas — campo de texto livre.
   - **Removidos desta secção:** calendário vacinal, grupo sanguíneo (já
     não aparecem em lado nenhum do ecrã).
3. **Medicação Habitual** — medicação crónica + horário habitual de
   administração; cópia digitalizada dos documentos RGPD e do termo de
   responsabilidade assinados em papel pela família (Firebase Storage).
4. **Configuração** — definições do utilizador, versão atual da app,
   email de suporte/feedback.

Todo o dado clínico é escrito **exclusivamente** pelo profissional que
criou o paciente (ou pelo superadmin) — nunca pela família, que está
suspensa nesta revisão.

## Fluxo de acesso (break-glass) — 3 métodos, revisão de 15/09/2026

O utilizador identifica-se primeiro (nº de Ordem + PIN de 5 caracteres),
depois escolhe/usa um dos 3 métodos para chegar ao paciente — todos levam
ao mesmo Nível 1, todos ficam sujeitos às mesmas regras de auditoria:

1. **Leitura da pulseira** (NFC ou QR) — token opaco → `pulseiras` →
   confirma `estado = 'ativa'` → `paciente_id`.
2. **Número de utente** — introduzido manualmente.
3. **Nome completo + data de nascimento + sexo** — pesquisa por
   identidade (antes Fase 3, dormente; antecipada para a Fase 1 nesta
   revisão).

Para os 3 métodos, sem excepção:

1. Pedido chega ao Worker com o ID token do Firebase Auth do utilizador.
2. Worker verifica autenticação (sessão expira aos 5 min de inatividade)
   e o PIN de 5 caracteres.
3. Worker localiza o paciente pelo método usado (pulseira/nº utente/
   identidade) e devolve `dados_nivel1`.
4. Worker escreve sempre um registo em `acessos` — método usado, motivo,
   utilizador, timestamp — mesmo em caso de negação. O método por
   identidade (nome+data nascimento+sexo) exige **motivo obrigatório**
   antes de mostrar qualquer dado, tal como manda a regra abaixo para
   pesquisa por identidade.
5. Assíncrono: Resend notifica a família/gestor do caso do acesso (art.
   29.º n.º 6, Lei 58/2019).

**Nível 2 já não existe** — não há mais nenhum ecrã além deste Nível 1.

## Regras não negociáveis

- Nunca gravar dado clínico no chip NFC ou no QR — apenas um token opaco.
- A família nunca edita dados clínicos, em nenhuma circunstância (está
  suspensa nesta revisão, nem tem acesso à app).
- Todo acesso fica registado em `acessos`, mesmo os negados — para os 3
  métodos de acesso, não só pulseira.
- O acesso por identidade (nome+data nascimento+sexo) exige motivo
  obrigatório, notificação e auditoria equivalentes ao acesso por
  pulseira — nunca implementar um método de acesso novo sem essas três
  garantias fechadas.
- PIN do utilizador guardado sempre com hash, nunca em texto simples.
- Cifra explícita de `dados_nivel1` em repouso e em trânsito.
- Nenhuma funcionalidade de Fase 2 ou 4 (profissionais externos, RSE/PEM
  nativo) entra em produção sem o desenho de segurança correspondente
  estar fechado.
- Nunca vender ou partilhar comercialmente dados de pacientes com
  terceiros, sob nenhuma circunstância — princípio fundador do projeto,
  válido mesmo para funcionalidades futuras de analítica ou integrações.

## Objetivo desta iteração (produção real, pivô de 15/09/2026)

Sai do modo demo/simulado. Objetivo: app completa e funcional, ligada a
infraestrutura real, pronta para receber pacientes piloto **fictícios**
(reais só depois de validação DPO/CNPD, ver aviso no topo do documento).

1. Projeto Firebase real (`europe-west`) + Firestore com as tabelas da
   Fase 1 revista: `pacientes` (com `numero_utente`, `sexo`,
   `gestor_do_caso`), `dados_nivel1` (estrutura nova — ver secção
   própria), `pulseiras`, `lotes`, `profissionais` (com `pin_hash`,
   papéis `profissional`/`utilizador`/`superadmin`/`funcao_auditor`),
   `acessos`, `documentos` (novo — referências aos ficheiros no Storage).
   `contas_familia`/`familia_paciente` ficam por agora sem uso (família
   suspensa).
2. Firebase Storage para os documentos RGPD/termo de responsabilidade.
3. Firestore Security Rules: negar tudo por defeito; profissional só
   lê/escreve pacientes que criou; utilizador só lê Nível 1 via
   break-glass; superadmin sem restrição.
4. Cloudflare Worker real com o endpoint de acesso (3 métodos, ver secção
   própria) e verificação real do PIN.
5. App completa: ecrã de identificação (nº Ordem + PIN), routing por
   papel, os 3 métodos de acesso, Nível 1 na estrutura nova, vista de
   profissional (criar/editar pacientes), vista de superadmin (gestão de
   contas + auditoria).

Fora de âmbito por agora: app de família (suspensa), ferramenta de
gravação NFC, geração/impressão de QR, integração real com Chave Móvel
Digital/PEM, fluxo de auto-registo de profissionais (decidir depois).

## Decisões resolvidas (revisão de 9 de setembro de 2026)

Antigas "questões em aberto", agora decididas — não voltar a discutir sem
motivo novo:

1. **Alergias e grupo sanguíneo têm destaque visual próprio** — decisão
   definitiva. Mantêm-se como cartão de alerta no ecrã de Nível 1, tal
   como já implementado na demo, mesmo não constando dos 4 separadores
   originais da equipa clínica.
2. **Modelo de verificação clínica: dupla verificação mantida.** Cada
   registo de `dados_nivel1` continua a guardar `escrito_por_id`/
   `escrito_em` (autoria) e `verificado_por_id`/`verificado_em`/
   `estado_verificacao` (confirmação posterior por outro profissional) —
   os dois campos ficam ativos, não simplificar para registo único.
3. **[SUPERADO em 15/09/2026 — ver "Pivô para produção"]** Acesso por
   pesquisa de identidade já não é Fase 2/3 dormente — foi antecipado
   para a Fase 1 ativa. Os campos finais são **nome completo + data de
   nascimento + sexo** (revisão de 15/09; a versão anterior desta linha
   dizia "+ número de utente", agora é um método de acesso separado).
   Continua a exigir motivo obrigatório, notificação e auditoria — isso
   não mudou.
4. **[SUPERADO em 15/09/2026]** Firebase Auth + nº de Ordem + 2FA deixa
   de ser o mecanismo de identificação do utilizador em break-glass —
   substituído por nº de Ordem + PIN alfanumérico de 5 caracteres (ver
   "Pivô para produção" e Stack técnico). Chave Móvel Digital/PEM
   mantém-se como integração oficial a fazer mais tarde.
5. **Proteção física da etiqueta da pulseira — em validação pela equipa,
   fora do âmbito de software.** Amostras já pedidas ao fornecedor para
   teste; decisão não bloqueia o trabalho técnico.
6. **Conteúdo do modo offline mínimo: alergias + esquema de atuação
   perante crise** (2 itens, não 3) — são os dois campos a imprimir
   fisicamente na pulseira quando não há acesso à app.
7. **Responsável pelo tratamento de dados: o hospital, por agora.**
   Decisão provisória enquanto a pista legal (EIPD/DPIA, DPAs) fica em
   segundo plano — ver aviso no topo deste documento, que continua válido:
   isto não substitui a validação formal do DPO antes de qualquer paciente
   real (fictício ou não, ver Fase 5 do roadmap).

## Referências

- Visão, SWOT, plano de melhoria e roadmap completos: `SAVI_Resumo_do_Projeto.docx`
- Arquitetura, componentes, fluxo detalhado, schema SQL completo: `SAVI_Arquitetura_Tecnica.docx`
- Especificação de todos os ecrãs, por papel: `SAVI_Design_App_Papel.docx`
