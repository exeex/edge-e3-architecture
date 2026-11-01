/* SPDX-License-Identifier: Apache-2.0 */
(() => {
  'use strict';
  const model = window.E3Architecture;
  const guide = window.E3Guide;
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = s => document.querySelector(s);
  const drawing = $('#drawing');
  drawing.innerHTML = model.render();
  const svg = drawing.querySelector('svg');
  const threads = ['tensor','dma','actu','cmpu'];
  const names = {tensor:'Tensor',dma:'DMA',actu:'ACTU',cmpu:'CMPU'};
  let mode = 'all', target = 'tensor', selected = 'issue', zoom = 1, timer = null;
  const steps = ['setup','start','overlap','sync','done'];
  let guideIndex = null;
  function saveView() {
    const url = new URL(location.href);
    url.searchParams.set('mode',mode);url.searchParams.set('target',target);url.searchParams.set('node',selected);
    if(guideIndex===null)url.searchParams.delete('step');else url.searchParams.set('step',String(guideIndex+1));
    try { history.replaceState(null,'',url); } catch { /* Local file previews may restrict history. */ }
  }
  function nodeActive(node) {
    if(mode==='all') return true;
    if(threads.includes(node.id)) return mode==='overlap' || node.id===target && node.modes.includes(mode);
    return node.modes.includes(mode);
  }
  function edgeActive(edge) {
    return mode==='all' || edge.modes.includes(mode) && (!edge.target || mode==='overlap' || edge.target===target);
  }
  function timeline() {
    const block = (start,span,text,kind,focusModes) => `<span class="time-block ${kind} ${focusModes.includes(mode)?'is-focus':''}" style="grid-column:${start+2}/span ${span}">${text}</span>`;
    const running = ['overlap','sync'];
    // Relative slots describe ordering and overlap, never measured clock cycles.
    $('#timeline').innerHTML = `<div class="time-head"><span>ORDER →</span>${Array.from({length:12},(_,i)=>`<span>${i+1}</span>`).join('')}</div>
      <div class="time-row"><span class="row-label">RV32 / EX</span>${block(0,2,'set_*','', ['setup'])}${block(2,1,'start','run',['start'])}${block(3,3,'scalar work','run',['overlap'])}${block(6,3,'sync · WAIT','wait',['sync'])}${block(9,3,'resume','run',['done'])}</div>
      <div class="time-row"><span class="row-label">${names[target]}</span>${block(2,1,'accept','',['start'])}${block(3,6,'independent hardware work','run',running)}${block(9,3,'drained','',['done'])}</div>
      <div class="time-row"><span class="row-label">Other ASIC</span>${block(4,8,'other accepted work may continue','run',running)}</div>`;
  }
  function inspect(id) {
    const n = model.nodes.find(n=>n.id===id);
    if(!n) return;
    selected = id;
    svg.querySelectorAll('[data-node]').forEach(el=>el.classList.toggle('selected',el.dataset.node===id));
    $('#inspect-more').hidden=!['tensor','actu'].includes(id);
    $('#inspect-more').href=id==='actu'?'#actu-pipeline':'#tensor-pipeline';
    $('#inspect-more').textContent=id==='actu'?'Explore the ACTU architecture ↓':'Explore the Tensor pipeline ↓';
    $('#inspect-title').textContent=n.title;
    $('#inspect-body').textContent=n.detail;
    $('#inspect-meta').replaceChildren(...n.tags.map(tag=>{const el=document.createElement('span');el.textContent=tag;return el;}));
    const incoming = model.edges.filter(e=>e.to===id), outgoing = model.edges.filter(e=>e.from===id);
    const signals = edges => [...new Set(edges.map(e=>e.label ? e.label[2] : model.nodes.find(n=>n.id===(e.to===id?e.from:e.to)).title))].join('; ') || 'See RTL interface.';
    const contract = guide.contracts[id] || [signals(incoming),signals(outgoing),'Transfers follow the owning unit’s request/response or stage-admission rules. See the linked RTL.'];
    $('#inspect-contract').innerHTML=['INPUTS','OUTPUTS','OWNERSHIP / COMPLETION'].map((title,i)=>`<dt>${title}</dt><dd>${esc(contract[i])}</dd>`).join('');
    saveView();
    // Relative source links also work when this project is opened from file://.
    $('#inspect-source').href='../../'+n.source;
    $('#inspect-source').title=n.source;
    $('#inspect-source').textContent=n.source.split('/').pop()+' ↗';
  }
  function update(nextMode=mode) {
    mode=nextMode;
    $('#cache-details').hidden=mode!=='cache';
    $('#play').hidden=mode==='cache';
    svg.classList.toggle('cache-view',mode==='cache');
    const scenario=model.modes[mode];
    $('#mode-number').textContent=scenario.number.replace(/^\d+\s*\/\s*/, 'MODE / ');
    $('#mode-title').textContent=scenario.title;
    $('#mode-description').textContent=scenario.body;
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    svg.classList.toggle('tracing',mode!=='all');
    model.nodes.forEach(n=>$('#node-'+n.id).classList.toggle('active',nodeActive(n)));
    model.edges.forEach(e=>{
      const el=svg.querySelector(`[data-edge="${e.id}"]`);
      el.classList.toggle('active',edgeActive(e));
      el.classList.toggle('flow',mode==='overlap'&&e.kind==='memory');
    });
    threads.forEach(id=>{
      const status=svg.querySelector(`[data-status="${id}"]`);
      status.textContent=mode==='all'?'INDEPENDENT ENGINE':mode==='overlap'?'RUNNING':id!==target?'':({setup:'CONFIGURE',start:'ACCEPT / LAUNCH',sync:'RUNNING · JOIN PENDING',done:'DRAINED'})[mode]||'';
    });
    $('#ex-hold').setAttribute('visibility',mode==='sync'?'visible':'hidden');
    $('#join-target-label').textContent=mode==='sync'?`WAITING FOR ${names[target].toUpperCase()}`:mode==='done'?`${names[target].toUpperCase()} DRAINED → EX RELEASE`:'';
    timeline();
    saveView();
  }
  function stop() {
    clearInterval(timer);timer=null;
    $('#play').textContent='▶ Play sequence';$('#play').setAttribute('aria-pressed','false');
  }
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{stop();clearGuide();update(b.dataset.mode);}));
  $('#target').addEventListener('change',event=>{clearGuide();target=event.target.value;update();if(threads.includes(selected))inspect(target);});
  $('#play').addEventListener('click',()=>{
    if(timer){stop();return;}
    clearGuide();let index=0;update(steps[index]);
    $('#play').textContent='Ⅱ Pause';$('#play').setAttribute('aria-pressed','true');
    timer=setInterval(()=>{index+=1;if(index>=steps.length){stop();return;}update(steps[index]);},2400);
  });
  function selectNode(event) {
    const el=event.target.closest('[data-node]');
    if(el)inspect(el.dataset.node);
  }
  svg.addEventListener('click',selectNode);
  svg.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectNode(event);}});
  function theme(light) {
    document.documentElement.dataset.theme=light?'light':'dark';
    svg.dataset.theme=light?'light':'dark';
    $('#theme').textContent=light?'Dark':'Light';
    $('#theme').setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');
  }
  $('#theme').addEventListener('click',()=>theme(document.documentElement.dataset.theme!=='light'));
  function setZoom(value) {
    zoom=Math.max(.25,Math.min(2.5,value));
    drawing.style.width=(zoom*100)+'%';
    drawing.style.minWidth=(980*zoom)+'px';
    $('#zoom-label').textContent=Math.round(zoom*100)+'%';
  }
  $('#zoom-in').addEventListener('click',()=>setZoom(zoom+.15));
  $('#zoom-out').addEventListener('click',()=>setZoom(zoom-.15));
  $('#fit').addEventListener('click',()=>{setZoom(Math.min(1,$('#viewport').clientWidth/980));$('#viewport').scrollTo(0,0);});
  let drag=null;
  const viewport=$('#viewport');
  viewport.addEventListener('pointerdown',event=>{
    if(!event.shiftKey||event.button!==0)return;
    event.preventDefault();
    drag={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    viewport.setPointerCapture(event.pointerId);viewport.classList.add('panning');
  });
  viewport.addEventListener('pointermove',event=>{if(drag){viewport.scrollLeft=drag.left+drag.x-event.clientX;viewport.scrollTop=drag.top+drag.y-event.clientY;}});
  function endDrag(){drag=null;viewport.classList.remove('panning');}
  viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);
  $('#export').addEventListener('click',()=>{
    const clone=svg.cloneNode(true);
    clone.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
    clone.querySelectorAll('.flow').forEach(el=>el.classList.remove('flow'));
    const blob=new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n',new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`edge-e3-${mode}-${target}.svg`;document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function clearGuide() {
    guideIndex=null;
    document.querySelectorAll('[data-guide]').forEach(b=>b.setAttribute('aria-pressed','false'));
    document.querySelectorAll('.code-line').forEach(line=>line.classList.remove('is-current'));
    $('#guide-count').textContent='SOURCE REFERENCE · SELECT A STEP TO FOLLOW';
  }
  function renderGuide(index,activate=true) {
    const step=guide.steps[index];
    $('#guide-count').textContent=`STEP ${index+1} / ${guide.steps.length}`;
    $('#guide-title').textContent=step.title;$('#guide-body').textContent=step.body;
    $('#guide-state').innerHTML=`<div class="guide-state-row"><b>SCALAR</b>${esc(step.scalar)}</div><div class="guide-state-row"><b>ENGINE</b>${esc(step.engine)}</div>`;
    document.querySelectorAll('[data-guide]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.guide===index && activate)));
    document.querySelectorAll('.code-line').forEach(line=>line.classList.toggle('is-current',activate && step.lines.includes(+line.dataset.line)));
    $('#guide-prev').disabled=index===0;$('#guide-next').disabled=index===guide.steps.length-1;
    $('#guide-prev').onclick=()=>renderGuide(index-1);$('#guide-next').onclick=()=>renderGuide(index+1);
    if(activate){stop();guideIndex=index;target=step.target;$('#target').value=target;update(step.mode);inspect(step.node);}
  }
  $('#program-code').innerHTML=guide.code.map(([line,code])=>`<span class="code-line" data-line="${line||''}"><span class="line-number">${line||'…'}</span>${esc(code)}</span>`).join('');
  $('#guide-steps').innerHTML=guide.steps.map((step,i)=>`<button data-guide="${i}" aria-pressed="false">${String(i+1).padStart(2,'0')} ${esc(step.short)}</button>`).join('');
  document.querySelectorAll('[data-guide]').forEach(b=>b.addEventListener('click',()=>renderGuide(+b.dataset.guide)));
  function renderWait(index) {
    const item=guide.waits[index];
    document.querySelectorAll('[data-wait]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.wait===index)));
    $('#wait-detail').innerHTML=`<div class="wait-grid"><div><h4>WHAT WAITS</h4><p>${esc(item.hold)}</p></div><div><h4>WHAT KEEPS RUNNING</h4><p>${esc(item.progress)}</p></div><div><h4>WHAT RELEASES IT</h4><p>${esc(item.release)}</p></div></div><div class="wait-actions"><button id="show-wait">Show on diagram ↑</button><a href="../../${item.source}">Read the owning RTL ↗</a></div>`;
    $('#show-wait').onclick=()=>{stop();clearGuide();update(item.mode);inspect(item.node);$('#workbench').scrollIntoView({block:'start'});};
  }
  $('#wait-buttons').innerHTML=guide.waits.map((item,i)=>`<button data-wait="${i}" aria-pressed="false">${esc(item.title)}</button>`).join('');
  document.querySelectorAll('[data-wait]').forEach(b=>b.addEventListener('click',()=>renderWait(+b.dataset.wait)));
  $('#share').addEventListener('click',async()=>{
    saveView();
    try { await navigator.clipboard.writeText(location.href);$('#share-status').textContent='View link copied.'; }
    catch { $('#share-status').textContent='Copy the current address from your browser to share this view.'; }
  });
  window.E3Atlas = {
    showTraceEvent(event) {
      stop();clearGuide();target=threads.includes(event.target)?event.target:'actu';$('#target').value=target;
      update(event.mode);inspect(event.node);
    }
  };
  // Validate incoming state before using it in the model or DOM.
  const params=new URL(location.href).searchParams;
  if(Object.hasOwn(model.modes,params.get('mode')))mode=params.get('mode');
  if(threads.includes(params.get('target')))target=params.get('target');
  if(model.nodes.some(n=>n.id===params.get('node')))selected=params.get('node');
  $('#target').value=target;
  renderGuide(0,false);renderWait(0);
  const initialStep=params.get('step');
  if(initialStep && /^[1-6]$/.test(initialStep)){renderGuide(+initialStep-1);if(model.nodes.some(n=>n.id===params.get('node')))inspect(params.get('node'));}
  else {clearGuide();inspect(selected);update();}

})();
