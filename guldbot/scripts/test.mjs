// Självtest utan nätverk: kör motorn på syntetiska priser och spelar upp de senaste staplarna en i taget
// för att se vilka notiser boten skulle ha skickat. Kör: npm test
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  analysera, analyseraLangre, handelser, handelserLangre, grupperaHandelser, taBortPagaende, taBortPagaendeDag, tolkaTid,
  aggregera, analyseraPosition, positionsHandelser,
} from '../docs/engine.js';
import * as E from '../docs/ekonomi-berakning.js';
import { kryptera, dekryptera, normalisera, laggTillAffarIData, laggTillKopIData, tomEkonomi } from '../docs/ekonomi-lagring.js';

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

// 11. Ekonomi: migrering från version 1, konton, trading, budget, mål
const ek = normalisera({
  konton: [
    { id: 'k1', namn: 'ISK', typ: 'langsiktigt', manadssparande: 3000, avkastning: 7, varden: [{ datum: '2026-01-01', varde: 50000 }, { datum: '2026-10-31', varde: 81000 }], transaktioner: [{ id: 't0', datum: '2026-05-25', belopp: 3000 }, { id: 't1', datum: '2026-11-25', belopp: 3000 }] },
    { id: 'k2', namn: 'Trading', typ: 'trading', varden: [{ datum: '2026-09-01', varde: 20000 }], transaktioner: [] },
    { id: 'k3', namn: 'Buffert', typ: 'buffert', varden: [{ datum: '2026-09-01', varde: 10000 }], transaktioner: [] },
  ],
  affarer: [{ id: 'a1', datum: '2026-10-02', instrument: 'Guld', insats: 2000, resultat: 600 }, { id: 'a2', datum: '2026-11-03', instrument: 'Guld', insats: 2000, resultat: -300 }, { id: 'a3', datum: '2026-11-20', instrument: 'Silver', insats: 1500, resultat: 450, avgift: 20, riktning: -1 },
    { id: 'a4', kopDatum: '2026-11-22', instrument: 'DAX', insats: 1000, oppen: true, resultat: null, datum: null }],
  budget: { inkomster: [{ id: 'i', namn: 'Lön', belopp: 16000 }], utgifter: [{ id: 'u', namn: 'Hyra', belopp: 9000, kategori: 'Boende' }], utfall: {} },
  utgifter: [{ id: 'f', namn: 'Försäkring', belopp: 6000, datum: '2026-03-15', aterkommande: 'ar', sparat: 1000 }],
});
kontroll(ek.version === 2 && ek.poster.length === 3 && !ek.budget && ek.poster.find((p) => p.id === 'f').sparaIhop, 'version 1 flyttas över till planerade poster');
kontroll(E.kontoVarde(ek.konton[0], ek, '2026-11-26') === 84000, 'kontovärde = senaste värde + insättningar efter');
kontroll(E.kontoUtveckling(ek.konton[0], ek, '2026-11-26').avkastning === 28000, 'avkastning räknas utan insättningar');
kontroll(E.kontoVarde(ek.konton[1], ek, '2026-11-26') === 20730, 'tradingkontot får realiserade resultat (öppna köp räknas inte)');
const ts = E.tradingStatistik(ek.affarer);
kontroll(ts.summa === 730 && ts.antal === 3 && nara(ts.traffProc, 66.67, 0.01) && ts.maxNedgang === 300 && ts.kort.antal === 1, 'tradingstatistik (summa, träff, nedgång, kort/lång)');
kontroll(E.oppnaAffarer(ek.affarer).length === 1, 'öppna köp hålls isär');
const pot = E.sparpotter(ek, '2026-11-26')[0];
kontroll(pot.nastaDatum === '2027-03-15' && pot.perManad === 1250, 'utgift att spara ihop till flyttas till nästa år och delas per månad');
const bm = E.budgetForManad(ek, '2026-11', '2026-11-26');
kontroll(bm.inkomster === 16000 && bm.utgifter === 9000 && bm.sparande === 3000 && nara(bm.kvar, 16000 - 9000 - 3000 - 1250), 'budget för en månad');

