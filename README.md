# Guldbot

Guldbot bevakar 23 marknader dygnet runt: guld, silver, olja, valutor, index, aktier och krypto. Den skickar notiser till mobilen när ett läge dyker upp och visar allt på en dashboard som du öppnar i mobilen. Köp och sälj sköter du själv.

- **Kortsiktiga lägen (varje timme):** Samma regler som för guldet, på timstaplar, för alla instrument. Tre risknivåer: låg, medel och hög.
- **Längre lägen (varje morgon):** Ett eget regelset på dagsstaplar som letar köplägen med horisont på veckor till månader.
- **Live (när du tradar):** Välj ett instrument i dashboarden och tryck på *Live*. Då analyseras det varje minut på 5-minuters-, 15-minuters- eller timstaplar.

> Guldbot visar vad fasta tekniska regler säger. Det är inte investeringsrådgivning, och historiska resultat är ingen garanti för framtiden.

---

## Uppgradera från guldversionen

Har du redan Guldbot igång för guld? Då behåller du repot, hemligheterna och ntfy-ämnet. Gör så här:

1. I repot på GitHub: **Add file → Upload files**. Dra in alla filer från den nya mappen och klicka **Commit changes**. Befintliga filer med samma namn ersätts.
   Kontrollera efteråt att `.github/workflows/guldanalys.yml` och den nya filen `docs/bevakning.json` finns i repot.
2. Ta bort `docs/data.json` om du vill. Den används inte längre, eftersom analyserna nu sparas i mappen `docs/data/`.
3. **Actions → Guldanalys → Run workflow**, välj **båda** och klicka på den gröna knappen.

Efter några minuter får du två notiser, *"Guldboten bevakar nu 23 instrument"* och *"Längre lägen: bevakningen är igång"*. Dashboarden visar då alla instrument.

---

## Installation från början (ca 15 minuter, allt gratis)

