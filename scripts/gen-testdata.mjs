// Skapar syntetiska guldpriser (timstaplar) för att testa boten utan nätverk. INTE riktiga priser.
import { writeFileSync } from 'node:fs';
let seed = Number(process.argv[3] || 42);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const normal = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const n = Number(process.argv[2] || 3000);
const slut = Date.UTC(2026, 10, 24, 12);
let p = 4000, drift = 0, ut = [];
for (let k = 0; k < n; k++) {
  if (k % 150 === 0) drift = (rnd() - 0.5) * 0.0012;
  const o = p;
  const steg = drift + normal() * 0.0035;
  const c = o * (1 + steg);
  const h = Math.max(o, c) * (1 + Math.abs(normal()) * 0.0012);
  const l = Math.min(o, c) * (1 - Math.abs(normal()) * 0.0012);
  ut.push({ t: slut - (n - k) * 3600000, o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2) });
  p = c;
}
writeFileSync(new URL('../test-data/syntetiska-staplar.json', import.meta.url), JSON.stringify(ut));
console.log(`${n} syntetiska staplar, sista pris ${p.toFixed(2)}`);
