// Ekonomisidan: vyer, formulär och lagring. Beräkningarna ligger i ekonomi-berakning.js.
import { tal } from './engine.js';
import { gh, lager } from './github.js';
import { el, linjediagram, legend, staplarVertikala } from './diagram.js';
import * as B from './ekonomi-berakning.js';
import { tomEkonomi, normalisera, nyttId, lokal, lasMoln, finnsIMoln, sparaMoln, tillampaKo } from './ekonomi-lagring.js';

// ---------- Format ----------
const avrunda = (v) => (Math.abs(v) < 0.5 ? 0 : Math.round(v));
const kr = (v) => (v == null || !Number.isFinite(v) ? '–' : `${tal(avrunda(v), 0)} kr`);
const krTecken = (v) => (v == null || !Number.isFinite(v) ? '–' : `${avrunda(v) > 0 ? '+' : ''}${tal(avrunda(v), 0)} kr`);
const proc = (v, d = 0) => (v == null || !Number.isFinite(v) ? '–' : `${tal(v, d)} %`);
const tecken = (v) => (v == null || !Number.isFinite(v) ? '–' : `${avrunda(v) > 0 ? '+' : ''}${tal(avrunda(v), 0)}`);
const procTecken = (v, d = 1) => (v == null || !Number.isFinite(v) ? '–' : `${v > 0 ? '+' : ''}${tal(v, d)} %`);
const tkr = (v) => (Math.abs(v) < 1 ? '0' : `${tal(v / 1000, Math.abs(v) < 10000 && v % 1000 ? 1 : 0)}k`);
const klass = (v) => (v > 0.5 ? 'vinst' : v < -0.5 ? 'forlust' : '');
const tolkaTal = (v) => B.tolkaBelopp(v);
const d12 = (d) => new Date(`${d}T12:00:00Z`);
const fmt = (opt) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', ...opt });
const F = {
  datum: fmt({ day: 'numeric', month: 'short', year: 'numeric' }),
  dagMan: fmt({ day: 'numeric', month: 'short' }),
  manad: fmt({ month: 'long', year: 'numeric' }),
  manadNamn: fmt({ month: 'long' }),
  manKort: fmt({ month: 'short' }),
  manKortAr: fmt({ month: 'short', year: '2-digit' }),
  klocka: new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' }),
};
const datum = (d) => (d ? F.datum.format(d12(d)) : '–');
const dagMan = (d) => (d ? F.dagMan.format(d12(d)) : '–');
const manadNamn = (m) => F.manad.format(d12(`${m}-15`));
const manadBara = (m) => F.manadNamn.format(d12(`${m}-15`));
const manadKort = (m) => F.manKort.format(d12(`${m}-15`)).replace('.', '');
const manadKortAr = (m) => F.manKortAr.format(d12(`${m}-15`)).replace('.', '');
const $ = (id) => document.getElementById(id);
const nuManad = () => B.manadNyckel(B.idag());
const tidTill = (d) => { const m = B.manaderMellan(B.idag(), d); if (m < 1) { const dagar = Math.round(m * 30.44); return dagar <= 0 ? 'idag' : `om ${dagar} ${dagar === 1 ? 'dag' : 'dagar'}`; } return m < 24 ? `om ${Math.round(m)} mån` : `om ${tal(m / 12, 1)} år`; };

// ---------- Ikoner ----------
const IKON = {
  hem: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/>',
  kvitto: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  kalender: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  graf: '<path d="M4 4v16h16"/><path d="M7.5 15.5l4-4.5 3 3L20 7.5"/>',
  vaxt: '<path d="M12 21v-9"/><path d="M12 12c0-4.4 3.1-7.5 7.5-7.5 0 4.4-3.1 7.5-7.5 7.5z"/><path d="M12 14.5c0-3.3-2.2-5.5-6-5.5 0 3.3 2.2 5.5 6 5.5z"/>',
  flagga: '<path d="M5.5 21V3.5"/><path d="M5.5 4h11.5l-2.5 4.25L17 12.5H5.5"/>',
  lampa: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.1 1.4 1.1 2.4h5.4c0-1 .4-1.8 1.1-2.4A6 6 0 0 0 12 3z"/>',
  kugg: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  mer: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  minus: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  plus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  kop: '<path d="M7 17 17 7"/><path d="M9 7h8v8"/>',
  salj: '<path d="M17 7 7 17"/><path d="M15 17H7V9"/>',
  bank: '<path d="M3.5 9.5 12 4.5l8.5 5"/><path d="M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3.5 20h17"/>',
  planera: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
  import: '<path d="M12 3.5v11"/><path d="M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4 16.5V20h16v-3.5"/>',
};
const ikon = (namn) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = IKON[namn]; return s; };

// ---------- Tillstånd ----------
const t = {
  data: lokal.las() || tomEkonomi(),
  lage: 'lokal', losen: '', salt: null, sparTimer: null, angra: null,
  guldbotHistorik: [],
  utgiftManad: nuManad(), budgetManad: nuManad(), tradingPeriod: 'ar', utgiftFilter: '', utgiftSok: '',
  kalkyl: { start: 10000, spar: 2000, avk: 7, ar: 10, mal: '' },
};
const inst = () => ({ ...B.STANDARDINSTALLNINGAR, ...(t.data.installningar || {}) });

function satSynk(text, typ = '') {
  for (const id of ['synk', 'synkSida']) { const s = $(id); s.className = `synk ${typ}`; s.lastElementChild.textContent = text; }
}
function visaMeddelande(text, typ = 'info') { const m = $('meddelande'); m.hidden = !text; m.className = `meddelande ${typ}`; m.textContent = text || ''; }
function notis(text, angra = null) {
  const n = $('notis');
  $('notistext').textContent = text;
  $('notisAngra').hidden = !angra;
  t.angra = angra;
  n.style.display = 'flex';
  clearTimeout(notis.timer);
  notis.timer = setTimeout(() => { n.style.display = 'none'; t.angra = null; }, angra ? 7000 : 3200);
}
$('notisAngra').addEventListener('click', () => { if (t.angra) t.angra(); t.angra = null; $('notis').style.display = 'none'; });

function andra(fn, { meddelande = null, angraBar = false } = {}) {
  const fore = JSON.stringify(t.data);
  fn(t.data);
  t.data.uppdaterad = new Date().toISOString();
  lokal.spara(t.data);
  rendera();
  schemalaggSynk();
  if (meddelande) {
    notis(meddelande, angraBar ? () => {
      t.data = normalisera(JSON.parse(fore));
      t.data.uppdaterad = new Date().toISOString();
      lokal.spara(t.data); rendera(); schemalaggSynk();
    } : null);
  }
}

function schemalaggSynk() {
  if (t.lage !== 'synk') { uppdateraSynkstatus(); return; }
  satSynk('Sparar …', 'sparar');
  clearTimeout(t.sparTimer);
  t.sparTimer = setTimeout(synka, 1500);
}
async function synka() {
  try {
    const k = await sparaMoln(gh, t.data, t.losen, t.salt);
    t.salt = k.salt;
    satSynk(`Synkad ${F.klocka.format(new Date())}`, 'ok');
  } catch (e) {
    satSynk('Kunde inte synka', 'fel');
    visaMeddelande(`Ändringen är sparad på den här enheten men kunde inte synkas: ${e.message}`, 'fel');
  }
}
function uppdateraSynkstatus() {
  if (t.lage === 'synk') satSynk('Synkad', 'ok');
  else if (t.lage === 'last') satSynk('Låst', 'fel');
  else satSynk('På den här enheten');
}
function slaIhopKo() {
  const ko = lokal.ko();
  if (!ko.length) return 0;
  let n = 0;
  for (const a of ko) if (tillampaKo(t.data, a)) n++;
  lokal.tomKo();
  return n;
}

// ---------- Uppstart och upplåsning ----------
async function starta() {
  t.data = normalisera(t.data);
  byggNavigering();
  rendera();
  uppdateraSynkstatus();
  laddaGuldbotHistorik();
  if (!gh.aktiv()) { const n = slaIhopKo(); if (n) andra(() => {}, { meddelande: `${n} affärer från Guldbot har lagts till.` }); return; }
  let finns = false;
  try { finns = await finnsIMoln(gh); } catch (e) { visaMeddelande(`Kunde inte nå GitHub: ${e.message}. Visar uppgifterna på den här enheten.`, 'fel'); return; }
  if (!finns) {
    t.lage = 'kan-synka';
    uppdateraSynkstatus();
    const n = slaIhopKo();
    if (n) andra(() => {}, { meddelande: `${n} affärer från Guldbot har lagts till.` });
    return;
  }
  const losen = lokal.losen();
  if (losen) await lasUpp(losen, lokal.komIhag(), true); else visaLast();
}

function visaLast() {
  t.lage = 'last';
  uppdateraSynkstatus();
  $('lasupp').hidden = false;
  $('vyer').hidden = true;
  $('lasuppLosen').focus();
}

async function lasUpp(losen, komIhag, tyst = false) {
  satSynk('Låser upp …', 'sparar');
  try {
    const m = await lasMoln(gh, losen);
    t.losen = losen; t.salt = m.kuvert.salt;
    lokal.sparaLosen(losen, komIhag);
    const lok = lokal.las();
    const lokNyare = lok?.uppdaterad && (!m.data.uppdaterad || lok.uppdaterad > m.data.uppdaterad);
    t.data = normalisera(lokNyare ? lok : m.data);
    t.lage = 'synk';
    $('lasupp').hidden = true; $('vyer').hidden = false;
    const n = slaIhopKo();
    lokal.spara(t.data);
    rendera();
    if (lokNyare || n || m.data.version !== 2) schemalaggSynk(); else satSynk(`Synkad ${F.klocka.format(new Date())}`, 'ok');
    if (n) notis(`${n} affärer från Guldbot har lagts till.`);
  } catch (e) {
    if (!tyst) visaMeddelande(e.message === 'Fel lösenfras.' ? 'Fel lösenfras. Försök igen.' : `Kunde inte låsa upp: ${e.message}`, 'fel');
    lokal.glomLosen();
    visaLast();
  }
}
$('lasuppForm').addEventListener('submit', (e) => { e.preventDefault(); visaMeddelande(''); lasUpp($('lasuppLosen').value, $('lasuppKomIhag').checked); });

async function laddaGuldbotHistorik() {
  try {
    const p = gh.aktiv() ? await gh.lasFil('docs/positioner.json') : await (await fetch(`positioner.json?t=${Date.now()}`, { cache: 'no-store' })).json();
    t.guldbotHistorik = p.historik || [];
    if (aktivVy() === 'trading') rendera();
  } catch { t.guldbotHistorik = []; }
}

// ---------- Navigering ----------
const VYER = {
  oversikt: { namn: 'Översikt', ikon: 'hem' },
  utgifter: { namn: 'Utgifter', ikon: 'kvitto' },
  budget: { namn: 'Budget', ikon: 'kalender' },
  trading: { namn: 'Trading', ikon: 'graf' },
  sparande: { namn: 'Sparande', ikon: 'vaxt' },
  mal: { namn: 'Mål', ikon: 'flagga' },
  tips: { namn: 'Tips', ikon: 'lampa' },
  installningar: { namn: 'Inställningar', ikon: 'kugg' },
  mer: { namn: 'Mer', ikon: 'mer', baraMobil: true },
};
const MOBILFLIKAR = ['oversikt', 'utgifter', 'budget', 'trading', 'mer'];
const aktivVy = () => { const h = location.hash.slice(1); return VYER[h] ? h : 'oversikt'; };

function byggNavigering() {
  $('flikrad').replaceChildren(...MOBILFLIKAR.map((id) => el('a', { href: `#${id}`, 'data-vy': id }, ikon(VYER[id].ikon), VYER[id].namn)));
  $('sidolankar').replaceChildren(...Object.entries(VYER).filter(([, v]) => !v.baraMobil).map(([id, v]) => el('a', { class: 'post', href: `#${id}`, 'data-vy': id }, ikon(v.ikon), v.namn)));
}
function markeraNavigering() {
  const v = aktivVy();
  const mobil = MOBILFLIKAR.includes(v) ? v : 'mer';
  document.querySelectorAll('#flikrad a').forEach((a) => a.setAttribute('aria-current', a.dataset.vy === mobil ? 'page' : 'false'));
  document.querySelectorAll('#sidolankar a').forEach((a) => a.setAttribute('aria-current', a.dataset.vy === v ? 'page' : 'false'));
  $('rubrik').textContent = VYER[v].namn;
  document.title = `${VYER[v].namn} · Ekonomi`;
}
window.addEventListener('hashchange', () => { rendera(); window.scrollTo({ top: 0 }); });
$('snabbknapp').addEventListener('click', snabbmeny);
$('sidoSnabb').addEventListener('click', snabbmeny);

function rendera() {
  markeraNavigering();
  if (t.lage === 'last') return;
  const v = aktivVy();
  const vy = el('div', { class: 'vy' });
  ({ oversikt: vyOversikt, utgifter: vyUtgifter, budget: vyBudget, trading: vyTrading, sparande: vySparande, mal: vyMal, tips: vyTips, installningar: vyInstallningar, mer: vyMer })[v](vy);
  $('vyer').replaceChildren(vy);
  for (const f of efterRender.splice(0)) f();
}
const efterRender = [];
const senare = (f) => efterRender.push(f);
// Rita om diagrammen bara när bredden ändras (inte när mobilens tangentbord öppnas).
let storlek, senasteBredd = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(storlek);
  storlek = setTimeout(() => { if (Math.abs(window.innerWidth - senasteBredd) > 40) { senasteBredd = window.innerWidth; rendera(); } }, 200);
});

