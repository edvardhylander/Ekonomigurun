// Guldbotens analysmotor.
// Samma fil används av molnskriptet (Node, varje timme) och av dashboarden (webbläsaren, live-läge),
// så att signalerna alltid räknas fram på exakt samma sätt.
//
// Prisdata: en lista med staplar { t: millisekunder (UTC, stapelns start), o, h, l, c }, äldst först.
// Alla signaler bygger på STÄNGDA staplar – en stapel som fortfarande pågår ska tas bort innan analysen.

export const STANDARD = {
  emaSnabb: 9,
  emaLangsam: 21,
  emaTrend: 100,
  rsiLangd: 14,
  atrLangd: 14,
  adxLangd: 14,
  kanalLangd: 50,        // högsta/lägsta pris över så här många staplar (motstånd/stöd)
  kostnadProc: 0.04,     // antagen kostnad per affär tur och retur (spread m.m.), i % av guldpriset
  barriarMarginal: 1.25, // en turbos barriär ska ligga minst 25 % längre bort än stop-lossen
  uppvarmning: 120,      // staplar som går åt innan alla indikatorer är pålitliga
  setupAtr: 0.35,        // "möjligt läge på väg" när snabb och långsam EMA är så här nära (i ATR)
};

// De tre risknivåerna. Samma grundsignal (snabb EMA korsar långsam EMA), men olika krav, stop-avstånd och storlek.
export const NIVAER = {
  lag: {
    id: 'lag', namn: 'Låg risk',
    stopAtr: 2.0, malR: 2,
    kravTrend: true, kravLutning: true, minAdx: 22,
    rsiLang: [50, 68], rsiKort: [32, 50],
    riskProc: 0.5, maxHavstang: 5,
  },
  medel: {
    id: 'medel', namn: 'Medelrisk',
    stopAtr: 1.5, malR: 2,
    kravTrend: true, kravLutning: false, minAdx: 18,
    rsiLang: [45, 72], rsiKort: [28, 55],
    riskProc: 1, maxHavstang: 10,
  },
  hog: {
    id: 'hog', namn: 'Hög risk',
    stopAtr: 1.0, malR: 2,
    kravTrend: false, kravLutning: false, minAdx: 0,
    rsiLang: [40, 78], rsiKort: [22, 60],
    riskProc: 2, maxHavstang: 20,
  },
};

