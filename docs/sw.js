/*
 * SAVI — Service Worker
 *
 * Convenção do stack: qualquer alteração a CSS/HTML/JS cacheado tem de vir
 * acompanhada de um bump em SW_VERSION, senão utilizadores que já têm a
 * app instalada continuam a ver a versão antiga indefinidamente.
 *
 * v7: pivô de produção de 15/09/2026 — novo modelo de papéis (utilizador/
 * profissional/superadmin+auditor), 3 métodos de acesso, Nível 1 novo
 * (cabeçalho + 4 secções de footer), Nível 2 eliminado, família suspensa.
 *
 * v8 (25/09/2026): camada de design — ícones SVG (js/icons.js, substitui
 * todos os emojis da interface) e marca nova (icons/icon.svg, pulseira +
 * cruz + sinal). Aproveitado para corrigir a lista ASSETS abaixo, que
 * tinha ficado desatualizada desde a ligação à infraestrutura real
 * (ainda apontava para worker-sim.js/auth-sim.js, e nunca chegou a
 * incluir firebase-init.js/firestore-real.js/worker-real.js/
 * auth-real.js nem icons.js) — sem irmos ao Nível 2 do CLAUDE.md
 * (não existe), mas isto significava que o precache do service worker
 * nunca tinha os ficheiros certos.
 */
const SW_VERSION = "savi-v8";
const CACHE_NAME = `savi-cache-${SW_VERSION}`;

// Caminhos relativos ao scope do service worker (raiz de docs/), para
// funcionar tanto na raiz do domínio como num subcaminho de GitHub Pages
// (ex. https://<user>.github.io/savi/). Mesma ordem de index.html.
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/icons.js",
  "./js/hash-util.js",
  "./js/firebase-init.js",
  "./js/mockdb.js",
  "./js/firestore-real.js",
  "./js/worker-real.js",
  "./js/auth-real.js",
  "./js/views/nav-helpers.js",
  "./js/views/identificacao.js",
  "./js/views/escolha-papel.js",
  "./js/views/utilizador-metodo.js",
  "./js/views/utilizador-pulseira.js",
  "./js/views/utilizador-numero-utente.js",
  "./js/views/utilizador-identidade.js",
  "./js/views/resultado-nivel1.js",
  "./js/views/erro.js",
  "./js/views/pacientes-lista.js",
  "./js/views/nivel1-form.js",
  "./js/views/admin-dashboard.js",
  "./js/views/admin-tokens.js",
  "./js/views/admin-contas.js",
  "./js/views/admin-auditoria.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first para os recursos da app; qualquer coisa fora da lista (ex.
// chamadas futuras a um backend real) vai sempre à rede.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
