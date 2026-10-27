# Weer (PWA) – instructies voor Claude Code

Persoonlijke weer-app voor één gebruiker op iPhone, geïnstalleerd als PWA via Safari › "Zet op beginscherm". Nadruk op de
huidige temperatuur, neerslag in de komende 2 uur en een radar. Opgezet zoals Iron (`Steven-Zwaan/iron`).

**Lees eerst `SPEC.md`** (wat er gebouwd is, met de bronnencheck onder §6) en de README, vooral "Waar de uitvoering van de
SPEC afwijkt". De bestanden in `design/reference/` laten zien hoe het eruitziet.

## Harde eisen

- Alleen gratis bronnen. Geen betaalde API's, geen accounts, geen API-keys in de frontend.
- Geen pushmeldingen, geen backend-database.
- UI-tekst in het Nederlands (je/jij, zinshoofdletters, komma als decimaalteken, 24-uursklok). Code en commentaar in het Engels.
- Doelplatform: Safari op iOS (WebKit). Test op een iPhone-viewport van 390 × 844 en houd rekening met safe-area-insets.
- Bronvermelding zichtbaar voor Buienradar, KNMI, Open-Meteo en OpenStreetMap.
- Nooit een verzonnen waarde tonen: ontbreekt iets bij de bron, verberg het veld.

## Het ontwerp lezen

`design/reference/*.dc.html` zijn exports uit een ontwerptool. **Draai ze niet en kopieer de templatesyntax niet.** Inline
`style="…"` bevat de exacte maten en kleuren; `{{naam}}` komt uit `renderVals()` onderaan elk bestand; de formules daar zijn
bedoeld, de data is nep. Wijk alleen af als SPEC.md dat zegt of als iets technisch niet kan, en noteer het dan in de README.

## Stack en opbouw

- Vite 8 + React 19 + TypeScript, Zustand, Tailwind 4 naast de tokens in `src/styles/tokens.css`. Geen UI-framework en geen
  chart-library: grafieken zijn divs en SVG volgens het ontwerp. Leaflet (lazy) voor de radar.
- `src/domain/` is puur (geen React, geen fetch, geen `window`) zodat het naar Swift kan; `src/api/` één module per bron met
  getypeerde parsing; componenten krijgen alleen het genormaliseerde model uit `src/domain/types.ts`.
- Eén `RainChart` voor alle neerslaggrafieken.
- `api/rain.ts` is een Vercel Function, alleen als fallback-proxy voor Buienradar.
- Tests (Vitest) voor parsing, balkhoogte, regensamenvatting, weercodes en tijdlijn, met echte antwoorden in `tests/fixtures/`.

## Werkwijze

- Verandert een bron (`npm run check-sources` faalt): stoppen en melden, niet stilletjes vervangen. Werk §6 in SPEC.md bij.
- Vóór een commit: `npm test`, `npm run typecheck` en `npm run build` moeten slagen.
