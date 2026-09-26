/* views/admin-contas.js
 * Secção "Contas" da vista de superadmin.
 *
 * Atualizado em 26/09/2026 (roadmap "gestão de contas desde a app" +
 * correção do achado C1 da auditoria de segurança — ver
 * AUDITORIA_SEGURANCA_25-09-2026.md): criar conta, editar papéis/dados e
 * reiniciar o PIN passam a ser possíveis a partir daqui, através de
 * endpoints novos no Worker (POST /admin/contas, PATCH
 * /admin/contas/:id, POST /admin/contas/:id/reset-pin) — nunca
 * diretamente contra o Firestore, porque só o Worker (com a service
 * account) pode gerar o hash do PIN com sal e o Custom Token
 * correspondente. `scripts/criar-conta.js` deixa de ser o único caminho;
 * mantém-se só para o bootstrap da primeira conta superadmin.
 *
 * Continua a não ser possível eliminar contas daqui — o efeito em
 * cascata sobre pacientes já criados por essa conta ainda não foi
 * decidido (ver ROADMAP_MELHORIAS.md, 1.1). Ativar/desativar continua a
 * ser feito diretamente contra o Firestore (mockdb.ativarProfissional/
 * desativarProfissional), sem passar pelo Worker — é uma troca simples
 * do campo `ativo`, já coberta pelas Firestore Rules para o superadmin.
 */
