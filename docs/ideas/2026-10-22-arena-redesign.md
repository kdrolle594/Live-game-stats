# Arena redesign + game stats

## Goal
Make NBA Live Hub easier to scan and better looking, add game stats, and put stat leaders up front.

## UI changes
- Arena scoreboard look: court navy base, scoreboard amber for key numbers, team color edge on each card.
- Type: Barlow Condensed (scores, numbers), Barlow (text).
- "Tonight's top performers" band: night's leader in PTS, REB, AST, STL, BLK across all games.
- Game card: away @ home, big scores, 5 leader rows (away leader | stat | home leader), higher value in amber.
- Click a started game to open a dialog: team stat comparison bars + full box score per team.

## Data
- Scoreboard: `site.api.espn.com/.../nba/scoreboard?dates=YYYYMMDD` (via worker proxy).
- Box score: `site.api.espn.com/.../nba/summary?event=ID` (via worker proxy), fetched in parallel for games that have started. Needed for STL/BLK, team stats and player lines.
- Fallback: scoreboard leaders (PTS/REB/AST) when a box score call fails.

## Code changes
- `index.html`: new header, top performers band, card template, dialog.
- `app.js`: local date formatting, box score fetch + normalize, leaders + nightly top, dialog render, mock data in same shape.
- `style.css`: full restyle.

## Edge cases
- No games: empty state with a prompt to pick another date.
- Scheduled games: tip-off time, no stats, not clickable.
- Network blocked: mock data + toast.
- Auto-refresh every 30s on today; open dialog refreshes too.
