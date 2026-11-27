// Beräkningar för ekonomisidan. Rena funktioner utan sidoeffekter, så att de går att testa (npm test).
// Datum är strängar 'ÅÅÅÅ-MM-DD', månader 'ÅÅÅÅ-MM', belopp i kronor.

export const KONTOTYPER = {
  buffert: 'Buffert',
  langsiktigt: 'Långsiktigt',
  trading: 'Trading (hög risk)',
  pension: 'Pension',
  annat: 'Annat',
};

export const UTGIFTSKATEGORIER = [
  'Boende', 'Mat och dagligvaror', 'Restaurang och café', 'Transport', 'Abonnemang', 'Nöje och fritid',
  'Kläder och shopping', 'Hälsa och träning', 'Resor', 'Studier', 'Övrigt',
];
export const INKOMSTKATEGORIER = ['Lön', 'Studiemedel', 'Bidrag och stipendier', 'Swish och återbetalningar', 'Övrigt'];

export const FREKVENSER = { manad: 'Varje månad', kvartal: 'Varje kvartal', ar: 'Varje år', 'en-gang': 'En gång' };

// Vanliga butiker och tjänster → kategori. Dina egna regler (när du ändrar kategori) går före.
const NYCKELORD = [
  [/\b(ica|coop|willys|hemk[öo]p|lidl|city ?gross|tempo|netto|matsmart|mathem|pressbyr[åa]n|7-eleven|mat\.se)\b/i, 'Mat och dagligvaror'],
  [/\b(max|mcdonald|burger ?king|espresso ?house|wayne|foodora|wolt|uber ?eats|subway|sushi|pizz|restaurang|caf[eé]|bar|pub|starbucks|joe ?& ?the ?juice|o'learys)\b/i, 'Restaurang och café'],
  [/\b(sl|sj|v[äa]sttrafik|sk[åa]netrafiken|ul|ultra|ltr|[öo]resundst[åa]g|flixbus|vy|uber|bolt|taxi|circle ?k|preem|okq8|st1|ingo|parkering|easypark|voi|tier|lime)\b/i, 'Transport'],
  [/\b(spotify|netflix|hbo|max\.com|viaplay|disney|apple\.com|icloud|google|youtube|telia|tele2|tre|comviq|halebop|vimla|fello|bahnhof|telenor|chatgpt|openai|claude|anthropic|adobe|microsoft|playstation|xbox|steam)\b/i, 'Abonnemang'],
  [/\b(hyra|bostad|riksbyggen|hsb|heimstaden|akelius|stena|vasakronan|bostaden|hemf[öo]rs[äa]kring|el|elavtal|vattenfall|fortum|tibber|e\.on|eon)\b/i, 'Boende'],
  [/\b(h&m|hm|zara|zalando|stadium|intersport|nike|adidas|jd sports|lindex|kappahl|dressmann|boozt|ellos|clas ohlson|ikea|elgiganten|mediamarkt|webhallen|netonnet|amazon|cdon|temu|shein)\b/i, 'Kläder och shopping'],
  [/\b(apotek|apoteket|kronans|sats|actic|nordic wellness|friskis|fitness24|tandl[äa]kare|v[åa]rdcentral|1177|kry|golf)\b/i, 'Hälsa och träning'],
  [/\b(systembolaget|bio|sf ?bio|filmstaden|ticketmaster|tickster|spel|svenska spel|atg|unibet|bet365|biljett|konsert|klubb)\b/i, 'Nöje och fritid'],
  [/\b(sas|norwegian|ryanair|wizz|klm|lufthansa|booking|airbnb|hotels?|hotell|scandic|ving|tui|apollo|expedia)\b/i, 'Resor'],
  [/\b(adlibris|bokus|studentlitteratur|kurslitteratur|kåren|karen|studentk[åa]r|universitet|csn ?avgift)\b/i, 'Studier'],
];
const NYCKELORD_INKOMST = [
  [/\b(csn)\b/i, 'Studiemedel'],
  [/\b(l[öo]n|salary)\b/i, 'Lön'],
  [/\b(stipendi|bidrag|erasmus|f[öo]rs[äa]kringskassan|bostadsbidrag)\b/i, 'Bidrag och stipendier'],
  [/\b(swish|[åa]terbetalning|refund)\b/i, 'Swish och återbetalningar'],
];

export function gissaKategori(text, belopp, regler = []) {
  const t = String(text || '').toLowerCase();
  for (const r of regler) if (r.monster && t.includes(String(r.monster).toLowerCase())) return r.kategori;
  const lista = belopp > 0 ? NYCKELORD_INKOMST : NYCKELORD;
  for (const [re, kat] of lista) if (re.test(t)) return kat;
  return 'Övrigt';
}

// ---------- Datum ----------
const tva = (n) => String(n).padStart(2, '0');
export const idag = () => { const d = new Date(); return `${d.getFullYear()}-${tva(d.getMonth() + 1)}-${tva(d.getDate())}`; };
export const manadNyckel = (datum) => String(datum).slice(0, 7);
const manadIndex = (nyckel) => { const [a, m] = nyckel.split('-').map(Number); return a * 12 + m - 1; };
const franIndex = (i) => `${Math.floor(i / 12)}-${tva((i % 12) + 1)}`;
export function manaderMellan(fran, till) {
  const a = new Date(`${fran}T00:00:00Z`), b = new Date(`${till}T00:00:00Z`);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() - a.getUTCDate()) / 30.44;
}
export function laggTillManader(datum, antal) {
  const d = new Date(`${datum}T00:00:00Z`);
  const dag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + Math.trunc(antal));
  const sista = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dag, sista));
  return d.toISOString().slice(0, 10);
}
export const nastaManad = (manad, steg = 1) => franIndex(manadIndex(manad) + steg);
export function manadSlut(nyckel) {
  const [a, m] = nyckel.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
export const dagarIManad = (nyckel) => Number(manadSlut(nyckel).slice(8, 10));
export function senasteManader(antal, tillDatum = idag()) {
  const sista = manadIndex(manadNyckel(tillDatum));
  return Array.from({ length: antal }, (_, k) => franIndex(sista - (antal - 1) + k));
}
export function kommandeManader(antal, franManad = manadNyckel(idag())) {
  const forsta = manadIndex(franManad);
  return Array.from({ length: antal }, (_, k) => franIndex(forsta + k));
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

// ---------- Affärer ----------
export const netto = (a) => (Number(a.resultat) || 0) - (Number(a.avgift) || 0);
export const stangda = (affarer) => (affarer || []).filter((a) => !a.oppen && a.resultat != null && a.datum);
export const oppnaAffarer = (affarer) => (affarer || []).filter((a) => a.oppen);

// ---------- Konton ----------
export function tradingkonto(data) {
  return (data.konton || []).find((k) => k.typ === 'trading') || null;
}
const affarKonto = (a, data) => a.kontoId || tradingkonto(data)?.id || null;

function senasteVarde(konto, datum) {
  const lista = [...(konto.varden || [])].filter((v) => v.datum <= datum).sort((a, b) => a.datum.localeCompare(b.datum));
  return lista.at(-1) || null;
}

// Värdet ett visst datum: senast inlagda värde + insättningar/uttag + realiserade affärer efter det.
export function kontoVarde(konto, data, datum = idag()) {
  const bas = senasteVarde(konto, datum);
  const basDatum = bas ? bas.datum : '0000-00-00';
  let v = bas ? Number(bas.varde) : 0;
  for (const t of konto.transaktioner || []) if (t.datum > basDatum && t.datum <= datum) v += Number(t.belopp) || 0;
  for (const a of stangda(data.affarer)) if (affarKonto(a, data) === konto.id && a.datum > basDatum && a.datum <= datum) v += netto(a);
  return v;
}

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
    ...stangda(data.affarer).map((a) => a.datum),
  ].filter(Boolean).sort();
  return datum[0] || null;
}

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
    nyckel = nastaManad(nyckel);
  }
  return ut;
}

