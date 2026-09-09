# Schema Firestore — SAVI (Fase 1, piloto)

> Tradução do desenho original em SQL (`SAVI_Arquitetura_Tecnica.docx` §5/§14)
> para coleções Firestore, região `europe-west`. Nomenclatura de campos
> mantida em português, alinhada com `frontend/js/mockdb.js` (fonte da
> verdade dos nomes finais usados nesta iteração).
>
> **Fora de âmbito nesta iteração — dormente, não implementado:** as
> coleções `instituicoes`, `pedidos` e `consultas_validacao` pertencem às
> Fases 2/3 (profissionais externos, acesso por pesquisa, integração
> RSE/SNS 24) e **não existem** neste Firestore. Não criar estas coleções
> "por via das dúvidas" — ver CLAUDE.md do projeto.

## Convenções gerais

- Todas as datas/timestamps em UTC, tipo Firestore `timestamp` (não string),
  exceto onde indicado `date` (string `YYYY-MM-DD`, para campos que só
  fazem sentido como data civil, ex. `data_nascimento`).
- IDs de documento: UUID v4 gerado no cliente/Worker, exceto onde indicado
  chave composta.
- Cifra em repouso: nativa do Firestore (Google-managed encryption),
  reforçada por regras de acesso restritivas (`firestore.rules`). Cifra em
  trânsito: TLS obrigatório (garantido pelo próprio Firestore/Worker).

---

## `pacientes/{pacienteId}`

Dados administrativos e de identificação — **nunca dados clínicos** (esses
vivem em `dados_nivel1`).

| Campo | Tipo | Notas |
|---|---|---|
| `nome` | string | |
| `data_nascimento` | date (string `YYYY-MM-DD`) | |
| `contacto_emergencia` | string | Editável pela família (rules) |
| `morada` | string | Editável pela família (rules); não existia no SQL original, adicionado para o pedido de contacto/morada |
| `referencia_sistema_ext` | string | Usado só no Nível 2 |
| `estado_consentimento` | string enum | `pendente` \| `ativo` \| `revogado` |
| `consentimento_prestado_por` | string enum | `proprio` \| `tutor_legal` |
| `consentimento_nome_tutor` | string \| null | |
| `consentimento_documento_ref` | string \| null | |
| `consentimento_data` | date \| null | |
| `origem` | string enum | `piloto` \| `profissional_externo` \| `familia` (os dois primeiros valores ativos na Fase 1; `profissional_externo` é campo já presente no schema original mas sem fluxo de Fase 2 implementado) |
| `profissional_solicitante_id` | string \| null (ref) | id em `profissionais` |
| `pedido_revogacao_pulseira` | boolean | Sinalização feita pela família (rules); processada manualmente pela equipa administradora |
| `criado_em` | timestamp | |

**Índices sugeridos:** nenhum índice composto necessário na Fase 1 (≤50
pacientes); índice de campo único automático em `estado_consentimento` e
`origem` chega para os filtros do dashboard admin.

---

## `dados_nivel1/{pacienteId}`

Documento único por paciente (id do documento == `pacienteId`, não um UUID
próprio — simplifica a leitura no Worker: `GET /dados_nivel1/{pacienteId}`
em vez de consulta por `paciente_id`).

| Campo | Tipo | Notas |
|---|---|---|
| `peso_kg` | number \| null | |
| `altura_cm` | number \| null | |
| `biometria_registada_em` | date \| null | |
| `alergias` | string | |
| `grupo_sanguineo` | string | |
| `diagnosticos_ativos` | string | Texto livre, ICD-10 quando possível |
| `terapeutica` | string | Com esquema de horas |
| `medicacao_cronica` | string | |
| `farmacos_contraindicados` | string | |
| `limitacao_terapeutica` | string enum | `sim` \| `nao` \| `nao_aplicavel` |
| `ventilacao_invasiva` | string enum | `sim` \| `nao` |
| `vni` | string enum | `sim` \| `nao` |
| `tecnicas_dialiticas` | string enum | `sim` \| `nao` |
| `esquema_atuacao_crise` | string | Texto livre |
| `hospital_referencia` | string | |
| `hospital_referencia_contacto` | string | |
| `vacinas` | string | |
| `escrito_por_id` | string \| null (ref) | id em `profissionais` |
| `escrito_em` | timestamp \| null | |
| `verificado_por_id` | string \| null (ref) | id em `profissionais` |
| `verificado_em` | timestamp \| null | |
| `estado_verificacao` | string enum | `nao_verificado` \| `verificado` |
| `validado_em` | timestamp \| null | Validação obrigatória a cada 6 meses |
| `atualizado_em` | timestamp | |
| `verificacoes_campo` | map | Extensão desta iteração (não existe no SQL original): estado de verificação por campo individual, usado no ecrã de Nível 1 (`{ campo: { estado, por, em } }`). Mantido como sub-mapa em vez de subcoleção por simplicidade — reavaliar se o nº de campos verificáveis crescer muito. |

**Regra crítica:** leitura permitida à família ligada ao paciente; escrita
exclusiva de `profissional`/`admin` (ver `firestore.rules`).

**Índices sugeridos:** nenhum — acesso sempre por id do documento
(`pacienteId`), nunca por query.

---

## `pulseiras/{pulseiraId}`

