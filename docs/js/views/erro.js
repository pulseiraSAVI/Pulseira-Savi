/* views/erro.js — ecrãs de erro claros (pulseira revogada/perdida, token
 * inválido, paciente não encontrado, motivo obrigatório em falta, sessão
 * expirada, acesso negado por papel). Nunca mostra dados clínicos. */
function viewErro(root, tipo) {
  "use strict";

  var mapa = {
    token_invalido: { titulo: "Token inválido", texto: "Esta pulseira não está registada no sistema SAVI. Verifique se está a ler a pulseira correta.", icon: "❌" },
    pulseira_revogada: { titulo: "Pulseira revogada ou perdida", texto: (window.SAVI_ultimoErroAcesso && window.SAVI_ultimoErroAcesso.mensagem) || "Esta pulseira não está ativa.", icon: "🚫" },
    nao_encontrado: { titulo: "Paciente não encontrado", texto: (window.SAVI_ultimoErroAcesso && window.SAVI_ultimoErroAcesso.mensagem) || "Não foi encontrado nenhum paciente com os dados indicados.", icon: "🔍" },
    dados_invalidos: { titulo: "Dados incompletos", texto: (window.SAVI_ultimoErroAcesso && window.SAVI_ultimoErroAcesso.mensagem) || "Preencha todos os campos obrigatórios.", icon: "⚠️" },
    motivo_obrigatorio: { titulo: "Motivo obrigatório", texto: "É obrigatório indicar um motivo para este método de acesso.", icon: "📝" },
    sessao_expirada: { titulo: "Sessão expirada", texto: "A sua sessão terminou após 5 minutos de inatividade, por motivos de segurança. Autentique-se novamente para continuar.", icon: "⏱️" },
    acesso_negado: { titulo: "Acesso não autorizado", texto: "Não tem permissões para aceder a esta área da aplicação.", icon: "🔒" },
    erro: { titulo: "Ocorreu um erro", texto: (window.SAVI_ultimoErroAcesso && window.SAVI_ultimoErroAcesso.mensagem) || "Não foi possível concluir a operação.", icon: "⚠️" }
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
      SAVI_router.navegar("#/identificacao");
    });
    acoes.appendChild(btnLogin);
  } else if (sessaoAtiva && authSim.getSessao().papelAtivo === "utilizador") {
    var btnMetodo = document.createElement("button");
    btnMetodo.className = "btn btn-primary btn-block";
    btnMetodo.textContent = "Voltar aos métodos de acesso";
    btnMetodo.addEventListener("click", function () {
      SAVI_router.navegar("#/utilizador/metodo");
    });
    acoes.appendChild(btnMetodo);
  } else if (sessaoAtiva) {
    var btnInicio = document.createElement("button");
    btnInicio.className = "btn btn-primary btn-block";
    btnInicio.textContent = "Voltar ao início";
    btnInicio.addEventListener("click", function () {
      var papel = authSim.getSessao().papelAtivo;
      SAVI_router.navegar(papel === "superadmin" ? "#/admin/dashboard" : "#/profissional/pacientes");
    });
    acoes.appendChild(btnInicio);
  } else {
    var btnHome = document.createElement("button");
    btnHome.className = "btn btn-primary btn-block";
    btnHome.textContent = "Voltar ao início";
    btnHome.addEventListener("click", function () {
      SAVI_router.navegar("#/identificacao");
    });
    acoes.appendChild(btnHome);
  }
}
