# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Keyboard-first lock entry on the board. Three rules: ↑/↓ pick a plate (the same way the game does), 1–7 set its position, Shift+1–7 cycle its link to plate k, Enter solves — a five-plate lock goes in from the keyboard in under twenty keystrokes, no mouse. Works on any keyboard layout (physical keys, not characters), leaves every existing mouse control untouched, and announces each edit to screen readers; a one-line legend under the board spells the keys out.

## [0.6.0] - 2026-07-10

### Added

- Share a lock as a link. A "Copy link" button next to Solve/Reset packs the whole lock — plates, positions, links, direction convention — into a ~19-character URL. Opening the link restores the lock and solves it immediately; the recipient sees it in their own language. A damaged or truncated link is politely rejected ("your lock was left unchanged") rather than silently opening a different lock, and links from future versions of the tool say so instead of breaking.
- Saved locks. Every solved lock is remembered automatically in a "Saved locks" list at the bottom of the page (locks in the game never change their layout, so a lock solved once never needs re-entering). Entries can be named ("Old Camp — Diego's chest"), kept (pinned entries survive the 20-entry cap), or removed with a two-tap confirm; one click restores and re-solves the lock. Re-solving a known lock updates its entry instead of duplicating it, and opening a shared link first tucks your own in-progress lock safely into the list. Everything stays in your browser.

## [0.5.0] - 2026-07-10

### Added

- Hands-free autoplay. A Play/Pause button on the playback bar (hotkey P) walks the solution automatically: each step is announced (when voice is on) and the bar lingers long enough to actually perform it in the game — the pause scales with how many times the plate must be pressed and with the chosen speech speed. Autoplay stops at "Lock open", steps aside the moment you take manual control (Prev/Next/Restart or their keys), and pauses itself when the tab goes to the background rather than desyncing. Play at the end restarts from step one. It also works with voice off, as a silent metronome paired with the board follow mode.
- A repeat control: press R (or the speaker button on the bar) to hear the current step again. It answers even when "Speak steps" is off — a deliberate one-shot request, handy when a step was missed mid-game.

## [0.4.0] - 2026-07-10

### Changed

- Voice announcements now live in their own "Voice" settings card in the left column next to the counting convention, instead of a cramped checkbox on the playback bar. The "Speak steps" toggle keeps working the same way (turning it on still speaks the current step to unlock audio), and a new Speed control (Slow / Normal / Fast) lets you pick how fast the steps are read; the choice is remembered across sessions and takes effect the moment you change it. The card is hidden entirely on browsers without speech synthesis.

## [0.3.0] - 2026-07-10

### Added

- Voice step announcements. An opt-in "Speak steps" checkbox on the playback bar reads every replay step aloud — "Plate 6. Right, 3 times." — in the interface language, so the combination can be entered by ear without looking back at the screen. Announcements use the browser's built-in speech synthesis (Web Speech API): nothing is downloaded, everything stays offline. A fresh solve and every Prev/Next/Restart announce the step you should perform; rapid stepping never queues a backlog (each announcement replaces the previous one); turning the checkbox on speaks immediately, which also unlocks audio on iOS. Counts are grammatically correct in all 20 locales — the Slavic 1/2–4/5+ split ("3 рази" / "5 разів"), spelled-out Czech/Slovak/Hungarian multiplicatives ("třikrát", "háromszor"), the Chinese measure word ("两次") and the feminine "2" in Romanian, Catalan and Portuguese ("de două ori", "dues vegades", "duas vezes"). When the browser has no voice for the language, a near-language voice steps in where that is intelligible (Valencian → Catalan, Slovak → Czech, Latin-American Spanish → es-MX); otherwise the app shows a quiet "no voice for this language" hint and stays silent rather than letting an English voice garble foreign words.

## [0.2.0] - 2026-07-08

### Added

