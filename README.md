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
