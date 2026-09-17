/* views/admin-dashboard.js — dashboard com contadores da vista de
 * superadmin. Não existe uma quarta vista "painel de controlo" — é
 * exatamente este conteúdo. Usa adminNav/statCard de nav-helpers.js. */
function viewAdminDashboard(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var pacientes = mockdb.listPacientes();
  var pulseiras = mockdb.listPulseiras();
  var profissionais = mockdb.listProfissionais();
  var acessos = mockdb.listAcessos();

  var pulseirasAtivas = pulseiras.filter(function (p) { return p.estado === "ativa"; }).length;
  var pulseirasNaoAtribuidas = pulseiras.filter(function (p) { return p.estado === "nao_atribuida"; }).length;
  var pulseirasProblema = pulseiras.filter(function (p) { return p.estado === "perdida" || p.estado === "desativada" || p.estado === "substituida"; }).length;
  var consentimentosPendentes = pacientes.filter(function (p) { return p.estado_consentimento === "pendente"; }).length;
  var naoVerificados = pacientes.filter(function (p) {
    var d = mockdb.getDadosNivel1(p.id);
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
