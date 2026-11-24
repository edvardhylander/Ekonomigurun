// Självtest utan nätverk: kör motorn på syntetiska priser och spelar upp de senaste staplarna en i taget
// för att se vilka notiser boten skulle ha skickat. Kör: npm test
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { analysera, handelser, grupperaHandelser, taBortPagaende } from '../docs/engine.js';

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

console.log(fel ? `\n${fel} fel` : '\nAlla tester gick igenom');
process.exit(fel ? 1 : 0);
