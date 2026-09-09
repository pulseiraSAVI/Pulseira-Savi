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
- Apenas Nível 1 ativo. Nível 2 mostra só uma **referência** textual ao
  sistema clínico do hospital — nunca uma integração real.
- **As Fases 2, 3 e 4 (profissionais externos, famílias sem relação prévia,
  integração nativa com o RSE/SNS 24) são visão de futuro documentada no
  Resumo do Projeto §10. Não implementar nada dessas fases agora — nem
  scaffolding, nem tabelas “por via das dúvidas”.**

## Stack técnico decidido (não trocar sem discutir)

- **Firestore (Firebase), região `europe-west`** — base de dados principal.
  GDPR-first, mesma decisão usada noutros projetos da equipa.
- **Firebase Auth**, duas contas separadas: profissionais (com 2FA/MFA
  obrigatório) e família. A família **lê** `dados_nivel1` (pode consultar
  os dados clínicos do paciente), mas as Security Rules devem bloquear
  qualquer **escrita** dela nessa coleção — nunca bloquear a leitura.
- **Cloudflare Worker** — toda a lógica de break-glass, autorização e audit
  log. O frontend nunca fala diretamente com o Firestore para o fluxo de
  scan.
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

## Papéis (uma única app, três vistas por custom claim)

| Papel | Pode | Não pode |
|---|---|---|
| **Família** | Criar paciente, consentimento, contacto/morada, revogar pulseira, ver dados clínicos (leitura), pedir eliminação (art. 17.º RGPD) | Editar/propor qualquer campo clínico |
| **Profissional clínico** | Scan → ver Nível 1 → Nível 2 com motivo obrigatório | Aceder a funções de administração |
| **Equipa administradora** | Gerir pacientes, escrever/validar dados clínicos, gerar tokens, gravar NFC, imprimir QR, gerir profissionais | — |
| **Auditor** (sub-papel dentro da equipa administradora, `funcao_auditor = true`) | Ler a tabela `acessos` | Escrever dados clínicos |

Não existe uma quarta vista de “painel de controlo” — é exatamente o conteúdo
da vista de equipa administradora.

## Dados de Nível 1 — estrutura clínica (cabeçalho + 4 separadores)

Definida pela equipa clínica. Ecrã de leitura em segundos, sem scroll para
o crítico. Estrutura completa em `SAVI_Arquitetura_Tecnica.docx` §5/§14
(schema SQL completo) — resumo aqui:

- **Cabeçalho:** nome, idade, peso (kg), altura (cm, com data de registo),
  contacto familiar de referência, morada.
- **Mantidos por segurança clínica, fora dos 4 separadores originais da
  equipa — ver Questão em aberto nº 1 abaixo:** alergias, grupo sanguíneo.
- **1) Diagnósticos ativos** — lista, codificada em ICD-10 quando possível.
- **2) Terapêutica** — com esquema de horas de administração; inclui
  medicação crónica e fármacos contraindicados.
- **3) Esquema de crise:**
  - Limitação terapêutica (`sim` / `não` / `não aplicável`) — se `sim`,
    contactar hospital de referência antes de decisões de limitação.
  - Se aplicável: ventilação invasiva, VNI, técnicas dialíticas (cada uma
    `sim`/`não`).
  - Texto livre: risco de descompensação e recomendações.
  - Hospital de referência + contacto telefónico do serviço.
- **4) Histórico de modificação** — memória de 1 ano, validação obrigatória
  a cada 6 meses. Cada registo grava `escrito_por_id` + `escrito_em`.

Todo o dado clínico é escrito **exclusivamente** pela equipa clínica —
nunca pela família, nem em modo de proposta não verificada.

## Fluxo de scan (break-glass access)

1. Profissional aproxima o telemóvel (NFC) ou lê o QR.
2. Pedido chega ao Worker com o token + ID token do Firebase Auth.
3. Worker verifica autenticação (sessão expira aos 5 min de inatividade).
4. Worker consulta `pulseiras` pelo token → confirma `estado = 'ativa'` →
   obtém `paciente_id`.
