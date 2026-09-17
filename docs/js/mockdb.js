/* mockdb.js
 * "Firestore" simulado para o SAVI — pivô de produção, revisão de
 * 15/09/2026. Substitui por completo o modelo anterior (família/
 * profissional clínico/equipa administradora/auditor).
 *
 * Guarda as coleções ativas nesta revisão num único objeto persistido em
 * localStorage (chave "savi_db_v2"), espelhando as coleções Firestore
 * descritas em backend/firestore-schema.md:
 *   pacientes, dados_nivel1, documentos, pulseiras, lotes, profissionais,
 *   acessos.
 * `contas_familia` e `familia_paciente` existem no schema só por
 * referência histórica (família suspensa) — não são usadas aqui.
 *
 * IMPORTANTE — este ficheiro simula a base de dados, não o Worker.
 * As funções aqui aplicam as mesmas regras de negócio que as Firestore
 * Security Rules reais (backend/firestore.rules) impõem no servidor:
 *   - dados clínicos só são escritos pelo profissional que criou o
 *     paciente (ou pelo superadmin);
 *   - um profissional só vê/edita os pacientes que ele próprio criou;
 *   - o superadmin não tem essa restrição;
 *   - acessos só é escrito pelo fluxo de break-glass (worker-sim.js);
 *   - o PIN nunca é guardado em texto simples (ver hash-util.js).
 * Isto é só para a simulação correr sem backend; num ambiente real estas
 * regras vivem SEMPRE no servidor (Firestore Rules + Worker), nunca
 * apenas no cliente.
 */
