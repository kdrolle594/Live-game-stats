# Player Stat Card

## Goal
Click a player name in the box score → modal stat card with photo, season-by-season averages, career averages, and accolades.

## UI changes
- Player names in box score become buttons (keyboard focusable, hover underline).
- Modal header: large headshot, name, team, position, jersey #. Team color accent.
- Accolades row: badge chips with counts (e.g. `4× MVP`, `11× All-Star`, `All-NBA 1st ×4`, `All-Defensive 1st`, `ROY`, `MIP`). Ordered by prestige. Hidden if none.
- Stats table: Season | Team | GP | MIN | PTS | REB | AST | STL | BLK | FG% | 3P% | FT%. All seasons, current season highlighted on top, career row pinned at bottom. Scrolls inside the modal.
- Close with X, Esc, or backdrop click. Full-screen sheet on phone.
- Loading skeleton; stats and awards load separately so one failure doesn't block the other.
- Styled with the frontend-design skill to match the arena look.

## Data (Approach A: ESPN via worker proxy)
- Stats: `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/{id}/stats` (season averages + career).
- Awards: `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/{id}/awards` → fetch each award ref, group by name, count seasons.
- Photo: existing `headshotUrl()`.
- All requests through `this.proxied(...)`. Cache per player ID in a `Map`.

## Code changes
- `index.html`: empty `<dialog id="player-card">` container.
- `app.js`:
  - `boxTableHtml`: wrap name in `<button class="pname" data-player-id>`.
  - Delegated click listener → `openPlayerCard(id, game, side)`.
  - `fetchPlayerStats(id)`, `fetchPlayerAwards(id)` with cache.
  - `parseSeasons()`, `groupAwards()` (ESPN award names → short labels + prestige order).
  - `playerCardHtml()` render.
- `style.css`: modal, badges, stats table, mobile sheet.
- Worker: no change.

## Edge cases
- Rookie / no past seasons → current + career only.
- No awards → hide accolades row.
- Stats or awards fetch fails → error message in that section only.
- Missing headshot → initials fallback.
- Demo/mock mode → card uses real IDs; shows error state if offline.
- Live auto-refresh re-renders box score → modal lives outside box score DOM so it stays open.

## Open questions
- ESPN endpoint shapes not verified yet — confirm first when building.
- If ESPN lumps All-NBA / All-Defensive team levels, show "All-NBA ×N" only.
