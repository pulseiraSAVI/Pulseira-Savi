# Schema Firestore — SAVI (pivô de produção, revisão 15/09/2026)

> Substitui por completo a versão anterior deste documento (modelo
> família/profissional clínico/equipa administradora/auditor). Ver
> `CLAUDE.md`, secção "Pivô para produção", para o contexto completo —
> em caso de conflito, o `CLAUDE.md` manda.
>
> **`contas_familia` e `familia_paciente` ficam sem uso enquanto a família
> estiver suspensa.** As definições destas duas coleções mantêm-se no
> fundo deste documento só por referência histórica — não criar dados
> nelas nem escrever regras que dependam delas nesta iteração.

## Convenções gerais

- Todas as datas/timestamps em UTC, tipo Firestore `timestamp` (não string),
  exceto onde indicado `date` (string `YYYY-MM-DD`).
- IDs de documento: UUID v4 gerado no cliente/Worker, exceto onde indicado
  chave composta ou id == outro id (`dados_nivel1/{pacienteId}`).
- Cifra em repouso: nativa do Firestore (Google-managed encryption),
  reforçada por regras de acesso restritivas (`firestore.rules`). Cifra em
  trânsito: TLS obrigatório.
- Papéis (`profissionais.papeis`, array de string): `profissional` |
  `utilizador` | `superadmin`. `funcao_auditor` é um booleano à parte,
  só relevante quando `papeis` inclui `superadmin`.

---

## `profissionais/{profissionalId}`

Uma única conta por pessoa — pode ter os papéis `profissional` e
`utilizador` ao mesmo tempo (a app pergunta com qual entra em cada
sessão). `superadmin` é tratado como papel próprio, sem a restrição de
"só os meus pacientes".

| Campo | Tipo | Notas |
|---|---|---|
| `nome` | string | |
| `credencial_ordem` | string, único | Nº de Ordem médica — identificador de login |
| `pin_hash` | string | SHA-256 hex do PIN alfanumérico de 5 caracteres. **Nunca texto simples**, nem nesta simulação |
| `papeis` | array\<string\> | Subconjunto de `profissional`, `utilizador`, `superadmin` |
| `funcao_auditor` | boolean | Só tem efeito quando `papeis` inclui `superadmin`; dá acesso de leitura a `acessos` |
| `servico` | string | Ex.: "Urgência Pediátrica" |
| `especialidade` | string | Usado como "gestor do caso" nos pacientes que este profissional cria |
| `instituicao_servico` | string | Instituição + serviço, mostrado como dados do gestor do caso |
| `telefone_institucional` | string | |
| `ativo` | boolean | |
| `criado_em` | timestamp | |

**Índices sugeridos:** índice de campo único em `credencial_ordem` (login).

**Registo de contas:** por decisão do CLAUDE.md, só o `superadmin` cria
contas diretamente (secção "Contas" da vista de superadmin) — não existe
auto-registo nesta iteração.

---

## `pacientes/{pacienteId}`

Dados administrativos e de identificação — **nunca dados clínicos**
(vivem em `dados_nivel1`). Criado exclusivamente pelo profissional que
o regista (ou pelo superadmin).

| Campo | Tipo | Notas |
|---|---|---|
| `nome` | string | Nome completo |
| `data_nascimento` | date | |
| `sexo` | string enum | `M` \| `F` \| `outro` — usado no método de acesso por identidade |
| `numero_utente` | string, único | Usado no método de acesso por número de utente |
| `morada` | string | |
| `contacto_familia` | string | Contacto de familiares |
| `contacto_emergencia` | string | Contacto de emergência (pode coincidir com o de familiares) |
| `gestor_do_caso` | map | `{ nome, credencial_ordem, especialidade, instituicao_servico, telefone_institucional }` — normalmente espelha o profissional criador, mas é editável separadamente (o gestor do caso pode não ser quem regista o paciente na app) |
| `estado_consentimento` | string enum | `pendente` \| `ativo` \| `revogado` — assinatura em papel (RGPD + termo de responsabilidade), arquivada em `documentos` |
| `criado_por_id` | string (ref) | id em `profissionais` — só este profissional (ou superadmin) vê/edita este paciente |
| `criado_em` | timestamp | |

