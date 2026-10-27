# Weer-app – bouwspecificatie v1

Visuele bron van waarheid: `design/`. Dit document beschrijft wat je niet aan het ontwerp kunt zien.

---

## 1. Doel en scope

Een snelle, rustige weer-app voor iPhone met vier schermen: Vandaag, Radar, Dagdetail en Locaties. Het belangrijkste is in één oogopslag zien hoe warm het is en of het de komende 2 uur gaat regenen.

**Buiten scope (v1):** pushmeldingen, widgets, accounts, synchronisatie tussen apparaten, waarschuwingen (KNMI-codes), donkere modus (wel tokens zo opzetten dat het later kan), landen buiten NL/BE voor de 2-uursneerslag.

---

## 2. Schermen

### 2.1 Vandaag (`design/01-vandaag.dc.html`)

Van boven naar beneden:

1. **Topbalk**: knop "Locaties" (pil, wit, 44 px hoog) links; rechts "Bijgewerkt HH:MM" (tijd van de laatste geslaagde fetch).
2. **Hero**: plaatsnaam (26/600) + locatiepijl als het de GPS-locatie is · temperatuur (112/200, afgerond, met °) · omschrijving uit weercode (19/500) · "H 14° · L 7° · Voelt als 9°".
3. **Regenkaart** (wit, radius 24): eyebrow "Neerslag · komende 2 uur", kop = regensamenvatting (§4.4), rechtsboven link "Radar ›". Grafiek met 25 balken (§4), tijdas "Nu, 15:00, 15:30, 16:00, 16:30" (afgeleid van de echte tijden, afgerond op het halfuur), voetregel "Sleep over de grafiek voor details · Bron: Buienradar en KNMI".
4. **Per uur**: 10 kolommen van 52 px, horizontaal scrollbaar. Per kolom: uur ("Nu" eerst, vet), icoon, temperatuur, neerslag in mm als > 0.
5. **Komende 10 dagen**: rijen van ≥ 52 px. Dagnaam ("Vandaag", daarna Ma/Di/…), icoon, neerslagkans als ≥ 30%, min-temp, temperatuurbalk, max-temp, chevron. De balk loopt van de laagste tot de hoogste temperatuur over alle 10 dagen. Vulkleur: `--warm` als max ≥ 13°, anders `--cool`. Tik = Dagdetail op die dag.
6. **Detailtegels** (2 × 2): Wind (snelheid, richting, stoten) · Luchtvochtigheid (+ dauwpunt) · UV-index (+ "Laag/Matig/Hoog/Zeer hoog") · Zon (eerstvolgende op of onder).
7. **Bronregel**.

Horizontaal swipen over het hele scherm (buiten grafieken en de uurstrip) wisselt tussen opgeslagen locaties. Toon onder de topbalk kleine paginapuntjes als er meer dan één locatie is. *(Dit staat niet in het ontwerp; houd het onopvallend: puntjes 6 px, `--muted`.)*

### 2.2 Radar (`design/02-radar.dc.html`)

- Topbalk: "‹ Plaatsnaam" terug, titel "Radar".
- Kaart: 420 px hoog, radius 24, met pan/zoom. Start gecentreerd op de locatie, zoom zodat er ongeveer 40 km in beeld is. Locatiestip in `--accent` met halo.
- Overlays op de kaart: tijdslabel linksboven (tijd + "Nu"/"+40 min"), status rechtsboven ("Lichte regen · 0,8 mm/u" op de locatie, of "Droog"), legenda linksonder (licht/matig/zwaar/extreem).
- Paneel: regengrafiek (25 stappen) met intensiteitslijnen en cursor, tijdas, afspeelknop (44 px rond) en schuif (0–24).
- Afspelen: elke 450 ms een stap, loopt rond. Slepen in de grafiek of aan de schuif stopt het afspelen.
- Frames verleden: als de radarbron historische frames heeft, mag de tijdlijn ook 30–60 min terug beginnen. "Nu" is dan gemarkeerd. *(Optioneel, afhankelijk van §6.3.)*

