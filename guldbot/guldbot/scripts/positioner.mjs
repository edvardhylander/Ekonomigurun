// Bevakar dina registrerade positioner (docs/positioner.json) på 5-minutersstaplar och skickar notis när reglerna
// ger en säljsignal, en varning eller när stoppen ska flyttas. Körs av GitHub Actions i upp till ~6 timmar åt gången
// så länge det finns öppna positioner, och startas om varje timme samt när du registrerar ett köp i dashboarden.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { analyseraPosition, positionsHandelser, taBortPagaende } from '../docs/engine.js';
import {
  env, NYCKEL, TESTDATA, BEVAKNING, DASHBOARD, lasJson, skrivJson, vanta, hamta, stada, marknadOppen,
  skickaNotis, loggaHandelser,
} from './gemensam.mjs';

const MAX_MIN = Number(env('MAXMIN', '340'));   // hur länge en körning får loopa (GitHub tillåter 6 timmar)
const ENGANG = env('ENGANG') === 'ja';          // bara ett varv (för test)
const GIT = env('GIT', TESTDATA ? 'nej' : 'ja') === 'ja';
const KLOCKA = () => (env('NU') ? Number(env('NU')) : Date.now());
const POSFIL = new URL('../docs/positioner.json', import.meta.url);

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function hamtaSenaste() {
  if (!GIT) return;
  try { git('pull', '--rebase', '--autostash', '--quiet'); } catch (e) { console.warn(`git pull misslyckades: ${e.message.split('\n')[0]}`); }
}
function sparaOchPusha(meddelande) {
  if (!GIT) return;
  try {
    git('add', 'docs/data/positionsstatus.json', 'docs/data/positionslogg.json');
    try { git('diff', '--cached', '--quiet'); return; } catch { /* det finns ändringar */ }
    git('commit', '-m', meddelande, '--quiet');
    for (let forsok = 0; forsok < 3; forsok++) {
      try { git('push', '--quiet'); return; } catch { git('pull', '--rebase', '--autostash', '--quiet'); }
    }
  } catch (e) {
    console.warn(`Kunde inte spara: ${e.message.split('\n')[0]}`);
  }
}

function lasPositioner() {
  try {
    if (!existsSync(POSFIL)) return [];
    const p = JSON.parse(readFileSync(POSFIL, 'utf8'));
    return (p.positioner || []).filter((x) => x && x.id && x.instrument && Number.isFinite(x.inPris) && x.inT);
  } catch (e) {
    console.warn(`Kunde inte läsa positioner.json: ${e.message}`);
    return [];
  }
}

async function main() {
  const start = KLOCKA();
  const nastaKoll = {};
  let senastSparad = 0;
  let andrat = false;
  for (;;) {
    hamtaSenaste();
    const lista = lasPositioner();
    const status = lasJson('positionsstatus.json') || { positioner: {} };
    for (const id of Object.keys(status.positioner)) {
      if (!lista.some((p) => p.id === id)) { delete status.positioner[id]; andrat = true; }
    }
    const nu = KLOCKA();
    if (!lista.length) {
      status.uppdaterad = new Date(nu).toISOString();
      skrivJson('positionsstatus.json', status);
      if (andrat) sparaOchPusha('Positioner: inga öppna');
      console.log('Inga öppna positioner – avslutar.');
      break;
    }

    // Twelve Data: högst ca 20 anrop per timme totalt för positionerna, så att dygnsgränsen räcker.
    const antalTd = lista.filter((p) => BEVAKNING.find((b) => b.id === p.instrument)?.kalla === 'twelvedata').length;
    const nya = [];
    for (const pos of lista) {
      const ins = BEVAKNING.find((b) => b.id === pos.instrument);
      if (!ins) { console.warn(`Okänt instrument i positioner.json: ${pos.instrument}`); continue; }
      if (nastaKoll[pos.id] && nu < nastaKoll[pos.id]) continue;
      const intervallMin = ins.kalla === 'twelvedata' && NYCKEL ? 3 * antalTd : 2;
      nastaKoll[pos.id] = nu + (marknadOppen(ins.handelstid, nu) || TESTDATA ? intervallMin : 30) * 60000;
      try {
        const { kalla, staplar } = await hamta(ins, '5min');
        const alla = stada(staplar);
        const stangda = taBortPagaende(alla, 5, TESTDATA ? Infinity : nu);
        const forra = status.positioner[pos.id];
        const a = analyseraPosition(pos, stangda, {
          dec: ins.dec ?? 2, valuta: ins.valuta || '', prisNu: alla.at(-1).c, kostnadProc: ins.kostnadProc ?? 0.04, risk: forra?.risk,
        });
        if (forra && !forra.fel && forra.senastT === a.senastT && forra.pris === a.pris) continue; // inget nytt sedan sist
        const handelser = positionsHandelser(forra?.fel ? null : forra, a, pos, ins.namn, nu)
          .map((h) => ({ ...h, id: ins.id, position: true }));
        nya.push(...handelser);
        status.positioner[pos.id] = { ...a, posId: pos.id, instrument: ins.id, namn: ins.namn, kalla, uppdaterad: new Date(nu).toISOString() };
        if (!forra || forra.status !== a.status || handelser.length) andrat = true;
        console.log(`${ins.namn} (${pos.riktning === -1 ? 'kort' : 'lång'}): ${a.sammanfattning}`);
      } catch (e) {
        console.warn(`${ins.namn}: ${e.message}`);
        status.positioner[pos.id] = { ...(status.positioner[pos.id] || {}), posId: pos.id, instrument: ins.id, namn: ins.namn, fel: e.message, uppdaterad: new Date(nu).toISOString() };
      }
    }

    for (const h of nya) {
      await skickaNotis({
        titel: h.titel, text: h.text, prioritet: h.prioritet,
        taggar: [{ salj: 'rotating_light', paminnelse: 'rotating_light', varning: 'warning', stop: 'shield', start: 'eyes' }[h.typ] || 'eyes'],
        klick: DASHBOARD ? `${DASHBOARD}#${h.id}` : '',
      });
    }
    loggaHandelser(nya, 'positionslogg.json', new Date(nu).toISOString());
    status.uppdaterad = new Date(nu).toISOString();
    skrivJson('positionsstatus.json', status);
    if (andrat || nu - senastSparad > 10 * 60000) {
      sparaOchPusha(`Positioner ${new Date(nu).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
      senastSparad = nu;
      andrat = false;
    }

    if (ENGANG || KLOCKA() - start > MAX_MIN * 60000) break;
    const nasta = Math.min(...Object.values(nastaKoll));
    await vanta(Math.max(30000, nasta - KLOCKA()));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
