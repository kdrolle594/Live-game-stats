# Favorite teams

## Context
Next item from the retention brainstorm (Standings already shipped). User picks: **star on game card**, **any number of teams**, effect = **pin their games to the top** (with a highlight). Not doing: standings highlight, "my teams" filter, next-game card.

## Goal
Tap a star next to a team on a game card → that team's games show first on Scores, marked as a favorite. Saved between visits.

## UI changes
- Star button next to each team name on the card (`fa-star` outline / solid amber). `aria-pressed`, label "Favorite Celtics" / "Unfavorite Celtics".
- Card with a favorite team: amber left edge + small "★ My team" tag next to the status badge.
- Order on Scores: favorite games first, then the current order (live → upcoming → final). Inside each group keep the live/upcoming/final order.
- Tap star → re-render grid right away (card jumps to top). Focus stays on the star.
- Star button doesn't open the box score (stop the click from reaching `.card-open`).

## Data
- No API. `localStorage` key `nbaLiveHub.favorites` = array of ESPN team ids (strings). Read once at start, wrapped in try/catch (blocked storage → empty list, stars still work for the session).
- Team id = `game.home.id` / `game.away.id` from `normalizeESPNGames` (app.js ~298). Mock data `team()` already sets ids.

## Code changes
- `index.html`: add `<button class="fav-btn" type="button">` inside each `.name-record` in `#game-card-template`; add `<span class="fav-tag" hidden>` in `.game-status`.
- `app.js`:
  - const `FAV_KEY`; constructor `this.favorites = this.loadFavorites()` (Set).
  - `loadFavorites()`, `saveFavorites()`, `isFavGame(game)`, `toggleFavorite(teamId, name)`.
  - `renderTeam()`: set star state + aria on `.fav-btn`, `data-team-id`.
  - `renderCard()`: `card.classList.toggle('is-fav', ...)`, show `.fav-tag`.
  - `render()` sort (app.js:469): sort by `isFavGame` first, then existing `order[state]`.
  - Grid click handler (app.js:153): if `.fav-btn` → toggle + `this.render()`, return before `.card-open` check.
- `style.css`: `.fav-btn` (small, no border, steel → amber when pressed, 32px tap target), `.game-card.is-fav` amber edge, `.fav-tag`.

## Edge cases
- No games / favorites not playing → normal order, nothing else.
- Both teams favorites → one card, still pinned.
- Silent 30s refresh re-renders → stars and order stay (state lives in `this.favorites`).
- Storage blocked → works for this visit only.
- Mock data (offline) → stars still work.

## Verification
- Playwright on `index.html` (network blocked → mock games): star the 3rd card's home team → that card moves to first, has `is-fav`, star `aria-pressed=true`; reload → still first; unstar → back to normal order; clicking star doesn't open the dialog. Screenshot desktop + 375px.
