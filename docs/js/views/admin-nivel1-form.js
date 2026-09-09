/* views/admin-nivel1-form.js
 * Edição clínica (dados_nivel1) com escrito_por_id/escrito_em automáticos
 * + ação "Verificar". Escrita reservada a profissional/admin (aplicado em
 * mockdb.escreverDadosNivel1 / verificarDadosNivel1).
 */
function viewAdminNivel1Form(root, pacienteId) {
  "use strict";

  var sessao = authSim.getSessao();
  var autor = { id: sessao.userId, papel: sessao.papel };

  function render() {
    var paciente = mockdb.getPaciente(pacienteId);
    if (!paciente) { SAVI_router.navegar("#/admin/pacientes"); return; }
    var dados = mockdb.getDadosNivel1(pacienteId) || {};

    root.innerHTML = adminNav(sessao, "pacientes") +
      '<div class="page">' +
      '<button class="link-discreto" id="btn-voltar" style="margin-bottom:10px;">← Pacientes</button>' +
      "<h1>Dados clínicos — " + paciente.nome + "</h1>" +
      '<p class="subtitle">Nível 1. Estado atual: <span class="badge ' + (dados.estado_verificacao || "nao_verificado") + '">' + (dados.estado_verificacao || "nao_verificado") + "</span>" +
      (dados.escrito_em ? " · última escrita em " + new Date(dados.escrito_em).toLocaleString("pt-PT") : "") +
      "</p>" +

      '<div class="grid-2">' +
      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">Biometria e identificação clínica</h3>' +
      '<label>Peso (kg)</label><input type="number" step="0.1" id="f-peso" value="' + (dados.peso_kg ?? "") + '">' +
      '<label>Altura (cm)</label><input type="number" step="0.1" id="f-altura" value="' + (dados.altura_cm ?? "") + '">' +
      '<label>Data de registo biometria</label><input type="date" id="f-biom-data" value="' + (dados.biometria_registada_em || "") + '">' +
      '<label>Alergias</label><textarea id="f-alergias">' + (dados.alergias || "") + "</textarea>" +
      '<label>Grupo sanguíneo</label><input type="text" id="f-grupo" value="' + (dados.grupo_sanguineo || "") + '" placeholder="Ex.: O Rh+">' +
      "</div>" +

      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">1) Diagnósticos ativos</h3>' +
      '<label>Diagnósticos (ICD-10 quando possível)</label><textarea id="f-diagnosticos">' + (dados.diagnosticos_ativos || "") + "</textarea>" +
      "<h3 style=\"font-size:14px;color:var(--navy);\">2) Terapêutica</h3>" +
      '<label>Terapêutica (com esquema de horas)</label><textarea id="f-terapeutica">' + (dados.terapeutica || "") + "</textarea>" +
      '<label>Medicação crónica ativa</label><textarea id="f-medicacao">' + (dados.medicacao_cronica || "") + "</textarea>" +
      '<label>Fármacos contraindicados</label><textarea id="f-farmacos-contra">' + (dados.farmacos_contraindicados || "") + "</textarea>" +
      "</div>" +
      "</div>" +

      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">3) Esquema de atuação perante crise</h3>' +
      '<label>Texto livre — risco de descompensação e recomendações</label><textarea id="f-crise">' + (dados.esquema_atuacao_crise || "") + "</textarea>" +
      '<div class="grid-3">' +
      selectField("f-limitacao", "Limitação terapêutica", dados.limitacao_terapeutica, ["sim", "nao", "nao_aplicavel"]) +
      selectField("f-vi", "Ventilação invasiva", dados.ventilacao_invasiva, ["sim", "nao"]) +
      selectField("f-vni", "VNI", dados.vni, ["sim", "nao"]) +
      "</div>" +
      selectField("f-dialise", "Técnicas dialíticas", dados.tecnicas_dialiticas, ["sim", "nao"]) +
      '<label>Hospital de referência</label><input type="text" id="f-hosp" value="' + (dados.hospital_referencia || "") + '">' +
      '<label>Contacto do hospital de referência</label><input type="text" id="f-hosp-contacto" value="' + (dados.hospital_referencia_contacto || "") + '">' +
      "</div>" +

      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">Calendário vacinal</h3>' +
      '<textarea id="f-vacinas">' + (dados.vacinas || "") + "</textarea>" +
      "</div>" +

      '<div style="display:flex;gap:10px;margin-top:10px;">' +
      '<button class="btn btn-primary" id="btn-guardar">Guardar alterações</button>' +
      '<button class="btn btn-ok" id="btn-verificar">Verificar registo</button>' +
      "</div>" +
      "</div>";

    document.getElementById("btn-voltar").addEventListener("click", function () {
      SAVI_router.navegar("#/admin/pacientes");
    });

    document.getElementById("btn-guardar").addEventListener("click", function () {
      var campos = {
        peso_kg: parseFloat(document.getElementById("f-peso").value) || null,
        altura_cm: parseFloat(document.getElementById("f-altura").value) || null,
        biometria_registada_em: document.getElementById("f-biom-data").value || null,
        alergias: document.getElementById("f-alergias").value,
        grupo_sanguineo: document.getElementById("f-grupo").value,
        diagnosticos_ativos: document.getElementById("f-diagnosticos").value,
        terapeutica: document.getElementById("f-terapeutica").value,
        medicacao_cronica: document.getElementById("f-medicacao").value,
        farmacos_contraindicados: document.getElementById("f-farmacos-contra").value,
        esquema_atuacao_crise: document.getElementById("f-crise").value,
        limitacao_terapeutica: document.getElementById("f-limitacao").value,
        ventilacao_invasiva: document.getElementById("f-vi").value,
        vni: document.getElementById("f-vni").value,
        tecnicas_dialiticas: document.getElementById("f-dialise").value,
        hospital_referencia: document.getElementById("f-hosp").value,
        hospital_referencia_contacto: document.getElementById("f-hosp-contacto").value,
        vacinas: document.getElementById("f-vacinas").value
      };
      try {
        mockdb.escreverDadosNivel1(pacienteId, campos, autor);
        SAVI_toast("Dados clínicos guardados. Estado de verificação reposto para 'não verificado'.");
        render();
      } catch (e) {
        alert(e.message);
      }
    });

    document.getElementById("btn-verificar").addEventListener("click", function () {
      try {
        mockdb.verificarDadosNivel1(pacienteId, autor);
        SAVI_toast("Registo clínico marcado como verificado.");
        render();
      } catch (e) {
        alert(e.message);
      }
    });
  }

  function selectField(id, label, valor, opcoes) {
    var html = '<div><label>' + label + '</label><select id="' + id + '">';
    opcoes.forEach(function (o) {
      html += '<option value="' + o + '"' + (valor === o ? " selected" : "") + ">" + o + "</option>";
    });
    html += "</select></div>";
    return html;
  }

  render();
}
