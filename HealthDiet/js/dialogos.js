/* Avisos y confirmaciones compartidos por toda la aplicación. */
window.hdDialog = (() => {
  const dialog = document.querySelector('#app-dialog');
  const title = document.querySelector('#app-dialog-title');
  const message = document.querySelector('#app-dialog-message');
  const list = document.querySelector('#app-dialog-list');
  const cancel = document.querySelector('#app-dialog-cancel');
  const accept = document.querySelector('#app-dialog-accept');
  let pending = Promise.resolve();

  function show({heading='Confirmar acción', text='', items=[], confirm=false, acceptLabel='Aceptar', danger=false}) {
    const run = () => new Promise((resolve, reject) => {
      title.textContent = heading;
      message.textContent = text;
      list.replaceChildren();
      for (const item of items) {
        const li = document.createElement('li');
        li.textContent = item;
        list.append(li);
      }
      list.hidden = items.length === 0;
      cancel.hidden = !confirm;
      accept.textContent = acceptLabel;
      accept.classList.toggle('dialog-danger', danger);
      dialog.returnValue = '';
      const onClose = () => resolve(dialog.returnValue === 'accept');
      dialog.addEventListener('close', onClose, {once:true});
      try {
        dialog.showModal();
        (confirm ? cancel : accept).focus();
      } catch (error) {
        dialog.removeEventListener('close', onClose);
        reject(error);
      }
    });
    const result = pending.then(run, run);
    pending = result.catch(() => {});
    return result;
  }
  cancel.addEventListener('click', () => dialog.close('cancel'));
  accept.addEventListener('click', () => dialog.close('accept'));
  return {
    confirm: (text, options={}) => show({...options, text, confirm:true}),
    alert: (text, options={}) => show({...options, text, confirm:false})
  };
})();
