// Beräkningar för ekonomisidan. Rena funktioner utan sidoeffekter, så att de går att testa (npm test).
// Datum är strängar 'ÅÅÅÅ-MM-DD', belopp i kronor.

export const KONTOTYPER = {
  trading: 'Trading (hög risk)',
  langsiktigt: 'Långsiktigt sparande',
  buffert: 'Buffert / sparkonto',
  pension: 'Pension',
  annat: 'Annat',
};

export const idag = () => new Date().toISOString().slice(0, 10);
export const manadNyckel = (datum) => String(datum).slice(0, 7);
export function manaderMellan(fran, till) {
  const a = new Date(`${fran}T00:00:00Z`), b = new Date(`${till}T00:00:00Z`);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() - a.getUTCDate()) / 30.44;
}
export function laggTillManader(datum, antal) {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + antal);
  return d.toISOString().slice(0, 10);
}
export function manadSlut(nyckel) {
  const [a, m] = nyckel.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
export function senasteManader(antal, tillDatum = idag()) {
  const ut = [];
  const d = new Date(`${manadNyckel(tillDatum)}-01T00:00:00Z`);
  for (let k = antal - 1; k >= 0; k--) {
    const x = new Date(d);
    x.setUTCMonth(d.getUTCMonth() - k);
    ut.push(x.toISOString().slice(0, 7));
  }
  return ut;
}

// ---------- Ränta på ränta ----------
export const manadsranta = (arsProc) => Math.pow(1 + arsProc / 100, 1 / 12) - 1;

export function slutvarde(start, manadsspar, arsProc, manader) {
  const i = manadsranta(arsProc);
  const n = Math.max(0, manader);
  if (Math.abs(i) < 1e-12) return start + manadsspar * n;
  const f = Math.pow(1 + i, n);
  return start * f + (manadsspar * (f - 1)) / i;
}

export function kravManadsspar(mal, start, arsProc, manader) {
  if (manader <= 0) return Math.max(0, mal - start);
  const i = manadsranta(arsProc);
  const f = Math.pow(1 + i, manader);
  const rest = mal - start * f;
  if (rest <= 0) return 0;
  return Math.abs(i) < 1e-12 ? rest / manader : (rest * i) / (f - 1);
}

// Årlig avkastning i procent som krävs för att nå målet. null om över 200 % per år.
export function kravAvkastning(mal, start, manadsspar, manader) {
  if (manader <= 0) return null;
  let lo = -60, hi = 200;
  if (slutvarde(start, manadsspar, hi, manader) < mal) return null;
  if (slutvarde(start, manadsspar, lo, manader) >= mal) return lo;
  for (let k = 0; k < 100; k++) {
    const mitt = (lo + hi) / 2;
    if (slutvarde(start, manadsspar, mitt, manader) >= mal) hi = mitt; else lo = mitt;
  }
  return hi;
}

// Antal månader tills målet nås, eller null om det inte nås inom 100 år.
export function manaderTill(mal, start, manadsspar, arsProc) {
  if (start >= mal) return 0;
  const i = manadsranta(arsProc);
  let v = start;
  for (let n = 1; n <= 1200; n++) {
    v = v * (1 + i) + manadsspar;
    if (v >= mal) return n;
  }
  return null;
}

export function sparserie(start, manadsspar, arsProc, manader) {
  const i = manadsranta(arsProc);
  const ut = [{ manad: 0, varde: start, insatt: start }];
  let v = start, insatt = start;
  for (let n = 1; n <= manader; n++) {
    v = v * (1 + i) + manadsspar;
    insatt += manadsspar;
    ut.push({ manad: n, varde: v, insatt });
  }
  return ut;
}

// ---------- Konton ----------
const netto = (a) => (Number(a.resultat) || 0) - (Number(a.avgift) || 0);

export function tradingkonto(data) {
  return (data.konton || []).find((k) => k.typ === 'trading') || null;
}

function senasteVarde(konto, datum) {
  const lista = [...(konto.varden || [])].filter((v) => v.datum <= datum).sort((a, b) => a.datum.localeCompare(b.datum));
  return lista.at(-1) || null;
}

// Värdet på ett konto ett visst datum: senast inlagda värde + insättningar/uttag efter det
// (+ realiserat tradingresultat efter det, för tradingkontot).
export function kontoVarde(konto, data, datum = idag()) {
  const bas = senasteVarde(konto, datum);
  const basDatum = bas ? bas.datum : '0000-00-00';
  let v = bas ? Number(bas.varde) : 0;
  for (const t of konto.transaktioner || []) if (t.datum > basDatum && t.datum <= datum) v += Number(t.belopp) || 0;
  if (konto.typ === 'trading' && tradingkonto(data)?.id === konto.id) {
    for (const a of data.affarer || []) if (a.datum > basDatum && a.datum <= datum) v += netto(a);
  }
  return v;
}

// Avkastning sedan första inlagda värdet: värde nu − startvärde − insättningar (+ uttag).
export function kontoUtveckling(konto, data, datum = idag()) {
  const varden = [...(konto.varden || [])].sort((a, b) => a.datum.localeCompare(b.datum));
  const tx = [...(konto.transaktioner || [])].sort((a, b) => a.datum.localeCompare(b.datum));
  const start = varden[0] ? { datum: varden[0].datum, varde: Number(varden[0].varde) } : tx[0] ? { datum: '0000-00-00', varde: 0 } : null;
  const varde = kontoVarde(konto, data, datum);
  if (!start) return { varde, insatt: 0, avkastning: 0, proc: null, sedan: null };
  let insatt = start.varde;
  for (const t of tx) if (t.datum > start.datum && t.datum <= datum) insatt += Number(t.belopp) || 0;
  const avkastning = varde - insatt;
  return { varde, insatt, avkastning, proc: insatt > 0 ? (100 * avkastning) / insatt : null, sedan: varden[0]?.datum || tx[0]?.datum };
}

export function forstaDatum(data) {
  const datum = [
    ...(data.konton || []).flatMap((k) => [...(k.varden || []).map((v) => v.datum), ...(k.transaktioner || []).map((t) => t.datum)]),
    ...(data.affarer || []).map((a) => a.datum),
  ].filter(Boolean).sort();
  return datum[0] || null;
}

// Nettoförmögenhet och insatt kapital vid varje månadsslut (och idag).
export function formogenhetsserie(data, tillDatum = idag()) {
  const forsta = forstaDatum(data);
  if (!forsta) return [];
  const ut = [];
  let nyckel = manadNyckel(forsta);
  const sista = manadNyckel(tillDatum);
  for (let skydd = 0; skydd < 600; skydd++) {
    const datum = nyckel === sista ? tillDatum : manadSlut(nyckel);
    let varde = 0, insatt = 0;
    for (const k of data.konton || []) {
      const u = kontoUtveckling(k, data, datum);
      varde += u.varde;
      insatt += u.insatt;
    }
    ut.push({ datum, varde, insatt });
    if (nyckel === sista) break;
    nyckel = laggTillManader(`${nyckel}-01`, 1).slice(0, 7);
  }
  return ut;
}

// ---------- Trading ----------
export function tradingStatistik(affarer, { fran = '0000-00-00', till = '9999-12-31' } = {}) {
  const lista = (affarer || []).filter((a) => a.datum >= fran && a.datum <= till).sort((a, b) => a.datum.localeCompare(b.datum) || String(a.id).localeCompare(String(b.id)));
  const res = lista.map(netto);
  const vinster = res.filter((r) => r > 0), forluster = res.filter((r) => r <= 0);
  const summa = res.reduce((s, r) => s + r, 0);
  const sumV = vinster.reduce((s, r) => s + r, 0), sumF = -forluster.reduce((s, r) => s + r, 0);
  let topp = 0, kurva = 0, maxNed = 0;
  const kurvpunkter = [];
  lista.forEach((a, i) => {
    kurva += res[i];
    topp = Math.max(topp, kurva);
    maxNed = Math.max(maxNed, topp - kurva);
    kurvpunkter.push({ datum: a.datum, summa: kurva });
  });
  let svit = 0, svitTyp = null;
  for (let i = res.length - 1; i >= 0; i--) {
    const typ = res[i] > 0 ? 'vinst' : 'forlust';
    if (svitTyp === null) svitTyp = typ;
    if (typ !== svitTyp) break;
    svit++;
  }
  const insatt = lista.reduce((s, a) => s + (Number(a.insats) || 0), 0);
  return {
    antal: lista.length,
    vinster: vinster.length,
    traffProc: lista.length ? (100 * vinster.length) / lista.length : null,
    summa,
    snittVinst: vinster.length ? sumV / vinster.length : null,
    snittForlust: forluster.length ? -sumF / forluster.length : null,
    profitFaktor: sumF > 0 ? sumV / sumF : vinster.length ? Infinity : null,
    forvantat: lista.length ? summa / lista.length : null,
    storstaVinst: vinster.length ? Math.max(...vinster) : null,
    storstaForlust: forluster.length ? Math.min(...forluster) : null,
    maxNedgang: maxNed,
    svit, svitTyp,
    avkastningPaInsats: insatt > 0 ? (100 * summa) / insatt : null,
    kurva: kurvpunkter,
  };
}

export function tradingPerManad(affarer, manader) {
  return manader.map((m) => {
    const lista = (affarer || []).filter((a) => manadNyckel(a.datum) === m);
    return { manad: m, summa: lista.reduce((s, a) => s + netto(a), 0), antal: lista.length };
  });
}

export function tradingPerInstrument(affarer) {
  const grupper = new Map();
  for (const a of affarer || []) {
    const k = a.instrument || 'Okänt';
    if (!grupper.has(k)) grupper.set(k, []);
    grupper.get(k).push(a);
  }
  return [...grupper.entries()].map(([instrument, lista]) => {
    const s = tradingStatistik(lista);
    return { instrument, antal: s.antal, traffProc: s.traffProc, summa: s.summa };
  }).sort((a, b) => b.summa - a.summa);
}

// ---------- Framtida utgifter ----------
export function utgiftsplan(utgifter, dag = idag()) {
  return (utgifter || []).map((u) => {
    let datum = u.datum;
    if (u.aterkommande === 'ar') while (datum < dag) datum = laggTillManader(datum, 12);
    const kvarManader = Math.max(1, Math.ceil(manaderMellan(dag, datum)));
    const kvar = Math.max(0, (Number(u.belopp) || 0) - (Number(u.sparat) || 0));
    return {
      ...u, nastaDatum: datum, kvarManader, kvar,
      perManad: datum < dag ? 0 : kvar / kvarManader,
      andel: u.belopp > 0 ? Math.min(1, (Number(u.sparat) || 0) / u.belopp) : 1,
      passerad: datum < dag,
    };
  }).sort((a, b) => a.nastaDatum.localeCompare(b.nastaDatum));
}

// ---------- Mål ----------
export function malPrognos(mal, data, dag = idag()) {
  const konton = (data.konton || []).filter((k) => (mal.kontoIds || []).includes(k.id));
  const nuvarande = konton.length ? konton.reduce((s, k) => s + kontoVarde(k, data, dag), 0) : Number(mal.sparat) || 0;
  const vikt = konton.reduce((s, k) => s + Math.max(0, kontoVarde(k, data, dag)), 0);
  const kontoAvk = konton.length
    ? (vikt > 0 ? konton.reduce((s, k) => s + Math.max(0, kontoVarde(k, data, dag)) * (Number(k.avkastning) || 0), 0) / vikt
      : konton.reduce((s, k) => s + (Number(k.avkastning) || 0), 0) / konton.length)
    : 0;
  const avk = mal.avkastning != null && mal.avkastning !== '' ? Number(mal.avkastning) : kontoAvk;
  const spar = mal.manadssparande != null && mal.manadssparande !== '' ? Number(mal.manadssparande) : konton.reduce((s, k) => s + (Number(k.manadssparande) || 0), 0);
  const manader = Math.max(0, manaderMellan(dag, mal.datum));
  const prognos = slutvarde(nuvarande, spar, avk, manader);
  const tid = manaderTill(mal.belopp, nuvarande, spar, avk);
  return {
    nuvarande, avkastning: avk, manadssparande: spar, manader,
    andelNu: mal.belopp > 0 ? nuvarande / mal.belopp : 0,
    prognos, prognosAndel: mal.belopp > 0 ? prognos / mal.belopp : 0,
    kravSpar: kravManadsspar(mal.belopp, nuvarande, avk, manader),
    kravAvk: kravAvkastning(mal.belopp, nuvarande, spar, manader),
    nasDatum: tid == null ? null : laggTillManader(dag, tid),
    iFas: prognos >= mal.belopp,
  };
}

// ---------- Budget ----------
export function planeratSparande(data) {
  return (data.konton || []).reduce((s, k) => s + (Number(k.manadssparande) || 0), 0);
}

export function sparatUnderManad(data, manad) {
  let s = 0;
  for (const k of data.konton || []) for (const t of k.transaktioner || []) if (manadNyckel(t.datum) === manad) s += Number(t.belopp) || 0;
  return s;
}

export function budgetSammanfattning(data, manad = manadNyckel(idag()), dag = idag()) {
  const b = data.budget || {};
  const utfall = (b.utfall || {})[manad] || {};
  const inkomster = (b.inkomster || []).reduce((s, x) => s + (Number(x.belopp) || 0), 0);
  const utgifterPlan = (b.utgifter || []).reduce((s, x) => s + (Number(x.belopp) || 0), 0);
  const utgifterUtfall = (b.utgifter || []).reduce((s, x) => s + (utfall[x.id] != null ? Number(utfall[x.id]) : Number(x.belopp) || 0), 0);
  const sparande = planeratSparande(data);
  const avsattningar = utgiftsplan(data.utgifter, dag).reduce((s, u) => s + u.perManad, 0);
  const kvar = inkomster - utgifterUtfall - sparande - avsattningar;
  return {
    inkomster, utgifterPlan, utgifterUtfall, sparande, avsattningar, kvar,
    sparkvot: inkomster > 0 ? (100 * (sparande + avsattningar)) / inkomster : null,
    sparatHittills: sparatUnderManad(data, manad),
  };
}

// Antal månader i rad (bakåt från förra månaden, plus innevarande om den redan är klar) då du sparat minst planen.
export function sparsvit(data, dag = idag()) {
  const plan = planeratSparande(data);
  if (plan <= 0) return 0;
  const nu = manadNyckel(dag);
  let svit = sparatUnderManad(data, nu) >= plan ? 1 : 0;
  let m = laggTillManader(`${nu}-01`, -1).slice(0, 7);
  for (let k = 0; k < 120; k++) {
    if (sparatUnderManad(data, m) >= plan) svit++; else break;
    m = laggTillManader(`${m}-01`, -1).slice(0, 7);
  }
  return svit;
}

// Nästa jämna milstolpe för förmögenheten och när den nås i nuvarande takt.
export function nastaMilstolpe(varde, manadsspar, arsProc, dag = idag()) {
  const steg = varde < 100000 ? 25000 : varde < 500000 ? 100000 : varde < 2000000 ? 250000 : 1000000;
  const mal = Math.floor(varde / steg) * steg + steg;
  const n = manaderTill(mal, varde, manadsspar, arsProc);
  return { mal, manader: n, datum: n == null ? null : laggTillManader(dag, n) };
}