**Índices sugeridos:** índice de campo único em `numero_utente` (consulta
principal do Worker no método 2); índice em `criado_por_id` (vista de
profissional, "só os meus pacientes"); sem índice composto necessário
para o método de identidade na Fase 1 (≤50 pacientes) — o Worker filtra
`nome` + `data_nascimento` + `sexo` em memória a partir de uma leitura
completa da coleção.

---

## `dados_nivel1/{pacienteId}`

Documento único por paciente (id do documento == `pacienteId`). Estrutura
nova — substitui por completo o modelo anterior de "cabeçalho + 4
separadores". Corresponde ao separador **Algoritmo** do ecrã de Nível 1.

| Campo | Tipo | Notas |
|---|---|---|
| `peso_kg` | number \| null | Cartão "Biometria" |
| `altura_cm` | number \| null | Cartão "Biometria"; usado também para a superfície corporal (fórmula de Mosteller, calculada no cliente, não guardada) |
| `biometria_registada_em` | date \| null | |
| `alergias` | string | Cartão de destaque próprio (decisão de 9/9/2026, mantida) |
| `condicao_critica` | string | Substitui `diagnosticos_ativos`; texto livre, ICD-10 quando possível |
| `esquema_dose` | string | Esquema de dose crítico, com horas quando aplicável |
| `medicacao_contraindicada` | string | Substitui `farmacos_contraindicados` |
| `limitacao_terapeutica` | string enum | `sim` \| `nao` \| `nao_aplicavel` |
| `esquema_atuacao_crise` | string | Texto livre — risco de descompensação/recomendações; mostrado dentro do cartão "Condição crítica". Mantido por ser um dos 2 itens do modo offline mínimo (alergias + esquema de atuação em crise, decisão de 9/9/2026) |
| `notas` | string | Cartão "Notas", texto livre |
| `medicacao_cronica` | string | Medicação crónica + horário habitual — separador "Medicação Habitual", não "Algoritmo" |
| `escrito_por_id` | string \| null (ref) | id em `profissionais` |
| `escrito_em` | timestamp \| null | |
| `verificado_por_id` | string \| null (ref) | id em `profissionais` |
| `verificado_em` | timestamp \| null | |
| `estado_verificacao` | string enum | `nao_verificado` \| `verificado` — dupla verificação mantida (decisão de 9/9/2026) |
| `validado_em` | timestamp \| null | Validação obrigatória a cada 6 meses |
| `atualizado_em` | timestamp | |

**Removidos nesta revisão (não devem aparecer em lado nenhum):**
`grupo_sanguineo`, `vacinas`, `ventilacao_invasiva`, `vni`,
`tecnicas_dialiticas`, `hospital_referencia`,
`hospital_referencia_contacto`, `terapeutica`, `verificacoes_campo`
(extensão por campo da iteração anterior — substituída por um único
`estado_verificacao` a nível do documento, mais simples).

**Regra crítica:** leitura só através do Worker (break-glass, papel
`utilizador`) ou por quem tem papel `profissional`/`superadmin` (e,
neste último caso, só o profissional que criou o paciente, exceto
`superadmin`). Escrita exclusiva de `profissional` (dono do paciente) ou
`superadmin`.

---

## `documentos/{documentoId}`

