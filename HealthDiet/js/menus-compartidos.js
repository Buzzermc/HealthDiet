/* Menús y compra para la vista compartida de prueba. */
window.hdSharedMenus = (() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const meals = ['desayuno','almuerzo','comida','merienda','cena'];
  const todayIndex = () => (new Date().getDay() + 6) % 7;
  let rpc, notify, recipes=[], members=[], menus=[], checked=new Set(), draft=emptyWeek(), selectedDay=0, selectedMeal='', cookingDay=todayIndex(), editingMenuId=null;
  function emptyWeek(){ return days.map(()=>meals.map(()=>[])); }
  function el(tag, content, cls){ const e=document.createElement(tag); if(content!==undefined)e.textContent=content; if(cls)e.className=cls; return e; }
  function makeButton(label, action, cls='secondary'){ const b=el('button',label,cls); b.type='button'; b.onclick=action; return b; }
  function clear(){if($('#shared-menu-dialog').open)$('#shared-menu-dialog').close();recipes=[];members=[];menus=[];checked.clear();draft=emptyWeek();selectedDay=0;cookingDay=todayIndex();editingMenuId=null;['#shared-menu-list','#shared-menu-days','#shared-menu-editor','#shared-cooking','#shared-shopping'].forEach(s=>$(s).replaceChildren());}
  async function withConfirmation(name,params){
    try{await rpc(name,{...params,p_confirm:false});return true;}
    catch(error){
      if(!String(error.message||error).includes('SHOPPING_CONFIRM_REQUIRED'))throw error;
      if(!(await window.hdDialog.confirm('Al cambiar el menú o una de sus recetas se desmarcarán todos los ingredientes de la lista de la compra. ¿Quieres continuar?',{heading:'Actualizar la compra',acceptLabel:'Continuar'})))return false;
      await rpc(name,{...params,p_confirm:true});return true;
    }
  }
  async function readShopping(){const state=await rpc('hd_shopping_read');checked=new Set(state.checked);return state;}
  async function reload(options){
    rpc=options.rpc; notify=options.notify; recipes=options.recipes; members=options.members;
    const result=await rpc('hd_list_menus'); await readShopping();
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
      if(!menu.active)actions.append(makeButton('Activar menú',async()=>{try{if(!await withConfirmation('hd_shopping_activate',{p_menu_id:menu.id}))return;menus=await rpc('hd_list_menus');await readShopping();notify('Menú activado.');render();}catch(e){notify('No se ha podido activar el menú.',true);}}));
      actions.append(makeButton('Eliminar',async()=>{const question=menu.active?'¿Eliminar el menú activo? Dejará de haber un menú activo y se desmarcará la lista de la compra.':'¿Eliminar este menú?';if(!(await window.hdDialog.confirm(question,{heading:'Eliminar menú',acceptLabel:'Eliminar',danger:true})))return;try{await rpc('hd_delete_menu',{p_menu_id:menu.id});menus=await rpc('hd_list_menus');await readShopping();notify('Menú eliminado.');render();}catch(e){notify('No se ha podido eliminar el menú.',true);}},'quiet'));
      detail.append(actions);card.append(detail);list.append(card);
    }
    renderEditor(); renderCooking(); renderShopping();
  }
  function renderEditor(){
    const tabs=$('#shared-menu-days');tabs.replaceChildren();
    days.forEach((day,i)=>{const b=makeButton(day.slice(0,3),()=>{selectedDay=i;renderEditor();});b.setAttribute('aria-label',day);b.setAttribute('aria-pressed',String(i===selectedDay));if(i===selectedDay)b.classList.add('selected');tabs.append(b);});
    const root=$('#shared-menu-editor');root.replaceChildren();
    const label=el('label','Comida del día');label.htmlFor='menu-meal-select';
    const selectMeal=el('select');selectMeal.id='menu-meal-select';
    const placeholder=el('option','Selecciona una comida');placeholder.value='';selectMeal.append(placeholder);
    meals.forEach((meal,i)=>{const option=el('option',meal[0].toUpperCase()+meal.slice(1));option.value=String(i);selectMeal.append(option);});
    selectMeal.value=selectedMeal;selectMeal.onchange=()=>{selectedMeal=selectMeal.value;renderEditor();};root.append(label,selectMeal);
    if(selectedMeal!==''){
      const i=Number(selectedMeal), current=draft[selectedDay][i], available=recipes.filter(r=>!current.includes(r.id));
      const recipeLabel=el('label','Receta');recipeLabel.htmlFor='menu-recipe-select';
      const select=el('select');select.id='menu-recipe-select';
      const prompt=el('option','Selecciona una receta');prompt.value='';select.append(prompt);
      for(const recipe of available){const option=el('option',recipe.name);option.value=recipe.id;select.append(option);}
      const add=makeButton('Añadir receta',()=>{if(select.value){draft[selectedDay][i].push(select.value);renderEditor();}});add.classList.add('menu-add-recipe');add.disabled=!available.length;
      root.append(recipeLabel,select,add);
    }
    const configured=draft[selectedDay];
    if(configured.some(items=>items.length)){
      const list=el('div',undefined,'menu-configured');list.append(el('strong','Recetas añadidas'));
      configured.forEach((items,i)=>{if(!items.length)return;const group=el('div',undefined,'menu-configured-meal');group.append(el('strong',meals[i][0].toUpperCase()+meals[i].slice(1)));for(const id of items){const row=el('div',undefined,'chosen-item');row.append(el('span',recipeName(id)),makeButton('Quitar',()=>{draft[selectedDay][i]=draft[selectedDay][i].filter(x=>x!==id);renderEditor();},'quiet'));group.append(row);}list.append(group);});root.append(list);
    }
  }
  function closeMenu(){if($('#shared-menu-dialog').open)$('#shared-menu-dialog').close();draft=emptyWeek();selectedDay=0;selectedMeal='';editingMenuId=null;$('#shared-menu-form').reset();$('#menu-dialog-status').textContent='';}
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
    try{const params={p_name:$('#shared-menu-name').value.trim(),p_days:draft};if(editingMenuId){if(!await withConfirmation('hd_shopping_update_menu',{...params,p_menu_id:editingMenuId}))return;}else await rpc('hd_save_menu',params);closeMenu();menus=await rpc('hd_list_menus');await readShopping();notify('Menú guardado.');render();}catch(e){notify('No se ha podido guardar el menú.',true);}
  };
  function activeMenu(){return menus.find(m=>m.active);}
  function refs(menu,day){return menu.entries.filter(e=>day===undefined||e.day===day+1).sort((a,b)=>a.day-b.day||meals.indexOf(a.meal)-meals.indexOf(b.meal)||a.position-b.position);}
  const {amounts, amountNode}=window.hdCreateAmounts(el,()=>members);
  const renderCooking=window.hdCreateCooking({$,el,makeButton,days,activeMenu,refs,amounts,amountNode,getState:()=>({recipes,cookingDay}),setDay:value=>{cookingDay=value;}});
  const renderShopping=window.hdCreateShopping({$,el,activeMenu,refs,amountNode,getState:()=>({recipes,checked,rpc,notify})});
  return {reload,clear,withConfirmation};
})();

