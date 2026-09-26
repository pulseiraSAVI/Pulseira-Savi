/* firestore-real.js
 * SAVI — substitui a parte de dados de mockdb.js por Firestore real
 * (projeto `pulseira-savi`). mockdb.js (carregado antes deste ficheiro,
 * ver index.html) fica reduzido às funções puras sem I/O (formatarIdade,
 * calcularSuperficieCorporal, uuid, nowISO) — este ficheiro faz
 * `Object.assign(window.mockdb, {...})` para acrescentar as funções de
 * dados, agora assíncronas a sério (falam com o Firestore).
 *
 * Nota de schema: por simplicidade nesta primeira ligação real, os
 * timestamps escritos pelo cliente (criado_em, escrito_em, etc.) usam
 * string ISO 8601, não o tipo nativo Firestore `timestamp` sugerido em
 * backend/firestore-schema.md — ISO 8601 ordena corretamente como string
 * e a escala do piloto (≤50 pacientes) não precisa de range-queries que
 * justifiquem o tipo nativo já nesta iteração. O Worker (que já corre
 * sem esta limitação) continua a escrever `acessos.acedido_em` como
 * timestamp nativo.
 *
 * Gestão de contas (26/09/2026, roadmap "gestão de contas desde a app"):
 * criar, editar (papéis/dados) e reiniciar o PIN passaram a ser possíveis
 * a partir da app, mas não através deste ficheiro — vão sempre pelos
 * endpoints novos do Worker (`POST /admin/contas`, `PATCH
 * /admin/contas/:id`, `POST /admin/contas/:id/reset-pin`, ver
 * docs/js/views/admin-contas.js), porque só o Worker (com a service
 * account) pode gerar o hash do PIN com sal e o Custom Token
 * correspondente — nunca o cliente. Este ficheiro só implementa a
 * ativação/desativação de contas (troca simples do campo `ativo`, sem
 * tocar em PIN/papéis), que é segura de fazer diretamente pelo cliente.
 * Eliminar contas continua de fora — decisão em aberto sobre o efeito em
 * cascata (ver ROADMAP_MELHORIAS.md, 1.1).
 */
