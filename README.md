# Weer — persoonlijke weer-app

Een snelle, rustige weer-app voor één persoon op de iPhone: in één oogopslag hoe warm het is en of het
de komende 2 uur gaat regenen, met een radar. Gebouwd vanuit [SPEC.md](SPEC.md) en de vier schermontwerpen in
[design/reference/](design/reference/); opgezet zoals [Iron](https://github.com/Steven-Zwaan/iron).

- **PWA**: React 19 + TypeScript + Vite 8, installeerbaar via Safari › "Zet op beginscherm", werkt offline met de laatst bekende gegevens.
- **Alleen gratis bronnen**, geen accounts, geen keys in de frontend: Buienradar, KNMI, Open-Meteo, PDOK en OpenStreetMap.
- **Swift later**: dezelfde splitsing als Iron, een pure domeinlaag plus platformneutrale data. Zie [docs/PORTING-SWIFT.md](docs/PORTING-SWIFT.md).

## Draaien

```bash
npm install
npm run dev            # http://localhost:5174
npm test               # 67 tests: balkhoogte, regensamenvatting, parsing van elke bron, weercodes, tijdlijn
npm run build          # typecheck + productiebundel in dist/ (ongeveer 110 KB gzip; de radar laadt apart nog 50 KB)
npm run preview        # dist/ lokaal serveren om de service worker te testen (http://localhost:4174)
npm run check-sources  # bronnencheck (SPEC §10 fase 1): bereikbaar, CORS, formaat
npm run check-radar    # ligt het Buienradar-radarbeeld goed op de kaart? (vergelijkt met KNMI, heeft regen nodig)
npm run icons          # alle iconen en favicons opnieuw maken uit public/logo.svg
```

Eerste start zonder locatietoegang en zonder opgeslagen plaatsen opent Locaties met de focus op het zoekveld.
Geef je locatietoegang, dan staat je eigen plek altijd bovenaan (naam via PDOK, anders "Mijn locatie").

### Meteen je eigen locatie

De app opent altijd op je eigen locatie, en springt daar ook naartoe als je minstens 5 minuten weg was. De laatste fix
en het weer daar staan in de cache, dus dat staat er direct, nog vóór er een nieuwe fix is. Daarna twee verzoeken:
eerst de positie die iOS al heeft (`maximumAge` 30 min, vrijwel direct), dan een verse fix (`maximumAge` 1 min). Lage
nauwkeurigheid (wifi/zendmast) is genoeg voor het weer en veel sneller dan GPS. Ben je meer dan 1 km verplaatst, dan
ververst het weer meteen. Een fix die binnenkomt nadat je zelf een plaats koos, laat die keuze staan. "Mijn locatie"
(of "Gebruik mijn locatie" als je plek nog niet in de lijst staat) op Locaties haalt ook altijd een verse fix.

iOS vraagt bij een web-app vaak opnieuw om toestemming. Minder vaak: Instellingen › Privacy en beveiliging ›
Locatievoorzieningen › Safari-websites › "Bij gebruik van app".

## Opbouw

```
SPEC.md                 De bouwspecificatie, met de bronnencheck ingevuld onder §6 "Bevestigd"
design/reference/       De vier gekozen schermen (exports uit de ontwerptool): de visuele bron van waarheid
design/app-icon-1024.png  Icoon zonder alfa voor een latere iOS-app
shared/data/            Platformneutrale JSON voor de PWA en een latere Swift-app
  weathercodes.json       WMO-code → conditie en Nederlandse tekst (dag/nacht)
  rain-scale.json         neerslagschaal: nat vanaf 0,1 mm/u, licht/matig/zwaar, balkvormen, vervaging
src/domain/             Pure TypeScript zonder framework-imports — het deel dat geport wordt
  types.ts                het genormaliseerde datamodel (SPEC §7), alle tijden in epoch-ms
  rain.ts                 balkhoogte, intensiteitslijnen, vervaging, regensamenvatting (lang en kort)
  weather.ts              weercodes, iconen, hero-omschrijving (radar wint van het model)
  days.ts                 10-dagenbalken, uurstrip, zon- en UV-tegel, temperatuurgrafiek van Dagdetail
  axis.ts                 tijdas ("Nu" + echte halve uren), radar-offsets
  radar.ts                radartijdlijn: Nu tot +2 uur, elke nowcast-stap met het radarbeeld van dat moment
  locations.ts            opslaan, ontdubbelen, herordenen, NL/BE eerst, afstanden
  time.ts, format.ts      tijdzones zonder library, Nederlandse notatie
src/api/                Eén module per bron, met getypeerde parsing: componenten zien nooit een ruwe response
  buienradar.ts           raintext → 5-minutenstappen (rond middernacht goed), fallback naar Open-Meteo minutely_15;
                            de lijst met radarverwachtingsbeelden en hun kaartgrenzen
  openmeteo.ts            forecast (knmi_seamless), aanvulling zonder model als velden leeg zijn
  geocoding.ts, pdok.ts   plaatsen zoeken, plaatsnaam bij GPS
src/app/                React-lijm: Zustand-store, localStorage, hash-router, verversen, platform (GPS)
src/ui/                 Componenten per ontwerpblok: HeroNow, RainCard, RainChart, HourStrip, DayList, DetailTiles,
                          RadarMap, BottomSheet, DayPicker, DayCharts, LocationCard
src/screens/            Vandaag, Radar (lazy, met Leaflet), Dagdetail, Locaties
src/styles/tokens.css   De design tokens van SPEC §3, één keer gedefinieerd
src/sw.ts               Service worker: app-shell precache, OSM-tegels SWR (max. 200), radarbeelden cache-first (3 uur)
api/rain.ts             Fallback-proxy voor Buienradar (Vercel Function)
scripts/                check-sources.ts (bronnencheck), check-radar-bounds.mjs (radarbeeld tegen KNMI),
                          icons.mjs (iconen uit het logo, overgenomen uit Iron)
tests/                  Vitest, met echte opgenomen antwoorden van elke bron in tests/fixtures/
```

### Neerslaggrafieken

Eén `RainChart` voor alle vier: Vandaag (H 96, 25 stappen van 5 min, vervaagt na 40 min), Radar (H 72, cursor
blijft staan), Dagdetail (H 64, 24 uur, cursor van buitenaf) en de mini op Locaties (H 18). Balkhoogte
`√(mm/5) × H`, droog 3 px. Slepen gebruikt Pointer Events met capture en `touch-action: none`, en rendert alleen
bij een nieuwe index (SPEC §5).

Swipen over het scherm wisselt op Vandaag van locatie en op Dagdetail van dag. Een swipe die op een grafiek begint
(daar sleep je de cursor) of op een horizontale strip (uurstrip, dagkiezer) is van dat element en wisselt niet.
Met een muis scrollen die strips door te slepen of met het scrollwiel (zonder scrollbalk).

### Radar

De kaart vult het scherm tussen de bovenbalk en een sheet met de grafiek. Sleep de sheet omhoog (ook vanaf de grafiek
zelf) en de grafiek wordt groter, zodat licht, matig en zwaar beter uit elkaar liggen; de kaart blijft erboven zichtbaar
en houdt je locatie in het midden. Een gebaar dat verticaal begint is van de sheet, een dat zijwaarts begint verschuift
de cursor. Tik op het streepje bovenaan om te wisselen. De app onthoudt de laatst gekozen grootte.

### Verversen en offline

Bij openen eerst de cache (localStorage, per locatie), dan verversen; opnieuw bij terugkomen in de app (als de data
ouder is dan 2 min) en elke 5 min zolang de app zichtbaar is. Forecast en nowcast worden los opgehaald. Mislukt het,
dan blijft de cache staan met "Offline · gegevens van 14:30"; een nowcast ouder dan 15 min maakt de regenkaart grijs.
Tik op "Bijgewerkt HH:MM" om meteen te verversen.

## Op de iPhone testen en hosten

Service workers en geolocatie vereisen HTTPS. Elke statische host werkt; `vercel.json` staat klaar (zoals bij Iron):
op Vercel wordt `api/rain.ts` naast `dist/` gedeployd. Er zijn geen omgevingsvariabelen nodig.
Open de URL in Safari en kies Deel › "Zet op beginscherm".

## Waar de uitvoering van de SPEC afwijkt, en waarom

- **Stack zoals Iron: React in plaats van Preact, Vercel in plaats van Cloudflare.** Bewust dezelfde methodiek als Iron:
  React 19, Zustand, Tailwind 4 naast de tokens, `vite-plugin-pwa` met een eigen service worker, `api/` als Vercel Function,
  dnd-kit voor het herordenen. Er is geen chart-library en geen UI-framework: grafieken zijn divs en SVG volgens het ontwerp.
- **Buienradar direct, de proxy alleen als vangnet.** De SPEC verwachtte geen CORS; de dienst stuurt nu
  `Access-Control-Allow-Origin: *`. De app vraagt hem rechtstreeks op met coördinaten op 2 decimalen (privacy en cache, als
  de proxy deed) en valt bij een netwerk- of CORS-fout terug op `/api/rain`.
- **Radar: Buienradar-verwachtingsbeelden, alleen de toekomst (SPEC §6.3 optie 2).** De kaart speelt van "Nu" tot ~+2 uur
  af, met per 5 minuten het beeld uit dezelfde nowcast als de grafiek; geen verleden. Na 40 minuten zegt de tijdchip
  "minder zeker", de kaart loopt gewoon door. Buienradar documenteert de kaartgrenzen van die beelden niet; de gebruikte
  grenzen zijn gecontroleerd tegen KNMI's exact gegeorefereerde radar (`npm run check-radar`, uitkomst in SPEC §6.3).
- **Radarkleuren van Buienradar.** De beelden komen in Buienradar's eigen verloop (lavendel → blauw → rood); de
  legenda-tokens `--radar-1…4` zijn daaruit gesampled in plaats van de blauwtinten uit SPEC §3, zodat legenda en kaart kloppen.
- **24 of 25 balken.** Buienradar gaf 24 stappen; elke grafiek toont zoveel balken als er stappen zijn (en laat stappen
  die voorbij zijn weg), in plaats van een vast aantal.
- **"Regen vanaf 14:55, tot ca. 15:55" in plaats van 15:50.** De voorbeelddata in het ontwerp kwam op 15:50 uit; de SPEC-regel
  (nat vanaf 0,1 mm/u, eind = laatste natte stap + 5 min) geeft 15:55. De tests volgen de SPEC. Idem "Droog over 40 min"
  waar het ontwerp 35 schreef.
- **Tijden in de tijdzone van de plaats.** `timezone=auto` in plaats van vast Europe/Amsterdam, zodat dagen en zonstanden
  ook kloppen voor een plaats buiten NL/BE. "Bijgewerkt" en de offline-melding staan in Nederlandse tijd.
- **API-antwoorden cachet de app, niet de service worker (SPEC §9).** De app bewaart per locatie het laatste antwoord in
  localStorage, met het tijdstip, en toont dat met een offline-melding. Een network-first-fallback in de service worker zou
  de app offline een oud antwoord geven dat er vers uitziet. De service worker cachet wel de app-shell, de kaarttegels
  (stale-while-revalidate, max. 200) en de radarbeelden (de URL noemt run en tijdstip, dus een beeld verandert nooit).
- **Epoch-milliseconden in het datamodel** in plaats van `Date`: de cache is gewone JSON en het model past 1-op-1 op Codable.
- **Lettertype.** Op Apple-apparaten SF (`-apple-system`), elders het meegeleverde Inter (alleen Latin, variabel), zodat het
  op andere schermen ook op het ontwerp lijkt.
- **GPS-naam via PDOK** (gratis, alleen NL), zoals de SPEC als optie noemt. Buiten NL blijft het "Mijn locatie".
- **Postcodes.** De geocoder kent "3511" maar niet "3511 AB"; bij een NL-postcode zoekt de app op de cijfers. Resultaten
  die geen woonplaats zijn (een vliegveld met dezelfde naam) worden weggelaten.
- **Een omlijning in plaats van een schaduw** op een Locaties-kaart die je versleept (de SPEC wil geen schaduwen).
- **Radar als kaart met een sheet** in plaats van een kaart van 420 px met een paneel eronder (§2.2): de kaart vult het
  scherm, de grafiek zit in een sheet die je groter kunt slepen (grafiekhoogte 72 tot ~290 px).
- **Altijd openen op je eigen locatie**, niet op de laatst bekeken plaats (§8 `weer.activeIndex`): alleen zonder
  locatietoegang geldt de laatst bekeken plaats nog.
- **Geen sleep-hints.** "Sleep over de grafiek voor details" onder de regenkaart en de rusttekst van de infobalk op
  Dagdetail zijn weg; de infobalk toont in rust de titel "Temperatuur" en tijdens het slepen het uur. De bronvermelding
  staat onderaan Vandaag.
- **Swipen op Dagdetail** wisselt van dag (niet in de SPEC). **Pijltjestoetsen** doen op Vandaag en Dagdetail hetzelfde als
  swipen, handig in een desktopbrowser.

## Bronnen

Neerslag komende 2 uur en radar: [Buienradar](https://www.buienradar.nl) (persoonlijk, niet-commercieel gebruik, met
bronvermelding) · Controle radarbeeld: [KNMI](https://www.knmi.nl) open data · Verwachting: KNMI Harmonie en ECMWF via
[Open-Meteo](https://open-meteo.com) · Plaatsnamen: Open-Meteo Geocoding en [PDOK](https://www.pdok.nl) ·
Kaart: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-bijdragers.