// ---------- Trading ----------
export function tradingStatistik(affarer, { fran = '0000-00-00', till = '9999-12-31' } = {}) {
  const lista = stangda(affarer).filter((a) => a.datum >= fran && a.datum <= till)
    .sort((a, b) => a.datum.localeCompare(b.datum) || String(a.id).localeCompare(String(b.id)));
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
  let svit = 0, svitTyp = null, langstaVinstsvit = 0, langstaForlustsvit = 0, lop = 0, lopTyp = null;
  for (const r of res) {
    const typ = r > 0 ? 'vinst' : 'forlust';
    lop = typ === lopTyp ? lop + 1 : 1;
    lopTyp = typ;
    if (typ === 'vinst') langstaVinstsvit = Math.max(langstaVinstsvit, lop); else langstaForlustsvit = Math.max(langstaForlustsvit, lop);
  }
  for (let i = res.length - 1; i >= 0; i--) {
    const typ = res[i] > 0 ? 'vinst' : 'forlust';
    if (svitTyp === null) svitTyp = typ;
    if (typ !== svitTyp) break;
    svit++;
  }
  const insatt = lista.reduce((s, a) => s + (Number(a.insats) || 0), 0);
  const hall = lista.filter((a) => a.kopDatum).map((a) => Math.max(0, manaderMellan(a.kopDatum, a.datum) * 30.44));
  const delmangd = (riktning) => {
    const l = lista.filter((a) => (Number(a.riktning) === -1 ? -1 : 1) === riktning);
    const r = l.map(netto);
    return { antal: l.length, summa: r.reduce((s, x) => s + x, 0), traffProc: l.length ? (100 * r.filter((x) => x > 0).length) / l.length : null };
  };
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
    svit, svitTyp, langstaVinstsvit, langstaForlustsvit,
    insatt,
    avkastningPaInsats: insatt > 0 ? (100 * summa) / insatt : null,
    snittHalltidDagar: hall.length ? hall.reduce((s, x) => s + x, 0) / hall.length : null,
    lang: delmangd(1), kort: delmangd(-1),
    resultat: res,
    kurva: kurvpunkter,
  };
}

