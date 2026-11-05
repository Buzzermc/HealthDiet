(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const url = 'https://hbdkzelbyiixyjbroiat.supabase.co';
  // Clave publicable: la autorización real se comprueba en Supabase.
  const key = 'sb_publishable_8ieWzq-WkuLDDizrm39QMA_iDgE_kuR';
  let toastTimer;
  const status = (message, error = false) => {
    const target = $('#recipe-dialog')?.open ? $('#recipe-dialog-status') : $('#shared-menu-dialog')?.open ? $('#menu-dialog-status') : $('#status');
    target.textContent = message; target.classList.toggle('error', error);
    if(target.id==='status'){
      clearTimeout(toastTimer);target.hidden=!message;
      if(message)toastTimer=setTimeout(()=>{target.hidden=true;target.textContent='';},error?7000:3500);
    }
  };
  const toggle = (selector, shown) => { $(selector).hidden = !shown; };
  if (!window.supabase) { status('No se ha podido cargar el servicio de acceso. Comprueba tu conexión y vuelve a intentarlo.', true); return; }
  const client = window.supabase.createClient(url, key);
  let workspace = null, refreshNumber = 0, sharedRecipes = [], activeView = 'cooking', editingRecipeId = null;
  const rpc = async (name, args = {}) => { const { data, error } = await client.rpc(name, args); if (error) throw error; return data; };
  const text = (tag, value, cls) => { const node = document.createElement(tag); node.textContent = value; if (cls) node.className = cls; return node; };
  const report = error => { console.error('HealthDiet:', error); status('No se ha podido completar la operación. Revisa los datos e inténtalo de nuevo.', true); };
  $('#auth-form').onsubmit = async event => {
    event.preventDefault();
    try {
      const { error } = await client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
      if (error) throw error;
      $('#password').value = ''; status('');
    } catch (error) {
      if (error?.code === 'invalid_credentials') status('El correo o la contraseña no son correctos. Compruébalos e inténtalo de nuevo.', true);
      else report(error);
    }
  };
  $('#signout').onclick = async event => {
    const button=event.currentTarget, label=button.querySelector('span');
    button.disabled=true;label.textContent='Cerrando sesión…';
    try {
      const {error}=await client.auth.signOut({scope:'local'});
      if(error)throw error;
      workspace=null;await refresh();status('Sesión cerrada.');
    } catch(error) {
      console.error('HealthDiet: error al cerrar sesión',error);
      status('No se ha podido cerrar sesión. Comprueba la conexión y vuelve a intentarlo.',true);
    } finally {button.disabled=false;label.textContent='Cerrar sesión';}
  };
  $('#create-form').onsubmit = async event => {
    event.preventDefault();
    try { await rpc('hd_create_workspace', { p_workspace_name: $('#workspace-name').value.trim(), p_display_name: $('#display-name').value.trim() }); event.target.reset(); status('Espacio creado.'); await refresh(); } catch (error) { report(error); }
  };
  $('#transfer-form').onsubmit = async event => {
    event.preventDefault(); const id = $('#member-select').value; if (!id || !confirm('¿Quieres transferir la administración a esta persona?')) return;
    try { await rpc('hd_transfer_admin', { p_member_id: id }); status('Administración transferida.'); await refresh(); } catch (error) { report(error); }
  };
  $('#leave').onclick = async () => {
    if (!confirm('¿Quieres abandonar este espacio? Perderás el acceso a sus datos.')) return;
    try { await rpc('hd_leave_workspace'); status('Has abandonado el espacio.'); await refresh(); } catch (error) { status('No se ha podido abandonar el espacio. Si eres la última persona administradora, transfiere primero la administración.', true); }
  };
  function setView(view) {
    activeView=view;
    document.querySelectorAll('[data-hd-view]').forEach(node=>{node.hidden = node.dataset.hdView!==view || (node.id==='admin' && workspace?.role!=='admin');});
    document.querySelectorAll('[data-view-target]').forEach(node=>{const selected=node.dataset.viewTarget===view;node.classList.toggle('selected',selected);node.setAttribute('aria-current',selected?'page':'false');});
  }
  document.querySelectorAll('[data-view-target]').forEach(node=>node.onclick=()=>{setView(node.dataset.viewTarget);if(node.dataset.viewTarget==='shopping' && workspace)refresh().catch(report);});
  function renderWorkspace(data) {
    workspace = data; $('#workspace-title').textContent = data.name; $('#workspace-role').textContent = data.role === 'admin' ? 'Administración' : 'Miembro';
    const members = $('#members'); members.replaceChildren(); const select = $('#member-select'); select.replaceChildren();
    for (const person of data.members) {
      const row = document.createElement('div'); row.className = 'account-person'; const name = document.createElement('span'); const dot = document.createElement('i'); dot.className = 'account-dot'; dot.style.backgroundColor = person.color; name.append(dot, document.createTextNode(person.name)); row.append(name, text('small', person.role === 'admin' ? 'Administración' : 'Miembro')); members.append(row);
      if (person.id !== data.my_member_id) { const option = text('option', person.name); option.value = person.id; select.append(option); }
    }
    setView(activeView); $('#member-select').disabled = !select.options.length; $('#transfer-button').disabled = !select.options.length;
  }

  const input = (placeholder, type = 'text') => { const e = document.createElement('input'); e.type = type; e.placeholder = placeholder; return e; };
  function reorderHandle(item, kind) {
    const handle=document.createElement('button');handle.type='button';handle.className='reorder-handle';
    handle.setAttribute('aria-label','Mover '+kind+'. Usa las flechas arriba y abajo o arrastra.');
    handle.title='Arrastrar para ordenar';handle.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="19" r="1.6"/><circle cx="15" cy="19" r="1.6"/></svg>';
    let dragging=false, pointer=null;
    const announce=()=>{const position=[...item.parentElement.children].indexOf(item)+1;$('#reorder-status').textContent=kind.charAt(0).toUpperCase()+kind.slice(1)+' en la posición '+position+'.';};
    handle.addEventListener('keydown',event=>{
      if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
      const sibling=event.key==='ArrowUp'?item.previousElementSibling:item.nextElementSibling;
      if(!sibling)return;event.preventDefault();
      if(event.key==='ArrowUp')item.parentElement.insertBefore(item,sibling);else item.parentElement.insertBefore(sibling,item);
      handle.focus();announce();
    });
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      dragging=true;pointer=event.pointerId;handle.setPointerCapture(pointer);item.classList.add('reordering');event.preventDefault();
    });
    handle.addEventListener('pointermove',event=>{
      if(!dragging||event.pointerId!==pointer)return;
      const under=document.elementFromPoint(event.clientX,event.clientY);
      const target=under?.closest(kind==='plato'?'.shared-dish':'.shared-ingredient');
      if(!target||target===item||target.parentElement!==item.parentElement)return;
      const rect=target.getBoundingClientRect(), siblings=[...item.parentElement.children];
      const from=siblings.indexOf(item), to=siblings.indexOf(target), midpoint=rect.top+rect.height/2;
      if(to<from && event.clientY<midpoint)item.parentElement.insertBefore(item,target);
      else if(to>from && event.clientY>midpoint)item.parentElement.insertBefore(item,target.nextSibling);
    });
    const finish=event=>{if(!dragging||event.pointerId!==pointer)return;dragging=false;pointer=null;item.classList.remove('reordering');announce();};
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
    return handle;
  }
  function addIngredient(box, data = {}) {
    const row = document.createElement('div'); row.className = 'shared-ingredient'; row.dataset.ingredientId=data.id||'';
    row.append(reorderHandle(row,'ingrediente'));
    const name = input('Ingrediente'); name.className = 'shared-ingredient-name'; name.required = true; name.maxLength = 120; name.value=data.name||''; row.append(name);
    const unit = document.createElement('select'); unit.className = 'shared-unit'; unit.setAttribute('aria-label', 'Unidad');
    for (const [value, label] of [['g','g'],['unidad','unidad(es)']]) { const o = text('option', label); o.value = value; unit.append(o); } unit.value=data.unit||'g'; row.append(unit);
    for (const person of workspace.members) {
      const label = document.createElement('label'); label.className = 'shared-person'; label.dataset.member = person.id; label.append(document.createTextNode('Cantidad · '+person.name));
      const qty = input('Cantidad', 'number'); qty.min = '0.001'; qty.step = 'any'; qty.setAttribute('aria-label','Cantidad para '+person.name); const previous=(data.quantities||[]).find(q=>q.member_id===person.id); if(previous)qty.value=previous.quantity; label.append(qty); row.append(label);
    }
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
  }
  function resetRecipeForm() {
    const select=$('#shared-profile'); select.replaceChildren();
    for (const p of workspace.members) { const option=text('option',p.name); option.value=p.id; select.append(option); }
    if (workspace.members.length>1) { const option=text('option','Todos'); option.value='todos'; select.append(option); }
    $('#shared-dishes').replaceChildren(); addDish();
  }
  async function renderSharedRecipes(expected) {
    const recipes=await rpc('hd_list_recipes'); if (expected!==refreshNumber) return;
    sharedRecipes=recipes; const list=$('#shared-recipes'); list.replaceChildren();
    if (!recipes.length) list.append(text('p','Todavía no hay recetas compartidas.','muted'));
    for (const recipe of recipes) {
      const article=document.createElement('article'); article.className='dish-editor'; article.append(text('strong',recipe.name)); if(recipe.container) article.append(text('p','Táper: '+recipe.container,'muted'));
      for (const dish of recipe.dishes) { article.append(text('p',dish.name)); for (const ingredient of dish.ingredients) {
        const line=text('p',ingredient.name+': '+ingredient.quantities.map(q=>q.name+(q.active?'':' (antiguo miembro)')+' '+q.quantity+' '+(ingredient.unit==='unidad'?'ud.':ingredient.unit)).join(' · '),'muted'); article.append(line);
      } } if(recipe.steps.length){article.append(text('strong','Preparación'));const ol=document.createElement('ol');for(const step of recipe.steps)ol.append(text('li',step));article.append(ol);}
      const prepare=(editing)=>{
        editingRecipeId=editing?recipe.id:null; $('#recipe-form-title').textContent=editing?'Editar receta':'Copiar receta';
        $('#recipe-submit').textContent=editing?'Guardar cambios':'Guardar copia';
        $('#shared-recipe-form').reset(); resetRecipeForm();
        $('#shared-name').value=recipe.name;
        const selectedContainer=recipe.container||''; const containerSelect=$('#shared-container');
        if(selectedContainer && ![...containerSelect.options].some(o=>o.value===selectedContainer)){const option=text('option',selectedContainer+' (ya no configurado)');option.value=selectedContainer;containerSelect.append(option);}
        containerSelect.value=selectedContainer;
        $('#shared-steps').value=recipe.steps.join(String.fromCharCode(10));
        $('#shared-dishes').replaceChildren(); recipe.dishes.forEach(d=>addDish(d));
        if(workspace.members.length>1)$('#shared-profile').value='todos';
        updateProfile(); status(''); $('#recipe-dialog-status').textContent=''; $('#recipe-dialog').showModal();
        $('#shared-name').focus();
      };
      const edit=text('button','Editar','secondary');edit.type='button';edit.onclick=()=>prepare(true);
      const copy=text('button','Copiar receta','secondary');copy.type='button';copy.onclick=()=>prepare(false);
      article.append(edit,copy); list.append(article);
    }
  }
  $('#shared-profile').onchange=updateProfile;
  $('#shared-add-dish').onclick=()=>addDish();
  function cancelEdit(){
    if($('#recipe-dialog').open)$('#recipe-dialog').close();
    editingRecipeId=null;$('#shared-recipe-form').reset();resetRecipeForm();
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
        ingredients.push({id:editingRecipeId?(row.dataset.ingredientId||null):null,name:row.querySelector('.shared-ingredient-name').value.trim(),unit:row.querySelector('.shared-unit').value,quantities});
      }
      dishes.push({id:editingRecipeId?(box.dataset.dishId||null):null,name:box.querySelector('.shared-dish-name').value.trim(),ingredients});
    }
    if (!dishes.length || dishes.some(d=>!d.ingredients.length||d.ingredients.some(i=>!i.quantities.length))) { status('Añade al menos un plato, un ingrediente y una cantidad por ingrediente.',true); return; }
    const steps=$('#shared-steps').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    try { const params={p_name:$('#shared-name').value.trim(),p_container:$('#shared-container').value.trim()||null,p_steps:steps,p_dishes:dishes};
      if(editingRecipeId){if(!await window.hdSharedMenus.withConfirmation('hd_shopping_update_recipe',{...params,p_recipe_id:editingRecipeId}))return;}else await rpc('hd_create_recipe',params);
      cancelEdit(); status('Receta guardada en el espacio.'); await renderSharedRecipes(refreshNumber); await window.hdSharedMenus.reload({rpc,notify:status,recipes:sharedRecipes,members:workspace.members}); } catch(error) {
      if(error?.message?.includes('cantidades históricas')) status('No se puede eliminar o cambiar un ingrediente con cantidades históricas de antiguos miembros.',true);
      else report(error);
    }
  };
 

  async function renderSettings(expected) {
    const items=await rpc('hd_settings_read'); if(expected!==refreshNumber)return;
    const list=$('#settings-containers'),select=$('#shared-container'),chosen=select.value;
    list.replaceChildren(); select.replaceChildren();const none=text('option','Sin especificar');none.value='';select.append(none);
    for(const item of items){
      const row=document.createElement('div');row.className='config-item';row.append(text('span',item.name));
      const remove=text('button','Quitar','quiet');remove.type='button';remove.setAttribute('aria-label','Quitar táper '+item.name);
      remove.onclick=async()=>{if(!confirm('¿Quitar este tipo de táper? Las recetas existentes lo conservarán.'))return;try{await rpc('hd_remove_container',{p_id:item.id});await renderSettings(refreshNumber);status('Tipo de táper eliminado.');}catch(error){report(error);}};
      row.append(remove);list.append(row);const option=text('option',item.name);option.value=item.name;select.append(option);
    }
    if([...select.options].some(o=>o.value===chosen))select.value=chosen;
    const me=workspace.members.find(p=>p.id===workspace.my_member_id);if(me){$('#my-color').value=me.color;$('#my-name').value=me.name;}
  }
  $('#container-form').onsubmit=async event=>{
    event.preventDefault();try{await rpc('hd_add_container',{p_name:$('#container-name-new').value.trim()});event.target.reset();await renderSettings(refreshNumber);status('Táper añadido.');}catch(error){report(error);}
  };
  $('#name-form').onsubmit=async event=>{
    event.preventDefault();const name=$('#my-name').value.trim();
    if(!name){status('Escribe un nombre para mostrar.',true);return;}
    const button=event.currentTarget.querySelector('button');button.disabled=true;
    try{await rpc('hd_set_my_name',{p_name:name});await refresh();status('Nombre guardado.');}catch(error){report(error);}finally{button.disabled=false;}
  };
  $('#password-form').onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget, button=form.querySelector('button');
    const current=$('#current-password').value, next=$('#new-password').value, repeated=$('#confirm-password').value;
    if(next!==repeated){status('Las contraseñas nuevas no coinciden.',true);return;}
    if(next===current){status('La contraseña nueva debe ser distinta de la actual.',true);return;}
    button.disabled=true;button.textContent='Guardando…';
    try {
      const {data:userData,error:userError}=await client.auth.getUser();
      if(userError||!userData?.user?.email)throw new Error('No se ha podido verificar la sesión.');
      const {error:loginError}=await client.auth.signInWithPassword({email:userData.user.email,password:current});
      if(loginError){status('No se ha podido verificar la contraseña actual. Compruébala e inténtalo de nuevo.',true);return;}
      const {error:updateError}=await client.auth.updateUser({password:next});
      if(updateError)throw updateError;
      form.reset();status('Contraseña actualizada.');
    } catch(error) {
      status('No se ha podido cambiar la contraseña. Comprueba los requisitos y vuelve a intentarlo.',true);
    } finally {button.disabled=false;button.textContent='Cambiar contraseña';}
  };
  $('#save-color').onclick=async()=>{
    try{await rpc('hd_set_my_color',{p_color:$('#my-color').value});status('Color guardado.');await refresh();}catch(error){report(error);}
  };

  async function refresh() {
    const sequence = ++refreshNumber;
    const { data, error } = await client.auth.getSession(); if (sequence !== refreshNumber) return; if (error) { report(error); return; }
    const session = data.session; toggle('#auth', !session); toggle('#space', !!session); toggle('#account-nav', !!session); if(!session) toggle('#nav-links', false);
    if (!session) { if($('#recipe-dialog').open)$('#recipe-dialog').close(); $('#password-form').reset(); editingRecipeId=null; workspace = null; sharedRecipes=[]; window.hdSharedMenus.clear(); $('#shared-recipes').replaceChildren(); $('#shared-dishes').replaceChildren(); return; }
    try {
      const current = await rpc('hd_my_workspace'); if (sequence !== refreshNumber) return;
      toggle('#dashboard', !!current); toggle('#onboarding', !current); toggle('#nav-links', !!current);
      if (current) { renderWorkspace(current); await renderSettings(sequence); if(sequence!==refreshNumber)return; cancelEdit(); await renderSharedRecipes(sequence); await window.hdSharedMenus.reload({rpc,notify:status,recipes:sharedRecipes,members:current.members,isCurrent:()=>sequence===refreshNumber}); } else { workspace=null; sharedRecipes=[]; window.hdSharedMenus.clear(); $('#shared-recipes').replaceChildren(); $('#shared-dishes').replaceChildren(); }
    } catch (error) { toggle('#dashboard', false); toggle('#onboarding', false); report(error); }
  }
  client.auth.onAuthStateChange(() => { setTimeout(() => refresh(), 0); });
  refresh();
})();

