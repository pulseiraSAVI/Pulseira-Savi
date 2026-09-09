/* router.js
 * Router simples por hash, com guarda de rota por papel.
 * Rotas:
 *   #/login-profissional
 *   #/login-familia
 *   #/scan
 *   #/nivel1/:pulseiraId
 *   #/erro/:tipo
 *   #/familia/pacientes
 *   #/familia/paciente/:id
 *   #/admin/dashboard
 *   #/admin/pacientes
 *   #/admin/nivel1/:pacienteId
 *   #/admin/tokens
 *   #/admin/profissionais
 *   #/admin/auditoria
 */
(function (global) {
  "use strict";

  var appEl = null;

  function parseHash() {
    var hash = global.location.hash || "#/";
    hash = hash.replace(/^#/, "");
    var parts = hash.split("/").filter(Boolean);
    return parts;
  }

  function papelPermitido(rota, sessao) {
    if (!sessao) return false;
    if (rota.indexOf("familia") === 0) return sessao.papel === "familia";
    if (rota.indexOf("admin") === 0) return sessao.papel === "admin";
    if (rota === "scan" || rota === "nivel1") return sessao.papel === "profissional" || sessao.papel === "admin";
    return true;
  }

  function render() {
    var parts = parseHash();
    var sessao = authSim.getSessao();

    if (parts.length === 0) {
      parts = ["login-profissional"];
    }

    var rota = parts[0];
    var rotasPublicas = ["login-profissional", "login-familia", "erro"];

    if (rotasPublicas.indexOf(rota) === -1 && !sessao) {
      global.location.hash = "#/login-profissional";
      return;
    }

    if (rotasPublicas.indexOf(rota) === -1 && !papelPermitido(rota, sessao)) {
      global.location.hash = "#/erro/acesso_negado";
      return;
    }

    appEl.innerHTML = "";

    switch (rota) {
      case "login-profissional":
        viewLoginProfissional(appEl);
        break;
      case "login-familia":
        viewLoginFamilia(appEl);
        break;
      case "scan":
        viewScan(appEl);
        break;
      case "nivel1":
        viewResultadoNivel1(appEl, parts[1]);
        break;
      case "erro":
        viewErro(appEl, parts[1]);
        break;
      case "familia":
        if (parts[1] === "paciente" && parts[2]) {
          viewFamiliaPacienteDetalhe(appEl, parts[2]);
        } else {
          viewFamiliaPacientes(appEl);
        }
        break;
      case "admin":
        renderAdmin(appEl, parts.slice(1), sessao);
        break;
      default:
        global.location.hash = sessao ? (sessao.papel === "familia" ? "#/familia/pacientes" : (sessao.papel === "admin" ? "#/admin/dashboard" : "#/scan")) : "#/login-profissional";
    }
  }

  function renderAdmin(el, parts, sessao) {
    var sub = parts[0] || "dashboard";
    switch (sub) {
      case "dashboard": viewAdminDashboard(el); break;
      case "pacientes": viewAdminPacientes(el); break;
      case "nivel1": viewAdminNivel1Form(el, parts[1]); break;
      case "tokens": viewAdminTokens(el); break;
      case "profissionais": viewAdminProfissionais(el); break;
      case "auditoria":
        if (!sessao.funcao_auditor) {
          global.location.hash = "#/erro/acesso_negado";
          return;
        }
        viewAdminAuditoria(el);
        break;
      default: viewAdminDashboard(el);
    }
  }

  global.SAVI_router = {
    init: function (rootEl) {
      appEl = rootEl;
      global.addEventListener("hashchange", render);
      render();
    },
    navegar: function (hash) {
      global.location.hash = hash;
    },
    rerender: render
  };

  // Redireciona automaticamente para o ecrã de "sessão expirada" quando o
  // temporizador de inatividade dispara — e repete o scan após novo login
  // (o próprio ecrã de scan trata da repetição, ver views/scan.js).
  authSim.onExpirar(function (papelAntigo) {
    global.SAVI_lastPapelAntesDeExpirar = papelAntigo;
    global.location.hash = "#/erro/sessao_expirada";
    render();
  });
})(window);
