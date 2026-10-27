# Weer naar SwiftUI porten

Net als bij Iron is de PWA zo opgezet dat een native iOS-versie **alleen de UI-laag opnieuw bouwt**.
Drie dingen gaan (bijna) ongewijzigd mee:

1. **De data** in `shared/data/*.json` — als resource meeleveren en met `Codable` inlezen.
2. **Het datamodel** (`src/domain/types.ts`) — één `Codable` struct per interface. Alle tijden zijn epoch-**milliseconden**
   (`Double`), dus de JSON-cache van de PWA en die van de app zijn uitwisselbaar.
3. **De domeinlogica** in `src/domain/*.ts` — kleine, pure functies met tests (`tests/*.test.ts`) die je 1-op-1 naar XCTest
   overzet. Niets in `src/domain` importeert React, Zustand, Leaflet of `fetch`.

## Modules

| TypeScript (PWA) | Swift (native) | Opmerkingen |
|---|---|---|
| `domain/types.ts` | `Models/*.swift` | `Condition` wordt een `String`-enum. `Location.id` is `gps` of `om-<geonames id>`. |
| `domain/rain.ts` | `Rain.swift` | `barHeight`, `intensityLines`, `fadeOpacity`, `rainSummary`, `rainShort`, `isStale`. Waarden uit `rain-scale.json`. |
| `domain/weather.ts` | `WeatherCode.swift` | Tabel uit `weathercodes.json`; `heroDescription`: de nowcast wint als die nu nat is en de code droog. |
| `domain/days.ts` | `Days.swift` | `tempBars`, `nextSunEvent`, `uvTile`, `tempChart` (punten midden in elke uurkolom, 1° marge). |
| `domain/axis.ts` | `Axis.swift` | "Nu" plus echte halve uren, minimaal `ceil(n/6)` stappen ertussen. |
| `domain/radar.ts` | `RadarTimeline.swift` | Afgelopen uur aan frames + nowcast na het nieuwste frame. |
| `domain/locations.ts` | `Places.swift` | NL, dan BE, dan de rest; ontdubbelen op id of < 0,01° afstand. |
| `domain/time.ts` | — | Vervalt: `Calendar` + `TimeZone(identifier:)` doen dit. Houd `Europe/Amsterdam` voor Buienradar-tijden. |
| `domain/format.ts` | `Format.swift` | Of `NumberFormatter`/`DateFormatter` met `nl_NL`. Windsectoren en UV-labels blijven eigen code. |
| `api/*.ts` | `Sources/*.swift` | Zelfde URL's en parsing; de fixtures in `tests/fixtures/` zijn ook de Swift-testinvoer. |
| `app/store.ts` | `WeatherStore` (`@Observable`) | Zelfde regels: cache eerst, niet opnieuw ophalen binnen 2 min, elke 5 min zolang zichtbaar. |
| `app/platform.ts` | CoreLocation | `getCurrentPosition` → `CLLocationManager.requestLocation()`. |
| `ui/RadarMap.tsx` | MapKit | OSM-tegels via `MKTileOverlay`; KNMI WMS-frames als tweede `MKTileOverlay` per tijdstip. |

## Wat native beter kan

- **Widgets** (buiten scope van v1): de regensamenvatting en de mini-regenbalk passen in een klein widget.
- **Achtergrondverversing** met `BGAppRefreshTask`, zodat de app bij openen al verse data heeft.
- **WeatherKit** vraagt een betaald Apple-developeraccount; houd de bronnen gelijk aan de PWA (gratis, zonder account).
