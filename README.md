# 🏆 Team Building Ranking System

A minimal, render-ready ranking system for team building activities. No build step, no
dependencies, no backend — three static files. Open `index.html` and you're live.

## Design

Quiet, white and green, so the numbers do the talking:

- White surfaces, hairline borders, a single green accent — no gradients, glows or glass effects.
- One emphasis rule everywhere: the leader is solid green, everyone else is a soft green tint.
- Green-family colour dots keep teams distinguishable without breaking the palette.
- A four-cell summary strip (teams · games · scored · leading) gives the state at a glance.
- Responsive: the ranking moves above the games on narrow screens; touch-sized controls.
- Respects `prefers-reduced-motion`, keeps visible keyboard focus, and labels controls for
  screen readers.

## Features

- **Flexible setup** — number of groups (2–16) and games (1–30).
- **Teams name themselves** — type a name in Setup, or hit *Clear names* so each team can
  enter its own name on the spot.
- **Configurable points per placing** — defaults to `1st = 10`, `2nd = 8`, `3rd = 6`, `4th = 4`…
  Every value is editable, so `10 / 5 / 3` is just as easy.
- **Fast place entry** — each game lists its places (`1st`, `2nd`, `3rd`…) and you pick a team for
  each one. Focus jumps to the next open place after every pick, and the leftover teams appear as
  chips you can tap to fill the next free spot, so a game can be scored in a few clicks.
- **No duplicate places, ever** — a place can only hold one team and a team can only hold one
  place, so the "two teams in 4th" error is impossible by construction. Picking a team that is
  already placed elsewhere simply swaps the two teams.
- **Live ranking** — totals, progress bars, games played, wins and movement indicators.
- **Fully anonymous final stretch** — for the **last 4 games**, every team name is hidden.
  No codes, no aliases, no hints: rows simply read *Anonymous* with their points and rank, so
  nobody can tell who is who. *Reveal names · 6s* shows them briefly if the host needs to check.
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

Anonymity applies to the **final 4 games** of the activity:

| Games set | Names hidden from |
|-----------|-------------------|
| 6         | game 3 onwards    |
| 8         | game 5 onwards    |
| ≤ 4       | game 1 onwards    |

It switches on as soon as scoring starts in that final stretch, and can be turned off entirely
with the *Final-stretch anonymity* toggle in Setup. Points, ranks and bars stay visible the whole
time — only identities disappear.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure — summary, setup, games, live ranking, scoreboard overlay |
| `styles.css` | White/green design system, responsive layout |
| `app.js` | State, scoring math, ranking, anonymity logic, persistence |

## Ties

There are **no tie-breakers**. Ranking is purely by total points:

- Equal totals share the same rank number and are marked `tied`, in the same order the groups
  were created — no hidden win-count or alphabetical rule decides who is "ahead".
- If the lead is shared, the summary strip says **Tied lead** instead of a team name.
- Within a single game, ties cannot happen at all: every place is used at most once.

## Notes

- A blank team name shows as *Unnamed group A*, *Unnamed group B*, … so they stay tellable apart.
- Old saves that contain two teams in the same place are repaired automatically on load.
- To reset between activities, use **Reset**.
