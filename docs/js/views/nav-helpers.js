/* views/nav-helpers.js
 * Barras de navegação partilhadas pelas vistas de profissional e de
 * superadmin, e pequenos componentes reutilizados (statCard).
 * Carregado antes das views que as usam (ver index.html).
 */

function statCard(numero, label) {
  return '<div class="stat-card"><div class="n">' + numero + '</div><div class="l">' + label + "</div></div>";
}

/* Barra de navegação da vista de superadmin. Não existe uma quarta vista
 * de "painel de controlo" — é exatamente este conteúdo. A secção de
 * Auditoria só aparece com funcao_auditor=true. */
function adminNav(sessao, ativo) {
  function item(hash, label, chave) {
    var estilo = ativo === chave ? "font-weight:800;color:#fff;" : "color:#C9D8DF;";
    return '<a href="#/admin/' + hash + '" style="' + estilo + 'text-decoration:none;font-size:13px;margin-right:16px;">' + label + "</a>";
  }
  var auditoriaLink = sessao.funcao_auditor ? item("auditoria", "Segurança / Auditoria", "auditoria") : "";
  return (
    '<div class="app-topbar" style="flex-wrap:wrap;gap:8px;">' +
    '<div class="brand">' + SAVI_ICONS.marcaClara() + '<span class="brand-text">SAVI <small>Superadmin</small></span></div>' +
    '<div class="user-info">' + sessao.nome + ' <button class="logout" id="btn-sair-topo">Terminar sessão</button></div>' +
    "</div>" +
    '<div style="background:var(--navy-2);padding:10px 20px;display:flex;flex-wrap:wrap;">' +
    item("dashboard", "Dashboard", "dashboard") +
    item("pacientes", "Pacientes", "pacientes") +
    item("tokens", "Pulseiras / Lotes", "tokens") +
    item("contas", "Contas", "contas") +
    auditoriaLink +
    "</div>"
  );
}

/* Barra de navegação da vista de profissional — só os pacientes que o
 * próprio profissional criou. */
function profissionalNav(sessao, ativo) {
  function item(hash, label, chave) {
    var estilo = ativo === chave ? "font-weight:800;color:#fff;" : "color:#C9D8DF;";
    return '<a href="#/profissional/' + hash + '" style="' + estilo + 'text-decoration:none;font-size:13px;margin-right:16px;">' + label + "</a>";
  }
  return (
    '<div class="app-topbar" style="flex-wrap:wrap;gap:8px;">' +
    '<div class="brand">' + SAVI_ICONS.marcaClara() + '<span class="brand-text">SAVI <small>Profissional</small></span></div>' +
    '<div class="user-info">' + sessao.nome + ' <button class="logout" id="btn-sair-topo">Terminar sessão</button></div>' +
    "</div>" +
    '<div style="background:var(--navy-2);padding:10px 20px;display:flex;flex-wrap:wrap;">' +
    item("pacientes", "Os meus pacientes", "pacientes") +
    "</div>"
  );
}

// Liga o botão "Terminar sessão" comum às duas barras — chamado pelas
// views depois de injetar o HTML no DOM (o botão só existe após o innerHTML).
function ligarBotaoSair() {
  var btn = document.getElementById("btn-sair-topo");
  if (btn) {
    btn.addEventListener("click", function () {
      authSim.logout();
      SAVI_router.navegar("#/identificacao");
    });
  }
}