| Campo | Tipo | Notas |
|---|---|---|
| `token` | string, único | Token opaco gravado no chip NFC/QR — nunca dado clínico |
| `serial_fisico` | string, único | |
| `lote_id` | string (ref) | id em `lotes` |
| `estado` | string enum | `nao_atribuida` \| `ativa` \| `desativada` \| `perdida` \| `substituida` |
| `paciente_id` | string \| null (ref) | id em `pacientes` |
| `protegida_por_senha` | boolean | |
| `senha_referencia` | string \| null | Nunca a senha em claro — referência/hash |
| `revogada_por` | string enum \| null | `familia` \| `equipa` |
| `atribuida_em` | timestamp \| null | |
| `desativada_em` | timestamp \| null | |
| `motivo_desativacao` | string \| null | |
| `criado_em` | timestamp | |

**Índices sugeridos:** índice de campo único em `token` (consulta principal
do Worker no `/scan`: `where('token', '==', tokenLido)`); índice em
`estado` para os filtros do ecrã admin de pulseiras/lotes.

---

## `lotes/{loteId}`

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

**Índices sugeridos:** nenhum — lista pequena, sem filtros compostos.

---

## `profissionais/{profissionalId}`

| Campo | Tipo | Notas |
|---|---|---|
| `nome` | string | |
| `credencial_ordem` | string, único | Login (nº de Ordem) |
| `servico` | string | |
| `tipo_relacao` | string enum | `interno` \| `externo` (Fase 1: só `interno` usado) |
| `instituicao_id` | string \| null (ref) | Reservado para Fase 2 (`instituicoes`, dormente) |
| `mfa_ativo` | boolean | Obrigatório = `true` na Fase 1 |
| `funcao_auditor` | boolean | Sub-papel: acesso de leitura a `acessos` |
| `ativo` | boolean | |
| `criado_em` | timestamp | |
| `papel` | string enum | Custom claim espelhada aqui para consulta administrativa: `profissional` \| `admin` |

**Índices sugeridos:** índice de campo único em `credencial_ordem` (login).

---

## `contas_familia/{contaId}`

| Campo | Tipo | Notas |
|---|---|---|
| `nome` | string | |
| `email` | string, único | Login |
| `telefone` | string | |
| `relacao` | string | Ex.: "mãe", "pai", "tutor legal" |
| `firebase_uid` | string, único | Liga ao registo do Firebase Auth |
| `ativo` | boolean | |
| `criado_em` | timestamp | |

**Índices sugeridos:** índice de campo único em `email`.

---

## `familia_paciente/{ligacaoId}`

Tabela de ligação N:N conta_familia ↔ paciente. Em SQL era chave composta
`(conta_familia_id, paciente_id)`; em Firestore replica-se essa chave
composta como **id do documento**, no formato:

```
{conta_familia_id}_{paciente_id}
```

para permitir `exists()` direto nas Security Rules sem query adicional.

| Campo | Tipo | Notas |
|---|---|---|
| `conta_familia_id` | string (ref) | |
| `paciente_id` | string (ref) | |
| `criado_em` | timestamp | |

**Índices sugeridos:** índice composto `(conta_familia_id, paciente_id)` —
coberto automaticamente pelo padrão de id do documento acima, mas manter
como índice de campo simples em `conta_familia_id` para consultas
administrativas ("todos os pacientes desta conta").

---

## `acessos/{acessoId}`

Audit log do break-glass, alinhado com ISO 27789:2021. **Escrita
exclusiva do Worker** (nunca do cliente — ver `firestore.rules`).

| Campo | Tipo | Notas |
|---|---|---|
| `pulseira_id` | string \| null (ref) | `null` só nos casos de token totalmente desconhecido ou pedido de eliminação RGPD |
| `profissional_id` | string \| null (ref) | |
| `nivel_acedido` | string enum | `nivel_1` \| `nivel_2` \| `negado` |
| `motivo` | string \| null | Obrigatório para `nivel_2` |
| `servico` | string \| null | |
| `ip_ou_localizacao` | string \| null | |
| `notificado_titular_em` | timestamp \| null | Preenchido de forma assíncrona após o envio Resend |
| `acedido_em` | timestamp | |

**Índices sugeridos:**
- Índice composto `(pulseira_id, acedido_em desc)` — histórico de acessos
  por paciente (via `pulseira_id`), ordenado por data (usado no ecrã de
  família "Histórico de acessos").
- Índice de campo simples em `acedido_em desc` — lista geral de auditoria.
- Índice de campo simples em `nivel_acedido` — filtro de "acessos negados".

---

## Fase 2/3 — dormente, não implementada nesta iteração

As coleções abaixo fazem parte da visão de futuro documentada no Resumo do
Projeto §10 e **não devem ser criadas no Firestore desta iteração**:

- `instituicoes` — suporte a profissionais externos (Fase 2).
- `pedidos` — acesso por pesquisa (nome + data nascimento + sexo, ou nº de
  utente), sem pulseira física (Fase 2/3) — modelo de segurança ainda por
  desenhar (motivo obrigatório, notificação, auditoria equivalentes ao
  acesso por pulseira; ver Questão em aberto nº 3 do CLAUDE.md).
- `consultas_validacao` — integração nativa com RSE/SNS 24 (Fase 4).

Se e quando estas fases avançarem, este documento deve ser atualizado
antes de qualquer código ou regra de segurança ser escrita para elas.
