// Självtest utan nätverk: kör motorn på syntetiska priser och spelar upp de senaste staplarna en i taget
// för att se vilka notiser boten skulle ha skickat. Kör: npm test
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { analysera, analyseraLangre, handelser, handelserLangre, grupperaHandelser, taBortPagaende, taBortPagaendeDag, tolkaTid } from '../docs/engine.js';

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

console.log(fel ? `\n${fel} fel` : '\nAlla tester gick igenom');
process.exit(fel ? 1 : 0);
