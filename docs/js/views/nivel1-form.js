/* views/nivel1-form.js
 * Edição de paciente + dados clínicos (Nível 1) — partilhada entre a
 * vista de profissional (só os pacientes que criou) e a vista de
 * superadmin (qualquer paciente, com ação extra "Verificar" já incluída
 * para ambos, dupla verificação mantida — CLAUDE.md).
 *
 * Estruturalmente espelha as 3 secções editáveis do Nível 1 novo (Dados
 * do utente / Algoritmo / Medicação Habitual — a 4ª secção,
 * "Configuração", é uma definição pessoal do utilizador break-glass, não
 * faz sentido em modo de edição de paciente). Mostradas empilhadas, com
 * cabeçalho próprio, para dar visibilidade total do registo antes de
 * guardar — ao contrário do ecrã de leitura rápida (resultado-nivel1.js),
 * que usa separadores de footer.
 *
 * Controlo de acesso: com Firestore real, quem decide se este
 * profissional pode ver/editar este paciente são as próprias Security
 * Rules (backend/firestore.rules) — não uma verificação no cliente. Se
 * mockdb.getPaciente() abaixo for rejeitado (permission-denied), é
 * porque as regras já negaram o acesso.
 *
 * @param {string} contexto 'profissional' | 'admin'
 */
