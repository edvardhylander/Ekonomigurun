// Gemensamma delar för molnskripten: miljövariabler, filer, prisdata och notiser.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tolkaTid } from '../docs/engine.js';

export const env = (namn, standard = '') => (process.env[namn] || '').trim() || standard;
export const NYCKEL = env('TWELVEDATA_API_KEY');
export const AMNE = env('NTFY_TOPIC');
export const NTFY_SERVER = env('NTFY_SERVER', 'https://ntfy.sh');
export const NOTISNIVAER = env('NOTISNIVAER', 'lag,medel,hog').split(',').map((s) => s.trim()).filter(Boolean);
export const NOTIS_SETUP = env('NOTIS_SETUP', 'ja').toLowerCase() !== 'nej';
export const NOTIS_LANGRE = env('NOTIS_LANGRE', 'ja').toLowerCase() !== 'nej';
export const LAGE = env('LAGE', 'timme').toLowerCase();
export const TVINGA = env('TVINGA') === 'ja';          // hämta alla instrument även när marknaden är stängd
export const TESTDATA = env('TESTDATA');               // mapp med <id>.json och <id>-dag.json, för test utan nätverk
export const SNABB = env('SNABBTEST') === 'ja';         // hoppa över väntetider i test
export const NU = env('NU') ? Number(env('NU')) : Date.now();
export const NU_ISO = new Date(NU).toISOString();

export const BEVAKNING = JSON.parse(readFileSync(new URL('../docs/bevakning.json', import.meta.url), 'utf8')).instrument;
export const MAPP = new URL('../docs/data/', import.meta.url);
mkdirSync(MAPP, { recursive: true });
export const fil = (namn) => new URL(namn, MAPP);
export const lasJson = (namn) => {
  try { return existsSync(fil(namn)) ? JSON.parse(readFileSync(fil(namn), 'utf8')) : null; } catch { return null; }
};
export const skrivJson = (namn, data) => writeFileSync(fil(namn), JSON.stringify(data));
export const vanta = (ms) => (SNABB ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

function dashboardAdress() {
  if (env('DASHBOARD_URL')) return env('DASHBOARD_URL');
  const repo = env('GITHUB_REPOSITORY');
  if (!repo) return '';
  const [agare, namn] = repo.split('/');
  const vard = `${agare.toLowerCase()}.github.io`;
  return namn.toLowerCase() === vard ? `https://${vard}/` : `https://${vard}/${namn}/`;
}
export const DASHBOARD = dashboardAdress();

// ---------- Prisdata ----------

// Twelve Datas gratisnivå tillåter 8 anrop per minut.
const tdAnrop = [];
async function tdKo() {
  for (;;) {
    const nu = Date.now();
    while (tdAnrop.length && nu - tdAnrop[0] > 61000) tdAnrop.shift();
    if (tdAnrop.length < 8) { tdAnrop.push(nu); return; }
    if (SNABB) { tdAnrop.length = 0; continue; }
    await vanta(61000 - (nu - tdAnrop[0]) + 300);
  }
}

export async function twelveData(symbol, interval, outputsize, forsok = 0) {
  await tdKo();
  const url = new URL('https://api.twelvedata.com/time_series');
  url.search = new URLSearchParams({ symbol, interval, outputsize: String(outputsize), timezone: 'UTC', apikey: NYCKEL }).toString();
  const svar = await fetch(url);
  const j = await svar.json();
  if (j.status === 'error' || !Array.isArray(j.values)) {
    const msg = j.message || `HTTP ${svar.status}`;
    if (forsok === 0 && /minute/i.test(msg)) { await vanta(62000); return twelveData(symbol, interval, outputsize, 1); }
    throw new Error(`Twelve Data: ${msg}`);
  }
  return j.values.map((v) => ({ t: tolkaTid(v.datetime), o: Number(v.open), h: Number(v.high), l: Number(v.low), c: Number(v.close) }));
}

export async function yahoo(symbol, interval, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const svar = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (guldbot)' } });
  if (!svar.ok) throw new Error(`Yahoo svarade ${svar.status}`);
  const r = (await svar.json())?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error('Yahoo gav ingen prisdata');
  const q = r.indicators.quote[0];
  return r.timestamp.map((t, i) => ({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] }));
}

