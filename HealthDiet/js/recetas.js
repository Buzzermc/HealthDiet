(()=>{
'use strict';
const KEY='healthdiet.dishes.v1', $=s=>document.querySelector(s), cards=$('#cards'), dialog=$('#editor'), dishes=$('#dishes'), steps=$('#steps');
let recipes=[], usable=true, current=null, filter='Todos';
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function normalize(r){
  let ds=Array.isArray(r.dishes)?r.dishes:[{name:r.name,ingredients:Array.isArray(r.ingredients)?r.ingredients:[]}];
  return {...r,steps:Array.isArray(r.steps)?r.steps:[],dishes:ds.map(d=>({...d,ingredients:(d.ingredients||[]).map(i=>({...i,quantities:i.quantities||{Pablo:r.profile==='Pablo'?i.quantity:null,Alba:r.profile==='Alba'?i.quantity:null}}))}))};
}
try{const raw=localStorage.getItem(KEY), data=raw?JSON.parse(raw):[];if(!Array.isArray(data))throw Error();recipes=data.map(normalize)}catch(e){usable=false;document.querySelector('.notice').textContent='No se han podido leer los datos guardados. La edición está desactivada para evitar pérdidas.'}
function save(){try{localStorage.setItem(KEY,JSON.stringify(recipes));return true}catch(e){$('#error').textContent='No se ha podido guardar en este navegador. Comprueba su almacenamiento.';return false}}
function refreshProfiles(){let profile=$('#profile').value;dishes.querySelectorAll('.ingredient-editor').forEach(row=>{for(const person of ['Pablo','Alba']){const wrap=row.querySelector('.quantity-'+person);wrap.hidden=profile!=='Ambos'&&profile!==person;wrap.querySelector('input').required=profile===person} });}
function ingredientRow(container,data={}){
 const row=el('div',undefined,'ingredient-editor'),name=el('input');name.placeholder='Ingrediente';name.value=data.name||'';name.required=true;name.maxLength=120;name.setAttribute('aria-label','Nombre del ingrediente');row.append(name);
 for(const person of ['Pablo','Alba']){const wrap=el('label',undefined,'quantity-field quantity-'+person), title=el('span',person),input=el('input');input.type='number';input.min='0.001';input.step='any';input.placeholder='Cantidad';input.value=data.quantities?.[person]??'';input.setAttribute('aria-label','Cantidad para '+person);wrap.append(title,input);row.append(wrap)}
 const unit=el('select');unit.className='ingredient-unit';unit.setAttribute('aria-label','Unidad');for(const [v,t] of [['g','g'],['unidad','unidad(es)']]){let o=el('option',t);o.value=v;unit.append(o)}unit.value=data.unit||'g';
 const del=el('button','×','remove');del.type='button';del.setAttribute('aria-label','Eliminar ingrediente');del.onclick=()=>{if(container.children.length>1)row.remove();else{row.querySelectorAll('input').forEach(input=>input.value='')}};row.append(unit,del);container.append(row);refreshProfiles();
}
function refreshDishes(){[...dishes.children].forEach((d,i)=>{d.querySelector('.dish-number').textContent='Plato '+(i+1);d.querySelector('.delete-dish').hidden=dishes.children.length===1})}
function addDish(data={}){const box=el('section',undefined,'dish-editor'),top=el('div',undefined,'dish-title-row'),title=el('strong','','dish-number'),remove=el('button','Eliminar plato','quiet delete-dish');remove.type='button';remove.onclick=()=>{if(dishes.children.length>1){box.remove();refreshDishes()}};top.append(title,remove);const label=el('label','Nombre del plato'),name=el('input');name.className='dish-name-input';name.placeholder='Ej. Arroz con tomate';name.required=true;name.maxLength=120;name.value=data.name||'';name.setAttribute('aria-label','Nombre del plato');const head=el('div',undefined,'ing-head');head.append(el('span','Ingredientes','label'));const add=el('button','＋ Ingrediente','secondary'),ing=el('div',undefined,'ingredient-list');add.type='button';add.onclick=()=>ingredientRow(ing);head.append(add);box.append(top,label,name,head,ing);dishes.append(box);(data.ingredients?.length?data.ingredients:[{}]).forEach(i=>ingredientRow(ing,i));refreshDishes()}
function refreshSteps(){[...steps.children].forEach((x,i)=>x.querySelector('.step-num').textContent=i+1)}
function addStep(value=''){let row=el('div',undefined,'step-row'),num=el('span','','step-num'),input=el('textarea');input.placeholder='Describe este paso';input.value=value;input.maxLength=2000;input.setAttribute('aria-label','Instrucción de preparación');let del=el('button','×','remove');del.type='button';del.setAttribute('aria-label','Eliminar paso');del.onclick=()=>{row.remove();refreshSteps()};row.append(num,input,del);steps.append(row);refreshSteps()}
function open(recipe=null,copy=false){
 if(!usable)return;current=recipe&&!copy?recipe.id:null;$('#formTitle').textContent=copy?'Copiar receta':recipe?'Editar receta':'Nueva receta';$('#name').value=recipe?.name||'';window.hdSettings.refreshTuppers(recipe?.tupper||'');
 let profile=recipe?(copy&&recipe.profile!=='Ambos'?(recipe.profile==='Pablo'?'Alba':'Pablo'):recipe.profile):(filter==='Todos'?'Pablo':filter);$('#profile').value=profile;
 dishes.replaceChildren();steps.replaceChildren();
 let list=recipe?.dishes||[{}];if(copy&&recipe.profile!=='Ambos')list=list.map(d=>({...d,ingredients:d.ingredients.map(i=>({...i,quantities:{...i.quantities,[profile]:i.quantities[profile]??i.quantities[recipe.profile]}}))}));
 list.forEach(addDish);(recipe?.steps||[]).forEach(addStep);$('#error').textContent='';dialog.showModal();$('#name').focus()
}
function formatQty(q,u){return q==null?'No lleva':String(q).replace('.',',')+' '+(u==='unidad'?'ud.':u)}
function render(){
 cards.replaceChildren();const list=recipes.filter(r=>filter==='Todos'||r.profile===filter||r.profile==='Ambos');$('#count').textContent=`${list.length} ${list.length===1?'receta':'recetas'}`;
 if(!list.length){let box=el('div',undefined,'empty');box.append(el('h3','Tu recetario empieza aquí'),el('p','Añade una receta y organiza sus platos e ingredientes.','muted'));cards.append(box);return}
 for(const r of list){const card=el('article',undefined,'card');card.append(el('span',r.profile,'badge '+(r.profile==='Alba'?'alba':'')),el('h3',r.name),el('p',r.tupper?'Táper '+r.tupper:'Táper sin especificar','tupper-label'));
  for(const d of r.dishes){card.append(el('div',d.name,'dish-subtitle'));for(const ing of d.ingredients){const row=el('div',undefined,'ingredient');let people=r.profile==='Ambos'?(filter==='Todos'?['Pablo','Alba']:[filter]):[r.profile];let visible=people.map(p=>(r.profile==='Ambos'&&filter==='Todos'?p+': ':'')+formatQty(ing.quantities[p],ing.unit)).join(' · ');row.append(el('span',ing.name),el('span',visible,'qty'));card.append(row)}}
  if(r.steps.length){card.append(el('div','Preparación','dish-subtitle'));const ol=el('ol',undefined,'prep-list');r.steps.forEach(step=>ol.append(el('li',step)));card.append(ol)}
  const actions=el('div',undefined,'actions'),options=[['Editar',()=>open(r)], [r.profile==='Ambos'?'Copiar receta':'Copiar para '+(r.profile==='Pablo'?'Alba':'Pablo'),()=>open(r,true)],['Eliminar',()=>{if(confirm('¿Eliminar esta receta?')){let previous=recipes;recipes=recipes.filter(x=>x.id!==r.id);if(!save())recipes=previous;render()}}]];
  for(const [label,fn] of options){const b=el('button',label,label==='Eliminar'?'quiet':'secondary');b.onclick=fn;b.disabled=!usable;actions.append(b)}card.append(actions);cards.append(card)
 }
}
$('#add').onclick=()=>open();$('#addDish').onclick=()=>addDish();$('#addStep').onclick=()=>addStep();$('#profile').onchange=refreshProfiles;$('#close').onclick=$('#cancel').onclick=()=>dialog.close();
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render()});
$('#form').onsubmit=e=>{
 e.preventDefault();let name=$('#name').value.trim(),profile=$('#profile').value,ds=[...dishes.children].map(box=>({name:box.querySelector('.dish-name-input').value.trim(),ingredients:[...box.querySelectorAll('.ingredient-editor')].map(row=>{let quantities={};for(const p of ['Pablo','Alba']){let v=row.querySelector('.quantity-'+p+' input').value;quantities[p]=v===''?null:Number(v)}return {name:row.querySelector('input').value.trim(),quantities,unit:row.querySelector('.ingredient-unit').value}})})),preparation=[...steps.querySelectorAll('textarea')].map(x=>x.value.trim()).filter(Boolean);
 let invalid=ds.some(d=>!d.name||!d.ingredients.length||d.ingredients.some(i=>{let q=i.quantities,active=profile==='Ambos'?[q.Pablo,q.Alba]:[q[profile]];return !i.name||active.every(x=>x===null)||active.some(x=>x!==null&&(!Number.isFinite(x)||x<=0))}));
 if(!name||!ds.length||invalid){$('#error').textContent='Completa cada plato e ingrediente e indica al menos una cantidad mayor que cero por ingrediente.';return}
 let recipe={id:current||newRecordId(),name,profile,tupper:$('#tupper').value,dishes:ds,steps:preparation},previous=recipes;recipes=current?recipes.map(r=>r.id===current?recipe:r):[...recipes,recipe];if(save()){dialog.close();filter=profile==='Ambos'?'Todos':profile;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x.dataset.filter===filter));render()}else recipes=previous
};render()
})();
