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
      proc: (100 * (pris - pos.inPris) * pos.riktning) / pos.inPris - cfg.kostnadProc,
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
  let sum = 0, plus = 0, minus = 0, vinster = 0, topp = 0, maxDD = 0, svit = 0, langstaSvit = 0, sumProc = 0;
  const kurva = [];
  for (const a of affarer) {
    sum += a.r;
    sumProc += a.proc || 0;
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
    snittProc: n ? sumProc / n : 0,
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

function textanalys(ind, i, dygnProc, dec = 2, valuta = 'USD') {
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
  rader.push({ rubrik: 'Volatilitet', text: `ATR ${tal(a, dec)} ${valuta} (${tal((100 * a) / c)} % av priset) – ${vol} jämfört med de senaste 100 staplarna.` });

  rader.push({
    rubrik: 'Nivåer',
    text: `Högsta senaste ${STANDARD.kanalLangd} staplar: ${tal(ind.hogsta[i], dec)} (${tal((ind.hogsta[i] - c) / a, 1)} ATR bort). ` +
      `Lägsta: ${tal(ind.lagsta[i], dec)} (${tal((c - ind.lagsta[i]) / a, 1)} ATR bort).`,
  });

  if (dygnProc != null) {
    rader.push({ rubrik: 'Senaste dygnet', text: `${dygnProc >= 0 ? '+' : ''}${tal(dygnProc)} %.` });
  }
  return rader;
}

// ---------- Huvudfunktion ----------

export function taBortPagaende(staplar, intervallMin, nu = Date.now()) {
  if (!staplar.length) return staplar;
  const sista = staplar[staplar.length - 1];
  return sista.t + intervallMin * 60000 > nu ? staplar.slice(0, -1) : staplar;
}

export function analysera(staplar, { intervallMin = 60, cfg: egenCfg = {}, serieLangd = 160, dec = 2, valuta = 'USD' } = {}) {
  const cfg = { ...STANDARD, ...egenCfg };
  if (staplar.length < cfg.uppvarmning + 10) {
    throw new Error(`För lite prisdata: ${staplar.length} staplar, behöver minst ${cfg.uppvarmning + 10}.`);
  }
  const ind = indikatorer(staplar, cfg);
  const i = staplar.length - 1;
  const pris = ind.c[i];
  // Förändring sedan senaste stapeln som är minst ett dygn gammal (fungerar även för aktier som bara handlas dagtid)
  const tDygn = staplar[i].t - 86400000;
  let j = i;
  while (j > 0 && staplar[j].t > tDygn) j--;
  const dygnProc = j < i && staplar[j].t <= tDygn ? (100 * (pris - ind.c[j])) / ind.c[j] : null;

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
  const r2 = (v) => (v == null ? null : Math.round(v * 10 ** (dec + 1)) / 10 ** (dec + 1));
  return {
    version: 2,
    intervallMin,
    dec,
    valuta,
    senast: staplar[i],
    pris,
    indikatorer: {
      emaS: ind.emaS[i], emaL: ind.emaL[i], emaT: ind.emaT[i], rsi: ind.rsi[i],
      atr: ind.atr[i], adx: ind.adx[i], hogsta: ind.hogsta[i], lagsta: ind.lagsta[i],
    },
    analys: textanalys(ind, i, dygnProc, dec, valuta),
    dygnProc,
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

export function handelser(forra, nu, namn = 'Guld') {
  const ut = [];
  const d = nu.dec ?? 2;
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
        typ: 'stangt', riktning: aOppen.riktning, niva: id, namn: b.namn, prioritet: 3,
        titel: `${namn}: ${RIKTNING[aOppen.riktning]}-läget stängt (${b.namn})`,
        text: stangd
          ? `Ut på ${tal(stangd.utPris, d)} via ${stangd.orsak}. Resultat ${stangd.r >= 0 ? '+' : ''}${tal(stangd.r)}R.`
          : `Läget gäller inte längre. Pris ${tal(nu.pris, d)}.`,
      });
    }
    if (bOppen && !sammaPos) {
      ut.push({
        typ: 'nytt', riktning: bOppen.riktning, niva: id, namn: b.namn, prioritet: 4,
        titel: `${namn}: nytt ${RIKTNING[bOppen.riktning]}-läge (${b.namn})`,
        text: `Pris ${tal(bOppen.inPris, d)} · stop ${tal(bOppen.stop, d)} · mål ${tal(bOppen.mal, d)} · ` +
          `turbo högst ca ${bOppen.maxHavstang}x för att barriären ska ligga bortom stop.`,
      });
    }
    // Möjligt läge: notis högst en gång per riktning inom 6 staplar, så att den inte tjatar när EMA-linjerna dansar runt varandra.
    b.setupNotis = a.setupNotis || null;
    const nyligen = a.setupNotis && a.setupNotis.riktning === b.setup?.riktning &&
      nu.senast.t - a.setupNotis.t < 6 * (nu.intervallMin || 60) * 60000;
    if (!bOppen && b.setup && !(a.setup && a.setup.riktning === b.setup.riktning) && !aOppen && !nyligen) {
      b.setupNotis = { t: nu.senast.t, riktning: b.setup.riktning };
      ut.push({
        typ: 'setup', riktning: b.setup.riktning, niva: id, namn: b.namn, prioritet: 2,
        titel: `${namn}: möjligt ${RIKTNING[b.setup.riktning]}-läge på väg (${b.namn})`,
        text: `EMA-linjerna är ${tal(b.setup.avstandAtr)} ATR från en korsning. Pris ${tal(nu.pris, d)}. Läge att titta in.`,
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

// ---------- Tider från datakällorna ----------

// Twelve Data ger "2026-11-24 13:00:00" (timmar) eller "2026-11-24" (dagar). Vi ber alltid om UTC.
export function tolkaTid(datetime) {
  const d = String(datetime).trim();
  return Date.parse(d.length <= 10 ? `${d}T00:00:00Z` : `${d.replace(' ', 'T')}Z`);
}

// En dagsstapel som tillhör dagens datum (UTC) pågår fortfarande och tas bort.
export function taBortPagaendeDag(staplar, nu = Date.now()) {
  if (!staplar.length || !Number.isFinite(nu)) return staplar;
  const idag = new Date(nu).toISOString().slice(0, 10);
  const sista = new Date(staplar[staplar.length - 1].t).toISOString().slice(0, 10);
  return sista === idag ? staplar.slice(0, -1) : staplar;
}

// ---------- Längre lägen (dagsstaplar) ----------
// Letar köplägen med längre horisont än timsignalerna: veckor till månader.
//  - Rekyl i upptrend: priset är i en etablerad upptrend, har rekylerat (RSI under 40 senaste veckan)
//    och stänger nu tillbaka över EMA 20.
//  - Gyllene kors: SMA 50 korsar över SMA 200 medan priset ligger över SMA 200.
// Stop 3 ATR under köpet, som sedan flyttas upp (högsta pris sedan köpet minus 3 ATR). Inget fast mål.

export const LANGRE = {
  smaKort: 50, smaLang: 200, ema: 20, rsiLangd: 14, atrLangd: 14,
  rekylRsi: 40, rekylDagar: 7, lutningDagar: 20,
  stopAtr: 3, kostnadProc: 0.1, uppvarmning: 220,
};

export function sma(v, n) {
  const ut = tom(v.length);
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    s += v[i];
    if (i >= n) s -= v[i - n];
    if (i >= n - 1) ut[i] = s / n;
  }
  return ut;
}

export function langreRegelText() {
  const L = LANGRE;
  return `Köpläge när priset är i upptrend (över SMA ${L.smaLang}, som stiger, och SMA ${L.smaKort} över SMA ${L.smaLang}) ` +
    `och antingen har rekylerat (RSI under ${L.rekylRsi} senaste ${L.rekylDagar} dagarna) och stänger tillbaka över EMA ${L.ema}, ` +
    `eller när SMA ${L.smaKort} korsar över SMA ${L.smaLang}. Stop ${L.stopAtr} ATR under köpet som flyttas upp när priset stiger ` +
    `(högsta pris sedan köpet minus ${L.stopAtr} ATR). Inget fast mål – läget stängs när stoppen nås.`;
}

function langreInd(staplar, L) {
  const h = staplar.map((s) => s.h), l = staplar.map((s) => s.l), c = staplar.map((s) => s.c);
  return {
    h, l, c, o: staplar.map((s) => s.o),
    smaK: sma(c, L.smaKort), smaL: sma(c, L.smaLang), ema: ema(c, L.ema),
    rsi: rsi(c, L.rsiLangd), atr: atr(h, l, c, L.atrLangd),
  };
}

function upptrend(ind, i, L) {
  return ind.c[i] > ind.smaL[i] && ind.smaK[i] > ind.smaL[i] && ind.smaL[i] - ind.smaL[i - L.lutningDagar] > 0;
}

function langreSignal(ind, i, L) {
  const kors = ind.smaK[i] > ind.smaL[i] && ind.smaK[i - 1] <= ind.smaL[i - 1] && ind.c[i] > ind.smaL[i];
  if (kors) return 'gyllene kors';
  if (!upptrend(ind, i, L)) return null;
  const minRsi = Math.min(...ind.rsi.slice(i - L.rekylDagar + 1, i + 1));
  if (minRsi < L.rekylRsi && ind.c[i] > ind.ema[i] && ind.c[i - 1] <= ind.ema[i - 1]) return 'rekyl i upptrend';
  return null;
}

export function analyseraLangre(staplar, { dec = 2, valuta = 'USD', cfg = {}, serieLangd = 260 } = {}) {
  const L = { ...LANGRE, ...cfg };
  if (staplar.length < L.uppvarmning + 30) {
    throw new Error(`För lite dagsdata: ${staplar.length} dagar, behöver minst ${L.uppvarmning + 30}.`);
  }
  const ind = langreInd(staplar, L);
  const affarer = [];
  let pos = null;
  for (let i = L.uppvarmning; i < staplar.length; i++) {
    const s = staplar[i];
    if (pos && i > pos.inIdx) {
      if (s.l <= pos.stop) {
        const ut = Math.min(pos.stop, s.o);
        affarer.push({
          riktning: 1, typ: pos.typ, inT: pos.inT, inPris: pos.inPris, utT: s.t, utPris: ut,
          orsak: pos.stop > pos.forstaStop ? 'släpande stop' : 'stop',
          r: (ut - pos.inPris - (L.kostnadProc / 100) * pos.inPris) / pos.risk,
          proc: (100 * (ut - pos.inPris)) / pos.inPris - L.kostnadProc,
          dagar: Math.round((s.t - pos.inT) / 86400000),
        });
        pos = null;
      } else {
        pos.hogsta = Math.max(pos.hogsta, s.h);
        pos.stop = Math.max(pos.stop, pos.hogsta - L.stopAtr * ind.atr[i]);
      }
    }
    if (!pos) {
      const typ = langreSignal(ind, i, L);
      if (typ) {
        const risk = L.stopAtr * ind.atr[i];
        pos = { typ, inIdx: i, inT: s.t, inPris: s.c, risk, stop: s.c - risk, forstaStop: s.c - risk, hogsta: s.c };
      }
    }
  }
  const i = staplar.length - 1;
  const pris = ind.c[i];
  let setup = null;
  if (!pos) {
    if (upptrend(ind, i, L) && ind.rsi[i] < L.rekylRsi) {
      setup = { typ: 'rekyl', text: `Rekyl pågår i en upptrend (RSI ${tal(ind.rsi[i], 0)}). Köpläge enligt reglerna om priset stänger över EMA ${L.ema} (${tal(ind.ema[i], dec)}).` };
    } else if (ind.smaK[i] < ind.smaL[i] && ind.smaK[i] > ind.smaK[i - 5] && (ind.smaL[i] - ind.smaK[i]) / ind.smaL[i] < 0.01) {
      setup = { typ: 'kors', text: `SMA ${L.smaKort} ligger mindre än 1 % under SMA ${L.smaLang} och stiger – ett gyllene kors kan vara nära.` };
    }
  }
  const stats = statistik(affarer);
  const fran = Math.max(0, staplar.length - serieLangd);
  const rd = (v) => (v == null ? null : Math.round(v * 10 ** (dec + 1)) / 10 ** (dec + 1));
  return {
    version: 2, typ: 'dag', dec, valuta,
    senast: staplar[i], pris,
    trend: upptrend(ind, i, L) ? 'upp' : ind.c[i] < ind.smaL[i] && ind.smaK[i] < ind.smaL[i] ? 'ned' : 'blandad',
    indikatorer: { smaK: ind.smaK[i], smaL: ind.smaL[i], ema: ind.ema[i], rsi: ind.rsi[i], atr: ind.atr[i] },
    lage: pos ? 'KOP' : setup ? 'SETUP' : 'INGET',
    oppen: pos && {
      typ: pos.typ, inT: pos.inT, inPris: pos.inPris, stop: pos.stop, forstaStop: pos.forstaStop, risk: pos.risk,
      aktuelltR: (pris - pos.inPris) / pos.risk, aktuellProc: (100 * (pris - pos.inPris)) / pos.inPris,
      dagar: Math.round((staplar[i].t - pos.inT) / 86400000),
    },
    setup,
    regler: langreRegelText(),
    stats,
    affarer: affarer.slice(-30),
    backtestFran: staplar[L.uppvarmning].t,
    backtestTill: staplar[i].t,
    antalStaplar: staplar.length,
    serie: {
      t: staplar.slice(fran).map((x) => x.t),
      c: ind.c.slice(fran).map(rd),
      smaK: ind.smaK.slice(fran).map(rd),
      smaL: ind.smaL.slice(fran).map(rd),
    },
  };
}

export function handelserLangre(forra, nu, namn) {
  if (!forra || !nu || forra.senast?.t === nu.senast?.t) return [];
  const d = nu.dec ?? 2;
  const ut = [];
  const a = forra.oppen, b = nu.oppen;
  const samma = a && b && a.inT === b.inT;
  if (a && !samma) {
    const st = [...nu.affarer].reverse().find((x) => x.inT === a.inT);
    ut.push({
      typ: 'stangt', langre: true, prioritet: 3,
      titel: `Längre läge: ${namn} – avslutat`,
      text: st ? `Ut på ${tal(st.utPris, d)} via ${st.orsak} efter ${st.dagar} dagar. Resultat ${st.proc >= 0 ? '+' : ''}${tal(st.proc, 1)} %.`
        : `Läget gäller inte längre. Pris ${tal(nu.pris, d)}.`,
    });
  }
  if (b && !samma) {
    const s = nu.stats;
    ut.push({
      typ: 'nytt', langre: true, prioritet: 4,
      titel: `Längre läge: ${namn} – köpläge (${b.typ})`,
      text: `Pris ${tal(b.inPris, d)} · stop ${tal(b.stop, d)} (${tal((100 * b.risk) / b.inPris, 1)} % under, flyttas upp när priset stiger). ` +
        `Reglerna har gett ${s.antal} affärer här historiskt, snitt ${s.snittProc >= 0 ? '+' : ''}${tal(s.snittProc, 1)} % per affär.`,
    });
  }
  // Notis om möjligt läge högst en gång per vecka och typ.
  nu.setupNotis = forra.setupNotis || null;
  const nyligen = forra.setupNotis && forra.setupNotis.typ === nu.setup?.typ && nu.senast.t - forra.setupNotis.t < 7 * 86400000;
  if (!b && nu.setup && !(forra.setup && forra.setup.typ === nu.setup.typ) && !a && !nyligen) {
    nu.setupNotis = { t: nu.senast.t, typ: nu.setup.typ };
    ut.push({ typ: 'setup', langre: true, prioritet: 2, titel: `Längre läge: ${namn} – kan vara på väg`, text: nu.setup.text });
  }
  return ut;
}

// ---------- Egna positioner: säljanalys ----------
// När du har registrerat ett köp (lång eller kort) bevakas det på 5-minutersstaplar.
// Stop och mål kommer från vald risknivå (eller dina egna nivåer). Analysen säger BEHÅLL, VARNING eller SÄLJ och varför.

export const POSITION = {
  beVidR: 1,            // när affären som mest gått +1R flyttas stoppen till köppriset
  slapVidR: 1.5,        // från +1,5R följer stoppen med: bästa pris sedan köpet minus 1 ATR (timme)
  slapAtr: 1,
  narStopR: 0.25,       // varning när priset är inom 0,25R från stoppen
  barriarVarnAtr: 1.5,  // varning när turbons barriär är närmare än 1,5 ATR
  barriarSaljAtr: 0.5,  // säljsignal när barriären är närmare än 0,5 ATR
  overkopt: 75, oversalt: 25,
  momentumStaplar: 6,   // en EMA-korsning mot positionen på 5-minutersstaplar inom de senaste 30 minuterna
  paminnelseMin: 30, maxPaminnelser: 4,
  stopFlyttR: 0.5,      // ny notis om släpande stop när den flyttats minst 0,5R sedan förra notisen
};

const nollad = (v, dec) => (Math.abs(v) < 0.5 * 10 ** -dec ? 0 : v);
const signProcent = (p, dec = 1) => { const v = nollad(p, dec); return `${v > 0 ? '+' : ''}${tal(v, dec)} %`; };
const signRText = (r) => { const v = nollad(r, 2); return `${v > 0 ? '+' : ''}${tal(v)}R`; };

export function positionsRegelText() {
  const P = POSITION;
  return `Stop och mål från vald risknivå (eller dina egna). Säljsignal när stoppen nås, målet nås, timtrenden vänder mot dig ` +
    `(EMA 9 korsar EMA 21 och priset hamnar på fel sida) eller priset är närmare än ${P.barriarSaljAtr} ATR från turbons barriär. ` +
    `Varning vid vänt momentum på 5-minutersstaplar, överköpt/översålt läge (RSI ${P.overkopt}/${P.oversalt}) och när priset närmar sig stoppen eller barriären. ` +
    `Vid +${P.beVidR}R flyttas stoppen till köppriset och från +${P.slapVidR}R följer den med (bästa pris minus ${P.slapAtr} ATR).`;
}

// Slår ihop staplar till längre staplar, t.ex. 5-minuters till timmar.
export function aggregera(staplar, minuter) {
  const ms = minuter * 60000;
  const ut = [];
  let akt = null;
  for (const s of staplar) {
    const b = Math.floor(s.t / ms) * ms;
    if (!akt || akt.t !== b) {
      if (akt) ut.push(akt);
      akt = { t: b, o: s.o, h: s.h, l: s.l, c: s.c, sista: s.t };
    } else {
      akt.h = Math.max(akt.h, s.h); akt.l = Math.min(akt.l, s.l); akt.c = s.c; akt.sista = s.t;
    }
  }
  if (akt) ut.push(akt);
  return ut;
}

export function analyseraPosition(pos, staplar5, { dec = 2, valuta = '', prisNu = null, kostnadProc = 0.04, risk: fastRisk = null } = {}) {
  const P = POSITION;
  const steg = 5 * 60000;
  if (staplar5.length < 60) throw new Error('För lite prisdata för att analysera positionen.');
  let h1 = aggregera(staplar5, 60);
  const sistaTimme = h1[h1.length - 1];
  if (sistaTimme && sistaTimme.sista + steg < sistaTimme.t + 3600000) h1 = h1.slice(0, -1); // timmen pågår
  if (h1.length < 30) throw new Error('För lite timdata för att analysera positionen.');

  const c5 = staplar5.map((s) => s.c), c1 = h1.map((s) => s.c);
  const e9_5 = ema(c5, 9), e21_5 = ema(c5, 21), rsi5 = rsi(c5, 14);
  const e9_1 = ema(c1, 9), e21_1 = ema(c1, 21), rsi1 = rsi(c1, 14);
  const atr1 = atr(h1.map((s) => s.h), h1.map((s) => s.l), c1, 14);
  const i5 = staplar5.length - 1, i1 = h1.length - 1;
  const pris = prisNu ?? c5[i5];
  const dir = pos.riktning === -1 ? -1 : 1;
  const niva = NIVAER[pos.niva] || NIVAER.medel;
  const f = (v) => tal(v, dec);

  // Timmen då köpet gjordes, och ATR just före köpet
  let j1 = h1.findIndex((s) => s.t + 3600000 > pos.inT);
  if (j1 < 0) j1 = i1;
  const atrIn = atr1[Math.max(0, j1 - 1)] ?? atr1[i1];
  const atrNu = atr1[i1] ?? atrIn;
  // Risken låses vid första analysen (fastRisk), så att stop och mål inte flyttar sig när nya timmar tillkommer.
  const risk = pos.stop ? Math.abs(pos.inPris - pos.stop) : fastRisk || niva.stopAtr * atrIn;
  const startStop = pos.stop ?? pos.inPris - dir * risk;
  const mal = pos.mal ?? pos.inPris + dir * risk * niva.malR;
  const malR = Math.abs(mal - pos.inPris) / risk;

  // Hur affären har gått sedan köpet
  const efter = staplar5.filter((s) => s.t + steg > pos.inT);
  const basta = efter.length ? (dir === 1 ? Math.max(...efter.map((s) => s.h)) : Math.min(...efter.map((s) => s.l))) : pos.inPris;
  const samsta = efter.length ? (dir === 1 ? Math.min(...efter.map((s) => s.l)) : Math.max(...efter.map((s) => s.h))) : pos.inPris;
  const bastaR = Math.max(0, ((basta - pos.inPris) * dir) / risk);
  const r = ((pris - pos.inPris) * dir) / risk;
  const procU = (100 * (pris - pos.inPris) * dir) / pos.inPris;

  // Föreslagen stop just nu
  let stop = startStop, stopTyp = 'start';
  const kost = (pos.inPris * kostnadProc) / 100;
  if (bastaR >= P.beVidR) {
    const be = pos.inPris + dir * kost;
    if ((be - stop) * dir > 0) { stop = be; stopTyp = 'break-even'; }
  }
  if (bastaR >= P.slapVidR) {
    const sl = basta - dir * P.slapAtr * atrNu;
    if ((sl - stop) * dir > 0) { stop = sl; stopTyp = 'släpande'; }
  }

  const skal = [];
  const lagg = (allvar, kod, text) => skal.push({ allvar, kod, text });

  // --- Säljsignaler ---
  if ((samsta - startStop) * dir <= 0 && stopTyp === 'start') {
    lagg('salj', 'stop', `Stop-lossen ${f(startStop)} har nåtts (${dir === 1 ? 'lägsta' : 'högsta'} pris sedan köpet ${f(samsta)}). Enligt reglerna säljer du för att begränsa förlusten.`);
  } else if ((pris - stop) * dir <= 0) {
    lagg('salj', 'stop', stopTyp === 'start'
      ? `Priset ${f(pris)} har passerat stop-lossen ${f(stop)}. Enligt reglerna säljer du för att begränsa förlusten.`
      : stopTyp === 'break-even'
        ? `Priset ${f(pris)} är tillbaka vid köppriset (${f(stop)}). Sälj så att affären inte blir en förlust.`
        : `Priset ${f(pris)} har passerat den släpande stoppen ${f(stop)}. Sälj för att säkra vinsten.`);
  } else if (r >= malR) {
    lagg('salj', 'mal', `Målet ${f(mal)} (${tal(malR, 1)}R) är nått. Enligt reglerna tar du hem vinsten här.`);
  }
  const relation = (k) => Math.sign(e9_1[k] - e21_1[k]);
  if (e9_1[i1] != null && e21_1[i1] != null && relation(i1) === -dir) {
    let korsadEfterKop = false;
    for (let k = Math.max(1, j1); k <= i1; k++) if (relation(k) === -dir && relation(k - 1) !== -dir) korsadEfterKop = true;
    if (korsadEfterKop && (c1[i1] - e21_1[i1]) * dir < 0) {
      lagg('salj', 'timtrend', `Timtrenden har vänt: EMA 9 har korsat EMA 21 ${dir === 1 ? 'nedåt' : 'uppåt'} på timstaplar och priset ligger på fel sida om EMA 21.`);
    }
  }
  if (pos.barriar) {
    const kvar = (pris - pos.barriar) * dir;
    if (kvar <= P.barriarSaljAtr * atrNu) {
      lagg('salj', 'barriar', `Priset är bara ${f(Math.max(0, kvar))} ${valuta} från turbons barriär ${f(pos.barriar)}. Stor risk för knock-out.`);
    } else if (kvar <= P.barriarVarnAtr * atrNu) {
      lagg('varning', 'barriar', `Priset närmar sig turbons barriär ${f(pos.barriar)}: ${f(kvar)} ${valuta} kvar (${tal(kvar / atrNu, 1)} ATR).`);
    }
  }

  // --- Varningar ---
  const avstStop = (pris - stop) * dir;
  if (!skal.some((s) => s.kod === 'stop') && avstStop > 0 && avstStop <= P.narStopR * risk) {
    lagg('varning', 'narstop', `Priset ligger nära stoppen ${f(stop)} (${f(avstStop)} ${valuta} kvar).`);
  }
  let kors5 = false;
  for (let k = Math.max(1, i5 - P.momentumStaplar + 1); k <= i5; k++) {
    const nu = Math.sign(e9_5[k] - e21_5[k]), fore = Math.sign(e9_5[k - 1] - e21_5[k - 1]);
    if (nu === -dir && fore !== -dir && staplar5[k].t >= pos.inT) kors5 = true;
  }
  if (kors5 && (dir === 1 ? rsi5[i5] < 45 : rsi5[i5] > 55)) {
    lagg('varning', 'momentum', `Kortsiktigt momentum har vänt: EMA 9 korsade EMA 21 ${dir === 1 ? 'nedåt' : 'uppåt'} på 5-minutersstaplar (RSI ${tal(rsi5[i5], 0)}).`);
  }
  if (dir === 1 && rsi1[i1] >= P.overkopt) lagg('varning', 'overkopt', `Överköpt på timstaplar (RSI ${tal(rsi1[i1], 0)}). Risk för rekyl – överväg att ta hem en del av vinsten.`);
  if (dir === -1 && rsi1[i1] <= P.oversalt) lagg('varning', 'oversalt', `Översålt på timstaplar (RSI ${tal(rsi1[i1], 0)}). Risk för studs uppåt – överväg att ta hem en del av vinsten.`);

  // --- Information ---
  if (stopTyp === 'break-even') lagg('info', 'be', `Affären har som mest gått ${signRText(bastaR)}. Enligt reglerna flyttas stoppen till köppriset (${f(stop)}).`);
  if (stopTyp === 'släpande') lagg('info', 'slap', `Släpande stop: ${f(stop)} (bästa pris sedan köpet ${f(basta)} minus ${P.slapAtr} ATR).`);

  const status = skal.some((s) => s.allvar === 'salj') ? 'SALJ' : skal.some((s) => s.allvar === 'varning') ? 'VARNING' : 'BEHALL';
  const KORT = { stop: 'stoppen nådd', mal: 'målet nått', timtrend: 'timtrenden har vänt', barriar: 'nära barriären', narstop: 'nära stoppen', momentum: 'momentum har vänt', overkopt: 'överköpt', oversalt: 'översålt' };
  const etiketter = (allvar) => skal.filter((s) => s.allvar === allvar).map((s) => KORT[s.kod]).filter(Boolean);
  const sammanfattning = status === 'SALJ' ? `Säljsignal: ${etiketter('salj').join(', ')}`
    : status === 'VARNING' ? `Bevaka: ${etiketter('varning').join(', ')}`
      : `Behåll – läget går enligt plan (${signRText(r)})`;
  return {
    status, sammanfattning, skal, pris, procU, r, bastaR, risk, stop, stopTyp, startStop, mal, malR,
    turboProc: pos.havstang ? procU * pos.havstang : null,
    senastT: staplar5[i5].t, dec, valuta,
    ind: { rsi5: rsi5[i5], rsi1: rsi1[i1], atr1: atrNu, ema9h: e9_1[i1], ema21h: e21_1[i1] },
  };
}

// Jämför två analyser av samma position och avgör vilka notiser som ska skickas.
export function positionsHandelser(forra, nu, pos, namn, tidNu = Date.now()) {
  const P = POSITION;
  const d = nu.dec ?? 2;
  const minne = { ...(forra?.minne || {}) };
  const rubrik = `${namn} (${pos.riktning === -1 ? 'kort' : 'lång'})`;
  const lage = `Läget: ${signProcent(nu.procU, 2)} på underliggande${nu.turboProc != null ? `, ca ${signProcent(nu.turboProc)} på turbon` : ''} (${signRText(nu.r)}). Pris ${tal(nu.pris, d)}.`;
  const forraKoder = new Set((forra?.skal || []).map((s) => s.kod));
  const ut = [];
  if (!forra) {
    ut.push({
      typ: 'start', prioritet: 2, titel: `Bevakar ${rubrik}`,
      text: `Stop ${tal(nu.stop, d)} · mål ${tal(nu.mal, d)}. Du får en notis när reglerna ger en säljsignal. ${lage}`,
    });
    minne.stopNotis = nu.stop;
  }
  // När säljsignalen redan gäller skickas bara nya skäl om barriären (knock-out); annars räcker påminnelserna.
  const nyaSalj = nu.skal.filter((s) => s.allvar === 'salj' && !forraKoder.has(s.kod) && (forra?.status !== 'SALJ' || s.kod === 'barriar'));
  const nyaVarn = nu.skal.filter((s) => s.allvar === 'varning' && !forraKoder.has(s.kod));
  if (nu.status === 'SALJ') {
    if (forra?.status !== 'SALJ' || nyaSalj.length) {
      ut.push({ typ: 'salj', prioritet: 5, titel: `Säljsignal: ${rubrik}`, text: [...nu.skal.filter((s) => s.allvar === 'salj').map((s) => s.text), lage].join('\n') });
      minne.saljT = tidNu; minne.paminnelser = 0;
    } else if (minne.saljT && tidNu - minne.saljT >= P.paminnelseMin * 60000 && (minne.paminnelser || 0) < P.maxPaminnelser) {
      ut.push({ typ: 'paminnelse', prioritet: 4, titel: `Påminnelse – säljsignal: ${rubrik}`, text: [nu.sammanfattning + '.', lage, 'Tryck på "Jag har sålt" i dashboarden när du har sålt.'].join('\n') });
      minne.saljT = tidNu; minne.paminnelser = (minne.paminnelser || 0) + 1;
    }
  } else {
    minne.saljT = null;
    // Samma varning skickas högst en gång per halvtimme, så att den inte tjatar när priset pendlar runt en nivå.
    const varnT = { ...(minne.varnT || {}) };
    const skickas = nyaVarn.filter((s) => !varnT[s.kod] || tidNu - varnT[s.kod] >= P.paminnelseMin * 60000);
    if (skickas.length) {
      ut.push({ typ: 'varning', prioritet: 4, titel: `Varning: ${rubrik}`, text: [...skickas.map((s) => s.text), lage].join('\n') });
      for (const s of skickas) varnT[s.kod] = tidNu;
    }
    minne.varnT = varnT;
    const stopFlyttad = nu.stopTyp !== 'start' && (nu.stopTyp !== forra?.stopTyp ||
      (nu.stopTyp === 'släpande' && minne.stopNotis != null && (nu.stop - minne.stopNotis) * (pos.riktning === -1 ? -1 : 1) >= P.stopFlyttR * nu.risk));
    if (forra && stopFlyttad) {
      ut.push({
        typ: 'stop', prioritet: 3, titel: `Flytta stoppen: ${rubrik}`,
        text: nu.stopTyp === 'break-even'
          ? `Affären har som mest gått ${signRText(nu.bastaR)}. Flytta stoppen till köppriset ${tal(nu.stop, d)}, så kan den inte bli en förlust. ${lage}`
          : `Ny släpande stop: ${tal(nu.stop, d)}. ${lage}`,
      });
      minne.stopNotis = nu.stop;
    }
  }
  nu.minne = minne;
  return ut;
}