- Full internationalization with Paraglide JS: the interface ships in 20 locales (en, de, pl, cs, sk, hu, ro, uk, ru, es, es-419, ca, ca-ES-valencia, pt, pt-BR, it, fr, nl, tr, zh). On the first visit the site picks the browser's preferred language; a manual choice is remembered in localStorage. A switcher in the top-right corner lists every language by its own name and flag, and the lock you are building survives a language switch. Valencian ships its own Reial Senyera flag rather than reusing the Catalan Senyera.
- Cloudflare Workers deployment via `@sveltejs/adapter-cloudflare` + `wrangler.jsonc` (live at https://gothic-lockpick-solver.v-be8.workers.dev).
- A shared plate-count control (4–7) above the view switch, so the count can be changed in board mode too (previously only in the table).
- A "Reset" button that restores the default lock.
- Full SEO: descriptive `<title>` and meta description, Open Graph and Twitter cards with a 1200×630 WebP share image, JSON-LD `WebApplication` structured data listing all 20 languages, canonical URL, `sitemap.xml`, `robots.txt` that welcomes search-driving AI crawlers, a lock-shaped favicon, an Apple touch icon, and a web app manifest. A `<noscript>` fallback describes the tool for crawlers that do not run JavaScript.
- A second-screen replay mode. A fixed playback bar walks the solution one grouped step at a time with large Prev/Next controls, a platform-neutral d-pad direction icon, a step counter, and a progress bar. Arrow keys and Space drive it, Home/End jump to the first/last step, and the screen is kept awake while it is open.
- A board follow mode. While you replay the solution, the board mirrors the pin positions for the step you are about to perform and locks its controls, with a one-tap "Edit lock" banner to take back control. The preference is remembered across sessions.

### Changed

- Plate links are entered as **same / opposite / no-link** (`»` green / `⇄` red / `—`) instead of left/right arrows, in both board and table. Each link is a single button that cycles through the three states on click, so a plate's couplings are a short row rather than a dense three-buttons-per-target grid. The plate you are editing shows up in that row as a dimmed `⊙` anchor, and a colour-coded legend spells out what every icon means. A link is defined relative to the plate you move — same way, opposite way, or no reaction — which is independent of which side you call "right" and sidesteps the direction convention entirely.
- Board pin-slots grow to fill the row — larger and more tactile on a laptop while still fitting seven across on a phone.
- The solver's `directionLabel` became a locale-free `physicalDirection` returning a `right`/`left` token; the UI now localizes it. The lock configuration is persisted to localStorage so it survives reloads (including a language switch).

### Fixed

- Reset no longer discards your direction-convention and board/table view preferences; it now clears only the lock itself.
- Active pins on the board are far easier to spot at a glance: a brighter, larger pin with an ember ring, a subtle glow, and a bold position number, and the plate label now echoes the current position.

## [0.1.0] - 2026-07-05

### Added

- SvelteKit + FSD project scaffold, oxc + Vitest tooling.
- Lock domain types and shared configuration constants: `LockState`, `CouplingMatrix`, `Move`, `Solution`, and plate position bounds. Enables type-safe solver implementation and config-driven constraints across shared and domain layers.
- Pure lock mechanics: `clampPosition`, `isGoalState`, `encodeState`, `applyMove`. Atomic move validation ensures coupled plates never leave [1,7] bounds; state encoding provides unique positional hash for visited-state tracking.
- BFS solver `solvePuzzle`: level-order search over lock states returning the shortest wall-safe move sequence, or `solvable:false` once the reachable state space is exhausted.
- Move grouping and direction labeling: `groupMoves` merges consecutive identical (plate,dir) moves into single grouped moves with count; `directionLabel` maps solver directions to physical labels (вправо/влево) based on convention (right-increases/right-decreases).
- `runSolver` wrapper running `solvePuzzle` inside a dedicated Vite module worker (`solver.worker.ts`), keeping the BFS search off the UI thread while resolving with the same `Solution` shape.
- `lockStore`: reactive runes-based store (`$state`) acting as the single source of truth for plate count, positions, coupling matrix, direction convention, view mode, and solve result. Resizing the plate count reshapes `positions`/`coupling` and clears any stale result, keeping the UI and solver input always in sync.
- Global OKLCH design tokens (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--ember`, `--brass`, `--goal`, `--danger`), self-hosted Cinzel/Inter/JetBrains Mono fonts via `@fontsource`, minimal reset, and `prefers-reduced-motion` support. All text/background pairs verified at WCAG AA contrast or better.
- Shared UI primitives (`src/lib/shared/ui`): `SegButton` (toggle button with `aria-pressed`, used for position/plate-count selectors), `Toggle` (accessible segmented `radiogroup` control), `Card` (panel with a brass hairline edge), and `Button` (primary/secondary action button). All styling is token-driven, keyboard-focusable with visible focus rings.
- Plate entity UI (`src/lib/entities/lock/ui`): `PinSlot` (single position button with a raised-pin marker for the active slot) and `PlateRow` (`radiogroup` of 7 `PinSlot`s per plate, highlighting position 4 as the goal and switching to the `--goal` accent once reached).
- `ConnectionArrows` (`src/lib/features/edit-connections/ui`): a `←/0/→` segmented control for one ordered plate-pair coupling value, built from `SegButton`.
- `LockBoard` widget (`src/lib/widgets/lock-board`): the visual board input — one `PlateRow` per plate plus, under each plate, a `ConnectionArrows` control for every other plate it can affect. Reads `plateCount`/`positions`/`coupling` straight from `lockStore` and writes back via `setPosition`/`setCoupling`, so the board and the solve result stay in sync with no local state.
- `LockForm` widget (`src/lib/widgets/lock-form`): a compact matrix alternative to the board — a plate-count `SegButton` row (4–7), then one row per plate with a `SegButton` position selector and a `←/0/→` connection chip per other plate. Reads and writes the same `lockStore` fields as `LockBoard`, so switching view modes never desyncs the two inputs.
- `DirectionToggle` feature (`src/lib/features/toggle-direction`): a two-option `Toggle` for the physical direction convention ("Вправо = номер растёт" / "падает"). Switching calls `lockStore.setConvention`, which also clears any stale solve result so a displayed solution never contradicts the selected convention.
- `SolveButton` and `ResultPanel` (`src/lib/features/solve-lock/ui`): `SolveButton` triggers `lockStore.solve()` and disables itself while the worker is running. `ResultPanel` renders `lockStore.result` — a grouped, directional move list with step-by-step playback (prev/next through each grouped move) when solvable, an "already open" note when the start position is the goal, and a corrected Master-perk explanation for the unsolvable case: framed as a beneficial simplification that can occasionally make one specific lock unsolvable, never as a plain defect.
- Composed solver page (`src/routes/+page.svelte`): hero, an "Откуда считать" convention card (coordinate-system agreement + `DirectionToggle`), a "Замок" card with a board/form view switch (`lockStore.viewMode`) wrapping `LockBoard`/`LockForm`, `SolveButton`, `ResultPanel`, and a ported "Как правильно снять связи" help `<details>` section. Plate-count copy now says 4–7 (never 3), and the Master-perk step in the help text is corrected to the beneficial-simplification framing.
- Solution playback highlights the plate currently being moved on the board — not only in the move list — so the sequence is something you watch, tuned to look right on a 16" laptop and an iPhone-sized screen.

### Changed

- Desktop layout is a two-column reference/tool "workbench" inside a wider container, so a large laptop uses its width instead of a single narrow strip; the phone layout stays one column. Ember is reserved for meaningful state (the active pin, a real coupling) rather than every neutral `0`, and the goal slot carries a persistent target marker.
- Solve orchestration moved from the entity store into the `solve-lock` feature (`solveCurrentLock`) to keep FSD imports strictly downward; the store holds state only and exposes `snapshotConfig()`.

### Fixed

- Editing a position or coupling now clears the displayed solution and the board highlight, and a per-edit generation token stops a solve that finishes after an edit from overwriting the lock with a stale answer.
- Corrected the "how to read the links" help: you quicksave _before_ opening a lock (you can't save once the mini-game is open), and a reload doesn't change the lock — its layout is fixed. Fixed across every locale.
