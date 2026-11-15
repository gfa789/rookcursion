import React from 'react';

const silhouettes={
  p: 'M23 25a7 7 0 1 1 10 0c1 3 2 5 5 7h-4c1 5 3 9 7 13H15c4-4 6-8 7-13h-4c3-2 4-4 5-7Z',
  r: 'M13 12h7v6h5v-6h6v6h5v-6h7v12l-6 6 1 10 4 5H14l4-5 1-10-6-6z',
  n: 'M15 45c1-10 6-18 15-24-4 0-7 2-9 5l-7 1-3-4 11-12 1-6 7 5c12 0 18 10 18 23v12z',
  b: 'M28 8c-9 6-13 12-13 19 0 5 3 9 9 11l-6 7h20l-6-7c6-2 9-6 9-11 0-4-2-8-5-12l-7 6-3-3 7-6z',
  q: 'M13 17l8 13 3-17 4 14 4-14 3 17 8-13-4 21 4 7H13l4-7z',
  k: 'M21 35c-8-4-12-10-10-15 2-6 10-7 17-1 7-6 15-5 17 1 2 5-2 11-10 15l4 10H17z',
};
const engraving={
  p:'M22 33h12',
  r:'M19 25h18m-18 5h18m-19 10h20',
  n:'M30 16h.1m-8 23c4-9 10-13 15-16',
  b:'M17 31c7 3 15 3 22 0m-7-13-7 8',
  q:'M17 38h22',
  k:'M28 19v14m-7 3c5-2 9-2 14 0',
};

export default function ChessPiece({type,color}){
  return (
    <svg className="piece chess-piece" data-piece-color={color} viewBox="0 0 56 56" aria-hidden="true">
      <g className="piece-body" strokeWidth="1.65" strokeLinejoin="round" strokeLinecap="round">
        <path d={silhouettes[type]}/>
        {type==='b'&&<circle cx="28" cy="7" r="3"/>}
        {type==='q'&&[12,23,33,44].map((x,i)=><circle key={x} cx={x} cy={i===0||i===3?15:11} r="2.4"/>)}
        {type==='k'&&<path d="M26 5h4v4h5v4h-5v7h-4v-7h-5V9h5z"/>}
        <path d="M14 44h28l4 5v3H10v-3z"/>
        <path className="piece-engraving" d={engraving[type]} fill="none"/>
        <path className="piece-engraving" d="M15 48h26" fill="none"/>
      </g>
    </svg>
  );
}