// ---------- Byggstenar ----------
const knapp = (text, gor, cls = 'knapp') => { const b = el('button', { type: 'button', class: cls }, text); b.addEventListener('click', gor); return b; };
const sektion = (rubrik, hoger, ...innehall) => el('section', { class: 'sektion' }, el('div', { class: 'sektionshuvud' }, el('h2', { text: rubrik }), hoger || null), ...innehall);
const panel = (...innehall) => el('div', { class: 'panel' }, ...innehall);
const nyckeltal = (lista) => el('div', { class: 'nyckeltal' }, ...lista.filter(Boolean).map(([etikett, varde, not, cls]) => el('div', {}, el('span', { class: 'etikett', text: etikett }), el('span', { class: `tal ${cls || ''}`, text: varde }), not ? el('span', { class: 'not', text: not }) : null)));
const tomRuta = (text, ...knappar) => el('div', { class: 'tom' }, el('p', { text }), knappar.length ? el('div', { class: 'knapprad' }, ...knappar) : null);
function spar(andel, prognos = null) {
  const s = el('div', { class: 'spar', role: 'img', 'aria-label': `${Math.round(100 * andel)} procent` });
  if (prognos != null) { const p = el('span', { class: 'prognos' }); p.style.width = `${Math.min(100, 100 * prognos)}%`; s.append(p); }
  const f = el('span'); f.style.width = `${Math.min(100, Math.max(0, 100 * andel))}%`; s.append(f);
  return s;
}
function manadsvaljare(manad, satt) {
  return el('div', { class: 'knapprad' },
    knapp('‹', () => satt(B.nastaManad(manad, -1)), 'knapp liten'),
    el('span', { class: 'liten', style: 'font-weight:650; min-width:9.5em; text-align:center', text: manadNamn(manad) }),
    knapp('›', () => satt(B.nastaManad(manad, 1)), 'knapp liten'));
}
function segment(alternativ, valt, satt) {
  return el('div', { class: 'segment', role: 'group' }, ...alternativ.map(([v, namn]) => {
    const b = el('button', { type: 'button', 'aria-pressed': String(v === valt) }, namn);
    b.addEventListener('click', () => satt(v));
    return b;
  }));
}
const totalVarde = (d = B.idag()) => t.data.konton.reduce((s, k) => s + B.kontoVarde(k, t.data, d), 0);
const harNagot = () => t.data.konton.length || t.data.poster.length || t.data.transaktioner.length || t.data.affarer.length;

// ---------- Översikt ----------
function vyOversikt(vy) {
  const d = t.data;
  if (!harNagot()) {
    vy.append(el('section', { class: 'hjalte' },
      el('span', { class: 'etikett', text: 'Välkommen' }),
      el('p', { style: 'font-size:26px; font-weight:800; letter-spacing:-0.02em; line-height:1.15; max-width:24ch', text: 'Få koll på vad som kommer in, vad som går ut och vad som växer.' }),
      el('div', { class: 'knapprad' },
        knapp('Planera inkomster och utgifter', () => postForm(), 'knapp'),
        knapp('Testa med exempeldata', fyllExempel, 'knapp'))));
    vy.append(sektion('Kom igång', null, el('div', { class: 'lista panel tat' },
      ...[['Lägg in din budget', 'Lön, bidrag, hyra och andra inkomster och utgifter – en gång eller varje månad.', () => postForm()],
        ['Lägg till dina konton', 'Buffert, långsiktigt sparande och tradingkapital med dagens värde.', () => kontoForm()],
        ['Registrera en utgift', 'Eller importera ett kontoutdrag från banken, så sorteras allt i kategorier.', () => utgiftForm()]]
        .map(([namn, under, gor]) => { const b = el('button', { type: 'button', class: 'rad' }, el('span', { class: 'namn', text: namn }), el('span', { class: 'belopp ter', text: '›' }), el('span', { class: 'under', text: under })); b.addEventListener('click', gor); return b; }))));
    return;
  }
  const u = B.manadsutrymme(d);
  const topp = el('div', { class: 'oversikt-topp' });
  // Hjälten: utrymmet den här månaden
  const bana = el('div', { class: 'bana', role: 'img', 'aria-label': 'Hur mycket av månadens utrymme som är använt jämfört med hur långt månaden har gått' });
  if (u.andelSpenderat != null) { const s = el('span'); s.style.width = `${Math.min(100, 100 * u.andelSpenderat)}%`; bana.append(s); }
  const markor = el('i'); markor.style.left = `calc(${100 * u.andelTid}% - 1px)`; bana.append(markor);
  topp.append(el('section', { class: 'hjalte' },
    el('span', { class: 'etikett', text: u.lage === 'faktiskt' ? `Kvar att spendera i ${manadBara(u.manad)}` : `Kvar enligt planen i ${manadBara(u.manad)}` }),
    el('div', { class: 'stort' }, tal(avrunda(u.kvar), 0), el('small', { text: 'kr' })),
    u.kvar > 0
      ? el('p', { class: 'perdag' }, 'Det är ', el('b', { text: kr(u.perDag) }), ` per dag i ${u.dagarKvar} ${u.dagarKvar === 1 ? 'dag' : 'dagar'} till.`)
      : el('p', { class: 'perdag', text: u.lage === 'faktiskt' ? 'Du har använt hela månadens utrymme.' : 'Planen går inte ihop den här månaden – se Budget.' }),
    bana,
    el('div', { class: 'banatext' },
      el('span', { text: u.lage === 'faktiskt' ? `Spenderat ${kr(u.spenderat)} av ${kr(u.disponibelt)}` : 'Registrera utgifter för att följa månaden dag för dag' }),
      el('span', { text: `Dag ${u.dagNr} av ${u.dagar}` })),
    el('div', { class: 'delar' },
      el('div', {}, el('span', { text: 'Inkomster' }), el('b', { text: kr(u.plan.inkomster) })),
      el('div', {}, el('span', { text: 'Sparande och avsättningar' }), el('b', { text: kr(u.plan.sparande + u.plan.avsattningar) })),
      el('div', {}, el('span', { text: 'Planerade utgifter' }), el('b', { text: kr(u.plan.utgifter) })))));
  // Förmögenhet
  const nu = totalVarde();
  const fore = totalVarde(B.manadSlut(B.nastaManad(nuManad(), -1)));
  const serie = B.formogenhetsserie(d);
  const fd = B.fordelning(d);
  const fordelningRad = fordelningsstapel(fd);
  const graf = el('div', { class: 'diagram' });
  topp.append(el('section', { class: 'panel formogenhet' },
    el('span', { class: 'sek liten', text: 'Nettoförmögenhet' }),
    el('div', { class: 'stort', text: d.konton.length ? kr(nu) : '–' }),
    d.konton.length && fore ? el('span', { class: `liten ${klass(nu - fore)}`, style: 'font-weight:650', text: `${krTecken(nu - fore)} den här månaden` }) : el('span', { class: 'liten ter', text: 'Lägg till konton för att följa förmögenheten.' }),
    serie.length >= 2 ? graf : null,
    fd.totalt > 0 ? fordelningRad : null));
  if (serie.length >= 2) senare(() => linjediagram(graf, {
    serier: [{ namn: 'Värde', kort: 'Värde', farg: 'var(--s1)', punkter: serie.map((p) => [Date.parse(p.datum), p.varde]) }, { namn: 'Insatt', kort: 'Insatt', farg: 'var(--s2)', punkter: serie.map((p) => [Date.parse(p.datum), p.insatt]) }],
    xFormat: (x) => manadKortAr(new Date(x).toISOString().slice(0, 7)), yFormat: kr, yAxelFormat: (v) => `${tal(v / 1000, 0)} tkr`, tipsTitel: 'Förmögenhet och insatt kapital', hojd: 150, fyllning: true, slutEtiketter: false,
  }));
  vy.append(topp);

  // Tips
  const tp = B.tips(d, inst()).filter((x) => x.niva !== 'bra').slice(0, 3);
  if (tp.length) vy.append(sektion('Tips för dig', el('a', { href: '#tips', class: 'knapp text', text: 'Alla tips' }), el('div', { class: 'tips-lista' }, ...tp.map(tipskort))));

  // Den här månaden
  const m = nuManad();
  const fm = B.faktisktForManad(d, m);
  const st = B.tradingStatistik(d.affarer, { fran: `${m}-01`, till: B.manadSlut(m) });
  const sparat = B.sparatUnderManad(d, m);
  const plan = B.planeratSparande(d);
  const svit = B.sparsvit(d);
  vy.append(sektion(`${manadNamn(m).replace(/^./, (c) => c.toUpperCase())}`, null, nyckeltal([
    ['Inkomster', kr(fm.inkomster || u.plan.inkomster), fm.inkomster ? 'registrerade' : 'enligt planen'],
    ['Utgifter', kr(fm.utgifter), fm.antal ? `${fm.antal} transaktioner` : 'inga registrerade ännu'],
    ['Sparat', kr(sparat), plan > 0 ? `${Math.round((100 * sparat) / plan)} % av ${kr(plan)}${svit >= 2 ? ` · ${svit} mån i rad` : ''}` : 'inget planerat sparande', sparat >= plan && plan > 0 ? 'vinst' : ''],
    ['Trading', krTecken(st.summa), st.antal ? `${st.antal} affärer · ${proc(st.traffProc)} träff` : 'inga avslutade affärer', klass(st.summa)],
  ])));

  // Utgifter per kategori
  const us = B.utgiftsstatistik(d, m);
  if (us.denna.antal) {
    vy.append(sektion('Vart pengarna går', el('a', { href: '#utgifter', class: 'knapp text', text: 'Alla utgifter' }), panel(kategorilista(us.kategorier.filter((k) => k.belopp > 0).slice(0, 5), us.denna.utgifter))));
  }

  // Kommande
  const kommande = kommandeHandelser(d, 75);
  if (kommande.length) {
    vy.append(sektion('Kommande', el('a', { href: '#budget', class: 'knapp text', text: 'Budget' }), el('div', { class: 'panel tat lista' }, ...kommande.slice(0, 5).map((k) => {
      const b = el('button', { type: 'button', class: 'rad' }, el('span', { class: 'namn', text: k.namn }), el('span', { class: `belopp ${k.typ === 'inkomst' ? 'vinst' : ''}`, text: `${k.typ === 'inkomst' ? '+' : '−'}${kr(k.belopp)}` }), el('span', { class: 'under', text: `${dagMan(k.datum)} · ${tidTill(k.datum)}${k.not ? ` · ${k.not}` : ''}` }));
      b.addEventListener('click', () => postForm(k.post));
      return b;
    }))));
  }

  // Mål
  if (d.mal.length) {
    vy.append(sektion('Mål', el('a', { href: '#mal', class: 'knapp text', text: 'Alla mål' }), el('div', { class: 'panel tat lista' }, ...d.mal.slice(0, 3).map((mal) => {
      const p = B.malPrognos(mal, d);
      return el('div', { class: 'rad' }, el('span', { class: 'namn', text: mal.namn }), el('span', { class: 'belopp', text: `${Math.round(100 * p.andelNu)} %` }),
        el('div', { style: 'grid-column:1/-1' }, spar(p.andelNu, p.prognosAndel)),
        el('span', { class: `under ${p.iFas ? 'vinst' : ''}`, text: p.iFas ? `I fas – ${kr(p.nuvarande)} av ${kr(mal.belopp)}, nås ${datum(p.nasDatum)}` : `${kr(p.nuvarande)} av ${kr(mal.belopp)} · spara ${kr(p.kravSpar)}/mån för att nå det ${datum(mal.datum)}` }));
    }))));
  }
}

function fordelningsstapel(fd) {
  const delar = [['buffert', 'Buffert', 'var(--s3)'], ['langsiktigt', 'Långsiktigt', 'var(--s1)'], ['trading', 'Trading', 'var(--s2)'], ['pension', 'Pension', 'var(--s4)'], ['annat', 'Annat', 'var(--axis)']]
    .filter(([k]) => fd.per[k] > 0);
  const rad = el('div', { style: 'display:flex; height:12px; border-radius:6px; overflow:hidden; gap:2px; margin-top:6px', role: 'img', 'aria-label': delar.map(([k, n]) => `${n} ${kr(fd.per[k])}`).join(', ') },
    ...delar.map(([k, n, f]) => { const s = el('span', { title: `${n}: ${kr(fd.per[k])}` }); s.style.flex = `${fd.per[k]} 0 0`; s.style.background = f; return s; }));
  const leg = el('div', { class: 'legend' }, ...delar.map(([k, n, f]) => { const i = el('i', { class: 'ruta' }); i.style.background = f; return el('span', {}, i, `${n} ${Math.round((100 * fd.per[k]) / fd.totalt)} %`); }));
  return el('div', { style: 'display:grid; gap:8px; margin-top:4px' }, rad, leg);
}

function tipskort(x) {
  return el('article', { class: `tipskort ${x.niva}` }, el('div', {}, el('h3', { text: x.rubrik }), el('p', { text: x.text })));
}

function kategorilista(kategorier, total) {
  const max = Math.max(1, ...kategorier.map((k) => k.belopp));
  return el('div', { class: 'katlista' }, ...kategorier.map((k) => {
    const diff = k.snitt != null ? k.belopp - k.snitt : null;
    return el('div', { class: 'katrad' },
      el('span', { class: 'namn', text: k.kategori }),
      el('span', { class: 'vardet', text: kr(k.belopp) }),
      spar(k.belopp / max),
      el('span', { class: 'not', text: `${Math.round((100 * k.belopp) / Math.max(1, total))} % av utgifterna${diff != null && Math.abs(diff) >= 50 ? ` · ${krTecken(diff)} mot snittet` : ''}` }));
  }));
}

function kommandeHandelser(d, dagar) {
  const idag = B.idag();
  const grans = B.laggTillManader(idag, Math.ceil(dagar / 30));
  const ut = [];
  for (const p of d.poster) {
    if (p.frekvens === 'manad' && (!p.start || p.start <= idag)) continue; // löpande poster syns i budgeten
    const nasta = B.nastaForekomst(p, idag);
    if (nasta && nasta >= idag && nasta <= grans) {
      const pot = p.sparaIhop ? B.sparpotter(d).find((x) => x.id === p.id) : null;
      ut.push({ namn: p.namn, belopp: Number(p.belopp) || 0, typ: p.typ, datum: nasta, post: p,
        not: p.frekvens === 'manad' ? 'första gången' : pot && pot.kvar > 0 ? `${kr(pot.kvar)} kvar att spara` : FREKVENS_KORT[p.frekvens] });
    }
  }
  return ut.sort((a, b) => a.datum.localeCompare(b.datum));
}
const FREKVENS_KORT = { 'en-gang': 'en gång', manad: 'varje månad', kvartal: 'varje kvartal', ar: 'varje år' };

