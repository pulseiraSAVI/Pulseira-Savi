/* app.js — bootstrap da aplicação SAVI (demo). */
(function () {
  "use strict";

  function toast(mensagem) {
    var wrap = document.getElementById("toast-wrap");
    if (!wrap) return;
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = mensagem;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s ease";
      el.style.opacity = "0";
      setTimeout(function () { wrap.removeChild(el); }, 320);
    }, 4200);
  }
  window.SAVI_toast = toast;

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById("app");
    SAVI_router.init(root);
  });

  // Service worker só faz sentido servido por http(s) (GitHub Pages, etc.);
  // ao abrir index.html via file:// (fluxo de demo local) o browser nem
  // permite o registo, por isso a verificação de protocolo evita um erro
  // inofensivo na consola.
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.warn("SAVI: falha ao registar service worker", err);
      });
    });
  }
})();
