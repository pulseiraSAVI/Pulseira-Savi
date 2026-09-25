/* js/dom-util.js
 * SAVI — utilitário partilhado de escaping de HTML.
 *
 * Adicionado na auditoria de segurança de 25/09/2026 (ver
 * AUDITORIA_SEGURANCA_25-09-2026.md): várias views construíam HTML por
 * concatenação de strings e inseriam dados guardados pelo profissional
 * (nome/morada/contactos do paciente, notas clínicas, motivo de acesso
 * por identidade, nome de profissionais/documentos) diretamente em
 * `innerHTML`, sem qualquer escaping. Isso é XSS armazenado: um valor
 * como `<img src=x onerror=...>` gravado num campo de texto livre
 * executa mais tarde no browser de QUEM VIR esse ecrã — no pior caso
 * (campo `motivo` do acesso por identidade, mostrado em
 * admin-auditoria.js) isso significa um utilizador comum a conseguir
 * correr código no browser do superadmin/auditor.
 *
 * `escapeHtml` cobre os dois contextos usados na app: texto entre tags
 * (`<p>` + escapeHtml(valor) + `</p>`) e valor de atributo entre aspas
 * duplas (`value="` + escapeHtml(valor) + `"`) — escapar & < > " ' chega
 * para os dois casos.
 *
 * Uso: sempre que uma view concatena para innerHTML um valor que não é
 * um literal escrito no próprio código (ou seja, qualquer coisa vinda de
 * `paciente.*`, `dados.*`, `profissional.*`, `acesso.*`, nomes de
 * ficheiro, etc.), passar por `domUtil.escapeHtml(...)` primeiro.
 */
(function (global) {
  "use strict";

  function escapeHtml(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  global.domUtil = { escapeHtml: escapeHtml };
})(window);
