/* auth-sim.js
 * Simula o Firebase Auth para o SAVI — pivô de produção, revisão de
 * 15/09/2026:
 *  - identificação única por nº de Ordem + PIN alfanumérico de 5
 *    caracteres (substitui por completo o login por password + 2FA e o
 *    login de família em separado);
 *  - uma mesma conta pode ter os papéis 'profissional' e 'utilizador' em
 *    simultâneo — a pessoa escolhe com qual entra nesta sessão, nunca vê
 *    os dois ao mesmo tempo; 'superadmin' não passa por essa escolha;
 *  - sessão com timeout de 5 min de inatividade real;
 *  - PIN validado sempre por hash (hash-util.js), nunca em texto simples.
 *
 * A sessão fica em memória (não em localStorage) — fechar o separador
 * termina a sessão, tal como seria de esperar num sistema clínico.
 */
(function (global) {
  "use strict";

  var SESSAO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
  var sessao = null; // { userId, nome, credencial, papeis, papelAtivo, funcao_auditor, servico, especialidade, instituicao_servico, telefone_institucional }
  var contaPendente = null; // conta já identificada (PIN correto), à espera de escolha de papel
  var timeoutId = null;
  var onExpirarCallback = null;

  function limparTimer() {
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
  }

  function reiniciarTimer() {
    limparTimer();
    if (!sessao) return;
    timeoutId = setTimeout(function () {
      sessao = null;
      limparTimer();
      if (onExpirarCallback) onExpirarCallback();
    }, SESSAO_TIMEOUT_MS);
  }

  // Reinicia o temporizador em qualquer interação real do utilizador.
  ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(function (evt) {
    document.addEventListener(evt, function () {
      if (sessao) reiniciarTimer();
    }, { passive: true });
  });

  function iniciarSessao(conta, papelAtivo) {
    sessao = {
      userId: conta.id,
      nome: conta.nome,
      credencial: conta.credencial_ordem,
      papeis: conta.papeis.slice(),
      papelAtivo: papelAtivo,
      funcao_auditor: !!conta.funcao_auditor,
      servico: conta.servico,
      especialidade: conta.especialidade,
      instituicao_servico: conta.instituicao_servico,
      telefone_institucional: conta.telefone_institucional
    };
    contaPendente = null;
    reiniciarTimer();
  }

  var authSim = {
    SESSAO_TIMEOUT_MS: SESSAO_TIMEOUT_MS,

    onExpirar: function (cb) {
      onExpirarCallback = cb;
    },

    sessaoAtiva: function () {
      return !!sessao;
    },

    getSessao: function () {
      return sessao;
    },

    temContaPendente: function () {
      return !!contaPendente;
    },

    /**
     * Identificação única: nº de Ordem + PIN de 5 caracteres. O PIN é
     * sempre validado por hash (nunca em texto simples), tal como o
     * Worker real faria no servidor (backend/cloudflare-worker).
     *
     * @returns {Promise<{precisaEscolherPapel: boolean, papeis: string[], papelUnico: (string|null)}>}
     */
    identificar: async function (credencialOrdem, pin) {
      var conta = mockdb.getProfissionalPorCredencial((credencialOrdem || "").trim());
      if (!conta || !conta.ativo) {
        throw new Error("Credenciais inválidas ou conta inativa.");
      }
      if (!pin || pin.length !== 5) {
        throw new Error("O PIN tem de ter exatamente 5 caracteres.");
      }
      var hash = await hashUtil.sha256Hex(pin.toUpperCase());
      if (hash !== conta.pin_hash) {
        throw new Error("Nº de Ordem ou PIN incorretos.");
      }
      if (!conta.papeis || conta.papeis.length === 0) {
        throw new Error("Esta conta não tem nenhum papel atribuído. Contacte o superadmin.");
      }

      // Superadmin não escolhe papel — é sempre a mesma vista, sem a
      // restrição de "só os meus pacientes".
      if (conta.papeis.indexOf("superadmin") !== -1) {
        iniciarSessao(conta, "superadmin");
        return { precisaEscolherPapel: false, papeis: conta.papeis, papelUnico: "superadmin" };
      }

      if (conta.papeis.length === 1) {
        iniciarSessao(conta, conta.papeis[0]);
        return { precisaEscolherPapel: false, papeis: conta.papeis, papelUnico: conta.papeis[0] };
      }

      // Conta com profissional + utilizador: a pessoa escolhe agora.
      contaPendente = conta;
      return { precisaEscolherPapel: true, papeis: conta.papeis, papelUnico: null };
    },

    /**
     * Conclui a escolha de papel de uma conta com mais de um papel
     * (ver `identificar`). Nunca usado para superadmin.
     */
    escolherPapel: function (papel) {
      if (!contaPendente) throw new Error("Não há nenhuma identificação em curso.");
      if (contaPendente.papeis.indexOf(papel) === -1) throw new Error("Esta conta não tem esse papel.");
      iniciarSessao(contaPendente, papel);
      return sessao;
    },

    logout: function () {
      sessao = null;
      contaPendente = null;
      limparTimer();
    }
  };

  global.authSim = authSim;
})(window);
