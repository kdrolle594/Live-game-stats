# Standings tab

## Goal
Header tabs: **Scores | Standings**. Standings shows East and West tables with full columns. Gives users a reason to visit on no-game days.

## UI changes
- Tabs in the header. Standings hides date nav, Today button, top performers and games grid.
- Two tables (East, West), stacked. Table scrolls sideways inside its card on phone; team column stays pinned.
- Columns: Seed, Team (logo + name), W, L, PCT, GB, Home, Away, Conf, L10, Streak, PPG, Opp PPG, Diff. Header cells have a title tooltip with the full name.
- Divider after seed 6 (playoff) and seed 10 (play-in). Diff green/red. Arena look.
- Refresh button reloads the current view.
- Last tab remembered in `localStorage`, wrapped in try/catch.

## Data
- `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings` via `fetchJson` (worker proxy, then direct).
- `children[]` = conferences; `standings.entries[]` = team + `stats[]` (wins, losses, winPercent, gamesBehind, streak, playoffSeed, avgPointsFor, avgPointsAgainst, differential; Home / Road / vs. Conf. / Last Ten Games as `summary` strings).
- Stats looked up by `name`, `type` or `abbreviation`, so small ESPN naming changes don't break it.
- Fetched when the tab opens; cached in memory 5 min. No auto-refresh. Scoreboard auto-refresh pauses while on Standings.

## Edge cases
- API error → message + Retry button.
- Preseason (0-0) / missing seeds → sort by PCT, then wins, then name.
- Missing stat → `—`.

## Open questions
- Field names not verified live (ESPN blocked from the build container). Check in the browser after deploy.