// Flexibla poster: bidrag en gång i januari och hyra från januari
ek.poster.push({ id: 'b1', typ: 'inkomst', namn: 'Utbytesbidrag', belopp: 20000, kategori: 'Bidrag och stipendier', frekvens: 'en-gang', start: '2027-01-15' });
ek.poster.push({ id: 'h1', typ: 'utgift', namn: 'Hyra utbyte', belopp: 10000, kategori: 'Boende', frekvens: 'manad', start: '2027-01-01', slut: '2027-06-30' });
ek.poster.push({ id: 'q1', typ: 'utgift', namn: 'Kvartalsavgift', belopp: 300, kategori: 'Övrigt', frekvens: 'kvartal', start: '2026-12-01' });
const dec = E.budgetForManad(ek, '2026-12', '2026-11-26'), jan = E.budgetForManad(ek, '2027-01', '2026-11-26'), feb = E.budgetForManad(ek, '2027-02', '2026-11-26');
const jul = E.budgetForManad(ek, '2027-07', '2026-11-26'), mar = E.budgetForManad(ek, '2027-03', '2026-11-26');
kontroll(dec.utgifter === 9300 && jan.inkomster === 36000 && jan.utgifter === 19000 && feb.inkomster === 16000 && feb.utgifter === 19000, 'engångsinkomst i januari och hyra från januari');
kontroll(jul.utgifter === 9000 && mar.utgifter === 19300, 'slutdatum och kvartalsposter');
const pr = E.prognos(ek, 12, '2026-11-26');
kontroll(pr.length === 12 && nara(pr[2].kumulativt, pr[0].kvar + pr[1].kvar + pr[2].kvar), 'prognos med kumulativt överskott');

// Registrerade transaktioner
ek.transaktioner = [
  { id: 'x1', datum: '2026-11-03', belopp: -5200, text: 'Hyra', kategori: 'Boende' },
  { id: 'x2', datum: '2026-11-05', belopp: -432.5, text: 'ICA Maxi', kategori: E.gissaKategori('ICA Maxi', -432.5) },
  { id: 'x3', datum: '2026-11-07', belopp: -129, text: 'Spotify AB', kategori: E.gissaKategori('Spotify AB', -129) },
  { id: 'x4', datum: '2026-10-07', belopp: -129, text: 'Spotify AB', kategori: 'Abonnemang' },
  { id: 'x5', datum: '2026-11-25', belopp: 12000, text: 'CSN', kategori: E.gissaKategori('CSN utbetalning', 12000) },
];
kontroll(ek.transaktioner[1].kategori === 'Mat och dagligvaror' && ek.transaktioner[2].kategori === 'Abonnemang' && ek.transaktioner[4].kategori === 'Studiemedel', 'kategorier gissas från texten');
kontroll(E.gissaKategori('ICA Maxi', -50, [{ monster: 'ica maxi', kategori: 'Övrigt' }]) === 'Övrigt', 'egna regler går före');
const fm = E.faktisktForManad(ek, '2026-11');
kontroll(fm.utgifter === 5761.5 && fm.inkomster === 12000 && fm.perKategori.Boende === 5200, 'utgifter och inkomster per månad och kategori');
const us = E.utgiftsstatistik(ek, '2026-11', 3, '2026-11-26');
kontroll(us.kategorier[0].kategori === 'Boende' && us.snittManad === 129 && nara(us.perDag, 5761.5 / 26, 0.01), 'utgiftsstatistik');
const ur = E.manadsutrymme(ek, '2026-11-26');
kontroll(ur.lage === 'faktiskt' && nara(ur.kvar, 16000 - 3000 - 1250 - 5761.5) && ur.dagarKvar === 5, 'utrymme att spendera resten av månaden');

