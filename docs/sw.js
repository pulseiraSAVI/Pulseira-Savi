/*
 * SAVI — Service Worker
 *
 * Convenção do stack: qualquer alteração a CSS/HTML/JS cacheado tem de vir
 * acompanhada de um bump em SW_VERSION, senão utilizadores que já têm a
 * app instalada continuam a ver a versão antiga indefinidamente.
 */
const SW_VERSION = "savi-v6";
const CACHE_NAME = `savi-cache-${SW_VERSION}`;

// Caminhos relativos ao scope do service worker (raiz de frontend/), para
// funcionar tanto na raiz do domínio como num subcaminho de GitHub Pages
// (ex. https://<user>.github.io/savi/).
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/mockdb.js",
  "./js/worker-sim.js",
  "./js/auth-sim.js",
  "./js/router.js",
  "./js/app.js",
  "./js/views/login-profissional.js",
  "./js/views/login-familia.js",
  "./js/views/scan.js",
  "./js/views/resultado-nivel1.js",
  "./js/views/erro.js",
  "./js/views/familia-pacientes.js",
  "./js/views/familia-paciente-detalhe.js",
  "./js/views/admin-dashboard.js",
  "./js/views/admin-pacientes.js",
  "./js/views/admin-nivel1-form.js",
  "./js/views/admin-tokens.js",
  "./js/views/admin-profissionais.js",
  "./js/views/admin-auditoria.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
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