5. Worker devolve `dados_nivel1`, com o estado de verificação de cada
   registo visível (nunca bloqueia a leitura).
6. Worker escreve sempre um registo em `acessos` (audit log, alinhado com
   ISO 27789:2021) — mesmo em caso de negação.
7. Assíncrono: Resend notifica a família do acesso (art. 29.º n.º 6, Lei
   58/2019).
8. Nível 2: exige motivo obrigatório antes de mostrar a referência ao
   sistema do hospital (campo `referencia_sistema_ext` em `pacientes`,
   já previsto no schema para este enlace).

## Regras não negociáveis

- Nunca gravar dado clínico no chip NFC ou no QR — apenas um token opaco.
- A família nunca edita dados clínicos, em nenhuma circunstância.
- Todo acesso fica registado em `acessos`, mesmo os negados.
- Nível 2 nunca mostra o histórico completo diretamente — apenas referência.
- Cifra explícita de `dados_nivel1` em repouso e em trânsito.
- Nenhuma funcionalidade de Fase 2-4 (RSE, PEM, acesso por pesquisa) entra
  em produção sem o desenho de segurança correspondente estar fechado.
- Nunca vender ou partilhar comercialmente dados de pacientes com
  terceiros, sob nenhuma circunstância — princípio fundador do projeto,
  válido mesmo para funcionalidades futuras de analítica ou integrações.

## Objetivo desta primeira iteração (mockup + infraestrutura base)

1. Estrutura do repositório + projeto Firebase (`europe-west`) + Firestore
   com as tabelas ativas da Fase 1 (`pacientes`, `dados_nivel1`,
   `pulseiras`, `lotes`, `contas_familia`, `familia_paciente`,
   `profissionais`, `acessos`).
2. Firestore Security Rules: negar tudo por defeito; regras próprias para
   a conta de família — permitem leitura de `dados_nivel1` do(s) seu(s)
   paciente(s), mas bloqueiam qualquer escrita nessa coleção.
3. Cloudflare Worker com o endpoint de scan (passos 1-8 acima), sem ainda
   integrar Resend real (pode ficar stubbed nesta iteração).
4. Mockup navegável do ecrã de resultado de Nível 1 (o mais crítico —
   referência: `savi_mockup_nivel1.html` já existente) integrado ao fluxo
   de login + scan real.
5. Ecrã de login com 2FA e routing por papel (família / profissional /
   admin) via custom claims.

Fora de âmbito nesta iteração: app de família completa, ferramenta de
gravação NFC, geração/impressão de QR, qualquer integração RSE.

## Questões em aberto — não assumir resolvidas, perguntar antes de decidir

1. Alergias e grupo sanguíneo devem ter destaque visual próprio? Não
   constam da estrutura de 4 separadores da equipa clínica.
2. Modelo de verificação clínica: registo único de autoria, ou mantém-se
   dupla verificação (`verificado_por_id`)? Schema mantém ambos os campos
   até confirmação.
3. Modelo de segurança para o acesso por pesquisa (nome + data de
   nascimento + sexo, ou nº de utente) — ainda não desenhado. Não
   implementar sem definir motivo obrigatório, notificação e auditoria
   equivalentes ao acesso por pulseira.
4. Autenticação profissional via Chave Móvel Digital / senha de vinhetas —
   proposta em avaliação, fora do stack atual (usar Firebase Auth + nº de
   Ordem + 2FA nesta iteração).
5. Proteção física da etiqueta da pulseira (bambu, não resistente à água).
6. Conteúdo exato do modo offline mínimo (2-3 itens impressos na pulseira).
7. Responsável pelo tratamento de dados — projeto privado vs. hospital.

## Referências

- Visão, SWOT, plano de melhoria e roadmap completos: `SAVI_Resumo_do_Projeto.docx`
- Arquitetura, componentes, fluxo detalhado, schema SQL completo: `SAVI_Arquitetura_Tecnica.docx`
- Especificação de todos os ecrãs, por papel: `SAVI_Design_App_Papel.docx`
