/* views/utilizador-pulseira.js
 * Método 1 de acesso: leitura de pulseira (NFC ou QR). Sem hardware NFC
 * real nesta app web (Web NFC API só existe na ferramenta interna de
 * gravação, não aqui) — por agora o token lido é introduzido
 * manualmente. Chama sempre workerSim.acessoPorPulseira() — nunca acede
 * ao mockdb/Firestore diretamente, tal como o break-glass exige
 * (CLAUDE.md): o papel 'utilizador' não tem permissão de leitura direta
 * sobre a coleção `pulseiras`, só o Worker tem.
 */
function viewUtilizadorPulseira(root) {
  "use strict";

  var sessao = authSim.getSessao();

  function renderErroInline(mensagem) {
    var el = document.getElementById("scan-erro");
    if (el) el.textContent = mensagem;
  }

  async function executarAcesso(token) {
    renderErroInline("");
    if (!token) { renderErroInline("Introduza ou leia o token da pulseira."); return; }
    try {
      var resultado = await workerSim.acessoPorPulseira({ token: token, servico: sessao.servico || "Urgência" });
      window.SAVI_ultimoAcesso = resultado;
      SAVI_router.navegar("#/nivel1/resultado");
    } catch (e) {
      if (e.tipo === "sessao_expirada") {
        SAVI_router.navegar("#/erro/sessao_expirada");
        return;
      }
      window.SAVI_ultimoErroAcesso = { tipo: e.tipo, mensagem: e.message };
      SAVI_router.navegar("#/erro/" + (e.tipo || "erro"));
    }
  }

  root.innerHTML =
    '<div class="phone-stage"><div class="phone"><div class="screen">' +
    '<div class="topbar">' +
    '<div class="eyebrow"><span>SAVI</span><span>' + sessao.nome + "</span></div>" +
    '<div class="patient-row"><span class="name" style="font-size:17px;">Leitura de pulseira</span></div>' +
    '<div class="meta">Serviço: ' + (sessao.servico || "—") + "</div>" +
    "</div>" +
    '<div class="scan-center">' +
    '<div class="scan-circle">📶</div>' +
    '<div id="scan-erro" style="color:var(--alert);font-size:12.5px;"></div>' +
    '<label style="margin-top:14px;">Token da pulseira (NFC/QR)</label>' +
    '<input type="text" id="in-token" placeholder="Ex.: SAVI-XXXXXX-001">' +
    '<button class="btn btn-primary btn-block" id="btn-ler" style="margin-top:10px;">Ler pulseira</button>' +
    "</div>" +
    '<div style="text-align:center;padding-bottom:10px;">' +
    '<button class="link-discreto" id="btn-voltar">← Escolher outro método</button>' +
    "</div>" +
    "</div></div></div>";

  document.getElementById("btn-ler").addEventListener("click", function () {
    executarAcesso(document.getElementById("in-token").value.trim());
  });
  document.getElementById("in-token").addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") executarAcesso(document.getElementById("in-token").value.trim());
  });

  document.getElementById("btn-voltar").addEventListener("click", function () {
    SAVI_router.navegar("#/utilizador/metodo");
  });
}
