# Opening catalogue

Source: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), revision `a6189a30dc273ccb21fc2536a9a2fefd5592a67a`, CC0-1.0 (see `COPYING.txt`). The five TSV files and revision are retained for reproducibility.

`node scripts/build-opening-book.mjs` builds `openings.json`. It indexes named opening positions and all intermediate positions and transitions appearing in the published lines. Matching uses piece placement, turn, castling rights and legal en-passant state, without move counters, so recognised transpositions can return to the book. A move that reaches a known book position is Book, even when its exact move order differs from the catalogue.

The opening label comes from the current named position or its known opening context. The last identified opening remains visible after leaving the book. Book labels reflect this catalogue, which includes gambits and unusual recognised openings; they are not claims that every theoretical move is Stockfish's top choice.
