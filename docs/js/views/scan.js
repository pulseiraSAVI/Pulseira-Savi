/* views/scan.js
 * Ecrã único de scan: botão "Ler pulseira" / "Simular leitura NFC/QR",
 * mais uma lista de tokens de demonstração (não há hardware NFC/QR real
 * nesta demo). Chama sempre workerSim.scan() — nunca acede ao mockdb
 * diretamente.
 */
function viewScan(root) {
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

  function executarScan(token) {
    renderErroInline("");
    try {
      var resultado = workerSim.scan({
        token: token,
        profissionalId: sessao.userId,
        servico: sessao.servico || "Urgência"
      });
      window.SAVI_ultimoScan = resultado;
      SAVI_router.navegar("#/nivel1/" + resultado.pulseira.id);
    } catch (e) {
      if (e.tipo === "sessao_expirada") {
        window.SAVI_ultimoTokenPendente = token;
        SAVI_router.navegar("#/erro/sessao_expirada");
        return;
      }
      window.SAVI_ultimoErroScan = { tipo: e.tipo, mensagem: e.message };
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
    '<div class="bottom-bar" style="position:relative;padding:10px 14px;text-align:center;">' +
    '<button class="link-discreto" id="btn-sair">Terminar sessão</button>' +
    "</div>" +
    "</div></div></div>";

  var listaEl = document.getElementById("lista-tokens");
  tokensDemo.forEach(function (t) {
    var btn = document.createElement("button");
    btn.textContent = t.token + "  —  " + t.label;
    btn.addEventListener("click", function () { executarScan(t.token); });
    listaEl.appendChild(btn);
  });

  document.getElementById("btn-simular").addEventListener("click", function () {
    // Sem hardware real: simula a leitura do primeiro token ativo disponível.
    var ativo = tokensDemo.find(function (t) { return t.label.indexOf("ativa") !== -1; });
    executarScan(ativo ? ativo.token : (tokensDemo[0] ? tokensDemo[0].token : "TOKEN-INEXISTENTE"));
  });

  document.getElementById("btn-sair").addEventListener("click", function () {
    authSim.logout();
    SAVI_router.navegar("#/login-profissional");
  });

  // Repetir automaticamente o scan pendente após reautenticação (passo 3 do fluxo).
  if (window.SAVI_ultimoTokenPendente) {
    var tokenPendente = window.SAVI_ultimoTokenPendente;
    window.SAVI_ultimoTokenPendente = null;
    setTimeout(function () { executarScan(tokenPendente); }, 50);
  }
}
