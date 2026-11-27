// Lagring för ekonomisidan.
// - Lokalt: i webbläsaren (localStorage), alltid som snabb kopia.
// - Synkat: krypterat med din lösenfras (AES-GCM, nyckel från PBKDF2) i docs/data/ekonomi.krypterad.json i repot,
//   via din GitHub-nyckel. Repot är publikt, men filen går inte att läsa utan lösenfrasen.

export const EKONOMI_FIL = 'docs/data/ekonomi.krypterad.json';
const NYCKEL_DATA = 'guldbot.ekonomi.data';
const NYCKEL_KO = 'guldbot.ekonomi.ko';
const NYCKEL_LOSEN = 'guldbot.ekonomi.losen';
const ITERATIONER = 250000;

export function tomEkonomi() {
  return { version: 2, uppdaterad: null, konton: [], affarer: [], poster: [], transaktioner: [], regler: [], mal: [], installningar: {} };
}

export const nyttId = (prefix = 'x') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Läser in data från alla versioner. Version 1 hade en budget med fasta månadsbelopp och en separat lista
// med framtida utgifter; de blir nu planerade poster.
export function normalisera(d) {
  const t = tomEkonomi();
  if (!d || typeof d !== 'object') return t;
  const ut = {
    ...t, ...d,
    konton: Array.isArray(d.konton) ? d.konton.map((k) => ({ varden: [], transaktioner: [], ...k })) : [],
    affarer: Array.isArray(d.affarer) ? d.affarer : [],
    poster: Array.isArray(d.poster) ? d.poster : [],
    transaktioner: Array.isArray(d.transaktioner) ? d.transaktioner : [],
    regler: Array.isArray(d.regler) ? d.regler : [],
    mal: Array.isArray(d.mal) ? d.mal : [],
    installningar: { ...(d.installningar || {}) },
  };
  if (!Array.isArray(d.poster)) {
    const b = d.budget || {};
    for (const x of b.inkomster || []) ut.poster.push({ id: x.id || nyttId('p'), typ: 'inkomst', namn: x.namn, belopp: Number(x.belopp) || 0, kategori: 'Övrigt', frekvens: 'manad', start: null, slut: null });
    for (const x of b.utgifter || []) ut.poster.push({ id: x.id || nyttId('p'), typ: 'utgift', namn: x.namn, belopp: Number(x.belopp) || 0, kategori: x.kategori || 'Övrigt', frekvens: 'manad', start: null, slut: null });
    for (const x of d.utgifter || []) ut.poster.push({ id: x.id || nyttId('p'), typ: 'utgift', namn: x.namn, belopp: Number(x.belopp) || 0, kategori: 'Övrigt', frekvens: x.aterkommande === 'ar' ? 'ar' : 'en-gang', start: x.datum, slut: null, sparaIhop: true, sparat: Number(x.sparat) || 0 });
  }
  delete ut.budget;
  delete ut.utgifter;
  ut.version = 2;
  return ut;
}

// ---------- Kryptering ----------
function tillB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function franB64(text) {
  const s = atob(text);
  const ut = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) ut[i] = s.charCodeAt(i);
  return ut;
}
const nyckelMinne = new Map();
async function harledNyckel(losen, salt) {
  const id = `${losen}|${tillB64(salt)}`;
  if (nyckelMinne.has(id)) return nyckelMinne.get(id);
  const bas = await crypto.subtle.importKey('raw', new TextEncoder().encode(losen), 'PBKDF2', false, ['deriveKey']);
  const nyckel = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONER, hash: 'SHA-256' }, bas, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
  nyckelMinne.set(id, nyckel);
  return nyckel;
}

export async function kryptera(data, losen, saltB64 = null) {
  const salt = saltB64 ? franB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const nyckel = await harledNyckel(losen, salt);
  const chiffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, nyckel, new TextEncoder().encode(JSON.stringify(data)));
  return { format: 'guldbot-ekonomi', v: 1, kdf: `PBKDF2-SHA256-${ITERATIONER}`, salt: tillB64(salt), iv: tillB64(iv), data: tillB64(new Uint8Array(chiffer)) };
}

export async function dekryptera(kuvert, losen) {
  if (!kuvert || kuvert.format !== 'guldbot-ekonomi') throw new Error('Filen är inte en Guldbot-ekonomifil.');
  try {
    const nyckel = await harledNyckel(losen, franB64(kuvert.salt));
    const klartext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: franB64(kuvert.iv) }, nyckel, franB64(kuvert.data));
    return JSON.parse(new TextDecoder().decode(klartext));
  } catch {
    throw new Error('Fel lösenfras.');
  }
}