// ---------- Utgifter ----------
function vyUtgifter(vy) {
  const d = t.data;
  const m = t.utgiftManad;
  const us = B.utgiftsstatistik(d, m, 6);
  vy.append(el('div', { class: 'sektionshuvud' }, manadsvaljare(m, (x) => { t.utgiftManad = x; t.utgiftFilter = ''; rendera(); }),
    el('div', { class: 'knapprad' }, knapp('Importera kontoutdrag', importArk, 'knapp liten'), knapp('Lägg till utgift', () => utgiftForm(), 'knapp liten huvud'))));
  if (!d.transaktioner.length) {
    vy.append(tomRuta('Här ser du vad du spenderar pengar på. Lägg till utgifter när du handlar, eller importera ett kontoutdrag från banken (CSV eller kopierad tabell), så sorteras allt i kategorier automatiskt.',
      knapp('Lägg till utgift', () => utgiftForm(), 'knapp huvud'), knapp('Importera kontoutdrag', importArk)));
    return;
  }
  const diffSnitt = us.snittManad != null ? (us.pagaende ? us.prognosManad : us.denna.utgifter) - us.snittManad : null;
  vy.append(nyckeltal([
    ['Spenderat', kr(us.denna.utgifter), `${us.denna.antal} transaktioner`],
    ['Per dag', kr(us.perDag), us.pagaende ? `dag ${us.dagarGatt} av ${us.dagar}` : `${us.dagar} dagar`],
    us.pagaende ? ['I den här takten', kr(us.prognosManad), 'för hela månaden'] : null,
    ['Mot snittet', diffSnitt == null ? '–' : krTecken(diffSnitt), us.snittManad != null ? `snitt ${kr(us.snittManad)} per månad` : 'behöver fler månader', diffSnitt > 0 ? 'forlust' : diffSnitt < 0 ? 'vinst' : ''],
    ['Inkomster', kr(us.denna.inkomster), 'registrerade'],
  ]));
  const kat = us.kategorier.filter((k) => k.belopp > 0);
  if (kat.length) vy.append(sektion('Vart pengarna går', null, panel(kategorilista(kat, us.denna.utgifter))));
  // Månad för månad
  const forstaMed = us.manader.findIndex((x) => x.antal > 0);
  const visade = us.manader.slice(Math.max(0, Math.min(forstaMed, us.manader.length - 2)));
  const ytan = el('div', { class: 'diagram' });
  vy.append(sektion('Månad för månad', el('div', { class: 'legend' }, ...[['Inkomster', 'var(--s1)'], ['Utgifter', 'var(--s4)']].map(([n, f]) => { const i = el('i', { class: 'ruta' }); i.style.background = f; return el('span', {}, i, n); })), panel(ytan)));
  senare(() => staplarVertikala(ytan, { etiketter: visade.map((x) => x.manad), etikettFormat: manadKort, serier: [{ namn: 'Inkomster', farg: 'var(--s1)', varden: visade.map((x) => x.inkomster) }, { namn: 'Utgifter', farg: 'var(--s4)', varden: visade.map((x) => x.utgifter) }], format: kr, axelFormat: tkr, hojd: 210 }));
  // Värmekarta
  const allaKat = [...new Set(visade.flatMap((x) => Object.keys(x.perKategori)))];
  if (allaKat.length && visade.filter((x) => x.antal).length >= 2) {
    const max = Math.max(1, ...visade.flatMap((x) => Object.values(x.perKategori)));
    allaKat.sort((a, b) => visade.reduce((s, x) => s + (x.perKategori[b] || 0), 0) - visade.reduce((s, x) => s + (x.perKategori[a] || 0), 0));
    const tab = el('table', {}, el('tr', {}, el('th', { text: 'Kategori' }), ...visade.map((x) => el('th', { text: manadKort(x.manad) }))),
      ...allaKat.map((k) => el('tr', {}, el('td', { text: k }), ...visade.map((x) => {
        const v = x.perKategori[k] || 0;
        const c = el('td', { class: 'varme', text: v ? tal(Math.round(v), 0) : '–' });
        if (v) c.style.background = `color-mix(in srgb, var(--s1) ${Math.round(8 + 52 * (v / max))}%, transparent)`;
        return c;
      }))));
    vy.append(sektion('Kategorier över tid', null, panel(el('div', { class: 'tabellram' }, tab), el('p', { class: 'pytte ter', style: 'margin-top:8px', text: 'Mörkare ruta betyder mer pengar.' }))));
  }
  // Största utgifterna
  if (us.denna.storsta.length) {
    vy.append(sektion('Största utgifterna', null, el('div', { class: 'panel tat lista' }, ...us.denna.storsta.map(transaktionsrad))));
  }
  // Transaktionslista
  const sok = el('input', { type: 'search', placeholder: 'Sök', value: t.utgiftSok, 'aria-label': 'Sök bland transaktioner', style: 'min-height:40px; padding:6px 14px; border-radius:999px; border:1.5px solid var(--yta-3); background:var(--yta); font-size:15px; width:min(100%, 240px)' });
  const kategoriVal = el('select', { 'aria-label': 'Kategori', style: 'min-height:40px; padding:6px 12px; border-radius:999px; border:1.5px solid var(--yta-3); background:var(--yta); font-size:15px' },
    el('option', { value: '' }, 'Alla kategorier'), ...[...B.UTGIFTSKATEGORIER, ...B.INKOMSTKATEGORIER.filter((k) => k !== 'Övrigt')].map((k) => el('option', { value: k, selected: k === t.utgiftFilter ? '' : null }, k)));
  const lista = el('div', { class: 'panel tat lista' });
  const fyll = () => {
    const q = t.utgiftSok.toLowerCase();
    const rader = d.transaktioner.filter((x) => B.manadNyckel(x.datum) === m && (!t.utgiftFilter || x.kategori === t.utgiftFilter) && (!q || `${x.text} ${x.kategori}`.toLowerCase().includes(q)))
      .sort((a, b) => b.datum.localeCompare(a.datum));
    lista.replaceChildren(...(rader.length ? rader.map(transaktionsrad) : [el('p', { class: 'liten ter', style: 'padding:14px 0', text: 'Inga transaktioner matchar.' })]));
  };
  sok.addEventListener('input', () => { t.utgiftSok = sok.value; fyll(); });
  kategoriVal.addEventListener('change', () => { t.utgiftFilter = kategoriVal.value; fyll(); });
  fyll();
  vy.append(sektion('Transaktioner', el('div', { class: 'knapprad' }, sok, kategoriVal), lista));
}

function transaktionsrad(x) {
  const b = el('button', { type: 'button', class: 'rad' },
    el('span', { class: 'namn', text: x.text || x.kategori }),
    el('span', { class: `belopp ${x.belopp > 0 ? 'vinst' : ''}`, text: `${x.belopp > 0 ? '+' : '−'}${kr(Math.abs(x.belopp))}` }),
    el('span', { class: 'under', text: `${x.kategori} · ${dagMan(x.datum)}` }));
  b.addEventListener('click', () => (x.belopp > 0 ? inkomstForm(x) : utgiftForm(x)));
  return b;
}

// ---------- Budget ----------
function vyBudget(vy) {
  const d = t.data;
  const m = t.budgetManad;
  const b = B.budgetForManad(d, m);
  vy.append(el('div', { class: 'sektionshuvud' }, manadsvaljare(m, (x) => { t.budgetManad = x; rendera(); }),
    el('div', { class: 'knapprad' }, knapp('Lägg till inkomst', () => postForm({ typ: 'inkomst' }), 'knapp liten'), knapp('Lägg till utgift', () => postForm({ typ: 'utgift' }), 'knapp liten huvud'))));
  if (!d.poster.length && !d.konton.length) {
    vy.append(tomRuta('Lägg in det som kommer in och går ut. Allt kan vara en gång (till exempel ett bidrag i januari) eller återkommande (hyran från januari), med start- och slutdatum.',
      knapp('Lägg till inkomst', () => postForm({ typ: 'inkomst' }), 'knapp huvud'), knapp('Lägg till utgift', () => postForm({ typ: 'utgift' }))));
    return;
  }
  vy.append(nyckeltal([
    ['Inkomster', kr(b.inkomster), `${b.inkomstPoster.length} poster`],
    ['Utgifter', kr(b.utgifter), `${b.utgiftPoster.length} poster`],
    ['Sparande och avsättningar', kr(b.sparande + b.avsattningar), b.sparkvot != null ? `sparkvot ${proc(b.sparkvot)}` : ''],
    ['Kvar', kr(b.kvar), b.kvar < -0.5 ? 'mer ut än in' : 'inte planerat', b.kvar < -0.5 ? 'forlust' : ''],
  ]));
  // Prognos
  const pr = B.prognos(d, 12);
  const ytan = el('div', { class: 'diagram' });
  vy.append(sektion('De kommande 12 månaderna', el('div', { class: 'legend' }, ...[['Inkomster', 'var(--s1)'], ['Utgifter', 'var(--s4)'], ['Sparande', 'var(--s3)']].map(([n, f]) => { const i = el('i', { class: 'ruta' }); i.style.background = f; return el('span', {}, i, n); })),
    panel(ytan, el('div', { class: 'tabellram', style: 'margin-top:10px' }, el('table', {},
      el('tr', {}, ...['Månad', 'In', 'Ut', 'Spar', 'Kvar', 'Totalt'].map((h) => el('th', { text: h, class: h === 'Spar' ? 'smal-dold' : null }))),
      ...pr.map((x) => {
        const r = el('tr', {}, el('td', { text: manadKortAr(x.manad) }), el('td', { text: tal(Math.round(x.inkomster), 0) }), el('td', { text: tal(Math.round(x.utgifter), 0) }),
          el('td', { class: 'smal-dold', text: tal(Math.round(x.sparande + x.avsattningar), 0) }), el('td', { class: klass(x.kvar), text: tecken(x.kvar) }), el('td', { class: klass(x.kumulativt), text: tecken(x.kumulativt) }));
        r.style.cursor = 'pointer';
        r.addEventListener('click', () => { t.budgetManad = x.manad; rendera(); });
        return r;
      }))),
    el('p', { class: 'pytte ter', style: 'margin-top:8px', text: 'Belopp i kronor. Totalt = summan av alla överskott och underskott fram till och med månaden. Tryck på en månad för att se den.' }))));
  senare(() => staplarVertikala(ytan, { etiketter: pr.map((x) => x.manad), etikettFormat: manadKort, serier: [{ namn: 'Inkomster', farg: 'var(--s1)', varden: pr.map((x) => x.inkomster) }, { namn: 'Utgifter', farg: 'var(--s4)', varden: pr.map((x) => x.utgifter) }, { namn: 'Sparande', farg: 'var(--s3)', varden: pr.map((x) => x.sparande + x.avsattningar) }], format: kr, axelFormat: tkr, hojd: 220 }));

  // Poster i vald månad
  const postrad = (p) => {
    const frek = p.frekvens === 'manad' ? (p.start && p.start > B.idag() ? `varje månad från ${manadKortAr(B.manadNyckel(p.start))}` : 'varje månad') : p.frekvens === 'en-gang' ? `en gång ${dagMan(p.start)}` : `${FREKVENS_KORT[p.frekvens]}${p.start ? ` från ${manadKortAr(B.manadNyckel(p.start))}` : ''}`;
    const r = el('button', { type: 'button', class: 'rad' }, el('span', { class: 'namn', text: p.namn }), el('span', { class: `belopp ${p.typ === 'inkomst' ? 'vinst' : ''}`, text: kr(Number(p.belopp)) }),
      el('span', { class: 'under', text: `${p.kategori || 'Övrigt'} · ${frek}${p.slut ? ` till ${manadKortAr(B.manadNyckel(p.slut))}` : ''}` }));
    r.addEventListener('click', () => postForm(p));
    return r;
  };
  vy.append(el('div', { class: 'rutnat' },
    sektion(`Inkomster i ${manadBara(m)}`, null, el('div', { class: 'panel tat lista' }, ...(b.inkomstPoster.length ? b.inkomstPoster.map(postrad) : [el('p', { class: 'liten ter', style: 'padding:14px 0', text: 'Inga inkomster den här månaden.' })]))),
    sektion(`Utgifter i ${manadBara(m)}`, null, el('div', { class: 'panel tat lista' }, ...(b.utgiftPoster.length ? b.utgiftPoster.map(postrad) : [el('p', { class: 'liten ter', style: 'padding:14px 0', text: 'Inga utgifter den här månaden.' })])))));

  // Plan mot verklighet
  const fm = B.faktisktForManad(d, m);
  const kats = [...new Set([...Object.keys(b.perKategori), ...Object.keys(fm.perKategori)])];
  if (fm.antal && kats.length) {
    const max = Math.max(1, ...kats.flatMap((k) => [b.perKategori[k] || 0, fm.perKategori[k] || 0]));
    vy.append(sektion('Plan mot verklighet', null, panel(el('div', { class: 'katlista' }, ...kats.sort((a, c) => (fm.perKategori[c] || 0) - (fm.perKategori[a] || 0)).map((k) => {
      const planK = b.perKategori[k] || 0, fakt = fm.perKategori[k] || 0;
      return el('div', { class: 'katrad' }, el('span', { class: 'namn', text: k }), el('span', { class: `vardet ${planK && fakt > planK * 1.05 ? 'forlust' : ''}`, text: `${kr(fakt)} av ${planK ? kr(planK) : '–'}` }),
        spar(fakt / max, planK / max));
    })), el('p', { class: 'pytte ter', style: 'margin-top:10px', text: 'Mörk stapel = registrerat, ljus = planerat.' }))));
  }
  // Sparar ihop till
  const potter = B.sparpotter(d);
  if (potter.length) {
    vy.append(sektion('Sparar ihop till', null, el('div', { class: 'panel tat lista' }, ...potter.map((p) => el('div', { class: 'rad' },
      el('span', { class: 'namn', text: `${p.namn}${p.frekvens === 'ar' ? ' (varje år)' : ''}` }), el('span', { class: 'belopp', text: kr(Number(p.belopp)) }),
      el('div', { style: 'grid-column:1/-1' }, spar(p.andel)),
      el('span', { class: 'under', text: p.passerad ? `Datumet ${datum(p.nastaDatum)} har passerat.` : p.kvar > 0 ? `${datum(p.nastaDatum)} · ${kr(Number(p.sparat) || 0)} undanlagt · ${kr(p.perManad)} i månaden` : `${datum(p.nastaDatum)} · fullt undanlagt` }),
      el('div', { class: 'knapprad', style: 'grid-column:1/-1' },
        p.kvar > 0 ? knapp(`Lägg undan ${kr(Math.round(p.perManad))}`, () => andra((dd) => { const x = dd.poster.find((y) => y.id === p.id); x.sparat = (Number(x.sparat) || 0) + Math.round(p.perManad); }, { meddelande: `${kr(Math.round(p.perManad))} undanlagt till ${p.namn}.`, angraBar: true }), 'knapp liten') : null,
        knapp('Ändra', () => postForm(p), 'knapp liten')))))));
  }
  // Alla poster
  const alla = [...d.poster].sort((a, c) => (a.typ === c.typ ? (Number(c.belopp) || 0) - (Number(a.belopp) || 0) : a.typ === 'inkomst' ? -1 : 1));
  if (alla.length) vy.append(sektion('Alla planerade poster', null, el('details', { class: 'panel' }, el('summary', { text: `Visa alla ${alla.length}` }), el('div', { class: 'lista', style: 'margin-top:8px' }, ...alla.map(postrad)))));
}