export function tradingPerManad(affarer, manader) {
  const lista = stangda(affarer);
  return manader.map((m) => {
    const l = lista.filter((a) => manadNyckel(a.datum) === m);
    return { manad: m, summa: l.reduce((s, a) => s + netto(a), 0), antal: l.length };
  });
}

export function tradingPerInstrument(affarer) {
  const grupper = new Map();
  for (const a of stangda(affarer)) {
    const k = a.instrument || 'Okänt';
    if (!grupper.has(k)) grupper.set(k, []);
    grupper.get(k).push(a);
  }
  return [...grupper.entries()].map(([instrument, lista]) => {
    const s = tradingStatistik(lista);
    return { instrument, antal: s.antal, traffProc: s.traffProc, summa: s.summa };
  }).sort((a, b) => b.summa - a.summa);
}

// Fördelning av resultat i jämna intervall, för ett histogram.
export function resultatfordelning(resultat, antalHinkar = 8) {
  if (!resultat.length) return [];
  const max = Math.max(...resultat.map(Math.abs)) || 1;
  const steg = Math.ceil((2 * max) / antalHinkar / 50) * 50 || 50;
  const start = -Math.ceil(max / steg) * steg;
  const hinkar = [];
  for (let v = start; v < -start; v += steg) hinkar.push({ fran: v, till: v + steg, antal: 0 });
  for (const r of resultat) {
    const h = hinkar.find((x) => r >= x.fran && r < x.till) || hinkar.at(-1);
    h.antal++;
  }
  return hinkar;
}

// ---------- Planerade poster (budget) ----------
export function postIManad(post, manad) {
  const mi = manadIndex(manad);
  const s = post.start ? manadIndex(manadNyckel(post.start)) : null;
  const e = post.slut ? manadIndex(manadNyckel(post.slut)) : Infinity;
  if ((s != null && mi < s) || mi > e) return false;
  switch (post.frekvens) {
    case 'en-gang': return s != null && mi === s;
    case 'kvartal': return s == null || (mi - s) % 3 === 0;
    case 'ar': return s != null && (mi - s) % 12 === 0;
    default: return true;
  }
}

export function nastaForekomst(post, dag = idag()) {
  const fran = manadNyckel(dag);
  for (let k = 0; k < 240; k++) {
    const m = nastaManad(fran, k);
    if (postIManad(post, m)) {
      const d = post.start ? `${m}-${post.start.slice(8, 10)}` : `${m}-01`;
      return d < dag && k === 0 ? dag : d;
    }
  }
  return null;
}

// Utgifter du sparar ihop till (sparaIhop): hur mycket som behöver läggas undan per månad.
export function sparpotter(data, dag = idag()) {
  return (data.poster || []).filter((p) => p.typ === 'utgift' && p.sparaIhop && (p.frekvens === 'en-gang' || p.frekvens === 'ar')).map((p) => {
    let datum = p.start || dag;
    if (p.frekvens === 'ar') while (datum < dag) datum = laggTillManader(datum, 12);
    const passerad = datum < dag;
    const kvarManader = Math.max(1, Math.ceil(manaderMellan(dag, datum)));
    const kvar = Math.max(0, (Number(p.belopp) || 0) - (Number(p.sparat) || 0));
    return {
      ...p, nastaDatum: datum, kvarManader, kvar, passerad,
      perManad: passerad ? 0 : kvar / kvarManader,
      andel: p.belopp > 0 ? Math.min(1, (Number(p.sparat) || 0) / p.belopp) : 1,
    };
  }).sort((a, b) => a.nastaDatum.localeCompare(b.nastaDatum));
}

export function planeratSparande(data) {
  return (data.konton || []).reduce((s, k) => s + (Number(k.manadssparande) || 0), 0);
}

export function budgetForManad(data, manad = manadNyckel(idag()), dag = idag()) {
  const poster = data.poster || [];
  const nu = manadNyckel(dag);
  const inkomstPoster = poster.filter((p) => p.typ === 'inkomst' && postIManad(p, manad));
  const utgiftPoster = poster.filter((p) => p.typ === 'utgift' && !p.sparaIhop && postIManad(p, manad));
  let avsattningar = 0;
  for (const pot of sparpotter(data, dag)) {
    if (manad < nu) continue;
    if (manad < manadNyckel(pot.nastaDatum)) avsattningar += pot.perManad;
    else if (pot.frekvens === 'ar') avsattningar += (Number(pot.belopp) || 0) / 12;
  }
  const inkomster = inkomstPoster.reduce((s, p) => s + (Number(p.belopp) || 0), 0);
  const utgifter = utgiftPoster.reduce((s, p) => s + (Number(p.belopp) || 0), 0);
  const sparande = planeratSparande(data);
  const perKategori = {};
  for (const p of utgiftPoster) perKategori[p.kategori || 'Övrigt'] = (perKategori[p.kategori || 'Övrigt'] || 0) + (Number(p.belopp) || 0);
  return {
    manad, inkomster, utgifter, avsattningar, sparande,
    kvar: inkomster - utgifter - avsattningar - sparande,
    sparkvot: inkomster > 0 ? (100 * (sparande + avsattningar)) / inkomster : null,
    inkomstPoster, utgiftPoster, perKategori,
  };
}

