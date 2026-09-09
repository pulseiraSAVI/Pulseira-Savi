/* auth-sim.js
 * Simula o Firebase Auth para esta demo:
 *  - login de profissional (nº de Ordem + password + 2FA obrigatório)
 *  - login de família (email + password)
 *  - sessão com timeout de 5 min de inatividade real
 *  - "custom claims" (papel: 'profissional' | 'admin' | 'familia', + funcao_auditor)
 *
 * A sessão fica em memória (não em localStorage) — fechar o separador
 * termina a sessão, tal como seria de esperar num sistema clínico.
 */
(function (global) {
  "use strict";

  var SESSAO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
  var sessao = null; // { papel, userId, nome, credencial, funcao_auditor, contaFamiliaId }
  var timeoutId = null;
  var onExpirarCallback = null;
  var otpPendente = null; // { profissionalId, codigo, credencial }

  function limparTimer() {
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
  }

  function reiniciarTimer() {
    limparTimer();
    if (!sessao) return;
    timeoutId = setTimeout(function () {
      var papelAntigo = sessao ? sessao.papel : null;
      sessao = null;
      limparTimer();
      if (onExpirarCallback) onExpirarCallback(papelAntigo);
    }, SESSAO_TIMEOUT_MS);
  }

  // Reinicia o temporizador em qualquer interação real do utilizador.
  ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(function (evt) {
    document.addEventListener(evt, function () {
      if (sessao) reiniciarTimer();
    }, { passive: true });
  });

  function gerarCodigo6() {
    return String(Math.floor(100000 + Math.random() * 900000));
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

    /**
     * Passo 1 do login profissional: valida credencial + password e, se
     * mfa_ativo, gera um código de 6 dígitos (mostrado no ecrã — simulado,
     * como pedido para efeitos de demo, substituindo o envio real por SMS/app).
     */
    iniciarLoginProfissional: function (credencialOrdem, password) {
      var prof = mockdb.getProfissionalPorCredencial(credencialOrdem);
      if (!prof || !prof.ativo) {
        throw new Error("Credenciais inválidas ou profissional inativo.");
      }
      if (prof._password_demo !== password) {
        throw new Error("Credenciais inválidas.");
      }
      if (prof.mfa_ativo) {
        var codigo = gerarCodigo6();
        otpPendente = { profissionalId: prof.id, codigo: codigo };
        return { mfaNecessario: true, codigoDemo: codigo };
      }
      // Sem MFA (não deveria acontecer nesta demo, mas fica coberto).
      this._concluirLoginProfissional(prof);
      return { mfaNecessario: false };
    },

    /**
     * Passo 2 do login profissional: confirma o código de 6 dígitos.
     */
    confirmarCodigo2FA: function (codigo) {
      if (!otpPendente) throw new Error("Não há nenhum pedido de autenticação em curso.");
      if (codigo !== otpPendente.codigo) throw new Error("Código incorreto. Tente novamente.");
      var prof = mockdb.getProfissional(otpPendente.profissionalId);
      otpPendente = null;
      this._concluirLoginProfissional(prof);
      return prof;
    },

    _concluirLoginProfissional: function (prof) {
      sessao = {
        papel: prof._papel === "admin" ? "admin" : "profissional",
        userId: prof.id,
        nome: prof.nome,
        credencial: prof.credencial_ordem,
        servico: prof.servico,
        funcao_auditor: !!prof.funcao_auditor
      };
      reiniciarTimer();
    },

    loginFamilia: function (email, password) {
      var conta = mockdb.getContaFamiliaPorEmail(email);
      if (!conta || !conta.ativo) throw new Error("Credenciais inválidas ou conta inativa.");
      if (conta._password_demo !== password) throw new Error("Credenciais inválidas.");
      sessao = {
        papel: "familia",
        userId: conta.id,
        nome: conta.nome,
        contaFamiliaId: conta.id
      };
      reiniciarTimer();
      return conta;
    },

    logout: function () {
      sessao = null;
      limparTimer();
    }
  };

  global.authSim = authSim;
})(window);