// ---------- Trading ----------
function vyTrading(vy) {
  const d = t.data;
  const ar = B.idag().slice(0, 4);
  const perioder = { manad: [`${nuManad()}-01`, 'Månaden'], ar: [`${ar}-01-01`, `${ar}`], allt: ['0000-00-00', 'All tid'] };
  const [fran] = perioder[t.tradingPeriod];
  const st = B.tradingStatistik(d.affarer, { fran });
  const oppna = B.oppnaAffarer(d.affarer);
  vy.append(el('div', { class: 'sektionshuvud' }, segment(Object.entries(perioder).map(([k, [, n]]) => [k, n]), t.tradingPeriod, (v) => { t.tradingPeriod = v; rendera(); }),
    el('div', { class: 'knapprad' }, knapp('Avslutad affär', () => affarForm(), 'knapp liten'), knapp('Nytt köp', () => kopForm(), 'knapp liten huvud'))));
  const pf = st.profitFaktor === Infinity ? '∞' : st.profitFaktor == null ? '–' : tal(st.profitFaktor, 2);
  vy.append(nyckeltal([
    ['Resultat', krTecken(st.summa), st.antal ? `${st.antal} affärer` : 'inga avslutade', klass(st.summa)],
    ['Träffsäkerhet', proc(st.traffProc), st.antal ? `${st.vinster} vinster` : ''],
    ['Snitt per affär', krTecken(st.forvantat), 'förväntat resultat', klass(st.forvantat)],
    ['Avkastning på insats', procTecken(st.avkastningPaInsats), st.insatt ? `av ${kr(st.insatt)}` : '', klass(st.avkastningPaInsats)],
  ]));
  // Öppna köp
  vy.append(sektion(`Öppna köp${oppna.length ? ` (${oppna.length})` : ''}`, null, oppna.length
    ? el('div', { class: 'panel tat lista' }, ...oppna.map((a) => el('div', { class: 'rad' },
      el('span', { class: 'namn', text: `${a.instrument} · ${Number(a.riktning) === -1 ? 'kort' : 'lång'}` }), el('span', { class: 'belopp', text: kr(Number(a.insats)) }),
      el('span', { class: 'under', text: `Köpt ${dagMan(a.kopDatum)}${a.kalla === 'guldbot' ? ' · från Guldbot' : ''}` }),
      el('div', { class: 'knapprad', style: 'grid-column:1/-1' }, knapp('Sälj', () => saljForm(a), 'knapp liten huvud'), knapp('Ändra', () => kopForm(a), 'knapp liten')))))
    : tomRuta('Inga öppna köp. Tryck på Nytt köp när du köper, och på Sälj när du säljer – då räknas resultatet ut åt dig.', knapp('Nytt köp', () => kopForm(), 'knapp huvud'))));
  // Från Guldbot utan belopp
  const saknas = t.guldbotHistorik.filter((h) => h.id && !d.affarer.some((a) => a.posId === h.id));
  if (saknas.length) {
    vy.append(sektion('Sålda i Guldbot utan belopp', null, el('div', { class: 'panel tat lista' }, ...saknas.slice(0, 8).map((h) => el('div', { class: 'rad' },
      el('span', { class: 'namn', text: `${h.namn || h.instrument} · ${h.riktning === -1 ? 'kort' : 'lång'}` }), el('span', { class: `belopp ${klass(h.resultatProc)}`, text: h.resultatProc != null ? procTecken(h.resultatProc, 2) : '' }),
      el('span', { class: 'under', text: `Såld ${dagMan(new Date(h.utT || h.inT).toISOString().slice(0, 10))}` }),
      el('div', { class: 'knapprad', style: 'grid-column:1/-1' }, knapp('Lägg till belopp', () => affarForm({ datum: new Date(h.utT || Date.now()).toISOString().slice(0, 10), kopDatum: new Date(h.inT || Date.now()).toISOString().slice(0, 10), instrument: h.namn || h.instrument, riktning: h.riktning || 1, posId: h.id, kalla: 'guldbot', insats: tolkaTal(lager.hamta(`belopp.${h.id}`)) }), 'knapp liten')))))));
  }
  if (!st.antal) { if (!oppna.length) vy.append(tomRuta('Statistiken visas när du har avslutade affärer.')); return; }
  const svitText = st.svit ? `${st.svit} ${st.svitTyp === 'vinst' ? (st.svit === 1 ? 'vinst' : 'vinster') : (st.svit === 1 ? 'förlust' : 'förluster')} i rad` : '–';
  vy.append(sektion('Statistik', null, nyckeltal([
    ['Profit factor', pf, 'vinster delat med förluster'],
    ['Snittvinst', kr(st.snittVinst), '', 'vinst'], ['Snittförlust', kr(st.snittForlust), '', 'forlust'],
    ['Största vinst', krTecken(st.storstaVinst), '', 'vinst'], ['Största förlust', krTecken(st.storstaForlust), '', 'forlust'],
    ['Största nedgång', kr(-st.maxNedgang), 'från topp till botten'],
    ['Just nu', svitText, `längst: ${st.langstaVinstsvit} ${st.langstaVinstsvit === 1 ? 'vinst' : 'vinster'} och ${st.langstaForlustsvit} ${st.langstaForlustsvit === 1 ? 'förlust' : 'förluster'} i rad`],
    ['Snitt hålltid', st.snittHalltidDagar == null ? '–' : `${tal(st.snittHalltidDagar, st.snittHalltidDagar < 10 ? 1 : 0)} dagar`, 'från köp till sälj'],
    ['Lång', krTecken(st.lang.summa), `${st.lang.antal} affärer · ${proc(st.lang.traffProc)} träff`, klass(st.lang.summa)],
    ['Kort', krTecken(st.kort.summa), `${st.kort.antal} affärer · ${proc(st.kort.traffProc)} träff`, klass(st.kort.summa)],
  ])));
  if (st.kurva.length >= 2) {
    const yta = el('div', { class: 'diagram' });
    vy.append(sektion('Resultatkurva', null, panel(yta)));
    senare(() => linjediagram(yta, { serier: [{ namn: 'Resultat', kort: 'Resultat', farg: 'var(--s1)', punkter: [[Date.parse(st.kurva[0].datum) - 86400000, 0], ...st.kurva.map((p, i) => [Date.parse(p.datum) + i * 1000, p.summa])] }], xFormat: (x) => F.datum.format(new Date(x)), yFormat: krTecken, yAxelFormat: (v) => tal(avrunda(v), 0), tipsTitel: 'Resultatkurva', hojd: 210, nollLinje: true, fyllning: true, slutEtiketter: false }));
  }
  const alla = B.stangda(d.affarer);
  const forsta = B.manadNyckel(alla.map((a) => a.datum).sort()[0]);
  const manader = B.senasteManader(12).filter((x) => x >= forsta);
  const pm = B.tradingPerManad(d.affarer, manader);
  const fordel = B.resultatfordelning(st.resultat);
  const ytaM = el('div', { class: 'diagram' }), ytaF = el('div', { class: 'diagram' });
  vy.append(el('div', { class: 'rutnat' }, sektion('Per månad', null, panel(ytaM)), sektion('Fördelning av resultat', null, panel(ytaF, el('p', { class: 'pytte ter', style: 'margin-top:6px', text: 'Antal affärer per resultatintervall i kronor.' })))));
  senare(() => {
    staplarVertikala(ytaM, { etiketter: pm.map((x) => x.manad), etikettFormat: manadKort, serier: [{ namn: 'Resultat', farg: (v) => (v >= 0 ? 'var(--vinst)' : 'var(--forlust)'), varden: pm.map((x) => x.summa) }], format: krTecken, axelFormat: (v) => tal(v, 0), hojd: 190 });
    staplarVertikala(ytaF, { etiketter: fordel.map((h) => h.fran), etikettFormat: (v) => tal(v, 0), serier: [{ namn: 'Affärer', farg: (v) => 'var(--s3)', varden: fordel.map((h) => h.antal) }], format: (v) => `${v} st`, axelFormat: (v) => tal(v, 0), hojd: 190 });
  });
  const per = B.tradingPerInstrument(alla.filter((a) => a.datum >= fran));
  if (per.length) {
    vy.append(sektion('Per instrument', null, panel(el('div', { class: 'tabellram' }, el('table', {}, el('tr', {}, ...['Instrument', 'Affärer', 'Träff', 'Resultat'].map((h) => el('th', { text: h }))),
      ...per.map((p) => el('tr', {}, el('td', { text: p.instrument }), el('td', { text: p.antal }), el('td', { text: proc(p.traffProc) }), el('td', { class: klass(p.summa), text: krTecken(p.summa) }))))))));
  }
  const lista = [...alla].sort((a, c) => c.datum.localeCompare(a.datum));
  vy.append(sektion('Avslutade affärer', null, el('div', { class: 'panel tat lista' }, ...lista.slice(0, 60).map((a) => {
    const n = B.netto(a);
    const r = el('button', { type: 'button', class: 'rad' }, el('span', { class: 'namn', text: `${a.instrument} · ${Number(a.riktning) === -1 ? 'kort' : 'lång'}` }),
      el('span', { class: `belopp ${klass(n)}`, text: krTecken(n) }),
      el('span', { class: 'under', text: `${dagMan(a.datum)}${a.insats ? ` · insats ${kr(Number(a.insats))} · ${procTecken((100 * n) / a.insats, 0)}` : ''}${a.kalla === 'guldbot' ? ' · Guldbot' : ''}` }));
    r.addEventListener('click', () => affarForm(a));
    return r;
  }))));
}

// ---------- Sparande ----------
function vySparande(vy) {
  const d = t.data;
  if (!d.konton.length) {
    vy.append(tomRuta('Lägg till dina konton: buffert, långsiktigt sparande, tradingkapital och pension. Uppdatera värdet då och då, så räknas avkastningen ut.', knapp('Lägg till konto', () => kontoForm(), 'knapp huvud')));
    return;
  }
  const tot = d.konton.reduce((s, k) => { const u = B.kontoUtveckling(k, d); return { v: s.v + u.varde, i: s.i + u.insatt }; }, { v: 0, i: 0 });
  vy.append(el('div', { class: 'sektionshuvud' }, el('span'), el('div', { class: 'knapprad' }, knapp('Insättning', () => insattningForm(), 'knapp liten'), knapp('Lägg till konto', () => kontoForm(), 'knapp liten huvud'))));
  vy.append(nyckeltal([
    ['Totalt', kr(tot.v)], ['Insatt', kr(tot.i), 'startvärden plus insättningar'],
    ['Avkastning', krTecken(tot.v - tot.i), tot.i > 0 ? procTecken((100 * (tot.v - tot.i)) / tot.i) : '', klass(tot.v - tot.i)],
    ['Månadssparande', kr(B.planeratSparande(d)), 'enligt plan'],
  ]));
  // Fördelning och sparplan
  const sp = B.sparplan(d, inst());
  const fd = sp.fordelning;
  const I = inst();
  vy.append(el('div', { class: 'rutnat' },
    sektion('Fördelning', null, panel(fordelningsstapel(fd), el('div', { class: 'lista', style: 'margin-top:8px' },
      el('div', { class: 'rad' }, el('span', { class: 'namn', text: 'Buffert' }), el('span', { class: 'belopp', text: kr(fd.per.buffert) }), el('span', { class: 'under', text: sp.bufferManaderNu != null ? `räcker ${tal(sp.bufferManaderNu, 1)} månader · mål ${I.bufferManader}` : '' })),
      el('div', { class: 'rad' }, el('span', { class: 'namn', text: 'Långsiktigt' }), el('span', { class: 'belopp', text: kr(fd.per.langsiktigt) }), el('span', { class: 'under', text: fd.investerat ? `${Math.round((100 * fd.per.langsiktigt) / fd.investerat)} % av investeringarna` : '' })),
      el('div', { class: 'rad' }, el('span', { class: 'namn', text: 'Trading (hög risk)' }), el('span', { class: 'belopp', text: kr(fd.per.trading) }), el('span', { class: `under ${fd.hogriskAndel > I.hogriskMax ? 'forlust' : ''}`, text: fd.hogriskAndel != null ? `${Math.round(fd.hogriskAndel)} % av investeringarna · gräns ${I.hogriskMax} %` : '' }))))),
    sektion('Sparplan enligt dina mål', null, panel(
      el('p', { class: 'liten sek', text: `Så skulle ditt månadssparande på ${kr(sp.total)} kunna fördelas: halva till bufferten tills den räcker ${I.bufferManader} månader, högst ${I.hogriskMax} % av resten till högrisk och resten långsiktigt.` }),
      el('div', { class: 'katlista', style: 'margin-top:12px' }, ...[['Buffert', sp.tillBuffert, sp.bufferBrist > 0 ? `full om ${sp.bufferFullOm} mån` : 'bufferten är full'], ['Högrisk', sp.tillHogrisk, ''], ['Långsiktigt', sp.tillLangsiktigt, `${I.langsiktigAvkastning} %/år ≈ ${kr(Math.round(B.slutvarde(0, sp.tillLangsiktigt, I.langsiktigAvkastning, 240) / 1000) * 1000)} om 20 år`]]
        .map(([n, v, not]) => el('div', { class: 'katrad' }, el('span', { class: 'namn', text: n }), el('span', { class: 'vardet', text: `${kr(v)}/mån` }), spar(sp.total ? v / sp.total : 0), not ? el('span', { class: 'not', text: not }) : null))),
      el('div', { class: 'knapprad', style: 'margin-top:12px' }, knapp('Ändra mål', tipsMalForm, 'knapp liten'))))));
  // Konton
  for (const typ of Object.keys(B.KONTOTYPER)) {
    const konton = d.konton.filter((k) => k.typ === typ);
    if (!konton.length) continue;
    vy.append(sektion(B.KONTOTYPER[typ], null, el('div', { class: 'panel tat lista' }, ...konton.map((k) => {
      const u = B.kontoUtveckling(k, d);
      const r = el('button', { type: 'button', class: 'rad' }, el('span', { class: 'namn', text: k.namn }), el('span', { class: 'belopp', text: kr(u.varde) }),
        el('span', { class: 'under' }, u.proc == null ? '' : el('span', { class: klass(u.avkastning), text: `${krTecken(u.avkastning)} (${procTecken(u.proc)})` }), `${u.proc == null ? '' : ' · '}${k.manadssparande ? `${kr(k.manadssparande)}/mån` : 'inget månadssparande'}${k.avkastning ? ` · antar ${proc(Number(k.avkastning), 1)}/år` : ''}`));
      r.addEventListener('click', () => kontoArk(k));
      return r;
    }))));
  }
  const serie = B.formogenhetsserie(d);
  if (serie.length >= 2) {
    const yta = el('div', { class: 'diagram' });
    vy.append(sektion('Förmögenheten över tid', null, panel(el('div', { class: 'legend', style: 'margin-bottom:6px' }, ...[['Värde', 'var(--s1)'], ['Insatt', 'var(--s2)']].map(([n, f]) => { const i = el('i'); i.style.background = f; return el('span', {}, i, n); })), yta)));
    senare(() => linjediagram(yta, { serier: [{ namn: 'Värde', kort: 'Värde', farg: 'var(--s1)', punkter: serie.map((p) => [Date.parse(p.datum), p.varde]) }, { namn: 'Insatt', kort: 'Insatt', farg: 'var(--s2)', punkter: serie.map((p) => [Date.parse(p.datum), p.insatt]) }], xFormat: (x) => manadKortAr(new Date(x).toISOString().slice(0, 7)), yFormat: kr, yAxelFormat: (v) => `${tal(v / 1000, 0)} tkr`, tipsTitel: 'Förmögenhet', hojd: 230, fyllning: true }));
  }
}

