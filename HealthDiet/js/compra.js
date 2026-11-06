/* Agrupación y marcas de la lista de la compra. */
window.hdCreateShopping = ({$, el, activeMenu, refs, amountNode, getState}) => {
  function renderShopping(){
    const {recipes, checked, rpc, notify}=getState();
    const root=$('#shared-shopping');root.replaceChildren();const menu=activeMenu();if(!menu){root.append(el('p','Activa un menú para preparar la compra.','muted'));return;}
    const groups=new Map();
    for(const entry of refs(menu)){const recipe=recipes.find(r=>r.id===entry.recipe_id);if(!recipe)continue;for(const dish of recipe.dishes)for(const ingredient of dish.ingredients){
      const key=ingredient.name.trim().toLocaleLowerCase('es')+'|'+ingredient.unit;let group=groups.get(key);if(!group){group={name:ingredient.name,unit:ingredient.unit,people:new Map()};groups.set(key,group);}
      for(const q of ingredient.quantities)if(q.active){const old=group.people.get(q.member_id)||{...q,quantity:0};old.quantity+=Number(q.quantity);group.people.set(q.member_id,old);}
    }}
    if(!groups.size){root.append(el('p','No hay ingredientes en este menú.','muted'));return;}
    root.append(el('p','Marca lo que hay que comprar. Las marcas se comparten con tu espacio.','muted'));
    for(const group of groups.values()){
      const row=el('div',undefined,'shopping-item'),label=el('label',undefined,'shopping-check-label'),check=el('input');check.type='checkbox';
      const key=group.name.trim().toLocaleLowerCase('es')+'|'+group.unit;check.checked=checked.has(key);
      check.onchange=async()=>{const value=check.checked;check.disabled=true;try{await rpc('hd_shopping_set',{p_menu_id:menu.id,p_name:group.name,p_unit:group.unit,p_checked:value});if(value)checked.add(key);else checked.delete(key);}catch(error){check.checked=!value;notify('No se ha podido guardar la marca. Actualiza la aplicación y vuelve a intentarlo.',true);}finally{check.disabled=false;}};
      label.append(check,el('span',group.name,'shopping-name'));
      const vals=el('div',undefined,'shopping-amounts');let total=0;for(const q of group.people.values()){vals.append(amountNode(q));total+=q.quantity;} vals.append(el('strong','Total: '+total+' '+group.unit));row.append(label,vals);root.append(row);
    }
  }
  return renderShopping;
};
