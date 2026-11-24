// Körs av GitHub Actions.
//   LAGE=timme  varje timme: kortsiktiga lägen (timstaplar) för alla instrument i docs/bevakning.json
//   LAGE=dag    en gång per dygn: längre köplägen (dagsstaplar)
//   LAGE=båda   båda (används när du startar körningen för hand)
// Resultatet sparas i docs/data/ och visas i dashboarden. Notiser skickas via ntfy.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import {
  analysera, analyseraLangre, handelser, handelserLangre, grupperaHandelser,
  taBortPagaende, taBortPagaendeDag, tolkaTid, tal,
} from '../docs/engine.js';

const env = (namn, standard = '') => (process.env[namn] || '').trim() || standard;
const NYCKEL = env('TWELVEDATA_API_KEY');
const AMNE = env('NTFY_TOPIC');
const NTFY_SERVER = env('NTFY_SERVER', 'https://ntfy.sh');
const NOTISNIVAER = env('NOTISNIVAER', 'lag,medel,hog').split(',').map((s) => s.trim()).filter(Boolean);
const NOTIS_SETUP = env('NOTIS_SETUP', 'ja').toLowerCase() !== 'nej';
const NOTIS_LANGRE = env('NOTIS_LANGRE', 'ja').toLowerCase() !== 'nej';
const LAGE = env('LAGE', 'timme').toLowerCase();
const TVINGA = env('TVINGA') === 'ja';          // hämta alla instrument även när marknaden är stängd
const TESTDATA = env('TESTDATA');               // mapp med <id>.json och <id>-dag.json, för test utan nätverk
const SNABB = env('SNABBTEST') === 'ja';         // hoppa över väntetider i test
const NU = env('NU') ? Number(env('NU')) : Date.now();
const NU_ISO = new Date(NU).toISOString();

