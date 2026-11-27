# Guldbot

Guldbot bevakar 23 marknader dygnet runt: guld, silver, olja, valutor, index, aktier och krypto. Den skickar notiser till mobilen när ett läge dyker upp och visar allt på en dashboard som du öppnar i mobilen. Köp och sälj sköter du själv.

- **Kortsiktiga lägen (varje timme):** Samma regler som för guldet, på timstaplar, för alla instrument. Tre risknivåer: låg, medel och hög.
- **Längre lägen (varje morgon):** Ett eget regelset på dagsstaplar som letar köplägen med horisont på veckor till månader.
- **Live (när du tradar):** Välj ett instrument i dashboarden och tryck på *Live*. Då analyseras det varje minut på 5-minuters-, 15-minuters- eller timstaplar.
- **Nulägesanalys:** En knapp som analyserar alla instrument direkt och sammanfattar läget.
- **Mina positioner:** Tryck *Jag köpte lång* eller *Jag köpte kort* när du har köpt. Boten bevakar då positionen var 2–3:e minut och skickar en notis när reglerna säger sälj, och varför.
- **Ekonomi:** En egen sida för hela din ekonomi: vad du spenderar på, budget med inkomster och utgifter som kommer en gång eller återkommande, köp och sälj med tradingstatistik, sparande, mål med kalkylator och tips. Affärer från Guldbot kommer in automatiskt.

> Guldbot visar vad fasta tekniska regler säger. Det är inte investeringsrådgivning, och historiska resultat är ingen garanti för framtiden.

---

## Uppgradera från en tidigare version

Har du redan Guldbot igång? Då behåller du repot, hemligheterna och ntfy-ämnet. Gör så här:

1. I repot på GitHub: **Add file → Upload files**. Dra in **mapparna** `docs`, `scripts` och `.github` (inte filerna en och en, då hamnar de fel) och filerna `README.md` och `package.json`. Klicka **Commit changes**. Befintliga filer med samma namn ersätts.
   Kontrollera efteråt att `docs/ekonomi-app.js`, `docs/fonts/`, `.github/workflows/guldanalys.yml` och `.github/workflows/positionsbevakning.yml` finns i repot. Mappen `.github` syns inte alltid i Finder eller Utforskaren – slå på visning av dolda filer om du inte hittar den.
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

### 8. Skapa en GitHub-nyckel för knapparna
Knapparna **Nulägesanalys** och **Jag köpte lång/kort** startar körningar i molnet och sparar dina positioner i repot. Dashboarden är en vanlig webbsida, så den behöver en egen nyckel för att få göra det.

1. På GitHub: klicka på din profilbild → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Namn: `guldbot-dashboard`. Välj en giltighetstid, till exempel 90 dagar.
3. **Repository access:** *Only select repositories* → välj `guldbot`.
4. **Permissions** (under Repository permissions): **Actions** → *Read and write*, **Contents** → *Read and write*.
5. Klicka **Generate token**, kopiera nyckeln och klistra in den under **Inställningar → GitHub-nyckel** i dashboarden.

Nyckeln sparas bara i den webbläsaren och gäller bara guldbot-repot. Du kan ta bort den på GitHub när som helst. Gör om stegen på varje enhet där du vill använda knapparna, och skapa en ny nyckel när den gamla går ut.

---

## Dashboarden

- **Alla instrument** visar pris, förändring senaste dygnet och lägen för varje instrument. Instrument med lägen hamnar överst. Brickorna betyder:
  - **L / M / H** är låg, medel och hög risk på timstaplar. ▲ är lång, ▼ kort och ◎ ett möjligt läge på väg.
  - **Längre** är köplägen på dagsstaplar.
- Tryck på ett instrument för detaljer: risknivåkort, längre läge med dagsgraf, timgraf, analys, senaste signaler och historik.
- Notiser från boten länkar direkt till rätt instrument.
- **Live** finns för instrument som hämtas från Twelve Data: guld, silver, valutorna, USA-aktierna och krypto.

---

## Ekonomi

Knappen **Ekonomi →** överst i dashboarden öppnar sidan för din egen ekonomi (`ekonomi.html`). Allt fyller du i själv, och sidan räknar ut resten. Vill du se hur den fungerar först trycker du på *Testa med exempeldata* (rensa under Inställningar när du vill börja på riktigt).

I mobilen finns flikarna längst ner och en gul **+**-knapp som alltid är nära till hands: *Utgift*, *Inkomst*, *Köp*, *Sälj*, *Insättning*, *Planera* och *Importera kontoutdrag*. På datorn ligger samma saker i menyn till vänster.

