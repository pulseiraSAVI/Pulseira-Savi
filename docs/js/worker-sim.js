/* worker-sim.js
 * Simula o Cloudflare Worker (backend/cloudflare-worker/src/index.js) no
 * browser, só para esta demo. É o ÚNICO módulo que fala com o "mockdb"
 * (base de dados simulada) durante o fluxo de scan/break-glass — o
 * frontend (views/scan.js, views/resultado-nivel1.js) nunca acede
 * diretamente ao mockdb.pulseiras / mockdb.dados_nivel1 / mockdb.acessos,
 * exatamente como no sistema real o frontend nunca fala diretamente com
 * o Firestore para este fluxo (passa sempre pelo Worker).
 *
 * Implementa os passos 1-8 do fluxo de scan descritos no CLAUDE.md /
 * enunciado do projeto.
 */
(function (global) {
  "use strict";

  function erro(tipo, mensagem) {
    var e = new Error(mensagem);
    e.tipo = tipo;
    return e;
  }

  function simularNotificacaoResend(paciente, nivel) {
    // Stub assíncrono. NUNCA inclui dados clínicos no "corpo do email".
    setTimeout(function () {
      var texto = "📧 Notificação enviada à família (simulado) — acesso de " + nivel + " ao registo de " + paciente.nome + " em " + new Date().toLocaleString("pt-PT") + ".";
      if (global.SAVI_toast) global.SAVI_toast(texto);
    }, 400);
  }

  var workerSim = {
    /**
     * POST /scan (simulado)
     * @param {Object} params { token, profissionalId, servico }
     * @returns {Object} { paciente, dados, pulseira }
     * @throws erro com .tipo em: 'sessao_expirada' | 'token_invalido' | 'pulseira_revogada' | 'erro'
     */
    scan: function (params) {
      var token = params.token;
      var profissionalId = params.profissionalId;
      var servico = params.servico;

      // Passo 3: confirmar sessão ativa (timeout de 5 min de inatividade).
      if (!global.authSim || !global.authSim.sessaoAtiva()) {
        throw erro("sessao_expirada", "A sua sessão expirou por inatividade. Autentique-se novamente.");
      }

      // Passo 4: consultar pulseiras pelo token.
      var pulseira = mockdb.getPulseiraPorToken(token);

      if (!pulseira) {
        mockdb.registarAcesso({
          pulseira_id: null,
          profissional_id: profissionalId,
          nivel_acedido: "negado",
          motivo: "Token inválido: " + token,
          servico: servico
        });
        throw erro("token_invalido", "Token inválido. Esta pulseira não está registada no sistema.");
      }

      if (pulseira.estado !== "ativa") {
        mockdb.registarAcesso({
          pulseira_id: pulseira.id,
          profissional_id: profissionalId,
          nivel_acedido: "negado",
          motivo: "Pulseira em estado '" + pulseira.estado + "'",
          servico: servico
        });
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
        mockdb.registarAcesso({
          pulseira_id: pulseira.id,
          profissional_id: profissionalId,
          nivel_acedido: "negado",
          motivo: "Pulseira ativa sem paciente associado (inconsistência de dados).",
          servico: servico
        });
        throw erro("erro", "Não foi possível associar esta pulseira a um paciente.");
      }

      // Passo 5: devolver dados_nivel1, nunca bloqueando por falta de verificação.
      var dados = mockdb.getDadosNivel1(paciente.id);

      // Passo 6: escrever sempre um registo em acessos.
      var acesso = mockdb.registarAcesso({
        pulseira_id: pulseira.id,
        profissional_id: profissionalId,
        nivel_acedido: "nivel_1",
        motivo: null,
        servico: servico
      });

      // Passo 7: notificação assíncrona (não bloqueia a UI).
      simularNotificacaoResend(paciente, "Nível 1");
      setTimeout(function () { mockdb.marcarNotificado(acesso.id); }, 450);

      return {
        paciente: paciente,
        dados: dados,
        pulseira: pulseira,
        idade: mockdb.calcularIdade(paciente.data_nascimento)
      };
    },

    /**
     * POST /scan/nivel2 (simulado)
     * Exige motivo obrigatório. Nunca devolve o histórico completo —
     * apenas a referência textual ao sistema do hospital.
     */
    pedirNivel2: function (params) {
      var pulseiraId = params.pulseiraId;
      var profissionalId = params.profissionalId;
      var servico = params.servico;
      var motivo = (params.motivo || "").trim();

      if (!global.authSim || !global.authSim.sessaoAtiva()) {
        throw erro("sessao_expirada", "A sua sessão expirou por inatividade. Autentique-se novamente.");
      }

      if (!motivo) {
        // Alinhado com o trigger da BD real: nivel_2 exige motivo obrigatório.
        throw erro("motivo_obrigatorio", "É obrigatório indicar um motivo clínico para aceder ao Nível 2.");
      }

      var pulseira = mockdb.getPulseira(pulseiraId);
      if (!pulseira || pulseira.estado !== "ativa") {
        mockdb.registarAcesso({
          pulseira_id: pulseiraId,
          profissional_id: profissionalId,
          nivel_acedido: "negado",
          motivo: motivo,
          servico: servico
        });
        throw erro("pulseira_revogada", "Pulseira não está ativa.");
      }

      var paciente = mockdb.getPaciente(pulseira.paciente_id);

      mockdb.registarAcesso({
        pulseira_id: pulseira.id,
        profissional_id: profissionalId,
        nivel_acedido: "nivel_2",
        motivo: motivo,
        servico: servico
      });

      simularNotificacaoResend(paciente, "Nível 2 (histórico — motivo: " + motivo + ")");

      // Nunca o histórico completo — só a referência textual.
      return {
        referencia_sistema_ext: paciente.referencia_sistema_ext || "Sem referência registada no sistema do hospital."
      };
    }
  };

  global.workerSim = workerSim;
})(window);