### 2.3 Dagdetail (`design/03-dagdetail.dc.html`)

- Topbalk: "‹ Plaatsnaam", titel "10 dagen".
- Dagkiezer: 10 knoppen (52 × 64, radius 18), geselecteerd = `--accent` met witte tekst, `aria-pressed`. Opent op de dag waarop getikt werd.
- Samenvatting: volledige datum ("Donderdag 29 oktober"), max groot, min secundair, omschrijving.
- Kaart "Temperatuur": infobalk (§5), temperatuurlijn met lichte vulling en piekmarkering, daaronder "Neerslag per uur" met 24 balken en intensiteitslijnen, tijdas 00–24. Rechts een goot van 40 px voor labels (temperatuurschaal en licht/matig/zwaar).
- Tegels: Neerslag (som + kans) · Wind (gemiddelde, richting, stoten) · Zon (op/onder) · UV-index.
- Voetregel: "Verwachting: KNMI Harmonie (eerste 2,5 dag) en ECMWF via Open-Meteo. Verder dan 3 dagen vooruit is de verwachting een indicatie."

### 2.4 Locaties (`design/04-locaties.dc.html`)

- "Wijzig" rechtsboven: verwijderen (niet de GPS-locatie) en herordenen via sleepgreep. "Gereed" om af te sluiten.
- Titel "Locaties" (34/700).
- Zoekveld: debounce 300 ms, min. 2 tekens, resultaten uit geocoding (§6.4) als lijst onder het veld ("Utrecht, Utrecht · Nederland"). Tik = toevoegen en terug naar Vandaag op die locatie.
- Kaarten per locatie: naam, "Mijn locatie" of lokale tijd, omschrijving, temperatuur groot, H/L, mini-regenbalk (25 stappen, 120 × 18 px) met tekst ("Regen over 25 min", "Droog over 35 min", "Droog komende 2 uur").
- De GPS-locatie staat altijd bovenaan, als de gebruiker locatietoegang geeft. Geweigerd: geen fout tonen, gewoon niet opnemen.

---

## 3. Design tokens

```css
:root {
  --bg: #EDF1F5;         /* schermachtergrond */
  --surface: #FFFFFF;    /* kaarten */
  --ink: #0E1621;        /* hoofdtekst, cursor */
  --muted: #566273;      /* secundaire tekst (≥ 4,5:1 op bg én surface) */
  --line: #EEF1F5;       /* scheidingslijnen in kaarten */
  --grid: #D5DDE7;       /* gestippelde intensiteitslijnen, droog-balken */
  --track: #E6EBF1;      /* spoor van temperatuurbalk */
  --accent: #2B6FD6;     /* regen, links, actief */
  --sun: #D97B1F;        /* zon-iconen */
  --cloud: #6B7787;      /* wolk/maan-iconen */
  --warm: #E39A4A;       /* temperatuurbalk warme dag */
  --cool: #7FA6D9;       /* temperatuurbalk koele dag */
  --radar-1: #BCD5F6;    /* licht */
  --radar-2: #7EAEEE;    /* matig */
  --radar-3: #3F7BDB;    /* zwaar */
  --radar-4: #1E4FA8;    /* extreem */
  --radius-card: 24px; --radius-tile: 20px; --radius-chip: 18px;
  --gap: 14px; --pad-screen: 16px; --pad-card: 18px;
  --font: -apple-system, system-ui, "Inter", sans-serif;
}
body { font-variant-numeric: tabular-nums; }
```

Typeschaal (px/gewicht): hero-temp 112/200 (letter-spacing −0,05em) · plaats 26/600 · kaartkop 18/600 · rijtekst 16/500 · secundair 15 en 13/400 · eyebrow 12/600 hoofdletters, +0,06em · grafieklabels 11–12.

Geen schaduwen. Aanraakdoelen ≥ 44 × 44 px. Iconen: inline stroke-SVG, 24-viewBox, lijn 1,7 px, ronde uiteinden (zie ontwerp). Nodig maar niet in het ontwerp: mist, motregen, sneeuw, onweer. Teken die in dezelfde stijl.