Nova coleção — referências aos ficheiros digitalizados no Firebase
Storage: o termo de responsabilidade e a autorização RGPD, assinados em
papel pela família (a família já não assina na app, ver "Pivô para
produção" no CLAUDE.md). Mostrados no separador "Medicação Habitual".

| Campo | Tipo | Notas |
|---|---|---|
| `paciente_id` | string (ref) | |
| `tipo` | string enum | `rgpd` \| `termo_responsabilidade` \| `outro` |
| `nome_ficheiro` | string | |
| `storage_path` | string | Caminho no Firebase Storage (`documentos/{pacienteId}/{documentoId}.pdf`) — não implementado nesta iteração de simulação, ver `docs/js/mockdb.js` |
| `enviado_por_id` | string (ref) | id em `profissionais` |
| `enviado_em` | timestamp | |

**Índices sugeridos:** índice de campo simples em `paciente_id`.

---

## `pulseiras/{pulseiraId}`

Sem alterações estruturais relevantes nesta revisão.

| Campo | Tipo | Notas |
|---|---|---|
| `token` | string, único | Token opaco gravado no chip NFC/QR — nunca dado clínico |
| `serial_fisico` | string, único | |
| `lote_id` | string (ref) | id em `lotes` |
| `estado` | string enum | `nao_atribuida` \| `ativa` \| `desativada` \| `perdida` \| `substituida` |
| `paciente_id` | string \| null (ref) | id em `pacientes` |
| `atribuida_em` | timestamp \| null | |
| `desativada_em` | timestamp \| null | |
| `motivo_desativacao` | string \| null | |
| `criado_em` | timestamp | |

**Índices sugeridos:** índice de campo único em `token` (consulta
principal do Worker no método de acesso por pulseira); índice em
`estado`.

---

## `lotes/{loteId}`

Sem alterações.

| Campo | Tipo | Notas |
|---|---|---|
| `fornecedor` | string | |
| `tipo_pulseira` | string | |
| `chip_modelo` | string | Fase 1: sempre `NTAG213` |
| `preco_unitario` | number | |
| `quantidade` | number | |
| `data_encomenda` | date \| null | |
| `data_receção` | date \| null | |
| `notas` | string | |
| `criado_em` | timestamp | |

---

## `acessos/{acessoId}`

Audit log do break-glass, alinhado com ISO 27789:2021. **Escrita
exclusiva do Worker.** Agora cobre os 3 métodos de acesso, não só
pulseira.

| Campo | Tipo | Notas |
|---|---|---|
| `metodo_acesso` | string enum | `pulseira` \| `numero_utente` \| `identidade` |
| `pulseira_id` | string \| null (ref) | Só preenchido no método `pulseira` |
| `paciente_id` | string \| null (ref) | `null` só quando o paciente não foi encontrado |
| `utilizador_id` | string \| null (ref) | id em `profissionais` — quem fez o acesso (papel `utilizador` nessa sessão) |
| `nivel_acedido` | string enum | `nivel_1` \| `negado` — **`nivel_2` removido, já não existe** |
| `motivo` | string \| null | Obrigatório no método `identidade`; opcional nos outros |
| `servico` | string \| null | |
| `ip_ou_localizacao` | string \| null | |
| `notificado_titular_em` | timestamp \| null | Preenchido de forma assíncrona após o envio Resend |
| `acedido_em` | timestamp | |

**Índices sugeridos:**
- Índice composto `(paciente_id, acedido_em desc)`.
- Índice de campo simples em `acedido_em desc`.
- Índice de campo simples em `nivel_acedido` e em `metodo_acesso`.

---

## Coleções suspensas — mantidas só por referência, sem uso nesta iteração

`contas_familia` e `familia_paciente` existiam no modelo anterior
(família com app própria). Ficam **sem uso** enquanto a família estiver
suspensa (ver "Pivô para produção", CLAUDE.md) — não escrever dados
nelas, não construir regras que dependam delas. Se a família for
retomada, este documento deve ser atualizado antes de qualquer código.

## Fase 2/4 — dormente, não implementada nesta iteração

`instituicoes` (profissionais externos, Fase 2) e `consultas_validacao`
(integração nativa RSE/SNS 24, Fase 4) continuam fora de âmbito. A Fase 3
(acesso por pesquisa de identidade) deixou de ser dormente — foi
antecipada para a Fase 1 ativa e já está incluída no método `identidade`
acima.
