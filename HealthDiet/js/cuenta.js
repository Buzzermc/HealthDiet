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
  const linkError = new URLSearchParams((window.location.hash || '').slice(1)).get('error_code');
  const client = window.supabase.createClient(url, key);
  const recoveryStorageKey = 'healthdiet.recovery.user';
  let recoveryUserId = sessionStorage.getItem(recoveryStorageKey);
  let requestingRecovery = Boolean(linkError);
  if (linkError) {
    $('#recovery-request-message').textContent = 'El enlace no es válido o ha caducado. Solicita uno nuevo para recuperar tu contraseña.';
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  const state = {workspace:null, refreshNumber:0, sharedRecipes:[], activeView:'cooking', editingRecipeId:null};
  const rpc = async (name, args = {}) => { const { data, error } = await client.rpc(name, args); if (error) throw error; return data; };
  const text = (tag, value, cls) => { const node = document.createElement(tag); node.textContent = value; if (cls) node.className = cls; return node; };
  const report = error => { console.error('HealthDiet:', error); status('No se ha podido completar la operación. Revisa los datos e inténtalo de nuevo.', true); };
  const recipesUI = window.hdCreateRecipes({state, $, rpc, text, status, report});
  const settingsUI = window.hdCreateSettings({state, $, rpc, text, status, report, client, refresh: () => refresh()});
  $('#forgot-password').onclick = () => {
    requestingRecovery=true; $('#recovery-email').value=$('#email').value.trim();
    $('#recovery-request-message').textContent='';toggle('#auth',false);toggle('#recovery-request',true);$('#recovery-email').focus();
  };
  $('#recovery-back').onclick = () => {requestingRecovery=false;refresh();};
  $('#recovery-request-form').onsubmit = async event => {
    event.preventDefault(); const button=event.currentTarget.querySelector('button');button.disabled=true;
    try {
      const redirectTo=new URL('./',window.location.href).href;
      const {error}=await client.auth.resetPasswordForEmail($('#recovery-email').value.trim(),{redirectTo});
      if(error)throw error;
      $('#recovery-request-message').textContent='Si existe una cuenta con ese correo, recibirás un enlace de recuperación. Revisa también la carpeta de correo no deseado.';
    } catch(error) {$('#recovery-request-message').textContent='No se ha podido solicitar el enlace. Comprueba tu conexión y vuelve a intentarlo más tarde.';}
    finally {button.disabled=false;}
  };
  async function endRecovery() {
    const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
    recoveryUserId=null;sessionStorage.removeItem(recoveryStorageKey);requestingRecovery=false;
    toggle('#recovery-update',false);await refresh();
  }
  $('#recovery-cancel').onclick=async()=>{try{await endRecovery();}catch(error){$('#recovery-update-message').textContent='No se ha podido cerrar la sesión. Inténtalo de nuevo.';}};
  $('#recovery-update-form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');
    const password=$('#recovery-password').value,confirmation=$('#recovery-confirm').value;
    if(password.length<8){$('#recovery-update-message').textContent='La contraseña debe tener al menos ocho caracteres.';return;}
    if(password!==confirmation){$('#recovery-update-message').textContent='Las contraseñas no coinciden.';return;}
    button.disabled=true;$('#recovery-update-message').textContent='';
    try{
      const {data,error:userError}=await client.auth.getUser();
      if(userError||!recoveryUserId||data?.user?.id!==recoveryUserId)throw new Error('Sesión de recuperación no válida');
      const {error}=await client.auth.updateUser({password});if(error)throw error;
      form.reset();
      try{await endRecovery();status('Contraseña actualizada. Inicia sesión con la nueva contraseña.');}
      catch(error){$('#recovery-update-message').textContent='La contraseña se ha actualizado, pero no se ha podido cerrar la sesión. Cierra sesión y vuelve a entrar.';}
    }catch(error){$('#recovery-update-message').textContent='No se ha podido cambiar la contraseña. El enlace puede haber caducado o la contraseña no cumplir los requisitos.';}
    finally{button.disabled=false;}
  };
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
      state.workspace=null;await refresh();status('Sesión cerrada.');
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
    event.preventDefault(); const id = $('#member-select').value; if (!id || !(await window.hdDialog.confirm('¿Quieres transferir la administración a esta persona?',{heading:'Transferir administración',acceptLabel:'Transferir'}))) return;
    try { await rpc('hd_transfer_admin', { p_member_id: id }); status('Administración transferida.'); await refresh(); } catch (error) { report(error); }
  };
  $('#leave').onclick = async () => {
    if (!(await window.hdDialog.confirm('¿Quieres abandonar este espacio? Perderás el acceso a sus datos.',{heading:'Abandonar espacio',acceptLabel:'Abandonar',danger:true}))) return;
    try { await rpc('hd_leave_workspace'); status('Has abandonado el espacio.'); await refresh(); } catch (error) { status('No se ha podido abandonar el espacio. Si eres la última persona administradora, transfiere primero la administración.', true); }
  };
  function setView(view) {
    state.activeView=view;
    document.querySelectorAll('[data-hd-view]').forEach(node=>{node.hidden = node.dataset.hdView!==view || (node.id==='admin' && state.workspace?.role!=='admin');});
    document.querySelectorAll('[data-view-target]').forEach(node=>{const selected=node.dataset.viewTarget===view;node.classList.toggle('selected',selected);node.setAttribute('aria-current',selected?'page':'false');});
  }
  document.querySelectorAll('[data-view-target]').forEach(node=>node.onclick=()=>{setView(node.dataset.viewTarget);if(node.dataset.viewTarget==='shopping' && state.workspace)refresh().catch(report);});
  function renderWorkspace(data) {
    state.workspace = data; $('#workspace-title').textContent = data.name; $('#workspace-role').textContent = data.role === 'admin' ? 'Administración' : 'Miembro';
    $('#space-slogan').textContent = 'El espacio de '+data.name+' para comer bien';
    $('#workspace-name-edit').value = data.name;
    const members = $('#members'); members.replaceChildren(); const select = $('#member-select'); select.replaceChildren();
    for (const person of data.members) {
      const row = document.createElement('div'); row.className = 'account-person'; const name = document.createElement('span'); const dot = document.createElement('i'); dot.className = 'account-dot'; dot.style.backgroundColor = person.color; name.append(dot, document.createTextNode(person.name)); row.append(name, text('small', person.role === 'admin' ? 'Administración' : 'Miembro')); members.append(row);
      if (person.id !== data.my_member_id) { const option = text('option', person.name); option.value = person.id; select.append(option); }
    }
    setView(state.activeView); $('#member-select').disabled = !select.options.length; $('#transfer-button').disabled = !select.options.length;
  }

  async function refresh() {
    const sequence = ++state.refreshNumber;
    const { data, error } = await client.auth.getSession(); if (sequence !== state.refreshNumber) return; if (error) { report(error); return; }
    const session = data.session;
    if(recoveryUserId&&session?.user?.id===recoveryUserId){
      toggle('#auth',false);toggle('#recovery-request',false);toggle('#space',false);toggle('#account-nav',false);toggle('#recovery-update',true);
      $('#recovery-account').textContent='Cuenta: '+(session.user.email||'');return;
    }
    if(recoveryUserId){recoveryUserId=null;sessionStorage.removeItem(recoveryStorageKey);}
    if(requestingRecovery){toggle('#auth',false);toggle('#space',false);toggle('#account-nav',false);toggle('#recovery-update',false);toggle('#recovery-request',true);return;}
    toggle('#recovery-update',false);toggle('#recovery-request',false);
    toggle('#auth', !session&&!requestingRecovery); toggle('#space', !!session); toggle('#account-nav', !!session); if(!session) toggle('#nav-links', false);
    if (!session) { if($('#recipe-dialog').open)$('#recipe-dialog').close(); $('#password-form').reset(); state.editingRecipeId=null; state.workspace = null; state.sharedRecipes=[]; $('#space-slogan').textContent='Tu espacio para comer bien'; $('#recipe-search').value=''; $('#recipe-search-empty').hidden=true; window.hdSharedMenus.clear(); $('#shared-recipes').replaceChildren(); $('#shared-dishes').replaceChildren(); return; }
    try {
      const current = await rpc('hd_my_workspace'); if (sequence !== state.refreshNumber) return;
      toggle('#dashboard', !!current); toggle('#onboarding', !current); toggle('#nav-links', !!current);
      if (current) { renderWorkspace(current); await settingsUI.render(sequence); if(sequence!==state.refreshNumber)return; recipesUI.cancel(); await recipesUI.render(sequence); await window.hdSharedMenus.reload({rpc,notify:status,recipes:state.sharedRecipes,members:current.members,isCurrent:()=>sequence===state.refreshNumber}); } else { state.workspace=null; state.sharedRecipes=[]; $('#space-slogan').textContent='Tu espacio para comer bien'; window.hdSharedMenus.clear(); $('#shared-recipes').replaceChildren(); $('#shared-dishes').replaceChildren(); }
    } catch (error) { toggle('#dashboard', false); toggle('#onboarding', false); report(error); }
  }
  client.auth.onAuthStateChange((event,session) => {
    if(event==='PASSWORD_RECOVERY'&&session?.user?.id){recoveryUserId=session.user.id;sessionStorage.setItem(recoveryStorageKey,recoveryUserId);requestingRecovery=false;}
    setTimeout(() => refresh(), 0);
  });
  refresh();
})();