function viewAdminContas(root) {
  "use strict";

  var WORKER_BASE_URL = "https://savi-worker.pulseira-savi.workers.dev";
  var sessao = authSim.getSessao();
  var papeisDisponiveis = [["profissional", "Profissional"], ["utilizador", "Utilizador"], ["superadmin", "Superadmin"]];

  var mostrarFormCriar = false;
  var idEmEdicao = null; // uid da conta a editar, ou null

  async function chamarAdmin(caminho, metodo, corpo) {
    var idToken = await authSim.getIdToken();
    var resp;
    try {
      resp = await fetch(WORKER_BASE_URL + caminho, {
        method: metodo,
        headers: { "content-type": "application/json", authorization: "Bearer " + idToken },
        body: corpo ? JSON.stringify(corpo) : undefined
      });
    } catch (e) {
      throw new Error("Não foi possível contactar o servidor. Verifique a ligação à internet.");
    }
    var payload = null;
    try { payload = await resp.json(); } catch (e) { /* sem corpo JSON */ }
    if (!resp.ok) {
      throw new Error((payload && payload.mensagem) || "Ocorreu um erro ao processar o pedido.");
    }
    return payload;
  }

  async function render() {
    root.innerHTML = adminNav(sessao, "contas") + '<div class="page"><p class="subtitle">A carregar…</p></div>';

    var contas = await mockdb.listProfissionais();

    root.innerHTML = adminNav(sessao, "contas") +
      '<div class="page">' +
      "<h1>Contas</h1>" +
      '<p class="subtitle">' + contas.length + " conta(s) registada(s). Papéis: profissional, utilizador, superadmin (+ função de auditor).</p>" +
      '<button class="btn btn-primary" id="btn-nova-conta" style="margin-bottom:16px;">+ Criar conta</button>' +
      '<div id="form-nova-conta"></div>' +
      "<table><thead><tr><th>Nome</th><th>Nº de Ordem</th><th>Papéis</th><th>Auditor</th><th>Estado</th><th></th></tr></thead><tbody id=\"tbody\"></tbody></table>" +
      "</div>";

    ligarBotaoSair();

    document.getElementById("btn-nova-conta").addEventListener("click", function () {
      mostrarFormCriar = !mostrarFormCriar;
      idEmEdicao = null;
      renderFormCriar();
    });

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

      var btnEditar = document.createElement("button");
      btnEditar.className = "btn btn-secondary btn-sm";
      btnEditar.textContent = "Editar";
      btnEditar.style.marginRight = "6px";
      btnEditar.addEventListener("click", function () {
        idEmEdicao = idEmEdicao === p.id ? null : p.id;
        mostrarFormCriar = false;
        renderFormEditar(p);
      });
      tdAcao.appendChild(btnEditar);

      var btnResetPin = document.createElement("button");
      btnResetPin.className = "btn btn-secondary btn-sm";
      btnResetPin.textContent = "Reiniciar PIN";
      btnResetPin.style.marginRight = "6px";
      btnResetPin.addEventListener("click", async function () {
        if (!confirm("Gerar um PIN novo para " + p.nome + "? O PIN atual deixa de funcionar de imediato.")) return;
        btnResetPin.disabled = true;
        try {
          var resultado = await chamarAdmin("/admin/contas/" + p.id + "/reset-pin", "POST", {});
          alert("PIN reiniciado para " + p.nome + ".\n\nNovo PIN: " + resultado.pin + "\n\nComunique-o à pessoa por um canal seguro — não fica guardado em lado nenhum a partir de agora.");
        } catch (e) {
          alert(e.message);
        } finally {
          btnResetPin.disabled = false;
        }
      });
      tdAcao.appendChild(btnResetPin);

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

      if (idEmEdicao === p.id) {
        var trForm = document.createElement("tr");
        var tdForm = document.createElement("td");
        tdForm.colSpan = 6;
        tdForm.id = "form-editar-" + p.id;
        trForm.appendChild(tdForm);
        tbody.appendChild(trForm);
      }
    });

    renderFormCriar();
    if (idEmEdicao) {
      var contaEmEdicao = contas.find(function (c) { return c.id === idEmEdicao; });
      if (contaEmEdicao) renderFormEditar(contaEmEdicao);
    }
  }

  function checkboxesPapeis(idPrefixo, papeisAtuais) {
    return papeisDisponiveis.map(function (par) {
      var marcado = (papeisAtuais || []).indexOf(par[0]) !== -1;
      return '<label style="display:inline-flex;align-items:center;gap:4px;margin-right:14px;font-weight:400;">' +
        '<input type="checkbox" class="' + idPrefixo + '-papel" value="' + par[0] + '"' + (marcado ? " checked" : "") + "> " + par[1] +
        "</label>";
    }).join("");
  }

  function renderFormCriar() {
    var el = document.getElementById("form-nova-conta");
    if (!el) return;
    if (!mostrarFormCriar) { el.innerHTML = ""; return; }
    el.innerHTML =
      '<div class="card">' +
      '<h3 style="margin-top:0;color:var(--navy);font-size:15px;">Criar conta nova</h3>' +
      '<div class="grid-2">' +
      '<div><label>Nome completo</label><input type="text" id="fc-nome"></div>' +
      '<div><label>Nº de Ordem</label><input type="text" id="fc-credencial"></div>' +
      "</div>" +
      '<label>Papéis</label><div style="margin-bottom:10px;">' + checkboxesPapeis("fc", []) + "</div>" +
      '<label style="display:inline-flex;align-items:center;gap:4px;font-weight:400;"><input type="checkbox" id="fc-auditor"> Função de auditor (só com papel superadmin)</label>' +
      '<div class="grid-2" style="margin-top:10px;">' +
      '<div><label>Serviço</label><input type="text" id="fc-servico"></div>' +
      '<div><label>Especialidade</label><input type="text" id="fc-especialidade"></div>' +
      "</div>" +
      '<div class="grid-2">' +
      '<div><label>Instituição + serviço</label><input type="text" id="fc-instituicao"></div>' +
      '<div><label>Telefone institucional</label><input type="text" id="fc-telefone"></div>' +
      "</div>" +
      '<p class="field-hint">O PIN é gerado automaticamente e mostrado uma única vez, no fim — comunique-o à pessoa por um canal seguro.</p>' +
      '<button class="btn btn-primary" id="fc-submeter" style="margin-top:12px;">Criar conta</button>' +
      "</div>";

    document.getElementById("fc-submeter").addEventListener("click", async function () {
      var nome = document.getElementById("fc-nome").value.trim();
      var credencial = document.getElementById("fc-credencial").value.trim();
      var papeis = Array.prototype.slice.call(document.querySelectorAll(".fc-papel:checked")).map(function (c) { return c.value; });
      if (!nome || !credencial || papeis.length === 0) { alert("Preencha nome, nº de Ordem e pelo menos um papel."); return; }
      var botao = document.getElementById("fc-submeter");
      botao.disabled = true;
      try {
        var resultado = await chamarAdmin("/admin/contas", "POST", {
          nome: nome,
          credencial_ordem: credencial,
          papeis: papeis,
          funcao_auditor: document.getElementById("fc-auditor").checked,
          servico: document.getElementById("fc-servico").value.trim(),
          especialidade: document.getElementById("fc-especialidade").value.trim(),
          instituicao_servico: document.getElementById("fc-instituicao").value.trim(),
          telefone_institucional: document.getElementById("fc-telefone").value.trim()
        });
        mostrarFormCriar = false;
        alert("Conta criada.\n\nNº de Ordem: " + resultado.credencial_ordem + "\nPIN: " + resultado.pin + "\n\nComunique-os à pessoa por um canal seguro — o PIN não fica guardado em lado nenhum a partir de agora.");
        render();
      } catch (e) {
        alert(e.message);
      } finally {
        botao.disabled = false;
      }
    });
  }

  function renderFormEditar(conta) {
    var el = document.getElementById("form-editar-" + conta.id);
    if (!el) return;
    el.innerHTML =
      '<div class="card" style="margin:6px 0;">' +
      '<h3 style="margin-top:0;color:var(--navy);font-size:14px;">Editar — ' + domUtil.escapeHtml(conta.nome) + "</h3>" +
      '<div class="grid-2">' +
      '<div><label>Nome completo</label><input type="text" id="fe-nome" value="' + domUtil.escapeHtml(conta.nome) + '"></div>' +
      '<div></div>' +
      "</div>" +
      '<label>Papéis</label><div style="margin-bottom:10px;">' + checkboxesPapeis("fe", conta.papeis) + "</div>" +
      '<label style="display:inline-flex;align-items:center;gap:4px;font-weight:400;"><input type="checkbox" id="fe-auditor"' + (conta.funcao_auditor ? " checked" : "") + "> Função de auditor (só com papel superadmin)</label>" +
      '<div class="grid-2" style="margin-top:10px;">' +
      '<div><label>Serviço</label><input type="text" id="fe-servico" value="' + domUtil.escapeHtml(conta.servico || "") + '"></div>' +
      '<div><label>Especialidade</label><input type="text" id="fe-especialidade" value="' + domUtil.escapeHtml(conta.especialidade || "") + '"></div>' +
      "</div>" +
      '<div class="grid-2">' +
      '<div><label>Instituição + serviço</label><input type="text" id="fe-instituicao" value="' + domUtil.escapeHtml(conta.instituicao_servico || "") + '"></div>' +
      '<div><label>Telefone institucional</label><input type="text" id="fe-telefone" value="' + domUtil.escapeHtml(conta.telefone_institucional || "") + '"></div>' +
      "</div>" +
      '<div style="margin-top:12px;display:flex;gap:8px;">' +
      '<button class="btn btn-primary btn-sm" id="fe-submeter">Guardar alterações</button>' +
      '<button class="btn btn-secondary btn-sm" id="fe-cancelar">Cancelar</button>' +
      "</div></div>";

    document.getElementById("fe-cancelar").addEventListener("click", function () {
      idEmEdicao = null;
      render();
    });

    document.getElementById("fe-submeter").addEventListener("click", async function () {
      var papeis = Array.prototype.slice.call(document.querySelectorAll(".fe-papel:checked")).map(function (c) { return c.value; });
      if (papeis.length === 0) { alert("Pelo menos um papel é obrigatório."); return; }
      var botao = document.getElementById("fe-submeter");
      botao.disabled = true;
      try {
        await chamarAdmin("/admin/contas/" + conta.id, "PATCH", {
          nome: document.getElementById("fe-nome").value.trim(),
          papeis: papeis,
          funcao_auditor: document.getElementById("fe-auditor").checked,
          servico: document.getElementById("fe-servico").value.trim(),
          especialidade: document.getElementById("fe-especialidade").value.trim(),
          instituicao_servico: document.getElementById("fe-instituicao").value.trim(),
          telefone_institucional: document.getElementById("fe-telefone").value.trim()
        });
        idEmEdicao = null;
        SAVI_toast("Conta atualizada.");
        render();
      } catch (e) {
        alert(e.message);
        botao.disabled = false;
      }
    });
  }

  function rotulosPapeis(papeis) {
    var mapa = { profissional: "Profissional", utilizador: "Utilizador", superadmin: "Superadmin" };
    return (papeis || []).map(function (p) { return mapa[p] || p; }).join(", ") || "—";
  }

  render();
}
