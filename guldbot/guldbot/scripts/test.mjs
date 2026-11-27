// Självtest utan nätverk: kör motorn på syntetiska priser och spelar upp de senaste staplarna en i taget
// för att se vilka notiser boten skulle ha skickat. Kör: npm test
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  analysera, analyseraLangre, handelser, handelserLangre, grupperaHandelser, taBortPagaende, taBortPagaendeDag, tolkaTid,
  aggregera, analyseraPosition, positionsHandelser,
} from '../docs/engine.js';
import * as E from '../docs/ekonomi-berakning.js';
import { kryptera, dekryptera, normalisera, laggTillAffarIData, tomEkonomi } from '../docs/ekonomi-lagring.js';

const fil = new URL('../test-data/syntetiska-staplar.json', import.meta.url);
if (!existsSync(fil)) execFileSync(process.execPath, [new URL('./gen-testdata.mjs', import.meta.url).pathname]);
const alla = JSON.parse(readFileSync(fil, 'utf8'));

let fel = 0;
const kontroll = (ok, text) => { console.log(`${ok ? 'OK  ' : 'FEL '} ${text}`); if (!ok) fel++; };

// 1. Grundanalys
const r = analysera(alla, { intervallMin: 60 });
kontroll(Number.isFinite(r.pris), 'analysen ger ett pris');
kontroll(['lag', 'medel', 'hog'].every((k) => r.nivaer[k]), 'alla tre risknivåer finns');
kontroll(r.nivaer.lag.stats.antal <= r.nivaer.medel.stats.antal && r.nivaer.medel.stats.antal <= r.nivaer.hog.stats.antal,
  `låg risk ger färre affärer än hög (${r.nivaer.lag.stats.antal} / ${r.nivaer.medel.stats.antal} / ${r.nivaer.hog.stats.antal})`);

// 2. Inga framtidsdata: analysen av de första N staplarna ska ge samma affärer som den fulla analysen fram till dess
const N = alla.length - 500;
const del = analysera(alla.slice(0, N), { intervallMin: 60 });
const tGrans = alla[N - 1].t;
const fullaFore = r.nivaer.medel.affarer.filter((a) => a.utT <= tGrans).map((a) => a.inT + ':' + a.utT);
const delAff = del.nivaer.medel.affarer.map((a) => a.inT + ':' + a.utT);
kontroll(fullaFore.every((x) => delAff.includes(x)), 'signaler tittar inte framåt i tiden');

// 3. Pågående stapel tas bort
const sista = alla[alla.length - 1];
kontroll(taBortPagaende(alla, 60, sista.t + 30 * 60000).length === alla.length - 1, 'pågående stapel tas bort');
kontroll(taBortPagaende(alla, 60, sista.t + 61 * 60000).length === alla.length, 'stängd stapel behålls');

// 4. Spela upp de senaste 300 staplarna och räkna notiser
let forra = null, antal = 0;
const perTyp = {};
for (let n = alla.length - 300; n <= alla.length; n++) {
  const nu = analysera(alla.slice(0, n), { intervallMin: 60 });
  const lista = grupperaHandelser(handelser(forra, nu));
  for (const h of lista) { antal++; perTyp[h.typ] = (perTyp[h.typ] || 0) + 1; if (antal <= 6) console.log('   ', h.titel, '|', h.text.replace(/\n/g, ' / ')); }
  forra = nu;
}
console.log(`    ${antal} notiser på 300 timmar:`, perTyp);
kontroll(antal > 0 && antal < 150, 'rimligt antal notiser');

// 5. Samma stapel två gånger → inga dubbla notiser
kontroll(handelser(r, r).length === 0, 'ingen notis när ingen ny stapel kommit');

// 6. Längre lägen på dagsstaplar
const dagar = [];
{
  let seed = 9, p = 100, d = 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const nrm = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  for (let k = 0; k < 1500; k++) {
    if (k % 150 === 0) d = (rnd() - 0.45) * 0.005;
    const o = p, c = o * (1 + d + nrm() * 0.014);
    dagar.push({ t: Date.UTC(2021, 0, 1) + k * 86400000, o, h: Math.max(o, c) * 1.004, l: Math.min(o, c) * 0.996, c });
    p = c;
  }
}
const lang = analyseraLangre(dagar, { valuta: 'SEK' });
kontroll(['KOP', 'SETUP', 'INGET'].includes(lang.lage) && lang.stats.antal > 0, `längre lägen ger affärer i historiken (${lang.stats.antal})`);
const langDel = analyseraLangre(dagar.slice(0, 1300));
const grans = dagar[1299].t;
const fore = lang.affarer.filter((a) => a.utT <= grans && a.inT >= langDel.affarer[0]?.inT).map((a) => a.inT + ':' + a.utT);
kontroll(fore.every((x) => langDel.affarer.map((a) => a.inT + ':' + a.utT).includes(x)), 'längre lägen tittar inte framåt i tiden');
kontroll(handelserLangre(lang, lang, 'Test').length === 0, 'ingen längre-notis när ingen ny dag kommit');
kontroll(lang.affarer.every((a) => a.utPris >= 0 && Number.isFinite(a.proc)), 'affärer har rimliga resultat');

