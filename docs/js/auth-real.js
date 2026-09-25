/* auth-real.js
 * SAVI — substitui auth-sim.js por identificação real: Firebase Auth
 * (email/password interno derivado do nº de Ordem) + leitura do próprio
 * documento em `profissionais/{uid}` (permitido por firestore.rules:
 * "Cada conta pode ler o seu próprio documento").
 *
 * Mantém exatamente a mesma interface global `window.authSim` que
 * auth-sim.js — identificar/escolherPapel deixam de ser síncronas (agora
 * devolvem Promise, porque falam com Firebase Auth/Firestore a sério),
 * mas o resto (getSessao, sessaoAtiva, logout, onExpirar, temContaPendente)
 * mantém-se síncrono, apoiado no mesmo objeto `sessao` em memória.
 *
 * Desenho da password (confirmado com o utilizador, revisão de 19/09):
 * email = `${credencial_ordem.toLowerCase()}@savi.local`; password = o
 * próprio hash SHA-256 do PIN (o mesmo valor guardado em
 * profissionais.pin_hash) — nunca uma segunda credencial que o
 * profissional teria de memorizar à parte. O Worker volta a validar o
 * PIN de forma independente em cada pedido de break-glass (dupla
 * verificação, não redundância inútil).
 *
 * Requer firebase-init.js carregado antes (espera pelo evento
 * "firebase-pronto", ver index.html para a ordem de carregamento).
 */
(function (global) {
  "use strict";

  var SESSAO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos, igual ao CLAUDE.md
  var sessao = null;
  var contaPendente = null; // { uid, perfil, papeis } — à espera de escolha de papel
  var pinAtual = null; // guardado só em memória, nunca persistido — ver worker-real.js
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
      pinAtual = null;
      limparTimer();
      if (onExpirarCallback) onExpirarCallback();
    }, SESSAO_TIMEOUT_MS);
  }

  ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(function (evt) {
    document.addEventListener(evt, function () {
      if (sessao) reiniciarTimer();
    }, { passive: true });
  });

  function aguardarFirebase() {
    if (global.firebaseSDK) return Promise.resolve();
    return new Promise(function (resolve) {
      global.addEventListener("firebase-pronto", function onPronto() {
        global.removeEventListener("firebase-pronto", onPronto);
        resolve();
      });
    });
  }

  function iniciarSessao(uid, perfil, papelAtivo) {
    sessao = {
      userId: uid,
      nome: perfil.nome,
      credencial: perfil.credencial_ordem,
      papeis: (perfil.papeis || []).slice(),
      papelAtivo: papelAtivo,
      funcao_auditor: !!perfil.funcao_auditor,
      servico: perfil.servico,
      especialidade: perfil.especialidade,
      instituicao_servico: perfil.instituicao_servico,
      telefone_institucional: perfil.telefone_institucional
    };
    contaPendente = null;
    reiniciarTimer();
  }

  var authReal = {
    SESSAO_TIMEOUT_MS: SESSAO_TIMEOUT_MS,

    onExpirar: function (cb) { onExpirarCallback = cb; },
    sessaoAtiva: function () { return !!sessao; },
    getSessao: function () { return sessao; },
    temContaPendente: function () { return !!contaPendente; },

    // Usado por worker-real.js — nunca exposto em localStorage/console.
    getPinAtual: function () { return pinAtual; },

    // Usado por worker-real.js para autenticar os pedidos ao Worker.
    getIdToken: async function () {
      await aguardarFirebase();
      var user = global.firebaseSDK.auth.currentUser;
      if (!user) throw new Error("Sessão não autenticada.");
      return user.getIdToken();
    },

    /**
     * Identificação real: nº de Ordem + PIN de 5 caracteres.
     * @returns {Promise<{precisaEscolherPapel: boolean, papeis: string[], papelUnico: (string|null)}>}
     */
    identificar: async function (credencialOrdem, pin) {
      await aguardarFirebase();
      var sdk = global.firebaseSDK;

      credencialOrdem = (credencialOrdem || "").trim();
      if (!pin || pin.length !== 5) {
        throw new Error("O PIN tem de ter exatamente 5 caracteres.");
      }
      var pinNorm = pin.toUpperCase();
      var pinHash = await hashUtil.sha256Hex(pinNorm);
      var email = credencialOrdem.toLowerCase() + "@savi.local";

      var cred;
      try {
        cred = await sdk.signInWithEmailAndPassword(sdk.auth, email, pinHash);
      } catch (e) {
        throw new Error("Nº de Ordem ou PIN incorretos.");
      }

      var uid = cred.user.uid;
      var docSnap = await sdk.getDoc(sdk.doc(sdk.db, "profissionais", uid));
      if (!docSnap.exists()) {
        await sdk.auth.signOut();
        throw new Error("Conta autenticada mas sem perfil em profissionais/ — contacte o superadmin.");
      }
      var perfil = docSnap.data();
      if (!perfil.ativo) {
        await sdk.auth.signOut();
        throw new Error("Esta conta está inativa. Contacte o superadmin.");
      }
      if (!perfil.papeis || perfil.papeis.length === 0) {
        await sdk.auth.signOut();
        throw new Error("Esta conta não tem nenhum papel atribuído. Contacte o superadmin.");
      }

      pinAtual = pinNorm;

      if (perfil.papeis.indexOf("superadmin") !== -1) {
        iniciarSessao(uid, perfil, "superadmin");
        return { precisaEscolherPapel: false, papeis: perfil.papeis, papelUnico: "superadmin" };
      }
      if (perfil.papeis.length === 1) {
        iniciarSessao(uid, perfil, perfil.papeis[0]);
        return { precisaEscolherPapel: false, papeis: perfil.papeis, papelUnico: perfil.papeis[0] };
      }

      contaPendente = { uid: uid, perfil: perfil };
      return { precisaEscolherPapel: true, papeis: perfil.papeis, papelUnico: null };
    },

    /**
     * Conclui a escolha de papel (contas com profissional + utilizador).
     * Já não é síncrona como no auth-sim — nunca faz mais nenhum pedido de
     * rede (o perfil já foi lido em identificar()), mas devolve Promise
     * para manter a assinatura consistente com o resto do módulo.
     */
    escolherPapel: async function (papel) {
      if (!contaPendente) throw new Error("Não há nenhuma identificação em curso.");
      if (contaPendente.perfil.papeis.indexOf(papel) === -1) throw new Error("Esta conta não tem esse papel.");
      iniciarSessao(contaPendente.uid, contaPendente.perfil, papel);
      return sessao;
    },

    logout: async function () {
      sessao = null;
      contaPendente = null;
      pinAtual = null;
      limparTimer();
      await aguardarFirebase();
      try { await global.firebaseSDK.auth.signOut(); } catch (e) { /* já sem sessão, ignora */ }
    }
  };

  global.authSim = authReal;
})(window);
