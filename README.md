# Guldbot

Guldbot analyserar guldpriset (XAU/USD) dygnet runt, skickar notiser till mobilen när ett läge dyker upp och visar allt på en dashboard som du öppnar i mobilen. Köp och sälj sköter du själv.

- **Molnet (varje timme):** GitHub kör analysen gratis varje timme, även när din dator är avstängd.
- **Live (när du tradar):** Öppna dashboarden och tryck på *Live*. Då analyseras priset varje minut på 5-minuters-, 15-minuters- eller timstaplar, och du kan få notiser medan du sitter med det.

> Guldbot visar vad fasta tekniska regler säger. Det är inte investeringsrådgivning, och historiska resultat är ingen garanti för framtiden.

---

## Installation (ca 15 minuter, allt gratis)

### 1. Skapa ett repo på GitHub
1. Skapa ett konto på [github.com](https://github.com) om du inte har ett.
2. Klicka **New repository**. Döp det till `guldbot`, välj **Public** och klicka **Create repository**.
   *Publikt behövs för att dashboarden ska vara gratis. Nycklarna ligger aldrig i koden, men analyserna går att se för den som hittar repot.*
3. Klicka **uploading an existing file** och dra in **allt innehåll** i guldbot-mappen. Kontrollera att mappen `.github` följer med.
   *På Mac är mappar som börjar med punkt dolda i Finder. Visa dem med Cmd + Shift + punkt. Om `.github` ändå inte följer med: klicka **Add file → Create new file**, skriv `.github/workflows/guldanalys.yml` som namn och klistra in innehållet från filen.*
4. Klicka **Commit changes**.

### 2. Hämta en gratis nyckel för prisdata
1. Skapa ett gratis konto på [twelvedata.com](https://twelvedata.com/register). Inget kort krävs.
2. Kopiera din API-nyckel från sidan *API Keys*.

Gratisnivån ger 800 anrop per dygn. Molnet använder 24 per dygn och live-läget ett per minut, så du kan köra live ungefär 12 timmar om dagen.

### 3. Installera notisappen
1. Ladda ner **ntfy** från App Store eller Google Play.
2. Tryck **+** och prenumerera på ett ämne som är svårt att gissa, till exempel:
   `guld-f8r6gvlp9tel`
   Ämnet fungerar som ett lösenord: den som känner till det kan läsa dina notiser.

### 4. Lägg in nycklarna som hemligheter
I repot: **Settings → Secrets and variables → Actions → New repository secret**. Skapa två:

| Namn | Värde |
|---|---|
| `TWELVEDATA_API_KEY` | nyckeln från Twelve Data |
| `NTFY_TOPIC` | ditt ntfy-ämne, t.ex. `guld-f8r6gvlp9tel` |

### 5. Slå på dashboarden
**Settings → Pages → Build and deployment**: välj *Deploy from a branch*, branch **main** och mapp **/docs**. Klicka **Save**.
Dashboarden hamnar på `https://DITT-ANVÄNDARNAMN.github.io/guldbot/`.

### 6. Starta boten
**Actions** → (godkänn Actions om GitHub frågar) → **Guldanalys** → **Run workflow**.
Inom ett par minuter får du notisen *"Guldboten är igång"*, och dashboarden visar den första analysen. Därefter körs analysen automatiskt varje timme.

### 7. Gör dashboarden till en app i mobilen
Öppna dashboardens adress i Safari eller Chrome → **Dela → Lägg till på hemskärmen**.
Under **Inställningar** i dashboarden kan du lägga in:
- **Twelve Data-nyckeln**, som behövs för live-läget
- **ntfy-ämnet**, om du vill få notiser under live-läget
- **ditt tradingkapital**, så räknar dashboarden ut en ungefärlig insats per affär

Allt detta sparas bara i den webbläsaren.

---

## Så fungerar signalerna

Grundsignalen är att det snabba glidande medelvärdet (EMA 9) korsar det långsamma (EMA 21). De tre risknivåerna ställer olika krav:

| | Låg risk | Medelrisk | Hög risk |
|---|---|---|---|
| Priset på rätt sida om trend-EMA 100 | ja | ja | nej |
| Trend-EMA lutar åt samma håll | ja | nej | nej |
| Trendstyrka (ADX) minst | 22 | 18 | – |
| RSI för lång / kort | 50–68 / 32–50 | 45–72 / 28–55 | 40–78 / 22–60 |
| Stop-loss | 2 ATR | 1,5 ATR | 1 ATR |
| Mål | 2R | 2R | 2R |
| Risk per affär | 0,5 % av kapitalet | 1 % | 2 % |
| Högsta turbohävstång | 5x | 10x | 20x |

Ett läge stängs vid stop-loss, mål eller när EMA-linjerna korsar åt andra hållet. *ATR* är hur mycket priset normalt rör sig per stapel. *1R* är det du riskerar per affär.

**Notiser du kan få:**
- 📈/📉 **Nytt läge** med pris, stop-loss, mål och ungefär högsta hävstång för en turbo.
- 👀 **Möjligt läge på väg:** EMA-linjerna närmar sig en korsning och trendkraven är uppfyllda. Läge att titta in.
- 🏁 **Läget stängt**, med resultat i R.

**Turbohävstången** räknas så att turbons barriär hamnar minst 25 % längre bort än stop-lossen. Det är en uppskattning. Kontrollera alltid den faktiska barriären hos Avanza innan du köper. Turbon handlas i kronor och kan följa terminspriset i stället för spotpriset, så den rör sig inte exakt som XAU/USD.

---

## Anpassa

**Färre notiser:** Skapa variabler under **Settings → Secrets and variables → Actions → Variables**:
- `NOTISNIVAER` = `medel,hog` ger bara notiser för de nivåerna (standard är `lag,medel,hog`).
- `NOTIS_SETUP` = `nej` stänger av notiserna om möjligt läge på väg.

**Ändra reglerna:** Allt finns i `docs/engine.js` under `NIVAER` och `STANDARD`. Både molnet och dashboarden använder samma fil. Kör `npm test` efteråt (kräver Node 20 eller senare) för att se att allt fungerar.

**Kör analysen direkt:** Actions → Guldanalys → Run workflow. Det fungerar även i GitHubs mobilapp.

---

## Bra att veta

- GitHubs schemalagda körningar kan vara några minuter sena när det är mycket trafik.
- Signaler räknas bara på stängda staplar. En timsignal kommer alltså strax efter att timmen har stängt.
- Om Twelve Data inte svarar används Yahoo Finance som reserv (terminskontraktet GC=F). Dashboarden visar vilken källa som användes.
- Om prisdata inte går att hämta får du en notis, och dashboarden visar den senaste lyckade analysen.
- GitHub kan pausa schemalagda körningar i repon som inte har haft någon aktivitet på 60 dagar. Boten sparar en ny analys varje timme, men om körningarna ändå stannar slår du på dem igen under **Actions**.
- Historiken på dashboarden räknar med 0,04 % i kostnad per affär. En turbos spread är ofta större.

## Filer

| Fil | Vad den gör |
|---|---|
| `docs/engine.js` | Analysmotorn: indikatorer, regler, risknivåer, historiktest och notistexter |
| `docs/index.html` | Dashboarden, med live-läge |
| `docs/data.json` | Senaste molnanalysen. Skapas av boten, så rör den inte |
| `scripts/run.mjs` | Molnskriptet som GitHub kör varje timme |
| `.github/workflows/guldanalys.yml` | Schemat: varje timme plus en knapp för att köra direkt |
| `scripts/test.mjs` | Självtest på syntetiska priser (`npm test`) |
