/* Vista diaria del menú activo. */
window.hdCreateCooking = ({$, el, makeButton, days, activeMenu, refs, amounts, amountNode, getState, setDay}) => {
  function renderCooking(){
    const {recipes, cookingDay}=getState();
    const root=$('#shared-cooking');root.replaceChildren();const menu=activeMenu();
    if(!menu){root.append(el('p','Activa un menú para ver las recetas.','muted'));return;}
    root.append(el('p',menu.name,'muted'));const bar=el('div',undefined,'day-choices');days.forEach((day,i)=>{const b=makeButton(day.slice(0,3),()=>{setDay(i);renderCooking();});b.setAttribute('aria-label',day);b.setAttribute('aria-pressed',String(i===cookingDay));bar.append(b);});root.append(bar);
    for(const entry of refs(menu,cookingDay)){
      const recipe=recipes.find(r=>r.id===entry.recipe_id);if(!recipe)continue;
      const card=el('details',undefined,'recipe-card cooking-recipe-card');
      const summary=el('summary',undefined,'recipe-card-summary');
      summary.append(el('strong',entry.meal.toUpperCase()+' · '+recipe.name));
      const chevron=el('span','⌄','recipe-card-chevron');chevron.setAttribute('aria-hidden','true');summary.append(chevron);card.append(summary);
      const detail=el('div',undefined,'recipe-card-detail cooking-recipe-detail');if(recipe.container)detail.append(el('p','Táper: '+recipe.container,'muted'));
      for(const dish of recipe.dishes){detail.append(el('h4',dish.name));for(const ingredient of dish.ingredients){const row=el('div',undefined,'ingredient');row.append(el('span',ingredient.name));const vals=el('span');const a=amounts(ingredient);for(const q of a.active)vals.append(amountNode(q),document.createTextNode(' '));vals.append(el('strong','Total: '+a.total+' '+ingredient.unit));row.append(vals);detail.append(row);}}
      if(recipe.steps.length){detail.append(el('strong','Preparación'));const ol=el('ol');for(const step of recipe.steps)ol.append(el('li',step));detail.append(ol);}card.append(detail);root.append(card);
    }
  }
  return renderCooking;
};