// ---------- Mål och kalkylator ----------
function vyMal(vy) {
  const d = t.data;
  vy.append(el('div', { class: 'sektionshuvud' }, el('span'), knapp('Lägg till mål', () => malForm(), 'knapp liten huvud')));
  vy.append(d.mal.length ? el('div', { class: 'panel tat lista' }, ...d.mal.map((mal) => {
    const p = B.malPrognos(mal, d);
    return el('div', { class: 'rad', style: 'gap:8px 12px' },
      el('span', { class: 'namn', text: mal.namn }), el('span', { class: 'belopp', text: kr(mal.belopp) }),
      el('div', { style: 'grid-column:1/-1' }, spar(p.andelNu, p.prognosAndel)),
      el('span', { class: `under ${p.iFas ? 'vinst' : ''}`, text: p.iFas ? `I fas: ${kr(p.nuvarande)} nu, ${kr(p.manadssparande)}/mån och ${proc(p.avkastning, 1)}/år räcker – nås ${datum(p.nasDatum)}.` : `${kr(p.nuvarande)} nu. Prognos ${kr(p.prognos)} (${Math.round(100 * p.prognosAndel)} %) ${datum(mal.datum)}. Spara ${kr(p.kravSpar)}/mån eller få ${p.kravAvk == null ? 'över 200 %' : proc(p.kravAvk, 1)}/år för att nå målet.` }),
      el('div', { class: 'knapprad', style: 'grid-column:1/-1' }, knapp('Ändra', () => malForm(mal), 'knapp liten'), knapp('Räkna på det', () => {
        Object.assign(t.kalkyl, { start: Math.round(p.nuvarande), spar: Math.round(p.manadssparande), avk: Math.round(p.avkastning * 10) / 10, ar: Math.round(Math.max(0.5, p.manader / 12) * 10) / 10, mal: mal.belopp });
        rendera(); setTimeout(() => $('kalkylatorn')?.scrollIntoView({ behavior: 'smooth' }), 50);
      }, 'knapp liten')));
  })) : tomRuta('Sätt ett mål, till exempel en kontantinsats, en resa eller ett visst belopp i tradingkapital. Koppla det till ett konto så räknas framstegen automatiskt.'));
  vy.append(kalkylator());
  senare(ritaKalkyl);
}

function kalkylator() {
  const k = t.kalkyl;
  const falt = (id, etikett, varde) => el('label', { class: 'falt' }, etikett, el('input', { id, inputmode: 'decimal', value: String(varde) }));
  const vanster = el('div', { style: 'display:grid; gap:12px; align-content:start' },
    el('div', { class: 'tva' }, falt('kStart', 'Startbelopp (kr)', k.start), falt('kSpar', 'Per månad (kr)', k.spar)),
    el('div', { class: 'tva' }, falt('kAvk', 'Avkastning (% per år)', k.avk), falt('kAr', 'Tid (år)', k.ar)),
    el('div', { class: 'val' }, ...[['Försiktigt 4 %', 4], ['Index 7 %', 7], ['Hög risk 12 %', 12]].map(([n, a]) => { const b = el('button', { type: 'button' }, n); b.addEventListener('click', () => { $('kAvk').value = a; lasKalkyl(); }); return b; })),
    falt('kMal', 'Målbelopp (valfritt, kr)', k.mal));
  const hoger = el('div', { style: 'display:grid; gap:8px; align-content:start' },
    el('span', { class: 'sek liten', id: 'kRubrik' }), el('div', { id: 'kResultat', style: 'font-size:clamp(34px,8vw,46px); font-weight:800; letter-spacing:-0.03em; line-height:1.05' }),
    el('span', { class: 'liten sek', id: 'kDelning' }), el('div', { id: 'kKrav', class: 'liten', style: 'display:grid; gap:4px' }), el('div', { class: 'diagram', id: 'kDiagram' }));
  const s = sektion('Kalkylator: ränta på ränta', null, panel(el('div', { style: 'display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))' }, vanster, hoger)));
  s.id = 'kalkylatorn';
  s.addEventListener('input', (e) => { if (e.target.matches('input')) lasKalkyl(); });
  return s;
}
function lasKalkyl() {
  const k = t.kalkyl;
  k.start = tolkaTal($('kStart').value) ?? 0; k.spar = tolkaTal($('kSpar').value) ?? 0; k.avk = tolkaTal($('kAvk').value) ?? 0;
  k.ar = Math.min(80, Math.max(0, tolkaTal($('kAr').value) ?? 0)); k.mal = tolkaTal($('kMal').value) ?? '';
  ritaKalkyl();
}
function ritaKalkyl() {
  if (!$('kResultat')) return;
  const k = t.kalkyl;
  const n = Math.round(k.ar * 12);
  const serie = B.sparserie(k.start, k.spar, k.avk, n);
  const slut = serie.at(-1);
  $('kRubrik').textContent = `Om ${tal(k.ar, k.ar % 1 ? 1 : 0)} år har du`;
  $('kResultat').textContent = kr(slut.varde);
  $('kDelning').textContent = `${kr(slut.insatt)} insatt och ${kr(slut.varde - slut.insatt)} i avkastning`;
  const krav = $('kKrav');
  krav.replaceChildren();
  if (k.mal) {
    const b = (x) => el('b', { text: x });
    if (slut.varde >= k.mal) {
      const m = B.manaderTill(k.mal, k.start, k.spar, k.avk);
      krav.append(el('p', {}, 'Du når ', b(kr(k.mal)), ' efter ', b(m < 12 ? `${m} månader` : `${tal(m / 12, 1)} år`), '.'));
    } else {
      const sk = B.kravManadsspar(k.mal, k.start, k.avk, n), ak = B.kravAvkastning(k.mal, k.start, k.spar, n), m = B.manaderTill(k.mal, k.start, k.spar, k.avk);
      krav.append(el('p', {}, `För att nå ${kr(k.mal)} på ${tal(k.ar, k.ar % 1 ? 1 : 0)} år:`), el('p', {}, 'spara ', b(`${kr(sk)}/mån`), ` med ${proc(k.avk, 1)},`), el('p', {}, 'eller få ', b(ak == null ? 'över 200 %' : `${proc(ak, 1)}/år`), ` med ${kr(k.spar)}/mån,`), el('p', {}, 'eller vänta ', b(m == null ? 'över 100 år' : `${tal(m / 12, 1)} år`), '.'));
    }
  }
  linjediagram($('kDiagram'), { serier: [{ namn: 'Värde', kort: 'Värde', farg: 'var(--s1)', punkter: serie.map((p) => [p.manad, p.varde]) }, { namn: 'Insatt', kort: 'Insatt', farg: 'var(--s2)', punkter: serie.map((p) => [p.manad, p.insatt]) }],
    xFormat: (x) => (x < 12 ? `${Math.round(x)} mån` : `år ${tal(x / 12, x % 12 ? 1 : 0)}`), yFormat: kr, yAxelFormat: (v) => (v >= 1e6 ? `${tal(v / 1e6, 1)} mkr` : `${tal(v / 1000, 0)} tkr`), tipsTitel: 'Sparande över tid', refLinjer: k.mal ? [{ y: k.mal, etikett: 'Mål' }] : [], hojd: 200, fyllning: true, slutEtiketter: false });
}

// ---------- Tips ----------
function vyTips(vy) {
  const lista = B.tips(t.data, inst());
  const I = inst();
  vy.append(panel(el('p', { class: 'sek', text: `Tipsen bygger på dina siffror och dina mål: buffert för ${I.bufferManader} månaders utgifter, minst ${I.sparkvotMal} % av inkomsten till sparande och högst ${I.hogriskMax} % av investeringarna i högrisk. Det är vanliga tumregler – ändra dem så att de passar dig.` }),
    el('div', { class: 'knapprad', style: 'margin-top:12px' }, knapp('Ändra mina mål', tipsMalForm, 'knapp liten'))));
  if (!lista.length) { vy.append(tomRuta('Lägg in budget, konton och utgifter så kommer tips här.')); return; }
  const grupper = [['varning', 'Viktigast'], ['tips', 'Att se över'], ['bra', 'Det här går bra']];
  for (const [niva, rubrik] of grupper) {
    const g = lista.filter((x) => x.niva === niva);
    if (g.length) vy.append(sektion(rubrik, null, el('div', { class: 'tips-lista' }, ...g.map(tipskort))));
  }
  vy.append(sektion('Långsiktigt och kortsiktigt', null, panel(el('div', { style: 'display:grid; gap:10px', class: 'liten sek' },
    el('p', { text: 'Långsiktigt sparande (till exempel breda indexfonder) får tid att växa med ränta på ränta och tål svängningar. Högrisk som trading kan ge snabba vinster men också snabba förluster, och resultatet beror på dig och marknaden.' }),
    el('p', { text: `En vanlig ordning är: först en buffert, sedan ett regelbundet långsiktigt sparande, och bara en mindre del – pengar du klarar dig utan – i högrisk. Din gräns för högrisk är ${I.hogriskMax} % av investeringarna.` }),
    el('p', { text: 'Ett bra mål för det långsiktiga är ett fast belopp varje månad som dras automatiskt. Ett bra mål för tradingen är en gräns för hur mycket tradingkapitalet får sjunka innan du pausar och ser över strategin.' })))));
}

// ---------- Inställningar ----------
function vyInstallningar(vy) {
  const I = inst();
  let text; const knappar = [];
  if (!gh.aktiv()) { text = 'Uppgifterna sparas bara i den här webbläsaren. Lägg in din GitHub-nyckel på marknadssidan (Inställningar) för att kunna synka krypterat mellan dina enheter.'; knappar.push(el('a', { class: 'knapp', href: 'index.html', text: 'Till marknadssidan' })); }
  else if (t.lage === 'kan-synka') { text = 'Uppgifterna sparas bara i den här webbläsaren. Slå på synk för att spara dem krypterat i ditt repo och nå dem från alla enheter.'; knappar.push(knapp('Slå på krypterad synk', synkForm, 'knapp huvud')); }
  else { text = 'Uppgifterna sparas krypterat i ditt repo och synkas mellan dina enheter. Utan lösenfrasen går filen inte att läsa.'; knappar.push(knapp('Byt lösenfras', synkForm), knapp('Lås på den här enheten', () => { lokal.glomLosen(); lokal.rensa(); t.losen = ''; t.data = tomEkonomi(); visaLast(); })); }
  vy.append(sektion('Lagring och synk', null, panel(el('p', { class: 'sek', text }), el('div', { class: 'knapprad', style: 'margin-top:12px' }, ...knappar))));
  vy.append(sektion('Mål för tipsen', knapp('Ändra', tipsMalForm, 'knapp liten'), nyckeltal([
    ['Buffert', `${I.bufferManader} mån`, 'av dina utgifter'], ['Sparkvot', `${I.sparkvotMal} %`, 'av inkomsten'], ['Högrisk högst', `${I.hogriskMax} %`, 'av investeringarna'], ['Långsiktig avkastning', `${I.langsiktigAvkastning} %`, 'antagen per år'],
  ])));
  const regler = t.data.regler || [];
  vy.append(sektion('Kategoriregler', null, regler.length ? el('div', { class: 'panel tat lista' }, ...regler.map((r) => el('div', { class: 'rad' }, el('span', { class: 'namn', text: `”${r.monster}”` }), knapp('Ta bort', () => andra((d) => { d.regler = d.regler.filter((x) => x !== r && x.monster !== r.monster); }, { meddelande: 'Regeln är borttagen.', angraBar: true }), 'knapp liten fara'), el('span', { class: 'under', text: `→ ${r.kategori}` }))))
    : el('p', { class: 'liten ter', text: 'När du ändrar kategori på en transaktion kan du välja att samma text alltid ska få den kategorin. Reglerna visas här.' })));
  const fil = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fil.addEventListener('change', async () => {
    const f = fil.files[0]; if (!f) return;
    try { const d = normalisera(JSON.parse(await f.text())); bekrafta(`Ersätta allt med säkerhetskopian (${d.konton.length} konton, ${d.transaktioner.length} transaktioner)?`, 'Ersätt', () => andra((dd) => Object.assign(dd, d), { meddelande: 'Säkerhetskopian är inläst.', angraBar: true })); }
    catch { visaMeddelande('Filen kunde inte läsas som en säkerhetskopia.', 'fel'); }
  });
  vy.append(sektion('Säkerhetskopia', null, panel(el('p', { class: 'sek liten', text: 'Kopian är en vanlig JSON-fil och inte krypterad. Spara den på ett säkert ställe – glömmer du lösenfrasen är kopian enda vägen tillbaka.' }),
    el('div', { class: 'knapprad', style: 'margin-top:12px' }, knapp('Ladda ner säkerhetskopia', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(t.data, null, 1)], { type: 'application/json' }));
      const a = el('a', { href: url, download: `guldbot-ekonomi-${B.idag()}.json` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }), knapp('Läs in säkerhetskopia', () => fil.click()), fil))));
  vy.append(sektion('Exempeldata och rensning', null, el('div', { class: 'knapprad' }, knapp('Fyll i exempeldata', fyllExempel), knapp('Rensa allt', () => bekrafta('Ta bort alla konton, affärer, poster, transaktioner och mål?', 'Rensa allt', () => andra((d) => Object.assign(d, tomEkonomi()), { meddelande: 'Allt är rensat.', angraBar: true })), 'knapp fara'))));
}

function vyMer(vy) {
  vy.append(el('div', { class: 'panel tat lista' }, ...['sparande', 'mal', 'tips', 'installningar'].map((id) => {
    const a = el('a', { href: `#${id}`, class: 'rad', style: 'text-decoration:none' }, el('span', { class: 'namn', style: 'display:flex; gap:12px; align-items:center' }, ikon(VYER[id].ikon), VYER[id].namn), el('span', { class: 'belopp ter', text: '›' }));
    a.querySelector('svg').style.cssText = 'width:22px;height:22px;color:var(--skog)';
    return a;
  }), el('a', { href: 'index.html', class: 'rad', style: 'text-decoration:none' }, el('span', { class: 'namn', text: 'Marknaderna (Guldbot)' }), el('span', { class: 'belopp ter', text: '›' }))));
}