export async function hamta(ins, upplosning) {
  // upplosning: 'timme', 'dag' eller '5min'
  const dag = upplosning === 'dag', fem = upplosning === '5min';
  if (TESTDATA) {
    const suffix = dag ? '-dag' : fem ? '-5min' : '';
    return { kalla: 'TESTDATA (syntetiska priser)', staplar: JSON.parse(readFileSync(`${TESTDATA}/${ins.id}${suffix}.json`, 'utf8')) };
  }
  if (ins.kalla === 'twelvedata' && NYCKEL) {
    try {
      const [intervall, antal] = dag ? ['1day', 1500] : fem ? ['5min', 3000] : ['1h', 5000];
      return { kalla: `Twelve Data (${ins.symbol})`, staplar: await twelveData(ins.symbol, intervall, antal) };
    } catch (e) {
      if (!ins.reserv) throw e;
      console.warn(`${ins.namn}: ${e.message} – provar Yahoo (${ins.reserv}).`);
    }
  }
  const symbol = ins.kalla === 'yahoo' ? ins.symbol : ins.reserv;
  if (!symbol) throw new Error('Ingen Twelve Data-nyckel och ingen reservkälla.');
  await vanta(400);
  return {
    kalla: `Yahoo Finance (${symbol})${ins.kalla === 'yahoo' ? '' : ', reservkälla'}`,
    staplar: await yahoo(symbol, dag ? '1d' : fem ? '5m' : '60m', dag ? '10y' : fem ? '20d' : '1y'),
  };
}

export function stada(staplar) {
  const unika = new Map();
  for (const s of staplar) if ([s.t, s.o, s.h, s.l, s.c].every(Number.isFinite)) unika.set(s.t, s);
  return [...unika.values()].sort((a, b) => a.t - b.t);
}

// Hoppa över instrument vars marknad är stängd (sparar anrop). Tider i UTC, med marginal för sommartid.
export function marknadOppen(handelstid, t) {
  const d = new Date(t), dag = d.getUTCDay(), h = d.getUTCHours();
  if (handelstid === 'dygnet') return true;
  if (handelstid === 'fx') {
    if (dag === 6) return false;
    if (dag === 0) return h >= 21;
    if (dag === 5) return h <= 22;
    return true;
  }
  if (dag === 0 || dag === 6) return false;
  if (handelstid === 'us') return h >= 13 && h <= 22;
  if (handelstid === 'eu') return h >= 7 && h <= 18;
  return true;
}

// ---------- Notiser ----------

export async function skickaNotis({ titel, text, prioritet = 3, taggar = [], klick = DASHBOARD }) {
  if (!AMNE) { console.log(`(ingen NTFY_TOPIC – skulle ha skickat) ${titel}: ${text}`); return; }
  const kropp = { topic: AMNE, title: titel, message: text, priority: prioritet, tags: taggar };
  if (klick) kropp.click = klick;
  try {
    const svar = await fetch(NTFY_SERVER, { method: 'POST', body: JSON.stringify(kropp) });
    if (!svar.ok) console.warn(`ntfy svarade ${svar.status} för "${titel}"`);
  } catch (e) {
    console.warn(`Kunde inte skicka notis: ${e.message}`);
  }
}

export function taggar(h) {
  if (h.typ === 'nytt') return [h.langre ? 'moneybag' : h.riktning === 1 ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend'];
  if (h.typ === 'stangt') return ['checkered_flag'];
  if (h.typ === 'fel') return ['warning'];
  return ['eyes'];
}

// Upp till tre händelser skickas var för sig. Fler än så samlas i en notis, så att mobilen inte plingar tio gånger i rad.
export async function skickaHandelser(lista) {
  if (!lista.length) return;
  const sorterad = [...lista].sort((a, b) => b.prioritet - a.prioritet);
  if (sorterad.length <= 3) {
    for (const h of sorterad) {
      await skickaNotis({ titel: h.titel, text: h.text, prioritet: h.prioritet, taggar: taggar(h), klick: h.id && DASHBOARD ? `${DASHBOARD}#${h.id}` : DASHBOARD });
    }
    return;
  }
  const nya = sorterad.filter((h) => h.typ === 'nytt').length;
  const visas = sorterad.slice(0, 12).map((h) => `• ${h.titel}`);
  if (sorterad.length > 12) visas.push(`… och ${sorterad.length - 12} till. Se dashboarden.`);
  await skickaNotis({
    titel: `${sorterad.length} händelser${nya ? `, varav ${nya} nya lägen` : ''}`,
    text: visas.join('\n'),
    prioritet: sorterad[0].prioritet,
    taggar: [nya ? 'chart_with_upwards_trend' : 'eyes'],
  });
}

export function loggaHandelser(lista, filnamn = 'notiser.json', tid = NU_ISO) {
  if (!lista.length) return;
  const logg = lasJson(filnamn)?.notiser || [];
  for (const h of lista) logg.unshift({ tid, id: h.id, typ: h.typ, langre: !!h.langre, position: !!h.position, titel: h.titel, text: h.text });
  skrivJson(filnamn, { notiser: logg.slice(0, 150) });
}
