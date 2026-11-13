/* Gestión de recetas y su formulario. */
window.hdCreateRecipes = ({state, $, rpc, text, status, report}) => {
  const input = (placeholder, type = 'text') => { const e = document.createElement('input'); e.type = type; e.placeholder = placeholder; return e; };
  function reorderHandle(item, kind) {
    const handle=document.createElement('button');handle.type='button';handle.className='reorder-handle';
    handle.setAttribute('aria-label','Mover '+kind+'. Usa las flechas arriba y abajo o arrastra.');
    handle.title='Arrastrar para ordenar';handle.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>';
    let dragging=false, pointer=null, ghost=null, originNext=null, parent=null, lastX=0, lastY=0, offsetX=0, offsetY=0, scrollFrame=0;
    const announce=()=>{const position=[...item.parentElement.children].indexOf(item)+1;$('#reorder-status').textContent=kind.charAt(0).toUpperCase()+kind.slice(1)+' en la posición '+position+'.';};
    const animateMove=move=>{
      const siblings=[...parent.children], before=new Map(siblings.map(el=>[el,el.getBoundingClientRect().top]));
      move();
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      for(const el of siblings){if(el===item)continue;const delta=before.get(el)-el.getBoundingClientRect().top;if(delta)el.animate([{transform:'translateY('+delta+'px)'},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});}
    };
    handle.addEventListener('keydown',event=>{
      if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
      const sibling=event.key==='ArrowUp'?item.previousElementSibling:item.nextElementSibling;
      if(!sibling)return;event.preventDefault();
      if(event.key==='ArrowUp')item.parentElement.insertBefore(item,sibling);else item.parentElement.insertBefore(sibling,item);
      handle.focus();announce();
    });
    const update=()=>{
      if(!dragging)return;
      ghost.style.left=(lastX-offsetX)+'px';ghost.style.top=(lastY-offsetY)+'px';
      const under=document.elementFromPoint(lastX,lastY);
      const target=under?.closest(kind==='plato'?'.shared-dish':'.shared-ingredient');
      if(!target||target===item||target.parentElement!==parent)return;
      const rect=target.getBoundingClientRect(), siblings=[...item.parentElement.children];
      const from=siblings.indexOf(item), to=siblings.indexOf(target), midpoint=rect.top+rect.height/2;
      if(to<from && lastY<midpoint)animateMove(()=>parent.insertBefore(item,target));
      else if(to>from && lastY>midpoint)animateMove(()=>parent.insertBefore(item,target.nextSibling));
    };
    const scroll=()=>{
      if(!dragging)return;
      const area=$('#recipe-dialog .modal-body'), rect=area.getBoundingClientRect(), edge=45;
      const speed=lastY<rect.top+edge?-12:lastY>rect.bottom-edge?12:0;
      if(speed){area.scrollTop+=speed;update();}
      scrollFrame=requestAnimationFrame(scroll);
    };
    const move=event=>{if(!dragging||event.pointerId!==pointer)return;lastX=event.clientX;lastY=event.clientY;update();event.preventDefault();};
    const finish=event=>{
      if(!dragging||(event.pointerId!==undefined&&event.pointerId!==pointer))return;
      if(event.type==='pointercancel'&&originNext!==item)parent.insertBefore(item,originNext?.parentElement===parent?originNext:null);
      dragging=false;pointer=null;cancelAnimationFrame(scrollFrame);item.classList.remove('reordering');ghost.remove();ghost=null;
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);announce();
    };
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||dragging)return;
      const rect=item.getBoundingClientRect(); parent=item.parentElement;originNext=item.nextElementSibling;pointer=event.pointerId;dragging=true;
      lastX=event.clientX;lastY=event.clientY;offsetX=lastX-rect.left;offsetY=lastY-rect.top;
      ghost=document.createElement('div');ghost.className='drag-preview-context';ghost.setAttribute('aria-hidden','true');ghost.inert=true;
      const copy=item.cloneNode(true);copy.querySelectorAll('input,select,textarea').forEach((el,i)=>{const src=item.querySelectorAll('input,select,textarea')[i];if(src)el.value=src.value;});
      ghost.append(copy);ghost.style.width=rect.width+'px';$('#recipe-dialog').append(ghost);
      item.classList.add('reordering');$('#recipe-dialog').setPointerCapture(pointer);
      document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
      update();scrollFrame=requestAnimationFrame(scroll);event.preventDefault();
    });
    return handle;
  }
  function addIngredient(box, data = {}) {
    const row = document.createElement('div'); row.className = 'shared-ingredient'; row.dataset.ingredientId=data.id||'';
    row.append(reorderHandle(row,'ingrediente'));
    const name = input('Ingrediente'); name.className = 'shared-ingredient-name'; name.required = true; name.maxLength = 120; name.value=data.name||''; row.append(name);
    const unit = document.createElement('select'); unit.className = 'shared-unit'; unit.setAttribute('aria-label', 'Unidad');
    for (const [value, label] of [['g','g'],['unidad','uds.']]) { const o = text('option', label); o.value = value; unit.append(o); } unit.value=data.unit||'g'; row.append(unit);
    const quantities=document.createElement('div');quantities.className='shared-quantities';
    quantities.append(text('span','Cantidad','shared-quantities-title'));
    for (const person of state.workspace.members) {
      const label = document.createElement('label'); label.className = 'shared-person'; label.dataset.member = person.id;
      const qty = input('Cantidad', 'number'); qty.min = '0.001'; qty.step = 'any'; qty.setAttribute('aria-label','Cantidad para '+person.name); qty.style.borderColor=person.color || '#2d7a5a'; const previous=(data.quantities||[]).find(q=>q.member_id===person.id); if(previous)qty.value=previous.quantity; label.append(qty); quantities.append(label);
    }
    row.append(quantities);
    const remove = document.createElement('button'); remove.className='ingredient-remove'; remove.type='button';
    remove.setAttribute('aria-label','Eliminar ingrediente'); remove.title='Eliminar ingrediente';
    remove.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>';
    remove.onclick=()=>row.remove(); row.append(remove); box.append(row); updateProfile();
  }
  function addDish(data = {}) {
    const box = document.createElement('section'); box.className='dish-editor shared-dish'; box.dataset.dishId=data.id||''; const title=text('strong','Plato'); const name=input('Nombre del plato'); name.className='shared-dish-name'; name.required=true; name.maxLength=120; name.value=data.name||'';
    const ingredients=document.createElement('div'); ingredients.className='shared-ingredients';
    const add=text('button','＋ Ingrediente','secondary'); add.type='button'; add.onclick=()=>addIngredient(ingredients);
    const del=text('button','Quitar plato','quiet'); del.type='button'; del.onclick=()=>box.remove();
    const top=document.createElement('div');top.className='dish-title-row';top.append(reorderHandle(box,'plato'),title,del);
    const nameLabel=document.createElement('label');nameLabel.append(document.createTextNode('Nombre del plato'),name);
    const ingredientsHead=document.createElement('div');ingredientsHead.className='ing-head';ingredientsHead.append(text('span','Ingredientes','label'));
    add.classList.add('add-ingredient');
    box.append(top,nameLabel,ingredientsHead,ingredients,add); $('#shared-dishes').append(box); if(data.ingredients?.length)data.ingredients.forEach(i=>addIngredient(ingredients,i)); else addIngredient(ingredients);
  }
  function updateProfile() {
    const profile=$('#shared-profile').value;
    document.querySelectorAll('.shared-person').forEach(label=>{ label.hidden = profile!=='todos' && label.dataset.member!==profile; });
    const legend=$('#recipe-member-legend');legend.replaceChildren();
    for(const person of state.workspace.members){
      if(profile!=='todos' && person.id!==profile)continue;
      const entry=text('span',person.name,'recipe-member-entry'),dot=document.createElement('span');dot.className='recipe-member-dot';dot.style.backgroundColor=person.color||'#2d7a5a';dot.setAttribute('aria-hidden','true');entry.prepend(dot);legend.append(entry);
    }
  }
  function resetRecipeForm() {
    const select=$('#shared-profile'); select.replaceChildren();
    for (const p of state.workspace.members) { const option=text('option',p.name); option.value=p.id; select.append(option); }
    if (state.workspace.members.length>1) { const option=text('option','Todos'); option.value='todos'; select.append(option); }
    $('#shared-dishes').replaceChildren(); addDish();
  }
  const normalizeRecipeSearch = value => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  function filterSharedRecipes(){
    const query=normalizeRecipeSearch($('#recipe-search').value);
    let matches=0;
    $('#shared-recipes').querySelectorAll('.recipe-card').forEach(card=>{card.hidden=!!query&&!card.dataset.search.includes(query);if(!card.hidden)matches++;});
    $('#recipe-search-empty').hidden=!query||!state.sharedRecipes.length||matches>0;
  }
  $('#recipe-search').addEventListener('input',filterSharedRecipes);
  async function renderSharedRecipes(expected) {
    const recipes=await rpc('hd_list_recipes'); if (expected!==state.refreshNumber) return;
    state.sharedRecipes=recipes; const list=$('#shared-recipes'); list.replaceChildren();
    if (!recipes.length) list.append(text('p','Todavía no hay recetas compartidas.','muted'));
    for (const recipe of recipes) {
      const article=document.createElement('details');article.className='recipe-card';
      article.dataset.search=normalizeRecipeSearch([recipe.name,...recipe.dishes.flatMap(d=>d.ingredients.map(i=>i.name))].join(' '));
      const summary=document.createElement('summary');summary.className='recipe-card-summary';
      summary.append(text('strong',recipe.name));const chevron=text('span','⌄','recipe-card-chevron');chevron.setAttribute('aria-hidden','true');summary.append(chevron);article.append(summary);
      const detail=document.createElement('div');detail.className='recipe-card-detail';
      if(recipe.container)detail.append(text('p','Táper: '+recipe.container,'muted'));
      const {amountNode}=window.hdCreateAmounts(text,()=>state.workspace.members);
      for (const dish of recipe.dishes) {
        const section=document.createElement('section');section.className='cooking-dish';
        section.append(text('h4',dish.name,'cooking-dish-name'),text('span','Ingredientes','cooking-section-label cooking-ingredients-label'));
        for (const ingredient of dish.ingredients) {
          const line=text('div','','ingredient cooking-ingredient');line.append(text('span',ingredient.name));
          const values=text('span','','cooking-amounts');const unit=ingredient.unit==='unidad'?'uds':ingredient.unit;
          for(const q of ingredient.quantities){const badge=amountNode(q,{compact:true,unit});if(!q.active){badge.classList.add('former-member');badge.title=q.name+' (antiguo miembro)';badge.setAttribute('aria-label',q.name+' (antiguo miembro): '+q.quantity+unit);}values.append(badge);}
          line.append(values);section.append(line);
        }
        detail.append(section);
      }
      if(recipe.steps.length){const prep=text('section','','cooking-preparation');prep.append(text('span','Preparación','cooking-section-label cooking-preparation-label'));const ol=text('ol','','cooking-steps');for(const step of recipe.steps)ol.append(text('li',step));prep.append(ol);detail.append(prep);}
      const prepare=(editing)=>{
        state.editingRecipeId=editing?recipe.id:null; $('#recipe-form-title').textContent=editing?'Editar receta':'Copiar receta';
        $('#recipe-submit').textContent=editing?'Guardar cambios':'Guardar copia';
        $('#shared-recipe-form').reset(); resetRecipeForm();
        $('#shared-name').value=recipe.name;
        const selectedContainer=recipe.container||''; const containerSelect=$('#shared-container');
        if(selectedContainer && ![...containerSelect.options].some(o=>o.value===selectedContainer)){const option=text('option',selectedContainer+' (ya no configurado)');option.value=selectedContainer;containerSelect.append(option);}
        containerSelect.value=selectedContainer;
        $('#shared-steps').value=recipe.steps.join(String.fromCharCode(10));
        $('#shared-dishes').replaceChildren(); recipe.dishes.forEach(d=>addDish(d));
        if(state.workspace.members.length>1)$('#shared-profile').value='todos';
        updateProfile(); status(''); $('#recipe-dialog-status').textContent=''; $('#recipe-dialog').showModal();
        $('#shared-name').focus();
      };
      const edit=text('button','Editar','secondary');edit.type='button';edit.onclick=()=>prepare(true);
      const copy=text('button','Copiar receta','secondary');copy.type='button';copy.onclick=()=>prepare(false);
      const remove=text('button','Eliminar receta','quiet recipe-delete');remove.type='button';
      remove.onclick=async()=>{
        remove.disabled=true;
        try{
          const check=await rpc('hd_delete_recipe',{p_recipe_id:recipe.id,p_confirm:false});
          if(check.status==='in_use'){
            await window.hdDialog.alert('Para eliminar esta receta, primero debes eliminarla o sustituirla en los siguientes menús:',{heading:'Receta incluida en menús',items:check.menus.map(menu=>menu.name+(menu.active?' (activo)':''))});
            return;
          }
          if(check.status!=='confirmation_required')throw new Error('Respuesta inesperada al comprobar la receta.');
          if(!(await window.hdDialog.confirm('¿Eliminar la receta «'+recipe.name+'»? Esta acción no se puede deshacer.',{heading:'Eliminar receta',acceptLabel:'Eliminar',danger:true})))return;
          const result=await rpc('hd_delete_recipe',{p_recipe_id:recipe.id,p_confirm:true});
          if(result.status==='in_use'){
            await window.hdDialog.alert('Para eliminar esta receta, primero debes eliminarla o sustituirla en los siguientes menús:',{heading:'Receta incluida en menús',items:result.menus.map(menu=>menu.name+(menu.active?' (activo)':''))});
            return;
          }
          if(result.status!=='deleted')throw new Error('No se confirmó la eliminación.');
          await renderSharedRecipes(state.refreshNumber);
          await window.hdSharedMenus.reload({rpc,notify:status,recipes:state.sharedRecipes,members:state.workspace.members});
          status('Receta eliminada.');
        }catch(error){report(error);}finally{remove.disabled=false;}
      };
      const actions=document.createElement('div');actions.className='actions recipe-card-actions';actions.append(edit,copy,remove);detail.append(actions);article.append(detail);list.append(article);
    }
    filterSharedRecipes();
  }
  $('#shared-profile').onchange=updateProfile;
  $('#shared-add-dish').onclick=()=>addDish();
  function cancelEdit(){
    if($('#recipe-dialog').open)$('#recipe-dialog').close();
    state.editingRecipeId=null;$('#shared-recipe-form').reset();resetRecipeForm();
    $('#recipe-form-title').textContent='Nueva receta';$('#recipe-submit').textContent='Guardar receta';
    $('#recipe-dialog-status').textContent='';
  }
  $('#recipe-cancel').onclick=cancelEdit;
  $('#recipe-close').onclick=cancelEdit;
  $('#recipe-dialog').addEventListener('cancel',event=>{event.preventDefault();cancelEdit();});
  $('#recipe-new').onclick=()=>{cancelEdit();status('');$('#recipe-dialog').showModal();$('#shared-name').focus();};
  $('#shared-recipe-form').onsubmit=async event=>{
    event.preventDefault(); const profile=$('#shared-profile').value; const dishes=[];
    for (const box of document.querySelectorAll('.shared-dish')) {
      const ingredients=[];
      for (const row of box.querySelectorAll('.shared-ingredient')) {
        const quantities=[];
        for (const label of row.querySelectorAll('.shared-person')) {
          if (profile!=='todos' && label.dataset.member!==profile) continue;
          const value=label.querySelector('input').value;
          if (value!=='') quantities.push({member_id:label.dataset.member,quantity:Number(value)});
        }
        ingredients.push({id:state.editingRecipeId?(row.dataset.ingredientId||null):null,name:row.querySelector('.shared-ingredient-name').value.trim(),unit:row.querySelector('.shared-unit').value,quantities});
      }
      dishes.push({id:state.editingRecipeId?(box.dataset.dishId||null):null,name:box.querySelector('.shared-dish-name').value.trim(),ingredients});
    }
    if (!dishes.length || dishes.some(d=>!d.ingredients.length||d.ingredients.some(i=>!i.quantities.length))) { status('Añade al menos un plato, un ingrediente y una cantidad por ingrediente.',true); return; }
    const steps=$('#shared-steps').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    try { const params={p_name:$('#shared-name').value.trim(),p_container:$('#shared-container').value.trim()||null,p_steps:steps,p_dishes:dishes};
      if(state.editingRecipeId){if(!await window.hdSharedMenus.withConfirmation('hd_shopping_update_recipe',{...params,p_recipe_id:state.editingRecipeId}))return;}else await rpc('hd_create_recipe',params);
      cancelEdit(); status('Receta guardada en el espacio.'); await renderSharedRecipes(state.refreshNumber); await window.hdSharedMenus.reload({rpc,notify:status,recipes:state.sharedRecipes,members:state.workspace.members}); } catch(error) {
      if(error?.message?.includes('cantidades históricas')) status('No se puede eliminar o cambiar un ingrediente con cantidades históricas de antiguos miembros.',true);
      else report(error);
    }
  };
 

  return { render: renderSharedRecipes, cancel: cancelEdit };
};