---

## 4. Neerslaggrafieken

Eén component (`RainChart`) voor Vandaag (H = 96, 25 stappen van 5 min), Radar (H = 72, 25 stappen), Dagdetail (H = 64, 24 uur) en de mini-versie op Locaties (H = 18, zonder labels).

### 4.1 Balkhoogte

```ts
const height = (mmPerHour: number, H: number) =>
  mmPerHour <= 0 ? 3 : Math.round(Math.max(5, Math.min(H, Math.sqrt(mmPerHour / 5) * H)));
```

Droog = 3 px balk in `--grid`. Regen = `--accent`. Tussenruimte 3 px, radius 3/3/1/1.

Voor Dagdetail zijn de waarden mm per uur (som). Dezelfde formule, behandeld als mm/u.

### 4.2 Intensiteitslijnen (altijd zichtbaar, behalve mini)

Gestippeld in `--grid`, label rechts in een goot van 40 px (11 px):

| Label | mm/u | hoogte bij H |
| --- | --- | --- |
| zwaar | 5 | H |
| matig | 1 | √0,2 × H ≈ 0,447 H |
| licht | 0,1 | √0,02 × H ≈ 0,141 H |

Tekst bij een waarde: 0 → "Droog", < 1 → "Lichte regen", 1–5 → "Matige regen", ≥ 5 → "Zware regen".

### 4.3 Onzekerheid (alleen Vandaag)

Na stap 8 (40 min): stippellijn `1.5px dotted #8A96A6` met label "minder zeker →". Balkdekking = `max(0.3, 1 − (i − 8) × 0.045)`.

### 4.4 Regensamenvatting

Een stap is "nat" bij ≥ 0,1 mm/u.

| Situatie | Tekst |
| --- | --- |
| Alles droog | "Droog komende 2 uur" |
| Nu droog, later nat | "Regen vanaf HH:MM, tot ca. HH:MM" (eind = laatste natte stap van het eerste natte blok + 5 min; loopt het door tot het einde: "Regen vanaf HH:MM") |
| Nu nat, later droog | "Regen nu, droog over N min" |
| Alles nat | "Regen komende 2 uur" |

Locaties-kaart gebruikt de korte vorm: "Regen over N min" / "Droog over N min" / "Droog komende 2 uur" / "Regen komende 2 uur".

---

## 5. Interactie: slepen in grafieken

Alle grafieken zijn scrubbaar. De ontwerpbestanden bevatten werkende referentielogica (`pick`, `scrubDown`, `scrubMove`, `scrubUp`).

- Pointer Events op het grafiekvlak (exclusief labelgoot): `pointerdown` → `setPointerCapture` + index bepalen; `pointermove` tijdens slepen; `pointerup`/`pointercancel` stoppen.
- Index = `floor((clientX − left) / breedte × n)`, begrensd op 0…n−1.
- `touch-action: none` op het vlak, zodat de pagina niet scrolt of terugswipet.
- Cursor: verticale lijn 2 px `--ink` door het midden van de balk. Actieve balk `--ink`, overige 40% dekking.

| Scherm | Tijdens slepen | Na loslaten |
| --- | --- | --- |
| Vandaag | Eyebrow → "15:15 · over 45 min" (bij index 0: "Nu"); kop → "Matige regen · 3,1 mm/u" | Terug naar samenvatting |
| Radar | Zet het radarframe en de schuif, stopt afspelen | Cursor blijft op dat frame |
| Dagdetail | Eén sleepvlak over temperatuur- én neerslaggrafiek. Cursor loopt door beide, stip (`--ink`, witte rand) op de temperatuurlijn, piekmarkering verborgen. Infobalk (achtergrond `#E4ECF8`): "15:00 · 13° · Lichte regen" / "Neerslag 0,4 mm · Wind 22 km/u zuidwest" | Infobalk terug naar hint (achtergrond `#F3F5F8`): "Sleep over de grafieken" / "Zie per uur temperatuur, weer en neerslag" |

Updates alleen bij een nieuwe index (geen re-render per pixel).

