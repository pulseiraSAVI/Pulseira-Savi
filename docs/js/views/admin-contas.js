/* views/admin-contas.js
 * Secção "Contas" da vista de superadmin — criar/editar/eliminar contas
 * de profissionais e utilizadores (nome, nº de Ordem, papéis, PIN de 5
 * caracteres). Substitui o antigo ecrã "Profissionais" do modelo
 * anterior. O PIN é sempre guardado como hash (hash-util.js) — nunca em
 * texto simples, mesmo aqui.
 */
function viewAdminContas(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var mostrarForm = false;
  var editandoId = null;

  function render() {
    var contas = mockdb.listProfissionais();

    root.innerHTML = adminNav(sessao, "contas") +
      '<div class="page">' +
      "<h1>Contas</h1>" +
      '<p class="subtitle">' + contas.length + " conta(s) registada(s). Papéis: profissional, utilizador, superadmin (+ função de auditor).</p>" +
      '<button class="btn btn-primary" id="btn-novo" style="margin-bottom:16px;">+ Nova conta</button>' +
      '<div id="form-conta"></div>' +
      "<table><thead><tr><th>Nome</th><th>Nº de Ordem</th><th>Papéis</th><th>Auditor</th><th>Estado</th><th></th></tr></thead><tbody id=\"tbody\"></tbody></table>" +
      "</div>";

    ligarBotaoSair();

    document.getElementById("btn-novo").addEventListener("click", function () {
      editandoId = null;
      mostrarForm = !mostrarForm;
      renderForm();
    });

    var tbody = document.getElementById("tbody");
    contas.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + p.nome + "</td>" +
        "<td>" + p.credencial_ordem + "</td>" +
        "<td>" + rotulosPapeis(p.papeis) + "</td>" +
        "<td>" + (p.papeis.indexOf("superadmin") !== -1 && p.funcao_auditor ? "Sim" : "—") + "</td>" +
        '<td><span class="badge ' + (p.ativo ? "ativo" : "revogado") + '">' + (p.ativo ? "ativo" : "inativo") + "</span></td>" +
        "<td></td>";
      var tdAcao = tr.lastChild;

      var btnEditar = document.createElement("button");
      btnEditar.className = "btn btn-secondary btn-sm";
      btnEditar.textContent = "Editar / repor PIN";
      btnEditar.style.marginRight = "6px";
      btnEditar.addEventListener("click", function () {
        editandoId = p.id;
        mostrarForm = true;
        renderForm();
      });
      tdAcao.appendChild(btnEditar);

      var btnEstado = document.createElement("button");
      btnEstado.className = "btn btn-sm " + (p.ativo ? "btn-danger" : "btn-ok");
      btnEstado.textContent = p.ativo ? "Desativar" : "Ativar";
      btnEstado.style.marginRight = "6px";
      btnEstado.addEventListener("click", function () {
        if (p.ativo) mockdb.desativarProfissional(p.id); else mockdb.ativarProfissional(p.id);
        render();
      });
      tdAcao.appendChild(btnEstado);

      var btnEliminar = document.createElement("button");
      btnEliminar.className = "btn btn-danger btn-sm";
      btnEliminar.textContent = "Eliminar";
      btnEliminar.addEventListener("click", function () {
        if (p.id === sessao.userId) { alert("Não pode eliminar a própria conta com sessão iniciada."); return; }
        if (!confirm("Eliminar definitivamente a conta de " + p.nome + "?")) return;
        mockdb.eliminarProfissional(p.id);
        SAVI_toast("Conta eliminada.");
        render();
      });
      tdAcao.appendChild(btnEliminar);

      tbody.appendChild(tr);
    });

    renderForm();
  }

  function rotulosPapeis(papeis) {
    var mapa = { profissional: "Profissional", utilizador: "Utilizador", superadmin: "Superadmin" };
    return (papeis || []).map(function (p) { return mapa[p] || p; }).join(", ") || "—";
  }

  function renderForm() {
    var el = document.getElementById("form-conta");
    if (!el) return;
    if (!mostrarForm) { el.innerHTML = ""; return; }

    var contaExistente = editandoId ? mockdb.getProfissional(editandoId) : null;
    var papeisAtuais = contaExistente ? contaExistente.papeis : [];

    function checkbox(id, valor, label) {
      var marcado = papeisAtuais.indexOf(valor) !== -1;
      return '<label style="display:inline-flex;align-items:center;gap:6px;margin:8px 16px 0 0;font-weight:400;">' +
        '<input type="checkbox" id="' + id + '" value="' + valor + '" style="width:auto;"' + (marcado ? " checked" : "") + ">" + label + "</label>";
    }

    el.innerHTML =
      '<div class="card">' +
      '<h3 style="margin-top:0;color:var(--navy);font-size:15px;">' + (contaExistente ? "Editar conta — " + contaExistente.nome : "Nova conta") + "</h3>" +
      '<label>Nome completo</label><input type="text" id="f-nome" value="' + (contaExistente ? contaExistente.nome : "") + '">' +
      '<label>Nº de Ordem</label><input type="text" id="f-credencial" value="' + (contaExistente ? contaExistente.credencial_ordem : "") + '">' +
      '<label>Serviço</label><input type="text" id="f-servico" value="' + (contaExistente ? contaExistente.servico || "" : "Urgência") + '">' +
      '<label>Especialidade (usada como gestor do caso, se aplicável)</label><input type="text" id="f-especialidade" value="' + (contaExistente ? contaExistente.especialidade || "" : "") + '">' +
      '<label>Instituição + serviço</label><input type="text" id="f-instituicao" value="' + (contaExistente ? contaExistente.instituicao_servico || "" : "") + '">' +
      '<label>Telefone institucional</label><input type="text" id="f-telefone" value="' + (contaExistente ? contaExistente.telefone_institucional || "" : "") + '">' +
      "<div>" +
      '<label style="margin-bottom:2px;">Papéis</label>' +
      checkbox("f-papel-profissional", "profissional", "Profissional") +
      checkbox("f-papel-utilizador", "utilizador", "Utilizador (break-glass)") +
      checkbox("f-papel-superadmin", "superadmin", "Superadmin") +
      "</div>" +
      '<label style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-weight:400;">' +
      '<input type="checkbox" id="f-auditor" style="width:auto;"' + (contaExistente && contaExistente.funcao_auditor ? " checked" : "") + '> Função de auditor (só tem efeito se o papel superadmin estiver marcado)' +
      "</label>" +
      '<label>' + (contaExistente ? "Repor PIN (deixar em branco para manter o atual)" : "PIN (5 caracteres alfanuméricos)") + '</label>' +
      '<input type="text" id="f-pin" class="pin-input" maxlength="5" placeholder="•••••">' +
      '<p class="field-hint">O PIN é sempre guardado como hash SHA-256 — nunca em texto simples, mesmo nesta simulação.</p>' +
      '<div id="form-erro" style="color:var(--alert);font-size:12.5px;margin-top:4px;"></div>' +
      '<button class="btn btn-primary" id="f-submeter" style="margin-top:12px;">' + (contaExistente ? "Guardar alterações" : "Criar conta") + "</button>" +
      "</div>";

    document.getElementById("f-submeter").addEventListener("click", aoSubmeter);
  }

  async function aoSubmeter() {
    var erroEl = document.getElementById("form-erro");
    erroEl.textContent = "";

    var nome = document.getElementById("f-nome").value.trim();
    var credencial = document.getElementById("f-credencial").value.trim();
    var pin = document.getElementById("f-pin").value.trim().toUpperCase();
    var papeis = [];
    if (document.getElementById("f-papel-profissional").checked) papeis.push("profissional");
    if (document.getElementById("f-papel-utilizador").checked) papeis.push("utilizador");
    if (document.getElementById("f-papel-superadmin").checked) papeis.push("superadmin");

    if (!nome || !credencial) { erroEl.textContent = "Preencha nome e nº de Ordem."; return; }
    if (papeis.length === 0) { erroEl.textContent = "Selecione pelo menos um papel."; return; }
    if (!editandoId && pin.length !== 5) { erroEl.textContent = "O PIN tem de ter exatamente 5 caracteres."; return; }
    if (pin && pin.length !== 5) { erroEl.textContent = "O PIN tem de ter exatamente 5 caracteres."; return; }

    var dados = {
      nome: nome,
      credencial_ordem: credencial,
      servico: document.getElementById("f-servico").value.trim(),
      especialidade: document.getElementById("f-especialidade").value.trim(),
      instituicao_servico: document.getElementById("f-instituicao").value.trim(),
      telefone_institucional: document.getElementById("f-telefone").value.trim(),
      papeis: papeis,
      funcao_auditor: document.getElementById("f-auditor").checked
    };
    if (pin) dados.pinHash = await hashUtil.sha256Hex(pin);

    try {
      if (editandoId) {
        mockdb.atualizarProfissional(editandoId, dados);
        SAVI_toast("Conta atualizada.");
      } else {
        mockdb.criarProfissional(dados);
        SAVI_toast("Conta criada.");
      }
      mostrarForm = false;
      editandoId = null;
      render();
    } catch (e) {
      erroEl.textContent = e.message;
    }
  }

  render();
}