// ---------- Ark och formulär ----------
function oppnaArk(...innehall) {
  const ark = $('ark');
  ark.replaceChildren(el('div', { class: 'innehall' }, el('div', { class: 'handtag', 'aria-hidden': 'true' }), ...innehall));
  if (!ark.open) ark.showModal();
  return ark;
}
$('ark').addEventListener('click', (e) => { if (e.target === $('ark')) $('ark').close(); });

function snabbmeny() {
  const val = [['Utgift', 'minus', () => utgiftForm()], ['Inkomst', 'plus', () => inkomstForm()], ['Köp', 'kop', () => kopForm()], ['Sälj', 'salj', () => valjSalj()], ['Insättning', 'bank', () => insattningForm()], ['Planera', 'planera', () => postForm()]];
  oppnaArk(el('h2', { text: 'Lägg till' }), el('div', { class: 'snabbmeny' }, ...val.map(([n, ik, gor]) => { const b = el('button', { type: 'button' }, ikon(ik), n); b.addEventListener('click', gor); return b; })),
    el('button', { type: 'button', class: 'knapp', style: 'justify-self:start', onclick: null }, ikon('import'), 'Importera kontoutdrag'));
  $('ark').querySelector('.innehall > button.knapp').addEventListener('click', importArk);
}

function valjSalj() {
  const oppna = B.oppnaAffarer(t.data.affarer);
  if (!oppna.length) { affarForm(); return; }
  oppnaArk(el('h2', { text: 'Vad sålde du?' }), el('div', { class: 'lista' }, ...oppna.map((a) => {
    const b = el('button', { type: 'button', class: 'rad' }, el('span', { class: 'namn', text: `${a.instrument} · ${Number(a.riktning) === -1 ? 'kort' : 'lång'}` }), el('span', { class: 'belopp', text: kr(Number(a.insats)) }), el('span', { class: 'under', text: `Köpt ${dagMan(a.kopDatum)}` }));
    b.addEventListener('click', () => saljForm(a));
    return b;
  })), knapp('Något annat (avslutad affär)', () => affarForm(), 'knapp'));
}

// Formulärbyggare. falt: { id, typ, etikett, val, std, krav, hjalp, halv, platshallare, visa(v), lista }
function formular({ titel, falt, varden = {}, spara, tabort = null, text = null, sparaText = 'Spara', vidAndring = null }) {
  const form = el('form', { novalidate: '' });
  const kontroller = {};
  const rader = [];
  let par = null;
  const lasVarden = () => {
    const ut = {};
    for (const [id, { f, inp }] of Object.entries(kontroller)) {
      if (f.typ === 'tal' || f.typ === 'belopp') ut[id] = tolkaTal(inp.value);
      else if (f.typ === 'kryss') ut[id] = inp.checked;
      else if (f.typ === 'chips' || f.typ === 'segment') ut[id] = inp.dataset.varde ?? '';
      else if (f.typ === 'flerval') ut[id] = [...inp.querySelectorAll('input:checked')].map((x) => x.value);
      else ut[id] = inp.value.trim();
    }
    return ut;
  };
  const uppdatera = () => {
    const v = lasVarden();
    for (const { f, rad } of Object.values(kontroller)) if (f.visa) rad.hidden = !f.visa(v);
    if (vidAndring) vidAndring(v, kontroller);
  };
  for (const f of falt) {
    const v = varden[f.id] ?? f.std ?? '';
    let inp;
    if (f.typ === 'val') inp = el('select', {}, ...f.val.map(([vv, tt]) => el('option', { value: vv, selected: String(vv) === String(v) ? '' : null }, tt)));
    else if (f.typ === 'kryss') inp = el('input', { type: 'checkbox', checked: v ? '' : null });
    else if (f.typ === 'chips' || f.typ === 'segment') {
      inp = el('div', { class: f.typ === 'segment' ? 'segment' : 'val', role: 'group', 'aria-label': f.etikett });
      inp.dataset.varde = String(v);
      for (const [vv, tt] of f.val) {
        const b = el('button', { type: 'button', 'aria-pressed': String(String(vv) === String(v)) }, tt);
        b.addEventListener('click', () => { inp.dataset.varde = String(vv); inp.dataset.vald = '1'; inp.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); uppdatera(); });
        inp.append(b);
      }
    } else if (f.typ === 'flerval') inp = el('div', { style: 'display:grid; gap:8px' }, ...f.val.map(([vv, tt]) => el('label', { class: 'kryss' }, el('input', { type: 'checkbox', value: vv, checked: (v || []).includes(vv) ? '' : null }), tt)));
    else {
      const typ = f.typ === 'datum' ? 'date' : f.typ === 'manad' ? 'month' : 'text';
      inp = el('input', { type: typ, inputmode: f.typ === 'tal' || f.typ === 'belopp' ? 'decimal' : null, value: v == null ? '' : String(v), placeholder: f.platshallare || null, list: f.lista ? `lista-${f.id}` : null, autocomplete: 'off', enterkeyhint: 'done' });
      inp.addEventListener('input', uppdatera);
    }
    if (f.typ === 'val' || f.typ === 'kryss') inp.addEventListener('change', uppdatera);
    const grupp = f.typ === 'chips' || f.typ === 'segment' || f.typ === 'flerval';
    const etikett = f.typ === 'kryss' ? el('label', { class: 'kryss' }, inp, f.etikett)
      : el(grupp ? 'div' : 'label', { class: `falt ${f.typ === 'belopp' ? 'beloppfalt' : ''}` }, grupp ? el('span', { text: f.etikett }) : f.etikett, inp, f.hjalp ? el('span', { class: 'hjalp', text: f.hjalp }) : null, f.lista ? el('datalist', { id: `lista-${f.id}` }, ...f.lista.map((x) => el('option', { value: x }))) : null);
    kontroller[f.id] = { f, inp, rad: etikett };
    if (f.halv) { if (par) { par.append(etikett); rader.push(par); par = null; } else par = el('div', { class: 'tva' }, etikett); }
    else { if (par) { rader.push(par); par = null; } rader.push(etikett); }
  }
  if (par) rader.push(par);
  const fel = el('p', { class: 'felrad', hidden: '' });
  form.append(...[el('div', { class: 'handtag', 'aria-hidden': 'true' }), el('h2', { text: titel }), text ? el('p', { class: 'liten sek', text }) : null, ...rader, fel,
    el('div', { class: 'arkknappar' }, tabort ? knapp('Ta bort', () => { $('ark').close(); tabort(); }, 'knapp fara') : el('span'),
      el('div', { class: 'hoger' }, knapp('Avbryt', () => $('ark').close(), 'knapp'), el('button', { type: 'submit', class: 'knapp huvud' }, sparaText)))].filter(Boolean));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = lasVarden();
    for (const { f, inp, rad } of Object.values(kontroller)) {
      if (rad.hidden) continue;
      if (f.krav && (v[f.id] == null || v[f.id] === '')) { fel.hidden = false; fel.textContent = `Fyll i ${f.etikett.toLowerCase().replace(/ \(.*\)$/, '')}.`; inp.focus?.(); return; }
    }
    const svar = spara(v);
    if (typeof svar === 'string') { fel.hidden = false; fel.textContent = svar; return; }
    $('ark').close();
  });
  const ark = $('ark');
  ark.replaceChildren(form);
  if (!ark.open) ark.showModal();
  uppdatera();
  const forsta = form.querySelector('.beloppfalt input') || form.querySelector('input:not([type=checkbox])');
  if (forsta && window.matchMedia('(min-width: 700px)').matches) forsta.focus();
  return { form, kontroller };
}

function bekrafta(text, knapptext, gor) {
  oppnaArk(el('h2', { text: 'Är du säker?' }), el('p', { class: 'sek', text }),
    el('div', { class: 'arkknappar' }, el('span'), el('div', { class: 'hoger' }, knapp('Avbryt', () => $('ark').close()), knapp(knapptext, () => { $('ark').close(); gor(); }, 'knapp huvud'))));
}

const KATVAL_UT = B.UTGIFTSKATEGORIER.map((k) => [k, k]);
const KATVAL_IN = B.INKOMSTKATEGORIER.map((k) => [k, k]);

function transaktionsformular(x, typ) {
  const ny = !x?.id;
  const utgift = typ === 'utgift';
  const textmonster = (s) => String(s || '').trim().toLowerCase();
  formular({
    titel: ny ? (utgift ? 'Ny utgift' : 'Ny inkomst') : (utgift ? 'Ändra utgift' : 'Ändra inkomst'),
    falt: [
      { id: 'belopp', typ: 'belopp', etikett: 'Belopp (kr)', krav: true, platshallare: '0' },
      { id: 'text', typ: 'text', etikett: utgift ? 'Vad (valfritt)' : 'Från (valfritt)', platshallare: utgift ? 't.ex. ICA, Spotify, hyra' : 't.ex. lön, CSN, Swish' },
      { id: 'kategori', typ: 'chips', etikett: 'Kategori', val: utgift ? KATVAL_UT : KATVAL_IN, std: x?.kategori || 'Övrigt' },
      { id: 'datum', typ: 'datum', etikett: 'Datum', std: B.idag() },
      ...(!ny ? [{ id: 'regel', typ: 'kryss', etikett: 'Använd kategorin för alla med samma text', visa: (v) => v.text && v.kategori !== x.kategori }] : []),
    ],
    varden: x ? { ...x, belopp: x.belopp != null ? Math.abs(x.belopp) : '' } : {},
    sparaText: ny ? (utgift ? 'Spara utgift' : 'Spara inkomst') : 'Spara',
    vidAndring: (v, k) => {
      const chips = k.kategori.inp;
      if (ny && !chips.dataset.vald && v.text) {
        const g = B.gissaKategori(v.text, utgift ? -1 : 1, t.data.regler);
        chips.dataset.varde = g;
        chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === g)));
      }
    },
    spara: (v) => {
      if (!v.belopp) return 'Fyll i ett belopp.';
      const belopp = (utgift ? -1 : 1) * Math.abs(v.belopp);
      andra((d) => {
        if (ny) d.transaktioner.push({ id: nyttId('t'), datum: v.datum || B.idag(), belopp, text: v.text, kategori: v.kategori || 'Övrigt', kalla: 'manuell' });
        else Object.assign(d.transaktioner.find((y) => y.id === x.id), { datum: v.datum, belopp, text: v.text, kategori: v.kategori });
        if (v.regel && v.text) {
          const m = textmonster(v.text);
          d.regler = [...d.regler.filter((r) => r.monster !== m), { monster: m, kategori: v.kategori }];
          for (const y of d.transaktioner) if (textmonster(y.text).includes(m) && Math.sign(y.belopp) === Math.sign(belopp)) y.kategori = v.kategori;
        }
      }, { meddelande: ny ? `${utgift ? 'Utgift' : 'Inkomst'} på ${kr(Math.abs(belopp))} sparad.` : 'Sparat.', angraBar: true });
    },
    tabort: ny ? null : () => andra((d) => { d.transaktioner = d.transaktioner.filter((y) => y.id !== x.id); }, { meddelande: 'Borttaget.', angraBar: true }),
  });
}
const utgiftForm = (x) => transaktionsformular(x, 'utgift');
const inkomstForm = (x) => transaktionsformular(x, 'inkomst');

function postForm(p = {}) {
  const ny = !p.id;
  const typ = p.typ || 'utgift';
  const forslagStart = B.idag();
  formular({
    titel: ny ? 'Planera inkomst eller utgift' : `Ändra ${p.namn}`,
    text: ny ? 'Allt som kommer in eller går ut – en gång eller återkommande. Till exempel ett bidrag i januari eller en hyra som börjar i januari.' : null,
    falt: [
      { id: 'typ', typ: 'segment', etikett: 'Typ', val: [['inkomst', 'Inkomst'], ['utgift', 'Utgift']], std: typ },
      { id: 'namn', typ: 'text', etikett: 'Namn', krav: true, platshallare: 't.ex. Hyra, Lön, Utbytesbidrag' },
      { id: 'belopp', typ: 'belopp', etikett: 'Belopp (kr)', krav: true, platshallare: '0' },
      { id: 'frekvens', typ: 'segment', etikett: 'Hur ofta', val: [['en-gang', 'En gång'], ['manad', 'Varje månad'], ['kvartal', 'Kvartal'], ['ar', 'Varje år']], std: p.frekvens || 'manad' },
      { id: 'startDatum', typ: 'datum', etikett: 'Datum', visa: (v) => v.frekvens === 'en-gang' || v.frekvens === 'ar', std: p.start || forslagStart },
      { id: 'startManad', typ: 'manad', etikett: 'Från och med (valfritt)', visa: (v) => v.frekvens === 'manad' || v.frekvens === 'kvartal', std: p.start ? B.manadNyckel(p.start) : '', halv: true, hjalp: 'Tomt = redan nu' },
      { id: 'slutManad', typ: 'manad', etikett: 'Till och med (valfritt)', visa: (v) => v.frekvens !== 'en-gang', std: p.slut ? B.manadNyckel(p.slut) : '', halv: true, hjalp: 'Tomt = tills vidare' },
      { id: 'kategoriUt', typ: 'val', etikett: 'Kategori', val: KATVAL_UT, std: p.typ !== 'inkomst' ? p.kategori || 'Boende' : 'Boende', visa: (v) => v.typ === 'utgift' },
      { id: 'kategoriIn', typ: 'val', etikett: 'Kategori', val: KATVAL_IN, std: p.typ === 'inkomst' ? p.kategori || 'Lön' : 'Lön', visa: (v) => v.typ === 'inkomst' },
      { id: 'sparaIhop', typ: 'kryss', etikett: 'Spara ihop till den månad för månad', std: p.sparaIhop, visa: (v) => v.typ === 'utgift' && (v.frekvens === 'en-gang' || v.frekvens === 'ar') },
      { id: 'sparat', typ: 'tal', etikett: 'Redan undanlagt (kr)', std: p.sparat, visa: (v) => v.typ === 'utgift' && v.sparaIhop && (v.frekvens === 'en-gang' || v.frekvens === 'ar') },
    ],
    varden: { ...p },
    sparaText: ny ? 'Lägg till' : 'Spara',
    spara: (v) => {
      if (!v.belopp || v.belopp <= 0) return 'Fyll i ett belopp större än noll.';
      const start = v.frekvens === 'en-gang' || v.frekvens === 'ar' ? v.startDatum : v.startManad ? `${v.startManad}-01` : null;
      if ((v.frekvens === 'en-gang' || v.frekvens === 'ar') && !start) return 'Välj ett datum.';
      const slut = v.frekvens !== 'en-gang' && v.slutManad ? B.manadSlut(v.slutManad) : null;
      if (slut && start && slut < start) return 'Slutet ligger före starten.';
      const post = { typ: v.typ, namn: v.namn, belopp: Math.abs(v.belopp), frekvens: v.frekvens, start, slut, kategori: v.typ === 'inkomst' ? v.kategoriIn : v.kategoriUt,
        sparaIhop: v.typ === 'utgift' && (v.frekvens === 'en-gang' || v.frekvens === 'ar') && v.sparaIhop, sparat: v.sparat || 0 };
      andra((d) => { if (ny) d.poster.push({ id: nyttId('p'), ...post }); else Object.assign(d.poster.find((x) => x.id === p.id), post); },
        { meddelande: ny ? `${post.namn} är inlagd i budgeten.` : 'Sparat.', angraBar: true });
    },
    tabort: ny ? null : () => andra((d) => { d.poster = d.poster.filter((x) => x.id !== p.id); }, { meddelande: `${p.namn} är borttagen.`, angraBar: true }),
  });
}