// Svensk talformatering: 3 911,54
export function tal(v, dec = 2) {
  if (v == null || !Number.isFinite(v)) return '–';
  return v.toLocaleString('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ---------- Indikatorer ----------

function tom(n) { return new Array(n).fill(null); }

export function ema(v, n) {
  const ut = tom(v.length);
  if (v.length < n) return ut;
  let s = 0;
  for (let i = 0; i < n; i++) s += v[i];
  let e = s / n;
  ut[n - 1] = e;
  const k = 2 / (n + 1);
  for (let i = n; i < v.length; i++) { e = v[i] * k + e * (1 - k); ut[i] = e; }
  return ut;
}

export function rsi(c, n) {
  const ut = tom(c.length);
  if (c.length <= n) return ut;
  let g = 0, f = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else f -= d; }
  g /= n; f /= n;
  ut[n] = f === 0 ? 100 : 100 - 100 / (1 + g / f);
  for (let i = n + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    f = (f * (n - 1) + Math.max(-d, 0)) / n;
    ut[i] = f === 0 ? 100 : 100 - 100 / (1 + g / f);
  }
  return ut;
}

function sannVidd(h, l, c, i) {
  return Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
}

export function atr(h, l, c, n) {
  const ut = tom(c.length);
  if (c.length <= n) return ut;
  let s = 0;
  for (let i = 1; i <= n; i++) s += sannVidd(h, l, c, i);
  let a = s / n;
  ut[n] = a;
  for (let i = n + 1; i < c.length; i++) { a = (a * (n - 1) + sannVidd(h, l, c, i)) / n; ut[i] = a; }
  return ut;
}

export function adx(h, l, c, n) {
  const len = c.length;
  const ut = tom(len);
  if (len < 2 * n + 1) return ut;
  const tr = tom(len), pdm = tom(len), mdm = tom(len);
  for (let i = 1; i < len; i++) {
    const upp = h[i] - h[i - 1], ned = l[i - 1] - l[i];
    pdm[i] = upp > ned && upp > 0 ? upp : 0;
    mdm[i] = ned > upp && ned > 0 ? ned : 0;
    tr[i] = sannVidd(h, l, c, i);
  }
  let trS = 0, pS = 0, mS = 0;
  for (let i = 1; i <= n; i++) { trS += tr[i]; pS += pdm[i]; mS += mdm[i]; }
  const dx = tom(len);
  const raknaDx = (i) => {
    const pdi = trS ? 100 * pS / trS : 0, mdi = trS ? 100 * mS / trS : 0;
    dx[i] = pdi + mdi === 0 ? 0 : 100 * Math.abs(pdi - mdi) / (pdi + mdi);
  };
  raknaDx(n);
  for (let i = n + 1; i < len; i++) {
    trS = trS - trS / n + tr[i];
    pS = pS - pS / n + pdm[i];
    mS = mS - mS / n + mdm[i];
    raknaDx(i);
  }
  let s = 0;
  for (let i = n; i < 2 * n; i++) s += dx[i];
  let a = s / n;
  ut[2 * n - 1] = a;
  for (let i = 2 * n; i < len; i++) { a = (a * (n - 1) + dx[i]) / n; ut[i] = a; }
  return ut;
}

function rullandeMax(v, n) {
  return v.map((_, i) => (i < n - 1 ? null : Math.max(...v.slice(i - n + 1, i + 1))));
}
function rullandeMin(v, n) {
  return v.map((_, i) => (i < n - 1 ? null : Math.min(...v.slice(i - n + 1, i + 1))));
}

export function indikatorer(staplar, cfg = STANDARD) {
  const o = staplar.map((s) => s.o), h = staplar.map((s) => s.h);
  const l = staplar.map((s) => s.l), c = staplar.map((s) => s.c);
  return {
    o, h, l, c,
    emaS: ema(c, cfg.emaSnabb),
    emaL: ema(c, cfg.emaLangsam),
    emaT: ema(c, cfg.emaTrend),
    rsi: rsi(c, cfg.rsiLangd),
    atr: atr(h, l, c, cfg.atrLangd),
    adx: adx(h, l, c, cfg.adxLangd),
    hogsta: rullandeMax(h, cfg.kanalLangd),
    lagsta: rullandeMin(l, cfg.kanalLangd),
  };
}

// ---------- Regler ----------

function lutning(v, i, n) {
  if (i - n < 0 || v[i] == null || v[i - n] == null) return 0;
  return v[i] - v[i - n];
}

function korsning(ind, i) {
  const a = ind.emaS[i - 1] - ind.emaL[i - 1];
  const b = ind.emaS[i] - ind.emaL[i];
  if (a <= 0 && b > 0) return 1;
  if (a >= 0 && b < 0) return -1;
  return 0;
}

// Uppfyller stapel i nivåns krav för en affär i riktningen (1 = lång, -1 = kort)?
function villkor(niva, ind, i, riktning, medRsi = true) {
  const c = ind.c[i];
  if (niva.kravTrend) {
    if (riktning === 1 && !(c > ind.emaT[i])) return false;
    if (riktning === -1 && !(c < ind.emaT[i])) return false;
  }
  if (niva.kravLutning && riktning * lutning(ind.emaT, i, 10) <= 0) return false;
  if (niva.minAdx && !(ind.adx[i] >= niva.minAdx)) return false;
  if (medRsi) {
    const [lo, hi] = riktning === 1 ? niva.rsiLang : niva.rsiKort;
    if (!(ind.rsi[i] >= lo && ind.rsi[i] <= hi)) return false;
  }
  return true;
}

export function regelText(niva) {
  const delar = ['snabb EMA korsar långsam EMA'];
  if (niva.kravTrend) delar.push('priset på rätt sida om trend-EMA');
  if (niva.kravLutning) delar.push('trend-EMA lutar åt samma håll');
  if (niva.minAdx) delar.push(`ADX minst ${niva.minAdx}`);
  delar.push(`RSI ${niva.rsiLang[0]}–${niva.rsiLang[1]} för lång, ${niva.rsiKort[0]}–${niva.rsiKort[1]} för kort`);
  return `Signal: ${delar.join(', ')}. Stop ${niva.stopAtr} ATR, mål ${niva.malR}R. ` +
    `Ut vid stop, mål eller motsatt korsning. Risk ${niva.riskProc} % av kapitalet per affär, högst ${niva.maxHavstang}x hävstång.`;
}

// ---------- Simulering (används både för backtest och för att ta fram aktuellt läge) ----------

export function simulera(staplar, ind, niva, cfg = STANDARD) {
  const affarer = [];
  let pos = null;
  const kost = cfg.kostnadProc / 100;
  const stang = (i, pris, orsak) => {
    const r = ((pris - pos.inPris) * pos.riktning - kost * pos.inPris) / pos.risk;
    affarer.push({
      riktning: pos.riktning, inT: pos.inT, inPris: pos.inPris, stop: pos.stop, mal: pos.mal,
      utT: staplar[i].t, utPris: pris, orsak, r,
    });
    pos = null;
  };
  for (let i = Math.max(cfg.uppvarmning, 2); i < staplar.length; i++) {
    const s = staplar[i];
    if (pos && i > pos.inIdx) {
      if (pos.riktning === 1) {
        if (s.l <= pos.stop) stang(i, Math.min(pos.stop, s.o), 'stop');
        else if (s.h >= pos.mal) stang(i, Math.max(pos.mal, s.o), 'mål');
      } else {
        if (s.h >= pos.stop) stang(i, Math.max(pos.stop, s.o), 'stop');
        else if (s.l <= pos.mal) stang(i, Math.min(pos.mal, s.o), 'mål');
      }
      if (pos && korsning(ind, i) === -pos.riktning) stang(i, s.c, 'motsignal');
    }
    if (!pos) {
      const x = korsning(ind, i);
      if (x !== 0 && villkor(niva, ind, i, x)) {
        const risk = niva.stopAtr * ind.atr[i];
        pos = {
          riktning: x, inIdx: i, inT: s.t, inPris: s.c, risk,
          stop: s.c - x * risk, mal: s.c + x * risk * niva.malR,
        };
      }
    }
  }
  return { affarer, oppen: pos };
}

export function statistik(affarer) {
  const n = affarer.length;
  let sum = 0, plus = 0, minus = 0, vinster = 0, topp = 0, maxDD = 0, svit = 0, langstaSvit = 0;
  const kurva = [];
  for (const a of affarer) {
    sum += a.r;
    kurva.push([a.utT, Math.round(sum * 100) / 100]);
    if (a.r > 0) { vinster++; plus += a.r; svit = 0; } else { minus -= a.r; svit++; langstaSvit = Math.max(langstaSvit, svit); }
    topp = Math.max(topp, sum);
    maxDD = Math.max(maxDD, topp - sum);
  }
  return {
    antal: n,
    vinster,
    traffProc: n ? (100 * vinster) / n : 0,
    summaR: sum,
    snittR: n ? sum / n : 0,
    profitFaktor: minus > 0 ? plus / minus : (plus > 0 ? Infinity : 0),
    maxNedgangR: maxDD,
    langstaForlustsvit: langstaSvit,
    kurva,
  };
}

function setup(niva, ind, i, cfg) {
  const a = ind.atr[i], aF = ind.atr[i - 2];
  if (!a || !aF) return null;
  const gap = (ind.emaS[i] - ind.emaL[i]) / a;
  const gapF = (ind.emaS[i - 2] - ind.emaL[i - 2]) / aF;
  if (gap < 0 && gap > -cfg.setupAtr && gap > gapF && villkor(niva, ind, i, 1, false)) {
    return { riktning: 1, avstandAtr: -gap };
  }
  if (gap > 0 && gap < cfg.setupAtr && gap < gapF && villkor(niva, ind, i, -1, false)) {
    return { riktning: -1, avstandAtr: gap };
  }
  return null;
}

// Ungefärlig högsta hävstång där en turbos barriär hamnar bortom stop-lossen (med marginal).
// En turbo med hävstång H har sin barriär ungefär pris/H från nuvarande pris.
export function maxHavstang(pris, stopAvstand, niva, cfg = STANDARD) {
  const teoretisk = Math.floor(pris / (stopAvstand * cfg.barriarMarginal));
  return Math.max(1, Math.min(niva.maxHavstang, teoretisk));
}

// Hur mycket man kan lägga i en turbo så att en träff på stop-lossen kostar riskProc % av kapitalet.
export function insats(kapital, niva, pris, stopAvstand, havstang) {
  if (!kapital || kapital <= 0) return null;
  const riskKr = (kapital * niva.riskProc) / 100;
  const stopProc = stopAvstand / pris;
  return { riskKr, insatsKr: Math.min(kapital, riskKr / (havstang * stopProc)) };
}

// ---------- Textanalys ----------

function textanalys(ind, i, staplar24) {
  const c = ind.c[i], a = ind.atr[i], r = ind.rsi[i], x = ind.adx[i];
  const lut = lutning(ind.emaT, i, 10);
  const rader = [];

  let trend;
  if (x < 18) trend = `Sidledes – ingen tydlig trend (ADX ${tal(x, 0)}).`;
  else if (c > ind.emaT[i] && lut > 0) trend = `Uppåt – priset ligger över trend-EMA, som stiger (ADX ${tal(x, 0)}).`;
  else if (c < ind.emaT[i] && lut < 0) trend = `Nedåt – priset ligger under trend-EMA, som sjunker (ADX ${tal(x, 0)}).`;
  else trend = `Blandad – priset och trend-EMA pekar åt olika håll (ADX ${tal(x, 0)}).`;
  rader.push({ rubrik: 'Trend', text: trend });

  let mom;
  if (r >= 70) mom = 'överköpt';
  else if (r >= 55) mom = 'starkt';
  else if (r > 45) mom = 'neutralt';
  else if (r > 30) mom = 'svagt';
  else mom = 'översålt';
  rader.push({ rubrik: 'Momentum', text: `RSI ${tal(r, 0)} – ${mom}.` });

  const gap = (ind.emaS[i] - ind.emaL[i]) / a;
  const gapF = (ind.emaS[i - 2] - ind.emaL[i - 2]) / ind.atr[i - 2];
  const narmar = Math.abs(gap) < Math.abs(gapF);
  let kors;
  if (Math.abs(gap) < 0.1) kors = 'Snabb och långsam EMA ligger nästan ovanpå varandra – en korsning kan komma när som helst.';
  else if (gap > 0) kors = `Snabb EMA ligger ${tal(gap)} ATR över långsam EMA och ${narmar ? 'närmar sig en korsning nedåt' : 'drar ifrån uppåt'}.`;
  else kors = `Snabb EMA ligger ${tal(-gap)} ATR under långsam EMA och ${narmar ? 'närmar sig en korsning uppåt' : 'drar ifrån nedåt'}.`;
  rader.push({ rubrik: 'EMA-läge', text: kors });

  const atrHist = ind.atr.slice(Math.max(0, i - 100), i + 1).filter((v) => v != null).sort((p, q) => p - q);
  const median = atrHist[Math.floor(atrHist.length / 2)] || a;
  const relativ = a / median;
  const vol = relativ > 1.3 ? 'hög' : relativ < 0.75 ? 'låg' : 'normal';
  rader.push({ rubrik: 'Volatilitet', text: `ATR ${tal(a)} USD (${tal((100 * a) / c)} % av priset) – ${vol} jämfört med de senaste 100 staplarna.` });

  rader.push({
    rubrik: 'Nivåer',
    text: `Högsta senaste ${STANDARD.kanalLangd} staplar: ${tal(ind.hogsta[i])} (${tal((ind.hogsta[i] - c) / a, 1)} ATR bort). ` +
      `Lägsta: ${tal(ind.lagsta[i])} (${tal((c - ind.lagsta[i]) / a, 1)} ATR bort).`,
  });

  if (i - staplar24 >= 0) {
    const f = (100 * (c - ind.c[i - staplar24])) / ind.c[i - staplar24];
    rader.push({ rubrik: 'Senaste dygnet', text: `${f >= 0 ? '+' : ''}${tal(f)} %.` });
  }
  return rader;
}

// ---------- Huvudfunktion ----------

export function taBortPagaende(staplar, intervallMin, nu = Date.now()) {
  if (!staplar.length) return staplar;
  const sista = staplar[staplar.length - 1];
  return sista.t + intervallMin * 60000 > nu ? staplar.slice(0, -1) : staplar;
}

export function analysera(staplar, { intervallMin = 60, cfg: egenCfg = {}, serieLangd = 160 } = {}) {
  const cfg = { ...STANDARD, ...egenCfg };
  if (staplar.length < cfg.uppvarmning + 10) {
    throw new Error(`För lite prisdata: ${staplar.length} staplar, behöver minst ${cfg.uppvarmning + 10}.`);
  }
  const ind = indikatorer(staplar, cfg);
  const i = staplar.length - 1;
  const pris = ind.c[i];
  const staplar24 = Math.max(1, Math.round(1440 / intervallMin));

  const nivaer = {};
  for (const niva of Object.values(NIVAER)) {
    const sim = simulera(staplar, ind, niva, cfg);
    const stats = statistik(sim.affarer);
    let oppen = null;
    if (sim.oppen) {
      const p = sim.oppen;
      oppen = {
        riktning: p.riktning, inT: p.inT, inPris: p.inPris, stop: p.stop, mal: p.mal, risk: p.risk,
        aktuelltR: ((pris - p.inPris) * p.riktning) / p.risk,
        maxHavstang: maxHavstang(p.inPris, p.risk, niva, cfg),
      };
    }
    const st = oppen ? null : setup(niva, ind, i, cfg);
    const riskNu = niva.stopAtr * ind.atr[i];
    nivaer[niva.id] = {
      id: niva.id,
      namn: niva.namn,
      regler: regelText(niva),
      riskProc: niva.riskProc,
      lage: oppen ? (oppen.riktning === 1 ? 'LANG' : 'KORT') : st ? 'SETUP' : 'INGET',
      oppen,
      setup: st,
      nyttStopAvstand: riskNu,
      nyMaxHavstang: maxHavstang(pris, riskNu, niva, cfg),
      stats,
      affarer: sim.affarer.slice(-40),
    };
  }

  const fran = Math.max(0, staplar.length - serieLangd);
  const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
  return {
    version: 1,
    intervallMin,
    senast: staplar[i],
    pris,
    indikatorer: {
      emaS: ind.emaS[i], emaL: ind.emaL[i], emaT: ind.emaT[i], rsi: ind.rsi[i],
      atr: ind.atr[i], adx: ind.adx[i], hogsta: ind.hogsta[i], lagsta: ind.lagsta[i],
    },
    analys: textanalys(ind, i, staplar24),
    nivaer,
    backtestFran: staplar[cfg.uppvarmning].t,
    backtestTill: staplar[i].t,
    antalStaplar: staplar.length,
    serie: {
      t: staplar.slice(fran).map((s) => s.t),
      c: ind.c.slice(fran).map(r2),
      emaS: ind.emaS.slice(fran).map(r2),
      emaL: ind.emaL.slice(fran).map(r2),
      emaT: ind.emaT.slice(fran).map(r2),
    },
  };
}

// ---------- Jämförelse mellan två analyser → notiser ----------

const RIKTNING = { 1: 'LÅNG', '-1': 'KORT' };

export function handelser(forra, nu) {
  const ut = [];
  if (!forra || !forra.nivaer) return ut;
  if (forra.senast && nu.senast && forra.senast.t === nu.senast.t) return ut; // ingen ny stapel
  for (const id of Object.keys(nu.nivaer)) {
    const a = forra.nivaer[id], b = nu.nivaer[id];
    if (!a || !b) continue;
    const aOppen = a.oppen, bOppen = b.oppen;
    const sammaPos = aOppen && bOppen && aOppen.inT === bOppen.inT;
    if (aOppen && !sammaPos) {
      const stangd = [...b.affarer].reverse().find((x) => x.inT === aOppen.inT);
      ut.push({
        typ: 'stangt', riktning: aOppen.riktning, niva: id, namn: b.namn, prioritet: 4,
        titel: `Guld: ${RIKTNING[aOppen.riktning]}-läget stängt (${b.namn})`,
        text: stangd
          ? `Ut på ${tal(stangd.utPris)} via ${stangd.orsak}. Resultat ${stangd.r >= 0 ? '+' : ''}${tal(stangd.r)}R.`
          : `Läget gäller inte längre. Pris ${tal(nu.pris)}.`,
      });
    }
    if (bOppen && !sammaPos) {
      ut.push({
        typ: 'nytt', riktning: bOppen.riktning, niva: id, namn: b.namn, prioritet: 5,
        titel: `Guld: nytt ${RIKTNING[bOppen.riktning]}-läge (${b.namn})`,
        text: `Pris ${tal(bOppen.inPris)} · stop ${tal(bOppen.stop)} · mål ${tal(bOppen.mal)} · ` +
          `turbo högst ca ${bOppen.maxHavstang}x för att barriären ska ligga bortom stop.`,
      });
    }
    if (!bOppen && b.setup && !(a.setup && a.setup.riktning === b.setup.riktning) && !aOppen) {
      ut.push({
        typ: 'setup', riktning: b.setup.riktning, niva: id, namn: b.namn, prioritet: 3,
        titel: `Guld: möjligt ${RIKTNING[b.setup.riktning]}-läge på väg (${b.namn})`,
        text: `EMA-linjerna är ${tal(b.setup.avstandAtr)} ATR från en korsning. Pris ${tal(nu.pris)}. Läge att titta in.`,
      });
    }
  }
  return ut;
}

// Samma signal slår ofta igenom på flera nivåer samtidigt. Slå ihop dem till en notis per typ och riktning.
export function grupperaHandelser(lista) {
  const grupper = new Map();
  for (const h of lista) {
    const nyckel = `${h.typ}:${h.riktning}`;
    if (!grupper.has(nyckel)) grupper.set(nyckel, []);
    grupper.get(nyckel).push(h);
  }
  const ut = [];
  for (const grupp of grupper.values()) {
    if (grupp.length === 1) { ut.push(grupp[0]); continue; }
    const f = grupp[0];
    const namn = grupp.map((h) => h.namn).join(', ');
    ut.push({
      typ: f.typ, riktning: f.riktning, nivaer: grupp.map((h) => h.niva),
      prioritet: Math.max(...grupp.map((h) => h.prioritet)),
      titel: f.titel.replace(/\(.*\)$/, `(${namn})`),
      text: grupp.every((h) => h.text === f.text) ? f.text : grupp.map((h) => `${h.namn}: ${h.text}`).join('\n'),
    });
  }
  return ut.sort((a, b) => b.prioritet - a.prioritet);
}
