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
  let mode = 'login', workspace = null, recovering = false, refreshNumber = 0;
  const rpc = async (name, args = {}) => { const { data, error } = await client.rpc(name, args); if (error) throw error; return data; };
  const text = (tag, value, cls) => { const node = document.createElement(tag); node.textContent = value; if (cls) node.className = cls; return node; };
  const report = error => { console.error('HealthDiet:', error); status('No se ha podido completar la operación. Revisa los datos e inténtalo de nuevo.', true); };
  const redirect = () => {
    if (!['https:', 'http:'].includes(location.protocol)) throw new Error('El correo requiere una dirección web configurada.');
    return location.origin + location.pathname;
  };
  const setMode = next => { mode = next; $('#auth-submit').textContent = mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'; $('#password').autocomplete = mode === 'login' ? 'current-password' : 'new-password'; status(''); };
  $('#show-login').onclick = () => setMode('login');
  $('#show-signup').onclick = () => setMode('signup');
  $('#auth-form').onsubmit = async event => {
    event.preventDefault(); const email = $('#email').value.trim(); const password = $('#password').value;
    try {
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
        if (error) throw error;
        $('#password').value = '';
        status(data.session ? 'Cuenta creada.' : 'Si se puede completar el registro, recibirás un correo de confirmación.');
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        $('#password').value = ''; status('Sesión iniciada.');
      }
    } catch (error) { report(error); }
  };
  $('#forgot').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email || !$('#email').validity.valid) { status('Escribe primero tu correo electrónico.', true); return; }
    try { const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirect() }); if (error) throw error; status('Si la cuenta existe, recibirás las instrucciones para recuperar la contraseña.'); } catch (error) { report(error); }
  };
  $('#recovery-form').onsubmit = async event => {
    event.preventDefault();
    try { const { error } = await client.auth.updateUser({ password: $('#new-password').value }); if (error) throw error; $('#new-password').value = ''; recovering = false; status('Contraseña actualizada.'); await refresh(); } catch (error) { report(error); }
  };
  $('#signout').onclick = async () => { try { const { error } = await client.auth.signOut(); if (error) throw error; workspace = null; status('Sesión cerrada.'); await refresh(); } catch (error) { report(error); } };
  $('#create-form').onsubmit = async event => {
    event.preventDefault();
    try { await rpc('hd_create_workspace', { p_workspace_name: $('#workspace-name').value.trim(), p_display_name: $('#display-name').value.trim() }); event.target.reset(); status('Espacio creado.'); await refresh(); } catch (error) { report(error); }
  };
  $('#invite-form').onsubmit = async event => {
    event.preventDefault();
    try { await rpc('hd_invite', { p_email: $('#invite-email').value.trim() }); event.target.reset(); status('Invitación creada. El envío por correo aún no está disponible.'); } catch (error) { report(error); }
  };
  $('#transfer-form').onsubmit = async event => {
    event.preventDefault(); const id = $('#member-select').value; if (!id || !confirm('¿Quieres transferir la administración a esta persona?')) return;
    try { await rpc('hd_transfer_admin', { p_member_id: id }); status('Administración transferida.'); await refresh(); } catch (error) { report(error); }
  };
  $('#leave').onclick = async () => {
    if (!confirm('¿Quieres abandonar este espacio? Perderás el acceso a sus datos.')) return;
    try { await rpc('hd_leave_workspace'); status('Has abandonado el espacio.'); await refresh(); } catch (error) { status('No se ha podido abandonar el espacio. Si eres la última persona administradora, transfiere primero la administración.', true); }
  };
  function renderWorkspace(data) {
    workspace = data; $('#workspace-title').textContent = data.name; $('#workspace-role').textContent = data.role === 'admin' ? 'Administración' : 'Miembro';
    const members = $('#members'); members.replaceChildren(); const select = $('#member-select'); select.replaceChildren();
    for (const person of data.members) {
      const row = document.createElement('div'); row.className = 'account-person'; const name = document.createElement('span'); const dot = document.createElement('i'); dot.className = 'account-dot'; dot.style.backgroundColor = person.color; name.append(dot, document.createTextNode(person.name)); row.append(name, text('small', person.role === 'admin' ? 'Administración' : 'Miembro')); members.append(row);
      if (person.id !== data.my_member_id) { const option = text('option', person.name); option.value = person.id; select.append(option); }
    }
    toggle('#admin', data.role === 'admin'); $('#member-select').disabled = !select.options.length; $('#transfer-button').disabled = !select.options.length;
  }
  function renderInvitations(items) {
    const list = $('#invitations'); list.replaceChildren();
    if (!items.length) { list.append(text('p', 'No tienes invitaciones pendientes.', 'muted')); return; }
    for (const invitation of items) {
      const row = document.createElement('div'); row.className = 'account-invite'; row.append(text('strong', invitation.workspace_name)); const label = text('label', 'Tu nombre'); const input = document.createElement('input'); input.maxLength = 120; input.required = true; label.append(input); row.append(label);
      const button = text('button', 'Aceptar invitación', 'secondary'); button.type = 'button'; button.onclick = async () => { const name = input.value.trim(); if (!name) { status('Escribe tu nombre para aceptar la invitación.', true); return; } try { await rpc('hd_accept_invitation', { p_invitation: invitation.id, p_display_name: name }); status('Te has unido al espacio.'); await refresh(); } catch (error) { report(error); } }; row.append(button); list.append(row);
    }
  }
  async function refresh() {
    const sequence = ++refreshNumber;
    const { data, error } = await client.auth.getSession(); if (sequence !== refreshNumber) return; if (error) { report(error); return; }
    if (recovering) { toggle('#auth', false); toggle('#space', false); toggle('#recovery', true); return; }
    toggle('#recovery', false); const session = data.session; toggle('#auth', !session); toggle('#space', !!session);
    if (!session) { workspace = null; return; }
    $('#signed-in').textContent = session.user.email || '';
    try {
      const current = await rpc('hd_my_workspace'); if (sequence !== refreshNumber) return;
      toggle('#dashboard', !!current); toggle('#onboarding', !current);
      if (current) renderWorkspace(current); else { const invitations = await rpc('hd_my_invitations'); if (sequence === refreshNumber) renderInvitations(invitations); }
    } catch (error) { toggle('#dashboard', false); toggle('#onboarding', false); report(error); }
  }
  client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') recovering = true; setTimeout(() => refresh(), 0); });
  refresh();
})();