export function prognos(data, antal = 12, dag = idag()) {
  let kumulativt = 0;
  return kommandeManader(antal, manadNyckel(dag)).map((m) => {
    const b = budgetForManad(data, m, dag);
    kumulativt += b.kvar;
    return { ...b, kumulativt };
  });
}

// ---------- Registrerade transaktioner (det du faktiskt har spenderat och fått in) ----------
export function faktisktForManad(data, manad) {
  const lista = (data.transaktioner || []).filter((t) => manadNyckel(t.datum) === manad);
  const utg = lista.filter((t) => t.belopp < 0);
  const ink = lista.filter((t) => t.belopp > 0);
  const perKategori = {};
  for (const t of utg) perKategori[t.kategori || 'Övrigt'] = (perKategori[t.kategori || 'Övrigt'] || 0) - t.belopp;
  return {
    manad, antal: lista.length,
    utgifter: -utg.reduce((s, t) => s + t.belopp, 0),
    inkomster: ink.reduce((s, t) => s + t.belopp, 0),
    perKategori,
    storsta: [...utg].sort((a, b) => a.belopp - b.belopp).slice(0, 5),
  };
}

export function utgiftsstatistik(data, manad = manadNyckel(idag()), antalManader = 6, dag = idag()) {
  const manader = senasteManader(antalManader, `${manad}-01`);
  const perManad = manader.map((m) => faktisktForManad(data, m));
  const denna = perManad.at(-1);
  const tidigare = perManad.slice(0, -1).filter((m) => m.antal > 0);
  const kategorier = new Set([...Object.keys(denna.perKategori), ...tidigare.flatMap((m) => Object.keys(m.perKategori))]);
  const snitt = (kat) => (tidigare.length ? tidigare.reduce((s, m) => s + (m.perKategori[kat] || 0), 0) / tidigare.length : null);
  const pagaende = manad === manadNyckel(dag);
  const dagar = dagarIManad(manad);
  const dagarGatt = pagaende ? Number(dag.slice(8, 10)) : dagar;
  const kat = [...kategorier].map((k) => ({
    kategori: k, belopp: denna.perKategori[k] || 0, snitt: snitt(k),
    andel: denna.utgifter > 0 ? (denna.perKategori[k] || 0) / denna.utgifter : 0,
  })).sort((a, b) => b.belopp - a.belopp || (b.snitt || 0) - (a.snitt || 0));
  const snittTidigare = tidigare.length ? tidigare.reduce((s, m) => s + m.utgifter, 0) / tidigare.length : null;
  return {
    manad, manader: perManad, denna, kategorier: kat,
    snittManad: snittTidigare,
    perDag: dagarGatt > 0 ? denna.utgifter / dagarGatt : 0,
    prognosManad: pagaende && dagarGatt > 0 ? (denna.utgifter / dagarGatt) * dagar : denna.utgifter,
    dagarGatt, dagar, pagaende,
  };
}

// Utrymme: vad du har kvar att spendera den här månaden efter sparande och avsättningar.
export function manadsutrymme(data, dag = idag()) {
  const manad = manadNyckel(dag);
  const plan = budgetForManad(data, manad, dag);
  const fakt = faktisktForManad(data, manad);
  const dagar = dagarIManad(manad);
  const dagNr = Number(dag.slice(8, 10));
  const dagarKvar = dagar - dagNr + 1;
  const disponibelt = plan.inkomster - plan.sparande - plan.avsattningar;
  const registrerar = fakt.antal > 0;
  const spenderat = registrerar ? fakt.utgifter : null;
  const kvar = registrerar ? disponibelt - fakt.utgifter : plan.kvar;
  return {
    manad, lage: registrerar ? 'faktiskt' : 'plan', disponibelt, spenderat, kvar,
    perDag: kvar / dagarKvar, dagarKvar, dagNr, dagar,
    andelTid: dagNr / dagar, andelSpenderat: registrerar && disponibelt > 0 ? fakt.utgifter / disponibelt : null,
    plan,
  };
}

export function sparatUnderManad(data, manad) {
  let s = 0;
  for (const k of data.konton || []) for (const t of k.transaktioner || []) if (manadNyckel(t.datum) === manad) s += Number(t.belopp) || 0;
  return s;
}

