/* router.js
 * Router simples por hash, com guarda de rota por papel ativo da sessão.
 * Pivô de produção (15/09/2026) — família suspensa (sem rotas), Nível 2
 * eliminado (sem rota). Rotas:
 *   #/identificacao
 *   #/escolha-papel
 *   #/utilizador/metodo
 *   #/utilizador/pulseira
 *   #/utilizador/numero-utente
 *   #/utilizador/identidade
 *   #/nivel1/resultado
 *   #/profissional/pacientes
 *   #/profissional/nivel1/:pacienteId
 *   #/admin/dashboard
 *   #/admin/pacientes
 *   #/admin/nivel1/:pacienteId
 *   #/admin/tokens
 *   #/admin/contas
 *   #/admin/auditoria
 *   #/erro/:tipo
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

  function homeParaSessao(sessao) {
    if (!sessao) return "#/identificacao";
    if (sessao.papelAtivo === "superadmin") return "#/admin/dashboard";
    if (sessao.papelAtivo === "profissional") return "#/profissional/pacientes";
    return "#/utilizador/metodo";
  }

  function papelPermitido(rota, sessao) {
    if (!sessao) return false;
    if (rota === "utilizador" || rota === "nivel1") return sessao.papelAtivo === "utilizador";
    if (rota === "profissional") return sessao.papelAtivo === "profissional";
    if (rota === "admin") return sessao.papelAtivo === "superadmin";
    return true;
  }

  function render() {
    var parts = parseHash();
    var sessao = authSim.getSessao();

    if (parts.length === 0) {
      parts = ["identificacao"];
    }

    var rota = parts[0];
    var rotasPublicas = ["identificacao", "escolha-papel", "erro"];

    if (rotasPublicas.indexOf(rota) === -1 && !sessao) {
      global.location.hash = "#/identificacao";
      return;
    }

    if (rotasPublicas.indexOf(rota) === -1 && !papelPermitido(rota, sessao)) {
      global.location.hash = "#/erro/acesso_negado";
      return;
    }

    appEl.innerHTML = "";

    switch (rota) {
      case "identificacao":
        viewIdentificacao(appEl);
        break;
      case "escolha-papel":
        viewEscolhaPapel(appEl);
        break;
      case "utilizador":
        renderUtilizador(appEl, parts.slice(1));
        break;
      case "nivel1":
        viewResultadoNivel1(appEl);
        break;
      case "erro":
        viewErro(appEl, parts[1]);
        break;
      case "profissional":
        renderProfissional(appEl, parts.slice(1));
        break;
      case "admin":
        renderAdmin(appEl, parts.slice(1), sessao);
        break;
      default:
        global.location.hash = homeParaSessao(sessao);
    }
  }

  function renderUtilizador(el, parts) {
    var sub = parts[0] || "metodo";
    switch (sub) {
      case "metodo": viewUtilizadorMetodo(el); break;
      case "pulseira": viewUtilizadorPulseira(el); break;
      case "numero-utente": viewUtilizadorNumeroUtente(el); break;
      case "identidade": viewUtilizadorIdentidade(el); break;
      default: viewUtilizadorMetodo(el);
    }
  }

  function renderProfissional(el, parts) {
    var sub = parts[0] || "pacientes";
    switch (sub) {
      case "pacientes": viewPacientesLista(el, "profissional"); break;
      case "nivel1": viewNivel1Form(el, parts[1], "profissional"); break;
      default: viewPacientesLista(el, "profissional");
    }
  }

  function renderAdmin(el, parts, sessao) {
    var sub = parts[0] || "dashboard";
    switch (sub) {
      case "dashboard": viewAdminDashboard(el); break;
      case "pacientes": viewPacientesLista(el, "admin"); break;
      case "nivel1": viewNivel1Form(el, parts[1], "admin"); break;
      case "tokens": viewAdminTokens(el); break;
      case "contas": viewAdminContas(el); break;
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
  // temporizador de inatividade dispara.
  authSim.onExpirar(function () {
    global.location.hash = "#/erro/sessao_expirada";
    render();
  });
})(window);
