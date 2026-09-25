/* js/icons.js
 * SAVI — biblioteca de ícones SVG inline, para substituir por completo o
 * uso de emojis na interface (pedido explícito: imagens SVG em vez de
 * emojis, com um acabamento profissional e cuidado).
 *
 * Estilo: traço único (stroke), sem preenchimento, stroke-width 2,
 * cantos/junções arredondados, viewBox 24x24 — a mesma gramática visual
 * em todos os ícones, para parecerem desenhados pela mesma mão. Usam
 * `currentColor`, por isso herdam sempre a cor de texto do contentor
 * (card-label, footer-nav-item, etc.) sem precisar de CSS extra por
 * ícone.
 *
 * Uso: SAVI_ICONS.nome() devolve a string SVG completa, já embrulhada
 * num <span class="icon"> com o tamanho certo — basta concatenar no
 * template de cada view, tal como antes se concatenava o emoji.
 */
(function (global) {
  "use strict";

  function wrap(paths, extra) {
    return '<span class="icon"' + (extra ? ' ' + extra : "") + '>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>' +
      '</span>';
  }

  var ICONS = {
    // ---------- Cartões clínicos (Algoritmo) ----------
    alergia: function () {
      return wrap(
        '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".5" fill="currentColor" stroke="none"/>'
      );
    },
    condicaoCritica: function () {
      return wrap('<path d="M3 12h4l2-7 4 14 2-7h6"/>');
    },
    biometria: function () {
      return wrap('<path d="M12 3a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4z"/><path d="M6 11v1a6 6 0 0 0 12 0v-1"/><path d="M12 18v3"/>');
    },
    esquemaDose: function () {
      return wrap('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 8v8M15 8v8"/>');
    },
    medicacaoContraindicada: function () {
      return wrap('<circle cx="12" cy="12" r="9"/><path d="M6.5 6.5l11 11"/>');
    },
    limitacaoTerapeutica: function () {
      return wrap('<path d="M12 2 3 7v6c0 5 4 8.5 9 9 5-.5 9-4 9-9V7l-9-5z"/>');
    },
    notas: function () {
      return wrap('<path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9l-4-6z"/><path d="M14 3v6h5"/><path d="M8.5 13h7M8.5 17h5"/>');
    },

    // ---------- Documentos (RGPD / termo de responsabilidade) ----------
    documentoRgpd: function () {
      return wrap('<path d="M12 3l7 3v5c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/><path d="M9 12.5l2 2 4-4.2"/>');
    },
    documentoTermo: function () {
      return wrap('<path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9l-4-6z"/><path d="M14 3v6h5"/><path d="M8.5 13.5h7M8.5 17h4.5"/>');
    },
    documentoOutro: function () {
      return wrap('<path d="M16.5 6.5 9 14a2.5 2.5 0 1 0 3.5 3.5l7-7a4 4 0 1 0-5.6-5.7L6 12.7"/>');
    },

    // ---------- Menu de footer (Nível 1) ----------
    dadosUtente: function () {
      return wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10.5" r="2"/><path d="M6 17c.6-2 2-3 3-3s2.4 1 3 3"/><path d="M14 9h4M14 12.5h4"/>');
    },
    algoritmo: function () {
      return wrap('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3"/><path d="M8.5 11.5l2 2 4.5-4.5"/><path d="M8.5 16.5h7"/>');
    },
    medicacaoHabitual: function () {
      return wrap('<rect x="3.5" y="9.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 13)"/><path d="M9.5 9.5l5 5"/>');
    },
    configuracao: function () {
      return wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.4-2-3.4-2.3.8a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.7 7.7 0 0 0-2.6 1.5l-2.3-.8-2 3.4 2 1.4a7.6 7.6 0 0 0 0 3l-2 1.4 2 3.4 2.3-.8c.75.65 1.63 1.16 2.6 1.5l.5 2.5h4l.5-2.5a7.7 7.7 0 0 0 2.6-1.5l2.3.8 2-3.4-2-1.4z"/>');
    },

    // ---------- Métodos de acesso (break-glass) ----------
    nfc: function () {
      return wrap('<rect x="3" y="7" width="9" height="10" rx="2"/><path d="M9 10.3a2 2 0 0 1 0 3.4"/><path d="M15.5 6a8 8 0 0 1 0 12"/><path d="M18.5 3.3a12 12 0 0 1 0 17.4"/>');
    },
    numeroUtente: function () {
      return wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h.01M12 9h.01M17 9h.01M7 13h.01M12 13h.01M17 13h.01M7 17h.01M12 17h.01"/>');
    },
    identidade: function () {
      return wrap('<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h13.5v14.5A2.5 2.5 0 0 1 17.5 21H6.5A2.5 2.5 0 0 1 4 18.5v-12z"/><circle cx="9.5" cy="10" r="1.7"/><path d="M7 15c.5-1.5 1.5-2.2 2.5-2.2S11.5 13.5 12 15"/><path d="M14.5 9h3M14.5 12h3"/>');
    },

    // ---------- Ecrãs de erro ----------
    erroToken: function () {
      return wrap('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>');
    },
    erroRevogado: function () {
      return wrap('<circle cx="12" cy="12" r="9"/><path d="M6.5 6.5l11 11"/>');
    },
    erroNaoEncontrado: function () {
      return wrap('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>');
    },
    erroAviso: function () {
      return wrap('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".5" fill="currentColor" stroke="none"/>');
    },
    erroMotivo: function () {
      return wrap('<path d="M4 20l1-4.2L16.8 4A2 2 0 0 1 19.6 4l.4.4a2 2 0 0 1 0 2.8L8.2 19 4 20z"/><path d="M14.5 6.5l3 3"/>');
    },
    erroBloqueado: function () {
      return wrap('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
    },
    erroTempo: function () {
      return wrap('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9.5 2.5h5"/>');
    },

    // ---------- Diversos ----------
    telefone: function () {
      return wrap('<path d="M5 4h3.5l1.5 4.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4.5 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z"/>');
    },
    email: function () {
      return wrap('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>');
    }
  };

  /* Marca SAVI compacta (a mesma composição do ícone da app,
   * docs/icons/icon.svg, sem o fundo em cartão arredondado) — usada em
   * linha junto ao nome "SAVI" no cabeçalho e no ecrã de identificação.
   * Duas variantes prontas, porque a marca aparece sobre dois tipos de
   * fundo distintos na app e o elo/cruz central precisa de contraste
   * garantido em ambos — nunca `currentColor` sozinho, que só resolveria
   * o arco/elo, não a cruz interior:
   *   - marca(): arco e elo em navy, cruz em branco — fundo claro (ecrã
   *     de identificação, sobre --paper).
   *   - marcaClara(): arco e elo em branco, cruz em navy — fundo escuro
   *     (barra de topo, sobre --navy).
   * As ondas de sinal mantêm sempre o mesmo acento da marca (--accent),
   * que lê bem nos dois fundos.
   */
  function marcaBase(corArco, corCruz) {
    return '<span class="brand-glyph" aria-hidden="true">' +
      '<svg viewBox="0 0 44 44" fill="none">' +
      '<path d="M29 15.5a8 8 0 0 1 0 11" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>' +
      '<path d="M31.5 12.5a11.3 11.3 0 0 1 0 16" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" opacity="0.5"/>' +
      '<path d="M14 26a9.3 9.3 0 1 1 13-11.5" fill="none" stroke="' + corArco + '" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M14 26a9.3 9.3 0 0 0 8.3 4.6" fill="none" stroke="' + corArco + '" stroke-width="3.6" stroke-linecap="round"/>' +
      '<rect x="23" y="9.5" width="8.5" height="8.5" rx="2.2" fill="' + corArco + '"/>' +
      '<path d="M27.25 11.8v3.9M25.3 13.75h3.9" stroke="' + corCruz + '" stroke-width="1.7" stroke-linecap="round"/>' +
      "</svg></span>";
  }
  ICONS.marca = function () { return marcaBase("#0E2A3B", "#F6F5F1"); };
  ICONS.marcaClara = function () { return marcaBase("#F6F5F1", "#0E2A3B"); };

  global.SAVI_ICONS = ICONS;
})(window);
