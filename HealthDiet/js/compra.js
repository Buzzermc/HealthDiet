/* Agrupación y marcas de la lista de la compra. */
window.hdCreateShopping = ({$, el, activeMenu, refs, amountNode, getState, setExtras}) => {
  let sortBy='name-asc';
  function renderExtras(root,{rpc,notify,extras,extraUnavailable}) {
    const section=el('section',undefined,'shopping-extra');
    section.append(el('h4','Compra extra','shopping-section-title'));
    section.append(el('p','Añade otros productos que necesitéis. Se comparten en vuestro espacio y se conservan al cambiar de menú.','muted'));
    if(extraUnavailable){section.append(el('p','La compra extra todavía no está disponible.','muted'));root.append(section);return;}
    const form=el('form',undefined,'shopping-extra-form'),input=el('input'),add=el('button','Añadir','secondary');
    input.type='text';input.required=true;input.maxLength=120;input.placeholder='Ej.: jabón, papel de cocina…';input.setAttribute('aria-label','Producto para la compra extra');add.type='submit';form.append(input,add);
    form.onsubmit=async event=>{event.preventDefault();const name=input.value.trim();if(!name){input.focus();return;}add.disabled=true;try{await rpc('hd_extra_add',{p_name:name});setExtras(await rpc('hd_extra_list'));renderShopping();}catch(error){notify('No se ha podido añadir el producto. Inténtalo de nuevo.',true);}finally{add.disabled=false;}};
    section.append(form);
    if(!extras.length)section.append(el('p','Todavía no hay productos extra.','muted'));
    for(const item of extras){
      const row=el('div',undefined,'shopping-item shopping-extra-item'),label=el('label',undefined,'shopping-check-label'),check=el('input'),remove=el('button','Eliminar','quiet');
      check.type='checkbox';check.checked=item.checked;check.setAttribute('aria-label','Marcar '+item.name+' para comprar');
      check.onchange=async()=>{const value=check.checked;check.disabled=true;try{await rpc('hd_extra_set',{p_id:item.id,p_checked:value});item.checked=value;}catch(error){check.checked=!value;notify('No se ha podido guardar la marca.',true);}finally{check.disabled=false;}};
      remove.type='button';remove.setAttribute('aria-label','Eliminar '+item.name);remove.onclick=async()=>{remove.disabled=true;try{await rpc('hd_extra_delete',{p_id:item.id});setExtras(await rpc('hd_extra_list'));renderShopping();}catch(error){notify('No se ha podido eliminar el producto.',true);remove.disabled=false;}};
      label.append(check,el('span',item.name,'shopping-name'));row.append(label,remove);section.append(row);
    }
    root.append(section);
  }
  function renderShopping(){
    const {recipes, checked, rpc, notify, extras, extraUnavailable}=getState();
    const root=$('#shared-shopping');root.replaceChildren();
    renderExtras(root,{rpc,notify,extras,extraUnavailable});
    root.append(el('h4','Ingredientes del menú','shopping-section-title'));
    const menu=activeMenu();if(!menu){root.append(el('p','Activa un menú para preparar la compra.','muted'));return;}
    const groups=new Map();
    for(const entry of refs(menu)){const recipe=recipes.find(r=>r.id===entry.recipe_id);if(!recipe)continue;for(const dish of recipe.dishes)for(const ingredient of dish.ingredients){
      const key=ingredient.name.trim().toLocaleLowerCase('es')+'|'+ingredient.unit;let group=groups.get(key);if(!group){group={name:ingredient.name,unit:ingredient.unit,people:new Map()};groups.set(key,group);}
      for(const q of ingredient.quantities)if(q.active){const old=group.people.get(q.member_id)||{...q,quantity:0};old.quantity+=Number(q.quantity);group.people.set(q.member_id,old);}
    }}
    if(!groups.size){root.append(el('p','No hay ingredientes en este menú.','muted'));return;}
    root.append(el('p','Marca lo que hay que comprar. Las marcas se comparten con tu espacio.','muted'));
    const toolbar=el('div',undefined,'shopping-toolbar'),sortLabel=el('label','Ordenar por','shopping-sort-label'),sort=el('select');
    sort.setAttribute('aria-label','Ordenar lista de la compra');
    for(const [value,label] of [['name-asc','Nombre: A a Z'],['name-desc','Nombre: Z a A'],['checked-first','Marcados primero'],['unchecked-first','Sin marcar primero']]){const option=el('option',label);option.value=value;sort.append(option);}
    sort.value=sortBy;sort.onchange=()=>{sortBy=sort.value;renderShopping();};toolbar.append(sortLabel,sort);root.append(toolbar);
    const keyFor=group=>group.name.trim().toLocaleLowerCase('es')+'|'+group.unit;
    const ordered=[...groups.values()].sort((a,b)=>{
      const name=a.name.localeCompare(b.name,'es',{sensitivity:'base'})||a.unit.localeCompare(b.unit,'es');
      if(sortBy==='name-desc')return -name;
      if(sortBy==='checked-first'||sortBy==='unchecked-first'){const difference=Number(checked.has(keyFor(a)))-Number(checked.has(keyFor(b)));if(difference)return sortBy==='checked-first'?-difference:difference;}
      return name;
    });
    for(const group of ordered){
      const row=el('div',undefined,'shopping-item'),label=el('label',undefined,'shopping-check-label'),check=el('input');check.type='checkbox';
      const key=group.name.trim().toLocaleLowerCase('es')+'|'+group.unit;check.checked=checked.has(key);
      check.onchange=async()=>{const value=check.checked;check.disabled=true;try{await rpc('hd_shopping_set',{p_menu_id:menu.id,p_name:group.name,p_unit:group.unit,p_checked:value});if(value)checked.add(key);else checked.delete(key);if(sortBy==='checked-first'||sortBy==='unchecked-first')renderShopping();}catch(error){check.checked=!value;notify('No se ha podido guardar la marca. Actualiza la aplicación y vuelve a intentarlo.',true);}finally{check.disabled=false;}};
      label.append(check,el('span',group.name,'shopping-name'));
      const vals=el('div',undefined,'shopping-amounts'),unit=group.unit==='unidad'?'uds':group.unit;let total=0;for(const q of group.people.values())total+=q.quantity;const totalNode=el('strong',total+unit);totalNode.setAttribute('aria-label','Total: '+total+' '+unit);vals.append(totalNode);for(const q of group.people.values())vals.append(amountNode(q,{compact:true,unit}));row.append(label,vals);root.append(row);
    }
  }
  return renderShopping;
};
