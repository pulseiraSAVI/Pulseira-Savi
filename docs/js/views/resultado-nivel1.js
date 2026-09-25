/* views/resultado-nivel1.js
 * Ecrã mais crítico do projeto — resultado do acesso de break-glass
 * (Nível 1). Estrutura nova (pivô de 15/09/2026): cabeçalho fixo +
 * 4 secções no menu de footer (Dados do utente / Algoritmo / Medicação
 * Habitual / Configuração). NÍVEL 2 NÃO EXISTE — não há nenhum botão,
 * modal, ou lógica de "aceder a histórico completo" aqui.
 *
 * Não suporta acesso direto por URL sem passar por um dos 3 métodos —
 * depende sempre de `window.SAVI_ultimoAcesso`, preenchido pelas views
 * utilizador-pulseira.js / utilizador-numero-utente.js /
 * utilizador-identidade.js. Isto evita repetir silenciosamente um
 * acesso por identidade (que exige motivo) só porque a página foi
 * recarregada.
 */
function viewResultadoNivel1(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var resultado = window.SAVI_ultimoAcesso;

  if (!resultado) {
    SAVI_router.navegar("#/utilizador/metodo");
    return;
  }

  var paciente = resultado.paciente;
  var dados = resultado.dados || {};
  var documentos = resultado.documentos || [];
  var abaAtiva = "utente";
  var relogioInterval = null;

  var SW_VERSION_APP = "v2.0.0";

  function nomeCabecalho(nomeCompleto) {
    var partes = (nomeCompleto || "").trim().split(/\s+/);
    if (partes.length <= 2) return nomeCompleto;
    return partes[0] + " " + partes[partes.length - 1];
  }

  function fmtDataCurta(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }

  function verifBadge() {
    if (dados.estado_verificacao === "verificado") {
      return '<span class="verif ok"><span class="dot"></span>Registo clínico confirmado' + (dados.verificado_em ? " · " + fmtDataCurta(dados.verificado_em) : "") + "</span>";
    }
    return '<span class="verif pending"><span class="dot"></span>Registo clínico não verificado</span>';
  }

  function tick() {
    var d = new Date();
    var el = document.getElementById("clock");
    if (el) el.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // ---------------------------------------------------------------
  // Conteúdo de cada separador
  // ---------------------------------------------------------------

  function conteudoUtente() {
    var gestor = paciente.gestor_do_caso || {};
    return (
      '<div class="card">' +
      '<p class="card-label">Identificação</p>' +
      '<p class="card-value">' + paciente.nome + "</p>" +
      '<p class="card-sub">Nº de utente: ' + (paciente.numero_utente || "—") + "</p>" +
      '<p class="card-sub">Morada: ' + (paciente.morada || "—") + "</p>" +
      "</div>" +

      '<div class="section-title">Contacto de familiares</div>' +
      '<div class="contact-card">' +
      '<div><div class="who">Familiares</div><div class="name">' + (paciente.contacto_familia || "Sem contacto registado") + "</div></div>" +
      '<button class="call-btn" id="btn-ligar-familia">' + SAVI_ICONS.telefone() + " Ligar</button>" +
      "</div>" +

      '<div class="section-title">Contacto de emergência</div>' +
      '<div class="contact-card">' +
      '<div><div class="who">Emergência</div><div class="name">' + (paciente.contacto_emergencia || "Sem contacto registado") + "</div></div>" +
      '<button class="call-btn" id="btn-ligar-emergencia">' + SAVI_ICONS.telefone() + " Ligar</button>" +
      "</div>" +

      '<div class="section-title">Gestor do caso</div>' +
      '<div class="card">' +
      '<p class="card-value">' + (gestor.nome || "Sem gestor do caso registado") + "</p>" +
      (gestor.especialidade ? '<p class="card-sub">' + gestor.especialidade + "</p>" : "") +
      (gestor.credencial_ordem ? '<p class="card-sub">Nº de Ordem: ' + gestor.credencial_ordem + "</p>" : "") +
      (gestor.instituicao_servico ? '<p class="card-sub">' + gestor.instituicao_servico + "</p>" : "") +
      (gestor.telefone_institucional ? '<p class="card-sub">Tel.: ' + gestor.telefone_institucional + "</p>" : "") +
      "</div>"
    );
  }

  function conteudoAlgoritmo() {
    return (
      '<div class="card alert">' +
      '<p class="card-label">' + SAVI_ICONS.alergia() + " Alergias</p>" +
      '<p class="card-value">' + (dados.alergias || "Sem registo") + "</p>" +
      "</div>" +

      '<div class="card">' +
      '<p class="card-label">Biometria</p>' +
      '<p class="card-value">' + (dados.peso_kg ? dados.peso_kg + " kg" : "peso não registado") + " · " + (dados.altura_cm ? dados.altura_cm + " cm" : "altura não registada") + "</p>" +
      '<p class="card-sub">Registado em ' + fmtDataCurta(dados.biometria_registada_em) + "</p>" +
      "</div>" +

      '<div class="card crisis">' +
      '<p class="card-label">' + SAVI_ICONS.condicaoCritica() + " Condição crítica</p>" +
      '<p class="card-value">' + (dados.condicao_critica || "Sem registo") + "</p>" +
      (dados.esquema_atuacao_crise ? '<p class="card-sub"><b>Esquema de atuação perante crise:</b> ' + dados.esquema_atuacao_crise + "</p>" : "") +
      "</div>" +

      '<div class="card">' +
      '<p class="card-label">Esquema de dose</p>' +
      '<p class="card-value">' + (dados.esquema_dose || "Sem registo") + "</p>" +
      "</div>" +

      '<div class="card">' +
      '<p class="card-label">Medicação contraindicada</p>' +
      '<p class="card-value">' + (dados.medicacao_contraindicada || "Sem registo") + "</p>" +
      "</div>" +

      '<div class="card">' +
      '<p class="card-label">Limitação terapêutica</p>' +
      '<p class="card-value">' + rotuloLimitacao(dados.limitacao_terapeutica) + "</p>" +
      (dados.limitacao_terapeutica === "sim" ? '<p class="card-sub">Contactar o gestor do caso/hospital de referência antes de decisões de limitação.</p>' : "") +
      "</div>" +

      '<div class="card">' +
      '<p class="card-label">Notas</p>' +
      '<p class="card-value">' + (dados.notas || "Sem notas adicionais.") + "</p>" +
      "</div>" +

      '<div style="text-align:center;margin-top:6px;">' + verifBadge() + "</div>"
    );
  }

  function rotuloLimitacao(v) {
    if (v === "sim") return "Sim";
    if (v === "nao") return "Não";
    return "Não aplicável";
  }

  function iconeDocumento(tipo) {
    if (tipo === "rgpd") return SAVI_ICONS.documentoRgpd();
    if (tipo === "termo_responsabilidade") return SAVI_ICONS.documentoTermo();
    return SAVI_ICONS.documentoOutro();
  }

  function conteudoMedicacao() {
    var listaDocs = documentos.length
      ? documentos.map(function (d) {
          return '<div class="doc-item"><span class="doc-icon">' + iconeDocumento(d.tipo) + '</span><div class="doc-info"><div class="doc-nome">' + d.nome_ficheiro + '</div><div class="doc-meta">' + rotuloTipoDocumento(d.tipo) + " · " + fmtDataCurta(d.enviado_em) + "</div></div></div>";
        }).join("")
      : '<div class="empty-state">Sem documentos digitalizados.</div>';

    return (
      '<div class="card">' +
      '<p class="card-label">Medicação crónica e horário habitual</p>' +
      '<p class="card-value">' + (dados.medicacao_cronica || "Sem registo") + "</p>" +
      "</div>" +
      '<div class="section-title">Documentos (RGPD e termo de responsabilidade)</div>' +
      '<div class="doc-list">' + listaDocs + "</div>"
    );
  }

  function rotuloTipoDocumento(tipo) {
    if (tipo === "rgpd") return "Consentimento RGPD";
    if (tipo === "termo_responsabilidade") return "Termo de responsabilidade";
    return "Documento";
  }

  function conteudoConfiguracao() {
    return (
      '<div class="card">' +
      '<p class="card-label">Sessão atual</p>' +
      '<p class="card-value">' + sessao.nome + "</p>" +
      '<p class="card-sub">Nº de Ordem: ' + sessao.credencial + "</p>" +
      '<p class="card-sub">Serviço: ' + (sessao.servico || "—") + "</p>" +
      "</div>" +
      '<div class="card">' +
      '<p class="card-label">Versão da aplicação</p>' +
      '<p class="card-value">SAVI ' + SW_VERSION_APP + "</p>" +
      "</div>" +
      '<div class="card">' +
      '<p class="card-label">Suporte / feedback</p>' +
      '<p class="card-value"><a href="mailto:suporte@savi-piloto.pt">suporte@savi-piloto.pt</a></p>' +
      "</div>" +
      '<div style="text-align:center;margin-top:16px;">' +
      '<button class="link-discreto" id="btn-terminar-sessao">Terminar sessão</button>' +
      "</div>"
    );
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  function render() {
    var superficie = mockdb.calcularSuperficieCorporal(dados.altura_cm, dados.peso_kg);

    root.innerHTML =
      '<div class="phone-stage"><div class="phone"><div class="screen">' +
      '<div class="topbar">' +
      '<div class="eyebrow"><span>SAVI · Nível 1</span><span id="clock"></span></div>' +
      '<div class="patient-row"><span class="name">' + nomeCabecalho(paciente.nome) + "</span></div>" +
      '<div class="meta">' + mockdb.formatarIdade(paciente.data_nascimento) +
      " · " + (dados.peso_kg ? dados.peso_kg + " kg" : "peso —") +
      " · " + (dados.altura_cm ? dados.altura_cm + " cm" : "altura —") +
      " · SC " + (superficie ? superficie.toFixed(2) + " m²" : "—") +
      "</div>" +
      "</div>" +
      '<div class="scroll" id="tab-content"></div>' +
      '<div class="footer-nav">' +
      footerBtn("utente", "Dados do utente", SAVI_ICONS.dadosUtente()) +
      footerBtn("algoritmo", "Algoritmo", SAVI_ICONS.algoritmo()) +
      footerBtn("medicacao", "Medicação Habitual", SAVI_ICONS.medicacaoHabitual()) +
      footerBtn("config", "Configuração", SAVI_ICONS.configuracao()) +
      "</div>" +
      "</div></div></div>";

    renderConteudoAba();
    tick();
    if (relogioInterval) clearInterval(relogioInterval);
    relogioInterval = setInterval(tick, 15000);

    Array.prototype.forEach.call(document.querySelectorAll(".footer-nav-item"), function (btn) {
      btn.addEventListener("click", function () {
        abaAtiva = btn.getAttribute("data-aba");
        render();
      });
    });
  }

  function footerBtn(chave, label, icone) {
    return (
      '<button class="footer-nav-item' + (abaAtiva === chave ? " active" : "") + '" data-aba="' + chave + '">' +
      '<span class="footer-nav-icon">' + icone + "</span>" +
      '<span class="footer-nav-label">' + label + "</span>" +
      "</button>"
    );
  }

  function renderConteudoAba() {
    var el = document.getElementById("tab-content");
    if (abaAtiva === "utente") el.innerHTML = conteudoUtente();
    else if (abaAtiva === "algoritmo") el.innerHTML = conteudoAlgoritmo();
    else if (abaAtiva === "medicacao") el.innerHTML = conteudoMedicacao();
    else el.innerHTML = conteudoConfiguracao();

    if (abaAtiva === "utente") {
      var btnFam = document.getElementById("btn-ligar-familia");
      if (btnFam) btnFam.addEventListener("click", function () {
        alert("A ligar para: " + (paciente.contacto_familia || "sem contacto registado") + " (simulado).");
      });
      var btnEmerg = document.getElementById("btn-ligar-emergencia");
      if (btnEmerg) btnEmerg.addEventListener("click", function () {
        alert("A ligar para: " + (paciente.contacto_emergencia || "sem contacto registado") + " (simulado).");
      });
    }
    if (abaAtiva === "config") {
      var btnSair = document.getElementById("btn-terminar-sessao");
      if (btnSair) btnSair.addEventListener("click", function () {
        authSim.logout();
        window.SAVI_ultimoAcesso = null;
        SAVI_router.navegar("#/identificacao");
      });
    }
  }

  render();
}
