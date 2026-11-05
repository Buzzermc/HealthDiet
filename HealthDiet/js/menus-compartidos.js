/* Menús y compra para la vista compartida de prueba. */
window.hdSharedMenus = (() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const meals = ['desayuno','almuerzo','comida','merienda','cena'];
  let rpc, notify, recipes=[], members=[], menus=[], draft=emptyWeek(), selectedDay=0, cookingDay=0, editingMenuId=null;
  function emptyWeek(){ return days.map(()=>meals.map(()=>[])); }
  function el(tag, content, cls){ const e=document.createElement(tag); if(content!==undefined)e.textContent=content; if(cls)e.className=cls; return e; }
  function makeButton(label, action, cls='secondary'){ const b=el('button',label,cls); b.type='button'; b.onclick=action; return b; }
  function clear(){if($('#shared-menu-dialog').open)$('#shared-menu-dialog').close();recipes=[];members=[];menus=[];draft=emptyWeek();selectedDay=0;cookingDay=0;editingMenuId=null;['#shared-menu-list','#shared-menu-days','#shared-menu-editor','#shared-cooking','#shared-shopping'].forEach(s=>$(s).replaceChildren());}
  async function reload(options){
    rpc=options.rpc; notify=options.notify; recipes=options.recipes; members=options.members;
    const result=await rpc('hd_list_menus');
    if(options.isCurrent && !options.isCurrent()) return;
    menus=result; render();
  }
  function recipeName(id){return recipes.find(r=>r.id===id)?.name||'Receta no disponible';}
  function render(){
    const list=$('#shared-menu-list'); list.replaceChildren();
    if(!menus.length) list.append(el('p','Todavía no hay menús.','muted'));
    for(const menu of menus){
      const card=el('details',undefined,'shared-menu-card');
      const summary=el('summary',undefined,'shared-menu-summary');
      const title=el('span',undefined,'shared-menu-title');
      title.append(el('strong',menu.name));
      if(menu.active)title.append(el('span','Activo','badge'));
      const count=menu.entries.length;
      title.append(el('small',count+' '+(count===1?'receta programada':'recetas programadas'),'muted'));
      const hint=el('span','Ver detalle','shared-menu-toggle');summary.append(title,hint);card.append(summary);card.addEventListener('toggle',()=>{hint.textContent=card.open?'Ocultar detalle':'Ver detalle';});
      const detail=el('div',undefined,'shared-menu-detail');
      for(let i=0;i<days.length;i++){
        const entries=refs(menu,i);if(!entries.length)continue;
        const dayBox=el('section',undefined,'shared-menu-day');dayBox.append(el('h4',days[i]));
        for(const meal of meals){
          const selected=entries.filter(entry=>entry.meal===meal);
          if(!selected.length)continue;
          const line=el('div',undefined,'shared-menu-meal');
          line.append(el('strong',meal[0].toUpperCase()+meal.slice(1)),el('span',selected.map(entry=>recipeName(entry.recipe_id)).join(', ')));
          dayBox.append(line);
        }
        detail.append(dayBox);
      }
      const actions=el('div',undefined,'actions shared-menu-actions');
      actions.append(makeButton('Editar',()=>openMenu(menu,false)),makeButton('Copiar',()=>openMenu(menu,true)));
      if(!menu.active)actions.append(makeButton('Activar menú',async()=>{try{await rpc('hd_activate_menu',{p_menu_id:menu.id});menus=await rpc('hd_list_menus');notify('Menú activado.');render();}catch(e){notify('No se ha podido activar el menú.',true);}}));
      actions.append(makeButton('Eliminar',async()=>{const question=menu.active?'¿Eliminar el menú activo? Dejará de haber un menú activo.':'¿Eliminar este menú?';if(!confirm(question))return;try{await rpc('hd_delete_menu',{p_menu_id:menu.id});menus=await rpc('hd_list_menus');notify('Menú eliminado.');render();}catch(e){notify('No se ha podido eliminar el menú.',true);}},'quiet'));
      detail.append(actions);card.append(detail);list.append(card);
    }
    renderEditor(); renderCooking(); renderShopping();
  }
  function renderEditor(){
    const tabs=$('#shared-menu-days');tabs.replaceChildren();
    days.forEach((day,i)=>{const b=makeButton(day.slice(0,3),()=>{selectedDay=i;renderEditor();});b.setAttribute('aria-label',day);b.setAttribute('aria-pressed',String(i===selectedDay));if(i===selectedDay)b.classList.add('selected');tabs.append(b);});
    const root=$('#shared-menu-editor');root.replaceChildren();root.append(el('h4',days[selectedDay]));
    meals.forEach((meal,i)=>{
      const section=el('section',undefined,'meal-editor');section.append(el('strong',meal[0].toUpperCase()+meal.slice(1)+(i===2||i===4?' · obligatoria':'')));
      const current=draft[selectedDay][i];
      for(const id of current){const row=el('div',undefined,'chosen-item');row.append(el('span',recipeName(id)),makeButton('Quitar',()=>{draft[selectedDay][i]=draft[selectedDay][i].filter(x=>x!==id);renderEditor();},'quiet'));section.append(row);}
      const available=recipes.filter(r=>!current.includes(r.id)); const select=el('select');select.setAttribute('aria-label','Seleccionar receta para '+meal);
      const placeholder=el('option','Selecciona una receta');placeholder.value='';select.append(placeholder);
      for(const recipe of available){const opt=el('option',recipe.name);opt.value=recipe.id;select.append(opt);}
      const add=makeButton('Añadir',()=>{if(select.value){draft[selectedDay][i].push(select.value);renderEditor();}});add.disabled=!available.length;section.append(select,add);root.append(section);
    });
  }
  function closeMenu(){if($('#shared-menu-dialog').open)$('#shared-menu-dialog').close();draft=emptyWeek();selectedDay=0;editingMenuId=null;$('#shared-menu-form').reset();$('#menu-dialog-status').textContent='';}
  function openMenu(menu=null,copy=false){
    closeMenu();notify('');editingMenuId=menu&&!copy?menu.id:null;
    if(menu){
      for(const entry of refs(menu)){const day=entry.day-1,meal=meals.indexOf(entry.meal);if(day>=0&&day<7&&meal>=0)draft[day][meal].push(entry.recipe_id);}
      $('#shared-menu-name').value=copy?(menu.name.slice(0,110)+' (copia)'):menu.name;
    }
    $('#shared-menu-title').textContent=copy?'Copiar menú':menu?'Editar menú':'Nuevo menú';
    $('#shared-menu-submit').textContent=menu&&!copy?'Guardar cambios':'Guardar menú';
    renderEditor();$('#shared-menu-dialog').showModal();$('#shared-menu-name').focus();
  }
  $('#menu-new').onclick=()=>openMenu();
  $('#menu-close').onclick=closeMenu;$('#menu-cancel').onclick=closeMenu;
  $('#shared-menu-dialog').addEventListener('cancel',event=>{event.preventDefault();closeMenu();});
  $('#shared-menu-form').onsubmit=async event=>{
    event.preventDefault();
    if(draft.some(day=>!day[2].length||!day[4].length)){notify('Añade al menos una receta a la comida y la cena de cada día.',true);return;}
    try{const params={p_name:$('#shared-menu-name').value.trim(),p_days:draft};if(editingMenuId)await rpc('hd_update_menu',{...params,p_menu_id:editingMenuId});else await rpc('hd_save_menu',params);closeMenu();menus=await rpc('hd_list_menus');notify('Menú guardado.');render();}catch(e){notify('No se ha podido guardar el menú.',true);}
  };
  function activeMenu(){return menus.find(m=>m.active);}
  function refs(menu,day){return menu.entries.filter(e=>day===undefined||e.day===day+1).sort((a,b)=>a.day-b.day||meals.indexOf(a.meal)-meals.indexOf(b.meal)||a.position-b.position);}
  function amounts(ingredient){
    const active=ingredient.quantities.filter(q=>q.active); const total=active.reduce((s,q)=>s+Number(q.quantity),0);
    return {active,total};
  }
  function amountNode(q){
    const span=el('span',q.name+': '+q.quantity,'person-amount');const p=members.find(m=>m.id===q.member_id);if(p){span.style.backgroundColor=p.color;const c=p.color.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);span.style.color=(c[0]*.2126+c[1]*.7152+c[2]*.0722)>.179?'#111':'#fff';}return span;
  }
  function renderCooking(){
    const root=$('#shared-cooking');root.replaceChildren();const menu=activeMenu();
    if(!menu){root.append(el('p','Activa un menú para ver las recetas.','muted'));return;}
    root.append(el('p',menu.name,'muted'));const bar=el('div',undefined,'day-choices');days.forEach((day,i)=>{const b=makeButton(day.slice(0,3),()=>{cookingDay=i;renderCooking();});b.setAttribute('aria-label',day);b.setAttribute('aria-pressed',String(i===cookingDay));bar.append(b);});root.append(bar,el('h4',days[cookingDay]));
    for(const entry of refs(menu,cookingDay)){
      const recipe=recipes.find(r=>r.id===entry.recipe_id);if(!recipe)continue;
      const card=el('article',undefined,'dish-editor');card.append(el('strong',entry.meal.toUpperCase()+' · '+recipe.name));if(recipe.container)card.append(el('p','Táper: '+recipe.container,'muted'));
      for(const dish of recipe.dishes){card.append(el('h4',dish.name));for(const ingredient of dish.ingredients){const row=el('div',undefined,'ingredient');row.append(el('span',ingredient.name));const vals=el('span');const a=amounts(ingredient);for(const q of a.active)vals.append(amountNode(q),document.createTextNode(' '));vals.append(el('strong','Total: '+a.total+' '+ingredient.unit));row.append(vals);card.append(row);}}
      if(recipe.steps.length){card.append(el('strong','Preparación'));const ol=el('ol');for(const step of recipe.steps)ol.append(el('li',step));card.append(ol);}root.append(card);
    }
  }
  function renderShopping(){
    const root=$('#shared-shopping');root.replaceChildren();const menu=activeMenu();if(!menu){root.append(el('p','Activa un menú para preparar la compra.','muted'));return;}
    const groups=new Map();
    for(const entry of refs(menu)){const recipe=recipes.find(r=>r.id===entry.recipe_id);if(!recipe)continue;for(const dish of recipe.dishes)for(const ingredient of dish.ingredients){
      const key=ingredient.name.trim().toLocaleLowerCase('es')+'|'+ingredient.unit;let group=groups.get(key);if(!group){group={name:ingredient.name,unit:ingredient.unit,people:new Map()};groups.set(key,group);}
      for(const q of ingredient.quantities)if(q.active){const old=group.people.get(q.member_id)||{...q,quantity:0};old.quantity+=Number(q.quantity);group.people.set(q.member_id,old);}
    }}
    if(!groups.size){root.append(el('p','No hay ingredientes en este menú.','muted'));return;}
    root.append(el('p','Marca lo que hay que comprar. Las marcas son temporales.','muted'));
    for(const group of groups.values()){
      const row=el('div',undefined,'shopping-item'),label=el('label',undefined,'shopping-check-label'),check=el('input');check.type='checkbox';label.append(check,el('span',group.name,'shopping-name'));
      const vals=el('div',undefined,'shopping-amounts');let total=0;for(const q of group.people.values()){vals.append(amountNode(q));total+=q.quantity;} vals.append(el('strong','Total: '+total+' '+group.unit));row.append(label,vals);root.append(row);
    }
  }
  return {reload,clear};
})();
