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
  let workspace = null, refreshNumber = 0;
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
  function renderWorkspace(data) {
    workspace = data; $('#workspace-title').textContent = data.name; $('#workspace-role').textContent = data.role === 'admin' ? 'Administración' : 'Miembro';
    const members = $('#members'); members.replaceChildren(); const select = $('#member-select'); select.replaceChildren();
    for (const person of data.members) {
      const row = document.createElement('div'); row.className = 'account-person'; const name = document.createElement('span'); const dot = document.createElement('i'); dot.className = 'account-dot'; dot.style.backgroundColor = person.color; name.append(dot, document.createTextNode(person.name)); row.append(name, text('small', person.role === 'admin' ? 'Administración' : 'Miembro')); members.append(row);
      if (person.id !== data.my_member_id) { const option = text('option', person.name); option.value = person.id; select.append(option); }
    }
    toggle('#admin', data.role === 'admin'); $('#member-select').disabled = !select.options.length; $('#transfer-button').disabled = !select.options.length;
  }
  async function refresh() {
    const sequence = ++refreshNumber;
    const { data, error } = await client.auth.getSession(); if (sequence !== refreshNumber) return; if (error) { report(error); return; }
    const session = data.session; toggle('#auth', !session); toggle('#space', !!session);
    if (!session) { workspace = null; return; }
    $('#signed-in').textContent = session.user.email || '';
    try {
      const current = await rpc('hd_my_workspace'); if (sequence !== refreshNumber) return;
      toggle('#dashboard', !!current); toggle('#onboarding', !current);
      if (current) renderWorkspace(current);
    } catch (error) { toggle('#dashboard', false); toggle('#onboarding', false); report(error); }
  }
  client.auth.onAuthStateChange(() => { setTimeout(() => refresh(), 0); });
  refresh();
})();
