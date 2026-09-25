/* mockdb.js
 * SAVI — pivô para produção real (revisão de 19/09/2026): este ficheiro
 * já não simula a base de dados. Fica reduzido às funções puras, sem
 * I/O nenhum, que o resto da app usa para cálculos de apresentação
 * (idade, superfície corporal, ids/timestamps auxiliares). Os dados a
 * sério (pacientes, dados_nivel1, pulseiras, lotes, profissionais,
 * documentos, acessos) vivem agora no Firestore real, ver
 * docs/js/firestore-real.js — que acrescenta as funções de dados a este
 * mesmo objeto `window.mockdb` com `Object.assign`.
 *
 * O nome do ficheiro fica por compatibilidade com o resto do código
 * (todas as views chamam `mockdb.formatarIdade(...)`, etc.) — não vale a
 * pena renomear só por causa disto.
 */
(function (global) {
  "use strict";

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

  global.mockdb = {
    uuid: uuid,
    nowISO: nowISO,
    calcularIdade: calcularIdadeAnos,
    formatarIdade: formatarIdade,
    calcularSuperficieCorporal: calcularSuperficieCorporal
  };
})(window);
