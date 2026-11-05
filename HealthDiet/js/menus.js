(()=>{
'use strict';
const MENU_KEY='healthdiet.menus.v1', RECIPE_KEY='healthdiet.dishes.v1';
const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const meals=['Desayuno','Almuerzo','Comida','Merienda','Cena'];
const $=s=>document.querySelector(s);
const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
let menus=[], recipes=[], current=null, draft=null, selectedDay=0, usable=true, recipesReadable=true;
function readRecipes(){try{let data=JSON.parse(localStorage.getItem(RECIPE_KEY)||'[]');if(!Array.isArray(data))throw Error();recipes=data;recipesReadable=true}catch(e){recipes=[];recipesReadable=false}}
function readMenus(){try{let data=JSON.parse(localStorage.getItem(MENU_KEY)||'[]');if(!Array.isArray(data))throw Error();menus=data;usable=true}catch(e){menus=[];usable=false;$('#menu-status').textContent='No se han podido leer los menús guardados. La edición está desactivada para evitar pérdidas.'}}
function saveMenus(next){try{localStorage.setItem(MENU_KEY,JSON.stringify(next));menus=next;return true}catch(e){$('#menu-status').textContent='No se ha podido guardar el menú en este navegador.';return false}}
function blank(){return days.map(()=>meals.map(()=>[]))}
function nameOf(id){return recipes.find(r=>r.id===id)?.name}
function recipeLabel(r){return r.name+' · '+r.profile}
function missing(menu){return menu.days.some(day=>day.some(slot=>slot.some(id=>!recipes.some(r=>r.id===id))))}
function dayMissing(menu){return menu.days.findIndex(day=>![2,4].every(i=>day[i].length&&day[i].every(id=>recipes.some(r=>r.id===id))))}
function renderMenus(){
 const list=$('#menu-cards');list.replaceChildren();$('#menu-status').textContent=usable?'':$('#menu-status').textContent;$('#newMenu').disabled=!usable;
 if(!menus.length){let box=element('div',undefined,'empty');box.append(element('h3','Crea tu primer menú'),element('p','Organiza las recetas de la semana y elige cuál está activo.','muted'));list.append(box);return}
 menus.forEach(menu=>{let card=element('article',undefined,'menu-card');let top=element('div',undefined,'menu-card-top'),title=element('h3',menu.name);top.append(title);if(menu.active)top.append(element('span','Activo','badge'));card.append(top);
  if(missing(menu))card.append(element('p','Este menú contiene recetas que ya no están disponibles. Edítalo para sustituirlas.','menu-warning'));
  let week=element('div',undefined,'week-overview');days.forEach((day,i)=>{let block=element('section',undefined,'week-day');block.append(element('h4',day));meals.forEach((meal,j)=>{let ids=menu.days[i][j];if(!ids.length)return;let line=element('div',undefined,'week-meal');line.append(element('strong',meal),element('span',ids.map(id=>nameOf(id)||'Receta no disponible').join(', ')));block.append(line)});week.append(block)});card.append(week);
  let actions=element('div',undefined,'actions');let edit=element('button','Editar','secondary');edit.onclick=()=>openMenu(menu);let activate=element('button',menu.active?'Menú activo':'Activar menú',menu.active?'secondary':'primary');activate.disabled=menu.active||!usable;activate.onclick=()=>{readRecipes();if(!recipesReadable||missing(menu)||dayMissing(menu)!==-1){$('#menu-status').textContent='No se puede activar: revisa las recetas y las comidas y cenas del menú.';return}if(saveMenus(menus.map(m=>({...m,active:m.id===menu.id}))))renderMenus()};
  let remove=element('button','Eliminar','quiet');remove.onclick=()=>{if(confirm('¿Eliminar este menú?')){if(saveMenus(menus.filter(m=>m.id!==menu.id)))renderMenus()}};actions.append(edit,activate,remove);card.append(actions);list.append(card)
 });
}
function dayTabs(){let bar=$('#menu-days');bar.replaceChildren();days.forEach((day,i)=>{let b=element('button',day.slice(0,3),'day-choice'+(selectedDay===i?' selected':''));b.type='button';b.setAttribute('aria-label',day);b.setAttribute('aria-pressed',String(selectedDay===i));b.onclick=()=>{selectedDay=i;dayTabs();renderDay()};bar.append(b)})}
function renderDay(){
 let body=$('#day-meals');body.replaceChildren();$('#current-day').textContent=days[selectedDay];
 meals.forEach((meal,i)=>{let slot=draft.days[selectedDay][i], box=element('section',undefined,'meal-editor'),head=element('div',undefined,'meal-heading');head.append(element('strong',meal));if(i===2||i===4)head.append(element('span','Obligatoria','required-tag'));box.append(head);
  const chosen=element('div',undefined,'chosen-list');if(!slot.length)chosen.append(element('span','Sin recetas','muted'));slot.forEach((id,index)=>{let line=element('div',undefined,'chosen-item'),recipe=recipes.find(r=>r.id===id);line.append(element('span',recipe?recipeLabel(recipe):'Receta no disponible'));let remove=element('button','×','remove-choice');remove.type='button';remove.setAttribute('aria-label','Quitar '+(recipe?.name||'receta no disponible'));remove.onclick=()=>{slot.splice(index,1);renderDay()};line.append(remove);chosen.append(line)});box.append(chosen);
  let addrow=element('div',undefined,'add-recipe-row'), select=element('select');select.setAttribute('aria-label','Seleccionar receta para '+meal);let option=element('option','Selecciona una receta');option.value='';select.append(option);recipes.filter(r=>!slot.includes(r.id)).forEach(r=>{let o=element('option',recipeLabel(r));o.value=r.id;select.append(o)});let add=element('button','Añadir','secondary');add.type='button';add.disabled=!recipesReadable||recipes.length===0;add.onclick=()=>{if(select.value){slot.push(select.value);renderDay()}};addrow.append(select,add);box.append(addrow);body.append(box)
 })
}
function openMenu(menu=null){
 if(!usable)return;readRecipes();if(!recipesReadable){$('#menu-status').textContent='No se han podido leer las recetas; no se abrirá el editor para proteger tus datos.';return}
 current=menu?.id||null;draft=menu?JSON.parse(JSON.stringify(menu)):{name:'',days:blank(),active:false};selectedDay=0;$('#menu-name').value=draft.name;$('#menu-editor-title').textContent=menu?'Editar menú':'Nuevo menú';$('#menu-error').textContent='';$('#menu-editor-info').textContent=recipes.length?'Puedes añadir varias recetas a cada comida.':'Aún no tienes recetas. Crea alguna en «Mis recetas» para poder completar el menú.';dayTabs();renderDay();$('#menu-editor').showModal();$('#menu-name').focus()
}
function showTab(id){$('#recipesPage').hidden=id!=='recipes';$('#menusPage').hidden=id!=='menus';$('#cookingPage').hidden=id!=='cooking';$('#settingsPage').hidden=id!=='settings';$('#shoppingPage').hidden=id!=='shopping';document.querySelectorAll('.app-nav button').forEach(b=>{let active=b.dataset.page===id;b.classList.toggle('selected',active);b.setAttribute('aria-current',active?'page':'false')});if(id==='menus'){readRecipes();readMenus();if(!recipesReadable){$('#menu-status').textContent='No se han podido leer las recetas guardadas.';return}renderMenus()}if(id==='cooking')window.renderCooking();if(id==='settings')window.hdSettings.render();if(id==='shopping')window.renderShopping()}
document.querySelectorAll('.app-nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.page));$('#newMenu').onclick=()=>openMenu();$('#menu-close').onclick=$('#menu-cancel').onclick=()=>$('#menu-editor').close();
$('#menu-form').onsubmit=e=>{e.preventDefault();let name=$('#menu-name').value.trim();if(!name){$('#menu-error').textContent='Escribe un nombre para el menú.';return}let first=dayMissing(draft);if(first!==-1){selectedDay=first;dayTabs();renderDay();$('#menu-error').textContent='Completa comida y cena con recetas disponibles en todos los días. Revisa '+days[first]+'.';return}if(missing(draft)){$('#menu-error').textContent='Sustituye las recetas que ya no están disponibles.';return}let menu={id:current||newRecordId(),name,days:draft.days,active:!!draft.active},next=current?menus.map(m=>m.id===current?menu:m):[...menus,menu];if(saveMenus(next)){$('#menu-editor').close();renderMenus()}};
readRecipes();readMenus();window.healthDietShowTab=showTab;
})();
