/* views/utilizador-numero-utente.js
 * Método 2 de acesso: número de utente, introduzido manualmente.
 */
function viewUtilizadorNumeroUtente(root) {
  "use strict";

  var sessao = authSim.getSessao();

  root.innerHTML =
    '<div class="phone-stage"><div class="phone"><div class="screen">' +
    '<div class="topbar">' +
    '<div class="eyebrow"><span>SAVI</span><span>' + sessao.nome + "</span></div>" +
    '<div class="patient-row"><span class="name" style="font-size:17px;">Número de utente</span></div>' +
    '<div class="meta">Serviço: ' + (sessao.servico || "—") + "</div>" +
    "</div>" +
    '<div class="scroll">' +
    '<div id="erro-msg" style="color:var(--alert);font-size:12.5px;margin-bottom:8px;"></div>' +
    "<label>Número de utente</label>" +
    '<input type="text" id="in-numero" inputmode="numeric" placeholder="Ex.: 3001445982">' +
    '<button class="btn btn-primary btn-block" id="btn-procurar" style="margin-top:18px;">Procurar</button>' +
    '<div style="text-align:center;margin-top:16px;">' +
    '<button class="link-discreto" id="btn-voltar">← Escolher outro método</button>' +
    "</div>" +
    "</div>" +
    "</div></div></div>";

  document.getElementById("btn-procurar").addEventListener("click", executar);
  document.getElementById("in-numero").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") executar();
  });
  document.getElementById("btn-voltar").addEventListener("click", function () {
    SAVI_router.navegar("#/utilizador/metodo");
  });

  async function executar() {
    var msgEl = document.getElementById("erro-msg");
    msgEl.textContent = "";
    var numero = document.getElementById("in-numero").value.trim();
    if (!numero) { msgEl.textContent = "Introduza o número de utente."; return; }
    try {
      var resultado = await workerSim.acessoPorNumeroUtente({ numeroUtente: numero, servico: sessao.servico || "Urgência" });
      window.SAVI_ultimoAcesso = resultado;
      SAVI_router.navegar("#/nivel1/resultado");
    } catch (e) {
      if (e.tipo === "sessao_expirada") {
        SAVI_router.navegar("#/erro/sessao_expirada");
        return;
      }
      msgEl.textContent = e.message;
    }
  }
}
