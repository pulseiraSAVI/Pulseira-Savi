/* views/admin-dashboard.js — dashboard com contadores da vista de
 * superadmin. Não existe uma quarta vista "painel de controlo" — é
 * exatamente este conteúdo. Usa adminNav/statCard de nav-helpers.js. */
async function viewAdminDashboard(root) {
  "use strict";

  var sessao = authSim.getSessao();
  root.innerHTML = adminNav(sessao, "dashboard") + '<div class="page"><p class="subtitle">A carregar…</p></div>';

  var pacientes = await mockdb.listPacientes();
  var pulseiras = await mockdb.listPulseiras();
  var profissionais = await mockdb.listProfissionais();
  var acessos = await mockdb.listAcessos();

  var dadosPorPaciente = {};
  await Promise.all(pacientes.map(async function (p) {
    dadosPorPaciente[p.id] = await mockdb.getDadosNivel1(p.id);
  }));

  var pulseirasAtivas = pulseiras.filter(function (p) { return p.estado === "ativa"; }).length;
  var pulseirasNaoAtribuidas = pulseiras.filter(function (p) { return p.estado === "nao_atribuida"; }).length;
  var pulseirasProblema = pulseiras.filter(function (p) { return p.estado === "perdida" || p.estado === "desativada" || p.estado === "substituida"; }).length;
  var consentimentosPendentes = pacientes.filter(function (p) { return p.estado_consentimento === "pendente"; }).length;
  var naoVerificados = pacientes.filter(function (p) {
    var d = dadosPorPaciente[p.id];
    return d && d.estado_verificacao === "nao_verificado";
  }).length;
  var acessosHoje = acessos.filter(function (a) {
    var d = new Date(a.acedido_em);
    var hoje = new Date();
    return d.toDateString() === hoje.toDateString();
  }).length;

  root.innerHTML = adminNav(sessao, "dashboard") +
    '<div class="page">' +
    "<h1>Dashboard</h1>" +
    '<p class="subtitle">Visão geral do piloto SAVI — 1 serviço de urgência, até 50 pacientes.</p>' +
    '<div class="grid-3">' +
    statCard(pacientes.length, "Pacientes registados") +
    statCard(pulseirasAtivas, "Pulseiras ativas") +
    statCard(pulseirasNaoAtribuidas, "Pulseiras por atribuir") +
    statCard(pulseirasProblema, "Pulseiras perdidas/desativadas") +
    statCard(consentimentosPendentes, "Consentimentos pendentes") +
    statCard(naoVerificados, "Registos clínicos não verificados") +
    statCard(profissionais.filter(function (p) { return p.ativo; }).length, "Contas ativas") +
    statCard(acessosHoje, "Acessos hoje") +
    statCard(acessos.filter(function (a) { return a.nivel_acedido === "negado"; }).length, "Acessos negados (total)") +
    "</div>" +
    "</div>";

  ligarBotaoSair();
}
