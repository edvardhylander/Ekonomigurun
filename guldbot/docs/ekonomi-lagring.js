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
  return { version: 1, uppdaterad: null, konton: [], affarer: [], budget: { inkomster: [], utgifter: [], utfall: {} }, mal: [], utgifter: [] };
}

export function normalisera(d) {
  const t = tomEkonomi();
  if (!d || typeof d !== 'object') return t;
  return {
    ...t, ...d,
    konton: Array.isArray(d.konton) ? d.konton.map((k) => ({ varden: [], transaktioner: [], ...k })) : [],
    affarer: Array.isArray(d.affarer) ? d.affarer : [],
    budget: { ...t.budget, ...(d.budget || {}), utfall: { ...((d.budget || {}).utfall || {}) } },
    mal: Array.isArray(d.mal) ? d.mal : [],
    utgifter: Array.isArray(d.utgifter) ? d.utgifter : [],
  };
}

export const nyttId = (prefix = 'x') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

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

export function laggTillAffarIData(data, affar) {
  if (affar.posId && data.affarer.some((a) => a.posId === affar.posId)) return false;
  data.affarer.push({ id: nyttId('a'), ...affar });
  data.uppdaterad = new Date().toISOString();
  return true;
}

// Anropas från Guldbot-dashboarden när du trycker "Jag har sålt" och anger belopp.
// Returnerar 'moln', 'lokal' eller 'ko' (sparas när du öppnar Ekonomi och låser upp).
export async function registreraAffar(affar, gh) {
  const losen = lokal.losen();
  if (gh?.aktiv()) {
    let finns = false;
    try { finns = await finnsIMoln(gh); } catch { finns = true; }
    if (finns && losen) {
      try {
        const m = await lasMoln(gh, losen);
        laggTillAffarIData(m.data, affar);
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
  laggTillAffarIData(d, affar);
  lokal.spara(d);
  return 'lokal';
}
