(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const url = 'https://hbdkzelbyiixyjbroiat.supabase.co';
  // Clave publicable: la autorización real se comprueba en Supabase.
  const key = 'sb_publishable_8ieWzq-WkuLDDizrm39QMA_iDgE_kuR';
  const status = (message, error = false) => { const box = $('#status'); box.textContent = message; box.classList.toggle('error', error); };
  const toggle = (selector, shown) => { $(selector).hidden = !shown; };
  if (!window.supabase) { status('No se ha podido cargar el servicio de acceso. Comprueba tu conexión y vuelve a intentarlo.', true); return; }
  const client = window.supabase.createClient(url, key);
  let workspace = null, refreshNumber = 0, sharedRecipes = [], activeView = 'cooking';
  const rpc = async (name, args = {}) => { const { data, error } = await client.rpc(name, args); if (error) throw error; return data; };
  const text = (tag, value, cls) => { const node = document.createElement(tag); node.textContent = value; if (cls) node.className = cls; return node; };
  const report = error => { console.error('HealthDiet:', error); status('No se ha podido completar la operación. Revisa los datos e inténtalo de nuevo.', true); };
  $('#auth-form').onsubmit = async event => {
    event.preventDefault();
    try {
      const { error } = await client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
      if (error) throw error;
      $('#password').value = ''; status('Sesión iniciada.');
    } catch (error) { report(error); }
  };
  $('#signout').onclick = async () => { try { const { error } = await client.auth.signOut(); if (error) throw error; workspace = null; status('Sesión cerrada.'); await refresh(); } catch (error) { report(error); } };
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
  document.querySelectorAll('[data-view-target]').forEach(node=>node.onclick=()=>setView(node.dataset.viewTarget));
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
  function addIngredient(box) {
    const row = document.createElement('div'); row.className = 'shared-ingredient';
    const name = input('Ingrediente'); name.className = 'shared-ingredient-name'; name.required = true; name.maxLength = 120; row.append(name);
    const unit = document.createElement('select'); unit.className = 'shared-unit'; unit.setAttribute('aria-label', 'Unidad');
    for (const [value, label] of [['g','g'],['unidad','unidad(es)']]) { const o = text('option', label); o.value = value; unit.append(o); } row.append(unit);
    for (const person of workspace.members) {
      const label = document.createElement('label'); label.className = 'shared-person'; label.dataset.member = person.id; label.append(document.createTextNode('Cantidad · '+person.name));
      const qty = input('Cantidad', 'number'); qty.min = '0.001'; qty.step = 'any'; qty.setAttribute('aria-label','Cantidad para '+person.name); label.append(qty); row.append(label);
    }
    const remove = text('button','Quitar ingrediente','quiet'); remove.type='button'; remove.onclick=()=>row.remove(); row.append(remove); box.append(row); updateProfile();
  }
  function addDish() {
    const box = document.createElement('section'); box.className='dish-editor shared-dish'; const title=text('strong','Plato'); const name=input('Nombre del plato'); name.className='shared-dish-name'; name.required=true; name.maxLength=120;
    const ingredients=document.createElement('div'); ingredients.className='shared-ingredients';
    const add=text('button','＋ Ingrediente','secondary'); add.type='button'; add.onclick=()=>addIngredient(ingredients);
    const del=text('button','Quitar plato','quiet'); del.type='button'; del.onclick=()=>box.remove();
    box.append(title,name,ingredients,add,del); $('#shared-dishes').append(box); addIngredient(ingredients);
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
      const article=document.createElement('article'); article.className='dish-editor'; article.append(text('strong',recipe.name));
      for (const dish of recipe.dishes) { article.append(text('p',dish.name)); for (const ingredient of dish.ingredients) {
        const line=text('p',ingredient.name+': '+ingredient.quantities.map(q=>q.name+(q.active?'':' (antiguo miembro)')+' '+q.quantity+' '+(ingredient.unit==='unidad'?'ud.':ingredient.unit)).join(' · '),'muted'); article.append(line);
      } } list.append(article);
    }
  }
  $('#shared-profile').onchange=updateProfile;
  $('#shared-add-dish').onclick=addDish;
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
        ingredients.push({name:row.querySelector('.shared-ingredient-name').value.trim(),unit:row.querySelector('.shared-unit').value,quantities});
      }
      dishes.push({name:box.querySelector('.shared-dish-name').value.trim(),ingredients});
    }
    if (!dishes.length || dishes.some(d=>!d.ingredients.length||d.ingredients.some(i=>!i.quantities.length))) { status('Añade al menos un plato, un ingrediente y una cantidad por ingrediente.',true); return; }
    const steps=$('#shared-steps').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    try { await rpc('hd_create_recipe',{p_name:$('#shared-name').value.trim(),p_container:$('#shared-container').value.trim()||null,p_steps:steps,p_dishes:dishes}); event.target.reset(); resetRecipeForm(); status('Receta guardada en el espacio.'); await renderSharedRecipes(refreshNumber); await window.hdSharedMenus.reload({rpc,notify:status,recipes:sharedRecipes,members:workspace.members}); } catch(error) { report(error); }
  };
 
  async function refresh() {
    const sequence = ++refreshNumber;
    const { data, error } = await client.auth.getSession(); if (sequence !== refreshNumber) return; if (error) { report(error); return; }
    const session = data.session; toggle('#auth', !session); toggle('#space', !!session);
    if (!session) { workspace = null; sharedRecipes=[]; window.hdSharedMenus.clear(); $('#shared-recipes').replaceChildren(); $('#shared-dishes').replaceChildren(); return; }
    $('#signed-in').textContent = session.user.email || '';
    try {
      const current = await rpc('hd_my_workspace'); if (sequence !== refreshNumber) return;
      toggle('#dashboard', !!current); toggle('#onboarding', !current);
      if (current) { renderWorkspace(current); resetRecipeForm(); await renderSharedRecipes(sequence); await window.hdSharedMenus.reload({rpc,notify:status,recipes:sharedRecipes,members:current.members,isCurrent:()=>sequence===refreshNumber}); } else { workspace=null; sharedRecipes=[]; window.hdSharedMenus.clear(); $('#shared-recipes').replaceChildren(); $('#shared-dishes').replaceChildren(); }
    } catch (error) { toggle('#dashboard', false); toggle('#onboarding', false); report(error); }
  }
  client.auth.onAuthStateChange(() => { setTimeout(() => refresh(), 0); });
  refresh();
})();
