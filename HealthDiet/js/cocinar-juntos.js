/* Vista diaria del menú activo. */
window.hdCreateCooking = ({$, el, makeButton, days, activeMenu, refs, amounts, amountNode, getState, setDay}) => {
  function renderCooking(){
    const {recipes, cookingDay}=getState();
    const root=$('#shared-cooking');root.replaceChildren();const menu=activeMenu();
    if(!menu){root.append(el('p','Activa un menú para ver las recetas.','muted'));return;}
    root.append(el('p',menu.name,'muted'));const bar=el('div',undefined,'day-choices');days.forEach((day,i)=>{const b=makeButton(day.slice(0,2),()=>{setDay(i);renderCooking();});b.setAttribute('aria-label',day);b.setAttribute('aria-pressed',String(i===cookingDay));bar.append(b);});root.append(bar);
    for(const entry of refs(menu,cookingDay)){
      const recipe=recipes.find(r=>r.id===entry.recipe_id);if(!recipe)continue;
      const card=el('details',undefined,'recipe-card cooking-recipe-card');
      const summary=el('summary',undefined,'recipe-card-summary');
      const heading=el('span',undefined,'cooking-card-heading');
      heading.append(el('span',entry.meal,'cooking-meal-label'),el('strong',recipe.name));
      summary.append(heading);
      const chevron=el('span','⌄','recipe-card-chevron');chevron.setAttribute('aria-hidden','true');summary.append(chevron);card.append(summary);
      const detail=el('div',undefined,'recipe-card-detail cooking-recipe-detail');if(recipe.container)detail.append(el('p','Táper: '+recipe.container,'muted'));
      for(const dish of recipe.dishes){
        const section=el('section',undefined,'cooking-dish');
        section.append(el('h4',dish.name,'cooking-dish-name'),el('span','Ingredientes','cooking-section-label cooking-ingredients-label'));
        for(const ingredient of dish.ingredients){
          const row=el('div',undefined,'ingredient cooking-ingredient');row.append(el('span',ingredient.name));
          const vals=el('span',undefined,'cooking-amounts');const a=amounts(ingredient);
          const unit=ingredient.unit==='unidad'?'uds':ingredient.unit;
          const total=el('strong',a.total+unit);total.setAttribute('aria-label','Total: '+a.total+' '+unit);vals.append(total);
          for(const q of a.active)vals.append(amountNode(q,{compact:true,unit}));
          row.append(vals);section.append(row);
        }
        detail.append(section);
      }
      if(recipe.steps.length){const prep=el('section',undefined,'cooking-preparation');prep.append(el('span','Preparación','cooking-section-label cooking-preparation-label'));const ol=el('ol',undefined,'cooking-steps');for(const step of recipe.steps)ol.append(el('li',step));prep.append(ol);detail.append(prep);}card.append(detail);root.append(card);
    }
  }
  return renderCooking;
};
