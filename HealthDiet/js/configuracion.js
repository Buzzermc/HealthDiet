(()=>{
'use strict';
const KEY='healthdiet.settings.v1', defaults={containers:['pequeño','grande'],colors:{Alba:'#2d7a5a',Pablo:'#1e5fa0'}};
let settings=JSON.parse(JSON.stringify(defaults)),valid=true;
try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(!Array.isArray(saved.containers)||!saved.colors||!saved.containers.every(x=>typeof x==='string')||!['Alba','Pablo'].every(p=>/^#[0-9a-f]{6}$/i.test(saved.colors[p])))throw Error();settings=saved}}catch(e){valid=false}
const $=s=>document.querySelector(s);
function persist(next){try{localStorage.setItem(KEY,JSON.stringify(next));settings=next;$('#settings-status').textContent='Configuración guardada en este navegador.';render();return true}catch(e){$('#settings-status').textContent='No se ha podido guardar la configuración.';return false}}
function render(){
 const list=$('#container-list');list.replaceChildren();
 if(!valid){$('#settings-status').textContent='No se ha podido leer la configuración guardada. No se modificará para evitar pérdidas.';$('#container-add').disabled=true;$('#color-alba').disabled=true;$('#color-pablo').disabled=true;return}
 $('#color-alba').value=settings.colors.Alba;$('#color-pablo').value=settings.colors.Pablo;
 if(!settings.containers.length){let p=document.createElement('p');p.className='muted';p.textContent='No hay tamaños configurados.';list.append(p)}
 settings.containers.forEach(name=>{let row=document.createElement('div');row.className='config-item';let label=document.createElement('span');label.textContent='Táper '+name;let remove=document.createElement('button');remove.type='button';remove.className='quiet';remove.textContent='Quitar';remove.setAttribute('aria-label','Quitar táper '+name);remove.onclick=()=>persist({...settings,containers:settings.containers.filter(x=>x!==name)});row.append(label,remove);list.append(row)});
}
function refreshTuppers(current=''){
 const select=$('#tupper');select.replaceChildren();let placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Sin especificar';select.append(placeholder);
 settings.containers.forEach(name=>{let option=document.createElement('option');option.value=name;option.textContent='Táper '+name;select.append(option)});
 if(current&&!settings.containers.includes(current)){let option=document.createElement('option');option.value=current;option.textContent='Táper '+current+' (ya no configurado)';select.append(option)}
 select.value=current;
}
function chip(person,text){let e=document.createElement('span'),hex=settings.colors[person]||defaults.colors[person],rgb=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16));let luminance=rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0);e.className='person-amount';e.style.backgroundColor=hex;e.style.color=luminance>.179?'#111':'#fff';e.textContent=text;return e}
$('#container-add').onclick=()=>{const input=$('#container-name'),name=input.value.trim().replace(/\s+/g,' ');if(!name){$('#settings-status').textContent='Escribe el tipo o tamaño del táper.';return}if(settings.containers.some(x=>x.toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))){$('#settings-status').textContent='Ese tipo de táper ya existe.';return}if(persist({...settings,containers:[...settings.containers,name]}))input.value=''};
for(const p of ['Alba','Pablo'])$('#color-'+p.toLowerCase()).onchange=e=>persist({...settings,colors:{...settings.colors,[p]:e.target.value}});
window.hdSettings={render,refreshTuppers,chip};render();
})();