---

## 6. Databronnen

Alle bronnen zijn gratis. Schrijf bij elke bron onder **Bevestigd** wat je in fase 1 hebt vastgesteld (CORS, formaat, eventuele afwijkingen).

### 6.1 Neerslag komende 2 uur – Buienradar raintext

```
GET https://gpsgadget.buienradar.nl/data/raintext?lat=52.09&lon=5.12
```

- Platte tekst, ~25 regels `waarde|HH:MM` (CRLF mogelijk). `waarde` 0–255.
- `mm/u = 10 ** ((waarde - 109) / 32)`; waarde 0 → 0 mm/u. Rond af op 1 decimaal; < 0,05 → 0.
- Tijden zijn lokale tijd (Europe/Amsterdam). Koppel ze aan de juiste datum rond middernacht.
- Dekking: NL en omgeving. Buiten bereik of fout → fallback 6.2 met `minutely_15` (4 stappen per uur interpoleren is niet nodig: toon dan 8 balken van 15 min en verberg "minder zeker").
- Waarschijnlijk geen CORS-headers → via de Worker-proxy (§6.5).
- Gebruik voor persoonlijk, niet-commercieel gebruik met bronvermelding. Controleer de voorwaarden.
- **Bevestigd (27-10-2026, `npm run check-sources`):** werkt zoals beschreven, met één gunstige afwijking: de dienst stuurt nu wél `Access-Control-Allow-Origin: *`, dus de app roept hem rechtstreeks aan. De proxy (`api/rain.ts`, §6.5) is alleen nog fallback als die header verdwijnt. Formaat `waarde|HH:MM` met LF (CRLF wordt ook geaccepteerd). Een antwoord had **24** regels, niet 25: de eerste tijd is het eerstvolgende 5-minutenmoment, de laatste ~2 uur verder; de app toont zoveel balken als er stappen zijn. Buiten NL/BE: HTTP 404 met "location must be inside the Netherlands or Belgium" → fallback `minutely_15`. Opgenomen antwoord: `tests/fixtures/raintext-utrecht.txt`.

### 6.2 Huidig, per uur, per dag – Open-Meteo

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=52.09&longitude=5.12
  &models=knmi_seamless
  &timezone=Europe/Amsterdam
  &forecast_days=10
  &current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day
  &hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day
  &daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant
  &minutely_15=precipitation
