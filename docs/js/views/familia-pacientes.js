/* views/familia-pacientes.js — "Os meus pacientes" + criar paciente/consentimento. */
function viewFamiliaPacientes(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var mostrarForm = false;

  function render() {
    var pacientes = mockdb.listPacientesDaFamilia(sessao.contaFamiliaId);

    root.innerHTML =
      '<div class="app-topbar">' +
      '<div class="brand">SAVI <small>Área da família</small></div>' +
      '<div class="user-info">' + sessao.nome + ' <button class="logout" id="btn-sair">Terminar sessão</button></div>' +
      "</div>" +
      '<div class="page">' +
      "<h1>Os meus pacientes</h1>" +
      '<p class="subtitle">Consulte os dados clínicos dos seus educandos, geridos exclusivamente pela equipa clínica.</p>' +
      '<button class="btn btn-primary" id="btn-novo" style="margin-bottom:18px;">+ Adicionar paciente</button>' +
      '<div id="form-novo"></div>' +
      '<div id="lista-pacientes"></div>' +
      "</div>";

    document.getElementById("btn-sair").addEventListener("click", function () {
      authSim.logout();
      SAVI_router.navegar("#/login-familia");
    });

    document.getElementById("btn-novo").addEventListener("click", function () {
      mostrarForm = !mostrarForm;
      renderForm();
    });

    var listaEl = document.getElementById("lista-pacientes");
    if (pacientes.length === 0) {
      listaEl.innerHTML = '<div class="empty-state">Ainda não tem pacientes associados. Utilize "Adicionar paciente" para começar.</div>';
    } else {
      pacientes.forEach(function (p) {
        var idade = mockdb.calcularIdade(p.data_nascimento);
        var div = document.createElement("div");
        div.className = "card";
        div.style.cursor = "pointer";
        div.innerHTML =
          '<p class="card-label">Paciente</p>' +
          '<p class="card-value">' + p.nome + " · " + idade + " anos</p>" +
          '<p class="card-sub">Consentimento: <span class="badge ' + p.estado_consentimento + '">' + p.estado_consentimento + "</span></p>";
        div.addEventListener("click", function () {
          SAVI_router.navegar("#/familia/paciente/" + p.id);
        });
        listaEl.appendChild(div);
      });
    }

    renderForm();
  }

  function renderForm() {
    var formEl = document.getElementById("form-novo");
    if (!mostrarForm) { formEl.innerHTML = ""; return; }
    formEl.innerHTML =
      '<div class="card">' +
      '<h3 style="margin-top:0;color:var(--navy);font-size:15px;">Novo paciente</h3>' +
      '<p class="field-hint">Só pode registar dados administrativos aqui — os dados clínicos (Nível 1) são sempre preenchidos pela equipa clínica do hospital.</p>' +
      '<label>Nome completo</label><input type="text" id="f-nome">' +
      '<label>Data de nascimento</label><input type="date" id="f-nascimento">' +
      '<label>Contacto de emergência</label><input type="text" id="f-contacto" placeholder="Ex.: +351 9XX XXX XXX (mãe)">' +
      '<h4 style="margin:16px 0 6px;color:var(--navy);font-size:13px;">Consentimento</h4>' +
      '<label>Prestado por</label>' +
      '<select id="f-prestado-por"><option value="tutor_legal">Tutor legal</option><option value="proprio">Próprio</option></select>' +
      '<label>Nome do tutor (se aplicável)</label><input type="text" id="f-tutor">' +
      '<label>Referência do documento de identificação</label><input type="text" id="f-doc" placeholder="Ex.: CC 000000000 ZZ0">' +
      '<div id="erro-form" style="color:var(--alert);font-size:12.5px;margin-top:8px;"></div>' +
      '<button class="btn btn-primary" id="f-submeter" style="margin-top:14px;">Criar paciente e prestar consentimento</button>' +
      "</div>";

    document.getElementById("f-submeter").addEventListener("click", function () {
      var nome = document.getElementById("f-nome").value.trim();
      var nascimento = document.getElementById("f-nascimento").value;
      var contacto = document.getElementById("f-contacto").value.trim();
      var prestadoPor = document.getElementById("f-prestado-por").value;
      var tutor = document.getElementById("f-tutor").value.trim();
      var doc = document.getElementById("f-doc").value.trim();
      var erroEl = document.getElementById("erro-form");

      if (!nome || !nascimento || !doc) {
        erroEl.textContent = "Preencha nome, data de nascimento e referência do documento.";
        return;
      }

      var paciente = mockdb.criarPacientePorFamilia(sessao.contaFamiliaId, {
        nome: nome,
        data_nascimento: nascimento,
        contacto_emergencia: contacto,
        consentimento_prestado_por: prestadoPor,
        consentimento_nome_tutor: tutor || null,
        consentimento_documento_ref: doc
      });
      mockdb.prestarConsentimento(paciente.id, {
        consentimento_prestado_por: prestadoPor,
        consentimento_nome_tutor: tutor || null,
        consentimento_documento_ref: doc
      });

      mostrarForm = false;
      SAVI_toast("Paciente criado. A equipa administradora será notificada para preencher os dados clínicos e emitir a pulseira.");
      render();
    });
  }

  render();
}
