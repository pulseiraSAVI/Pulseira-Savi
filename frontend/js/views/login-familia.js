/* views/login-familia.js — login de conta de família (email + password). */
function viewLoginFamilia(root) {
  "use strict";

  root.innerHTML =
    '<div class="phone-stage"><div class="phone"><div class="screen">' +
    '<div class="login-form-wrap">' +
    '<div class="brand-mark">SAVI</div>' +
    '<div class="brand-sub">Área da família</div>' +
    '<h2 style="font-size:16px;color:var(--navy);margin:10px 0 2px;">Entrar</h2>' +
    '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Consulte os dados dos seus educandos, o consentimento e o histórico de acessos à pulseira.</p>' +
    '<div id="erro-msg" style="color:var(--alert);font-size:12.5px;margin-bottom:6px;"></div>' +
    '<label>Email</label>' +
    '<input type="email" id="in-email" placeholder="nome@exemplo.pt" autocomplete="username">' +
    '<label>Password</label>' +
    '<input type="password" id="in-password" placeholder="••••••••" autocomplete="current-password">' +
    '<button class="btn btn-primary btn-block" id="btn-entrar" style="margin-top:18px;">Entrar</button>' +
    '<p style="font-size:11px;color:var(--ink-soft);margin-top:14px;">Demo: <b>sofia.sousa@exemplo.pt</b> / password <b>familia123</b> (família da Matilde Sousa).</p>' +
    '<button class="link-discreto" id="ir-prof" style="margin-top:10px;">Sou profissional clínico →</button>' +
    "</div></div></div></div>";

  document.getElementById("ir-prof").addEventListener("click", function () {
    SAVI_router.navegar("#/login-profissional");
  });

  document.getElementById("btn-entrar").addEventListener("click", function () {
    var email = document.getElementById("in-email").value.trim();
    var password = document.getElementById("in-password").value;
    var msgEl = document.getElementById("erro-msg");
    msgEl.textContent = "";
    try {
      authSim.loginFamilia(email, password);
      SAVI_router.navegar("#/familia/pacientes");
    } catch (e) {
      msgEl.textContent = e.message;
    }
  });
}