```

- Geen key, CORS werkt. Direct vanuit de app aanroepen.
- `knmi_seamless` = KNMI Harmonie voor de eerste ~2,5 dag, daarna ECMWF. Controleer of deze modelnaam bestaat. Zo niet: kies de KNMI-variant uit de Open-Meteo-documentatie en meld dat.
- Variabelen die het model niet levert (bijvoorbeeld neerslagkans) kunnen `null` zijn. Probeer dan zonder `models` (Open-Meteo kiest zelf) **alleen voor die variabele**, of verberg het veld. Nooit een verzonnen waarde tonen.
- Windrichting: graden → "Noord, Noordoost, Oost, Zuidoost, Zuid, Zuidwest, West, Noordwest" (8 sectoren).
- UV-label: 0–2 Laag, 3–5 Matig, 6–7 Hoog, 8–10 Zeer hoog, 11+ Extreem.
- **Bevestigd (27-10-2026):** `knmi_seamless` bestaat, CORS `*`, geen key. Neerslagkans en UV kwamen niet `null` terug (Open-Meteo vult ze zelf aan); de app vraagt ze toch zonder `models` op zodra ze allemaal `null` zijn. Twee parameters wijken af, met reden: `timeformat=unixtime` (epoch-seconden, dus geen lokale tijdstrings parsen rond een zomertijdwissel) en `timezone=auto` (daggrenzen van de plaats zelf; voor NL/BE is dat Europe/Amsterdam of Europe/Brussels). Verder `current` + `hourly` met `uv_index` voor de UV-tegel en `forecast_minutely_15=12` zodat de fallback niet 960 waarden ophaalt. Opgenomen antwoord: `tests/fixtures/open-meteo-utrecht.json`.

### 6.3 Radarkaart

- Basiskaart: Leaflet met OpenStreetMap-tegels (`tile.openstreetmap.org`, attributie verplicht, rustig gebruik). Maak de tegels in CSS iets minder verzadigd zodat de radar opvalt (`filter: saturate(0.4) brightness(1.04)` op de tegellaag).
- Radarlaag: **nog te kiezen in fase 4.** Eisen: gratis, zonder betaalde key, dekking NL, frames per 5 min, liefst ook verwachting (nowcast) tot +2 uur. Onderzoek in deze volgorde en schrijf de keuze en reden hier op:
  1. KNMI Data Platform: radar-nowcast (dataset `radar_forecast` 2.0, pySTEPS, 1 km, 5 min, +2 uur) en/of een WMS-dienst voor radarbeelden. Gratis key; ruwe bestanden (HDF5) moeten in de Worker naar PNG-tegels of een afbeelding met bekende bounds worden omgezet, en dan als `L.imageOverlay`.
  2. Een publieke tegeldienst voor radar met gratis gebruik (controleer actuele voorwaarden en of er verwachtingsframes zijn).
  3. Als er geen gratis verwachtingsframes zijn: toon alleen verleden + nu op de kaart, en de verwachting alleen in de grafiek (6.1). Meld dat.
- Kleur van de radarlaag zo dicht mogelijk bij `--radar-1…4`. Legenda en drempels conform §4.2.
- **Bevestigd (27-10-2026) — keuze: KNMI ADAGUC WMS, optie 3.**
  - **Radarbeelden:** de openbare WMS van KNMI, `https://geoservices.knmi.nl/adagucserver?dataset=RADAR`, laag `RAD_NL25_PCP_CM` (neerslag in mm/u, 1 km, elke 5 min, ±10 min vertraging), stijl `precip-blue-transparent/nearest` (lichtblauw, dicht bij `--radar-1`). Geen key, CORS `*`, standaard-WMS, dus Leaflet legt de beelden exact op de kaart (`L.tileLayer.wms` met `time`). Licentie KNMI open data (CC BY 4.0).
  - **Waarde op de locatie:** `GetFeatureInfo` met `TIME=start/eind` geeft in één verzoek de beschikbare frames van het afgelopen uur én de mm/u op de locatie per frame. Daarmee loopt de radartijdlijn 60 min terug (§2.2, optioneel).
  - **Verwachtingsframes:** niet gratis te krijgen. KNMI `radar_forecast` vraagt een key plus HDF5→PNG-omzetting (zware Worker), RainViewer gaf bij de check geen nowcast (`nowcast: []`) en alleen 10-minutenframes, en Buienradar heeft wel verwachtingsbeelden maar zonder gedocumenteerde kaartgrenzen. Dus **optie 3**: de kaart toont verleden + nu, de verwachting staat alleen in de grafiek (Buienradar, 6.1). Na "Nu" blijft het nieuwste radarbeeld gedimd zichtbaar.

### 6.4 Plaatsen zoeken – Open-Meteo Geocoding

```
GET https://geocoding-api.open-meteo.com/v1/search?name=utrecht&count=8&language=nl
```

Toon `name`, `admin1` en `country`. Sorteer NL en BE bovenaan. Geen key, CORS werkt.

- **Bevestigd (27-10-2026):** zoals beschreven. Het antwoord bevat ook niet-woonplaatsen (bijvoorbeeld een vliegveld "Utrecht" in Zuid-Afrika, `feature_code` `AIRF`); de app houdt alleen `PPL*` en `ADM*`. Vier cijfers van een postcode vinden de plaats ("3511" → Utrecht), "3511 AB" niet, dus de app zoekt bij een NL-postcode op de cijfers.
- **Reverse geocoding voor de GPS-locatie (§8):** PDOK Locatieserver (`api.pdok.nl/bzk/locatieserver/search/v3_1/reverse`, gratis, geen key, CORS `*`, alleen NL). Buiten NL blijft het "Mijn locatie".

### 6.5 Proxy – Cloudflare Worker (`worker/`)

