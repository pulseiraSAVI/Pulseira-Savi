/* views/erro.js — ecrãs de erro claros (pulseira revogada/perdida, token
 * inválido, sessão expirada, acesso negado por papel). Nunca mostra dados. */
function viewErro(root, tipo) {
  "use strict";

  var mapa = {
    token_invalido: { titulo: "Token inválido", texto: "Esta pulseira não está registada no sistema SAVI. Verifique se está a ler a pulseira correta.", icon: "❌" },
    pulseira_revogada: { titulo: "Pulseira revogada ou perdida", texto: (window.SAVI_ultimoErroScan && window.SAVI_ultimoErroScan.mensagem) || "Esta pulseira não está ativa.", icon: "🚫" },
    sessao_expirada: { titulo: "Sessão expirada", texto: "A sua sessão terminou após 5 minutos de inatividade, por motivos de segurança. Autentique-se novamente para continuar.", icon: "⏱️" },
    acesso_negado: { titulo: "Acesso não autorizado", texto: "Não tem permissões para aceder a esta área da aplicação.", icon: "🔒" },
    erro: { titulo: "Ocorreu um erro", texto: (window.SAVI_ultimoErroScan && window.SAVI_ultimoErroScan.mensagem) || "Não foi possível concluir a operação.", icon: "⚠️" }
  };

  var info = mapa[tipo] || mapa.erro;
  var sessaoAtiva = authSim.sessaoAtiva();

  root.innerHTML =
    '<div class="phone-stage"><div class="phone"><div class="screen">' +
    '<div class="scan-center">' +
    '<div class="scan-circle" style="background:var(--alert);border-color:#EFC9C2;">' + info.icon + "</div>" +
    '<h2 style="color:var(--navy);font-size:18px;margin:6px 0 2px;">' + info.titulo + "</h2>" +
    '<p style="color:var(--ink-soft);font-size:13.5px;line-height:1.5;">' + info.texto + "</p>" +
    '<div id="acoes"></div>' +
    "</div></div></div></div>";

  var acoes = document.getElementById("acoes");

  if (tipo === "sessao_expirada") {
    var btnLogin = document.createElement("button");
    btnLogin.className = "btn btn-primary btn-block";
    btnLogin.textContent = "Iniciar sessão novamente";
    btnLogin.addEventListener("click", function () {
      SAVI_router.navegar("#/login-profissional");
    });
    acoes.appendChild(btnLogin);
  } else if (sessaoAtiva) {
    var btnScan = document.createElement("button");
    btnScan.className = "btn btn-primary btn-block";
    btnScan.textContent = "Voltar ao scan";
    btnScan.addEventListener("click", function () {
      SAVI_router.navegar("#/scan");
    });
    acoes.appendChild(btnScan);
  } else {
    var btnHome = document.createElement("button");
    btnHome.className = "btn btn-primary btn-block";
    btnHome.textContent = "Voltar ao início";
    btnHome.addEventListener("click", function () {
      SAVI_router.navegar("#/login-profissional");
    });
    acoes.appendChild(btnHome);
  }
}