| Flik | Innehåll |
|---|---|
| **Översikt** | Hur mycket du har kvar att spendera den här månaden och per dag, nettoförmögenheten och hur den är fördelad, de viktigaste tipsen, månadens inkomster, utgifter, sparande och trading, vart pengarna går, kommande händelser (till exempel ett bidrag eller en ny hyra) och dina mål |
| **Utgifter** | Vad du spenderar på per kategori, jämfört med ditt snitt. Takt per dag och prognos för månaden, månad för månad, en värmekarta över kategorier, de största utgifterna och alla transaktioner med sök och filter |
| **Budget** | Allt som kommer in och går ut – en gång eller varje månad, kvartal eller år, med start- och slutmånad. Prognos för 12 månader framåt, plan mot verklighet per kategori och utgifter du sparar ihop till |
| **Trading** | Öppna köp med en Sälj-knapp, resultat för månaden, året eller all tid, träffsäkerhet, profit factor, snittvinst och snittförlust, lång mot kort, hålltid, vinst- och förlustsviter, resultatkurva, resultat per månad, fördelning av resultat och per instrument |
| **Sparande** | Konton (buffert, långsiktigt, trading, pension) med värde och avkastning, fördelningen mellan dem och en sparplan som delar upp månadssparandet efter dina mål |
| **Mål** | Mål kopplade till konton: om du är i fas, vad som krävs och när du når målet. Kalkylatorn räknar ränta på ränta |
| **Tips** | Regelbaserade tips utifrån dina siffror: buffert, sparkvot, andel högrisk, kategorier som ökar, abonnemang, kommande utgifter, mål som inte är i fas och hur tradingen går |

**Planera inkomster och utgifter.** Tryck på **+ → Planera**. Välj inkomst eller utgift och hur ofta:
- *En gång* med ett datum, till exempel ett bidrag på 20 000 kr den 15 januari.
- *Varje månad* (eller kvartal) från och med en månad och eventuellt till och med en månad, till exempel en hyra på 10 000 kr från januari.
- *Varje år* med ett datum, till exempel en försäkring.
Kryssa i *Spara ihop till den* för större utgifter, så räknas det ut hur mycket du behöver lägga undan per månad.

**Köp och sälj.** Tryck på **+ → Köp** när du köper och fyll i vad och insatsen. Köpet ligger sedan under *Öppna köp* på Trading. När du säljer trycker du på **Sälj** och fyller i vad du fick tillbaka, så räknas resultatet ut och hamnar på tradingkontot. Köp och sälj via *Jag köpte* och *Jag har sålt* i Guldbot kommer in automatiskt om du fyller i beloppen där.

**Utgifter.** Lägg till en utgift med **+ → Utgift**: belopp och vad det var räcker, kategorin gissas utifrån texten. Snabbast är att importera ett kontoutdrag: exportera transaktionerna som CSV från banken eller markera tabellen i internetbanken och klistra in. Datum, belopp och text hittas automatiskt och rader som redan finns hoppas över. Ändrar du kategori på en transaktion kan du välja att samma text alltid ska få den kategorin.

**Tipsen** bygger på mål som du kan ändra (under Tips eller Inställningar): buffert i antal månaders utgifter (standard 3), sparkvot (15 % av inkomsten), högst andel högrisk av investeringarna (10 %) och antagen långsiktig avkastning (7 % per år). Det är vanliga tumregler, inga råd om enskilda produkter.

**Uppdatera kontovärdena** då och då med det värde banken visar (tryck på kontot → *Uppdatera värde*). Insättningar och tradingresultat efter det datumet räknas på automatiskt.

### Lagring och lösenfras
- **Utan GitHub-nyckel** sparas uppgifterna bara i den webbläsaren.
- **Med GitHub-nyckel** kan du slå på krypterad synk under *Inställningar*. Uppgifterna sparas då i `docs/data/ekonomi.krypterad.json` i repot, krypterade med en lösenfras som du väljer (AES-256, nyckeln härleds med PBKDF2). Repot är publikt, men filen går inte att läsa utan lösenfrasen. På varje ny enhet låser du upp en gång, och kan välja att enheten ska komma ihåg lösenfrasen.
- **Glömmer du lösenfrasen går uppgifterna inte att få tillbaka.** Ladda därför ner en säkerhetskopia då och då under *Inställningar*. Kopian är okrypterad, så spara den på ett säkert ställe.
- Uppgifter från den förra versionen av sidan flyttas över automatiskt: månadsbudgeten blir planerade poster och framtida utgifter blir poster som du sparar ihop till.

Beräkningarna bygger på det du fyller i och på antagen avkastning. De är ett planeringsverktyg, inga löften.

---

## Nulägesanalys

Knappen **Nulägesanalys** överst i dashboarden analyserar alla instrument på en gång och sammanfattar:
- aktiva kortsiktiga lägen, de senaste först
- möjliga lägen på väg
- längre köplägen
- de instrument som har rört sig mest det senaste dygnet

**Med GitHub-nyckel** körs analysen i molnet för alla 23 instrument. Det tar 2–3 minuter.
**Utan GitHub-nyckel** men med Twelve Data-nyckel analyseras de 12 instrumenten från Twelve Data direkt i webbläsaren (ca 1,5 minuter). Instrumenten från Yahoo visar då molnets senaste analys.

Varje nulägesanalys använder 12 av Twelve Datas 800 anrop per dygn.