> **Uitvoering:** een Vercel Function in `api/rain.ts` (zelfde opzet als Iron), alleen als fallback omdat 6.1 inmiddels CORS heeft. Zie README.

- `GET /rain?lat=&lon=` → haalt 6.1 op, geeft het origineel door met `Access-Control-Allow-Origin` (alleen het eigen Pages-domein en localhost) en `Cache-Control: max-age=120`.
- Coördinaten afronden op 2 decimalen (cachebaarheid, privacy).
- Later eventueel `/radar/...` voor 6.3.
- Geen logging van locaties. Optioneel later: voorspellingen opslaan voor de nauwkeurigheidsvergelijking (KV of D1, gratis tier) — niet in v1.

---

## 7. Datamodel (genormaliseerd)

```ts
type Location = { id: string; name: string; admin?: string; lat: number; lon: number; isGps: boolean };

type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'showers' | 'snow' | 'thunder';

type Nowcast = {               // 6.1, of fallback uit minutely_15
  source: 'buienradar' | 'open-meteo';
  stepMinutes: 5 | 15;
  steps: { time: Date; mmPerHour: number }[];
  fetchedAt: Date;
};

type Current = {
  temp: number; feelsLike: number; humidity: number; dewPoint: number;
  windKmh: number; gustKmh: number; windDirDeg: number;
  condition: Condition; code: number; isDay: boolean;
};

type Hour = { time: Date; temp: number; precipMm: number; condition: Condition; isDay: boolean; windKmh: number; windDirDeg: number };

type Day = {
  date: Date; min: number; max: number; condition: Condition;
  precipSumMm: number; precipProb: number | null;
  sunrise: Date; sunset: Date; uvMax: number;
  windMaxKmh: number; gustMaxKmh: number; windDirDeg: number;
  hours: Hour[];               // 24 uur van die dag
};

type Forecast = { location: Location; current: Current; hours: Hour[]; days: Day[]; nowcast: Nowcast | null; fetchedAt: Date };
```

### WMO-weercode → tekst en icoon

| Code | Tekst | Condition |
| --- | --- | --- |
| 0 | Zonnig (nacht: Helder) | clear |
| 1 | Overwegend zonnig (nacht: Overwegend helder) | clear |
| 2 | Half bewolkt | partly |
| 3 | Bewolkt | cloudy |
| 45, 48 | Mist | fog |
| 51, 53, 55 | Motregen | drizzle |
| 56, 57 | IJzel | drizzle |
| 61 / 63 / 65 | Lichte regen / Regen / Zware regen | rain |
| 66, 67 | IJzel | rain |
| 71 / 73 / 75, 77 | Lichte sneeuw / Sneeuw / Zware sneeuw, Sneeuwkorrels | snow |
| 80 / 81 / 82 | Lichte buien / Buien / Zware buien | showers |
| 85, 86 | Sneeuwbuien | snow |
| 95 | Onweer | thunder |
| 96, 99 | Onweer met hagel | thunder |

Iconen: clear → zon (nacht: maan), partly → zon-wolk (nacht: maan-wolk), cloudy → wolk, rain/showers/drizzle → regenwolk, overige naar eigen ontwerp in dezelfde stijl.

**Hero-omschrijving:** als de nowcast nu nat is maar de weercode droog, gebruik dan de nowcast-tekst ("Lichte regen"). De radar is op dit moment betrouwbaarder dan het model.

---

## 8. Gedrag