// 7. Tider och pågående dagsstapel
kontroll(new Date(tolkaTid('2026-11-24')).toISOString() === '2026-11-24T00:00:00.000Z', 'dagstid från Twelve Data tolkas rätt');
kontroll(new Date(tolkaTid('2026-11-24 13:00:00')).toISOString() === '2026-11-24T13:00:00.000Z', 'timtid från Twelve Data tolkas rätt');
const idag = Date.UTC(2026, 10, 24, 10);
kontroll(taBortPagaendeDag([{ t: Date.UTC(2026, 10, 23) }, { t: Date.UTC(2026, 10, 24) }], idag).length === 1, 'dagens dagsstapel tas bort');
kontroll(taBortPagaendeDag([{ t: Date.UTC(2026, 10, 22) }, { t: Date.UTC(2026, 10, 23, 13, 30) }], idag).length === 2, 'gårdagens dagsstapel behålls');

// 8. Instrumentnamn och decimaler i notiser
const fx = analysera(alla.map((s) => ({ ...s, o: s.o / 3500, h: s.h / 3500, l: s.l / 3500, c: s.c / 3500 })), { intervallMin: 60, dec: 5, valuta: 'USD' });
kontroll(fx.dec === 5 && fx.analys.find((x) => x.rubrik === 'Nivåer').text.includes(','), 'valutapar får fler decimaler');

// 9. Egna positioner
{
  const femmor = [];
  let p = 4000;
  const t0 = Date.UTC(2026, 10, 16);
  for (let k = 0; k < 2000; k++) { const o = p; p = o * (1 + Math.sin(k / 37) * 0.0006); femmor.push({ t: t0 + k * 300000, o, h: Math.max(o, p) * 1.0002, l: Math.min(o, p) * 0.9998, c: p }); }
  const timmar = aggregera(femmor, 60);
  kontroll(timmar.length === Math.ceil(2000 / 12) && timmar[0].h >= Math.max(...femmor.slice(0, 12).map((x) => x.h)) - 1e-9, '5-minutersstaplar slås ihop till timmar');
  const sista = femmor.at(-1).c;
  const lang = { id: 'x', instrument: 'guld', riktning: 1, niva: 'medel', inPris: sista, inT: femmor.at(-1).t, stop: sista - 20, mal: sista + 40 };
  const kopia = (pris) => [...femmor, { t: femmor.at(-1).t + 300000, o: sista, h: Math.max(sista, pris), l: Math.min(sista, pris), c: pris }];
  const vinst = analyseraPosition(lang, kopia(sista + 41));
  kontroll(vinst.status === 'SALJ' && vinst.skal.some((x) => x.kod === 'mal'), 'säljsignal när målet nås');
  const forlust = analyseraPosition(lang, kopia(sista - 21));
  kontroll(forlust.status === 'SALJ' && forlust.skal.some((x) => x.kod === 'stop'), 'säljsignal när stoppen nås');
  const kort = analyseraPosition({ ...lang, riktning: -1, stop: sista + 20, mal: sista - 40 }, kopia(sista - 41));
  kontroll(kort.status === 'SALJ' && kort.r > 1.9, 'kort position: målet nås när priset faller');
  const halv = analyseraPosition(lang, kopia(sista + 22));
  kontroll(halv.stopTyp === 'break-even' && Math.abs(halv.stop - sista) < 5, 'stoppen flyttas till köppriset vid +1R');
  const barr = analyseraPosition({ ...lang, barriar: sista - 3 }, kopia(sista - 1));
  kontroll(barr.skal.some((x) => x.kod === 'barriar'), 'varning eller säljsignal nära turbons barriär');
  const forsta = positionsHandelser(null, halv, lang, 'Guld', 0);
  kontroll(forsta.length >= 1 && forsta[0].typ === 'start', 'första analysen ger notisen "Bevakar"');
  const s1 = positionsHandelser(halv, vinst, lang, 'Guld', 60000);
  const s2 = positionsHandelser(vinst, { ...vinst, minne: undefined }, lang, 'Guld', 120000);
  kontroll(s1.some((h) => h.typ === 'salj') && !s2.some((h) => h.typ === 'salj'), 'säljsignalen skickas en gång, sedan bara påminnelser');
}

