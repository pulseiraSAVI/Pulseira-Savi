/* views/identificacao.js
 * Ecrã único de identificação: nº de Ordem + PIN alfanumérico de 5
 * caracteres. Substitui por completo o antigo login profissional
 * (password + 2FA) e o login de família em separado — a família está
 * suspensa nesta revisão (ver CLAUDE.md, "Pivô para produção").
 */
function viewIdentificacao(root) {
  "use strict";

  var aEnviar = false;

  function render() {
    root.innerHTML =
      '<div class="phone-stage"><div class="phone"><div class="screen">' +
      '<div class="login-form-wrap">' +
      '<div class="brand-mark">SAVI</div>' +
      '<div class="brand-sub">Sistema de Acesso Virtual a Informação Clínica</div>' +
      '<h2 style="font-size:16px;color:var(--navy);margin:10px 0 2px;">Identificação</h2>' +
      '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Introduza o seu nº de Ordem e o PIN de 5 caracteres.</p>' +
      '<div id="erro-msg" style="color:var(--alert);font-size:12.5px;margin-bottom:6px;"></div>' +
      '<label>Nº de Ordem</label>' +
      '<input type="text" id="in-credencial" placeholder="Ex.: 12345M" autocomplete="username">' +
      '<label>PIN (5 caracteres)</label>' +
      '<input type="text" id="in-pin" class="pin-input" placeholder="•••••" maxlength="5" autocomplete="current-password">' +
      '<button class="btn btn-primary btn-block" id="btn-entrar" style="margin-top:18px;">Entrar</button>' +
      "</div></div></div></div>";

    document.getElementById("btn-entrar").addEventListener("click", aoSubmeter);
    document.getElementById("in-pin").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") aoSubmeter();
    });
  }

  async function aoSubmeter() {
    if (aEnviar) return;
    var credencial = document.getElementById("in-credencial").value.trim();
    var pin = document.getElementById("in-pin").value.trim();
    var msgEl = document.getElementById("erro-msg");
    msgEl.textContent = "";

    if (!credencial || !pin) {
      msgEl.textContent = "Preencha o nº de Ordem e o PIN.";
      return;
    }

    aEnviar = true;
    try {
      var resultado = await authSim.identificar(credencial, pin);
      if (resultado.precisaEscolherPapel) {
        SAVI_router.navegar("#/escolha-papel");
      } else {
        aposIdentificacao(resultado.papelUnico);
      }
    } catch (e) {
      msgEl.textContent = e.message;
    } finally {
      aEnviar = false;
    }
  }

  function aposIdentificacao(papel) {
    if (papel === "superadmin") {
      SAVI_router.navegar("#/admin/dashboard");
    } else if (papel === "profissional") {
      SAVI_router.navegar("#/profissional/pacientes");
    } else {
      SAVI_router.navegar("#/utilizador/metodo");
    }
  }

  render();
}
