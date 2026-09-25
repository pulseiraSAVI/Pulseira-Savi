/* views/pacientes-lista.js
 * Gestão de pacientes — partilhada entre a vista de profissional (só os
 * pacientes que criou) e a vista de superadmin (vê todos). O criador do
 * paciente é sempre quem está autenticado nesta sessão (nunca escolhido
 * manualmente), tal como o Worker/Firestore Rules reais exigem.
 *
 * @param {string} contexto 'profissional' | 'admin'
 */
function viewPacientesLista(root, contexto) {
  "use strict";

  var sessao = authSim.getSessao();
  var mostrarForm = false;
  var ehAdmin = contexto === "admin";

  async function render() {
    root.innerHTML = '<div class="page"><p class="subtitle">A carregar…</p></div>';

    var pacientes = ehAdmin ? await mockdb.listPacientes() : await mockdb.listPacientesDoProfissional(sessao.userId);
    var nav = ehAdmin ? adminNav(sessao, "pacientes") : profissionalNav(sessao, "pacientes");
    var hashEditar = ehAdmin ? "#/admin/nivel1/" : "#/profissional/nivel1/";

    // Pré-carrega dados_nivel1 (e, em modo admin, o profissional criador)
    // de todos os pacientes visíveis antes de desenhar a tabela.
    var dadosPorPaciente = {};
    var criadoresPorId = {};
    await Promise.all(pacientes.map(async function (p) {
      dadosPorPaciente[p.id] = (await mockdb.getDadosNivel1(p.id)) || {};
      if (ehAdmin && !criadoresPorId[p.criado_por_id]) {
        criadoresPorId[p.criado_por_id] = await mockdb.getProfissional(p.criado_por_id);
      }
    }));

    root.innerHTML = nav +
      '<div class="page">' +
      "<h1>Pacientes</h1>" +
      '<p class="subtitle">' + pacientes.length + (ehAdmin ? " pacientes registados no piloto." : " pacientes seus.") + "</p>" +
      '<button class="btn btn-primary" id="btn-novo" style="margin-bottom:16px;">+ Registar paciente</button>' +
      '<div id="form-novo"></div>' +
      "<table><thead><tr><th>Nome</th><th>Idade</th><th>Nº utente</th><th>Consentimento</th><th>Verificação clínica</th>" + (ehAdmin ? "<th>Criado por</th>" : "") + "<th></th></tr></thead><tbody id=\"tbody\"></tbody></table>" +
      "</div>";

    ligarBotaoSair();

    document.getElementById("btn-novo").addEventListener("click", function () {
      mostrarForm = !mostrarForm;
      renderForm();
    });

    var tbody = document.getElementById("tbody");
    if (pacientes.length === 0) {
      var trVazio = document.createElement("tr");
      trVazio.innerHTML = '<td colspan="7"><div class="empty-state">Sem pacientes registados.</div></td>';
      tbody.appendChild(trVazio);
    }
    pacientes.forEach(function (p) {
      var d = dadosPorPaciente[p.id] || {};
      var criador = ehAdmin ? criadoresPorId[p.criado_por_id] : null;
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + p.nome + "</td>" +
        "<td>" + mockdb.formatarIdade(p.data_nascimento) + "</td>" +
        "<td>" + (p.numero_utente || "—") + "</td>" +
        '<td><span class="badge ' + p.estado_consentimento + '">' + p.estado_consentimento + "</span></td>" +
        '<td><span class="badge ' + (d.estado_verificacao || "nao_verificado") + '">' + (d.estado_verificacao || "nao_verificado") + "</span></td>" +
        (ehAdmin ? "<td>" + (criador ? criador.nome : "—") + "</td>" : "") +
        "<td></td>";
      var tdAcao = tr.lastChild;
      var btn = document.createElement("button");
      btn.className = "btn btn-secondary btn-sm";
      btn.textContent = "Ver / editar";
      btn.addEventListener("click", function () {
        SAVI_router.navegar(hashEditar + p.id);
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
      '<h3 style="margin-top:0;color:var(--navy);font-size:15px;">Registar novo paciente</h3>' +
      '<div class="grid-2">' +
      '<div><label>Nome completo</label><input type="text" id="f-nome"></div>' +
      '<div><label>Data de nascimento</label><input type="date" id="f-nascimento"></div>' +
      "</div>" +
      '<div class="grid-2">' +
      '<div><label>Sexo</label><select id="f-sexo"><option value="F">Feminino</option><option value="M">Masculino</option><option value="outro">Outro</option></select></div>' +
      '<div><label>Número de utente</label><input type="text" id="f-numero-utente"></div>' +
      "</div>" +
      '<label>Morada</label><input type="text" id="f-morada">' +
      '<div class="grid-2">' +
      '<div><label>Contacto de familiares</label><input type="text" id="f-contacto-familia"></div>' +
      '<div><label>Contacto de emergência</label><input type="text" id="f-contacto-emergencia"></div>' +
      "</div>" +
      '<p class="field-hint">O gestor do caso é preenchido automaticamente com os seus dados profissionais — pode ser editado depois no ecrã do paciente.</p>' +
      '<button class="btn btn-primary" id="f-submeter" style="margin-top:12px;">Registar</button>' +
      "</div>";

    document.getElementById("f-submeter").addEventListener("click", async function () {
      var nome = document.getElementById("f-nome").value.trim();
      var nascimento = document.getElementById("f-nascimento").value;
      if (!nome || !nascimento) { alert("Preencha nome e data de nascimento."); return; }
      await mockdb.criarPaciente({
        nome: nome,
        data_nascimento: nascimento,
        sexo: document.getElementById("f-sexo").value,
        numero_utente: document.getElementById("f-numero-utente").value.trim(),
        morada: document.getElementById("f-morada").value.trim(),
        contacto_familia: document.getElementById("f-contacto-familia").value.trim(),
        contacto_emergencia: document.getElementById("f-contacto-emergencia").value.trim()
      }, sessao.userId);
      mostrarForm = false;
      SAVI_toast("Paciente registado. Preencha os dados clínicos e solicite uma pulseira.");
      render();
    });
  }

  render();
}
