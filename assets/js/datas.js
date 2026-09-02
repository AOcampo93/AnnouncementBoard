/* ============================================================
   Quadro de Avisos — datas
   Os avisos são de uma ala em Leiria: as horas e os dias são os de
   lá, esteja quem lê onde estiver. Um irmão a ver isto do outro lado
   do mundo tem de ler a mesma hora que quem está na capela.
   ============================================================ */

const Datas = (function () {

  const FUSO = 'Europe/Lisbon';

  /* Intl sabe as regras de fuso e de horário de verão; fazer as contas
     à mão é a maneira mais fácil de errar duas vezes por ano. */
  const partesDe = new Intl.DateTimeFormat('pt-PT', {
    timeZone: FUSO,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  const nomeDoDia = new Intl.DateTimeFormat('pt-PT', { timeZone: FUSO, weekday: 'long' });
  const nomeDoMes = new Intl.DateTimeFormat('pt-PT', { timeZone: FUSO, month: 'long' });
  const mesCurto  = new Intl.DateTimeFormat('pt-PT', { timeZone: FUSO, month: 'short' });

  function emLeiria(quando) {
    const d = quando instanceof Date ? quando : new Date(quando);
    const p = {};
    for (const parte of partesDe.formatToParts(d)) {
      if (parte.type !== 'literal') p[parte.type] = parte.value;
    }
    return {
      ano: Number(p.year), mes: Number(p.month), dia: Number(p.day),
      hora: p.hour, minuto: p.minute,
      diaSemana: nomeDoDia.format(d),
      mes_extenso: nomeDoMes.format(d),
      mes_curto: mesCurto.format(d).replace('.', '')
    };
  }

  const maiuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

  /* Número do dia desde 1970 no fuso de Leiria. Serve para saber se
     dois instantes caem no mesmo dia lá, sem depender do relógio local. */
  function diaAbsoluto(quando) {
    const p = emLeiria(quando);
    return Date.UTC(p.ano, p.mes - 1, p.dia) / 86400000;
  }

  /* «Sexta-feira, 21 de agosto» — o dia de hoje em Leiria. */
  function hojeLegivel() {
    const p = emLeiria(new Date());
    return `${maiuscula(p.diaSemana)}, ${p.dia} de ${p.mes_extenso}`;
  }

  /* «Hoje · 08:30», «Ontem · 19:12», «18 ago», «12 ago 2025» */
  function relativa(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';

    const p = emLeiria(d);
    const diasAtras = diaAbsoluto(new Date()) - diaAbsoluto(d);

    if (diasAtras === 0) return `Hoje · ${p.hora}:${p.minuto}`;
    if (diasAtras === 1) return `Ontem · ${p.hora}:${p.minuto}`;

    const anoAgora = emLeiria(new Date()).ano;
    return p.ano !== anoAgora
      ? `${p.dia} ${p.mes_curto} ${p.ano}`
      : `${p.dia} ${p.mes_curto}`;
  }

  /* «hoje às 14:05», «ontem às 19:12», «a 24 de agosto».
     Vai a seguir à palavra «Publicado», para nunca se confundir com a
     data do que o aviso anuncia. */
  function publicadoEm(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    const p = emLeiria(d);
    const diasAtras = diaAbsoluto(new Date()) - diaAbsoluto(d);

    if (diasAtras === 0) return `hoje às ${p.hora}:${p.minuto}`;
    if (diasAtras === 1) return `ontem às ${p.hora}:${p.minuto}`;

    const anoAgora = emLeiria(new Date()).ano;
    return p.ano !== anoAgora
      ? `a ${p.dia} de ${p.mes_extenso} de ${p.ano}`
      : `a ${p.dia} de ${p.mes_extenso}`;
  }

  /* «Hoje · 14:05», para etiquetar um aviso acabado de publicar. */
  function agoraLegivel() {
    const p = emLeiria(new Date());
    return `Hoje · ${p.hora}:${p.minuto}`;
  }

  return { FUSO, emLeiria, hojeLegivel, relativa, publicadoEm, agoraLegivel, diaAbsoluto };
})();
