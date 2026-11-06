/* Opciones personales y táperes del espacio. */
window.hdCreateSettings = ({state, $, rpc, text, status, report, client, refresh}) => {
  async function renderSettings(expected) {
    const items=await rpc('hd_settings_read'); if(expected!==state.refreshNumber)return;
    const list=$('#settings-containers'),select=$('#shared-container'),chosen=select.value;
    list.replaceChildren(); select.replaceChildren();const none=text('option','Sin especificar');none.value='';select.append(none);
    for(const item of items){
      const row=document.createElement('div');row.className='config-item';row.append(text('span',item.name));
      const remove=text('button','Quitar','quiet');remove.type='button';remove.setAttribute('aria-label','Quitar táper '+item.name);
      remove.onclick=async()=>{if(!(await window.hdDialog.confirm('¿Quitar este tipo de táper? Las recetas existentes lo conservarán.',{heading:'Quitar táper',acceptLabel:'Quitar',danger:true})))return;try{await rpc('hd_remove_container',{p_id:item.id});await renderSettings(state.refreshNumber);status('Tipo de táper eliminado.');}catch(error){report(error);}};
      row.append(remove);list.append(row);const option=text('option',item.name);option.value=item.name;select.append(option);
    }
    if([...select.options].some(o=>o.value===chosen))select.value=chosen;
    const me=state.workspace.members.find(p=>p.id===state.workspace.my_member_id);if(me){$('#my-color').value=me.color;$('#my-name').value=me.name;}
  }
  $('#container-form').onsubmit=async event=>{
    event.preventDefault();try{await rpc('hd_add_container',{p_name:$('#container-name-new').value.trim()});event.target.reset();await renderSettings(state.refreshNumber);status('Táper añadido.');}catch(error){report(error);}
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

  return { render: renderSettings };
};
