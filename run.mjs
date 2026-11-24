// Körs av GitHub Actions varje timme (och när du startar den för hand):
// hämtar guldpriset, kör analysmotorn, skickar notiser om något har ändrats och sparar docs/data.json åt dashboarden.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { analysera, handelser, grupperaHandelser, taBortPagaende, tal } from '../docs/engine.js';

const env = (namn, standard = '') => (process.env[namn] || '').trim() || standard;
const NYCKEL = env('TWELVEDATA_API_KEY');
const AMNE = env('NTFY_TOPIC');
const NTFY_SERVER = env('NTFY_SERVER', 'https://ntfy.sh');
const NOTISNIVAER = env('NOTISNIVAER', 'lag,medel,hog').split(',').map((s) => s.trim()).filter(Boolean);
const NOTIS_SETUP = env('NOTIS_SETUP', 'ja').toLowerCase() !== 'nej';
const TESTDATA = env('TESTDATA'); // sökväg till en JSON-fil med staplar, för test utan nätverk
const INTERVALL_MIN = 60;
const DATAFIL = new URL('../docs/data.json', import.meta.url);

function dashboardAdress() {
  if (env('DASHBOARD_URL')) return env('DASHBOARD_URL');
  const repo = env('GITHUB_REPOSITORY');
  if (!repo) return '';
  const [agare, namn] = repo.split('/');
  const vard = `${agare.toLowerCase()}.github.io`;
  return namn.toLowerCase() === vard ? `https://${vard}/` : `https://${vard}/${namn}/`;
}
const DASHBOARD = dashboardAdress();

async function hamtaTwelveData() {
  const url = new URL('https://api.twelvedata.com/time_series');
  url.search = new URLSearchParams({
    symbol: 'XAU/USD', interval: '1h', outputsize: '5000', timezone: 'UTC', apikey: NYCKEL,
  }).toString();
  const svar = await fetch(url);
  const j = await svar.json();
  if (j.status === 'error' || !Array.isArray(j.values)) throw new Error(`Twelve Data svarade: ${j.message || svar.status}`);
  return {
    kalla: 'Twelve Data, XAU/USD (spotpris)',
    staplar: j.values.map((v) => ({
      t: Date.parse(v.datetime.replace(' ', 'T') + 'Z'),
      o: Number(v.open), h: Number(v.high), l: Number(v.low), c: Number(v.close),
    })),
  };
}

async function hamtaYahoo() {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=60m&range=1y';
  const svar = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (guldbot)' } });
  if (!svar.ok) throw new Error(`Yahoo svarade ${svar.status}`);
  const r = (await svar.json())?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error('Yahoo gav ingen prisdata');
  const q = r.indicators.quote[0];
  return {
    kalla: 'Yahoo Finance, GC=F (terminskontrakt, reservkälla)',
    staplar: r.timestamp.map((t, i) => ({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] })),
  };
}

async function hamtaStaplar() {
  if (TESTDATA) return { kalla: 'TESTDATA (syntetiska priser)', staplar: JSON.parse(readFileSync(TESTDATA, 'utf8')) };
  if (NYCKEL) {
    try { return await hamtaTwelveData(); } catch (e) { console.warn(`${e.message} – provar reservkällan.`); }
  }
  return hamtaYahoo();
}

function stada(staplar) {
  const unika = new Map();
  for (const s of staplar) {
    if ([s.t, s.o, s.h, s.l, s.c].every(Number.isFinite)) unika.set(s.t, s);
  }
  return [...unika.values()].sort((a, b) => a.t - b.t);
}

async function skickaNotis({ titel, text, prioritet = 3, taggar = [] }) {
  if (!AMNE) { console.log(`(ingen NTFY_TOPIC – skulle ha skickat) ${titel}: ${text}`); return; }
  const kropp = { topic: AMNE, title: titel, message: text, priority: prioritet, tags: taggar };
  if (DASHBOARD) kropp.click = DASHBOARD;
  try {
    const svar = await fetch(NTFY_SERVER, { method: 'POST', body: JSON.stringify(kropp) });
    if (!svar.ok) console.warn(`ntfy svarade ${svar.status} för "${titel}"`);
  } catch (e) {
    console.warn(`Kunde inte skicka notis: ${e.message}`);
  }
}

function taggar(h) {
  if (h.typ === 'nytt') return [h.riktning === 1 ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend'];
  if (h.typ === 'stangt') return ['checkered_flag'];
  return ['eyes'];
}

const lasForra = () => {
  try { return existsSync(DATAFIL) ? JSON.parse(readFileSync(DATAFIL, 'utf8')) : null; } catch { return null; }
};

async function main() {
  const forra = lasForra();
  const logg = forra?.notislogg || [];
  const nu = new Date();

  let kalla, staplar;
  try {
    ({ kalla, staplar } = await hamtaStaplar());
    staplar = taBortPagaende(stada(staplar), INTERVALL_MIN, TESTDATA ? Infinity : nu.getTime());
  } catch (e) {
    console.error(`Kunde inte hämta prisdata: ${e.message}`);
    if (forra) {
      if (!forra.meta?.fel) {
        await skickaNotis({ titel: 'Guldboten: problem med prisdata', text: e.message, prioritet: 3, taggar: ['warning'] });
      }
      forra.meta = { ...forra.meta, fel: e.message, felSedan: forra.meta?.felSedan || nu.toISOString() };
      writeFileSync(DATAFIL, JSON.stringify(forra));
    }
    return;
  }

  const analys = analysera(staplar, { intervallMin: INTERVALL_MIN });

  let lista = handelser(forra, analys)
    .filter((h) => NOTISNIVAER.includes(h.niva))
    .filter((h) => NOTIS_SETUP || h.typ !== 'setup');
  lista = grupperaHandelser(lista);

  if (!forra) {
    const sammanfattning = Object.values(analys.nivaer)
      .map((n) => `${n.namn}: ${{ LANG: 'lång', KORT: 'kort', SETUP: 'möjligt läge på väg', INGET: 'inget läge' }[n.lage]}`)
      .join(' · ');
    lista = [{ typ: 'start', titel: 'Guldboten är igång', text: `Guld ${tal(analys.pris)} USD. ${sammanfattning}`, prioritet: 3 }];
  }
  if (forra?.meta?.fel) {
    lista.push({ typ: 'info', titel: 'Guldboten: prisdata fungerar igen', text: `Guld ${tal(analys.pris)} USD.`, prioritet: 2 });
  }

  for (const h of lista) {
    await skickaNotis({ titel: h.titel, text: h.text, prioritet: h.prioritet, taggar: taggar(h) });
    logg.unshift({ tid: nu.toISOString(), typ: h.typ, titel: h.titel, text: h.text });
    console.log(`Notis: ${h.titel} – ${h.text.replace(/\n/g, ' / ')}`);
  }

  const data = {
    ...analys,
    meta: { uppdaterad: nu.toISOString(), kalla, intervall: '1 timme', dashboard: DASHBOARD },
    notislogg: logg.slice(0, 60),
  };
  writeFileSync(DATAFIL, JSON.stringify(data));
  console.log(`Klart: guld ${tal(analys.pris)} (${kalla}), ${lista.length} notiser, sista stapel ${new Date(analys.senast.t).toISOString()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