const instrumentForslag = () => [...new Set([...t.data.affarer.map((a) => a.instrument).filter(Boolean), 'Guld', 'Silver', 'Olja (Brent)', 'OMXS30', 'DAX', 'S&P 500', 'Nasdaq 100', 'Bitcoin', 'Ethereum', 'Nvidia', 'Tesla'])];
const investeringskonton = () => t.data.konton.filter((k) => k.typ === 'trading' || k.typ === 'langsiktigt' || k.typ === 'annat');

function kopForm(a = null) {
  const ny = !a?.id;
  const konton = investeringskonton();
  formular({
    titel: ny ? 'Nytt köp' : 'Ändra köp',
    text: ny ? 'Registrera köpet nu, och tryck på Sälj när du säljer. Då räknas resultatet ut och hamnar på kontot.' : null,
    falt: [
      { id: 'instrument', typ: 'text', etikett: 'Vad köpte du?', krav: true, platshallare: 't.ex. Guld, Volvo B, Turbo L Guld', lista: instrumentForslag() },
      { id: 'riktning', typ: 'segment', etikett: 'Riktning', val: [['1', 'Lång'], ['-1', 'Kort']], std: a ? String(a.riktning || 1) : '1' },
      { id: 'insats', typ: 'belopp', etikett: 'Insats (kr)', krav: true, platshallare: '0' },
      { id: 'kopDatum', typ: 'datum', etikett: 'Datum', std: B.idag(), halv: konton.length > 1 },
      ...(konton.length > 1 ? [{ id: 'kontoId', typ: 'val', etikett: 'Konto', val: konton.map((k) => [k.id, k.namn]), std: a?.kontoId || B.tradingkonto(t.data)?.id || konton[0].id, halv: true }] : []),
      { id: 'anteckning', typ: 'text', etikett: 'Anteckning (valfri)', platshallare: 'Varför köpte du?' },
    ],
    varden: a ? { ...a, riktning: String(a.riktning || 1) } : {},
    sparaText: ny ? 'Spara köp' : 'Spara',
    spara: (v) => andra((d) => {
      const rad = { instrument: v.instrument, riktning: Number(v.riktning), insats: v.insats, kopDatum: v.kopDatum || B.idag(), kontoId: v.kontoId || null, anteckning: v.anteckning };
      if (ny) d.affarer.push({ id: nyttId('a'), ...rad, oppen: true, resultat: null, datum: null, kalla: 'manuell' });
      else Object.assign(d.affarer.find((x) => x.id === a.id), rad);
    }, { meddelande: ny ? `Köp av ${v.instrument} sparat.` : 'Sparat.' }),
    tabort: ny ? null : () => andra((d) => { d.affarer = d.affarer.filter((x) => x.id !== a.id); }, { meddelande: 'Köpet är borttaget.', angraBar: true }),
  });
}

function saljForm(a) {
  formular({
    titel: `Sälj ${a.instrument}`,
    text: `Insats ${kr(Number(a.insats))}, köpt ${datum(a.kopDatum)}`,
    falt: [
      { id: 'tillbaka', typ: 'belopp', etikett: 'Vad fick du tillbaka? (kr)', krav: true, platshallare: '0' },
      { id: 'avgift', typ: 'tal', etikett: 'Courtage (valfritt)', halv: true },
      { id: 'datum', typ: 'datum', etikett: 'Datum', std: B.idag(), halv: true },
    ],
    sparaText: 'Spara försäljning',
    vidAndring: (v) => {
      const n = v.tillbaka != null ? v.tillbaka - Number(a.insats) - (v.avgift || 0) : null;
      const p = $('ark').querySelector('.felrad');
      if (n != null && p) { p.hidden = false; p.style.color = n >= 0 ? 'var(--vinst)' : 'var(--forlust)'; p.textContent = `Resultat ${krTecken(n)} (${procTecken((100 * n) / Number(a.insats), 1)})`; }
    },
    spara: (v) => {
      const resultat = v.tillbaka - Number(a.insats);
      andra((d) => Object.assign(d.affarer.find((x) => x.id === a.id), { oppen: false, datum: v.datum || B.idag(), resultat, avgift: v.avgift || 0 }),
        { meddelande: `${a.instrument} såld: ${krTecken(resultat - (v.avgift || 0))}.`, angraBar: true });
    },
  });
}

function affarForm(a = {}) {
  const ny = !a.id;
  const konton = investeringskonton();
  formular({
    titel: ny ? 'Avslutad affär' : 'Ändra affär',
    text: 'Resultat = vad du fick tillbaka minus insatsen (negativt vid förlust).',
    falt: [
      { id: 'instrument', typ: 'text', etikett: 'Instrument', krav: true, lista: instrumentForslag(), platshallare: 't.ex. Guld' },
      { id: 'riktning', typ: 'segment', etikett: 'Riktning', val: [['1', 'Lång'], ['-1', 'Kort']], std: '1' },
      { id: 'insats', typ: 'tal', etikett: 'Insats (kr)', halv: true },
      { id: 'resultat', typ: 'tal', etikett: 'Resultat (kr)', krav: true, halv: true, platshallare: 't.ex. 450 eller −300' },
      { id: 'kopDatum', typ: 'datum', etikett: 'Köpt', halv: true },
      { id: 'datum', typ: 'datum', etikett: 'Såld', std: B.idag(), halv: true },
      { id: 'avgift', typ: 'tal', etikett: 'Courtage (valfritt)', halv: konton.length > 1 },
      ...(konton.length > 1 ? [{ id: 'kontoId', typ: 'val', etikett: 'Konto', val: konton.map((k) => [k.id, k.namn]), std: a.kontoId || B.tradingkonto(t.data)?.id || konton[0].id, halv: true }] : []),
      { id: 'anteckning', typ: 'text', etikett: 'Anteckning (valfri)', platshallare: 'Vad gick bra eller dåligt?' },
    ],
    varden: { ...a, riktning: a.riktning != null ? String(a.riktning) : '1' },
    spara: (v) => andra((d) => {
      const rad = { instrument: v.instrument, riktning: Number(v.riktning), insats: v.insats, resultat: v.resultat, avgift: v.avgift || 0, kopDatum: v.kopDatum || null, datum: v.datum || B.idag(), kontoId: v.kontoId || null, anteckning: v.anteckning, oppen: false };
      if (ny) d.affarer.push({ id: nyttId('a'), kalla: a.kalla || 'manuell', posId: a.posId, ...rad });
      else Object.assign(d.affarer.find((x) => x.id === a.id), rad);
    }, { meddelande: ny ? 'Affären är sparad.' : 'Sparat.', angraBar: true }),
    tabort: ny ? null : () => andra((d) => { d.affarer = d.affarer.filter((x) => x.id !== a.id); }, { meddelande: 'Affären är borttagen.', angraBar: true }),
  });
}

function insattningForm(konto = null) {
  if (!t.data.konton.length) { kontoForm(); return; }
  formular({
    titel: 'Insättning eller uttag',
    falt: [
      { id: 'riktning', typ: 'segment', etikett: 'Typ', val: [['in', 'Insättning'], ['ut', 'Uttag']], std: 'in' },
      { id: 'belopp', typ: 'belopp', etikett: 'Belopp (kr)', krav: true, platshallare: '0' },
      { id: 'kontoId', typ: 'val', etikett: 'Konto', val: t.data.konton.map((k) => [k.id, k.namn]), std: konto?.id || t.data.konton[0].id, halv: true },
      { id: 'datum', typ: 'datum', etikett: 'Datum', std: B.idag(), halv: true },
    ],
    varden: { belopp: konto?.manadssparande || '' },
    spara: (v) => andra((d) => d.konton.find((k) => k.id === v.kontoId).transaktioner.push({ id: nyttId('t'), datum: v.datum || B.idag(), belopp: (v.riktning === 'ut' ? -1 : 1) * Math.abs(v.belopp) }),
      { meddelande: `${v.riktning === 'ut' ? 'Uttag' : 'Insättning'} på ${kr(v.belopp)} registrerad.`, angraBar: true }),
  });
}

function kontoForm(k = null) {
  const ny = !k?.id;
  formular({
    titel: ny ? 'Nytt konto' : `Ändra ${k.namn}`,
    falt: [
      { id: 'namn', typ: 'text', etikett: 'Namn', krav: true, platshallare: 't.ex. ISK, Sparkonto, Trading' },
      { id: 'typ', typ: 'chips', etikett: 'Typ', val: Object.entries(B.KONTOTYPER), std: k?.typ || 'langsiktigt' },
      ...(ny ? [{ id: 'varde', typ: 'tal', etikett: 'Värde idag (kr)', krav: true, halv: true }, { id: 'datum', typ: 'datum', etikett: 'Datum', std: B.idag(), halv: true }] : []),
      { id: 'manadssparande', typ: 'tal', etikett: 'Sparar per månad (kr)', halv: true },
      { id: 'avkastning', typ: 'tal', etikett: 'Antagen avkastning (%/år)', halv: true, hjalp: 'För prognoser' },
    ],
    varden: { ...k },
    spara: (v) => {
      if (v.typ === 'trading' && t.data.konton.some((x) => x.typ === 'trading' && x.id !== k?.id)) return 'Det finns redan ett tradingkonto. Välj typen Annat för fler.';
      andra((d) => {
        if (ny) d.konton.push({ id: nyttId('k'), namn: v.namn, typ: v.typ, manadssparande: v.manadssparande || 0, avkastning: v.avkastning, varden: [{ datum: v.datum || B.idag(), varde: v.varde }], transaktioner: [] });
        else Object.assign(d.konton.find((x) => x.id === k.id), { namn: v.namn, typ: v.typ, manadssparande: v.manadssparande || 0, avkastning: v.avkastning });
      }, { meddelande: ny ? `${v.namn} är tillagt.` : 'Sparat.' });
    },
    tabort: ny ? null : () => andra((d) => { d.konton = d.konton.filter((x) => x.id !== k.id); d.mal.forEach((m) => { m.kontoIds = (m.kontoIds || []).filter((id) => id !== k.id); }); }, { meddelande: `${k.namn} är borttaget.`, angraBar: true }),
  });
}

function kontoArk(k) {
  const u = B.kontoUtveckling(k, t.data);
  const historik = [
    ...(k.varden || []).map((x) => ({ datum: x.datum, text: `Värde ${kr(Number(x.varde))}`, typ: 'v', id: x.datum })),
    ...(k.transaktioner || []).map((x) => ({ datum: x.datum, text: `${x.belopp >= 0 ? 'Insättning' : 'Uttag'} ${kr(Math.abs(x.belopp))}`, typ: 't', id: x.id })),
  ].sort((a, b) => b.datum.localeCompare(a.datum));
  oppnaArk(el('h2', { text: k.namn }),
    el('div', { style: 'font-size:34px; font-weight:800; letter-spacing:-0.02em', text: kr(u.varde) }),
    el('p', { class: `liten ${klass(u.avkastning)}`, text: u.proc == null ? '' : `${krTecken(u.avkastning)} (${procTecken(u.proc)}) sedan ${datum(u.sedan)}` }),
    el('div', { class: 'knapprad' }, knapp('Uppdatera värde', () => vardeForm(k), 'knapp huvud'), knapp('Insättning/uttag', () => insattningForm(k)), knapp('Ändra konto', () => kontoForm(k))),
    historik.length ? el('div', { class: 'lista' }, ...historik.slice(0, 30).map((h) => el('div', { class: 'rad' }, el('span', { class: 'namn', style: 'font-weight:500', text: h.text }),
      knapp('Ta bort', () => { $('ark').close(); andra((d) => { const kk = d.konton.find((x) => x.id === k.id); if (h.typ === 'v') kk.varden = kk.varden.filter((x) => x.datum !== h.id); else kk.transaktioner = kk.transaktioner.filter((x) => x.id !== h.id); }, { meddelande: 'Borttaget.', angraBar: true }); }, 'knapp liten fara'),
      el('span', { class: 'under', text: datum(h.datum) })))) : null);
}

function vardeForm(k) {
  formular({
    titel: `Uppdatera värde: ${k.namn}`,
    text: 'Skriv in vad kontot är värt enligt banken. Insättningar och resultat efter datumet räknas på automatiskt.',
    falt: [{ id: 'varde', typ: 'belopp', etikett: 'Värde (kr)', krav: true }, { id: 'datum', typ: 'datum', etikett: 'Datum', std: B.idag() }],
    varden: { varde: Math.round(B.kontoVarde(k, t.data)) },
    spara: (v) => andra((d) => { const kk = d.konton.find((x) => x.id === k.id); kk.varden = kk.varden.filter((x) => x.datum !== v.datum); kk.varden.push({ datum: v.datum || B.idag(), varde: v.varde }); }, { meddelande: 'Värdet är uppdaterat.', angraBar: true }),
  });
}

function malForm(m = null) {
  const ny = !m;
  formular({
    titel: ny ? 'Nytt mål' : `Ändra ${m.namn}`,
    falt: [
      { id: 'namn', typ: 'text', etikett: 'Namn', krav: true, platshallare: 't.ex. Kontantinsats' },
      { id: 'belopp', typ: 'belopp', etikett: 'Belopp (kr)', krav: true },
      { id: 'datum', typ: 'datum', etikett: 'När', krav: true, std: B.laggTillManader(B.idag(), 36) },
      ...(t.data.konton.length ? [{ id: 'kontoIds', typ: 'flerval', etikett: 'Konton som sparar till målet', val: t.data.konton.map((k) => [k.id, k.namn]) }] : []),
      { id: 'sparat', typ: 'tal', etikett: 'Redan sparat (om inget konto är valt)', halv: true },
      { id: 'manadssparande', typ: 'tal', etikett: 'Per månad (valfritt)', halv: true, hjalp: 'Tomt = kontonas sparande' },
      { id: 'avkastning', typ: 'tal', etikett: 'Avkastning %/år (valfritt)', hjalp: 'Tomt = kontonas antagna avkastning' },
    ],
    varden: { ...m },
    spara: (v) => andra((d) => { if (ny) d.mal.push({ id: nyttId('m'), ...v }); else Object.assign(d.mal.find((x) => x.id === m.id), v); }, { meddelande: 'Sparat.' }),
    tabort: ny ? null : () => andra((d) => { d.mal = d.mal.filter((x) => x.id !== m.id); }, { meddelande: 'Målet är borttaget.', angraBar: true }),
  });
}

