# Fix-Report Singleplayer (Branch qa-fix/singleplayer)

- **Basis:** main @ 9b2a9ea
- **Verifikation:** echter Browser (Camofox REST, Viewport 1920x987) gegen
  statischen Stand des Fix-Branches (`python3 -m http.server`, KEIN Live-Container-Restart).
  Re-Verifikation gegen den Live-Stack nach Merge ist **offen**.
- **Screenshots:** `qa-reports/singleplayer/screenshots/fix-*.png` (in diesem Branch)

## Testergebnisse

| Check | Ergebnis |
|---|---|
| Canvas-Skalierung (Issue #1) | `scale(1.47833)` statt `scale(0)`; Maze + beide Score-Boxen + RADAR zentriert sichtbar (`fix-1p-centered.png`, `fix-1p-gameplay.png`) |
| 1P-Start per Taste 1 (Hold-Latch) | nach mehreren kurzen Tastendrücken startet echtes Gameplay (Dungeon, 6 Gegner, gelbe Figur schießt; `fix-1p-action.png`) |
| 2P-Neustart per Shift/Taste-2 (Issue #2) | Engine-Logik verifiziert: `scanTitle`/`scanGameOver` akzeptieren Enter/Shift/`true`/`'hold'`; jsdom-äquivalenter In-Browser-Test (verify3): `a_restart=getReady/1`, `b_2p=getReady/2` |
| Attract-Stop vor startNewGame (Issue #3) | `play.js startGame()` ruft `resetGame()` + löscht Tastenzustand vor `startNewGame`; In-Browser-Test: `scene=getReady` direkt nach PLAY, kein sofortiges Game Over |
| Zentrierung (Issue #4) | Standalone + SP: `rect l=250 w=1419` (Viewport 1920), beide Score-Boxen + RADAR sichtbar; Score-Tabelle zentriert (`fix-standalone-title.png`) |
| Sound-Badge (Issue #5) | `♪` oben rechts sichtbar, Klick toggelt `on->off (✕)` -> `on (♪)` (`options.sound` + localStorage); wird bei Teardown entfernt |
| Plural (Issue #6) | `1 game • 1 player`, `1 player`, `1 dungeon` verifiziert |
| aria-label (Issue #8) | `aria-label="Wizard of Wor game screen"` auf allen drei Canvas-Templates |
| Konsole | kein neuer JS-Fehler durch die Fixes (Seite meldet `window.__errors` nicht; Standalone ohne Fehler geladen) |

## Offene Punkte

- **Re-Verifikation nach Merge** gegen den Live-Stack (Container `wizard-of-wor-web-1`)
  mit Root-Menü (`/`), 1P + 2P inkl. echtem Tastatur-Neustart aus Game Over/Titel.
- **2P-Gameplay mit blauer Figur** im Live-Menü gegentesten (im Fix-Stand nur Engine-Ebene verifiziert).
- **Echter Tastatur-Neustart aus Game Over** (Enter/Shift-Hold) im Live-Menü gegentesten —
  synthetische `keydown`-Events ohne `keyup` feuerten im Headless-Browser kein `scanGameOver`,
  weil die Szene dort nie `gameOver` erreichte (erwartbar ohne langes Spielen).
- Issue #7 (Game-Over-Text unter Wänden) bewusst **nicht** angefasst (originalgetreu laut QA).