// ---------- Lokalt ----------
const sakert = (f, std) => { try { return f(); } catch { return std; } };
export { tillampa as tillampaKo };
export const lokal = {
  las() { return sakert(() => { const t = localStorage.getItem(NYCKEL_DATA); return t ? normalisera(JSON.parse(t)) : null; }, null); },
  spara(d) { sakert(() => localStorage.setItem(NYCKEL_DATA, JSON.stringify(d))); },
  rensa() { sakert(() => localStorage.removeItem(NYCKEL_DATA)); },
  losen() { return sakert(() => localStorage.getItem(NYCKEL_LOSEN) || sessionStorage.getItem(NYCKEL_LOSEN) || '', ''); },
  sparaLosen(losen, komIhag) {
    sakert(() => { sessionStorage.setItem(NYCKEL_LOSEN, losen); if (komIhag) localStorage.setItem(NYCKEL_LOSEN, losen); else localStorage.removeItem(NYCKEL_LOSEN); });
  },
  glomLosen() { sakert(() => { sessionStorage.removeItem(NYCKEL_LOSEN); localStorage.removeItem(NYCKEL_LOSEN); }); },
  komIhag() { return sakert(() => Boolean(localStorage.getItem(NYCKEL_LOSEN)), false); },
  ko() { return sakert(() => JSON.parse(localStorage.getItem(NYCKEL_KO) || '[]'), []); },
  koa(affar) { const k = this.ko(); k.push(affar); sakert(() => localStorage.setItem(NYCKEL_KO, JSON.stringify(k))); },
  tomKo() { sakert(() => localStorage.removeItem(NYCKEL_KO)); },
};

// ---------- I repot (krypterat) ----------
export async function lasMoln(gh, losen) {
  let kuvert;
  try { kuvert = await gh.lasFil(EKONOMI_FIL); } catch (e) { if (e.status === 404) return null; throw e; }
  return { kuvert, data: normalisera(await dekryptera(kuvert, losen)) };
}

export async function finnsIMoln(gh) {
  try { await gh.anrop(`/contents/${EKONOMI_FIL}`); return true; } catch (e) { if (e.status === 404) return false; throw e; }
}

export async function sparaMoln(gh, data, losen, saltB64) {
  const kuvert = await kryptera(data, losen, saltB64);
  await gh.skrivFil(EKONOMI_FIL, kuvert, 'Ekonomi uppdaterad (krypterad)');
  return kuvert;
}

// Lägger till en avslutad affär. Finns ett öppet köp med samma Guldbot-position stängs det i stället.
export function laggTillAffarIData(data, affar) {
  const oppen = affar.posId && data.affarer.find((a) => a.posId === affar.posId && a.oppen);
  if (oppen) {
    Object.assign(oppen, { ...affar, insats: affar.insats ?? oppen.insats, kopDatum: oppen.kopDatum, oppen: false, id: oppen.id });
    data.uppdaterad = new Date().toISOString();
    return true;
  }
  if (affar.posId && data.affarer.some((a) => a.posId === affar.posId)) return false;
  data.affarer.push({ id: nyttId('a'), ...affar, oppen: false });
  data.uppdaterad = new Date().toISOString();
  return true;
}

// Ett öppet köp (från "Jag köpte" i Guldbot eller Köp på ekonomisidan).
export function laggTillKopIData(data, kop) {
  if (kop.posId && data.affarer.some((a) => a.posId === kop.posId)) return false;
  data.affarer.push({ id: nyttId('a'), ...kop, oppen: true, resultat: null, datum: null });
  data.uppdaterad = new Date().toISOString();
  return true;
}

// Anropas från Guldbot-dashboarden när du trycker "Jag har sålt" och anger belopp.
// Returnerar 'moln', 'lokal' eller 'ko' (sparas när du öppnar Ekonomi och låser upp).
export async function registreraAffar(affar, gh) { return registrera({ ...affar, _typ: 'salj' }, gh); }
export async function registreraKop(kop, gh) { return registrera({ ...kop, _typ: 'kop' }, gh); }

function tillampa(data, post) {
  const { _typ, ...rest } = post;
  return _typ === 'kop' ? laggTillKopIData(data, rest) : laggTillAffarIData(data, rest);
}

async function registrera(affar, gh) {
  const losen = lokal.losen();
  if (gh?.aktiv()) {
    let finns = false;
    try { finns = await finnsIMoln(gh); } catch { finns = true; }
    if (finns && losen) {
      try {
        const m = await lasMoln(gh, losen);
        tillampa(m.data, affar);
        await sparaMoln(gh, m.data, losen, m.kuvert.salt);
        lokal.spara(m.data);
        return 'moln';
      } catch (e) {
        console.warn('Kunde inte spara affären i Ekonomi:', e);
      }
    }
    if (finns) { lokal.koa(affar); return 'ko'; }
  }
  const d = lokal.las() || tomEkonomi();
  tillampa(d, affar);
  lokal.spara(d);
  return 'lokal';
}
