/* views/admin-dashboard.js — dashboard com contadores. É a "vista de
 * equipa administradora"; não existe uma quarta vista "painel de controlo". */
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
    statCard(profissionais.filter(function (p) { return p.ativo; }).length, "Profissionais ativos") +
    statCard(acessosHoje, "Acessos hoje") +
    statCard(acessos.filter(function (a) { return a.nivel_acedido === "negado"; }).length, "Acessos negados (total)") +
    "</div>" +
    "</div>";
}

function statCard(numero, label) {
  return '<div class="stat-card"><div class="n">' + numero + '</div><div class="l">' + label + "</div></div>";
}

function adminNav(sessao, ativo) {
  function item(hash, label, chave) {
    var estilo = ativo === chave ? "font-weight:800;color:#fff;" : "color:#C9D8DF;";
    return '<a href="#/admin/' + hash + '" style="' + estilo + 'text-decoration:none;font-size:13px;margin-right:16px;">' + label + "</a>";
  }
  var auditoriaLink = sessao.funcao_auditor ? item("auditoria", "Segurança / Auditoria", "auditoria") : "";
  return (
    '<div class="app-topbar" style="flex-wrap:wrap;gap:8px;">' +
    '<div class="brand">SAVI <small>Equipa administradora</small></div>' +
    '<div class="user-info">' + sessao.nome + ' <button class="logout" id="btn-sair">Terminar sessão</button></div>' +
    "</div>" +
    '<div style="background:var(--navy-2);padding:10px 20px;display:flex;flex-wrap:wrap;">' +
    item("dashboard", "Dashboard", "dashboard") +
    item("pacientes", "Pacientes", "pacientes") +
    item("tokens", "Pulseiras / Lotes", "tokens") +
    item("profissionais", "Profissionais", "profissionais") +
    auditoriaLink +
    "</div>"
  ).replace('<button class="logout" id="btn-sair">Terminar sessão</button>', '<button class="logout" onclick="authSim.logout();SAVI_router.navegar(\'#/login-profissional\')">Terminar sessão</button>');
}
