import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {gameOpeningMoves,applyOpeningBook,positionKey,BOOK_VERSION} from '../server/openings.js';
import {explain} from '../server/grading.js';

test('recognises the Ruy Lopez and its book moves',()=>{
  const rows=gameOpeningMoves('1. e4 e5 2. Nf3 Nc6 3. Bb5');
  assert.equal(rows.length,5);assert.ok(rows.every(r=>r.book));
  assert.match(rows.at(-1).opening.name,/Ruy Lopez|Spanish/);
});
test('recognises opening positions across move-order transpositions',()=>{
  const a=gameOpeningMoves('1. Nf3 d5 2. d4 Nf6 3. c4');
  const b=gameOpeningMoves('1. d4 Nf6 2. c4 d5 3. Nf3');
  assert.ok(a.at(-1).book);assert.ok(b.at(-1).book);
  assert.deepEqual(a.at(-1).opening,b.at(-1).opening);
});
test('leaving the opening book keeps the most recent opening name',()=>{
  const rows=gameOpeningMoves('1. e4 e5 2. Ba6');
  assert.equal(rows[2].book,false);assert.deepEqual(rows[2].opening,rows[1].opening);
});
test('book explanations never suggest an engine alternative',()=>{
  const text=explain(new Chess().fen(),{san:'d4'},{classification:'Book',opening:{name:"Queen's Pawn Game"},uci:'d2d4',bestUci:'e2e4'});
  assert.match(text,/book move/);assert.match(text,/Queen's Pawn Game/);
  assert.doesNotMatch(text,/Instead|preferred|stronger|e4/);
});
test('upgrades saved reviews while preserving engine data and recomputing counts',()=>{
  const board=new Chess(),move=board.move('d4');
  const row={index:0,san:move.san,color:move.color,uci:'d2d4',fenBefore:move.before,fenAfter:move.after,bestUci:'e2e4',classification:'Good',beforeCp:30,afterCp:0,bestPv:['e2e4'],replyLine:[],beforeMate:null,afterMate:null};
  const review=applyOpeningBook({rows:[row]});
  assert.equal(row.classification,'Book');assert.equal(row.engineClassification,'Good');assert.equal(row.bestUci,'e2e4');
  assert.equal(review.counts.w.Book,1);assert.equal(review.accuracy.w,100);assert.equal(review.bookVersion,BOOK_VERSION);
  assert.equal(applyOpeningBook(review).rows[0].engineClassification,'Good');
});
test('book matching ignores move counters',()=>{
  const fen=new Chess().fen();assert.equal(positionKey(fen),positionKey(fen.replace('0 1','8 11')));
});
