// Skapar syntetiska priser för att testa boten utan nätverk. INTE riktiga priser.
// node scripts/gen-testdata.mjs            → test-data/syntetiska-staplar.json (guld, timmar)
// node scripts/gen-testdata.mjs alla       → test-data/<id>.json och test-data/<id>-dag.json för hela bevakningslistan
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

function serie(n, stegMs, startPris, vol, seed, slut) {
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  let p = startPris, drift = 0;
  const ut = [];
  for (let k = 0; k < n; k++) {
    if (k % 150 === 0) drift = (rnd() - 0.5) * vol * 0.35;
    const o = p;
    const c = o * (1 + drift + normal() * vol);
    const h = Math.max(o, c) * (1 + Math.abs(normal()) * vol * 0.35);
    const l = Math.min(o, c) * (1 - Math.abs(normal()) * vol * 0.35);
    const r = (v) => Math.round(v * 1e5) / 1e5;
    ut.push({ t: slut - (n - k) * stegMs, o: r(o), h: r(h), l: r(l), c: r(c) });
    p = c;
  }
  return ut;
}

const TESTPRIS = { guld: 4000, silver: 50, brent: 65, eurusd: 1.16, usdsek: 9.5, sp500: 6700, nasdaq100: 24500, dax: 23500, omxs30: 2700, nvidia: 180, tesla: 400, bitcoin: 90000, ethereum: 3000, volvo: 260, ericsson: 90 };
const mapp = new URL('../test-data/', import.meta.url);
mkdirSync(mapp, { recursive: true });
const slutTimme = Math.floor(Date.now() / 3600000) * 3600000;
const slutDag = Math.floor(Date.now() / 86400000) * 86400000;

if (process.argv[2] === 'alla') {
  const lista = JSON.parse(readFileSync(new URL('../docs/bevakning.json', import.meta.url), 'utf8')).instrument;
  lista.forEach((ins, k) => {
    const start = TESTPRIS[ins.id] || 100;
    writeFileSync(new URL(`${ins.id}.json`, mapp), JSON.stringify(serie(3000, 3600000, start, 0.0035, 11 + k * 7, slutTimme)));
    writeFileSync(new URL(`${ins.id}-dag.json`, mapp), JSON.stringify(serie(1500, 86400000, start, 0.014, 101 + k * 13, slutDag)));
  });
  console.log(`Syntetiska tim- och dagsstaplar för ${lista.length} instrument i test-data/`);
} else {
  const n = Number(process.argv[2] || 3000);
  const ut = serie(n, 3600000, 4000, 0.0035, Number(process.argv[3] || 42), Date.UTC(2026, 10, 24, 12));
  writeFileSync(new URL('syntetiska-staplar.json', mapp), JSON.stringify(ut));
  console.log(`${n} syntetiska staplar, sista pris ${ut.at(-1).c}`);
}
