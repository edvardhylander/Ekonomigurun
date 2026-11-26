// Körs av GitHub Actions.
//   LAGE=timme  varje timme: kortsiktiga lägen (timstaplar) för alla instrument i docs/bevakning.json
//   LAGE=dag    en gång per dygn: längre köplägen (dagsstaplar)
//   LAGE=båda   båda (används när du startar körningen för hand)
// Resultatet sparas i docs/data/ och visas i dashboarden. Notiser skickas via ntfy.
import {
  analysera, analyseraLangre, handelser, handelserLangre, grupperaHandelser,
  taBortPagaende, taBortPagaendeDag, tal,
} from '../docs/engine.js';
import {
  NYCKEL, NOTISNIVAER, NOTIS_SETUP, NOTIS_LANGRE, LAGE, TVINGA, TESTDATA, NU, NU_ISO, BEVAKNING, DASHBOARD,
  lasJson, skrivJson, hamta, stada, marknadOppen, skickaHandelser, loggaHandelser,
} from './gemensam.mjs';

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
