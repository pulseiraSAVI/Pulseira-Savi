/* views/admin-tokens.js — gerar lote, listar pulseiras por estado, atribuir a paciente. */
function viewAdminTokens(root) {
  "use strict";

  var sessao = authSim.getSessao();
  var mostrarForm = false;
  var filtroEstado = "todos";

  function render() {
    var pulseiras = mockdb.listPulseiras();
    var lotes = mockdb.listLotes();
    var pacientes = mockdb.listPacientes();

    var visiveis = filtroEstado === "todos" ? pulseiras : pulseiras.filter(function (p) { return p.estado === filtroEstado; });

    root.innerHTML = adminNav(sessao, "tokens") +
      '<div class="page">' +
      "<h1>Pulseiras e lotes</h1>" +
      '<p class="subtitle">' + pulseiras.length + " pulseiras · " + lotes.length + " lote(s) registado(s).</p>" +
      '<button class="btn btn-primary" id="btn-novo-lote" style="margin-bottom:16px;">+ Gerar novo lote</button>' +
      '<div id="form-lote"></div>' +

      '<h3 style="color:var(--navy);font-size:14px;">Lotes</h3>' +
      "<table><thead><tr><th>Fornecedor</th><th>Chip</th><th>Quantidade</th><th>Preço unit.</th><th>Receção</th></tr></thead><tbody id=\"tbody-lotes\"></tbody></table>" +

      '<h3 style="color:var(--navy);font-size:14px;margin-top:22px;">Pulseiras</h3>' +
      '<div style="margin-bottom:10px;">Filtrar: <select id="f-filtro" style="width:auto;display:inline-block;">' +
      ["todos", "nao_atribuida", "ativa", "desativada", "perdida", "substituida"].map(function (e) {
        return '<option value="' + e + '"' + (filtroEstado === e ? " selected" : "") + ">" + e + "</option>";
      }).join("") + "</select></div>" +
      "<table><thead><tr><th>Token</th><th>Estado</th><th>Paciente</th><th></th></tr></thead><tbody id=\"tbody-pulseiras\"></tbody></table>" +
      "</div>";

    document.getElementById("btn-novo-lote").addEventListener("click", function () {
      mostrarForm = !mostrarForm;
      renderFormLote();
    });
    document.getElementById("f-filtro").addEventListener("change", function (e) {
      filtroEstado = e.target.value;
      render();
    });

    var tbodyLotes = document.getElementById("tbody-lotes");
    lotes.forEach(function (l) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + l.fornecedor + "</td><td>" + l.chip_modelo + "</td><td>" + l.quantidade + "</td><td>" + (l.preco_unitario != null ? l.preco_unitario.toFixed(2) + " €" : "—") + "</td><td>" + (l.data_receção || "—") + "</td>";
      tbodyLotes.appendChild(tr);
    });

    var tbodyPulseiras = document.getElementById("tbody-pulseiras");
    visiveis.forEach(function (p) {
      var paciente = p.paciente_id ? mockdb.getPaciente(p.paciente_id) : null;
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + p.token + "</td>" +
        '<td><span class="badge ' + p.estado + '">' + p.estado + "</span></td>" +
        "<td>" + (paciente ? paciente.nome : "—") + "</td>" +
        "<td></td>";
      var tdAcao = tr.lastChild;

      if (p.estado === "nao_atribuida") {
        var select = document.createElement("select");
        select.style.width = "auto";
        select.style.display = "inline-block";
        var optDefault = document.createElement("option");
        optDefault.textContent = "Atribuir a...";
        optDefault.value = "";
        select.appendChild(optDefault);
        pacientes.forEach(function (pac) {
          var opt = document.createElement("option");
          opt.value = pac.id;
          opt.textContent = pac.nome;
          select.appendChild(opt);
        });
        select.addEventListener("change", function () {
          if (!select.value) return;
          mockdb.atribuirPulseira(p.id, select.value);
          SAVI_toast("Pulseira atribuída.");
          render();
        });
        tdAcao.appendChild(select);
      } else if (p.estado === "ativa") {
        var btnDesativar = document.createElement("button");
        btnDesativar.className = "btn btn-danger btn-sm";
        btnDesativar.textContent = "Desativar";
        btnDesativar.addEventListener("click", function () {
          var motivo = prompt("Motivo da desativação:");
          if (motivo === null) return;
          mockdb.desativarPulseira(p.id, motivo, "equipa");
          render();
        });
        tdAcao.appendChild(btnDesativar);
      }
      tbodyPulseiras.appendChild(tr);
    });

    renderFormLote();
  }

  function renderFormLote() {
    var el = document.getElementById("form-lote");
    if (!mostrarForm) { el.innerHTML = ""; return; }
    el.innerHTML =
      '<div class="card">' +
      '<h3 style="margin-top:0;color:var(--navy);font-size:15px;">Novo lote de pulseiras</h3>' +
      '<label>Fornecedor</label><input type="text" id="f-fornecedor" value="IdentiTag Lda.">' +
      '<label>Tipo de pulseira</label><input type="text" id="f-tipo" value="Silicone ajustável">' +
      '<label>Modelo de chip</label><select id="f-chip"><option value="NTAG213" selected>NTAG213</option><option value="NTAG424_DNA">NTAG424_DNA</option></select>' +
      '<label>Preço unitário (€)</label><input type="number" step="0.01" id="f-preco" value="2.35">' +
      '<label>Quantidade</label><input type="number" id="f-qtd" value="10">' +
      '<label>Data de encomenda</label><input type="date" id="f-encomenda">' +
      '<label>Data de receção</label><input type="date" id="f-rececao">' +
      '<label>Notas</label><textarea id="f-notas"></textarea>' +
      '<button class="btn btn-primary" id="f-submeter" style="margin-top:12px;">Gerar lote</button>' +
      "</div>";

    document.getElementById("f-submeter").addEventListener("click", function () {
      mockdb.gerarLote({
        fornecedor: document.getElementById("f-fornecedor").value,
        tipo_pulseira: document.getElementById("f-tipo").value,
        chip_modelo: document.getElementById("f-chip").value,
        preco_unitario: parseFloat(document.getElementById("f-preco").value),
        quantidade: parseInt(document.getElementById("f-qtd").value, 10),
        data_encomenda: document.getElementById("f-encomenda").value,
        data_receção: document.getElementById("f-rececao").value,
        notas: document.getElementById("f-notas").value
      });
      mostrarForm = false;
      SAVI_toast("Lote gerado com sucesso.");
      render();
    });
  }

  render();
}