### 1. Skapa ett repo på GitHub
1. Skapa ett konto på [github.com](https://github.com) om du inte har ett.
2. Klicka **New repository**. Döp det till `guldbot`, välj **Public** och klicka **Create repository**.
   *Publikt behövs för att dashboarden ska vara gratis. Nycklarna ligger aldrig i koden, men analyserna går att se för den som hittar repot.*
3. Klicka **uploading an existing file**, dra in **allt innehåll** i guldbot-mappen och klicka **Commit changes**.
   *På Mac är mappar som börjar med punkt dolda i Finder. Visa dem med Cmd + Shift + punkt. Om `.github` ändå inte följer med: klicka **Add file → Create new file**, skriv `.github/workflows/guldanalys.yml` som namn och klistra in innehållet från filen.*

### 2. Hämta en gratis nyckel för prisdata
Skapa ett gratis konto på [twelvedata.com](https://twelvedata.com/register) och kopiera din API-nyckel.

### 3. Installera notisappen
Ladda ner **ntfy** (App Store eller Google Play). Tryck **+** och prenumerera på ett ämne som är svårt att gissa, till exempel `guld-f8r6gvlp9tel`. Ämnet fungerar som ett lösenord.

### 4. Lägg in nycklarna som hemligheter
**Settings → Secrets and variables → Actions → New repository secret**:

| Namn | Värde |
|---|---|
| `TWELVEDATA_API_KEY` | nyckeln från Twelve Data |
| `NTFY_TOPIC` | ditt ntfy-ämne |

### 5. Slå på dashboarden
**Settings → Pages**: välj *Deploy from a branch*, branch **main** och mapp **/docs**. Klicka **Save**.
Adressen blir `https://DITT-ANVÄNDARNAMN.github.io/guldbot/`.

### 6. Starta boten
**Actions → Guldanalys → Run workflow**, välj **båda** och kör. Därefter går den automatiskt: kortsiktigt varje timme och längre lägen varje morgon.

### 7. Lägg dashboarden på hemskärmen
Öppna adressen i mobilen → **Dela → Lägg till på hemskärmen**. Under **Inställningar** i dashboarden kan du lägga in Twelve Data-nyckeln (för live-läget), ntfy-ämnet (för notiser i live-läget) och ditt kapital, som används för att räkna ut ungefärlig insats per affär.

---

## Dashboarden

- **Alla instrument** visar pris, förändring senaste dygnet och lägen för varje instrument. Instrument med lägen hamnar överst. Brickorna betyder:
  - **L / M / H** är låg, medel och hög risk på timstaplar. ▲ är lång, ▼ kort och ◎ ett möjligt läge på väg.
  - **Längre** är köplägen på dagsstaplar.
- Tryck på ett instrument för detaljer: risknivåkort, längre läge med dagsgraf, timgraf, analys, senaste signaler och historik.
- Notiser från boten länkar direkt till rätt instrument.
- **Live** finns för instrument som hämtas från Twelve Data: guld, silver, valutorna, USA-aktierna och krypto.

---

## Reglerna

### Kortsiktiga lägen (timstaplar)
Grundsignalen är att EMA 9 korsar EMA 21. De tre risknivåerna ställer olika krav:

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

Ett läge stängs vid stop-loss, mål eller motsatt korsning. Turbohävstången är ungefärlig. Den räknas så att barriären hamnar minst 25 % längre bort än stop-lossen, så kontrollera alltid den faktiska barriären hos Avanza.

### Längre lägen (dagsstaplar)
Köpläge när priset är i upptrend (över SMA 200, som stiger, och SMA 50 över SMA 200) och något av följande gäller:
- **Rekyl i upptrend:** RSI har varit under 40 den senaste veckan, och priset stänger nu tillbaka över EMA 20.
- **Gyllene kors:** SMA 50 korsar över SMA 200.

Stop-lossen sätts 3 ATR under köpet och flyttas upp när priset stiger (högsta pris sedan köpet minus 3 ATR). Det finns inget fast mål. Läget stängs när stop-lossen nås. Historiken för varje instrument visas i dashboarden. Lita mer på instrument där reglerna har gått plus.

---

## Notiser

| Notis | Prioritet i ntfy |
|---|---|
| 📈/📉 Nytt kortsiktigt läge, 💰 nytt längre köpläge | hög |
| 🏁 Läget stängt, med resultat | normal |
| 👀 Möjligt läge på väg | låg (tyst) |

- Kommer fler än tre händelser i samma körning samlas de i **en** notis, så att mobilen inte plingar tio gånger i rad.
- Notisen om möjligt läge kommer högst en gång per riktning inom sex timmar (en gång per vecka för längre lägen).
- Om ett instrument inte går att hämta får du en notis första gången det händer.

**Färre notiser?** Skapa variabler under **Settings → Secrets and variables → Actions → Variables**:

| Variabel | Exempel | Effekt |
|---|---|---|
| `NOTISNIVAER` | `medel,hog` | bara notiser för de risknivåerna (standard `lag,medel,hog`) |
| `NOTIS_SETUP` | `nej` | inga notiser om möjligt läge på väg |
| `NOTIS_LANGRE` | `nej` | inga notiser om längre lägen |

---

## Datakällor och anrop

Twelve Datas gratisnivå täcker USA-aktier, valutor (där guld och silver räknas in) och krypto. Index, svenska aktier och olja hämtas därför från Yahoo Finance. Yahoo är en inofficiell källa som kan sluta fungera utan förvarning, och då får du en notis. Instrument från Twelve Data har Yahoo som reserv.

Gratisnivån ger 800 anrop per dygn och 8 per minut. Boten hämtar bara instrument vars marknad är öppen (aktier och index under börstid, valutor och råvaror på vardagar, krypto dygnet runt). Molnet använder därför ungefär 210 anrop per dygn, och live-läget ett per minut. Det räcker till ungefär 9 timmar live per dag.

---

## Bevakningslistan

Instrumenten står i `docs/bevakning.json`. Lägg till, ta bort eller ändra rader där.

| Fält | Betydelse |
|---|---|
| `id` | kort namn utan mellanslag, används i filnamn och länkar |
| `namn`, `grupp` | det som visas i dashboarden. Grupp: `Råvaror och valutor`, `Index`, `Aktier` eller `Krypto` |
| `kalla` | `twelvedata` eller `yahoo` |
| `symbol` | symbolen hos källan, t.ex. `AAPL` och `EUR/USD` hos Twelve Data, eller `VOLV-B.ST` och `^OMX` hos Yahoo |
| `reserv` | Yahoo-symbol som används om Twelve Data inte svarar (valfri) |
| `handelstid` | `us`, `eu`, `fx` eller `dygnet`, som styr när instrumentet hämtas |
| `valuta`, `dec` | valuta eller enhet som visas, och antal decimaler |
| `kostnadProc` | antagen kostnad per affär i procent, används i historiken |

Exempel: lägg till Evolution med raden
`{ "id": "evolution", "namn": "Evolution", "grupp": "Aktier", "kalla": "yahoo", "symbol": "EVO.ST", "handelstid": "eu", "valuta": "SEK", "dec": 2, "kostnadProc": 0.08 }`

Svenska aktier har `.ST` på slutet hos Yahoo. Fler instrument från Twelve Data ger fler anrop och mindre tid kvar för live-läget.

---

## Bra att veta

- GitHubs schemalagda körningar kan vara några minuter sena.
- Signaler räknas bara på stängda staplar.
- Turbon handlas i kronor och kan följa terminspriset i stället för spotpriset, så den rör sig inte exakt som instrumentet i dashboarden.
- GitHub kan pausa schemalagda körningar i repon som inte har haft någon aktivitet på 60 dagar. Boten sparar nya analyser varje timme, men om körningarna ändå stannar slår du på dem igen under **Actions**.

## Filer

| Fil | Vad den gör |
|---|---|
| `docs/engine.js` | Analysmotorn: indikatorer, regler, risknivåer, längre lägen, historiktest och notistexter |
| `docs/index.html` | Dashboarden, med översikt och live-läge |
| `docs/bevakning.json` | Bevakningslistan |
| `docs/data/` | Analyserna. Skapas av boten, så rör dem inte |
| `scripts/run.mjs` | Molnskriptet som GitHub kör |
| `.github/workflows/guldanalys.yml` | Schemat: varje timme, varje morgon, plus en knapp för att köra direkt |
| `scripts/test.mjs` | Självtest på syntetiska priser (`npm test`, kräver Node 20 eller senare) |
