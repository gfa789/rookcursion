import {readFileSync,writeFileSync} from 'node:fs';
import {Chess} from 'chess.js';
const folder=new URL('../server/book/',import.meta.url);
const key=fen=>fen.split(' ').slice(0,4).join(' ');
const edges=new Set(),named=new Map(),paths=[];
let entries=0;
for(const volume of ['a','b','c','d','e']){
  const lines=readFileSync(new URL(`${volume}.tsv`,folder),'utf8').trim().split(/\r?\n/).slice(1);
  for(const line of lines){
    const [eco,name,pgn]=line.split('\t'),board=new Chess();
    const moves=pgn.replace(/\d+\.(?:\.\.)?/g,'').trim().split(/\s+/);
    const states=[];
    for(const san of moves){const before=key(board.fen()),move=board.move(san);edges.add(`${before}|${move.from}${move.to}${move.promotion||''}`);states.push(key(board.fen()));}
    paths.push(states);
    const position=key(board.fen()),entry={eco,name,ply:moves.length},previous=named.get(position);
    if(!previous||entry.ply<previous.ply||(entry.ply===previous.ply&&entry.name.length<previous.name.length))named.set(position,entry);
    entries++;
  }
}
const revision=readFileSync(new URL('revision.txt',folder),'utf8').trim();
const bookPositions={};
for(const states of paths){let context=null;for(const position of states){context=named.get(position)||context;const exact=named.get(position);if(exact)bookPositions[position]=exact;else if(!Object.hasOwn(bookPositions,position)||context&&(!bookPositions[position]||context.name.length<bookPositions[position].name.length))bookPositions[position]=context;}}
writeFileSync(new URL('openings.json',folder),JSON.stringify({revision,source:'https://github.com/lichess-org/chess-openings',license:'CC0-1.0',entries,edges:[...edges],positions:Object.fromEntries(named),bookPositions}));
console.log(`Compiled ${entries} openings, ${edges.size} book moves and ${named.size} named positions.`);
