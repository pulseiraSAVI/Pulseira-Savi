/* views/admin-pacientes.js — gestão de pacientes pela equipa administradora. */
function viewAdminPacientes(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var mostrarForm = false;

  function render() {
    var pacientes = mockdb.listPacientes();

    root.innerHTML = adminNav(sessao, "pacientes") +
      '<div class="page">' +
      "<h1>Pacientes</h1>" +
      '<p class="subtitle">' + pacientes.length + ' pacientes registados no piloto.</p>' +
      '<button class="btn btn-primary" id="btn-novo" style="margin-bottom:16px;">+ Registar paciente</button>' +
      '<div id="form-novo"></div>' +
      "<table><thead><tr><th>Nome</th><th>Idade</th><th>Origem</th><th>Consentimento</th><th>Verificação clínica</th><th></th></tr></thead><tbody id=\"tbody\"></tbody></table>" +
      "</div>";

    document.getElementById("btn-novo").addEventListener("click", function () {
      mostrarForm = !mostrarForm;
      renderForm();
    });

    var tbody = document.getElementById("tbody");
    pacientes.forEach(function (p) {
      var d = mockdb.getDadosNivel1(p.id) || {};
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + p.nome + "</td>" +
        "<td>" + mockdb.calcularIdade(p.data_nascimento) + "</td>" +
        "<td>" + p.origem + "</td>" +
        '<td><span class="badge ' + p.estado_consentimento + '">' + p.estado_consentimento + "</span></td>" +
        '<td><span class="badge ' + (d.estado_verificacao || "nao_verificado") + '">' + (d.estado_verificacao || "nao_verificado") + "</span></td>" +
        "<td></td>";
      var tdAcao = tr.lastChild;
      var btn = document.createElement("button");
      btn.className = "btn btn-secondary btn-sm";
      btn.textContent = "Editar dados clínicos";
      btn.addEventListener("click", function () {
        SAVI_router.navegar("#/admin/nivel1/" + p.id);
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
      '<h3 style="margin-top:0;color:var(--navy);font-size:15px;">Registar novo paciente (piloto)</h3>' +
      '<label>Nome completo</label><input type="text" id="f-nome">' +
      '<label>Data de nascimento</label><input type="date" id="f-nascimento">' +
      '<label>Contacto de emergência</label><input type="text" id="f-contacto">' +
      '<label>Referência no sistema do hospital (para Nível 2)</label><input type="text" id="f-ref" placeholder="Ex.: processo nº 00000/2026, Hospital X">' +
      '<button class="btn btn-primary" id="f-submeter" style="margin-top:12px;">Registar</button>' +
      "</div>";

    document.getElementById("f-submeter").addEventListener("click", function () {
      var nome = document.getElementById("f-nome").value.trim();
      var nascimento = document.getElementById("f-nascimento").value;
      if (!nome || !nascimento) { alert("Preencha nome e data de nascimento."); return; }
      mockdb.criarPacienteAdmin({
        nome: nome,
        data_nascimento: nascimento,
        contacto_emergencia: document.getElementById("f-contacto").value.trim(),
        referencia_sistema_ext: document.getElementById("f-ref").value.trim()
      });
      mostrarForm = false;
      SAVI_toast("Paciente registado. Preencha os dados clínicos e atribua uma pulseira.");
      render();
    });
  }

  render();
}
