// Diagram för sidorna: linjediagram med hovring och tangentbord, legender och stapeldiagram.
import { tal } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, ...barn) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
  }
  for (const b of barn.flat()) if (b != null) e.append(b instanceof Node ? b : document.createTextNode(String(b)));
  return e;
}
function sv(tag, attrs = {}, forelder) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (forelder) forelder.appendChild(e);
  return e;
}

// ---------- Linjediagram ----------
// Antal decimaler som behövs för att visa ett axelsteg (0,25 → 2, 0,002 → 3, 50 → 0)
export function stegDecimaler(steg) {
  if (steg >= 1) return 0;
  return (String(Number(steg.toPrecision(2))).split('.')[1] || '').length;
}

function snyggaSteg(min, max, antal = 4) {
  const spann = max - min || 1;
  const grov = spann / antal;
  const mag = 10 ** Math.floor(Math.log10(grov));
  const steg = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= grov) || 10 * mag;
  const ut = [];
  for (let v = Math.ceil(min / steg) * steg; v <= max + 1e-9; v += steg) ut.push(Math.abs(v) < steg * 1e-6 ? 0 : v);
  return { varden: ut, steg };
}

function narmast(xs, x) {
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}

// serier: [{ namn, farg, punkter: [[x, y], ...] }]
export function linjediagram(yta, { serier, xFormat, tipsTitel, yFormat = (v) => tal(v), yAxelFormat = (v, steg) => tal(v, stegDecimaler(steg)), markorer = [], refLinjer = [], hojd = 300, nollLinje = false, fyllning = false, slutEtiketter = true }) {
  yta.replaceChildren();
  const bredd = Math.max(280, yta.clientWidth || 600);
  const visaSlutEtiketter = slutEtiketter && bredd >= 560;
  const m = { v: 56, h: visaSlutEtiketter ? 112 : 10, o: 10, n: 26 };
  const W = bredd - m.v - m.h, H = hojd - m.o - m.n;
  const allaX = [...new Set(serier.flatMap((s) => s.punkter.map((p) => p[0])))].sort((a, b) => a - b);
  if (!allaX.length) { yta.append(el('p', { class: 'small muted', text: 'Ingen data att visa ännu.' })); return; }
  const allaY = serier.flatMap((s) => s.punkter.map((p) => p[1])).concat(refLinjer.map((r) => r.y)).filter(Number.isFinite);
  if (nollLinje) allaY.push(0);
  let yMin = Math.min(...allaY), yMax = Math.max(...allaY);
  const pad = (yMax - yMin) * 0.06 || 1; yMin -= pad; yMax += pad;
  const xMin = allaX[0], xMax = allaX[allaX.length - 1] === xMin ? xMin + 1 : allaX[allaX.length - 1];
  const X = (x) => m.v + ((x - xMin) / (xMax - xMin)) * W;
  const Y = (y) => m.o + (1 - (y - yMin) / (yMax - yMin)) * H;

  const svg = sv('svg', { viewBox: `0 0 ${bredd} ${hojd}`, height: hojd, tabindex: 0, role: 'img', 'aria-label': tipsTitel });
  // Rutnät och y-axel
  const { varden, steg } = snyggaSteg(yMin, yMax, 4);
  for (const v of varden) {
    sv('line', { x1: m.v, x2: m.v + W, y1: Y(v), y2: Y(v), stroke: 'var(--grid)', 'stroke-width': 1 }, svg);
    const txt = sv('text', { x: m.v - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg); txt.textContent = yAxelFormat(v, steg);
  }
  if (nollLinje && yMin < 0 && yMax > 0) sv('line', { x1: m.v, x2: m.v + W, y1: Y(0), y2: Y(0), stroke: 'var(--axis)', 'stroke-width': 1 }, svg);
  sv('line', { x1: m.v, x2: m.v + W, y1: m.o + H, y2: m.o + H, stroke: 'var(--axis)', 'stroke-width': 1 }, svg);
  // x-etiketter
  const antalX = Math.max(2, Math.min(5, Math.floor(W / 110)));
  for (let k = 0; k <= antalX; k++) {
    const x = xMin + ((xMax - xMin) * k) / antalX;
    const txt = sv('text', { x: X(x), y: hojd - 6, 'text-anchor': k === 0 ? 'start' : k === antalX ? 'end' : 'middle' }, svg);
    txt.textContent = xFormat(allaX[narmast(allaX, x)]);
  }
  // Referenslinjer (stop/mål)
  for (const r of refLinjer) {
    if (!(r.y >= yMin && r.y <= yMax)) continue;
    sv('line', { x1: m.v, x2: m.v + W, y1: Y(r.y), y2: Y(r.y), stroke: 'var(--text-muted)', 'stroke-width': 1, 'stroke-dasharray': '4 4' }, svg);
    const txt = sv('text', { x: m.v + 4, y: Y(r.y) - 4 }, svg); txt.textContent = `${r.etikett} ${yFormat(r.y)}`;
  }
  // Fyllning under första serien
  if (fyllning && serier[0]) {
    const id = `fyll${Math.random().toString(36).slice(2, 8)}`;
    const defs = sv('defs', {}, svg);
    const g = sv('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    sv('stop', { offset: '0%', style: `stop-color:${serier[0].farg};stop-opacity:.28` }, g);
    sv('stop', { offset: '100%', style: `stop-color:${serier[0].farg};stop-opacity:0` }, g);
    const pts = serier[0].punkter.filter((q) => Number.isFinite(q[1]));
    if (pts.length > 1) {
      const d = pts.map((q, k) => `${k ? 'L' : 'M'}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join('') + `L${X(pts.at(-1)[0]).toFixed(1)},${m.o + H}L${X(pts[0][0]).toFixed(1)},${m.o + H}Z`;
      sv('path', { d, fill: `url(#${id})`, stroke: 'none' }, svg);
    }
  }
  // Linjer
  for (const s of serier) {
    const d = s.punkter.filter((p) => Number.isFinite(p[1])).map((p, k) => `${k ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    sv('path', { d, fill: 'none', stroke: s.farg, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  }
  // Slutetiketter (bara om de inte krockar; annars bär legenden namnen)
  if (visaSlutEtiketter) {
    const slut = serier.map((s) => { const p = s.punkter.filter((q) => Number.isFinite(q[1])).at(-1); return p && { s, y: Y(p[1]), x: X(p[0]), v: p[1] }; }).filter(Boolean).sort((a, b) => a.y - b.y);
    const krock = slut.some((e, k) => k && e.y - slut[k - 1].y < 14);
    for (const e of slut) {
      if (krock && e !== slut.find((q) => q.s === serier[0])) continue;
      const txt = sv('text', { x: e.x + 8, y: e.y + 4, class: 'etikett' }, svg); txt.textContent = `${e.s.kort || e.s.namn} ${yFormat(e.v)}`;
    }
  }
  // Markörer (affärer)
  for (const mk of markorer) {
    if (mk.x < xMin || mk.x > xMax) continue;
    const cx = X(mk.x), cy = Y(mk.y);
    if (mk.form === 'ring') {
      sv('circle', { cx, cy, r: 4, fill: 'var(--surface-1)', stroke: 'var(--text-primary)', 'stroke-width': 2 }, svg);
    } else {
      const u = mk.form === 'upp';
      const d = u ? `M${cx},${cy - 6}L${cx + 6},${cy + 5}L${cx - 6},${cy + 5}Z` : `M${cx},${cy + 6}L${cx + 6},${cy - 5}L${cx - 6},${cy - 5}Z`;
      sv('path', { d, fill: 'var(--text-primary)', stroke: 'var(--surface-1)', 'stroke-width': 2, 'paint-order': 'stroke' }, svg);
    }
  }
  // Hovringslager
  const kors = sv('line', { y1: m.o, y2: m.o + H, stroke: 'var(--axis)', 'stroke-width': 1, visibility: 'hidden' }, svg);
  const prickar = serier.map((s) => sv('circle', { r: 4, fill: s.farg, stroke: 'var(--surface-1)', 'stroke-width': 2, visibility: 'hidden' }, svg));
  const yta2 = sv('rect', { x: m.v, y: m.o, width: W, height: H, fill: 'transparent' }, svg);
  yta.append(svg);
  const tips = el('div', { class: 'tips' });
  yta.append(tips);
  let idx = allaX.length - 1;
  function visa(i) {
    idx = Math.max(0, Math.min(allaX.length - 1, i));
    const x = allaX[idx];
    kors.setAttribute('x1', X(x)); kors.setAttribute('x2', X(x)); kors.setAttribute('visibility', 'visible');
    const rader = [];
    serier.forEach((s, k) => {
      const xs = s.punkter.map((p) => p[0]);
      const j = narmast(xs, x);
      const p = s.punkter[j];
      if (!p || !Number.isFinite(p[1])) { prickar[k].setAttribute('visibility', 'hidden'); return; }
      prickar[k].setAttribute('cx', X(p[0])); prickar[k].setAttribute('cy', Y(p[1])); prickar[k].setAttribute('visibility', 'visible');
      const i2 = el('i'); i2.style.background = s.farg;
      rader.push(el('div', { class: 'rad' }, i2, el('span', { text: s.namn }), el('b', { text: yFormat(p[1]) })));
    });
    tips.replaceChildren(el('div', { class: 'rubrik', text: xFormat(x) }), ...rader);
    tips.style.display = 'block';
    const px = (X(x) / bredd) * yta.clientWidth;
    const tw = tips.offsetWidth;
    tips.style.left = `${px + 12 + tw > yta.clientWidth ? px - tw - 12 : px + 12}px`;
    tips.style.top = `${m.o}px`;
  }
  function gom() { kors.setAttribute('visibility', 'hidden'); prickar.forEach((p) => p.setAttribute('visibility', 'hidden')); tips.style.display = 'none'; }
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const xp = ((e.clientX - r.left) / r.width) * bredd;
    const xv = xMin + ((xp - m.v) / W) * (xMax - xMin);
    visa(narmast(allaX, xv));
  });
  svg.addEventListener('pointerleave', gom);
  svg.addEventListener('focus', () => visa(idx));
  svg.addEventListener('blur', gom);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { visa(idx - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { visa(idx + 1); e.preventDefault(); }
    else if (e.key === 'Escape') gom();
  });
  void yta2;
}

export function legend(mal, poster) {
  mal.replaceChildren(...poster.map((p) => {
    const i = el('i', { class: p.triangel ? 'triangel' : null });
    if (p.farg) i.style.background = p.farg;
    if (p.ring) Object.assign(i.style, { width: '8px', height: '8px', borderRadius: '50%', border: '2px solid var(--text-primary)', background: 'transparent' });
    return el('span', {}, i, p.namn);
  }));
}



// Stapeldiagram med positiva och negativa värden (t.ex. resultat per månad). Staplarna är HTML-rader för att skala på mobil.
export function stapeldiagram(yta, poster, { format = (v) => tal(v, 0), etikett = (p) => p.etikett } = {}) {
  const max = Math.max(1, ...poster.map((p) => Math.abs(p.varde)));
  const harNeg = poster.some((p) => p.varde < 0);
  yta.replaceChildren(el('div', { class: 'staplar' + (harNeg ? ' med-neg' : '') }, ...poster.map((p) => {
    const bredd = (100 * Math.abs(p.varde)) / max;
    const stapel = el('span', { class: `stapel ${p.varde >= 0 ? 'pos' : 'neg'}` });
    stapel.style.width = `${harNeg ? bredd / 2 : bredd}%`;
    if (harNeg) stapel.style[p.varde >= 0 ? 'left' : 'right'] = '50%';
    return el('div', { class: 'stapelrad', title: `${etikett(p)}: ${format(p.varde)}` },
      el('span', { class: 'stapeletikett', text: etikett(p) }),
      el('span', { class: 'stapelspar' }, stapel),
      el('span', { class: `stapelvarde ${p.varde > 0 ? 'upp' : p.varde < 0 ? 'ned' : 'muted'}`, text: p.varde === 0 && p.tom ? '–' : format(p.varde) }));
  })));
}

// Stående staplar per kategori (t.ex. månader), en eller flera serier bredvid varandra, med hovring.
export function staplarVertikala(yta, { etiketter, serier, format = (v) => tal(v, 0), axelFormat = (v) => tal(v, 0), hojd = 220, etikettFormat = (e) => e }) {
  yta.replaceChildren();
  const bredd = Math.max(280, yta.clientWidth || 600);
  const m = { v: 52, h: 8, o: 10, n: 24 };
  const W = bredd - m.v - m.h, H = hojd - m.o - m.n;
  const alla = serier.flatMap((s) => s.varden).filter(Number.isFinite);
  if (!alla.length) { yta.append(el('p', { class: 'small muted', text: 'Ingen data att visa ännu.' })); return; }
  let yMin = Math.min(0, ...alla), yMax = Math.max(0, ...alla);
  if (yMax === yMin) yMax = yMin + 1;
  const { varden, steg } = snyggaSteg(yMin, yMax, 4);
  yMin = Math.min(yMin, varden[0]); yMax = Math.max(yMax, varden.at(-1));
  const Y = (v) => m.o + (1 - (v - yMin) / (yMax - yMin)) * H;
  const svg = sv('svg', { viewBox: `0 0 ${bredd} ${hojd}`, height: hojd, role: 'img', tabindex: 0 });
  for (const v of varden) {
    sv('line', { x1: m.v, x2: m.v + W, y1: Y(v), y2: Y(v), stroke: v === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1 }, svg);
    const t = sv('text', { x: m.v - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg); t.textContent = axelFormat(v, steg);
  }
  const n = etiketter.length;
  const grupp = W / n;
  const gap = 2;
  const stapelBredd = Math.max(3, Math.min(28, (grupp * 0.72 - gap * (serier.length - 1)) / serier.length));
  const visaVarAnnan = grupp < 34;
  etiketter.forEach((e, i) => {
    const mitt = m.v + grupp * (i + 0.5);
    const total = stapelBredd * serier.length + gap * (serier.length - 1);
    serier.forEach((s, k) => {
      const v = s.varden[i];
      if (!Number.isFinite(v) || v === 0) return;
      const x = mitt - total / 2 + k * (stapelBredd + gap);
      const y0 = Y(0), y1 = Y(v);
      const h = Math.abs(y1 - y0);
      const topp = Math.min(y0, y1);
      const r = Math.min(4, stapelBredd / 2, h);
      // Rundade hörn bara i änden bort från nollinjen
      const d = v >= 0
        ? `M${x},${y0}V${topp + r}Q${x},${topp} ${x + r},${topp}H${x + stapelBredd - r}Q${x + stapelBredd},${topp} ${x + stapelBredd},${topp + r}V${y0}Z`
        : `M${x},${y0}V${topp + h - r}Q${x},${topp + h} ${x + r},${topp + h}H${x + stapelBredd - r}Q${x + stapelBredd},${topp + h} ${x + stapelBredd},${topp + h - r}V${y0}Z`;
      sv('path', { d, fill: typeof s.farg === 'function' ? s.farg(v) : s.farg }, svg);
    });
    if (!visaVarAnnan || i % 2 === n % 2 || i === n - 1) {
      const t = sv('text', { x: mitt, y: hojd - 6, 'text-anchor': 'middle' }, svg); t.textContent = etikettFormat(e);
    }
  });
  const markor = sv('rect', { y: m.o, height: H, width: grupp, fill: 'var(--grid)', opacity: 0.35, visibility: 'hidden' }, svg);
  svg.insertBefore(markor, svg.firstChild);
  yta.append(svg);
  const tips = el('div', { class: 'tips' });
  yta.append(tips);
  const visa = (i) => {
    i = Math.max(0, Math.min(n - 1, i));
    markor.setAttribute('x', m.v + grupp * i); markor.setAttribute('visibility', 'visible');
    tips.replaceChildren(el('div', { class: 'rubrik', text: etikettFormat(etiketter[i]) }), ...serier.map((s) => {
      const ikon = el('i'); ikon.style.background = typeof s.farg === 'function' ? s.farg(s.varden[i]) : s.farg; ikon.style.height = '8px'; ikon.style.borderRadius = '2px';
      return el('div', { class: 'rad' }, ikon, el('span', { text: s.namn }), el('b', { text: format(s.varden[i] || 0) }));
    }));
    tips.style.display = 'block';
    const px = ((m.v + grupp * (i + 0.5)) / bredd) * yta.clientWidth;
    const tw = tips.offsetWidth;
    tips.style.left = `${Math.max(0, Math.min(yta.clientWidth - tw, px - tw / 2))}px`;
    tips.style.top = `-8px`;
    visa.i = i;
  };
  const gom = () => { markor.setAttribute('visibility', 'hidden'); tips.style.display = 'none'; };
  svg.addEventListener('pointermove', (ev) => { const r = svg.getBoundingClientRect(); visa(Math.floor((((ev.clientX - r.left) / r.width) * bredd - m.v) / grupp)); });
  svg.addEventListener('pointerleave', gom);
  svg.addEventListener('focus', () => visa(n - 1));
  svg.addEventListener('blur', gom);
  svg.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowLeft') { visa((visa.i ?? n) - 1); ev.preventDefault(); } else if (ev.key === 'ArrowRight') { visa((visa.i ?? -1) + 1); ev.preventDefault(); } else if (ev.key === 'Escape') gom(); });
}