function viewNivel1Form(root, pacienteId, contexto) {
  "use strict";

  var sessao = authSim.getSessao();
  var ehAdmin = contexto === "admin";
  var autor = { id: sessao.userId, ehSuperadmin: ehAdmin };
  var hashVoltar = ehAdmin ? "#/admin/pacientes" : "#/profissional/pacientes";
  var mostrarFormDoc = false;

  async function render() {
    root.innerHTML = '<div class="page"><p class="subtitle">A carregar…</p></div>';

    var paciente;
    try {
      paciente = await mockdb.getPaciente(pacienteId);
    } catch (e) {
      SAVI_router.navegar("#/erro/acesso_negado");
      return;
    }
    if (!paciente) { SAVI_router.navegar(hashVoltar); return; }

    var dados = (await mockdb.getDadosNivel1(pacienteId)) || {};
    var gestor = paciente.gestor_do_caso || {};
    var documentos = await mockdb.listDocumentosDoPaciente(pacienteId);
    var pulseiras = (await mockdb.listPulseirasDoPaciente(pacienteId)).filter(function (p) { return p.estado === "ativa"; });
    var nav = ehAdmin ? adminNav(sessao, "pacientes") : profissionalNav(sessao, "pacientes");

    root.innerHTML = nav +
      '<div class="page">' +
      '<button class="link-discreto" id="btn-voltar" style="margin-bottom:10px;">← Pacientes</button>' +
      "<h1>" + paciente.nome + "</h1>" +
      '<p class="subtitle">Nível 1. Estado clínico: <span class="badge ' + (dados.estado_verificacao || "nao_verificado") + '">' + (dados.estado_verificacao || "nao_verificado") + "</span>" +
      (dados.escrito_em ? " · última escrita em " + new Date(dados.escrito_em).toLocaleString("pt-PT") : "") +
      "</p>" +

      "<h2 style=\"font-size:15px;color:var(--navy);margin:20px 0 8px;\">1 · Dados do utente</h2>" +
      '<div class="grid-2">' +
      '<div class="card">' +
      '<label>Nome completo</label><input type="text" id="f-nome" value="' + escapeAttr(paciente.nome) + '">' +
      '<label>Data de nascimento</label><input type="date" id="f-nascimento" value="' + (paciente.data_nascimento || "") + '">' +
      selectField("f-sexo", "Sexo", paciente.sexo, [["F", "Feminino"], ["M", "Masculino"], ["outro", "Outro"]]) +
      '<label>Número de utente</label><input type="text" id="f-numero-utente" value="' + escapeAttr(paciente.numero_utente || "") + '">' +
      '<label>Morada</label><input type="text" id="f-morada" value="' + escapeAttr(paciente.morada || "") + '">' +
      '<label>Contacto de familiares</label><input type="text" id="f-contacto-familia" value="' + escapeAttr(paciente.contacto_familia || "") + '">' +
      '<label>Contacto de emergência</label><input type="text" id="f-contacto-emergencia" value="' + escapeAttr(paciente.contacto_emergencia || "") + '">' +
      selectField("f-consentimento", "Estado do consentimento (papel, arquivado em Documentos)", paciente.estado_consentimento, [["pendente", "Pendente"], ["ativo", "Ativo"], ["revogado", "Revogado"]]) +
      "</div>" +
      '<div class="card"><h3 style="margin-top:0;font-size:14px;color:var(--navy);">Gestor do caso</h3>' +
      '<label>Nome completo</label><input type="text" id="f-gc-nome" value="' + escapeAttr(gestor.nome || "") + '">' +
      '<label>Nº de Ordem médica</label><input type="text" id="f-gc-ordem" value="' + escapeAttr(gestor.credencial_ordem || "") + '">' +
      '<label>Especialidade</label><input type="text" id="f-gc-especialidade" value="' + escapeAttr(gestor.especialidade || "") + '">' +
      '<label>Instituição + serviço</label><input type="text" id="f-gc-instituicao" value="' + escapeAttr(gestor.instituicao_servico || "") + '">' +
      '<label>Telefone institucional</label><input type="text" id="f-gc-telefone" value="' + escapeAttr(gestor.telefone_institucional || "") + '">' +
      "</div>" +
      "</div>" +

      "<h2 style=\"font-size:15px;color:var(--navy);margin:20px 0 8px;\">2 · Algoritmo</h2>" +
      '<div class="grid-2">' +
      '<div class="card">' +
      '<label>Peso (kg)</label><input type="number" step="0.1" id="f-peso" value="' + (dados.peso_kg ?? "") + '">' +
      '<label>Altura (cm)</label><input type="number" step="0.1" id="f-altura" value="' + (dados.altura_cm ?? "") + '">' +
      '<label>Data de registo da biometria</label><input type="date" id="f-biom-data" value="' + (dados.biometria_registada_em || "") + '">' +
      '<label>Alergias</label><textarea id="f-alergias">' + (dados.alergias || "") + "</textarea>" +
      "</div>" +
      '<div class="card">' +
      '<label>Condição crítica</label><textarea id="f-condicao">' + (dados.condicao_critica || "") + "</textarea>" +
      '<label>Esquema de dose</label><textarea id="f-esquema-dose">' + (dados.esquema_dose || "") + "</textarea>" +
      '<label>Medicação contraindicada</label><textarea id="f-medicacao-contra">' + (dados.medicacao_contraindicada || "") + "</textarea>" +
      "</div>" +
      "</div>" +
      '<div class="card">' +
      selectField("f-limitacao", "Limitação terapêutica", dados.limitacao_terapeutica, [["sim", "Sim"], ["nao", "Não"], ["nao_aplicavel", "Não aplicável"]]) +
      '<label>Esquema de atuação perante crise</label><textarea id="f-crise">' + (dados.esquema_atuacao_crise || "") + "</textarea>" +
      '<label>Notas</label><textarea id="f-notas">' + (dados.notas || "") + "</textarea>" +
      "</div>" +

      "<h2 style=\"font-size:15px;color:var(--navy);margin:20px 0 8px;\">3 · Medicação Habitual</h2>" +
      '<div class="card">' +
      '<label>Medicação crónica + horário habitual de administração</label><textarea id="f-medicacao-cronica">' + (dados.medicacao_cronica || "") + "</textarea>" +
      "</div>" +
      '<div class="card">' +
      '<h3 style="margin-top:0;font-size:14px;color:var(--navy);">Documentos (RGPD + termo de responsabilidade)</h3>' +
      '<div class="doc-list" id="lista-docs">' + renderListaDocs(documentos) + "</div>" +
      '<button class="btn btn-secondary btn-sm" id="btn-anexar" style="margin-top:10px;">+ Anexar documento</button>' +
      '<div id="form-doc"></div>' +
      "</div>" +

      '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">' +
      '<button class="btn btn-primary" id="btn-guardar">Guardar alterações</button>' +
      '<button class="btn btn-ok" id="btn-verificar">Verificar registo clínico</button>' +
      (pulseiras.length === 0
        ? '<button class="btn btn-secondary" id="btn-pulseira">Solicitar pulseira</button>'
        : '<span class="badge ativa" style="align-self:center;">Pulseira ativa: ' + pulseiras[0].token + "</span>") +
      "</div>" +
      "</div>";

    ligarBotaoSair();

    document.getElementById("btn-voltar").addEventListener("click", function () { SAVI_router.navegar(hashVoltar); });

    document.getElementById("btn-guardar").addEventListener("click", async function () {
      try {
        await mockdb.atualizarPaciente(pacienteId, {
          nome: document.getElementById("f-nome").value.trim(),
          data_nascimento: document.getElementById("f-nascimento").value,
          sexo: document.getElementById("f-sexo").value,
          numero_utente: document.getElementById("f-numero-utente").value.trim(),
          morada: document.getElementById("f-morada").value.trim(),
          contacto_familia: document.getElementById("f-contacto-familia").value.trim(),
          contacto_emergencia: document.getElementById("f-contacto-emergencia").value.trim(),
          estado_consentimento: document.getElementById("f-consentimento").value,
          gestor_do_caso: {
            nome: document.getElementById("f-gc-nome").value.trim(),
            credencial_ordem: document.getElementById("f-gc-ordem").value.trim(),
            especialidade: document.getElementById("f-gc-especialidade").value.trim(),
            instituicao_servico: document.getElementById("f-gc-instituicao").value.trim(),
            telefone_institucional: document.getElementById("f-gc-telefone").value.trim()
          }
        });
        await mockdb.escreverDadosNivel1(pacienteId, {
          peso_kg: parseFloat(document.getElementById("f-peso").value) || null,
          altura_cm: parseFloat(document.getElementById("f-altura").value) || null,
          biometria_registada_em: document.getElementById("f-biom-data").value || null,
          alergias: document.getElementById("f-alergias").value,
          condicao_critica: document.getElementById("f-condicao").value,
          esquema_dose: document.getElementById("f-esquema-dose").value,
          medicacao_contraindicada: document.getElementById("f-medicacao-contra").value,
          limitacao_terapeutica: document.getElementById("f-limitacao").value,
          esquema_atuacao_crise: document.getElementById("f-crise").value,
          notas: document.getElementById("f-notas").value,
          medicacao_cronica: document.getElementById("f-medicacao-cronica").value
        }, autor);
        SAVI_toast("Dados guardados. Estado de verificação reposto para 'não verificado'.");
        render();
      } catch (e) {
        alert(e.message);
      }
    });

    document.getElementById("btn-verificar").addEventListener("click", async function () {
      try {
        await mockdb.verificarDadosNivel1(pacienteId, autor);
        SAVI_toast("Registo clínico marcado como verificado.");
        render();
      } catch (e) {
        alert(e.message);
      }
    });

    var btnPulseira = document.getElementById("btn-pulseira");
    if (btnPulseira) {
      btnPulseira.addEventListener("click", async function () {
        try {
          var p = await mockdb.solicitarPulseiraParaPaciente(pacienteId);
          SAVI_toast("Pulseira " + p.token + " atribuída a " + paciente.nome + ".");
          render();
        } catch (e) {
          alert(e.message);
        }
      });
    }

    document.getElementById("btn-anexar").addEventListener("click", function () {
      mostrarFormDoc = !mostrarFormDoc;
      renderFormDoc();
    });
    renderFormDoc();
  }

  function renderFormDoc() {
    var el = document.getElementById("form-doc");
    if (!el) return;
    if (!mostrarFormDoc) { el.innerHTML = ""; return; }
    el.innerHTML =
      '<div class="card" style="margin-top:10px;">' +
      selectField("fd-tipo", "Tipo de documento", "rgpd", [["rgpd", "Consentimento RGPD"], ["termo_responsabilidade", "Termo de responsabilidade"], ["outro", "Outro"]]) +
      '<label>Nome do ficheiro</label><input type="text" id="fd-nome" placeholder="Ex.: rgpd_assinado.pdf">' +
      '<p class="field-hint">Só o metadado é guardado por agora — o Storage para o ficheiro em si ainda não está ativo (ver CLAUDE.md, roadmap).</p>' +
      '<button class="btn btn-primary btn-sm" id="fd-submeter" style="margin-top:8px;">Adicionar à lista</button>' +
      "</div>";
    document.getElementById("fd-submeter").addEventListener("click", async function () {
      var nome = document.getElementById("fd-nome").value.trim();
      if (!nome) { alert("Indique o nome do ficheiro."); return; }
      await mockdb.adicionarDocumento(pacienteId, { tipo: document.getElementById("fd-tipo").value, nome_ficheiro: nome }, sessao.userId);
      mostrarFormDoc = false;
      SAVI_toast("Documento adicionado.");
      render();
    });
  }

  function renderListaDocs(documentos) {
    if (!documentos.length) return '<div class="empty-state">Sem documentos digitalizados.</div>';
    return documentos.map(function (d) {
      var icone = d.tipo === "rgpd" ? "🛡️" : (d.tipo === "termo_responsabilidade" ? "📄" : "📎");
      var rotulo = d.tipo === "rgpd" ? "Consentimento RGPD" : (d.tipo === "termo_responsabilidade" ? "Termo de responsabilidade" : "Documento");
      var data = d.enviado_em ? new Date(d.enviado_em).toLocaleDateString("pt-PT") : "—";
      return '<div class="doc-item"><span class="doc-icon">' + icone + '</span><div class="doc-info"><div class="doc-nome">' + d.nome_ficheiro + '</div><div class="doc-meta">' + rotulo + " · " + data + "</div></div></div>";
    }).join("");
  }

  function selectField(id, label, valor, opcoes) {
    var html = '<label>' + label + '</label><select id="' + id + '">';
    opcoes.forEach(function (o) {
      html += '<option value="' + o[0] + '"' + (valor === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    });
    html += "</select>";
    return html;
  }

  function escapeAttr(s) {
    return String(s || "").replace(/"/g, "&quot;");
  }

  render();
}
