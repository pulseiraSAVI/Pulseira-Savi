/* views/utilizador-metodo.js
 * Escolha do método de acesso ao Nível 1 — papel 'utilizador' (break-glass).
 * Os 3 métodos levam sempre ao mesmo resultado (Nível 1) e ficam sujeitos
 * às mesmas regras de auditoria (CLAUDE.md, "Fluxo de acesso").
 */
function viewUtilizadorMetodo(root) {
  "use strict";

  var sessao = authSim.getSessao();

  root.innerHTML =
    '<div class="phone-stage"><div class="phone"><div class="screen">' +
    '<div class="topbar">' +
    '<div class="eyebrow"><span>SAVI</span><span>' + sessao.nome + "</span></div>" +
    '<div class="patient-row"><span class="name" style="font-size:17px;">Acesso a dados clínicos</span></div>' +
    '<div class="meta">Escolha o método de acesso</div>' +
    "</div>" +
    '<div class="scan-center">' +
    '<button class="role-btn" id="btn-pulseira">' +
    '<span class="role-btn-title">📶 Ler pulseira</span>' +
    '<span class="role-btn-sub">NFC ou QR</span>' +
    "</button>" +
    '<button class="role-btn" id="btn-numero-utente">' +
    '<span class="role-btn-title">🔢 Número de utente</span>' +
    '<span class="role-btn-sub">Introdução manual</span>' +
    "</button>" +
    '<button class="role-btn" id="btn-identidade">' +
    '<span class="role-btn-title">🪪 Identidade</span>' +
    '<span class="role-btn-sub">Nome completo + data de nascimento + sexo — exige motivo</span>' +
    "</button>" +
    "</div>" +
    '<div class="bottom-bar" style="position:relative;padding:10px 14px;text-align:center;">' +
    '<button class="link-discreto" id="btn-sair">Terminar sessão</button>' +
    "</div>" +
    "</div></div></div>";

  document.getElementById("btn-pulseira").addEventListener("click", function () {
    SAVI_router.navegar("#/utilizador/pulseira");
  });
  document.getElementById("btn-numero-utente").addEventListener("click", function () {
    SAVI_router.navegar("#/utilizador/numero-utente");
  });
  document.getElementById("btn-identidade").addEventListener("click", function () {
    SAVI_router.navegar("#/utilizador/identidade");
  });
  document.getElementById("btn-sair").addEventListener("click", function () {
    authSim.logout();
    SAVI_router.navegar("#/identificacao");
  });
}
