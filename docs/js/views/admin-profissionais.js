/* views/admin-profissionais.js — gestão de profissionais. */
function viewAdminProfissionais(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var mostrarForm = false;

  function render() {
    var profissionais = mockdb.listProfissionais();

    root.innerHTML = adminNav(sessao, "profissionais") +
      '<div class="page">' +
      "<h1>Profissionais</h1>" +
      '<p class="subtitle">' + profissionais.length + " profissionais registados.</p>" +
      '<button class="btn btn-primary" id="btn-novo" style="margin-bottom:16px;">+ Registar profissional</button>' +
      '<div id="form-novo"></div>' +
      "<table><thead><tr><th>Nome</th><th>Nº de Ordem</th><th>Serviço</th><th>Papel</th><th>Auditor</th><th>Estado</th><th></th></tr></thead><tbody id=\"tbody\"></tbody></table>" +
      "</div>";

    document.getElementById("btn-novo").addEventListener("click", function () {
      mostrarForm = !mostrarForm;
      renderForm();
    });

    var tbody = document.getElementById("tbody");
    profissionais.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + p.nome + "</td>" +
        "<td>" + p.credencial_ordem + "</td>" +
        "<td>" + (p.servico || "—") + "</td>" +
        "<td>" + (p._papel === "admin" ? "Equipa administradora" : "Profissional clínico") + "</td>" +
        "<td>" + (p.funcao_auditor ? "Sim" : "Não") + "</td>" +
        '<td><span class="badge ' + (p.ativo ? "ativo" : "revogado") + '">' + (p.ativo ? "ativo" : "inativo") + "</span></td>" +
        "<td></td>";
      var tdAcao = tr.lastChild;
      var btn = document.createElement("button");
      btn.className = "btn btn-sm " + (p.ativo ? "btn-danger" : "btn-ok");
      btn.textContent = p.ativo ? "Desativar" : "Ativar";
      btn.addEventListener("click", function () {
        if (p.ativo) mockdb.desativarProfissional(p.id); else mockdb.ativarProfissional(p.id);
        render();
      });
      tdAcao.appendChild(btn);
      tbody.appendChild(tr);
    });

    renderForm();
  }

  function renderForm() {
    var el = document.getElementById("form-novo");
    if (!mostrarForm) { el.innerHTML = ""; return; }
    el.innerHTML =
      '<div class="card">' +
      '<h3 style="margin-top:0;color:var(--navy);font-size:15px;">Novo profissional</h3>' +
      '<label>Nome completo</label><input type="text" id="f-nome">' +
      '<label>Nº de Ordem</label><input type="text" id="f-credencial">' +
      '<label>Serviço</label><input type="text" id="f-servico" value="Urgência">' +
      '<label>Papel</label><select id="f-papel"><option value="profissional">Profissional clínico</option><option value="admin">Equipa administradora</option></select>' +
      '<label><input type="checkbox" id="f-auditor" style="width:auto;display:inline-block;margin-right:6px;">Função de auditor (só visível se papel = equipa administradora)</label>' +
      '<label>Password de demonstração</label><input type="text" id="f-password" value="demo123">' +
      '<button class="btn btn-primary" id="f-submeter" style="margin-top:12px;">Registar</button>' +
      "</div>";

    document.getElementById("f-submeter").addEventListener("click", function () {
      var nome = document.getElementById("f-nome").value.trim();
      var credencial = document.getElementById("f-credencial").value.trim();
      if (!nome || !credencial) { alert("Preencha nome e nº de Ordem."); return; }
      mockdb.criarProfissional({
        nome: nome,
        credencial_ordem: credencial,
        servico: document.getElementById("f-servico").value.trim(),
        papel: document.getElementById("f-papel").value,
        funcao_auditor: document.getElementById("f-auditor").checked,
        password: document.getElementById("f-password").value
      });
      mostrarForm = false;
      SAVI_toast("Profissional registado.");
      render();
    });
  }

  render();
}