const BEVAKNING = JSON.parse(readFileSync(new URL('../docs/bevakning.json', import.meta.url), 'utf8')).instrument;
const MAPP = new URL('../docs/data/', import.meta.url);
mkdirSync(MAPP, { recursive: true });
const fil = (namn) => new URL(namn, MAPP);
const lasJson = (namn) => {
  try { return existsSync(fil(namn)) ? JSON.parse(readFileSync(fil(namn), 'utf8')) : null; } catch { return null; }
};
const skrivJson = (namn, data) => writeFileSync(fil(namn), JSON.stringify(data));
const vanta = (ms) => (SNABB ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

function dashboardAdress() {
  if (env('DASHBOARD_URL')) return env('DASHBOARD_URL');
  const repo = env('GITHUB_REPOSITORY');
  if (!repo) return '';
  const [agare, namn] = repo.split('/');
  const vard = `${agare.toLowerCase()}.github.io`;
  return namn.toLowerCase() === vard ? `https://${vard}/` : `https://${vard}/${namn}/`;
}
const DASHBOARD = dashboardAdress();

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

async function twelveData(symbol, interval, outputsize, forsok = 0) {
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

async function yahoo(symbol, interval, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const svar = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (guldbot)' } });
  if (!svar.ok) throw new Error(`Yahoo svarade ${svar.status}`);
  const r = (await svar.json())?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error('Yahoo gav ingen prisdata');
  const q = r.indicators.quote[0];
  return r.timestamp.map((t, i) => ({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] }));
}

async function hamta(ins, upplosning) {
  const dag = upplosning === 'dag';
  if (TESTDATA) {
    return { kalla: 'TESTDATA (syntetiska priser)', staplar: JSON.parse(readFileSync(`${TESTDATA}/${ins.id}${dag ? '-dag' : ''}.json`, 'utf8')) };
  }
  if (ins.kalla === 'twelvedata' && NYCKEL) {
    try {
      return { kalla: `Twelve Data (${ins.symbol})`, staplar: await twelveData(ins.symbol, dag ? '1day' : '1h', dag ? 1500 : 5000) };
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
    staplar: await yahoo(symbol, dag ? '1d' : '60m', dag ? '10y' : '1y'),
  };
}

function stada(staplar) {
  const unika = new Map();
  for (const s of staplar) if ([s.t, s.o, s.h, s.l, s.c].every(Number.isFinite)) unika.set(s.t, s);
  return [...unika.values()].sort((a, b) => a.t - b.t);
}

// Hoppa över instrument vars marknad är stängd (sparar anrop). Tider i UTC, med marginal för sommartid.
function marknadOppen(handelstid, t) {
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

async function skickaNotis({ titel, text, prioritet = 3, taggar = [], klick = DASHBOARD }) {
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

function taggar(h) {
  if (h.typ === 'nytt') return [h.langre ? 'moneybag' : h.riktning === 1 ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend'];
  if (h.typ === 'stangt') return ['checkered_flag'];
  if (h.typ === 'fel') return ['warning'];
  return ['eyes'];
}

// Upp till tre händelser skickas var för sig. Fler än så samlas i en notis, så att mobilen inte plingar tio gånger i rad.
async function skickaHandelser(lista) {
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

function loggaHandelser(lista) {
  if (!lista.length) return;
  const logg = lasJson('notiser.json')?.notiser || [];
  for (const h of lista) logg.unshift({ tid: NU_ISO, id: h.id, typ: h.typ, langre: !!h.langre, titel: h.titel, text: h.text });
  skrivJson('notiser.json', { notiser: logg.slice(0, 150) });
}

// ---------- Timkörning: kortsiktiga lägen ----------

function oversiktsrad(ins, d, kalla) {
  return {
    id: ins.id, namn: ins.namn, grupp: ins.grupp, kalla, live: ins.kalla === 'twelvedata',
    pris: d.pris, dec: d.dec, valuta: d.valuta, dygnProc: d.dygnProc, senastT: d.senast.t, uppdaterad: NU_ISO,
    lagen: Object.fromEntries(Object.values(d.nivaer).map((n) => [n.id, n.lage])),
    oppna: Object.values(d.nivaer).filter((n) => n.oppen).map((n) => ({ niva: n.id, riktning: n.oppen.riktning, inT: n.oppen.inT, aktuelltR: n.oppen.aktuelltR })),
  };
}

async function korTimme() {
  const forraOversikt = lasJson('oversikt.json');
  const rader = [];
  const nyaHandelser = [];
  const nyaFel = [];
  for (const ins of BEVAKNING) {
    const forra = lasJson(`${ins.id}.json`);
    const gammal = forraOversikt?.instrument?.find((x) => x.id === ins.id);
    if (forra && gammal && !TVINGA && !marknadOppen(ins.handelstid, NU)) {
      rader.push({ ...gammal, marknadStangd: true });
      continue;
    }
    try {
      const { kalla, staplar } = await hamta(ins, 'timme');
      const rena = taBortPagaende(stada(staplar), 60, TESTDATA ? Infinity : NU);
      const a = analysera(rena, {
        intervallMin: 60, dec: ins.dec ?? 2, valuta: ins.valuta || '', cfg: { kostnadProc: ins.kostnadProc ?? 0.04 },
      });
      let lista = handelser(forra, a, ins.namn)
        .filter((h) => NOTISNIVAER.includes(h.niva))
        .filter((h) => NOTIS_SETUP || h.typ !== 'setup');
      lista = grupperaHandelser(lista).map((h) => ({ ...h, id: ins.id }));
      nyaHandelser.push(...lista);
      const data = { ...a, id: ins.id, namn: ins.namn, grupp: ins.grupp, meta: { uppdaterad: NU_ISO, kalla, intervall: '1 timme' } };
      skrivJson(`${ins.id}.json`, data);
      rader.push(oversiktsrad(ins, data, kalla));
      console.log(`${ins.namn}: ${tal(a.pris, ins.dec ?? 2)} (${kalla})${lista.length ? ` – ${lista.length} händelser` : ''}`);
    } catch (e) {
      console.warn(`${ins.namn}: ${e.message}`);
      if (!gammal?.fel) nyaFel.push({ ins, fel: e.message });
      rader.push({ ...(gammal || { id: ins.id, namn: ins.namn, grupp: ins.grupp, live: ins.kalla === 'twelvedata' }), fel: e.message, felSedan: gammal?.felSedan || NU_ISO });
    }
  }

  if (!forraOversikt) {
    const NAMN = { lag: 'låg', medel: 'medel', hog: 'hög' };
    const aktiva = [];
    for (const r of rader) {
      for (const riktning of [1, -1]) {
        const niv = (r.oppna || []).filter((o) => o.riktning === riktning).map((o) => NAMN[o.niva]);
        if (niv.length) aktiva.push(`${r.namn} ${riktning === 1 ? 'lång' : 'kort'} (${niv.join(', ')})`);
      }
    }
    const text = aktiva.length
      ? `Aktiva lägen nu: ${aktiva.slice(0, 12).join(' · ')}${aktiva.length > 12 ? ' …' : ''}`
      : 'Inga aktiva lägen just nu.';
    nyaHandelser.length = 0;
    nyaHandelser.push({ typ: 'start', prioritet: 3, titel: `Guldboten bevakar nu ${BEVAKNING.length} instrument`, text });
  }
  if (nyaFel.length) {
    nyaHandelser.push({
      typ: 'fel', prioritet: 3,
      titel: `Kunde inte hämta priser för ${nyaFel.length} instrument`,
      text: nyaFel.map(({ ins, fel }) => `${ins.namn}: ${fel}`).join('\n'),
    });
  }

  await skickaHandelser(nyaHandelser);
  loggaHandelser(nyaHandelser);
  skrivJson('oversikt.json', { meta: { uppdaterad: NU_ISO, intervall: '1 timme', dashboard: DASHBOARD }, instrument: rader });
  console.log(`Timkörning klar: ${rader.length} instrument, ${nyaHandelser.length} händelser.`);
}

// ---------- Dagskörning: längre lägen ----------

async function korDag() {
  const forraOversikt = lasJson('oversikt-dag.json');
  const rader = [];
  const nyaHandelser = [];
  for (const ins of BEVAKNING) {
    const forra = lasJson(`${ins.id}-dag.json`);
    const gammal = forraOversikt?.instrument?.find((x) => x.id === ins.id);
    try {
      const { kalla, staplar } = await hamta(ins, 'dag');
      const rena = taBortPagaendeDag(stada(staplar), TESTDATA ? Infinity : NU);
      const a = analyseraLangre(rena, { dec: ins.dec ?? 2, valuta: ins.valuta || '', cfg: { kostnadProc: Math.max(0.1, ins.kostnadProc ?? 0.1) } });
      const lista = NOTIS_LANGRE ? handelserLangre(forra, a, ins.namn).map((h) => ({ ...h, id: ins.id })) : [];
      nyaHandelser.push(...lista);
      skrivJson(`${ins.id}-dag.json`, { ...a, id: ins.id, namn: ins.namn, meta: { uppdaterad: NU_ISO, kalla, intervall: '1 dag' } });
      rader.push({
        id: ins.id, lage: a.lage, trend: a.trend, pris: a.pris,
        oppen: a.oppen && { typ: a.oppen.typ, inT: a.oppen.inT, inPris: a.oppen.inPris, stop: a.oppen.stop, aktuellProc: a.oppen.aktuellProc },
        setup: a.setup?.text || null,
        stats: { antal: a.stats.antal, traffProc: a.stats.traffProc, snittProc: a.stats.snittProc },
        uppdaterad: NU_ISO,
      });
      console.log(`${ins.namn} (dag): ${a.lage}${lista.length ? ` – ${lista.length} händelser` : ''}`);
    } catch (e) {
      console.warn(`${ins.namn} (dag): ${e.message}`);
      rader.push({ ...(gammal || { id: ins.id }), fel: e.message });
    }
  }
  if (!forraOversikt) {
    const kop = rader.filter((r) => r.lage === 'KOP').map((r) => BEVAKNING.find((b) => b.id === r.id)?.namn);
    nyaHandelser.length = 0;
    nyaHandelser.push({
      typ: 'start', langre: true, prioritet: 2, titel: 'Längre lägen: bevakningen är igång',
      text: kop.length ? `Instrument i köpläge enligt reglerna just nu: ${kop.join(', ')}.` : 'Inga instrument i köpläge enligt reglerna just nu.',
    });
  }
  await skickaHandelser(nyaHandelser);
  loggaHandelser(nyaHandelser);
  skrivJson('oversikt-dag.json', { meta: { uppdaterad: NU_ISO, intervall: '1 dag' }, instrument: rader });
  console.log(`Dagskörning klar: ${rader.length} instrument, ${nyaHandelser.length} händelser.`);
}

async function main() {
  if (!NYCKEL && !TESTDATA) console.warn('Ingen TWELVEDATA_API_KEY – använder Yahoo för alla instrument som har en reservkälla.');
  if (LAGE === 'timme' || LAGE === 'båda' || LAGE === 'bada') await korTimme();
  if (LAGE === 'dag' || LAGE === 'båda' || LAGE === 'bada') await korDag();
}

main().catch((e) => { console.error(e); process.exit(1); });
