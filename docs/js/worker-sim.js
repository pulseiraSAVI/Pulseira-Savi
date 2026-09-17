/* worker-sim.js
 * Simula o Cloudflare Worker (backend/cloudflare-worker/src/index.js) no
 * browser, só para esta simulação. É o ÚNICO módulo que fala com o
 * "mockdb" durante o fluxo de break-glass — o frontend (views/utilizador-*.js,
 * views/resultado-nivel1.js) nunca acede diretamente ao mockdb.pulseiras /
 * mockdb.dados_nivel1 / mockdb.acessos, exatamente como no sistema real o
 * frontend nunca fala diretamente com o Firestore para este fluxo (passa
 * sempre pelo Worker).
 *
 * Implementa os 3 métodos de acesso do papel 'utilizador' descritos no
 * CLAUDE.md ("Fluxo de acesso"): pulseira (NFC/QR), número de utente, e
 * identidade (nome completo + data de nascimento + sexo, com motivo
 * obrigatório). Nível 2 NÃO EXISTE — foi eliminado por completo desta
 * revisão, não há função equivalente aqui.
 *
 * Simplificação desta simulação: o PIN de 5 caracteres é validado uma
 * única vez, na identificação (auth-sim.js) — o Worker real revalida-o a
 * cada pedido porque corre sem estado entre pedidos (ver TODO em
 * backend/cloudflare-worker/src/index.js); aqui isso equivale a verificar
 * que a sessão continua ativa (mesmo timeout de 5 min de inatividade).
 */
(function (global) {
  "use strict";

  function erro(tipo, mensagem) {
    var e = new Error(mensagem);
    e.tipo = tipo;
    return e;
  }

  function simularNotificacaoResend(paciente, metodoAcesso) {
    // Stub assíncrono. NUNCA inclui dados clínicos no "corpo do email".
    setTimeout(function () {
      var texto = "📧 Notificação enviada ao gestor do caso/família (simulado) — acesso por " + metodoAcesso + " ao registo de " + paciente.nome + " em " + new Date().toLocaleString("pt-PT") + ".";
      if (global.SAVI_toast) global.SAVI_toast(texto);
    }, 400);
  }

  function garantirSessaoUtilizador() {
    if (!global.authSim || !global.authSim.sessaoAtiva()) {
      throw erro("sessao_expirada", "A sua sessão expirou por inatividade. Autentique-se novamente.");
    }
    var sessao = global.authSim.getSessao();
    if (sessao.papelAtivo !== "utilizador") {
      throw erro("acesso_negado", "Esta sessão não está no papel de utilizador (break-glass).");
    }
    return sessao;
  }

  function montarResultado(paciente, utilizadorId, servico, metodoAcesso, motivo) {
    var dados = mockdb.getDadosNivel1(paciente.id);
    var documentos = mockdb.listDocumentosDoPaciente(paciente.id);

    var acesso = mockdb.registarAcesso({
      metodo_acesso: metodoAcesso,
      pulseira_id: null,
      paciente_id: paciente.id,
      utilizador_id: utilizadorId,
      nivel_acedido: "nivel_1",
      motivo: motivo || null,
      servico: servico
    });

    simularNotificacaoResend(paciente, metodoAcesso);
    setTimeout(function () { mockdb.marcarNotificado(acesso.id); }, 450);

    return {
      paciente: paciente,
      dados: dados,
      documentos: documentos,
      idadeFormatada: mockdb.formatarIdade(paciente.data_nascimento),
      metodoAcesso: metodoAcesso,
      acessoId: acesso.id
    };
  }

  function registarNegacao(metodoAcesso, pulseiraId, utilizadorId, servico, motivo) {
    mockdb.registarAcesso({
      metodo_acesso: metodoAcesso,
      pulseira_id: pulseiraId || null,
      paciente_id: null,
      utilizador_id: utilizadorId,
      nivel_acedido: "negado",
      motivo: motivo || null,
      servico: servico
    });
  }

  var workerSim = {
    /**
     * Método 1 — leitura de pulseira (NFC ou QR).
     * @param {Object} params { token, servico }
     */
    acessoPorPulseira: function (params) {
      var sessao = garantirSessaoUtilizador();
      var token = params.token;
      var servico = params.servico;

      var pulseira = mockdb.getPulseiraPorToken(token);
      if (!pulseira) {
        registarNegacao("pulseira", null, sessao.userId, servico, null);
        throw erro("token_invalido", "Esta pulseira não está registada no sistema.");
      }
      if (pulseira.estado !== "ativa") {
        registarNegacao("pulseira", pulseira.id, sessao.userId, servico, null);
        var msgs = {
          nao_atribuida: "Esta pulseira ainda não foi atribuída a nenhum paciente.",
          desativada: "Esta pulseira foi desativada.",
          perdida: "Esta pulseira foi reportada como perdida e foi revogada.",
          substituida: "Esta pulseira foi substituída e já não está ativa."
        };
        throw erro("pulseira_revogada", msgs[pulseira.estado] || "Pulseira não está ativa.");
      }
      var paciente = mockdb.getPaciente(pulseira.paciente_id);
      if (!paciente) {
        registarNegacao("pulseira", pulseira.id, sessao.userId, servico, null);
        throw erro("erro", "Não foi possível associar esta pulseira a um paciente.");
      }
      return montarResultado(paciente, sessao.userId, servico, "pulseira", null);
    },

    /**
     * Método 2 — número de utente.
     * @param {Object} params { numeroUtente, servico }
     */
    acessoPorNumeroUtente: function (params) {
      var sessao = garantirSessaoUtilizador();
      var numeroUtente = (params.numeroUtente || "").trim();
      var servico = params.servico;

      if (!numeroUtente) throw erro("dados_invalidos", "Introduza o número de utente.");

      var paciente = mockdb.getPacientePorNumeroUtente(numeroUtente);
      if (!paciente) {
        registarNegacao("numero_utente", null, sessao.userId, servico, null);
        throw erro("nao_encontrado", "Não foi encontrado nenhum paciente com este número de utente.");
      }
      return montarResultado(paciente, sessao.userId, servico, "numero_utente", null);
    },

    /**
     * Método 3 — identidade (nome completo + data de nascimento + sexo).
     * Exige motivo obrigatório ANTES de mostrar qualquer dado — regra não
     * negociável (CLAUDE.md).
     * @param {Object} params { nomeCompleto, dataNascimento, sexo, motivo, servico }
     */
    acessoPorIdentidade: function (params) {
      var sessao = garantirSessaoUtilizador();
      var nomeCompleto = (params.nomeCompleto || "").trim();
      var dataNascimento = params.dataNascimento;
      var sexo = params.sexo;
      var motivo = (params.motivo || "").trim();
      var servico = params.servico;

      if (!motivo) {
        throw erro("motivo_obrigatorio", "É obrigatório indicar um motivo para o acesso por identidade.");
      }
      if (!nomeCompleto || !dataNascimento || !sexo) {
        throw erro("dados_invalidos", "Preencha nome completo, data de nascimento e sexo.");
      }

      var paciente = mockdb.getPacientePorIdentidade(nomeCompleto, dataNascimento, sexo);
      if (!paciente) {
        registarNegacao("identidade", null, sessao.userId, servico, motivo);
        throw erro("nao_encontrado", "Não foi encontrado nenhum paciente com esta identidade.");
      }
      return montarResultado(paciente, sessao.userId, servico, "identidade", motivo);
    }
  };

  global.workerSim = workerSim;
})(window);
