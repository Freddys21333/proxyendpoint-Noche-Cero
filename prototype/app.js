const $ = selector => document.querySelector(selector);
const form = $('#form');
const fields = ['populationSize','days','beta','initialInfectious','vaccines','interventionDay','vaccineEfficacy','repetitions','rootSeed','closureStart','closureEnd'];
let config, preview, result, timer;
const colors = { S:'#35a775', E:'#e8b348', I:'#dd6655', R:'#588dbb' };
const layerColors = { household:'#2e937a',school:'#6579b9',bus:'#c68c50',market:'#b573aa',neighborhood:'#9aa9a2' };
const ns = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, parent) { const el=document.createElementNS(ns,tag); for(const [key,val] of Object.entries(attrs)) el.setAttribute(key,String(val)); parent.append(el); return el; }
function read() { const values=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,fields.includes(k)?Number(v):v])); return values; }
function write(values) { for(const [key,value] of Object.entries(values)) if(form.elements[key]) form.elements[key].value=value; }
function message(value,error=false) { $('#message').textContent=value; $('#message').classList.toggle('error',error); }
async function request(path, body) { const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await response.json(); if(!response.ok) throw Error(data.error||'Error del servicio'); return data; }
function positions(nodes) { const n=nodes.length; return nodes.map((node,i)=>{ const angle=2*Math.PI*i/n, radius=155+38*Math.sin(i*2.4); return {x:380+radius*Math.cos(angle),y:235+radius*Math.sin(angle)}; }); }
function renderGraph() {
  const graph=preview?.graph; if(!graph) return;
  const frame=result?.representative[$('#policy').value].frames[Number($('#day').value)];
  const displayIds=new Set(graph.nodes.slice(0,120).map(n=>n.id));
  const coords=positions(graph.nodes.slice(0,120));
  const root=$('#graph'); root.replaceChildren();
  const layer=$('#layer').value;
  const edgeGroup=svg('g',{},root), nodeGroup=svg('g',{},root);
  let drawn=0;
  for(const edge of graph.edges) {
    if(!displayIds.has(edge.u)||!displayIds.has(edge.v)|| (layer!=='all'&&edge.context!==layer)) continue;
    if(edge.context==='market' && edge.id%7!==0) continue;
    if(edge.context==='bus' && edge.id%3!==0) continue;
    const a=coords[edge.u],b=coords[edge.v];
    svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:layerColors[edge.context],'stroke-width':edge.context==='household'?1.25:.7,opacity:layer==='all'?.18:.47},edgeGroup); drawn++;
  }
  for(const node of graph.nodes.slice(0,120)) { const p=coords[node.id], state=frame?.[node.id]|| (preview.initial.includes(node.id)?'I':'S'); const circle=svg('circle',{cx:p.x,cy:p.y,r:frame&&state==='I'?6:4.5,fill:colors[state],stroke:'#fff','stroke-width':1.2},nodeGroup); svg('title',{},circle).textContent=`Persona ${node.id} · ${state} · hogar ${node.household}`; }
  $('#graph-count').textContent=`${graph.nodes.length} personas · ${graph.edges.length} conexiones · ${drawn} visibles`;
  $('#day-label').textContent=`Día ${$('#day').value}`;
  $('#graph-overlay').textContent=result?`Réplica 0 · ${$('#policy').selectedOptions[0].textContent}`:'Paciente cero en rojo · vista previa';
}
function drawChart() {
  const root=$('#chart'); root.replaceChildren(); if(!result) return;
  const max=Math.max(1,...Object.values(result.curves).flatMap(rows=>rows.map(row=>row.cumulativeInfected)));
  const x=d=>50+680*d/result.configuration.days, y=v=>220-185*v/max;
  for(let tick=0;tick<=4;tick++){const val=max*tick/4, yy=y(val);svg('line',{x1:50,y1:yy,x2:730,y2:yy,stroke:'#e3ebe6'},root);const t=svg('text',{x:8,y:yy+4,fill:'#83938b','font-size':11},root);t.textContent=Math.round(val);}
  const palette={none:'#d46e5f',random:'#d1a14b',targeted:'#177d68'};
  for(const policy of ['none','random','targeted']) {const rows=result.curves[policy], points=rows.map(row=>`${x(row.day)},${y(row.cumulativeInfected)}`).join(' ');svg('polyline',{points,fill:'none',stroke:palette[policy],'stroke-width':3,'stroke-linejoin':'round'},root);}
  const labels=[['Sin intervención',palette.none],['Al azar',palette.random],['Estratégica',palette.targeted]];labels.forEach(([label,color],i)=>{svg('line',{x1:65+i*205,y1:243,x2:85+i*205,y2:243,stroke:color,'stroke-width':3},root);const t=svg('text',{x:91+i*205,y:247,fill:'#536963','font-size':11},root);t.textContent=label;});
}
function fmt(value){return Number(value).toLocaleString('es-EC',{maximumFractionDigits:1});}
function renderResult() {
  const labels={none:'Sin intervención',random:'Vacunación al azar',targeted:'Vacunación estratégica'};
  $('#metrics').replaceChildren();
  for(const policy of ['none','random','targeted']) { const box=document.createElement('div');box.className='metric';const title=document.createElement('strong'),value=document.createElement('b'),foot=document.createElement('small');title.textContent=labels[policy];value.textContent=fmt(result.summary[policy].mean);foot.textContent=`infectados promedio · P05 ${fmt(result.summary[policy].p05)} / P95 ${fmt(result.summary[policy].p95)}`;box.append(title,value,foot);$('#metrics').append(box); }
  const saved=result.summary.none.mean-result.summary.targeted.mean;
  $('#detail').replaceChildren();const p=document.createElement('p');p.textContent=`Menor media: ${labels[result.winner]}. Vacunación estratégica evita ${fmt(saved)} infecciones en promedio frente a no intervenir; su diferencia media frente al azar es ${fmt(result.gain.mean)}. Los valores negativos indican que fue peor.`;$('#detail').append(p);
  const p2=document.createElement('p');p2.textContent=`Red fija, ${result.configuration.repetitions} réplicas, semilla ${result.configuration.rootSeed}. El cierre de capa, si está activo, se aplica a las tres políticas. Estas cifras son exploratorias.`;$('#detail').append(p2);
  $('#day').max=result.configuration.days;$('#day').value=0;$('#download').disabled=false;renderGraph();drawChart();
}
async function refreshPreview() { config=read(); preview=await request('/api/preview',config); result=null;$('#download').disabled=true;$('#metrics').replaceChildren();$('#chart').replaceChildren();$('#detail').replaceChildren();$('#day').value=0;$('#day').max=config.days;renderGraph();message('Vista previa lista. Ejecuta la comparación para ver las curvas y animar los estados.'); }
async function run() { clearInterval(timer);config=read();message('Calculando réplicas y políticas…');$('#form button[type=submit]').disabled=true;try{preview=await request('/api/preview',config);result=await request('/api/compare',config);renderResult();message(`Comparación terminada: ${config.repetitions} réplicas y tres políticas.`);}catch(error){message(error.message,true);}finally{$('#form button[type=submit]').disabled=false;} }
form.addEventListener('submit',event=>{event.preventDefault();run();});
form.addEventListener('change',async()=>{clearInterval(timer);try{await refreshPreview();}catch(error){message(error.message,true);}});
$('#reset').addEventListener('click',async()=>{write(defaults);await refreshPreview();});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{const c=read();switch(button.dataset.preset){case 'double_beta':c.beta=Math.min(1,c.beta*2);break;case 'half_vaccines':c.vaccines=Math.floor(c.vaccines/2);break;case 'market_origin':c.origin='market';break;case 'partial_efficacy_50':c.vaccineEfficacy=.5;break;}write(c);run();}));
$('#layer').addEventListener('change',renderGraph);$('#policy').addEventListener('change',renderGraph);$('#day').addEventListener('input',renderGraph);
$('#play').addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;$('#play').textContent='▶';return;}if(!result)return;$('#play').textContent='Ⅱ';timer=setInterval(()=>{const slider=$('#day');slider.value=Number(slider.value)>=Number(slider.max)?0:Number(slider.value)+1;renderGraph();},190);});
$('#download').addEventListener('click',()=>{if(!result)return;const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`manta-prototipo-${config.rootSeed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
try{const response=await fetch('/api/config');const data=await response.json();write(data.defaults);await refreshPreview();}catch(error){message(`No se pudo conectar al servicio: ${error.message}`,true);}
