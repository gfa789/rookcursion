# Rookcursion

A mobile-friendly chess study studio using React, Express, SQLite and Stockfish. Import Chess.com games, analyze positions, review moves and save engine-based explanations. No LLM API key is needed.

## Study features

- Automatic five-minute Chess.com polling, full-history import and a persistent Stockfish analysis queue.
- Mobile game library, compact review controls, opening-book recognition and grade-coloured move highlights.
- Insights scoped to All, Rapid, Blitz or Bullet: openings, recurring mistakes, ratings and results.
- Personalised multi-move puzzles with automatic opponent replies, hints, solution replay and inline explanations.
- Learn lessons from opening mistakes across reviewed history, prioritising repeated positions and offering opening / time-control filters.
- Persistent practice progress and engine checks for equally strong alternative continuations.
- Responsive layouts with large touch targets and paged content instead of document scrolling.

## Automatic deployment

Pushes to `main` run tests and build the app, then use the existing private deployment workflow. Pull requests run validation only. The server keeps persistent data outside release directories and retains the previous release if a build or health check fails. See [auto-deployment details](deploy/AUTO_DEPLOY.md).

## Run locally

Requires Node.js 24 LTS. Set CHESS_USERNAME and TAILSCALE_OWNER in your environment, then run `npm ci`, `npm run build`, and `npm start`. Open http://127.0.0.1:8890. A second owner-checked listener runs on 127.0.0.1:8891 for Tailscale Serve.

## Privacy and deployment

Source code is public; deployed dashboards are private to the configured
Tailscale owner. No personal databases, access tokens, credentials or imported
health records are included. Runtime state is excluded from Git. See
[deployment instructions](deploy/README.md) for always-on Linux hosting.

The bundled opening catalogue is from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), distributed under CC0. Stockfish is installed as a dependency and has its own GPL license; see the upstream [source and license](https://github.com/official-stockfish/Stockfish).

## Checks

`npm test` and `npm run build`.

## Insights and date ranges

Insights opens on the rating trajectory. Time-control and date-range toggles apply together to results, opening rankings, recurring mistakes, source-game examples and ratings. All time uses the full history; YTD starts on 1 January; 90 days is a rolling 90-day window; Last month starts at the same date and time in the previous calendar month, clamped to its last day when necessary. Date calculations use UTC and display dates use Europe/London. Future-dated records are excluded.

Rating charts use monthly checkpoints for all time, weekly checkpoints for YTD, and daily checkpoints for shorter ranges, with the first rating in the period retained as an anchor. Rating change and peak refer to the selected period. An empty period does not borrow older ratings.

Explore insights opens large Results, Openings, Mistakes and Background sections. Opening / mistake rows drill into a detail view before opening a source game. Compact Back / Ratings controls replace the main menu in drilled-in views, and Back from a source review returns to the same insight. Filters and list pages remain available when navigating back. Background progress always covers the complete queue.