export function sparsvit(data, dag = idag()) {
  const plan = planeratSparande(data);
  if (plan <= 0) return 0;
  const nu = manadNyckel(dag);
  let svit = sparatUnderManad(data, nu) >= plan ? 1 : 0;
  let m = nastaManad(nu, -1);
  for (let k = 0; k < 120; k++) {
    if (sparatUnderManad(data, m) >= plan) svit++; else break;
    m = nastaManad(m, -1);
  }
  return svit;
}

// Sparkvot per månad: insatt på konton delat med inkomsterna (registrerade, annars planerade).
export function sparkvotHistorik(data, antal = 6, dag = idag()) {
  return senasteManader(antal, dag).map((m) => {
    const ink = faktisktForManad(data, m).inkomster || budgetForManad(data, m, dag).inkomster;
    const sparat = sparatUnderManad(data, m);
    return { manad: m, inkomster: ink, sparat, kvot: ink > 0 ? (100 * sparat) / ink : null };
  });
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
  const prognosV = slutvarde(nuvarande, spar, avk, manader);
  const tid = manaderTill(mal.belopp, nuvarande, spar, avk);
  return {
    nuvarande, avkastning: avk, manadssparande: spar, manader,
    andelNu: mal.belopp > 0 ? nuvarande / mal.belopp : 0,
    prognos: prognosV, prognosAndel: mal.belopp > 0 ? prognosV / mal.belopp : 0,
    kravSpar: kravManadsspar(mal.belopp, nuvarande, avk, manader),
    kravAvk: kravAvkastning(mal.belopp, nuvarande, spar, manader),
    nasDatum: tid == null ? null : laggTillManader(dag, tid),
    iFas: prognosV >= mal.belopp,
  };
}

export function nastaMilstolpe(varde, manadsspar, arsProc, dag = idag()) {
  const steg = varde < 100000 ? 25000 : varde < 500000 ? 100000 : varde < 2000000 ? 250000 : 1000000;
  const mal = Math.floor(varde / steg) * steg + steg;
  const n = manaderTill(mal, varde, manadsspar, arsProc);
  return { mal, manader: n, datum: n == null ? null : laggTillManader(dag, n) };
}

// ---------- Fördelning och sparplan ----------
export const STANDARDINSTALLNINGAR = { bufferManader: 3, sparkvotMal: 15, hogriskMax: 10, langsiktigAvkastning: 7 };

export function fordelning(data, dag = idag()) {
  const per = { buffert: 0, langsiktigt: 0, trading: 0, pension: 0, annat: 0 };
  for (const k of data.konton || []) per[k.typ in per ? k.typ : 'annat'] += Math.max(0, kontoVarde(k, data, dag));
  const totalt = Object.values(per).reduce((s, v) => s + v, 0);
  const investerat = per.langsiktigt + per.trading;
  return { per, totalt, investerat, hogriskAndel: investerat > 0 ? (100 * per.trading) / investerat : null };
}

// Månadsutgifter att räkna bufferten på: snittet av registrerade utgifter senaste 3 månaderna, annars budgeten.
export function manadsutgifter(data, dag = idag()) {
  const fakt = senasteManader(4, dag).slice(0, 3).map((m) => faktisktForManad(data, m)).filter((m) => m.antal > 5);
  if (fakt.length) return fakt.reduce((s, m) => s + m.utgifter, 0) / fakt.length;
  return budgetForManad(data, manadNyckel(dag), dag).utgifter;
}

export function sparplan(data, inst = STANDARDINSTALLNINGAR, dag = idag()) {
  const I = { ...STANDARDINSTALLNINGAR, ...inst };
  const total = planeratSparande(data);
  const f = fordelning(data, dag);
  const utg = manadsutgifter(data, dag);
  const bufferMal = I.bufferManader * utg;
  const bufferBrist = Math.max(0, bufferMal - f.per.buffert);
  // Halva sparandet till bufferten tills den är full, därefter högst hogriskMax % till högrisk och resten långsiktigt.
  const tillBuffert = bufferBrist > 0 ? Math.min(bufferBrist, total * 0.5) : 0;
  const rest = total - tillBuffert;
  const tillHogrisk = rest * (I.hogriskMax / 100);
  return {
    total, manadsutgifter: utg, bufferMal, bufferNu: f.per.buffert, bufferBrist,
    bufferManaderNu: utg > 0 ? f.per.buffert / utg : null,
    tillBuffert, tillHogrisk, tillLangsiktigt: rest - tillHogrisk,
    bufferFullOm: tillBuffert > 0 ? Math.ceil(bufferBrist / tillBuffert) : 0,
    fordelning: f,
  };
}