(function (global) {
  "use strict";

  function sdk() {
    if (!global.firebaseSDK) throw new Error("Firebase ainda não está pronto.");
    return global.firebaseSDK;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  // Converte um DocumentSnapshot do Firestore em objeto simples
  // { id, ...campos }, convertendo qualquer Timestamp nativo (ex.:
  // escrito por serverTimestamp() nalgum outro sítio, ou pelo Worker) em
  // string ISO, para manter compatibilidade com o código de exibição
  // existente (new Date(iso)).
  function converterDoc(docSnap) {
    if (!docSnap || !docSnap.exists()) return null;
    var dados = docSnap.data();
    var out = { id: docSnap.id };
    var T = sdk().Timestamp;
    Object.keys(dados).forEach(function (k) {
      var v = dados[k];
      out[k] = v instanceof T ? v.toDate().toISOString() : v;
    });
    return out;
  }

  function converterQuery(querySnap) {
    var out = [];
    querySnap.forEach(function (docSnap) { out.push(converterDoc(docSnap)); });
    return out;
  }

  async function getPacienteRef(pacienteId) {
    return sdk().doc(sdk().db, "pacientes", pacienteId);
  }

  var dados = {
    // ---------- Pacientes ----------
    listPacientes: async function () {
      var snap = await sdk().getDocs(sdk().collection(sdk().db, "pacientes"));
      return converterQuery(snap);
    },
    listPacientesDoProfissional: async function (profissionalId) {
      var q = sdk().query(sdk().collection(sdk().db, "pacientes"), sdk().where("criado_por_id", "==", profissionalId));
      var snap = await sdk().getDocs(q);
      return converterQuery(snap);
    },
    getPaciente: async function (id) {
      var snap = await sdk().getDoc(await getPacienteRef(id));
      return converterDoc(snap);
    },
    // Mantida por compatibilidade de interface com mockdb.js — o controlo
    // de acesso real já é imposto pelas Firestore Security Rules em
    // getPaciente()/escreverDadosNivel1(): se a leitura/escrita foi bem
    // sucedida, é porque as regras já confirmaram a posse. Não faz uma
    // segunda leitura só para repetir essa verificação no cliente.
    podeGerirPaciente: function () { return true; },
    criarPaciente: async function (camposPaciente, profissionalId) {
      var s = sdk();
      var novoRef = s.doc(s.collection(s.db, "pacientes"));
      var agora = nowISO();
      var gestorDoCaso = camposPaciente.gestor_do_caso;
      if (!gestorDoCaso) {
        // Preenche automaticamente com os dados profissionais de quem cria
        // o paciente, tal como a UI (pacientes-lista.js) promete — pode ser
        // editado depois em nivel1-form.js.
        var criadorSnap = await s.getDoc(s.doc(s.db, "profissionais", profissionalId));
        var criador = criadorSnap.exists() ? criadorSnap.data() : null;
        gestorDoCaso = criador ? {
          nome: criador.nome,
          credencial_ordem: criador.credencial_ordem,
          especialidade: criador.especialidade,
          instituicao_servico: criador.instituicao_servico,
          telefone_institucional: criador.telefone_institucional
        } : {};
      }
      await s.setDoc(novoRef, {
        nome: camposPaciente.nome,
        data_nascimento: camposPaciente.data_nascimento,
        sexo: camposPaciente.sexo,
        numero_utente: camposPaciente.numero_utente || "",
        morada: camposPaciente.morada || "",
        contacto_familia: camposPaciente.contacto_familia || "",
        contacto_emergencia: camposPaciente.contacto_emergencia || "",
        gestor_do_caso: gestorDoCaso,
        estado_consentimento: "pendente",
        criado_por_id: profissionalId,
        criado_em: agora
      });
      await s.setDoc(s.doc(s.db, "dados_nivel1", novoRef.id), {
        peso_kg: null, altura_cm: null, biometria_registada_em: null,
        alergias: "", condicao_critica: "", esquema_dose: "", medicacao_contraindicada: "",
        limitacao_terapeutica: "nao_aplicavel", esquema_atuacao_crise: "", notas: "", medicacao_cronica: "",
        escrito_por_id: null, escrito_em: null,
        verificado_por_id: null, verificado_em: null,
        estado_verificacao: "nao_verificado", validado_em: null, atualizado_em: agora
      });
      return { id: novoRef.id, criado_por_id: profissionalId, criado_em: agora };
    },
    atualizarPaciente: async function (pacienteId, camposPaciente) {
      await sdk().updateDoc(await getPacienteRef(pacienteId), camposPaciente);
    },

    // ---------- dados_nivel1 ----------
    getDadosNivel1: async function (pacienteId) {
      var snap = await sdk().getDoc(sdk().doc(sdk().db, "dados_nivel1", pacienteId));
      return converterDoc(snap);
    },
    escreverDadosNivel1: async function (pacienteId, campos, autor) {
      var s = sdk();
      var atualizacao = Object.assign({}, campos, {
        escrito_por_id: autor.id,
        escrito_em: nowISO(),
        estado_verificacao: "nao_verificado",
        verificado_por_id: null,
        verificado_em: null,
        atualizado_em: nowISO()
      });
      delete atualizacao.paciente_id;
      await s.updateDoc(s.doc(s.db, "dados_nivel1", pacienteId), atualizacao);
    },
    verificarDadosNivel1: async function (pacienteId, autor) {
      var s = sdk();
      var agora = nowISO();
      await s.updateDoc(s.doc(s.db, "dados_nivel1", pacienteId), {
        estado_verificacao: "verificado",
        verificado_por_id: autor.id,
        verificado_em: agora,
        validado_em: agora
      });
    },

    // ---------- Documentos (metadado no Firestore + ficheiro real no
    // Firebase Storage, ativado em 25/09/2026 — ver CLAUDE.md roadmap) ----------
    listDocumentosDoPaciente: async function (pacienteId) {
      var s = sdk();
      var q = s.query(s.collection(s.db, "documentos"), s.where("paciente_id", "==", pacienteId));
      var snap = await s.getDocs(q);
      return converterQuery(snap);
    },
    // `arquivo` é opcional (File do input, pode ser undefined em chamadas
    // antigas/testes) — quando presente, é enviado para
    // documentos/{pacienteId}/{docId}_{nomeFicheiro} no Storage ANTES de
    // escrever o metadado, para o storage_path já vir preenchido com o
    // caminho real (nunca null quando há ficheiro). O docId é gerado com
    // s.doc() antes do setDoc precisamente para poder usá-lo já no
    // caminho do Storage.
    adicionarDocumento: async function (pacienteId, camposDoc, autorId, arquivo) {
      var s = sdk();
      var novoRef = s.doc(s.collection(s.db, "documentos"));
      var nomeFicheiro = camposDoc.nome_ficheiro || (arquivo ? arquivo.name : "documento.pdf");
      var storagePath = null;
      if (arquivo) {
        storagePath = "documentos/" + pacienteId + "/" + novoRef.id + "_" + nomeFicheiro;
        var ref = s.storageRef(s.storage, storagePath);
        await s.uploadBytes(ref, arquivo);
      }
      await s.setDoc(novoRef, {
        paciente_id: pacienteId,
        tipo: camposDoc.tipo || "outro",
        nome_ficheiro: nomeFicheiro,
        storage_path: storagePath,
        enviado_por_id: autorId || null,
        enviado_em: nowISO()
      });
      return { id: novoRef.id, storage_path: storagePath };
    },
    // Devolve um URL de download temporário (assinado pelo Firebase) para
    // o ficheiro de um documento — nunca guardado em lado nenhum, pedido
    // sempre que o profissional/superadmin quer ver o ficheiro.
    obterUrlDocumento: async function (storagePath) {
      if (!storagePath) return null;
      var s = sdk();
      return await s.getDownloadURL(s.storageRef(s.storage, storagePath));
    },

    // ---------- Pulseiras ----------
    listPulseiras: async function () {
      var snap = await sdk().getDocs(sdk().collection(sdk().db, "pulseiras"));
      return converterQuery(snap);
    },
    // Usada por nivel1-form.js (papel profissional inclusive) — tem de
    // ir filtrada por paciente_id para as Firestore Rules conseguirem
    // verificar a posse sem exigir leitura total da coleção.
    listPulseirasDoPaciente: async function (pacienteId) {
      var s = sdk();
      var q = s.query(s.collection(s.db, "pulseiras"), s.where("paciente_id", "==", pacienteId));
      var snap = await s.getDocs(q);
      return converterQuery(snap);
    },
    getPulseira: async function (id) {
      var snap = await sdk().getDoc(sdk().doc(sdk().db, "pulseiras", id));
      return converterDoc(snap);
    },
    atribuirPulseira: async function (pulseiraId, pacienteId) {
      await sdk().updateDoc(sdk().doc(sdk().db, "pulseiras", pulseiraId), {
        estado: "ativa",
        paciente_id: pacienteId,
        atribuida_em: nowISO()
      });
    },
    solicitarPulseiraParaPaciente: async function (pacienteId) {
      var s = sdk();
      // Filtra por paciente_id == null (não por estado) de propósito: é o
      // campo que a regra de leitura de `pulseiras` para o papel
      // profissional verifica diretamente (resource.data.paciente_id ==
      // null), e no nosso schema só as pulseiras nao_atribuida têm
      // paciente_id nulo — ver nota em firestore.rules sobre a mesma
      // limitação encontrada em `pacientes`.
      var q = s.query(s.collection(s.db, "pulseiras"), s.where("paciente_id", "==", null));
      var snap = await s.getDocs(q);
      if (snap.empty) throw new Error("Não há pulseiras disponíveis por atribuir. Gere um novo lote.");
      var livre = snap.docs[0];
      await this.atribuirPulseira(livre.id, pacienteId);
      return { id: livre.id, token: livre.data().token };
    },
    desativarPulseira: async function (pulseiraId, motivo) {
      await sdk().updateDoc(sdk().doc(sdk().db, "pulseiras", pulseiraId), {
        estado: "desativada",
        desativada_em: nowISO(),
        motivo_desativacao: motivo || ""
      });
    },
    gerarLote: async function (camposLote) {
      var s = sdk();
      var agora = nowISO();
      var loteRef = await s.addDoc(s.collection(s.db, "lotes"), {
        fornecedor: camposLote.fornecedor,
        tipo_pulseira: camposLote.tipo_pulseira,
        chip_modelo: camposLote.chip_modelo || "NTAG213",
        preco_unitario: camposLote.preco_unitario,
        quantidade: camposLote.quantidade,
        data_encomenda: camposLote.data_encomenda || null,
        data_receção: camposLote.data_receção || null,
        notas: camposLote.notas || "",
        criado_em: agora
      });
      var n = parseInt(camposLote.quantidade, 10) || 0;
      for (var i = 0; i < n; i++) {
        await s.addDoc(s.collection(s.db, "pulseiras"), {
          token: "SAVI-" + loteRef.id.slice(0, 6).toUpperCase() + "-" + String(i + 1).padStart(3, "0"),
          serial_fisico: "NTAG-" + Math.floor(Math.random() * 900000 + 100000),
          lote_id: loteRef.id,
          estado: "nao_atribuida",
          paciente_id: null,
          atribuida_em: null,
          desativada_em: null,
          motivo_desativacao: null,
          criado_em: agora
        });
      }
      return { id: loteRef.id };
    },
    listLotes: async function () {
      var snap = await sdk().getDocs(sdk().collection(sdk().db, "lotes"));
      return converterQuery(snap);
    },

    // ---------- Profissionais ----------
    // Ver aviso no cabeçalho do ficheiro: criar/editar papéis+PIN/eliminar
    // não estão implementados aqui de propósito (exigem Admin SDK) — usar
    // scripts/criar-conta.js. Só a troca de `ativo` está implementada.
    listProfissionais: async function () {
      var snap = await sdk().getDocs(sdk().collection(sdk().db, "profissionais"));
      return converterQuery(snap);
    },
    getProfissional: async function (id) {
      var snap = await sdk().getDoc(sdk().doc(sdk().db, "profissionais", id));
      return converterDoc(snap);
    },
    ativarProfissional: async function (id) {
      await sdk().updateDoc(sdk().doc(sdk().db, "profissionais", id), { ativo: true });
    },
    desativarProfissional: async function (id) {
      await sdk().updateDoc(sdk().doc(sdk().db, "profissionais", id), { ativo: false });
    },

    // ---------- Acessos (audit log) — leitura só, escrita é do Worker ----------
    listAcessos: async function () {
      var snap = await sdk().getDocs(sdk().collection(sdk().db, "acessos"));
      var lista = converterQuery(snap);
      lista.sort(function (a, b) { return new Date(b.acedido_em) - new Date(a.acedido_em); });
      return lista;
    }
  };

  Object.assign(global.mockdb, dados);
})(window);
