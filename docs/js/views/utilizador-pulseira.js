/* views/utilizador-pulseira.js
 * Método 1 de acesso: leitura de pulseira (NFC ou QR). Sem hardware real
 * nesta simulação — lista de tokens de demonstração. Chama sempre
 * workerSim.acessoPorPulseira() — nunca acede ao mockdb diretamente.
 */
function viewUtilizadorPulseira(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var tokensDemo = mockdb.listPulseiras().map(function (p) {
    var paciente = p.paciente_id ? mockdb.getPaciente(p.paciente_id) : null;
    return {
      token: p.token,
      label: (paciente ? paciente.nome : "(sem paciente)") + " — " + p.estado
    };
  });

  function renderErroInline(mensagem) {
    var el = document.getElementById("scan-erro");
    if (el) el.textContent = mensagem;
  }

  function executarAcesso(token) {
    renderErroInline("");
    try {
      var resultado = workerSim.acessoPorPulseira({ token: token, servico: sessao.servico || "Urgência" });
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
    '<button class="btn btn-primary btn-block" id="btn-simular">Simular leitura NFC/QR</button>' +
    '<div class="demo-token-list"><div class="section-title" style="margin-top:14px;">Ou escolha um token de demonstração</div><div id="lista-tokens"></div></div>' +
    "</div>" +
    '<div style="text-align:center;padding-bottom:10px;">' +
    '<button class="link-discreto" id="btn-voltar">← Escolher outro método</button>' +
    "</div>" +
    "</div></div></div>";

  var listaEl = document.getElementById("lista-tokens");
  tokensDemo.forEach(function (t) {
    var btn = document.createElement("button");
    btn.textContent = t.token + "  —  " + t.label;
    btn.addEventListener("click", function () { executarAcesso(t.token); });
    listaEl.appendChild(btn);
  });

  document.getElementById("btn-simular").addEventListener("click", function () {
    var ativo = tokensDemo.find(function (t) { return t.label.indexOf("ativa") !== -1; });
    executarAcesso(ativo ? ativo.token : (tokensDemo[0] ? tokensDemo[0].token : "TOKEN-INEXISTENTE"));
  });

  document.getElementById("btn-voltar").addEventListener("click", function () {
    SAVI_router.navegar("#/utilizador/metodo");
  });
}