// ---------- Tips ----------
// Regelbaserade tips utifrån dina egna siffror och de mål du har ställt in. Inga råd om specifika produkter.
export function tips(data, inst = STANDARDINSTALLNINGAR, dag = idag()) {
  const I = { ...STANDARDINSTALLNINGAR, ...inst };
  const ut = [];
  const kr = (v) => `${Math.round(v).toLocaleString('sv-SE')} kr`;
  const manad = manadNyckel(dag);
  const plan = sparplan(data, I, dag);
  const budget = budgetForManad(data, manad, dag);
  const progn = prognos(data, 12, dag);

  // Buffert
  if (plan.manadsutgifter > 0 && (data.konton || []).length) {
    const man = plan.bufferManaderNu ?? 0;
    if (man < I.bufferManader) {
      ut.push({ id: 'buffert', niva: man < 1 ? 'varning' : 'tips', rubrik: `Bufferten räcker ${man.toFixed(1).replace('.', ',')} månader`,
        text: `Ditt mål är ${I.bufferManader} månaders utgifter (${kr(plan.bufferMal)}). Det saknas ${kr(plan.bufferBrist)}. ${plan.tillBuffert > 0 ? `Med ${kr(plan.tillBuffert)} i månaden är den full om ${plan.bufferFullOm} månader.` : 'Lägg in ett månadssparande på ett buffertkonto.'} En buffert gör att en oväntad utgift inte tvingar dig att sälja investeringar eller trading i fel läge.` });
    } else {
      ut.push({ id: 'buffert', niva: 'bra', rubrik: 'Bufferten är full', text: `Den räcker ${man.toFixed(1).replace('.', ',')} månader, över ditt mål på ${I.bufferManader}. Nytt sparande kan gå till investeringar.` });
    }
  }
  // Sparkvot
  if (budget.inkomster > 0) {
    const kvot = budget.sparkvot ?? 0;
    if (kvot < I.sparkvotMal) {
      const behov = (I.sparkvotMal / 100) * budget.inkomster - (budget.sparande + budget.avsattningar);
      ut.push({ id: 'sparkvot', niva: 'tips', rubrik: `Du sparar ${Math.round(kvot)} % av inkomsten`, text: `Ditt mål är ${I.sparkvotMal} %. Det motsvarar ${kr(behov)} mer i månaden. Ett sätt som brukar fungera är att föra över sparandet automatiskt samma dag som pengarna kommer in.` });
    } else {
      ut.push({ id: 'sparkvot', niva: 'bra', rubrik: `Du sparar ${Math.round(kvot)} % av inkomsten`, text: `Det är över ditt mål på ${I.sparkvotMal} %. Snyggt.` });
    }
  }
  // Högriskandel
  const f = plan.fordelning;
  if (f.investerat > 0 && f.hogriskAndel != null) {
    if (f.hogriskAndel > I.hogriskMax) {
      ut.push({ id: 'hogrisk', niva: 'varning', rubrik: `${Math.round(f.hogriskAndel)} % av dina investeringar är högrisk`, text: `Din gräns är ${I.hogriskMax} %. Låt nytt sparande gå till långsiktigt tills andelen är nere, eller flytta en del av tradingvinsterna dit. Pengar i trading kan försvinna snabbt, medan långsiktigt sparande får ränta på ränta.` });
    } else {
      ut.push({ id: 'hogrisk', niva: 'bra', rubrik: `Högrisk är ${Math.round(f.hogriskAndel)} % av investeringarna`, text: `Inom din gräns på ${I.hogriskMax} %.` });
    }
  }
  // Budget som inte går ihop, nu och framåt
  const minus = progn.find((m) => m.kvar < -1);
  if (minus) {
    const tackt = progn.find((m) => m.manad >= minus.manad && m.kumulativt < -1);
    const manNamn = new Date(`${minus.manad}-15T12:00:00Z`).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    ut.push({ id: 'minus', niva: tackt ? 'varning' : 'tips', rubrik: `Budgeten går minus i ${manNamn}`,
      text: tackt
        ? `${kr(-minus.kvar)} mer ut än in den månaden, och överskottet från tidigare månader räcker inte. Se över utgifterna eller planera in en inkomst.`
        : `${kr(-minus.kvar)} mer ut än in den månaden, men tidigare överskott täcker det om du sparar undan dem. Se prognosen under Budget.` });
  }
  // Pengar som inte är planerade
  if (budget.kvar > 500) {
    ut.push({ id: 'kvar', niva: 'tips', rubrik: `${kr(budget.kvar)} per månad är inte planerade`, text: 'Pengar utan plan brukar spenderas. Bestäm vad de ska göra: buffert, ett mål eller långsiktigt sparande.' });
  }
  // Kategorier som ökar
  const stat = utgiftsstatistik(data, manad, 4, dag);
  for (const k of stat.kategorier) {
    if (k.snitt == null || k.snitt < 200) continue;
    const jamfor = stat.pagaende ? (k.belopp / stat.dagarGatt) * stat.dagar : k.belopp;
    if (jamfor > k.snitt * 1.3 && jamfor - k.snitt > 300) {
      ut.push({ id: `kat-${k.kategori}`, niva: 'tips', rubrik: `${k.kategori} ökar`, text: `${stat.pagaende ? 'I den här takten blir det' : 'Det blev'} ${kr(jamfor)} den här månaden, mot ${kr(k.snitt)} i snitt. Det är ${kr(jamfor - k.snitt)} mer än vanligt.` });
    }
  }
  // Planerat mot faktiskt per kategori
  for (const [katNamn, planBelopp] of Object.entries(budget.perKategori)) {
    const fakt = stat.denna.perKategori[katNamn] || 0;
    if (planBelopp > 0 && fakt > planBelopp * 1.1 && fakt - planBelopp > 200) {
      ut.push({ id: `over-${katNamn}`, niva: 'varning', rubrik: `Över budget: ${katNamn}`, text: `${kr(fakt)} hittills mot planerade ${kr(planBelopp)}.` });
    }
  }
  // Abonnemang
  const abbPlan = budget.perKategori.Abonnemang || 0;
  const abbFakt = stat.snittManad != null ? (stat.manader.slice(0, -1).reduce((s, m) => s + (m.perKategori.Abonnemang || 0), 0) / Math.max(1, stat.manader.slice(0, -1).filter((m) => m.antal).length)) : 0;
  const abb = Math.max(abbPlan, abbFakt);
  if (abb >= 150) {
    ut.push({ id: 'abonnemang', niva: 'tips', rubrik: `Abonnemang kostar ${kr(abb * 12)} om året`, text: 'Gå igenom vilka du faktiskt använde förra månaden. Ett avslutat abonnemang på 129 kr/mån blir över 1 500 kr om året.' });
  }
  // Mål som inte är i fas
  for (const m of data.mal || []) {
    const p = malPrognos(m, data, dag);
    if (!p.iFas && p.manader > 0) {
      ut.push({ id: `mal-${m.id}`, niva: 'tips', rubrik: `${m.namn} är inte i fas`, text: `Spara ${kr(p.kravSpar)} i månaden (nu ${kr(p.manadssparande)}) för att nå ${kr(m.belopp)} i tid${p.nasDatum ? `, annars nås målet ${new Date(`${p.nasDatum}T12:00:00Z`).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}` : ''}.` });
    }
  }
  // Kommande utgifter
  for (const pot of sparpotter(data, dag)) {
    if (!pot.passerad && pot.kvar > 0 && pot.kvarManader <= 3) {
      ut.push({ id: `pot-${pot.id}`, niva: pot.kvarManader <= 1 ? 'varning' : 'tips', rubrik: `${pot.namn} om ${pot.kvarManader} mån`, text: `Det saknas ${kr(pot.kvar)}, alltså ${kr(pot.perManad)} i månaden fram till dess.` });
    }
  }
  // Trading
  const st = tradingStatistik(data.affarer);
  const tk = tradingkonto(data);
  if (st.antal >= 10) {
    const senaste = tradingStatistik(stangda(data.affarer).sort((a, b) => a.datum.localeCompare(b.datum)).slice(-20));
    if (senaste.forvantat < 0) {
      ut.push({ id: 'trading-snitt', niva: 'tips', rubrik: 'Tradingen går minus på sistone', text: `De senaste ${senaste.antal} affärerna har i snitt gett ${kr(senaste.forvantat)}. Titta på vilka instrument och vilken riktning som drar ner – se statistiken under Trading.` });
    }
    if (tk) {
      const kapital = kontoVarde(tk, data, dag);
      if (kapital > 0 && st.maxNedgang > 0.2 * (kapital + st.maxNedgang)) {
        ut.push({ id: 'trading-ned', niva: 'varning', rubrik: 'Stor nedgång i tradingen', text: `Som mest har resultatet gått ner ${kr(st.maxNedgang)} från toppen. Många sätter en gräns för hur mycket tradingkapitalet får sjunka innan de pausar och ser över strategin.` });
      }
    }
  }
  // Långsiktigt
  const lang = (data.konton || []).filter((k) => k.typ === 'langsiktigt').reduce((s, k) => s + (Number(k.manadssparande) || 0), 0);
  if (lang > 0) {
    const tjugo = slutvarde(f.per.langsiktigt, lang, I.langsiktigAvkastning, 240);
    ut.push({ id: 'langsiktigt', niva: 'bra', rubrik: `${kr(lang)} i månaden långsiktigt`, text: `Med ${I.langsiktigAvkastning} % om året blir det ungefär ${kr(Math.round(tjugo / 10000) * 10000)} om 20 år. Tiden gör det mesta av jobbet – varje år tidigare du börjar märks mest i slutet.` });
  } else if ((data.konton || []).length && budget.inkomster > 0) {
    ut.push({ id: 'langsiktigt', niva: 'tips', rubrik: 'Inget långsiktigt månadssparande', text: `Även 500 kr i månaden med ${I.langsiktigAvkastning} % om året blir ungefär ${kr(Math.round(slutvarde(0, 500, I.langsiktigAvkastning, 240) / 1000) * 1000)} om 20 år.` });
  }
  const ordning = { varning: 0, tips: 1, bra: 2 };
  return ut.sort((a, b) => ordning[a.niva] - ordning[b.niva]);
}

