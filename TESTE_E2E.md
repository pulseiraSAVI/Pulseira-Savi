# SAVI — Checklist de teste end-to-end (paciente fictício)

> Objetivo: validar o fluxo completo sobre infraestrutura real (Firestore,
> Firebase Auth, Cloudflare Worker) antes de considerar o bloco técnico do
> roadmap fechado (ver CLAUDE.md, "Pendente antes do primeiro paciente
> FICTÍCIO"). Usar sempre dados de um paciente inventado — nunca dados
> reais nesta fase.

## 0 · Pré-requisitos

- [ ] Servir `docs/` por http(s) — já não corre por `file://`:
  ```
  cd docs && python3 -m http.server 8000
  ```
  e abrir `http://localhost:8000`. (Alternativa: já publicado no GitHub
  Pages.)
- [ ] Confirmar que `https://savi-worker.pulseira-savi.workers.dev`
  responde sem erro de TLS — testar por exemplo:
  ```
  curl -i https://savi-worker.pulseira-savi.workers.dev/acesso/pulseira
  ```
  Um erro 400/401 é normal (pedido sem corpo/token) — o que se quer
  descartar é uma falha de handshake TLS. Houve uma falha deste tipo
  logo após o registo do subdomínio, nunca confirmada como resolvida.
- [ ] Ter a conta superadmin `ADMIN01` (já criada) e o respetivo PIN à mão.
- [ ] Abrir a consola do browser (F12) durante todo o teste — os erros
  do Firestore/Worker aparecem lá primeiro.

## 1 · Criar uma conta de profissional de teste

Continua a ser feito fora da app, via `scripts/criar-conta.js` (decisão
documentada: criar/editar conta exige Admin SDK, não está na UI):

```
cd scripts
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/a/chave.json
node criar-conta.js
```

- [ ] Criar uma conta com papéis `["profissional"]`, nome/nº de Ordem
  claramente marcados como teste (ex.: nome "Teste Piloto", nº de Ordem
  `TESTE01`), PIN de 5 caracteres à escolha.
- [ ] Confirmar no Firebase Console (Authentication → Users e Firestore →
  `profissionais`) que a conta e o documento ficaram criados.

## 2 · Identificação (login)

- [ ] Abrir a app, identificar-se com `TESTE01` + o PIN escolhido.
- [ ] Confirmar que entra diretamente na vista de profissional (conta com
  um único papel não deve mostrar o ecrã de escolha de papel).
- [ ] Testar PIN errado → deve mostrar "Nº de Ordem ou PIN incorretos."
  sem detalhes adicionais.
- [ ] (Opcional) Criar uma segunda conta de teste com
  `["profissional","utilizador"]` e confirmar que aparece o ecrã de
  escolha de papel, e que escolher um papel não dá acesso ao outro na
  mesma sessão.

## 3 · Vista de profissional — registar paciente fictício

- [ ] "+ Registar paciente" → preencher nome, data de nascimento, sexo,
  nº de utente inventado, morada, contactos. Guardar.
- [ ] Confirmar no Firestore (`pacientes`) que o documento apareceu com
  `criado_por_id` = uid da conta de teste, e que `dados_nivel1/{id}` foi
  criado em paralelo, vazio.
- [ ] Abrir "Ver / editar" do paciente novo — confirmar que o "Gestor do
  caso" já veio pré-preenchido com os dados da própria conta de teste.
- [ ] Preencher a secção "Algoritmo" (peso, altura, alergias, condição
  crítica, esquema de dose, medicação contraindicada, esquema de
  atuação em crise, notas) e "Medicação Habitual". Guardar.
- [ ] Confirmar que o estado de verificação aparece como
  "não_verificado" logo após guardar (mesmo se já estivesse
  "verificado" antes — guardar repõe sempre para não_verificado).
- [ ] Clicar "Verificar registo clínico" — estado deve passar a
  "verificado".
- [ ] "+ Anexar documento" (RGPD ou termo de responsabilidade) — indicar
  um nome de ficheiro qualquer. Confirmar que aparece na lista.
  **Esperado nesta fase:** só o metadado fica guardado (`documentos`),
  sem ficheiro real — o Storage ainda não está ativo (tarefa #17).
- [ ] "Solicitar pulseira" — deve atribuir automaticamente a próxima
  pulseira `nao_atribuida` disponível e mostrar o token. **Se der erro
  "Não há pulseiras disponíveis"**, gerar primeiro um lote como
  superadmin (passo 4) e voltar aqui.

## 4 · Vista de superadmin

Terminar sessão e entrar com `ADMIN01`.

- [ ] Dashboard — confirmar que os contadores refletem o paciente de
  teste criado (pacientes registados, pulseiras ativas, etc.).
- [ ] "Pulseiras / Lotes" — se ainda não há pulseiras nao_atribuidas,
  gerar um lote pequeno (ex.: quantidade 5) e confirmar que aparecem
  na tabela com estado `nao_atribuida`.
- [ ] "Contas" — confirmar que a conta de teste aparece na lista, e que
  o botão "Desativar"/"Ativar" funciona (ativa=false/true no
  Firestore). Confirmar que **não há** botões de criar/editar/eliminar
  (removidos de propósito nesta revisão).
- [ ] "Pacientes" (vista de superadmin, sem restrição de "só os meus") —
  confirmar que o paciente de teste aparece mesmo tendo sido criado
  pela conta `TESTE01`, não pelo superadmin.
- [ ] "Segurança / Auditoria" — deve estar vazia por agora (só se
  preenche com acessos break-glass, passo 5).

## 5 · Papel utilizador (break-glass) — os 3 métodos

Terminar sessão. Entrar com uma conta que tenha o papel `utilizador`
(criar uma de teste com `["utilizador"]`, ou usar `ADMIN01` que também
serve — superadmin não tem papel utilizador por defeito, confirmar se
faz sentido testar com uma conta dedicada).

- [ ] **Pulseira**: introduzir manualmente o token gerado no passo 3.
  Deve mostrar o Nível 1 do paciente de teste.
- [ ] **Número de utente**: introduzir o nº de utente do paciente de
  teste. Mesmo resultado esperado.
- [ ] **Identidade**: nome completo + data de nascimento + sexo do
  paciente de teste + motivo obrigatório. Confirmar que **sem motivo**
  a app bloqueia antes de mostrar qualquer dado.
- [ ] Testar um token/nº de utente inexistente em cada método — deve
  cair no ecrã de erro apropriado (nunca mostrar dados de outro
  paciente por engano).
- [ ] Deixar a sessão inativa 5 minutos — confirmar que expira e
  redireciona para "sessão expirada".

## 6 · Confirmar auditoria dos acessos

Voltar a entrar como `ADMIN01` → "Segurança / Auditoria":

- [ ] Todos os acessos do passo 5 (incluindo os negados/inexistentes)
  aparecem na tabela, com método, utilizador, paciente, serviço, e
  motivo (só preenchido no método identidade).
- [ ] Coluna "Notificação" deve aparecer como "pendente" — **esperado**,
  porque o Resend ainda não está configurado (tarefa #17); a
  notificação ao titular não é enviada, mas o acesso fica sempre
  registado de qualquer forma.

## 7 · Confirmar que as Firestore Rules estão mesmo a proteger

- [ ] Com a conta `TESTE01` (só profissional), tentar abrir na URL o
  paciente de outro profissional (`#/profissional/nivel1/<id-de-outro-paciente>`,
  se houver algum de outra conta) — deve cair em "acesso negado", nunca
  mostrar os dados.
- [ ] Confirmar na consola do browser que esse pedido negado aparece
  como erro do Firestore (`permission-denied`), não como um bug da app.

## Lacunas conhecidas a não confundir com bugs

- Documentos: só o metadado é guardado, sem ficheiro (Storage por
  ativar).
- Notificação ao titular: sempre "pendente" (Resend por configurar).
- Criar/editar/eliminar conta: só via `scripts/criar-conta.js`, de
  propósito.
- App de família: não existe nesta revisão (suspensa).

Depois de passar por toda esta lista sem surpresas, o bloco técnico do
roadmap ("Pendente antes do primeiro paciente FICTÍCIO") pode
considerar-se fechado — falta ainda ativar Storage/Resend (tarefa #17)
e, à parte, o bloco legal (#18) antes de qualquer paciente **real**.
