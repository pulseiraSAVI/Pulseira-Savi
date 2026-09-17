/* views/escolha-papel.js
 * Ecrã de escolha de papel — só aparece para contas com mais de um papel
 * (profissional + utilizador). Nunca mostra os dois papéis ao mesmo
 * tempo: a pessoa escolhe um, entra nessa vista, e só volta aqui se
 * terminar a sessão e se identificar de novo.
 */
function viewEscolhaPapel(root) {
  "use strict";

  if (!authSim.temContaPendente()) {
    SAVI_router.navegar("#/identificacao");
    return;
  }

  root.innerHTML =
    '<div class="phone-stage"><div class="phone"><div class="screen">' +
    '<div class="login-form-wrap">' +
    '<div class="brand-mark">SAVI</div>' +
    '<h2 style="font-size:16px;color:var(--navy);margin:14px 0 4px;">Com que papel quer entrar?</h2>' +
    '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 18px;">Esta conta tem os dois papéis. Escolha um — não é possível ver os dois ao mesmo tempo.</p>' +
    '<button class="role-btn" id="btn-profissional">' +
    '<span class="role-btn-title">Profissional</span>' +
    '<span class="role-btn-sub">Criar/editar pacientes, escrever dados clínicos, solicitar pulseira</span>' +
    "</button>" +
    '<button class="role-btn" id="btn-utilizador">' +
    '<span class="role-btn-title">Utilizador (break-glass)</span>' +
    '<span class="role-btn-sub">Aceder ao Nível 1 de qualquer paciente por pulseira, número de utente, ou identidade</span>' +
    "</button>" +
    "</div></div></div></div>";

  document.getElementById("btn-profissional").addEventListener("click", function () {
    authSim.escolherPapel("profissional");
    SAVI_router.navegar("#/profissional/pacientes");
  });
  document.getElementById("btn-utilizador").addEventListener("click", function () {
    authSim.escolherPapel("utilizador");
    SAVI_router.navegar("#/utilizador/metodo");
  });
}