// Import av kontoutdrag
const csv = 'Transaktionsrapport\nBokföringsdag;Transaktionsdag;Text;Belopp;Saldo\n2026-11-02;2026-11-01;ICA NARA;-245,50;10 000,00\n2026-11-03;2026-11-03;SPOTIFY;-129,00;9 871,00\n2026-11-25;2026-11-25;CSN;12 000,00;21 871,00\n';
const tolkad = E.tolkaCsv(csv);
const kol = E.gissaKolumner(tolkad.rubrik, tolkad.rader);
kontroll(tolkad.separator === ';' && tolkad.rubrik?.[2] === 'Text' && kol.belopp === 3 && kol.text === 2 && kol.datum <= 1, 'kontoutdrag: separator, rubrik och kolumner hittas');
const imp = E.importeraRader(tolkad.rader, kol, [], [{ datum: '2026-11-03', belopp: -129, text: 'SPOTIFY' }]);
kontroll(imp.nya.length === 2 && imp.dubbletter === 1 && imp.nya[0].belopp === -245.5 && imp.nya[1].kategori === 'Studiemedel', 'import hoppar över dubbletter och kategoriserar');
kontroll(E.tolkaBelopp('−1 234,50') === -1234.5 && E.tolkaBelopp('1.234,50') === 1234.5 && E.tolkaDatum('24.11.2026') === '2026-11-24', 'belopp och datum i olika format');

// Mål, fördelning, sparplan och tips
const mp = E.malPrognos({ belopp: 300000, datum: '2029-06-01', kontoIds: ['k1'] }, ek, '2026-11-26');
kontroll(mp.nuvarande === 84000 && !mp.iFas && nara(E.slutvarde(84000, mp.kravSpar, 7, mp.manader), 300000), 'målprognos med kopplat konto');
const fo = E.fordelning(ek, '2026-11-26');
kontroll(fo.per.buffert === 10000 && nara(fo.hogriskAndel, (100 * 20730) / (84000 + 20730), 0.01), 'fördelning och högriskandel');
const sp = E.sparplan(ek, { bufferManader: 3, hogriskMax: 10 }, '2026-11-26');
kontroll(nara(sp.tillBuffert + sp.tillHogrisk + sp.tillLangsiktigt, sp.total) && sp.tillBuffert > 0, 'sparplanen fördelar hela sparandet');
const tp = E.tips(ek, {}, '2026-11-26');
kontroll(tp.some((x) => x.id === 'hogrisk' && x.niva === 'varning') && tp.some((x) => x.id === 'buffert') && tp[0].niva === 'varning', 'tips sorteras med varningar först');
kontroll(E.formogenhetsserie(ek, '2026-11-26').at(-1).varde === 114730, 'förmögenhetsserien slutar på dagens värde');

// 12. Ekonomi: kryptering
const kuvert = await kryptera(ek, 'en lång lösenfras');
kontroll(!JSON.stringify(kuvert).includes('ISK') && kuvert.format === 'guldbot-ekonomi', 'krypterad fil innehåller inga läsbara uppgifter');
kontroll((await dekryptera(kuvert, 'en lång lösenfras')).konton.length === 3, 'rätt lösenfras dekrypterar');
let felLosen = false;
try { await dekryptera(kuvert, 'fel fras'); } catch { felLosen = true; }
kontroll(felLosen, 'fel lösenfras avvisas');
const tomt = tomEkonomi();
kontroll(laggTillAffarIData(tomt, { posId: 'p1', resultat: 5 }) && !laggTillAffarIData(tomt, { posId: 'p1', resultat: 5 }), 'samma affär från Guldbot läggs inte in två gånger');
laggTillKopIData(tomt, { posId: 'p2', kopDatum: '2026-11-20', insats: 2000, instrument: 'Guld' });
laggTillAffarIData(tomt, { posId: 'p2', datum: '2026-11-26', resultat: 450 });
kontroll(tomt.affarer.length === 2 && tomt.affarer[1].oppen === false && tomt.affarer[1].insats === 2000 && tomt.affarer[1].kopDatum === '2026-11-20', 'ett köp från Guldbot stängs när du säljer');

console.log(fel ? `\n${fel} fel` : '\nAlla tester gick igenom');
process.exit(fel ? 1 : 0);