// ---------- Import av kontoutdrag (CSV eller inklistrad tabell) ----------
export function tolkaBelopp(s) {
  if (s == null) return null;
  let t = String(s).trim().replace(/−/g, '-').replace(/\s| |kr|sek/gi, '');
  if (!t) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function tolkaDatum(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${tva(m[2])}-${tva(m[3])}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${tva(m[2])}-${tva(m[1])}`;
  m = t.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function delaRad(rad, sep) {
  const ut = [];
  let akt = '', citat = false;
  for (let i = 0; i < rad.length; i++) {
    const c = rad[i];
    if (c === '"') { if (citat && rad[i + 1] === '"') { akt += '"'; i++; } else citat = !citat; }
    else if (c === sep && !citat) { ut.push(akt.trim()); akt = ''; }
    else akt += c;
  }
  ut.push(akt.trim());
  return ut;
}

export function tolkaCsv(text) {
  const rader = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((r) => r.trim());
  if (!rader.length) return { rubrik: null, rader: [], separator: ';' };
  const prov = rader.slice(0, 20);
  const sep = ['\t', ';', ','].map((s) => ({ s, n: prov.map((r) => delaRad(r, s).length) }))
    .map((x) => ({ ...x, typ: x.n.sort((a, b) => b - a)[Math.floor(x.n.length / 2)] }))
    .sort((a, b) => b.typ - a.typ)[0].s;
  const delade = rader.map((r) => delaRad(r, sep));
  const bredd = Math.max(...delade.slice(0, 30).map((r) => r.length));
  const fulla = delade.filter((r) => r.length >= Math.max(2, bredd - 1));
  const forsta = fulla[0] || [];
  const arRubrik = forsta.length && !forsta.some((c) => tolkaDatum(c)) && forsta.filter((c) => tolkaBelopp(c) != null).length === 0;
  return { separator: sep, rubrik: arRubrik ? forsta : null, rader: arRubrik ? fulla.slice(1) : fulla };
}

export function gissaKolumner(rubrik, rader) {
  const bredd = Math.max(0, ...rader.map((r) => r.length));
  const namn = (i) => String(rubrik?.[i] || '').toLowerCase();
  const prov = rader.slice(0, 40);
  const andel = (i, f) => (prov.length ? prov.filter((r) => f(r[i])).length / prov.length : 0);
  let datum = -1, belopp = -1, text = -1, bastD = 0, bastB = -1, bastT = 0;
  for (let i = 0; i < bredd; i++) {
    const d = andel(i, (v) => tolkaDatum(v)) + (/datum|date|dag/.test(namn(i)) ? 0.5 : 0) + (/bokf/.test(namn(i)) ? 0.2 : 0);
    if (d > bastD) { bastD = d; datum = i; }
  }
  for (let i = 0; i < bredd; i++) {
    if (i === datum) continue;
    const n = namn(i);
    if (/saldo|balance|behållning/.test(n)) continue;
    const a = andel(i, (v) => tolkaBelopp(v) != null && /[.,]\d{2}$|^-?\d+$/.test(String(v).trim()));
    const neg = andel(i, (v) => (tolkaBelopp(v) ?? 0) < 0);
    const poang = a + neg * 0.5 + (/belopp|amount|summa/.test(n) ? 1 : 0);
    if (a > 0.6 && poang > bastB) { bastB = poang; belopp = i; }
  }
  for (let i = 0; i < bredd; i++) {
    if (i === datum || i === belopp) continue;
    const n = namn(i);
    const langd = prov.reduce((s, r) => s + (tolkaBelopp(r[i]) == null && !tolkaDatum(r[i]) ? String(r[i] || '').length : 0), 0) / Math.max(1, prov.length);
    const poang = langd + (/text|beskriv|rubrik|namn|mottagare|specifikation|meddelande|transaktion|referens/.test(n) ? 15 : 0);
    if (poang > bastT) { bastT = poang; text = i; }
  }
  return { datum, belopp, text };
}

export function importeraRader(rader, kolumner, regler = [], befintliga = []) {
  const nyckel = (t) => `${t.datum}|${Math.round(t.belopp * 100)}|${String(t.text).toLowerCase().slice(0, 40)}`;
  const finns = new Set(befintliga.map(nyckel));
  const nya = [];
  let dubbletter = 0, ogiltiga = 0;
  for (const r of rader) {
    const datum = tolkaDatum(r[kolumner.datum]);
    const belopp = tolkaBelopp(r[kolumner.belopp]);
    const text = kolumner.text >= 0 ? String(r[kolumner.text] || '').trim() : '';
    if (!datum || belopp == null || belopp === 0) { ogiltiga++; continue; }
    const t = { datum, belopp, text, kategori: gissaKategori(text, belopp, regler), kalla: 'import' };
    const k = nyckel(t);
    if (finns.has(k)) { dubbletter++; continue; }
    finns.add(k);
    nya.push(t);
  }
  return { nya, dubbletter, ogiltiga };
}
