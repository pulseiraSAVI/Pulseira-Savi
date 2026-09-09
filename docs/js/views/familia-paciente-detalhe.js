/* views/familia-paciente-detalhe.js
 * Contacto/morada, gestão da pulseira (revogar), privacidade/histórico de
 * acessos, e pedido de eliminação (art. 17º RGPD). Leitura de dados_nivel1
 * (só leitura, nunca escrita) para a família.
 */
function viewFamiliaPacienteDetalhe(root, pacienteId) {
  "use strict";

  var sessao = authSim.getSessao();

  if (!mockdb.familiaTemAcessoPaciente(sessao.contaFamiliaId, pacienteId)) {
    SAVI_router.navegar("#/erro/acesso_negado");
    return;
  }

  function render() {
    var paciente = mockdb.getPaciente(pacienteId);
    var dados = mockdb.getDadosNivel1(pacienteId) || {};
    var pulseiras = mockdb.listPulseirasDoPaciente(pacienteId);
    var acessos = mockdb.listAcessosDoPaciente(pacienteId);
    var idade = mockdb.calcularIdade(paciente.data_nascimento);

    root.innerHTML =
      '<div class="app-topbar">' +
      '<div class="brand">SAVI <small>Área da família</small></div>' +
      '<div class="user-info">' + sessao.nome + ' <button class="logout" id="btn-sair">Terminar sessão</button></div>' +
      "</div>" +
      '<div class="page">' +
      '<button class="link-discreto" id="btn-voltar" style="margin-bottom:10px;">← Os meus pacientes</button>' +
      "<h1>" + paciente.nome + "</h1>" +
      '<p class="subtitle">' + idade + ' anos · consentimento: <span class="badge ' + paciente.estado_consentimento + '">' + paciente.estado_consentimento + "</span></p>" +

      '<div class="grid-2">' +
      '<div>' +
      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">Contacto de emergência</h3>' +
      '<label>Contacto</label><input type="text" id="f-contacto" value="' + (paciente.contacto_emergencia || "") + '">' +
      '<button class="btn btn-primary btn-sm" id="btn-guardar-contacto" style="margin-top:10px;">Guardar</button>' +
      "</div>" +

      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">Dados clínicos (só leitura)</h3>' +
      '<p class="field-hint">Estes dados são escritos e verificados exclusivamente pela equipa clínica.</p>' +
      '<p class="card-sub"><b>Alergias:</b> ' + (dados.alergias || "—") + "</p>" +
      '<p class="card-sub"><b>Grupo sanguíneo:</b> ' + (dados.grupo_sanguineo || "—") + "</p>" +
      '<p class="card-sub"><b>Diagnósticos ativos:</b> ' + (dados.diagnosticos_ativos || "—") + "</p>" +
      '<p class="card-sub"><b>Medicação crónica:</b> ' + (dados.medicacao_cronica || "—") + "</p>" +
      '<p class="card-sub"><b>Estado de verificação:</b> <span class="badge ' + dados.estado_verificacao + '">' + dados.estado_verificacao + "</span></p>" +
      "</div>" +

      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">Pedido de eliminação (art. 17º RGPD)</h3>' +
      '<p class="field-hint">Solicite a eliminação dos dados deste paciente. O pedido fica registado para tratamento pela equipa administradora/DPO.</p>' +
      '<textarea id="f-motivo-eliminacao" placeholder="Motivo (opcional)"></textarea>' +
      '<button class="btn btn-danger btn-sm" id="btn-pedir-eliminacao" style="margin-top:10px;">Pedir eliminação de dados</button>' +
      "</div>" +
      "</div>" +

      '<div>' +
      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">Pulseira(s)</h3>' +
      '<div id="lista-pulseiras"></div>' +
      "</div>" +

      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">Histórico de acessos</h3>' +
      '<p class="field-hint">Todos os acessos de emergência à pulseira ficam aqui registados, incluindo os negados.</p>' +
      '<div id="lista-acessos"></div>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>";

    document.getElementById("btn-sair").addEventListener("click", function () {
      authSim.logout();
      SAVI_router.navegar("#/login-familia");
    });
    document.getElementById("btn-voltar").addEventListener("click", function () {
      SAVI_router.navegar("#/familia/pacientes");
    });
    document.getElementById("btn-guardar-contacto").addEventListener("click", function () {
      var valor = document.getElementById("f-contacto").value.trim();
      mockdb.atualizarContactoPaciente(pacienteId, { contacto_emergencia: valor });
      SAVI_toast("Contacto atualizado.");
      render();
    });
    document.getElementById("btn-pedir-eliminacao").addEventListener("click", function () {
      var motivo = document.getElementById("f-motivo-eliminacao").value.trim();
      if (!confirm("Confirma o pedido de eliminação de dados deste paciente? Esta ação fica registada e será tratada pela equipa administradora.")) return;
      mockdb.pedirEliminacao(pacienteId, sessao.contaFamiliaId, motivo);
      SAVI_toast("Pedido de eliminação registado. A equipa administradora irá processá-lo.");
    });

    var pulseirasEl = document.getElementById("lista-pulseiras");
    if (pulseiras.length === 0) {
      pulseirasEl.innerHTML = '<div class="empty-state">Sem pulseira atribuída.</div>';
    } else {
      pulseiras.forEach(function (p) {
        var div = document.createElement("div");
        div.style.marginBottom = "10px";
        div.innerHTML =
          '<p class="card-sub"><b>Token:</b> ' + p.token + " · <span class=\"badge " + p.estado + '">' + p.estado + "</span></p>";
        if (p.estado === "ativa") {
          var btn = document.createElement("button");
          btn.className = "btn btn-danger btn-sm";
          btn.textContent = "Revogar pulseira";
          btn.addEventListener("click", function () {
            if (!confirm("Confirma a revogação desta pulseira? Deixará de dar acesso de emergência aos dados clínicos.")) return;
            mockdb.desativarPulseira(p.id, "Revogada pela família via app.", "familia");
            SAVI_toast("Pulseira revogada.");
            render();
          });
          div.appendChild(btn);
        }
        pulseirasEl.appendChild(div);
      });
    }

    var acessosEl = document.getElementById("lista-acessos");
    if (acessos.length === 0) {
      acessosEl.innerHTML = '<div class="empty-state">Sem acessos registados.</div>';
    } else {
      var tbl = document.createElement("table");
      tbl.innerHTML = "<thead><tr><th>Data</th><th>Nível</th><th>Serviço</th></tr></thead>";
      var tbody = document.createElement("tbody");
      acessos.forEach(function (a) {
        var tr = document.createElement("tr");
        var d = new Date(a.acedido_em);
        tr.innerHTML = "<td>" + d.toLocaleString("pt-PT") + "</td><td><span class=\"badge neutro\">" + a.nivel_acedido + "</span></td><td>" + (a.servico || "—") + "</td>";
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      acessosEl.appendChild(tbl);
    }
  }

  render();
}
