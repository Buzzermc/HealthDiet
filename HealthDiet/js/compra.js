(()=>{
'use strict';
const RECIPE_KEY='healthdiet.dishes.v1', MENU_KEY='healthdiet.menus.v1';
const checked=new Map();
let currentMenuId=null;
const $=s=>document.querySelector(s);
function el(tag,text,cls){let e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function amountText(value,unit){let formatted=new Intl.NumberFormat('es-ES',{maximumFractionDigits:6}).format(value);return formatted+' '+(unit==='unidad'?'ud.':unit)}
function getQuantities(recipe,ingredient){
 if(ingredient.quantities&&typeof ingredient.quantities==='object')return {Alba:recipe.profile!=='Pablo'?ingredient.quantities.Alba??null:null,Pablo:recipe.profile!=='Alba'?ingredient.quantities.Pablo??null:null};
 return {Alba:recipe.profile==='Alba'?ingredient.quantity??null:null,Pablo:recipe.profile==='Pablo'?ingredient.quantity??null:null}
}
function accumulate(menu,recipes){
 const items=new Map();let missing=0;
 for(const day of menu.days||[])for(const meal of day||[])for(const id of meal||[]){
  const recipe=recipes.find(r=>r.id===id);if(!recipe){missing++;continue}
  const dishes=Array.isArray(recipe.dishes)?recipe.dishes:[{ingredients:recipe.ingredients||[]}];
  for(const dish of dishes)for(const ing of dish.ingredients||[]){
   const name=String(ing.name||'').trim().replace(/\s+/g,' '),unit=String(ing.unit||'');if(!name)continue;
   const key=JSON.stringify([name.toLocaleLowerCase('es'),unit]);const q=getQuantities(recipe,ing);
   if(!items.has(key))items.set(key,{key,name,unit,Alba:0,Pablo:0});
   const row=items.get(key);for(const p of ['Alba','Pablo'])if(q[p]!=null&&Number.isFinite(Number(q[p]))&&Number(q[p])>0)row[p]+=Number(q[p]);
  }
 }
 return {items:[...items.values()].filter(x=>x.Alba>0||x.Pablo>0).sort((a,b)=>a.name.localeCompare(b.name,'es')||a.unit.localeCompare(b.unit,'es')),missing};
}
function render(){
 const list=$('#shopping-list'),subtitle=$('#shopping-subtitle'),message=$('#shopping-message'),legend=$('#shopping-legend');list.replaceChildren();legend.replaceChildren();message.textContent='';
 let menus,recipes;try{menus=JSON.parse(localStorage.getItem(MENU_KEY)||'[]');recipes=JSON.parse(localStorage.getItem(RECIPE_KEY)||'[]');if(!Array.isArray(menus)||!Array.isArray(recipes))throw Error()}catch(e){subtitle.textContent='No se han podido leer los datos guardados.';return}
 const menu=menus.find(m=>m.active);if(!menu){currentMenuId=null;checked.clear();subtitle.textContent='Activa un menú semanal para preparar la lista.';let box=el('div',undefined,'empty');box.append(el('h3','Todavía no hay un menú activo'),el('p','Ve a «Menús» y activa uno para calcular los ingredientes.','muted'));list.append(box);return}
 if(currentMenuId!==menu.id){checked.clear();currentMenuId=menu.id}
 subtitle.textContent='Menú activo: '+menu.name;
 legend.append(window.hdSettings.chip('Alba','Alba'),window.hdSettings.chip('Pablo','Pablo'));
 const {items,missing}=accumulate(menu,recipes);
 if(missing)message.textContent='Faltan '+missing+' asignaciones de recetas que ya no están disponibles. La lista está incompleta; revisa el menú.';
 if(!items.length){let box=el('div',undefined,'empty');box.append(el('h3','Sin ingredientes para mostrar'),el('p','Añade recetas al menú activo para preparar la lista.','muted'));list.append(box);return}
 for(const item of items){
  const row=el('div',undefined,'shopping-item'),label=el('label',undefined,'shopping-check-label'),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=checked.get(item.key)===true;checkbox.setAttribute('aria-label','Marcar '+item.name+' ('+item.unit+') para comprar');
  checkbox.onchange=()=>{checked.set(item.key,checkbox.checked);row.classList.toggle('marked',checkbox.checked)};
  let name=el('span',item.name,'shopping-name');label.append(checkbox,name);let amounts=el('div',undefined,'shopping-amounts'),breakdown=el('div',undefined,'person-parts');
  amounts.append(el('strong','Total: '+amountText(item.Alba+item.Pablo,item.unit)));for(const p of ['Alba','Pablo'])if(item[p]>0){let chip=window.hdSettings.chip(p,amountText(item[p],item.unit));chip.title=p+': '+amountText(item[p],item.unit);chip.setAttribute('aria-label',p+': '+amountText(item[p],item.unit));breakdown.append(chip)}
  amounts.append(breakdown);row.classList.toggle('marked',checkbox.checked);row.append(label,amounts);list.append(row)
 }
}
window.renderShopping=render;
})();