function tipsMalForm() {
  formular({
    titel: 'Mina mål för tipsen',
    text: 'Vanliga tumregler är en buffert på 3–6 månaders utgifter och att spara minst 10–15 % av inkomsten. Välj det som passar dig.',
    falt: [
      { id: 'bufferManader', typ: 'tal', etikett: 'Buffert (månader av utgifterna)', halv: true },
      { id: 'sparkvotMal', typ: 'tal', etikett: 'Sparkvot (% av inkomsten)', halv: true },
      { id: 'hogriskMax', typ: 'tal', etikett: 'Högst i högrisk (% av investeringarna)', halv: true },
      { id: 'langsiktigAvkastning', typ: 'tal', etikett: 'Antagen långsiktig avkastning (%/år)', halv: true },
    ],
    varden: inst(),
    spara: (v) => andra((d) => { d.installningar = { ...d.installningar, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x != null && x >= 0)) }; }, { meddelande: 'Dina mål är sparade.' }),
  });
}

function synkForm() {
  const { kontroller } = formular({
    titel: t.lage === 'synk' ? 'Byt lösenfras' : 'Slå på krypterad synk',
    text: 'Välj en lång lösenfras som du kommer ihåg, gärna fyra–fem ord. Den sparas aldrig i repot. Glömmer du den går uppgifterna inte att öppna.',
    falt: [{ id: 'losen', typ: 'text', etikett: 'Lösenfras', krav: true }, { id: 'igen', typ: 'text', etikett: 'Samma lösenfras igen', krav: true }, { id: 'komIhag', typ: 'kryss', etikett: 'Kom ihåg på den här enheten', std: true }],
    spara: (v) => {
      if (v.losen.length < 10) return 'Lösenfrasen måste vara minst 10 tecken.';
      if (v.losen !== v.igen) return 'Lösenfraserna är inte lika.';
      (async () => {
        try {
          satSynk('Krypterar …', 'sparar');
          t.losen = v.losen; t.salt = null; t.data.uppdaterad = new Date().toISOString();
          const k = await sparaMoln(gh, t.data, t.losen, null);
          t.salt = k.salt; lokal.sparaLosen(v.losen, v.komIhag); t.lage = 'synk';
          satSynk(`Synkad ${F.klocka.format(new Date())}`, 'ok'); notis('Krypterad synk är på.'); rendera();
        } catch (e) { visaMeddelande(`Kunde inte spara i GitHub: ${e.message}`, 'fel'); uppdateraSynkstatus(); }
      })();
    },
  });
  for (const id of ['losen', 'igen']) { kontroller[id].inp.type = 'password'; kontroller[id].inp.autocomplete = 'new-password'; }
}

// ---------- Import av kontoutdrag ----------
function importArk() {
  const text = el('textarea', { rows: 6, placeholder: 'Klistra in rader från internetbanken här, eller välj en CSV-fil nedan.', style: 'width:100%; min-height:130px; padding:12px; border:1.5px solid var(--yta-3); border-radius:12px; background:var(--papper); font-size:14px; font-family:inherit' });
  const fil = el('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain' });
  const forhands = el('div');
  const stat = { tolkad: null, kol: null };
  const tolka = (rad) => {
    stat.tolkad = B.tolkaCsv(rad);
    if (!stat.tolkad.rader.length) { forhands.replaceChildren(el('p', { class: 'felrad', text: 'Hittade inga rader. Kontrollera att texten innehåller datum och belopp.' })); return; }
    stat.kol = B.gissaKolumner(stat.tolkad.rubrik, stat.tolkad.rader);
    visaForhands();
  };
  const visaForhands = () => {
    const { rubrik, rader } = stat.tolkad;
    const bredd = Math.max(...rader.slice(0, 20).map((r) => r.length));
    const namn = (i) => rubrik?.[i] || `Kolumn ${i + 1}`;
    const valj = (nyckel, etikett) => {
      const s = el('select', {}, el('option', { value: '-1' }, '–'), ...Array.from({ length: bredd }, (_, i) => el('option', { value: String(i), selected: stat.kol[nyckel] === i ? '' : null }, namn(i))));
      s.addEventListener('change', () => { stat.kol[nyckel] = Number(s.value); visaForhands(); });
      return el('label', { class: 'falt' }, etikett, s);
    };
    const res = B.importeraRader(rader, stat.kol, t.data.regler, t.data.transaktioner);
    const prov = res.nya.slice(0, 6);
    forhands.replaceChildren(...[
      el('div', { style: 'display:grid; gap:10px; grid-template-columns:repeat(3,minmax(0,1fr))' }, valj('datum', 'Datum'), valj('belopp', 'Belopp'), valj('text', 'Text')),
      el('p', { class: 'liten sek', text: `${res.nya.length} nya transaktioner${res.dubbletter ? `, ${res.dubbletter} redan inlagda` : ''}${res.ogiltiga ? `, ${res.ogiltiga} rader utan datum eller belopp hoppas över` : ''}.` }),
      prov.length ? el('div', { class: 'lista' }, ...prov.map((x) => el('div', { class: 'rad' }, el('span', { class: 'namn', text: x.text || '–' }), el('span', { class: `belopp ${x.belopp > 0 ? 'vinst' : ''}`, text: `${x.belopp > 0 ? '+' : '−'}${kr(Math.abs(x.belopp))}` }), el('span', { class: 'under', text: `${x.kategori} · ${dagMan(x.datum)}` })))) : null,
      res.nya.length ? knapp(`Importera ${res.nya.length} transaktioner`, () => {
        $('ark').close();
        andra((d) => { for (const x of res.nya) d.transaktioner.push({ id: nyttId('t'), ...x }); }, { meddelande: `${res.nya.length} transaktioner importerade. Tryck på en rad för att ändra kategori.`, angraBar: true });
        location.hash = 'utgifter';
      }, 'knapp huvud') : null].filter(Boolean));
  };
  text.addEventListener('input', () => tolka(text.value));
  fil.addEventListener('change', async () => {
    const f = fil.files[0]; if (!f) return;
    const buf = await f.arrayBuffer();
    let s = new TextDecoder('utf-8').decode(buf);
    if (s.includes('�')) s = new TextDecoder('windows-1252').decode(buf);
    text.value = s.slice(0, 200000);
    tolka(s);
  });
  oppnaArk(el('h2', { text: 'Importera kontoutdrag' }),
    el('p', { class: 'liten sek', text: 'Exportera transaktionerna som CSV från din bank, eller markera tabellen i internetbanken och klistra in. Datum, belopp och text hittas automatiskt, och varje rad får en kategori. Rader som redan finns hoppas över.' }),
    text, el('label', { class: 'falt' }, 'Eller välj en fil', fil), forhands,
    el('div', { class: 'arkknappar' }, el('span'), el('div', { class: 'hoger' }, knapp('Stäng', () => $('ark').close()))));
}

// ---------- Exempeldata ----------
function fyllExempel() {
  const idag = B.idag();
  const m = (n) => B.laggTillManader(idag, n);
  let fro = 7;
  const slump = () => { fro = (fro * 1664525 + 1013904223) % 4294967296; return fro / 4294967296; };
  const tx = [];
  const lagg = (datum, belopp, text, kategori) => { if (datum <= idag) tx.push({ id: nyttId('t'), datum, belopp, text, kategori, kalla: 'exempel' }); };
  for (let k = -3; k <= 0; k++) {
    const man = B.manadNyckel(m(k));
    const dag = (n) => `${man}-${String(Math.min(n, B.dagarIManad(man))).padStart(2, '0')}`;
    lagg(dag(25), 12000, 'Lön', 'Lön'); lagg(dag(20), 5500, 'Extrajobb', 'Lön');
    lagg(dag(28), -5200, 'Hyra', 'Boende'); lagg(dag(2), -129, 'Spotify', 'Abonnemang'); lagg(dag(4), -119, 'Netflix', 'Abonnemang'); lagg(dag(10), -249, 'Telia', 'Abonnemang'); lagg(dag(1), -349, 'Sats', 'Hälsa och träning');
    for (let i = 0; i < 11; i++) lagg(dag(1 + Math.floor(slump() * 28)), -Math.round(90 + slump() * 380), ['ICA Supermarket', 'Willys', 'Coop', 'Lidl'][i % 4], 'Mat och dagligvaror');
    for (let i = 0; i < 5; i++) lagg(dag(1 + Math.floor(slump() * 28)), -Math.round(70 + slump() * 260), ['Espresso House', 'Max', 'Foodora', 'Restaurang'][i % 4], 'Restaurang och café');
    for (let i = 0; i < 3; i++) lagg(dag(1 + Math.floor(slump() * 28)), -Math.round(40 + slump() * 200), ['Ultra buss', 'Circle K', 'Voi'][i % 3], 'Transport');
    for (let i = 0; i < 2; i++) lagg(dag(1 + Math.floor(slump() * 28)), -Math.round(150 + slump() * 450), ['Bio', 'Konsertbiljett'][i % 2], 'Nöje och fritid');
    if (k % 2 === 0) lagg(dag(14), -Math.round(400 + slump() * 700), 'Zalando', 'Kläder och shopping');
  }
  const ex = normalisera({
    version: 2,
    konton: [
      { id: 'k1', namn: 'ISK – indexfonder', typ: 'langsiktigt', manadssparande: 2000, avkastning: 7, varden: [{ datum: m(-12), varde: 42000 }, { datum: m(-6), varde: 61000 }, { datum: m(-1), varde: 76500 }], transaktioner: [-5, -4, -3, -2, -1, 0].map((n) => ({ id: `ti${n}`, datum: m(n), belopp: 2000 })) },
      { id: 'k2', namn: 'Trading', typ: 'trading', manadssparande: 500, avkastning: 0, varden: [{ datum: m(-4), varde: 15000 }], transaktioner: [-3, -2, -1, 0].map((n) => ({ id: `tt${n}`, datum: m(n), belopp: 500 })) },
      { id: 'k3', namn: 'Sparkonto buffert', typ: 'buffert', manadssparande: 1000, avkastning: 2.5, varden: [{ datum: m(-8), varde: 12000 }], transaktioner: [-3, -2, -1, 0].map((n) => ({ id: `tb${n}`, datum: m(n), belopp: 1000 })) },
    ],
    affarer: [
      ['Guld', 1, 2000, 640], ['Silver', 1, 1500, -310], ['DAX', -1, 2000, 420], ['Guld', 1, 2500, -500], ['Nvidia', 1, 2000, 880], ['Guld', -1, 2000, 260],
      ['OMXS30', 1, 1500, -180], ['Bitcoin', 1, 1000, 350], ['Guld', 1, 3000, 950], ['EUR/USD', -1, 1500, -220], ['Silver', 1, 2000, 410], ['Guld', 1, 2500, -340],
    ].map(([instrument, riktning, insats, resultat], i) => {
      const salj = Date.now() - (11 - i) * 9 * 86400000;
      const datum = new Date(salj).toISOString().slice(0, 10);
      const kopDatum = new Date(salj - (1 + (i % 3)) * 86400000).toISOString().slice(0, 10);
      return { id: `ea${i}`, kopDatum, datum, instrument, riktning, insats, resultat, avgift: 0, kalla: 'exempel', oppen: false };
    }).concat([{ id: 'eo1', kopDatum: m(0), instrument: 'Guld', riktning: 1, insats: 2000, oppen: true, resultat: null, datum: null, kalla: 'exempel' }]),
    poster: [
      { id: 'p1', typ: 'inkomst', namn: 'Lön', belopp: 12000, kategori: 'Lön', frekvens: 'manad', start: null, slut: null },
      { id: 'p2', typ: 'inkomst', namn: 'Extrajobb', belopp: 5500, kategori: 'Lön', frekvens: 'manad', start: null, slut: null },
      { id: 'p3', typ: 'utgift', namn: 'Hyra', belopp: 5200, kategori: 'Boende', frekvens: 'manad', start: null, slut: null },
      { id: 'p4', typ: 'utgift', namn: 'Mat', belopp: 3200, kategori: 'Mat och dagligvaror', frekvens: 'manad', start: null, slut: null },
      { id: 'p5', typ: 'utgift', namn: 'Restaurang och café', belopp: 900, kategori: 'Restaurang och café', frekvens: 'manad', start: null, slut: null },
      { id: 'p6', typ: 'utgift', namn: 'Abonnemang', belopp: 500, kategori: 'Abonnemang', frekvens: 'manad', start: null, slut: null },
      { id: 'p7', typ: 'utgift', namn: 'Gym', belopp: 349, kategori: 'Hälsa och träning', frekvens: 'manad', start: null, slut: null },
      { id: 'p8', typ: 'utgift', namn: 'Transport', belopp: 400, kategori: 'Transport', frekvens: 'manad', start: null, slut: null },
      { id: 'p9', typ: 'inkomst', namn: 'Stipendium', belopp: 15000, kategori: 'Bidrag och stipendier', frekvens: 'en-gang', start: `${B.manadNyckel(m(2))}-15`, slut: null },
      { id: 'p10', typ: 'utgift', namn: 'Dyrare boende', belopp: 2800, kategori: 'Boende', frekvens: 'manad', start: `${B.manadNyckel(m(2))}-01`, slut: B.manadSlut(B.manadNyckel(m(7))) },
      { id: 'p11', typ: 'utgift', namn: 'Sommarresa', belopp: 9000, kategori: 'Resor', frekvens: 'en-gang', start: m(6), slut: null, sparaIhop: true, sparat: 2500 },
      { id: 'p12', typ: 'utgift', namn: 'Hemförsäkring', belopp: 1800, kategori: 'Boende', frekvens: 'ar', start: m(3), slut: null, sparaIhop: true, sparat: 600 },
    ],
    transaktioner: tx,
    mal: [
      { id: 'm1', namn: 'Kontantinsats', belopp: 250000, datum: m(48), kontoIds: ['k1'] },
      { id: 'm2', namn: 'Tradingkapital 30 000', belopp: 30000, datum: m(18), kontoIds: ['k2'] },
    ],
    installningar: {},
    exempel: true,
  });
  const gor = () => andra((d) => Object.assign(d, ex), { meddelande: 'Exempeldata ifylld. Rensa under Inställningar när du vill börja på riktigt.', angraBar: true });
  if (harNagot()) bekrafta('Exempeldata ersätter allt du har lagt in.', 'Ersätt', gor); else gor();
}

// ---------- Start ----------
starta();
