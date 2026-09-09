/* mockdb.js
 * "Firestore" simulado para a demo SAVI.
 *
 * Guarda as coleções ativas da Fase 1 num único objeto persistido em
 * localStorage (chave "savi_db"), espelhando as coleções Firestore
 * descritas em backend/firestore-schema.md:
 *   pacientes, dados_nivel1, pulseiras, lotes, contas_familia,
 *   familia_paciente, profissionais, acessos.
 *
 * IMPORTANTE — este ficheiro simula a base de dados, não o Worker.
 * As funções aqui aplicam as mesmas regras de negócio que as Firestore
 * Security Rules reais (backend/firestore.rules) impõem no servidor:
 *   - a família NUNCA escreve em dados_nivel1 (nem em modo de proposta);
 *   - dados clínicos só são escritos por profissional/admin;
 *   - acessos só é escrito pelo fluxo de scan (worker-sim.js).
 * Isto é só para a demo correr sem backend; num ambiente real estas
 * regras vivem SEMPRE no servidor (Firestore Rules + Worker), nunca
 * apenas no cliente.
 */
(function (global) {
  "use strict";

  var DB_KEY = "savi_db";

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function seed() {
    var db = {
      lotes: [],
      pacientes: [],
      dados_nivel1: [],
      pulseiras: [],
      profissionais: [],
      contas_familia: [],
      familia_paciente: [],
      acessos: []
    };

    // ---- Lote de demonstração ----
    var loteId = "lote-demo-001";
    db.lotes.push({
      id: loteId,
      fornecedor: "IdentiTag Lda.",
      tipo_pulseira: "Silicone ajustável, pediátrico/adulto",
      chip_modelo: "NTAG213",
      preco_unitario: 2.35,
      quantidade: 60,
      data_encomenda: "2026-05-10",
      data_receção: "2026-05-28",
      notas: "Lote piloto inicial — 50 pulseiras para pacientes + 10 de reserva.",
      criado_em: nowISO()
    });

    // ---- Profissionais ----
    var drAnaId = "prof-ana-silva";
    db.profissionais.push({
      id: drAnaId,
      nome: "Dr.ª Ana Silva",
      credencial_ordem: "12345M",
      servico: "Urgência Pediátrica",
      tipo_relacao: "interno",
      instituicao_id: null,
      mfa_ativo: true,
      funcao_auditor: false,
      ativo: true,
      criado_em: nowISO(),
      // apenas para a demo: password simulada (não existiria assim num sistema real)
      _password_demo: "demo123"
    });

    var adminAuditorId = "prof-admin-auditor";
    db.profissionais.push({
      id: adminAuditorId,
      nome: "Rui Ferreira",
      credencial_ordem: "ADMIN01",
      servico: "Equipa Administradora SAVI",
      tipo_relacao: "interno",
      instituicao_id: null,
      mfa_ativo: true,
      funcao_auditor: true,
      ativo: true,
      criado_em: nowISO(),
      _password_demo: "admin123",
      _papel: "admin"
    });

    var adminSimplesId = "prof-admin-simples";
    db.profissionais.push({
      id: adminSimplesId,
      nome: "Carla Nunes",
      credencial_ordem: "ADMIN02",
      servico: "Equipa Administradora SAVI",
      tipo_relacao: "interno",
      instituicao_id: null,
      mfa_ativo: true,
      funcao_auditor: false,
      ativo: true,
      criado_em: nowISO(),
      _password_demo: "admin123",
      _papel: "admin"
    });

    // ---- Conta de família demo ----
    var contaSofiaId = "fam-sofia-sousa";
    db.contas_familia.push({
      id: contaSofiaId,
      nome: "Sofia Sousa",
      email: "sofia.sousa@exemplo.pt",
      telefone: "+351 912 345 678",
      relacao: "mãe",
      firebase_uid: "uid-sofia-demo",
      ativo: true,
      criado_em: nowISO(),
      _password_demo: "familia123"
    });

    // ---- Paciente Matilde Sousa (réplica do mockup de referência) ----
    var matildeId = "pac-matilde-sousa";
    db.pacientes.push({
      id: matildeId,
      nome: "Matilde Sousa",
      data_nascimento: "2022-03-14",
      contacto_emergencia: "+351 912 345 678 (mãe — Sofia Sousa)",
      referencia_sistema_ext: "processo nº 48213/2026, Hospital Pediátrico de referência",
      estado_consentimento: "ativo",
      consentimento_prestado_por: "tutor_legal",
      consentimento_nome_tutor: "Sofia Sousa",
      consentimento_documento_ref: "CC 000000000 ZZ0",
      consentimento_data: "2026-04-02",
      origem: "piloto",
      profissional_solicitante_id: null,
      criado_em: nowISO()
    });
    db.familia_paciente.push({ conta_familia_id: contaSofiaId, paciente_id: matildeId, criado_em: nowISO() });

    db.dados_nivel1.push({
      paciente_id: matildeId,
      peso_kg: 16.2,
      altura_cm: 102.5,
      biometria_registada_em: "2026-07-10",
      alergias: "Penicilina — reação grave (edema)",
      grupo_sanguineo: "O Rh+",
      diagnosticos_ativos: "Epilepsia focal (G40.2)",
      terapeutica: "Ácido valproico 250mg, via oral, 2x/dia (08h/20h)",
      medicacao_cronica: "Ácido valproico 250mg, 2x/dia",
      farmacos_contraindicados: "Ibuprofeno (interação com anticonvulsivante)",
      limitacao_terapeutica: "nao",
      ventilacao_invasiva: "nao",
      vni: "nao",
      tecnicas_dialiticas: "nao",
      esquema_atuacao_crise: "Convulsão → Diazepam retal 5mg. Se não ceder em 5 min, contactar 112.",
      hospital_referencia: "Hospital Pediátrico de referência",
      hospital_referencia_contacto: "+351 21 000 0000",
      vacinas: "Atualizado — PNV em dia",
      escrito_por_id: drAnaId,
      escrito_em: nowISO(),
      verificado_por_id: drAnaId,
      verificado_em: "2026-07-10T09:00:00.000Z",
      estado_verificacao: "verificado",
      validado_em: "2026-07-10T09:00:00.000Z",
      atualizado_em: "2026-07-10T09:00:00.000Z",
      // Extensão de demo (não faz parte do schema SQL original) para suportar
      // o estado de verificação por campo pedido no ecrã de Nível 1.
      // Documentado em backend/firestore-schema.md.
      verificacoes_campo: {
        alergias: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-07-10" },
        esquema_atuacao_crise: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-07-10" },
        farmacos_contraindicados: { estado: "nao_verificado", em: "2026-06-22" },
        medicacao_cronica: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-07-10" },
        vacinas: { estado: "verificado", por: "Enf.º Coordenador", em: "2026-03-03" }
      }
    });

    var pulseiraMatildeId = "puls-matilde-001";
    db.pulseiras.push({
      id: pulseiraMatildeId,
      token: "SAVI-DEMO-MATILDE",
      serial_fisico: "NTAG-000101",
      lote_id: loteId,
      estado: "ativa",
      paciente_id: matildeId,
      protegida_por_senha: false,
      senha_referencia: null,
      revogada_por: null,
      atribuida_em: nowISO(),
      desativada_em: null,
      motivo_desativacao: null,
      criado_em: nowISO()
    });

    // ---- Paciente adulto: João Ribeiro (insuficiência renal crónica) ----
    var joaoId = "pac-joao-ribeiro";
    db.pacientes.push({
      id: joaoId,
      nome: "João Ribeiro",
      data_nascimento: "1958-11-02",
      contacto_emergencia: "+351 913 555 222 (esposa — Helena Ribeiro)",
      referencia_sistema_ext: "processo nº 77490/2025, Hospital de referência de Nefrologia",
      estado_consentimento: "ativo",
      consentimento_prestado_por: "proprio",
      consentimento_nome_tutor: null,
      consentimento_documento_ref: "CC 111111111 ZZ1",
      consentimento_data: "2026-02-18",
      origem: "piloto",
      profissional_solicitante_id: null,
      criado_em: nowISO()
    });
    db.dados_nivel1.push({
      paciente_id: joaoId,
      peso_kg: 78.4,
      altura_cm: 172,
      biometria_registada_em: "2026-06-01",
      alergias: "Sem alergias conhecidas",
      grupo_sanguineo: "A Rh-",
      diagnosticos_ativos: "Doença renal crónica estadio 5 (N18.5); Hipertensão arterial (I10)",
      terapeutica: "Hemodiálise 3x/semana (2ª, 4ª, 6ª); Losartan 50mg 1x/dia",
      medicacao_cronica: "Losartan 50mg 1x/dia; Carbonato de cálcio 500mg às refeições",
      farmacos_contraindicados: "Anti-inflamatórios não esteroides (AINEs); contraste iodado sem preparação",
      limitacao_terapeutica: "nao_aplicavel",
      ventilacao_invasiva: "nao",
      vni: "nao",
      tecnicas_dialiticas: "sim",
      esquema_atuacao_crise: "Em caso de hipercaliemia ou sobrecarga de volume, contactar Nefrologia de urgência antes de qualquer decisão de diálise extra.",
      hospital_referencia: "Hospital de referência de Nefrologia",
      hospital_referencia_contacto: "+351 22 000 0000",
      vacinas: "Vacina da gripe 2025/2026 administrada; hepatite B em esquema reforçado (doente dialisado)",
      escrito_por_id: adminSimplesId,
      escrito_em: nowISO(),
      verificado_por_id: null,
      verificado_em: null,
      estado_verificacao: "nao_verificado",
      validado_em: null,
      atualizado_em: nowISO(),
      verificacoes_campo: {
        alergias: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-06-01" },
        esquema_atuacao_crise: { estado: "nao_verificado", em: "2026-06-01" },
        farmacos_contraindicados: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-06-01" },
        medicacao_cronica: { estado: "nao_verificado", em: "2026-06-01" },
        vacinas: { estado: "nao_verificado", em: "2026-06-01" }
      }
    });
    db.pulseiras.push({
      id: "puls-joao-001",
      token: "SAVI-DEMO-JOAO",
      serial_fisico: "NTAG-000102",
      lote_id: loteId,
      estado: "ativa",
      paciente_id: joaoId,
      protegida_por_senha: false,
      senha_referencia: null,
      revogada_por: null,
      atribuida_em: nowISO(),
      desativada_em: null,
      motivo_desativacao: null,
      criado_em: nowISO()
    });

    // ---- Paciente pediátrico: Rodrigo Alves (cardiopatia congénita) ----
    var rodrigoId = "pac-rodrigo-alves";
    db.pacientes.push({
      id: rodrigoId,
      nome: "Rodrigo Alves",
      data_nascimento: "2018-09-30",
      contacto_emergencia: "+351 966 111 222 (pai — Tiago Alves)",
      referencia_sistema_ext: "processo nº 30021/2024, Hospital Pediátrico de referência",
      estado_consentimento: "ativo",
      consentimento_prestado_por: "tutor_legal",
      consentimento_nome_tutor: "Tiago Alves",
      consentimento_documento_ref: "CC 222222222 ZZ2",
      consentimento_data: "2026-01-20",
      origem: "piloto",
      profissional_solicitante_id: null,
      criado_em: nowISO()
    });
    db.dados_nivel1.push({
      paciente_id: rodrigoId,
      peso_kg: 24.1,
      altura_cm: 118,
      biometria_registada_em: "2026-05-15",
      alergias: "Sem alergias conhecidas",
      grupo_sanguineo: "B Rh+",
      diagnosticos_ativos: "Tetralogia de Fallot operada (Q21.3)",
      terapeutica: "Propranolol 10mg 2x/dia; vigilância cardiológica trimestral",
      medicacao_cronica: "Propranolol 10mg 2x/dia",
      farmacos_contraindicados: "Descongestionantes simpaticomiméticos",
      limitacao_terapeutica: "nao",
      ventilacao_invasiva: "nao",
      vni: "nao",
      tecnicas_dialiticas: "nao",
      esquema_atuacao_crise: "Em crise de cianose/hipóxia aguda, posição genupeitoral, oxigénio e contacto imediato com Cardiologia Pediátrica de referência.",
      hospital_referencia: "Hospital Pediátrico de referência",
      hospital_referencia_contacto: "+351 21 000 1111",
      vacinas: "PNV em dia; vacina da gripe anual administrada",
      escrito_por_id: drAnaId,
      escrito_em: nowISO(),
      verificado_por_id: drAnaId,
      verificado_em: "2026-05-15T10:00:00.000Z",
      estado_verificacao: "verificado",
      validado_em: "2026-05-15T10:00:00.000Z",
      atualizado_em: "2026-05-15T10:00:00.000Z",
      verificacoes_campo: {
        alergias: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-05-15" },
        esquema_atuacao_crise: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-05-15" },
        farmacos_contraindicados: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-05-15" },
        medicacao_cronica: { estado: "verificado", por: "Dr.ª Ana Silva", em: "2026-05-15" },
        vacinas: { estado: "nao_verificado", em: "2026-05-15" }
      }
    });
    db.pulseiras.push({
      id: "puls-rodrigo-perdida",
      token: "SAVI-DEMO-RODRIGO-PERDIDA",
      serial_fisico: "NTAG-000103",
      lote_id: loteId,
      estado: "perdida",
      paciente_id: rodrigoId,
      protegida_por_senha: false,
      senha_referencia: null,
      revogada_por: "familia",
      atribuida_em: nowISO(),
      desativada_em: nowISO(),
      motivo_desativacao: "Pulseira perdida — reportada pela família.",
      criado_em: nowISO()
    });

    // ---- Pulseira ainda não atribuída (para testar ecrã de erro) ----
    db.pulseiras.push({
      id: "puls-nao-atribuida-001",
      token: "SAVI-DEMO-NAO-ATRIBUIDA",
      serial_fisico: "NTAG-000104",
      lote_id: loteId,
      estado: "nao_atribuida",
      paciente_id: null,
      protegida_por_senha: false,
      senha_referencia: null,
      revogada_por: null,
      atribuida_em: null,
      desativada_em: null,
      motivo_desativacao: null,
      criado_em: nowISO()
    });

    return db;
  }

  function load() {
    var raw = null;
    try {
      raw = localStorage.getItem(DB_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) {
      var db = seed();
      persist(db);
      return db;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      var db2 = seed();
      persist(db2);
      return db2;
    }
  }

  function persist(db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      // localStorage indisponível (ex. modo privado) — a demo continua em memória.
    }
  }

  var DB = load();

  function save() {
    persist(DB);
  }

  function calcularIdade(dataNascISO) {
    var hoje = new Date();
    var nasc = new Date(dataNascISO);
    var anos = hoje.getFullYear() - nasc.getFullYear();
    var m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
    return anos;
  }

  var mockdb = {
    _reset: function () {
      DB = seed();
      save();
    },
    _dump: function () {
      return DB;
    },
    uuid: uuid,
    nowISO: nowISO,
    calcularIdade: calcularIdade,

    // ---------- Pacientes ----------
    listPacientes: function () {
      return DB.pacientes.slice();
    },
    getPaciente: function (id) {
      return DB.pacientes.find(function (p) { return p.id === id; }) || null;
    },
    criarPacientePorFamilia: function (contaFamiliaId, dados) {
      // Só campos administrativos — nunca dados clínicos.
      var novo = {
        id: uuid(),
        nome: dados.nome,
        data_nascimento: dados.data_nascimento,
        contacto_emergencia: dados.contacto_emergencia || "",
        referencia_sistema_ext: "",
        estado_consentimento: "pendente",
        consentimento_prestado_por: dados.consentimento_prestado_por || null,
        consentimento_nome_tutor: dados.consentimento_nome_tutor || null,
        consentimento_documento_ref: dados.consentimento_documento_ref || null,
        consentimento_data: null,
        origem: "familia",
        profissional_solicitante_id: null,
        criado_em: nowISO()
      };
      DB.pacientes.push(novo);
      DB.familia_paciente.push({ conta_familia_id: contaFamiliaId, paciente_id: novo.id, criado_em: nowISO() });
      // Cria registo clínico vazio — só a equipa administradora o preenche.
      DB.dados_nivel1.push({
        paciente_id: novo.id,
        peso_kg: null, altura_cm: null, biometria_registada_em: null,
        alergias: "", grupo_sanguineo: "",
        diagnosticos_ativos: "", terapeutica: "", medicacao_cronica: "", farmacos_contraindicados: "",
        limitacao_terapeutica: "nao_aplicavel", ventilacao_invasiva: "nao", vni: "nao", tecnicas_dialiticas: "nao",
        esquema_atuacao_crise: "", hospital_referencia: "", hospital_referencia_contacto: "", vacinas: "",
        escrito_por_id: null, escrito_em: null,
        verificado_por_id: null, verificado_em: null,
        estado_verificacao: "nao_verificado", validado_em: null, atualizado_em: nowISO(),
        verificacoes_campo: {}
      });
      save();
      return novo;
    },
    // Registo de paciente pela equipa administradora (origem 'piloto').
    criarPacienteAdmin: function (dados) {
      var novo = {
        id: uuid(),
        nome: dados.nome,
        data_nascimento: dados.data_nascimento,
        contacto_emergencia: dados.contacto_emergencia || "",
        referencia_sistema_ext: dados.referencia_sistema_ext || "",
        estado_consentimento: "pendente",
        consentimento_prestado_por: null,
        consentimento_nome_tutor: null,
        consentimento_documento_ref: null,
        consentimento_data: null,
        origem: "piloto",
        profissional_solicitante_id: null,
        criado_em: nowISO()
      };
      DB.pacientes.push(novo);
      DB.dados_nivel1.push({
        paciente_id: novo.id, peso_kg: null, altura_cm: null, biometria_registada_em: null,
        alergias: "", grupo_sanguineo: "", diagnosticos_ativos: "", terapeutica: "",
        medicacao_cronica: "", farmacos_contraindicados: "",
        limitacao_terapeutica: "nao_aplicavel", ventilacao_invasiva: "nao", vni: "nao", tecnicas_dialiticas: "nao",
        esquema_atuacao_crise: "", hospital_referencia: "", hospital_referencia_contacto: "", vacinas: "",
        escrito_por_id: null, escrito_em: null, verificado_por_id: null, verificado_em: null,
        estado_verificacao: "nao_verificado", validado_em: null, atualizado_em: nowISO(), verificacoes_campo: {}
      });
      save();
      return novo;
    },
    atualizarContactoPaciente: function (pacienteId, dados) {
      // Permitido à família: contacto de emergência. Nunca dados clínicos.
      var p = this.getPaciente(pacienteId);
      if (!p) throw new Error("Paciente não encontrado.");
      if (typeof dados.contacto_emergencia === "string") p.contacto_emergencia = dados.contacto_emergencia;
      save();
      return p;
    },
    prestarConsentimento: function (pacienteId, dados) {
      var p = this.getPaciente(pacienteId);
      if (!p) throw new Error("Paciente não encontrado.");
      p.estado_consentimento = "ativo";
      p.consentimento_prestado_por = dados.consentimento_prestado_por;
      p.consentimento_nome_tutor = dados.consentimento_nome_tutor || null;
      p.consentimento_documento_ref = dados.consentimento_documento_ref;
      p.consentimento_data = dados.consentimento_data || nowISO().slice(0, 10);
      save();
      return p;
    },
    revogarConsentimento: function (pacienteId) {
      var p = this.getPaciente(pacienteId);
      if (!p) throw new Error("Paciente não encontrado.");
      p.estado_consentimento = "revogado";
      save();
      return p;
    },
    pedirEliminacao: function (pacienteId, contaFamiliaId, motivo) {
      // Regista o pedido de eliminação (art. 17º RGPD). Nesta demo não apaga
      // dados automaticamente — fica registado para tratamento manual pela
      // equipa administradora/DPO, tal como aconteceria num processo real.
      DB.acessos.push({
        id: uuid(),
        pulseira_id: null,
        profissional_id: null,
        nivel_acedido: "negado",
        motivo: "[PEDIDO DE ELIMINAÇÃO RGPD Art.17] paciente=" + pacienteId + "; conta_familia=" + contaFamiliaId + "; motivo=" + (motivo || ""),
        servico: "Pedido família",
        ip_ou_localizacao: "demo",
        notificado_titular_em: null,
        acedido_em: nowISO()
      });
      save();
      return true;
    },

    // ---------- dados_nivel1 ----------
    getDadosNivel1: function (pacienteId) {
      return DB.dados_nivel1.find(function (d) { return d.paciente_id === pacienteId; }) || null;
    },
    // Escrita EXCLUSIVA de profissional/admin. `autor` = { id, papel }.
    escreverDadosNivel1: function (pacienteId, campos, autor) {
      if (!autor || (autor.papel !== "profissional" && autor.papel !== "admin")) {
        throw new Error("Acesso negado: apenas profissionais/equipa administradora podem escrever dados clínicos.");
      }
      var registo = this.getDadosNivel1(pacienteId);
      if (!registo) throw new Error("Registo clínico não encontrado para este paciente.");
      Object.keys(campos).forEach(function (k) {
        if (k === "paciente_id") return;
        registo[k] = campos[k];
      });
      registo.escrito_por_id = autor.id;
      registo.escrito_em = nowISO();
      registo.estado_verificacao = "nao_verificado";
      registo.verificado_por_id = null;
      registo.verificado_em = null;
      registo.atualizado_em = nowISO();
      save();
      return registo;
    },
    verificarDadosNivel1: function (pacienteId, autor) {
      if (!autor || (autor.papel !== "profissional" && autor.papel !== "admin")) {
        throw new Error("Acesso negado: apenas profissionais/equipa administradora podem verificar dados clínicos.");
      }
      var registo = this.getDadosNivel1(pacienteId);
      if (!registo) throw new Error("Registo clínico não encontrado.");
      registo.estado_verificacao = "verificado";
      registo.verificado_por_id = autor.id;
      registo.verificado_em = nowISO();
      registo.validado_em = nowISO();
      save();
      return registo;
    },

    // ---------- Pulseiras ----------
    listPulseiras: function () {
      return DB.pulseiras.slice();
    },
    getPulseiraPorToken: function (token) {
      return DB.pulseiras.find(function (p) { return p.token === token; }) || null;
    },
    getPulseira: function (id) {
      return DB.pulseiras.find(function (p) { return p.id === id; }) || null;
    },
    gerarLote: function (dados) {
      var lote = {
        id: uuid(),
        fornecedor: dados.fornecedor,
        tipo_pulseira: dados.tipo_pulseira,
        chip_modelo: dados.chip_modelo || "NTAG213",
        preco_unitario: dados.preco_unitario,
        quantidade: dados.quantidade,
        data_encomenda: dados.data_encomenda || null,
        data_receção: dados.data_receção || null,
        notas: dados.notas || "",
        criado_em: nowISO()
      };
      DB.lotes.push(lote);
      var n = parseInt(dados.quantidade, 10) || 0;
      for (var i = 0; i < n; i++) {
        DB.pulseiras.push({
          id: uuid(),
          token: "SAVI-" + lote.id.slice(0, 6).toUpperCase() + "-" + String(i + 1).padStart(3, "0"),
          serial_fisico: "NTAG-" + Math.floor(Math.random() * 900000 + 100000),
          lote_id: lote.id,
          estado: "nao_atribuida",
          paciente_id: null,
          protegida_por_senha: false,
          senha_referencia: null,
          revogada_por: null,
          atribuida_em: null,
          desativada_em: null,
          motivo_desativacao: null,
          criado_em: nowISO()
        });
      }
      save();
      return lote;
    },
    listLotes: function () {
      return DB.lotes.slice();
    },
    atribuirPulseira: function (pulseiraId, pacienteId) {
      var p = this.getPulseira(pulseiraId);
      if (!p) throw new Error("Pulseira não encontrada.");
      p.estado = "ativa";
      p.paciente_id = pacienteId;
      p.atribuida_em = nowISO();
      save();
      return p;
    },
    desativarPulseira: function (pulseiraId, motivo, revogadaPor) {
      var p = this.getPulseira(pulseiraId);
      if (!p) throw new Error("Pulseira não encontrada.");
      p.estado = "desativada";
      p.desativada_em = nowISO();
      p.motivo_desativacao = motivo || "";
      p.revogada_por = revogadaPor || "equipa";
      save();
      return p;
    },

    // ---------- Profissionais ----------
    listProfissionais: function () {
      return DB.profissionais.slice();
    },
    getProfissionalPorCredencial: function (credencial) {
      return DB.profissionais.find(function (p) { return p.credencial_ordem === credencial; }) || null;
    },
    getProfissional: function (id) {
      return DB.profissionais.find(function (p) { return p.id === id; }) || null;
    },
    criarProfissional: function (dados) {
      var novo = {
        id: uuid(),
        nome: dados.nome,
        credencial_ordem: dados.credencial_ordem,
        servico: dados.servico || "",
        tipo_relacao: "interno",
        instituicao_id: null,
        mfa_ativo: true,
        funcao_auditor: !!dados.funcao_auditor,
        ativo: true,
        criado_em: nowISO(),
        _password_demo: dados.password || "demo123",
        _papel: dados.papel === "admin" ? "admin" : undefined
      };
      DB.profissionais.push(novo);
      save();
      return novo;
    },
    desativarProfissional: function (id) {
      var p = this.getProfissional(id);
      if (!p) throw new Error("Profissional não encontrado.");
      p.ativo = false;
      save();
      return p;
    },
    ativarProfissional: function (id) {
      var p = this.getProfissional(id);
      if (!p) throw new Error("Profissional não encontrado.");
      p.ativo = true;
      save();
      return p;
    },

    // ---------- Contas de família ----------
    getContaFamiliaPorEmail: function (email) {
      return DB.contas_familia.find(function (c) { return c.email.toLowerCase() === (email || "").toLowerCase(); }) || null;
    },
    getContaFamilia: function (id) {
      return DB.contas_familia.find(function (c) { return c.id === id; }) || null;
    },
    listPacientesDaFamilia: function (contaFamiliaId) {
      var ids = DB.familia_paciente.filter(function (fp) { return fp.conta_familia_id === contaFamiliaId; }).map(function (fp) { return fp.paciente_id; });
      return DB.pacientes.filter(function (p) { return ids.indexOf(p.id) !== -1; });
    },
    familiaTemAcessoPaciente: function (contaFamiliaId, pacienteId) {
      return DB.familia_paciente.some(function (fp) { return fp.conta_familia_id === contaFamiliaId && fp.paciente_id === pacienteId; });
    },
    listPulseirasDoPaciente: function (pacienteId) {
      return DB.pulseiras.filter(function (p) { return p.paciente_id === pacienteId; });
    },

    // ---------- Acessos (audit log) — escrita reservada ao worker-sim ----------
    registarAcesso: function (registo) {
      var novo = {
        id: uuid(),
        pulseira_id: registo.pulseira_id || null,
        profissional_id: registo.profissional_id || null,
        nivel_acedido: registo.nivel_acedido,
        motivo: registo.motivo || null,
        servico: registo.servico || null,
        ip_ou_localizacao: registo.ip_ou_localizacao || "demo-local",
        notificado_titular_em: null,
        acedido_em: nowISO()
      };
      DB.acessos.push(novo);
      save();
      return novo;
    },
    marcarNotificado: function (acessoId) {
      var a = DB.acessos.find(function (x) { return x.id === acessoId; });
      if (a) { a.notificado_titular_em = nowISO(); save(); }
      return a;
    },
    // Leitura só para funcao_auditor==true ou admin (aplicado nas views/rules).
    listAcessos: function () {
      return DB.acessos.slice().sort(function (a, b) { return new Date(b.acedido_em) - new Date(a.acedido_em); });
    },
    listAcessosDoPaciente: function (pacienteId) {
      var pulseiraIds = DB.pulseiras.filter(function (p) { return p.paciente_id === pacienteId; }).map(function (p) { return p.id; });
      return DB.acessos.filter(function (a) { return pulseiraIds.indexOf(a.pulseira_id) !== -1; })
        .sort(function (a, b) { return new Date(b.acedido_em) - new Date(a.acedido_em); });
    }
  };

  global.mockdb = mockdb;
})(window);
