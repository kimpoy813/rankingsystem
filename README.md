# 🏆 Team Building Ranking System

A minimal, render-ready ranking system for team building activities. No build step, no
dependencies, no backend — three static files. Open `index.html` and you're live.

## Design

Quiet by default so the numbers do the talking:

- Flat surfaces, hairline borders, a single accent colour — no gradients, glows or glass effects.
- **Light and dark themes** that follow the OS setting automatically.
- One consistent emphasis rule everywhere: the leader is solid ink, everyone else is accent.
- A four-cell summary strip (teams · games · scored · leading) gives the state at a glance.
- Responsive: ranking moves above the games on narrow screens; touch-sized controls throughout.
- Respects `prefers-reduced-motion`, keeps visible keyboard focus, and labels controls for
  screen readers.

## Features

- **Flexible setup** — number of groups (2–16) and games (1–30), then rename the teams.
- **Configurable points per placing** — defaults to `1st = 10`, `2nd = 8`, `3rd = 6`, `4th = 4`…
  Every value is editable, so `10 / 5 / 3` is just as easy.
- **Per-game scoring** — pick each team's placing from a dropdown; points apply instantly.
  Sharing a place is allowed and flagged with a small "shared" tag.
- **Live ranking** — totals, progress bars, games played, wins, ties and movement indicators.
- **Anonymous final stretch** — during the **last 3 games**, team names are replaced by secret
  codes (e.g. "Golden Otter"). Points and ranks stay visible so the finish is dramatic without
  revealing who is who. A "Reveal names · 6s" button shows them briefly for the host.
- **Presentation mode** — "Present scoreboard" opens a full-screen, projector-friendly
  leaderboard with a trophy on the final reveal.
- **Auto-save** — everything is stored in `localStorage`; a refresh never loses your scores.
- **Demo data** — fills in sample scores to preview the whole flow in one click.

## Run it

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## How anonymity works

Anonymity applies to the **final 3 games** of the activity:

| Games set | Names hidden from |
|-----------|-------------------|
| 6         | game 4 onwards    |
| 8         | game 6 onwards    |
| ≤ 3       | game 1 onwards    |

It switches on as soon as scoring starts in that final stretch, and can be turned off entirely
with the *Final-stretch anonymity* toggle in Setup.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure — summary, setup, games, live ranking, scoreboard overlay |
| `styles.css` | Minimal design system, light/dark themes, responsive layout |
| `app.js` | State, scoring math, ranking, anonymity logic, persistence |

## Notes

- Ties are broken by game wins, then top-3 finishes, then name, and are flagged with a `tied` chip.
- Participants may share the same placing in a game (both get that placing's points).
- To reset between activities, use **Reset**.
