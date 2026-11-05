(()=>{
'use strict';
const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
let selectedDay=(new Date().getDay()+6)%7;
const $=s=>document.querySelector(s);
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function quantities(recipe,ingredient){
 if(ingredient.quantities && typeof ingredient.quantities==='object') return {Alba:recipe.profile!=='Pablo'?ingredient.quantities.Alba??null:null,Pablo:recipe.profile!=='Alba'?ingredient.quantities.Pablo??null:null};
 return {Alba:recipe.profile==='Alba'?ingredient.quantity??null:null,Pablo:recipe.profile==='Pablo'?ingredient.quantity??null:null};
}
function displayNumber(number){return new Intl.NumberFormat('es-ES',{maximumFractionDigits:6}).format(number)}
function displayQuantity(value,unit){return displayNumber(value)+' '+(unit==='unidad'?'ud.':unit)}
function recipeCard(recipe){
 let article=node('article',undefined,'cook-recipe'),heading=node('div',undefined,'cook-recipe-header');
 let profiles=node('div',undefined,'cook-profiles');(recipe.profile==='Ambos'?['Alba','Pablo']:[recipe.profile]).forEach(p=>profiles.append(window.hdSettings.chip(p,p)));heading.append(node('h4',recipe.name),profiles);
 article.append(heading);if(recipe.tupper)article.append(node('p','Táper '+recipe.tupper,'cook-tupper'));
 let ds=Array.isArray(recipe.dishes)?recipe.dishes:[{name:recipe.name,ingredients:recipe.ingredients||[]}];
 ds.forEach(d=>{let section=node('section',undefined,'cook-dish');section.append(node('h5',d.name));(d.ingredients||[]).forEach(ingredient=>{
  let row=node('div',undefined,'cook-ingredient'), label=node('span',ingredient.name), amounts=node('div',undefined,'cook-amounts'), q=quantities(recipe,ingredient);
  let persons=['Alba','Pablo'].filter(p=>q[p]!==null&&Number.isFinite(Number(q[p]))&&Number(q[p])>0);
  if(persons.length){let total=persons.reduce((sum,p)=>sum+Number(q[p]),0);amounts.append(node('strong','Total: '+displayQuantity(total,ingredient.unit)));let parts=node('div',undefined,'person-parts');persons.forEach(p=>{let qty=displayQuantity(Number(q[p]),ingredient.unit),chip=window.hdSettings.chip(p,qty);chip.setAttribute('aria-label',p+': '+qty);chip.title=p+': '+qty;parts.append(chip)});amounts.append(parts)}
  else amounts.append(node('small','Cantidad no disponible'));
  row.append(label,amounts);section.append(row)
 });article.append(section)});
 if(Array.isArray(recipe.steps)&&recipe.steps.length){article.append(node('div','Preparación','cook-prep-title'));let ol=node('ol',undefined,'prep-list');recipe.steps.forEach(step=>ol.append(node('li',step)));article.append(ol)}
 return article;
}
function render(){
 let content=$('#cook-content'), daybar=$('#cook-days'), subtitle=$('#cook-subtitle');content.replaceChildren();daybar.replaceChildren();
 let menus,recipes;try{menus=JSON.parse(localStorage.getItem('healthdiet.menus.v1')||'[]');recipes=JSON.parse(localStorage.getItem('healthdiet.dishes.v1')||'[]');if(!Array.isArray(menus)||!Array.isArray(recipes))throw Error()}catch(e){subtitle.textContent='No se pueden leer los datos guardados.';content.append(node('p','Comprueba el almacenamiento del navegador.','muted'));return}
 let active=menus.find(m=>m.active);
 if(!active){subtitle.textContent='Activa un menú semanal para empezar.';let empty=node('div',undefined,'empty');empty.append(node('h3','Todavía no hay un menú activo'),node('p','Ve a «Menús», crea uno y pulsa «Activar menú».','muted'));content.append(empty);return}
 subtitle.textContent='Menú activo: '+active.name;
 DAYS.forEach((day,i)=>{let button=node('button',day.slice(0,3),'day-choice'+(selectedDay===i?' selected':''));button.type='button';button.setAttribute('aria-label',day);button.setAttribute('aria-pressed',String(selectedDay===i));button.onclick=()=>{selectedDay=i;render()};daybar.append(button)});
 content.append(node('p',DAYS[selectedDay]+' · Comida y cena','cook-day-title'));
 for(const [meal,index] of [['Comida',2],['Cena',4]]){
  let details=node('details',undefined,'cook-meal');details.open=true;let summary=node('summary');summary.append(node('span',meal));details.append(summary);
  let ids=Array.isArray(active.days?.[selectedDay]?.[index])?active.days[selectedDay][index]:[];
  if(!ids.length)details.append(node('p','No hay recetas asignadas.','muted cook-message'));
  ids.forEach(id=>{const r=recipes.find(x=>x.id===id);if(r)details.append(recipeCard(r));else details.append(node('p','Esta receta ya no está disponible. Revisa el menú activo.','cook-warning'))});
  content.append(details)
 }
}
window.renderCooking=render;
})();
