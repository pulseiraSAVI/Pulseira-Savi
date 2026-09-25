/**
 * firebase-init.js
 * SAVI — inicialização real do Firebase (Auth + Firestore), projeto
 * `pulseira-savi`. Substitui progressivamente `auth-sim.js`/`mockdb.js`.
 *
 * Estes valores (apiKey, authDomain, projectId, etc.) NÃO são segredos —
 * são o identificador público do cliente web, o mesmo que aparece nos
 * URLs da consola Firebase. A segurança real vive nas Firestore Security
 * Rules (backend/firestore.rules) e na validação do PIN no Worker, nunca
 * na confidencialidade deste ficheiro.
 *
 * Nota técnica importante: este ficheiro usa `type="module"` (ver
 * index.html) porque a Firebase JS SDK v10+ só é distribuída como módulos
 * ES. Isso tem uma consequência prática: a app deixa de poder correr
 * abrindo `index.html` diretamente por `file://` (os browsers bloqueiam
 * `import` de módulos nesse esquema por CORS) — a partir de agora, para
 * testar localmente, correr um servidor estático simples, por exemplo:
 *   cd docs && python3 -m http.server 8000
 * e abrir http://localhost:8000. Em produção isto não muda nada, porque
 * o GitHub Pages já serve tudo por https.
 *
 * measurementId (Google Analytics) foi deliberadamente omitido: o SAVI
 * lida com dados de saúde, não faz sentido nenhum enviar eventos de
 * utilização a ferramentas de terceiros — ver CLAUDE.md, princípio de
 * nunca partilhar dados de pacientes.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDG5sHLyGKU7Y-iNPvEzH0t20yqIMA0BRU",
  authDomain: "pulseira-savi.firebaseapp.com",
  projectId: "pulseira-savi",
  storageBucket: "pulseira-savi.firebasestorage.app",
  messagingSenderId: "434216995440",
  appId: "1:434216995440:web:066b05ff0af65723a402b5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Os scripts do resto da app (auth-real.js, etc.) continuam a ser
// scripts normais, não módulos — ver a nota em index.html sobre a ordem
// de carregamento. Por isso este módulo expõe o que for preciso em
// `window.firebaseSDK`, em vez de usar `export`.
window.firebaseSDK = {
  auth,
  db,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
};

// auth-real.js espera por este evento antes de usar window.firebaseSDK,
// para não depender da ordem de execução entre um <script type="module">
// (sempre adiado, como um `defer`) e os <script> normais que vêm antes
// dele no HTML.
window.dispatchEvent(new Event("firebase-pronto"));
