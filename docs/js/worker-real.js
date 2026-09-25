/* worker-real.js
 * SAVI — substitui worker-sim.js por chamadas reais ao Cloudflare Worker
 * já implantado (backend/cloudflare-worker), para os 3 métodos de acesso
 * do papel 'utilizador'. Mantém a mesma interface global `window.workerSim`
 * — os 3 métodos passam a ser assíncronos (fetch real), por isso as views
 * que os chamam precisam de `await` (ver docs/js/views/utilizador-*.js).
 *
 * O frontend nunca fala diretamente com o Firestore para este fluxo —
 * fala sempre com o Worker, exatamente como o CLAUDE.md exige.
 */
(function (global) {
  "use strict";

  var WORKER_BASE_URL = "https://savi-worker.pulseira-savi.workers.dev";

  function erro(tipo, mensagem) {
    var e = new Error(mensagem);
    e.tipo = tipo;
    return e;
  }

  async function garantirSessaoUtilizador() {
    if (!global.authSim || !global.authSim.sessaoAtiva()) {
      throw erro("sessao_expirada", "A sua sessão expirou por inatividade. Autentique-se novamente.");
    }
    var sessao = global.authSim.getSessao();
    if (sessao.papelAtivo !== "utilizador") {
      throw erro("acesso_negado", "Esta sessão não está no papel de utilizador (break-glass).");
    }
    return sessao;
  }

  async function chamarWorker(caminho, corpo) {
    var sessao = await garantirSessaoUtilizador();
    var pin = global.authSim.getPinAtual();
    if (!pin) throw erro("sessao_expirada", "PIN não disponível — autentique-se novamente.");
    var idToken = await global.authSim.getIdToken();

    var resp;
    try {
      resp = await fetch(WORKER_BASE_URL + caminho, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + idToken
        },
        body: JSON.stringify(Object.assign({ pin: pin }, corpo))
      });
    } catch (e) {
      throw erro("erro", "Não foi possível contactar o servidor. Verifique a ligação à internet.");
    }

    var payload = null;
    try { payload = await resp.json(); } catch (e) { /* resposta sem corpo JSON */ }

    if (!resp.ok) {
      var tipo = (payload && payload.erro) || "erro";
      var mensagem = (payload && payload.mensagem) || "Ocorreu um erro ao processar o pedido.";
      throw erro(tipo, mensagem);
    }
    return payload;
  }

  function montarResultado(payload, metodoAcesso) {
    return {
      paciente: payload.paciente,
      dados: payload.dados,
      documentos: [], // documentos digitalizados vêm de Storage — ver tarefa de ativação do Storage
      idadeFormatada: mockdb.formatarIdade(payload.paciente.data_nascimento),
      metodoAcesso: metodoAcesso,
      acessoId: payload.acessoId
    };
  }

  var workerReal = {
    acessoPorPulseira: async function (params) {
      var payload = await chamarWorker("/acesso/pulseira", {
        token: params.token,
        servico: params.servico
      });
      return montarResultado(payload, "pulseira");
    },

    acessoPorNumeroUtente: async function (params) {
      var payload = await chamarWorker("/acesso/numero-utente", {
        numero_utente: params.numeroUtente,
        servico: params.servico
      });
      return montarResultado(payload, "numero_utente");
    },

    acessoPorIdentidade: async function (params) {
      var payload = await chamarWorker("/acesso/identidade", {
        nome_completo: params.nomeCompleto,
        data_nascimento: params.dataNascimento,
        sexo: params.sexo,
        motivo: params.motivo,
        servico: params.servico
      });
      return montarResultado(payload, "identidade");
    }
  };

  global.workerSim = workerReal;
})(window);