- **Verversen:** bij openen, bij `visibilitychange` → zichtbaar (als data > 2 min oud), en elke 5 min zolang de app zichtbaar is. Nowcast en forecast los ophalen; de één mag de ander niet blokkeren.
- **Cache:** laatste `Forecast` per locatie in `localStorage` (of IndexedDB). Bij openen eerst cache tonen, dan verversen. "Bijgewerkt HH:MM" toont de tijd van de getoonde data.
- **Offline / fout:** cache tonen + subtiele melding onder de topbalk: "Offline · gegevens van 14:30". Nowcast ouder dan 15 min: regenkaart grijs met "Geen actuele radargegevens".
- **Locaties:** `localStorage` key `weer.locations` = `Location[]` (zonder GPS-locatie), `weer.activeIndex` = laatst bekeken. Bij de eerste start zonder locatietoegang en zonder opgeslagen locaties: Locaties-scherm openen met focus op het zoekveld.
- **GPS:** `navigator.geolocation.getCurrentPosition` bij openen (timeout 8 s, `maximumAge` 10 min). Plaatsnaam via reverse geocoding is niet gratis beschikbaar bij Open-Meteo; gebruik de dichtstbijzijnde plaats uit een geocoding-zoektocht niet. Toon in plaats daarvan "Mijn locatie" tot de gebruiker hem een naam geeft, **of** zoek een gratis reverse-geocoder (bijvoorbeeld PDOK Locatieserver voor NL) en meld de keuze.
- **Tijd:** alles in Europe/Amsterdam. Nachtelijke uren krijgen nachticonen (`is_day`).
- **Toegankelijkheid:** echte `<button>`/`<a>`, `aria-label` op iconknoppen, grafieken krijgen een tekstalternatief (de samenvatting). Respecteer `prefers-reduced-motion` (geen autoplay van de radar).

---

## 9. PWA

- `manifest.webmanifest`: `name` "Weer", `short_name` "Weer", `display: standalone`, `start_url: "/"`, `background_color` en `theme_color` `#EDF1F5`, iconen 192 en 512 (+ maskable).
- In `<head>`: `apple-touch-icon` 180 × 180, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: default`, `viewport-fit=cover`.
- Safe areas: `padding-top: env(safe-area-inset-top)` op de schermcontainer, idem onderaan.
- Service worker: app-shell precache, API's network-first met cache-fallback, OSM-tegels stale-while-revalidate met een limiet (max. 200 tegels).
- Geen pull-to-refresh van de browser in standalone: zelf verversen bij omlaag trekken bovenaan Vandaag mag (optioneel).

---

## 10. Fasen

1. **Fundament.** Vite + Preact + TS, tokens, routing tussen 4 schermen, PWA-manifest. Fase 1 eindigt met een test van de bronnen 6.1, 6.2 en 6.4 (script in `scripts/check-sources.ts`): bevestig formaat en CORS en vul "Bevestigd" in. Worker-proxy voor 6.1 opzetten.
2. **Vandaag** met echte data: hero, regenkaart (inclusief slepen, §4–5), uurstrip, 10 dagen, tegels, cache en verversen.
3. **Dagdetail en Locaties:** gekoppelde grafieken met slepen, zoeken, opslaan, herordenen, GPS, swipen tussen locaties.
4. **Radar:** bronkeuze (6.3) vastleggen, kaart, frames, afspelen, slepen.
5. **Afwerking:** offline-gedrag, foutstaten, toegankelijkheid, iconenset compleet, deploy naar Cloudflare Pages, test op iPhone.

---

## 11. Klaar wanneer

- [ ] Installeerbaar via Safari, opent fullscreen zonder adresbalk, respecteert notch en home-indicator.
- [ ] Vandaag toont gecachte data direct en verse data binnen 2 s op 4G.
- [ ] Alle neerslaggrafieken tonen licht/matig/zwaar en zijn scrubbaar zoals §5, zonder dat de pagina meescrolt.
- [ ] Dagdetail: één cursor door temperatuur- en neerslaggrafiek, infobalk klopt met de data van dat uur.
- [ ] Radar speelt frames af en reageert op schuif en grafiek.
- [ ] Locaties toevoegen, verwijderen en herordenen blijft bewaard na herstart; swipen wisselt locatie.
- [ ] Offline met laatst bekende data en een duidelijke melding.
- [ ] Bronvermelding voor Buienradar, KNMI, Open-Meteo en OpenStreetMap zichtbaar.
- [ ] Geen betaalde diensten, geen keys in de frontend, geen pushmeldingen.
- [ ] Tests voor parsing, balkhoogte, regensamenvatting en weercodes slagen.
