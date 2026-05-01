# Prompt Arena

A lightweight 4-team game (`red`, `blue`, `green`, `yellow`) with polling-based live updates (no websockets).

## Flow

1. Recruiter Focus Finder warm-up (no score impact)
2. Team prompt round (up to 10 players per team)
3. Live leaderboard

## Control model

- Players use `/index.html`
- Master uses `/control.html`:
  - Landing view with game card and `Start Game Lobby`
  - Root-level `Claim Leaderboard` per session to route the single leaderboard display between Group A and Group B
  - Focused game view with live slot-by-slot player progress
  - `Start Game`, pause/resume timer toggle, `End Game`
  - `Close Game` after round completion to return to landing
  - Soft Skills Significance runs as 3 manual rounds of 2 minutes each

## Run

```bash
npm install
npm start
```

Open:

- Player flow: `http://localhost:3000/index.html`
- Master control: `http://localhost:3000/control.html`
- Intro display screen: `http://localhost:3000/intro.html` (designed for always-on room touchscreen)
- Leaderboard display screen: `http://localhost:3000/leaderboard.html` (always shows standings)
- Single leaderboard display screen (for claimed session): `http://localhost:3000/leaderboard.html?fullscreen=1&single=1`

## Master key

Set with environment variable:

```bash
MASTER_KEY="your-secret" npm start
```

Default is `master123` if not set.

## Notes

- State is in-memory (single server process).
- Round timer defaults to 15 minutes and is synchronized from server timestamps.
- Prompt scoring uses a built-in evaluator (no external AI key required), and team score is shown as average percentage.