// 10. Ekonomi: ränta på ränta
const nara = (a, b, tol = 1) => Math.abs(a - b) <= tol;
kontroll(nara(E.slutvarde(10000, 2000, 7, 120), 361775), 'slutvärde med månadssparande (10 000 + 2 000/mån, 7 %, 10 år)');
kontroll(nara(E.slutvarde(E.slutvarde(0, 0, 0, 0) + 5000, 0, 10, 12), 5500), 'ett år med 10 % avkastning');
const krav = E.kravManadsspar(1e6, 10000, 7, 120);
kontroll(nara(E.slutvarde(10000, krav, 7, 120), 1e6), 'krav på månadssparande ger målet');
const kravA = E.kravAvkastning(1e6, 10000, 5000, 120);
kontroll(nara(E.slutvarde(10000, 5000, kravA, 120), 1e6, 5), 'krav på avkastning ger målet');
kontroll(E.manaderTill(100000, 10000, 2000, 7) === 40, 'antal månader till 100 000');
kontroll(E.kravAvkastning(1e9, 0, 100, 12) === null, 'orimligt mål ger inget avkastningskrav');

// 11. Ekonomi: konton, trading, budget, utgifter, mål
const ek = normalisera({
  konton: [
    { id: 'k1', namn: 'ISK', typ: 'langsiktigt', manadssparande: 3000, avkastning: 7, varden: [{ datum: '2026-01-01', varde: 50000 }, { datum: '2026-10-31', varde: 81000 }], transaktioner: [{ id: 't0', datum: '2026-05-25', belopp: 3000 }, { id: 't1', datum: '2026-11-25', belopp: 3000 }] },
    { id: 'k2', namn: 'Trading', typ: 'trading', varden: [{ datum: '2026-09-01', varde: 20000 }], transaktioner: [] },
  ],
  affarer: [{ id: 'a1', datum: '2026-10-02', instrument: 'Guld', insats: 2000, resultat: 600 }, { id: 'a2', datum: '2026-11-03', instrument: 'Guld', insats: 2000, resultat: -300 }, { id: 'a3', datum: '2026-11-20', instrument: 'Silver', insats: 1500, resultat: 450, avgift: 20 }],
  budget: { inkomster: [{ id: 'i', belopp: 16000 }], utgifter: [{ id: 'u', belopp: 9000 }], utfall: { '2026-11': { u: 9500 } } },
  utgifter: [{ id: 'f', namn: 'Försäkring', belopp: 6000, datum: '2026-03-15', aterkommande: 'ar', sparat: 1000 }],
});
kontroll(E.kontoVarde(ek.konton[0], ek, '2026-11-26') === 84000, 'kontovärde = senaste värde + insättningar efter');
kontroll(E.kontoUtveckling(ek.konton[0], ek, '2026-11-26').avkastning === 28000, 'avkastning räknas utan insättningar');
kontroll(E.kontoVarde(ek.konton[1], ek, '2026-11-26') === 20730, 'tradingkontot får realiserade resultat efter avgifter');
const ts = E.tradingStatistik(ek.affarer);
kontroll(ts.summa === 730 && ts.antal === 3 && nara(ts.traffProc, 66.67, 0.01) && ts.maxNedgang === 300, 'tradingstatistik (summa, träff, största nedgång)');
const up = E.utgiftsplan(ek.utgifter, '2026-11-26')[0];
kontroll(up.nastaDatum === '2027-03-15' && up.perManad === 1250, 'återkommande utgift flyttas till nästa år och delas per månad');
const bs = E.budgetSammanfattning(ek, '2026-11', '2026-11-26');
kontroll(bs.utgifterUtfall === 9500 && bs.sparande === 3000 && nara(bs.kvar, 16000 - 9500 - 3000 - 1250), 'budget: utfall, sparande och avsättningar');
const mp = E.malPrognos({ belopp: 300000, datum: '2029-06-01', kontoIds: ['k1'] }, ek, '2026-11-26');
kontroll(mp.nuvarande === 84000 && !mp.iFas && nara(E.slutvarde(84000, mp.kravSpar, 7, mp.manader), 300000), 'målprognos med kopplat konto');
kontroll(E.formogenhetsserie(ek, '2026-11-26').at(-1).varde === 104730, 'förmögenhetsserien slutar på dagens värde');

// 12. Ekonomi: kryptering
const kuvert = await kryptera(ek, 'en lång lösenfras');
kontroll(!JSON.stringify(kuvert).includes('ISK') && kuvert.format === 'guldbot-ekonomi', 'krypterad fil innehåller inga läsbara uppgifter');
kontroll((await dekryptera(kuvert, 'en lång lösenfras')).konton.length === 2, 'rätt lösenfras dekrypterar');
let felLosen = false;
try { await dekryptera(kuvert, 'fel fras'); } catch { felLosen = true; }
kontroll(felLosen, 'fel lösenfras avvisas');
const tomt = tomEkonomi();
kontroll(laggTillAffarIData(tomt, { posId: 'p1', resultat: 5 }) && !laggTillAffarIData(tomt, { posId: 'p1', resultat: 5 }), 'samma affär från Guldbot läggs inte in två gånger');

console.log(fel ? `\n${fel} fel` : '\nAlla tester gick igenom');
process.exit(fel ? 1 : 0);
