# Rookcursion

A mobile-friendly chess study studio using React, Express, SQLite and Stockfish. Import Chess.com games, analyze positions, review moves and save engine-based explanations. No LLM API key is needed.

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
