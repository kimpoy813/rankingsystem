# 🏆 Team Building Ranking System

A render-ready, single-page ranking system for team building activities. No build step, no
dependencies, no backend — just three static files. Open `index.html` and you're live.

## Features

- **Flexible setup** — set the number of groups (2–16) and games (1–30), then rename the teams.
- **Configurable points per placing** — defaults to `1st = 10`, `2nd = 8`, `3rd = 6`, `4th = 4`…
  Every value is editable, so you can make it `10 / 5 / 3` or anything else.
- **Per-game scoring** — for each game, pick each team's placing from a dropdown; points are
  awarded automatically and the placing list is fully independent per game.
- **Live ranking** — standings, bars, points, games played, wins and up/down movement indicators
  update instantly on the right-hand panel.
- **Anonymous final stretch** — while the **last 3 games** are being played, the scoreboard
  replaces team names with secret 🕵️ codes (e.g. "Golden Otter"). Points and ranks stay visible
  so the finish is dramatic, but nobody can tell which team is which. An optional
  **"Reveal for 6s"** button shows the names briefly for the host.
- **Presentation mode** — "Present Scoreboard" opens a full-screen, projector-friendly
  leaderboard with medals, animated bars and a champion crown when every game is scored.
- **Auto-save** — everything is stored in `localStorage`, so a refresh never loses your scores.
- **Demo data** — the "✨ Demo data" button fills in sample scores to preview the whole flow.

## Run it

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How anonymity works

Anonymity applies to the **final 3 games** of the activity:

| Games set | Names hidden from |
|-----------|-------------------|
| 6         | game 4 onwards    |
| 8         | game 6 onwards    |
| ≤ 3       | game 1 onwards    |

It switches on as soon as scoring starts in that final stretch, and can be turned off entirely
with the *Final-stretch anonymity* toggle in Activity Setup.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure (setup panel, games, live ranking, scoreboard overlay) |
| `styles.css` | Dark podium-themed design system, responsive layout, animations |
| `app.js` | State, scoring math, ranking, anonymity logic, persistence |

## Notes

- Ties are broken by game wins, then top-3 finishes, then name, and are flagged with a `tied` chip.
- Participants may share the same placing in a game (both get that placing's points).
- To reset between activities, use **Reset** or just rename groups/games and clear each game.
