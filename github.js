// GitHub-hjälpare för sidorna: läser och skriver filer i repot och startar körningar, med din egen nyckel.
// Nyckeln och inställningarna sparas bara i webbläsaren.
export const lager = {
  hamta(k, std = '') { try { return localStorage.getItem('guldbot.' + k) ?? std; } catch { return std; } },
  spara(k, v) { try { localStorage.setItem('guldbot.' + k, v); } catch { /* privat läge */ } },
};

// ---------- GitHub (din egen nyckel, sparas bara i webbläsaren) ----------
export function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export const sov = (ms) => new Promise((r) => setTimeout(r, ms));
export const gh = {
  repo() {
    const sparad = lager.hamta('repo').trim();
    if (sparad) return sparad;
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!m) return '';
    const forsta = location.pathname.split('/').filter(Boolean)[0];
    return forsta && !forsta.includes('.') ? `${m[1]}/${forsta}` : `${m[1]}/${m[1]}.github.io`;
  },
  nyckel() { return lager.hamta('ghnyckel').trim(); },
  aktiv() { return Boolean(this.nyckel() && this.repo()); },
  async anrop(sokvag, { metod = 'GET', kropp, raw = false } = {}) {
    const svar = await fetch(`https://api.github.com/repos/${this.repo()}${sokvag}`, {
      method: metod,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${this.nyckel()}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(kropp ? { 'Content-Type': 'application/json' } : {}),
      },
      body: kropp ? JSON.stringify(kropp) : undefined,
    });
    if (!svar.ok) {
      let msg = `GitHub svarade ${svar.status}`;
      try { const j = await svar.json(); if (j.message) msg += `: ${j.message}`; } catch { /* inget */ }
      if (svar.status === 401) msg = 'GitHub-nyckeln fungerar inte (ogiltig eller utgången). Kontrollera den under Inställningar.';
      if (svar.status === 403 || (svar.status === 404 && metod !== 'GET')) msg += ' – kontrollera att nyckeln har behörigheterna Contents och Actions för repot.';
      const e = new Error(msg); e.status = svar.status; throw e;
    }
    if (svar.status === 204) return null;
    return raw ? svar.text() : svar.json();
  },
  async lasFil(sokvag) { return JSON.parse(await this.anrop(`/contents/${sokvag}`, { raw: true })); },
  async skrivFil(sokvag, data, meddelande) {
    for (let forsok = 0; forsok < 3; forsok++) {
      let sha;
      try { sha = (await this.anrop(`/contents/${sokvag}`)).sha; } catch (e) { if (e.status !== 404) throw e; }
      try {
        return await this.anrop(`/contents/${sokvag}`, { metod: 'PUT', kropp: { message: meddelande, content: base64(JSON.stringify(data, null, 1)), sha } });
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
        await sov(1000);
      }
    }
    throw new Error('Kunde inte spara i GitHub. Försök igen.');
  },
  async gren() {
    if (!this._gren) this._gren = (await this.anrop('')).default_branch || 'main';
    return this._gren;
  },
  async starta(workflow, inputs) {
    const kropp = { ref: await this.gren() };
    if (inputs) kropp.inputs = inputs;
    await this.anrop(`/actions/workflows/${workflow}/dispatches`, { metod: 'POST', kropp });
  },
  async senasteKorning(workflow, efter) {
    const j = await this.anrop(`/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=5`);
    return (j.workflow_runs || []).find((r) => Date.parse(r.created_at) >= efter - 30000) || null;
  },
};