(function (global) {
  "use strict";

  var DB_KEY = "savi_db_v2";

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

  // Hashes SHA-256 pré-calculados (via shell, nunca inventados no cliente)
  // dos PINs de demonstração — ver README.md para a lista de credenciais.
  // Nunca guardar o PIN em texto simples, mesmo aqui.
  var SEED_PIN_HASHES = {
    "A1B2C": "79a36533a678d71678afc93a94b46b9a55a778049586edd3debf303055112bda",
    "T4G05": "b12f21a5dc1e6cb6b8f5de15678016c927f0204fc5be79f569473b10b2b9076e",
    "M3D1C": "60704f659f1b92e27393eec3a27b4d9936bd6fc30e9da6743a5d8dc40b569226",
    "9XZQ7": "e9ec81782725428399b5d02c6f318bb4382290d83d11df082167e9fdaa3cad93",
    "7YTR2": "c4c6b2fc01390479fadd0dd5e7c7985c786f8e01d6ce062db44617ca94e9c7fb"
  };

  function seed() {
    var db = {
      lotes: [],
      pacientes: [],
      dados_nivel1: [],
      documentos: [],
      pulseiras: [],
      profissionais: [],
      // Presentes só por paridade com o schema (família suspensa) — nunca
      // preenchidas nem lidas nesta revisão.
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

    // ---- Profissionais / utilizadores / superadmin ----
    var drAnaId = "prof-ana-silva";
    db.profissionais.push({
      id: drAnaId,
      nome: "Dr.ª Ana Silva",
      credencial_ordem: "12345M",
      pin_hash: SEED_PIN_HASHES["A1B2C"],
      papeis: ["profissional", "utilizador"],
      funcao_auditor: false,
      servico: "Urgência Pediátrica",
      especialidade: "Pediatria",
      instituicao_servico: "Hospital Pediátrico de referência — Urgência Pediátrica",
      telefone_institucional: "+351 21 000 1111",
      ativo: true,
      criado_em: nowISO()
    });

    var drTiagoId = "prof-tiago-mendes";
    db.profissionais.push({
      id: drTiagoId,
      nome: "Dr. Tiago Mendes",
      credencial_ordem: "54321C",
      pin_hash: SEED_PIN_HASHES["T4G05"],
      papeis: ["profissional"],
      funcao_auditor: false,
      servico: "Nefrologia",
      especialidade: "Nefrologia",
      instituicao_servico: "Hospital de referência de Nefrologia — Consulta de Nefrologia",
      telefone_institucional: "+351 22 000 0000",
      ativo: true,
      criado_em: nowISO()
    });

    var enfMarcoId = "prof-marco-pinto";
    db.profissionais.push({
      id: enfMarcoId,
      nome: "Enf.º Marco Pinto",
      credencial_ordem: "99887E",
      pin_hash: SEED_PIN_HASHES["M3D1C"],
      papeis: ["utilizador"],
      funcao_auditor: false,
      servico: "Urgência Geral",
      especialidade: "",
      instituicao_servico: "",
      telefone_institucional: "",
      ativo: true,
      criado_em: nowISO()
    });

    var ruiId = "prof-rui-ferreira";
    db.profissionais.push({
      id: ruiId,
      nome: "Rui Ferreira",
      credencial_ordem: "ADMIN01",
      pin_hash: SEED_PIN_HASHES["9XZQ7"],
      papeis: ["superadmin"],
      funcao_auditor: true,
      servico: "Equipa gestora do projeto SAVI",
      especialidade: "",
      instituicao_servico: "",
      telefone_institucional: "",
      ativo: true,
      criado_em: nowISO()
    });

    var carlaId = "prof-carla-nunes";
    db.profissionais.push({
      id: carlaId,
      nome: "Carla Nunes",
      credencial_ordem: "ADMIN02",
      pin_hash: SEED_PIN_HASHES["7YTR2"],
      papeis: ["superadmin"],
      funcao_auditor: false,
      servico: "Equipa gestora do projeto SAVI",
      especialidade: "",
      instituicao_servico: "",
      telefone_institucional: "",
      ativo: true,
      criado_em: nowISO()
    });

    function gestorDoCaso(prof) {
      return {
        nome: prof.nome,
        credencial_ordem: prof.credencial_ordem,
        especialidade: prof.especialidade,
        instituicao_servico: prof.instituicao_servico,
        telefone_institucional: prof.telefone_institucional
      };
    }

    // ---- Paciente Matilde Sousa (pediátrica, epilepsia) ----
    var matildeId = "pac-matilde-sousa";
    var drAna = db.profissionais[0];
    db.pacientes.push({
      id: matildeId,
      nome: "Matilde Sousa",
      data_nascimento: "2023-11-02",
      sexo: "F",
      numero_utente: "3001445982",
      morada: "Rua das Amoreiras, 12, 3º Dto., 1900-000 Lisboa",
      contacto_familia: "+351 912 345 678 (mãe — Sofia Sousa)",
      contacto_emergencia: "+351 912 345 678 (mãe — Sofia Sousa)",
      gestor_do_caso: gestorDoCaso(drAna),
      estado_consentimento: "ativo",
      criado_por_id: drAnaId,
      criado_em: nowISO()
    });
    db.dados_nivel1.push({
      paciente_id: matildeId,
      peso_kg: 12.4,
      altura_cm: 88,
      biometria_registada_em: "2026-08-10",
      alergias: "Penicilina — reação grave (edema)",
      condicao_critica: "Epilepsia focal (G40.2)",
      esquema_dose: "Ácido valproico 250mg, via oral, 2x/dia (08h/20h)",
      medicacao_contraindicada: "Ibuprofeno (interação com anticonvulsivante)",
      limitacao_terapeutica: "nao",
      esquema_atuacao_crise: "Convulsão → Diazepam retal 5mg. Se não ceder em 5 min, contactar 112.",
      notas: "Pais treinados na administração de diazepam retal.",
      medicacao_cronica: "Ácido valproico 250mg, via oral, 2x/dia (08h/20h)",
      escrito_por_id: drAnaId,
      escrito_em: nowISO(),
      verificado_por_id: drAnaId,
      verificado_em: "2026-08-10T09:00:00.000Z",
      estado_verificacao: "verificado",
      validado_em: "2026-08-10T09:00:00.000Z",
      atualizado_em: "2026-08-10T09:00:00.000Z"
    });
    db.documentos.push({
      id: uuid(), paciente_id: matildeId, tipo: "rgpd", nome_ficheiro: "rgpd_matilde_sousa.pdf",
      storage_path: "documentos/" + matildeId + "/rgpd.pdf", enviado_por_id: drAnaId, enviado_em: nowISO()
    });
    db.documentos.push({
      id: uuid(), paciente_id: matildeId, tipo: "termo_responsabilidade", nome_ficheiro: "termo_responsabilidade_matilde_sousa.pdf",
      storage_path: "documentos/" + matildeId + "/termo.pdf", enviado_por_id: drAnaId, enviado_em: nowISO()
    });

    var pulseiraMatildeId = "puls-matilde-001";
    db.pulseiras.push({
      id: pulseiraMatildeId, token: "SAVI-DEMO-MATILDE", serial_fisico: "NTAG-000101", lote_id: loteId,
      estado: "ativa", paciente_id: matildeId, atribuida_em: nowISO(), desativada_em: null,
      motivo_desativacao: null, criado_em: nowISO()
    });

    // ---- Paciente adulto: João Ribeiro (insuficiência renal crónica) ----
    var joaoId = "pac-joao-ribeiro";
    var drTiago = db.profissionais[1];
    db.pacientes.push({
      id: joaoId,
      nome: "João Ribeiro",
      data_nascimento: "1958-11-02",
      sexo: "M",
      numero_utente: "1122334455",
      morada: "Avenida da República, 210, 2º Esq., 4400-000 Vila Nova de Gaia",
      contacto_familia: "+351 913 555 222 (esposa — Helena Ribeiro)",
      contacto_emergencia: "+351 913 555 222 (esposa — Helena Ribeiro)",
      gestor_do_caso: gestorDoCaso(drTiago),
      estado_consentimento: "ativo",
      criado_por_id: drTiagoId,
      criado_em: nowISO()
    });
    db.dados_nivel1.push({
      paciente_id: joaoId,
      peso_kg: 78.4,
      altura_cm: 172,
      biometria_registada_em: "2026-06-01",
      alergias: "Sem alergias conhecidas",
      condicao_critica: "Doença renal crónica estadio 5 (N18.5); Hipertensão arterial (I10)",
      esquema_dose: "Hemodiálise 3x/semana (2ª, 4ª, 6ª); Losartan 50mg 1x/dia",
      medicacao_contraindicada: "Anti-inflamatórios não esteroides (AINEs); contraste iodado sem preparação",
      limitacao_terapeutica: "nao_aplicavel",
      esquema_atuacao_crise: "Em caso de hipercaliemia ou sobrecarga de volume, contactar Nefrologia de urgência antes de qualquer decisão de diálise extra.",
      notas: "Doente dialisado — evitar sobrecarga de volume em fluidoterapia.",
      medicacao_cronica: "Losartan 50mg 1x/dia; Carbonato de cálcio 500mg às refeições",
      escrito_por_id: drTiagoId,
      escrito_em: nowISO(),
      verificado_por_id: null,
      verificado_em: null,
      estado_verificacao: "nao_verificado",
      validado_em: null,
      atualizado_em: nowISO()
    });
    db.documentos.push({
      id: uuid(), paciente_id: joaoId, tipo: "rgpd", nome_ficheiro: "rgpd_joao_ribeiro.pdf",
      storage_path: "documentos/" + joaoId + "/rgpd.pdf", enviado_por_id: drTiagoId, enviado_em: nowISO()
    });
    db.pulseiras.push({
      id: "puls-joao-001", token: "SAVI-DEMO-JOAO", serial_fisico: "NTAG-000102", lote_id: loteId,
      estado: "ativa", paciente_id: joaoId, atribuida_em: nowISO(), desativada_em: null,
      motivo_desativacao: null, criado_em: nowISO()
    });

    // ---- Paciente pediátrico: Rodrigo Alves (cardiopatia congénita) ----
    var rodrigoId = "pac-rodrigo-alves";
    db.pacientes.push({
      id: rodrigoId,
      nome: "Rodrigo Alves",
      data_nascimento: "2018-09-30",
      sexo: "M",
      numero_utente: "5566778899",
      morada: "Rua do Carvalho, 45, 4200-000 Porto",
      contacto_familia: "+351 966 111 222 (pai — Tiago Alves)",
      contacto_emergencia: "+351 966 111 222 (pai — Tiago Alves)",
      gestor_do_caso: gestorDoCaso(drAna),
      estado_consentimento: "ativo",
      criado_por_id: drAnaId,
      criado_em: nowISO()
    });
    db.dados_nivel1.push({
      paciente_id: rodrigoId,
      peso_kg: 24.1,
      altura_cm: 118,
      biometria_registada_em: "2026-05-15",
      alergias: "Sem alergias conhecidas",
      condicao_critica: "Tetralogia de Fallot operada (Q21.3)",
      esquema_dose: "Propranolol 10mg 2x/dia",
      medicacao_contraindicada: "Descongestionantes simpaticomiméticos",
      limitacao_terapeutica: "nao",
      esquema_atuacao_crise: "Em crise de cianose/hipóxia aguda, posição genupeitoral, oxigénio e contacto imediato com Cardiologia Pediátrica de referência.",
      notas: "Vigilância cardiológica trimestral.",
      medicacao_cronica: "Propranolol 10mg 2x/dia",
      escrito_por_id: drAnaId,
      escrito_em: nowISO(),
      verificado_por_id: drAnaId,
      verificado_em: "2026-05-15T10:00:00.000Z",
      estado_verificacao: "verificado",
      validado_em: "2026-05-15T10:00:00.000Z",
      atualizado_em: "2026-05-15T10:00:00.000Z"
    });
    db.pulseiras.push({
      id: "puls-rodrigo-perdida", token: "SAVI-DEMO-RODRIGO-PERDIDA", serial_fisico: "NTAG-000103", lote_id: loteId,
      estado: "perdida", paciente_id: rodrigoId, atribuida_em: nowISO(), desativada_em: nowISO(),
      motivo_desativacao: "Pulseira perdida — reportada pelo profissional.", criado_em: nowISO()
    });

    // ---- Pulseira ainda não atribuída (para testar "Solicitar pulseira") ----
    db.pulseiras.push({
      id: "puls-nao-atribuida-001", token: "SAVI-DEMO-NAO-ATRIBUIDA", serial_fisico: "NTAG-000104", lote_id: loteId,
      estado: "nao_atribuida", paciente_id: null, atribuida_em: null, desativada_em: null,
      motivo_desativacao: null, criado_em: nowISO()
    });
    db.pulseiras.push({
      id: "puls-nao-atribuida-002", token: "SAVI-DEMO-NAO-ATRIBUIDA-2", serial_fisico: "NTAG-000105", lote_id: loteId,
      estado: "nao_atribuida", paciente_id: null, atribuida_em: null, desativada_em: null,
      motivo_desativacao: null, criado_em: nowISO()
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
      // localStorage indisponível (ex. modo privado) — a simulação continua em memória.
    }
  }

  var DB = load();

  function save() {
    persist(DB);
  }

  function calcularIdadeAnos(dataNascISO) {
    var hoje = new Date();
    var nasc = new Date(dataNascISO);
    var anos = hoje.getFullYear() - nasc.getFullYear();
    var m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
    return anos;
  }

  function calcularIdadeMesesTotais(dataNascISO) {
    var hoje = new Date();
    var nasc = new Date(dataNascISO);
    var meses = (hoje.getFullYear() - nasc.getFullYear()) * 12 + (hoje.getMonth() - nasc.getMonth());
    if (hoje.getDate() < nasc.getDate()) meses--;
    return Math.max(0, meses);
  }

  // Idade formatada em anos e/ou meses, como pedido para o cabeçalho do
  // Nível 1: crianças com menos de 3 anos mostram anos+meses (ou só
  // meses, se tiver menos de 1 ano); a partir dos 3 anos mostra só anos.
  function formatarIdade(dataNascISO) {
    var mesesTotais = calcularIdadeMesesTotais(dataNascISO);
    if (mesesTotais < 36) {
      var anos = Math.floor(mesesTotais / 12);
      var meses = mesesTotais % 12;
      if (anos === 0) return meses + (meses === 1 ? " mês" : " meses");
      return anos + (anos === 1 ? " ano" : " anos") + " " + meses + (meses === 1 ? " mês" : " meses");
    }
    var anosTotais = calcularIdadeAnos(dataNascISO);
    return anosTotais + (anosTotais === 1 ? " ano" : " anos");
  }

  // Superfície corporal — fórmula de Mosteller: √((altura_cm × peso_kg) / 3600).
  function calcularSuperficieCorporal(alturaCm, pesoKg) {
    if (!alturaCm || !pesoKg) return null;
    return Math.sqrt((alturaCm * pesoKg) / 3600);
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
    calcularIdade: calcularIdadeAnos,
    formatarIdade: formatarIdade,
    calcularSuperficieCorporal: calcularSuperficieCorporal,

    // ---------- Profissionais / utilizadores / superadmin ----------
    listProfissionais: function () {
      return DB.profissionais.slice();
    },
    getProfissionalPorCredencial: function (credencial) {
      return DB.profissionais.find(function (p) { return p.credencial_ordem === credencial; }) || null;
    },
    getProfissional: function (id) {
      return DB.profissionais.find(function (p) { return p.id === id; }) || null;
    },
    // `dados.pinHash` já vem calculado (hashUtil.sha256Hex) — nunca se
    // recebe/guarda o PIN em texto simples nesta função.
    criarProfissional: function (dados) {
      var novo = {
        id: uuid(),
        nome: dados.nome,
        credencial_ordem: dados.credencial_ordem,
        pin_hash: dados.pinHash,
        papeis: dados.papeis || [],
        funcao_auditor: !!dados.funcao_auditor,
        servico: dados.servico || "",
        especialidade: dados.especialidade || "",
        instituicao_servico: dados.instituicao_servico || "",
        telefone_institucional: dados.telefone_institucional || "",
        ativo: true,
        criado_em: nowISO()
      };
      DB.profissionais.push(novo);
      save();
      return novo;
    },
    atualizarProfissional: function (id, dados) {
      var p = this.getProfissional(id);
      if (!p) throw new Error("Conta não encontrada.");
      ["nome", "credencial_ordem", "servico", "especialidade", "instituicao_servico", "telefone_institucional"].forEach(function (k) {
        if (typeof dados[k] === "string") p[k] = dados[k];
      });
      if (Array.isArray(dados.papeis)) p.papeis = dados.papeis;
      if (typeof dados.funcao_auditor === "boolean") p.funcao_auditor = dados.funcao_auditor;
      if (dados.pinHash) p.pin_hash = dados.pinHash;
      save();
      return p;
    },
    desativarProfissional: function (id) {
      var p = this.getProfissional(id);
      if (!p) throw new Error("Conta não encontrada.");
      p.ativo = false;
      save();
      return p;
    },
    ativarProfissional: function (id) {
      var p = this.getProfissional(id);
      if (!p) throw new Error("Conta não encontrada.");
      p.ativo = true;
      save();
      return p;
    },
    eliminarProfissional: function (id) {
      var idx = DB.profissionais.findIndex(function (p) { return p.id === id; });
      if (idx === -1) throw new Error("Conta não encontrada.");
      DB.profissionais.splice(idx, 1);
      save();
      return true;
    },

    // ---------- Pacientes ----------
    listPacientes: function () {
      return DB.pacientes.slice();
    },
    listPacientesDoProfissional: function (profissionalId) {
      return DB.pacientes.filter(function (p) { return p.criado_por_id === profissionalId; });
    },
    getPaciente: function (id) {
      return DB.pacientes.find(function (p) { return p.id === id; }) || null;
    },
    getPacientePorNumeroUtente: function (numeroUtente) {
      return DB.pacientes.find(function (p) { return p.numero_utente === numeroUtente; }) || null;
    },
    // Método de acesso por identidade: nome completo + data de nascimento + sexo.
    getPacientePorIdentidade: function (nomeCompleto, dataNascimento, sexo) {
      var nomeNorm = (nomeCompleto || "").trim().toLowerCase();
      return DB.pacientes.find(function (p) {
        return (p.nome || "").trim().toLowerCase() === nomeNorm &&
          p.data_nascimento === dataNascimento &&
          p.sexo === sexo;
      }) || null;
    },
    // Verifica se `profissionalId` pode gerir (ver/editar) este paciente:
    // só o criador, ou o superadmin (verificação de superadmin feita pelo
    // chamador, que passa `ehSuperadmin=true` quando aplicável).
    podeGerirPaciente: function (pacienteId, profissionalId, ehSuperadmin) {
      if (ehSuperadmin) return true;
      var p = this.getPaciente(pacienteId);
      return !!p && p.criado_por_id === profissionalId;
    },
    criarPaciente: function (dados, profissionalId) {
      var criador = this.getProfissional(profissionalId);
      var novo = {
        id: uuid(),
        nome: dados.nome,
        data_nascimento: dados.data_nascimento,
        sexo: dados.sexo,
        numero_utente: dados.numero_utente || "",
        morada: dados.morada || "",
        contacto_familia: dados.contacto_familia || "",
        contacto_emergencia: dados.contacto_emergencia || "",
        gestor_do_caso: dados.gestor_do_caso || (criador ? {
          nome: criador.nome,
          credencial_ordem: criador.credencial_ordem,
          especialidade: criador.especialidade,
          instituicao_servico: criador.instituicao_servico,
          telefone_institucional: criador.telefone_institucional
        } : {}),
        estado_consentimento: "pendente",
        criado_por_id: profissionalId,
        criado_em: nowISO()
      };
      DB.pacientes.push(novo);
      // Regista o registo clínico vazio — só o profissional dono (ou o
      // superadmin) o preenche depois.
      DB.dados_nivel1.push({
        paciente_id: novo.id,
        peso_kg: null, altura_cm: null, biometria_registada_em: null,
        alergias: "", condicao_critica: "", esquema_dose: "", medicacao_contraindicada: "",
        limitacao_terapeutica: "nao_aplicavel", esquema_atuacao_crise: "", notas: "", medicacao_cronica: "",
        escrito_por_id: null, escrito_em: null,
        verificado_por_id: null, verificado_em: null,
        estado_verificacao: "nao_verificado", validado_em: null, atualizado_em: nowISO()
      });
      save();
      return novo;
    },
    atualizarPaciente: function (pacienteId, dados) {
      // Campos administrativos de "Dados do utente" — nunca dados clínicos
      // (esses vivem sempre em dados_nivel1).
      var p = this.getPaciente(pacienteId);
      if (!p) throw new Error("Paciente não encontrado.");
      ["nome", "morada", "numero_utente", "contacto_familia", "contacto_emergencia", "sexo", "data_nascimento", "estado_consentimento"].forEach(function (k) {
        if (typeof dados[k] !== "undefined") p[k] = dados[k];
      });
      if (dados.gestor_do_caso) p.gestor_do_caso = dados.gestor_do_caso;
      save();
      return p;
    },

    // ---------- dados_nivel1 ----------
    getDadosNivel1: function (pacienteId) {
      return DB.dados_nivel1.find(function (d) { return d.paciente_id === pacienteId; }) || null;
    },
    // Escrita EXCLUSIVA do profissional criador (ou superadmin). `autor` = { id, ehSuperadmin }.
    escreverDadosNivel1: function (pacienteId, campos, autor) {
      var paciente = this.getPaciente(pacienteId);
      if (!paciente) throw new Error("Paciente não encontrado.");
      if (!autor || (!autor.ehSuperadmin && paciente.criado_por_id !== autor.id)) {
        throw new Error("Acesso negado: só o profissional que criou este paciente (ou o superadmin) pode escrever dados clínicos.");
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
      var paciente = this.getPaciente(pacienteId);
      if (!paciente) throw new Error("Paciente não encontrado.");
      if (!autor || (!autor.ehSuperadmin && paciente.criado_por_id !== autor.id)) {
        throw new Error("Acesso negado: só o profissional que criou este paciente (ou o superadmin) pode verificar dados clínicos.");
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

    // ---------- Documentos (RGPD + termo de responsabilidade) ----------
    listDocumentosDoPaciente: function (pacienteId) {
      return DB.documentos.filter(function (d) { return d.paciente_id === pacienteId; });
    },
    adicionarDocumento: function (pacienteId, dados, autorId) {
      var novo = {
        id: uuid(),
        paciente_id: pacienteId,
        tipo: dados.tipo || "outro",
        nome_ficheiro: dados.nome_ficheiro || "documento.pdf",
        storage_path: "documentos/" + pacienteId + "/" + uuid() + ".pdf",
        enviado_por_id: autorId || null,
        enviado_em: nowISO()
      };
      DB.documentos.push(novo);
      save();
      return novo;
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
    // "Solicitar pulseira" — liga o paciente ao próximo token não
    // atribuído disponível (reaproveita atribuirPulseira, tal como já
    // existia na iteração anterior).
    solicitarPulseiraParaPaciente: function (pacienteId) {
      var livre = DB.pulseiras.find(function (p) { return p.estado === "nao_atribuida"; });
      if (!livre) throw new Error("Não há pulseiras disponíveis por atribuir. Gere um novo lote.");
      return this.atribuirPulseira(livre.id, pacienteId);
    },
    desativarPulseira: function (pulseiraId, motivo, revogadaPor) {
      var p = this.getPulseira(pulseiraId);
      if (!p) throw new Error("Pulseira não encontrada.");
      p.estado = "desativada";
      p.desativada_em = nowISO();
      p.motivo_desativacao = motivo || "";
      save();
      return p;
    },

    // ---------- Acessos (audit log) — escrita reservada ao worker-sim ----------
    registarAcesso: function (registo) {
      var novo = {
        id: uuid(),
        metodo_acesso: registo.metodo_acesso,
        pulseira_id: registo.pulseira_id || null,
        paciente_id: registo.paciente_id || null,
        utilizador_id: registo.utilizador_id || null,
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
    // Leitura só para funcao_auditor==true ou superadmin (aplicado nas views/rules).
    listAcessos: function () {
      return DB.acessos.slice().sort(function (a, b) { return new Date(b.acedido_em) - new Date(a.acedido_em); });
    },
    listAcessosDoPaciente: function (pacienteId) {
      return DB.acessos.filter(function (a) { return a.paciente_id === pacienteId; })
        .sort(function (a, b) { return new Date(b.acedido_em) - new Date(a.acedido_em); });
    }
  };

  global.mockdb = mockdb;
})(window);
