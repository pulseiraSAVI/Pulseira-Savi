/* views/admin-auditoria.js
 * Secção Segurança/Auditoria — só visível para quem tem funcao_auditor=true
 * (aplicado também na guarda de rota em router.js). Lista a tabela `acessos`.
 */
function viewAdminAuditoria(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var acessos = mockdb.listAcessos();
  var pulseiras = mockdb.listPulseiras();
  var profissionais = mockdb.listProfissionais();

  function nomeProfissional(id) {
    var p = profissionais.find(function (x) { return x.id === id; });
    return p ? p.nome : "—";
  }
  function tokenPulseira(id) {
    var p = pulseiras.find(function (x) { return x.id === id; });
    return p ? p.token : "—";
  }

  root.innerHTML = adminNav(sessao, "auditoria") +
    '<div class="page">' +
    "<h1>Segurança / Auditoria</h1>" +
    '<p class="subtitle">Registo completo de acessos (`acessos`), incluindo negações — alinhado com ISO 27789:2021. ' + acessos.length + " registo(s).</p>" +
    '<table><thead><tr><th>Data/hora</th><th>Nível</th><th>Profissional</th><th>Pulseira</th><th>Serviço</th><th>Motivo</th><th>Notificação titular</th></tr></thead><tbody id="tbody"></tbody></table>' +
    "</div>";

  var tbody = document.getElementById("tbody");
  if (acessos.length === 0) {
    var tr0 = document.createElement("tr");
    tr0.innerHTML = '<td colspan="7"><div class="empty-state">Sem acessos registados.</div></td>';
    tbody.appendChild(tr0);
  }
  acessos.forEach(function (a) {
    var tr = document.createElement("tr");
    var d = new Date(a.acedido_em);
    tr.innerHTML =
      "<td>" + d.toLocaleString("pt-PT") + "</td>" +
      '<td><span class="badge ' + (a.nivel_acedido === "negado" ? "revogado" : "ativo") + '">' + a.nivel_acedido + "</span></td>" +
      "<td>" + nomeProfissional(a.profissional_id) + "</td>" +
      "<td>" + tokenPulseira(a.pulseira_id) + "</td>" +
      "<td>" + (a.servico || "—") + "</td>" +
      "<td>" + (a.motivo || "—") + "</td>" +
      "<td>" + (a.notificado_titular_em ? new Date(a.notificado_titular_em).toLocaleString("pt-PT") : "pendente") + "</td>";
    tbody.appendChild(tr);
  });
}
