/* views/admin-contas.js
 * Secção "Contas" da vista de superadmin. Nesta ligação a Firestore
 * real, criar/editar (papéis, PIN, nome) e eliminar contas deixam de
 * estar disponíveis aqui: essas operações mexem em custom claims e no
 * próprio Firebase Authentication, o que exige o Admin SDK — o cliente
 * nunca pode fazê-lo diretamente, por regras do próprio Firebase, não
 * só do SAVI. Ver CLAUDE.md, roadmap "primeiro paciente real": o
 * caminho para isso continua a ser scripts/criar-conta.js, correndo
 * localmente com a service account.
 *
 * O que esta vista continua a fazer, em segurança, a partir do
 * cliente: listar contas e ativar/desativar (só o campo `ativo`, sem
 * tocar em Auth nem em custom claims).
 */
function viewAdminContas(root) {
  "use strict";

  var sessao = authSim.getSessao();

  async function render() {
    root.innerHTML = adminNav(sessao, "contas") + '<div class="page"><p class="subtitle">A carregar…</p></div>';

    var contas = await mockdb.listProfissionais();

    root.innerHTML = adminNav(sessao, "contas") +
      '<div class="page">' +
      "<h1>Contas</h1>" +
      '<p class="subtitle">' + contas.length + " conta(s) registada(s). Papéis: profissional, utilizador, superadmin (+ função de auditor).</p>" +
      '<div class="card" style="background:var(--unverified-bg);border:none;">' +
      '<p style="margin:0;font-size:12.5px;color:var(--ink-soft);">Criar conta, editar papéis/PIN e eliminar contas exigem o Admin SDK do Firebase (custom claims) — não é possível fazê-lo aqui a partir do browser. Use <code>scripts/criar-conta.js</code> na sua máquina. Esta lista permite só ativar/desativar contas já criadas.</p>' +
      "</div>" +
      "<table><thead><tr><th>Nome</th><th>Nº de Ordem</th><th>Papéis</th><th>Auditor</th><th>Estado</th><th></th></tr></thead><tbody id=\"tbody\"></tbody></table>" +
      "</div>";

    ligarBotaoSair();

    var tbody = document.getElementById("tbody");
    if (contas.length === 0) {
      var trVazio = document.createElement("tr");
      trVazio.innerHTML = '<td colspan="6"><div class="empty-state">Sem contas registadas.</div></td>';
      tbody.appendChild(trVazio);
    }
    contas.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + domUtil.escapeHtml(p.nome) + "</td>" +
        "<td>" + domUtil.escapeHtml(p.credencial_ordem) + "</td>" +
        "<td>" + rotulosPapeis(p.papeis) + "</td>" +
        "<td>" + ((p.papeis || []).indexOf("superadmin") !== -1 && p.funcao_auditor ? "Sim" : "—") + "</td>" +
        '<td><span class="badge ' + (p.ativo ? "ativo" : "revogado") + '">' + (p.ativo ? "ativo" : "inativo") + "</span></td>" +
        "<td></td>";
      var tdAcao = tr.lastChild;

      var btnEstado = document.createElement("button");
      btnEstado.className = "btn btn-sm " + (p.ativo ? "btn-danger" : "btn-ok");
      btnEstado.textContent = p.ativo ? "Desativar" : "Ativar";
      btnEstado.addEventListener("click", async function () {
        if (p.id === sessao.userId) { alert("Não pode desativar a própria conta com sessão iniciada."); return; }
        if (p.ativo) await mockdb.desativarProfissional(p.id); else await mockdb.ativarProfissional(p.id);
        render();
      });
      tdAcao.appendChild(btnEstado);

      tbody.appendChild(tr);
    });
  }

  function rotulosPapeis(papeis) {
    var mapa = { profissional: "Profissional", utilizador: "Utilizador", superadmin: "Superadmin" };
    return (papeis || []).map(function (p) { return mapa[p] || p; }).join(", ") || "—";
  }

  render();
}
