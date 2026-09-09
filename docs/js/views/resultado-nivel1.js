/* views/resultado-nivel1.js
 * Ecrã mais crítico do projeto — resultado do scan (Nível 1), com modal de
 * Nível 2 embutido. Visual baseado fielmente no mockup de referência
 * savi_mockup_nivel1.html, mas com dados reais vindos do workerSim
 * (nunca estático) e ligado ao fluxo real de login → scan.
 */
function viewResultadoNivel1(root, pulseiraId) {
  "use strict";

  var sessao = authSim.getSessao();
  var resultado = window.SAVI_ultimoScan;

  if (!resultado || resultado.pulseira.id !== pulseiraId) {
    // Acesso direto ao URL sem passar pelo scan: repete o scan pelo token da pulseira.
    var pulseira = mockdb.getPulseira(pulseiraId);
    if (!pulseira) {
      SAVI_router.navegar("#/scan");
      return;
    }
    try {
      resultado = workerSim.scan({ token: pulseira.token, profissionalId: sessao.userId, servico: sessao.servico || "Urgência" });
      window.SAVI_ultimoScan = resultado;
    } catch (e) {
      SAVI_router.navegar("#/erro/" + (e.tipo || "erro"));
      return;
    }
  }

  var paciente = resultado.paciente;
  var dados = resultado.dados || {};
  var verif = dados.verificacoes_campo || {};

  function fmtData(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function verifBadge(campo) {
    var v = verif[campo];
    if (!v) return "";
    if (v.estado === "verificado") {
      return '<span class="verif ok"><span class="dot"></span>Confirmado' + (v.por ? " por " + v.por : "") + " · " + fmtData(v.em) + "</span>";
    }
    return '<span class="verif pending"><span class="dot"></span>Não verificado desde ' + fmtData(v.em) + "</span>";
  }

  function linhaCrise() {
    var extras = [];
    if (dados.limitacao_terapeutica && dados.limitacao_terapeutica !== "nao_aplicavel") {
      extras.push("Limitação terapêutica: " + (dados.limitacao_terapeutica === "sim" ? "SIM — contactar hospital de referência antes de decisões de limitação" : "Não"));
    }
    if (dados.ventilacao_invasiva === "sim") extras.push("Ventilação invasiva: sim");
    if (dados.vni === "sim") extras.push("VNI: sim");
    if (dados.tecnicas_dialiticas === "sim") extras.push("Técnicas dialíticas: sim");
    var extrasHtml = extras.length ? '<p class="card-sub">' + extras.join(" · ") + "</p>" : "";
    var hospitalHtml = dados.hospital_referencia
      ? '<p class="card-sub">Hospital de referência: ' + dados.hospital_referencia + (dados.hospital_referencia_contacto ? " · " + dados.hospital_referencia_contacto : "") + "</p>"
      : "";
    return extrasHtml + hospitalHtml;
  }

  root.innerHTML =
    '<div class="phone-stage"><div class="phone"><div class="screen">' +
    '<div class="topbar">' +
    '<div class="eyebrow"><span>SAVI</span><span id="clock"></span></div>' +
    '<div class="patient-row"><span class="name">' + paciente.nome + '</span><span class="age">' + resultado.idade + " anos</span></div>" +
    '<div class="meta">Lido agora · Serviço: ' + (sessao.servico || "Urgência") + "</div>" +
    "</div>" +
    '<div class="scroll">' +

    '<div class="card">' +
    '<p class="card-label">Biometria</p>' +
    '<p class="card-value">' + (dados.peso_kg ? dados.peso_kg + " kg" : "peso não registado") + ' · ' + (dados.altura_cm ? dados.altura_cm + " cm" : "altura não registada") + "</p>" +
    '<p class="card-sub">Registado em ' + fmtData(dados.biometria_registada_em) + "</p>" +
    "</div>" +

    '<div class="card alert">' +
    '<p class="card-label">⚠ Alergias</p>' +
    '<p class="card-value">' + (dados.alergias || "Sem registo") + "</p>" +
    verifBadge("alergias") +
    "</div>" +

    '<div class="card crisis">' +
    '<p class="card-label">✦ Esquema de atuação perante crise</p>' +
    '<p class="card-value">' + (dados.esquema_atuacao_crise || "Sem esquema registado") + "</p>" +
    linhaCrise() +
    verifBadge("esquema_atuacao_crise") +
    "</div>" +

    '<div class="row2" style="margin-bottom:10px;">' +
    '<div class="card"><p class="card-label">Grupo sanguíneo</p><p class="card-value">' + (dados.grupo_sanguineo || "—") + "</p></div>" +
    '<div class="card"><p class="card-label">Condição crítica</p><p class="card-value">' + (dados.diagnosticos_ativos || "—") + "</p></div>" +
    "</div>" +

    '<div class="card">' +
    '<p class="card-label">Fármacos contraindicados</p>' +
    '<p class="card-value">' + (dados.farmacos_contraindicados || "Sem registo") + "</p>" +
    verifBadge("farmacos_contraindicados") +
    "</div>" +

    '<div class="card">' +
    '<p class="card-label">Medicação crónica ativa</p>' +
    '<p class="card-value">' + (dados.medicacao_cronica || "Sem registo") + "</p>" +
    verifBadge("medicacao_cronica") +
    "</div>" +

    '<div class="card">' +
    '<p class="card-label">Calendário vacinal</p>' +
    '<p class="card-value">' + (dados.vacinas || "Sem registo") + "</p>" +
    verifBadge("vacinas") +
    "</div>" +

    '<div class="section-title">Contacto de emergência</div>' +
    '<div class="contact-card">' +
    '<div><div class="who">Contacto</div><div class="name">' + (paciente.contacto_emergencia || "Sem contacto registado") + "</div></div>" +
    '<button class="call-btn" id="btn-ligar">📞 Ligar</button>' +
    "</div>" +

    '<button class="n2-link" id="btn-nivel2"><b>Aceder a histórico completo</b> — requer motivo (Nível 2)</button>' +

    '<div style="margin-top:16px;text-align:center;">' +
    '<button class="link-discreto" id="btn-nova-leitura">← Nova leitura</button>' +
    "</div>" +

    "</div>" +

    '<div class="modal-overlay" id="modal">' +
    '<div class="modal" id="modal-inner">' +
    "<h3>Acesso a Nível 2</h3>" +
    '<p>Indique o motivo clínico do acesso ao histórico completo. Este pedido fica registado com a sua identificação, data e hora.</p>' +
    '<textarea id="motivo" placeholder="Ex.: avaliar internamentos prévios por convulsão febril..."></textarea>' +
    '<div class="modal-actions">' +
    '<button class="btn-cancel" id="btn-cancelar-n2" style="flex:1;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;background:#EEEBE3;color:var(--ink-soft);">Cancelar</button>' +
    '<button class="btn-confirm" id="btn-confirmar-n2" disabled style="flex:1;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--navy);color:#fff;">Confirmar acesso</button>' +
    "</div></div></div>" +

    "</div></div></div>";

  function tick() {
    var d = new Date();
    var el = document.getElementById("clock");
    if (el) el.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  tick();

  document.getElementById("btn-ligar").addEventListener("click", function (ev) {
    ev.stopPropagation();
    alert("A ligar para: " + (paciente.contacto_emergencia || "sem contacto registado") + " (simulado).");
  });

  document.getElementById("btn-nova-leitura").addEventListener("click", function () {
    SAVI_router.navegar("#/scan");
  });

  document.getElementById("btn-nivel2").addEventListener("click", function () {
    document.getElementById("modal").classList.add("open");
  });
  document.getElementById("btn-cancelar-n2").addEventListener("click", function () {
    document.getElementById("modal").classList.remove("open");
  });

  var motivoEl = document.getElementById("motivo");
  var confirmarBtn = document.getElementById("btn-confirmar-n2");
  motivoEl.addEventListener("input", function () {
    confirmarBtn.disabled = motivoEl.value.trim().length === 0;
  });

  confirmarBtn.addEventListener("click", function () {
    var motivo = motivoEl.value.trim();
    try {
      var respostaN2 = workerSim.pedirNivel2({
        pulseiraId: resultado.pulseira.id,
        profissionalId: sessao.userId,
        servico: sessao.servico || "Urgência",
        motivo: motivo
      });
      document.getElementById("modal-inner").innerHTML =
        "<h3>Acesso registado</h3>" +
        '<p>A consultar referência do sistema clínico do hospital:</p>' +
        '<p style="font-weight:700;color:var(--navy);">' + respostaN2.referencia_sistema_ext + "</p>" +
        '<p style="font-size:11.5px;">Este é apenas um apontador ao processo do hospital — não uma cópia do histórico clínico completo. Consulte o RSE/SPMS para o registo integral.</p>' +
        '<button class="btn-confirm" style="width:100%;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--navy);color:#fff;" id="btn-fechar-n2">Fechar</button>';
      document.getElementById("btn-fechar-n2").addEventListener("click", function () {
        document.getElementById("modal").classList.remove("open");
      });
    } catch (e) {
      if (e.tipo === "sessao_expirada") {
        SAVI_router.navegar("#/erro/sessao_expirada");
      } else {
        alert(e.message);
      }
    }
  });
}