---

## Mina positioner

När du har köpt en turbo eller ett certifikat trycker du på **▲ Jag köpte lång** eller **▼ Jag köpte kort** på instrumentet.
- **Pris:** ange priset på det **underliggande** (t.ex. guldpriset), inte turbons pris. Dashboarden föreslår det senaste priset.
- **Stop och mål** föreslås utifrån risknivån (samma som för signalerna) och kan ändras.
- **Hävstång och barriär** är valfria. Med hävstång visas ungefärligt resultat på turbon. Med barriär varnar boten när priset närmar sig knock-out-nivån.
- **Belopp** är valfritt och används bara för att visa ungefärligt resultat i kronor. Det sparas bara i webbläsaren.

**Med GitHub-nyckel** sparas positionen i `docs/positioner.json`, och arbetsflödet *Positionsbevakning* startar inom någon minut. Det analyserar positionen på 5-minutersstaplar var 2–3:e minut, även när mobilen är låst. Varje körning håller på i upp till ca 6 timmar och startas om varje timme så länge du har öppna positioner. När marknaden är stängd görs en kontroll var 30:e minut.
**Utan GitHub-nyckel** bevakas positionen bara medan dashboarden är öppen, och bara för instrument från Twelve Data.

När du har sålt trycker du på **Jag har sålt** och anger priset. Då stoppas bevakningen och affären sparas i historiken.

### Säljreglerna
| Status | När |
|---|---|
| ⛔ **Säljsignal** | stoppen nås · målet nås · timtrenden vänder mot dig (EMA 9 korsar EMA 21 och priset hamnar på fel sida) · priset är närmare än 0,5 ATR från turbons barriär |
| ⚠ **Varning** | momentum vänder på 5-minutersstaplar · överköpt (RSI över 75) för en lång position eller översålt (under 25) för en kort · priset är nära stoppen eller barriären |
| ✓ **Behåll** | inget av ovanstående |

Stoppen följer med när affären går bra. Vid +1R flyttas den till köppriset, så att affären inte kan bli en förlust. Från +1,5R följer den efter priset (bästa pris sedan köpet minus 1 ATR). Du får en notis varje gång stoppen ska flyttas.

**Notiser för positioner:** *Bevakar …* när bevakningen startar, *Säljsignal* (högsta prioritet) med skälen, *Påminnelse* var 30:e minut (högst fyra gånger) tills du trycker på *Jag har sålt*, *Varning* (högst en gång per halvtimme och skäl) och *Flytta stoppen*.

**Bra att veta:**
- Repot är publikt, så positionerna i `docs/positioner.json` (instrument, riktning, pris, stop och mål) syns för den som hittar repot. Belopp sparas aldrig där.
- GitHub Actions är gratis för publika repon, så de långa bevakningskörningarna kostar inget.
- Bevakningen använder högst ungefär 20 Twelve Data-anrop per timme medan marknaden är öppen. Instrument från Yahoo kostar inga anrop.

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

Gratisnivån ger 800 anrop per dygn och 8 per minut. Boten hämtar bara instrument vars marknad är öppen (aktier och index under börstid, valutor och råvaror på vardagar, krypto dygnet runt), så timanalysen använder ungefär 210 anrop per dygn. Det som finns kvar delas av:
- live-läget: 1 anrop per minut
- positionsbevakningen: högst ca 20 per timme medan marknaden är öppen
- nulägesanalys: 12 per tryck

Utan positioner räcker det till ungefär 9 timmar live per dag. Om dygnets anrop tar slut använder boten Yahoo som reserv för de instrument som har en reservkälla.

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
| `docs/positioner.json` | Dina registrerade positioner. Skrivs av dashboarden |
| `docs/ekonomi.html`, `docs/ekonomi-app.js` | Ekonomisidan: utseende, vyer och formulär |
| `docs/ekonomi-berakning.js` | Beräkningarna för ekonomisidan: budget och prognos, utgiftsstatistik, import av kontoutdrag, tradingstatistik, mål, sparplan och tips |
| `docs/fonts/` | Typsnittet Schibsted Grotesk (fri licens, OFL) |
| `docs/ekonomi-lagring.js` | Krypterad lagring för ekonomisidan |
| `docs/github.js`, `docs/diagram.js` | Delar som sidorna använder: GitHub-anrop och diagram |
| `scripts/run.mjs` | Molnskriptet för tim- och dagsanalysen |
| `scripts/positioner.mjs` | Molnskriptet som bevakar dina positioner |
| `scripts/gemensam.mjs` | Delar som båda molnskripten använder: prisdata och notiser |
| `.github/workflows/guldanalys.yml` | Schemat för analysen: varje timme, varje morgon, plus en knapp för att köra direkt |
| `.github/workflows/positionsbevakning.yml` | Positionsbevakningen: startas av dashboarden och varje timme |
| `scripts/test.mjs` | Självtest på syntetiska priser (`npm test`, kräver Node 20 eller senare) |
