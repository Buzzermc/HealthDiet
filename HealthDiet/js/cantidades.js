/* Formato y sumas de cantidades compartidas. */
window.hdCreateAmounts = (el, getMembers) => {
  'use strict';
  function amounts(ingredient){
    const active=ingredient.quantities.filter(q=>q.active); const total=active.reduce((s,q)=>s+Number(q.quantity),0);
    return {active,total};
  }
  function amountNode(q){
    const span=el('span',q.name+': '+q.quantity,'person-amount');const p=getMembers().find(m=>m.id===q.member_id);if(p){span.style.backgroundColor=p.color;const c=p.color.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);span.style.color=(c[0]*.2126+c[1]*.7152+c[2]*.0722)>.179?'#111':'#fff';}return span;
  }
  return {amounts, amountNode};
};
