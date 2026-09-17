/* hash-util.js
 * Utilitário partilhado de hash SHA-256 (hex), usado para o PIN
 * alfanumérico de 5 caracteres do papel utilizador/profissional.
 *
 * IMPORTANTE: mesmo sendo tudo simulado no browser nesta iteração, o PIN
 * nunca é guardado nem comparado em texto simples — usa-se sempre a Web
 * Crypto API nativa (crypto.subtle), a mesma técnica que o Worker real
 * (backend/cloudflare-worker/src/index.js) usa no servidor.
 */
(function (global) {
  "use strict";

  async function sha256Hex(texto) {
    var buf = new TextEncoder().encode(String(texto));
    var hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return Array.prototype.map
      .call(new Uint8Array(hashBuf), function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }

  global.hashUtil = { sha256Hex: sha256Hex };
})(window);
