/* views/utilizador-identidade.js
 * Método 3 de acesso: nome completo + data de nascimento + sexo. Exige
 * motivo obrigatório ANTES de mostrar qualquer dado — regra não
 * negociável (CLAUDE.md), fica registado em `acessos` como os outros.
 */
function viewUtilizadorIdentidade(root) {
  "use strict";

  var sessao = authSim.getSessao();

  root.innerHTML =
    '<div class="phone-stage"><div class="phone"><div class="screen">' +
    '<div class="topbar">' +
    '<div class="eyebrow"><span>SAVI</span><span>' + sessao.nome + "</span></div>" +
    '<div class="patient-row"><span class="name" style="font-size:17px;">Acesso por identidade</span></div>' +
    '<div class="meta">Serviço: ' + (sessao.servico || "—") + "</div>" +
    "</div>" +
    '<div class="scroll">' +
    '<div id="erro-msg" style="color:var(--alert);font-size:12.5px;margin-bottom:8px;"></div>' +
    "<label>Nome completo</label>" +
    '<input type="text" id="in-nome" placeholder="Ex.: Matilde Sousa">' +
    "<label>Data de nascimento</label>" +
    '<input type="date" id="in-nascimento">' +
    "<label>Sexo</label>" +
    '<select id="in-sexo"><option value="">Selecionar…</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="outro">Outro</option></select>' +
    '<div style="background:var(--unverified-bg);color:var(--unverified);border-radius:10px;padding:10px 12px;font-size:12px;margin:14px 0 4px;">Este método exige motivo obrigatório — o pedido fica registado com a sua identificação, data e hora.</div>' +
    "<label>Motivo do acesso</label>" +
    '<textarea id="in-motivo" placeholder="Ex.: paciente trazido à urgência sem pulseira, identificado pela família..."></textarea>' +
    '<button class="btn btn-primary btn-block" id="btn-procurar" style="margin-top:18px;">Procurar</button>' +
    '<div style="text-align:center;margin-top:16px;">' +
    '<button class="link-discreto" id="btn-voltar">← Escolher outro método</button>' +
    "</div>" +
    "</div>" +
    "</div></div></div>";

  document.getElementById("btn-procurar").addEventListener("click", executar);
  document.getElementById("btn-voltar").addEventListener("click", function () {
    SAVI_router.navegar("#/utilizador/metodo");
  });

  async function executar() {
    var msgEl = document.getElementById("erro-msg");
    msgEl.textContent = "";
    var nome = document.getElementById("in-nome").value.trim();
    var nascimento = document.getElementById("in-nascimento").value;
    var sexo = document.getElementById("in-sexo").value;
    var motivo = document.getElementById("in-motivo").value.trim();

    if (!nome || !nascimento || !sexo) { msgEl.textContent = "Preencha nome completo, data de nascimento e sexo."; return; }
    if (!motivo) { msgEl.textContent = "O motivo é obrigatório neste método de acesso."; return; }

    try {
      var resultado = await workerSim.acessoPorIdentidade({
        nomeCompleto: nome, dataNascimento: nascimento, sexo: sexo, motivo: motivo,
        servico: sessao.servico || "Urgência"
      });
      window.SAVI_ultimoAcesso = resultado;
      SAVI_router.navegar("#/nivel1/resultado");
    } catch (e) {
      if (e.tipo === "sessao_expirada") {
        SAVI_router.navegar("#/erro/sessao_expirada");
        return;
      }
      msgEl.textContent = e.message;
    }
  }
}
