/* views/admin-auditoria.js
 * Secção Segurança/Auditoria — só visível para quem tem funcao_auditor=true
 * (aplicado também na guarda de rota em router.js, e nas Firestore Rules:
 * a coleção `acessos` só é legível por auditor/superadmin). Lista a
 * tabela `acessos`, cobrindo os 3 métodos de acesso (pulseira/número de
 * utente/identidade) — não só pulseira.
 */
async function viewAdminAuditoria(root) {
  "use strict";

  var sessao = authSim.getSessao();
  root.innerHTML = adminNav(sessao, "auditoria") + '<div class="page"><p class="subtitle">A carregar…</p></div>';

  var acessos = await mockdb.listAcessos();
  var pulseiras = await mockdb.listPulseiras();
  var profissionais = await mockdb.listProfissionais();

  var pacientesPorId = {};
  await Promise.all(acessos.map(async function (a) {
    if (a.paciente_id && !pacientesPorId[a.paciente_id]) {
      try { pacientesPorId[a.paciente_id] = await mockdb.getPaciente(a.paciente_id); } catch (e) { pacientesPorId[a.paciente_id] = null; }
    }
  }));

  function nomeUtilizador(id) {
    var p = profissionais.find(function (x) { return x.id === id; });
    return p ? p.nome : "—";
  }
  function nomePaciente(id) {
    var p = id ? pacientesPorId[id] : null;
    return p ? p.nome : "—";
  }
  function tokenPulseira(id) {
    var p = pulseiras.find(function (x) { return x.id === id; });
    return p ? p.token : "—";
  }
  function rotuloMetodo(m) {
    var mapa = { pulseira: "Pulseira", numero_utente: "Número de utente", identidade: "Identidade" };
    return mapa[m] || m || "—";
  }

  root.innerHTML = adminNav(sessao, "auditoria") +
    '<div class="page">' +
    "<h1>Segurança / Auditoria</h1>" +
    '<p class="subtitle">Registo completo de acessos (`acessos`), incluindo negações — alinhado com ISO 27789:2021. ' + acessos.length + " registo(s).</p>" +
    '<table><thead><tr><th>Data/hora</th><th>Método</th><th>Resultado</th><th>Utilizador</th><th>Paciente</th><th>Pulseira</th><th>Serviço</th><th>Motivo</th><th>Notificação</th></tr></thead><tbody id="tbody"></tbody></table>' +
    "</div>";

  ligarBotaoSair();

  var tbody = document.getElementById("tbody");
  if (acessos.length === 0) {
    var tr0 = document.createElement("tr");
    tr0.innerHTML = '<td colspan="9"><div class="empty-state">Sem acessos registados.</div></td>';
    tbody.appendChild(tr0);
  }
  acessos.forEach(function (a) {
    var tr = document.createElement("tr");
    var d = new Date(a.acedido_em);
    tr.innerHTML =
      "<td>" + d.toLocaleString("pt-PT") + "</td>" +
      "<td>" + rotuloMetodo(a.metodo_acesso) + "</td>" +
      '<td><span class="badge ' + (a.nivel_acedido === "negado" ? "revogado" : "ativo") + '">' + (a.nivel_acedido === "negado" ? "negado" : "nível 1") + "</span></td>" +
      "<td>" + nomeUtilizador(a.utilizador_id) + "</td>" +
      "<td>" + nomePaciente(a.paciente_id) + "</td>" +
      "<td>" + (a.pulseira_id ? tokenPulseira(a.pulseira_id) : "—") + "</td>" +
      "<td>" + (a.servico || "—") + "</td>" +
      "<td>" + (a.motivo || "—") + "</td>" +
      "<td>" + (a.notificado_titular_em ? new Date(a.notificado_titular_em).toLocaleString("pt-PT") : "pendente") + "</td>";
    tbody.appendChild(tr);
  });
}
