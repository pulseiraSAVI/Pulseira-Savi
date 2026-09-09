/* views/login-profissional.js
 * Login de profissional clínico: nº de Ordem + password + 2FA obrigatório.
 * Depois do login vai direto para o ecrã de scan (sem menus).
 */
function viewLoginProfissional(root) {
  "use strict";

  var estado = { passo: "credenciais", codigoDemo: null };

  function renderCredenciais() {
    root.innerHTML =
      '<div class="phone-stage"><div class="phone"><div class="screen">' +
      '<div class="login-form-wrap">' +
      '<div class="brand-mark">SAVI</div>' +
      '<div class="brand-sub">Sistema de Acesso Virtual a Informação Clínica</div>' +
      '<h2 style="font-size:16px;color:var(--navy);margin:10px 0 2px;">Entrar como profissional clínico</h2>' +
      '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Introduza o seu nº de Ordem e password. É pedido um código de verificação em dois passos.</p>' +
      '<div id="erro-msg" style="color:var(--alert);font-size:12.5px;margin-bottom:6px;"></div>' +
      '<label>Nº de Ordem</label>' +
      '<input type="text" id="in-credencial" placeholder="Ex.: 12345M" autocomplete="username">' +
      '<label>Password</label>' +
      '<input type="password" id="in-password" placeholder="••••••••" autocomplete="current-password">' +
      '<button class="btn btn-primary btn-block" id="btn-entrar" style="margin-top:18px;">Entrar</button>' +
      '<p style="font-size:11px;color:var(--ink-soft);margin-top:14px;">Demo: nº Ordem <b>12345M</b> / password <b>demo123</b> (Dr.ª Ana Silva). Admin/auditor: <b>ADMIN01</b> / <b>admin123</b>.</p>' +
      '<button class="link-discreto" id="ir-familia" style="margin-top:10px;">Sou família de um paciente →</button>' +
      "</div></div></div></div>";

    document.getElementById("ir-familia").addEventListener("click", function () {
      SAVI_router.navegar("#/login-familia");
    });

    document.getElementById("btn-entrar").addEventListener("click", function () {
      var credencial = document.getElementById("in-credencial").value.trim();
      var password = document.getElementById("in-password").value;
      var msgEl = document.getElementById("erro-msg");
      msgEl.textContent = "";
      try {
        var resultado = authSim.iniciarLoginProfissional(credencial, password);
        if (resultado.mfaNecessario) {
          estado.passo = "2fa";
          estado.codigoDemo = resultado.codigoDemo;
          renderOtp();
        } else {
          aposLogin();
        }
      } catch (e) {
        msgEl.textContent = e.message;
      }
    });
  }

  function renderOtp() {
    root.innerHTML =
      '<div class="phone-stage"><div class="phone"><div class="screen">' +
      '<div class="login-form-wrap">' +
      '<div class="brand-mark">SAVI</div>' +
      '<h2 style="font-size:16px;color:var(--navy);margin:14px 0 4px;">Verificação em dois passos</h2>' +
      '<p style="font-size:12.5px;color:var(--ink-soft);">Introduza o código de 6 dígitos.</p>' +
      '<div style="background:var(--unverified-bg);color:var(--unverified);border-radius:10px;padding:10px 12px;font-size:12.5px;margin:10px 0;">' +
      "Código de demonstração (simulado, mostrado no ecrã só para efeitos de demo): <b style=\"font-size:16px;letter-spacing:2px;\">" + estado.codigoDemo + "</b></div>" +
      '<div id="erro-msg" style="color:var(--alert);font-size:12.5px;margin-bottom:6px;"></div>' +
      '<label>Código de verificação</label>' +
      '<input type="text" id="in-codigo" maxlength="6" placeholder="000000" style="letter-spacing:4px;font-size:18px;text-align:center;">' +
      '<button class="btn btn-primary btn-block" id="btn-confirmar" style="margin-top:18px;">Confirmar</button>' +
      '<button class="link-discreto" id="btn-voltar" style="margin-top:12px;">← Voltar</button>' +
      "</div></div></div></div>";

    document.getElementById("btn-voltar").addEventListener("click", function () {
      estado.passo = "credenciais";
      renderCredenciais();
    });

    document.getElementById("btn-confirmar").addEventListener("click", function () {
      var codigo = document.getElementById("in-codigo").value.trim();
      var msgEl = document.getElementById("erro-msg");
      try {
        authSim.confirmarCodigo2FA(codigo);
        aposLogin();
      } catch (e) {
        msgEl.textContent = e.message;
      }
    });
  }

  function aposLogin() {
    var sessao = authSim.getSessao();
    if (sessao.papel === "admin") {
      SAVI_router.navegar("#/admin/dashboard");
    } else {
      SAVI_router.navegar("#/scan");
    }
  }

  renderCredenciais();
}
