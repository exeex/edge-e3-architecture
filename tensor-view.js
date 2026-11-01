/* SPDX-License-Identifier: Apache-2.0 */
(() => {
  const model=window.E3TensorPipeline, $=selector=>document.querySelector(selector);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('#tensor-drawing').innerHTML=model.render();
  $('#tensor-steps').innerHTML='<button data-tensor-phase="-1" aria-pressed="false">Overview</button>'+model.phases.map((phase,i)=>`<button data-tensor-phase="${i}" aria-pressed="false">${i+1}. ${esc(phase.short)}</button>`).join('');
  $('#tensor-mode-groups').innerHTML=model.families.map(family=>`<div class="tensor-mode-family"><span>${esc(family)}</span><div>${model.modes.filter(m=>m.family===family).map(m=>`<button data-tensor-mode="${m.id}" aria-pressed="false">${esc(m.label)}</button>`).join('')}</div></div>`).join('');
  function display(view){
    document.querySelectorAll('[data-tensor-node]').forEach(node=>node.classList.toggle('is-active',view.active.includes(node.dataset.tensorNode)));
    document.querySelectorAll('[data-tensor-path]').forEach(path=>path.classList.toggle('is-active',view.paths.includes(path.dataset.tensorPath)));
    $('#tensor-step-title').textContent=view.title;$('#tensor-step-body').textContent=view.body;$('#tensor-step-wait').textContent=view.wait||view.note;
    $('#tensor-control-origin').textContent=view.control||'Mechanism view · different control families are shown together.';
    $('#tensor-step-sources').innerHTML='<p class="control-label">RTL / RUNTIME EVIDENCE</p>'+view.evidence.map(key=>{const source=model.sources[key];return `<a href="../../${esc(source.path)}#L${source.line}" title="${esc(source.path)}:${source.line}">${esc(source.path.split('/').pop())}:${source.line} ↗</a>`;}).join('');
  }
  function saveMode(id){const url=new URL(location.href);if(id)url.searchParams.set('tensorMode',id);else url.searchParams.delete('tensorMode');try{history.replaceState(null,'',url);}catch{/* File previews may restrict history. */}}
  function select(index,persist=true){
    const phase=index<0?{title:'One descriptor, independent numerical choices',body:'RV32 registers provide captured parameters to the Tensor descriptor owner. WLD preserves packed weight codes until typecast at each dot-local ingress, then fills BF16 A/B cells. Separate selectors govern P, dot-local RSUM, scale decoding, scale delivery and output format.',wait:'Inspect a mechanism above or one configuration family below. Each mode button highlights one dependency, not a combined runnable configuration. setcsr dtype/wtype, START options and WSLD stype are distinct control sources.',active:model.nodes.map(n=>n[0]),paths:model.paths.map(p=>p[0]),evidence:['csr','intrinsic','weights','local','scale_api']}:model.phases[index];
    document.querySelectorAll('[data-tensor-phase]').forEach(button=>button.setAttribute('aria-pressed',String(+button.dataset.tensorPhase===index)));
    document.querySelectorAll('[data-tensor-mode]').forEach(button=>button.setAttribute('aria-pressed','false'));
    display(phase);$('#tensor-step-number').textContent=index<0?'FULL FUNCTIONAL VIEW':`MECHANISM ${index+1} / ${model.phases.length}`;
    $('#tensor-prev').disabled=index<0;$('#tensor-next').disabled=index===model.phases.length-1;
    $('#tensor-prev').onclick=()=>select(index-1);$('#tensor-next').onclick=()=>select(index+1);
    $('#tensor-png').href='exports/edge-e3-tensor-pipeline.png';
    if(persist)saveMode(null);
  }
  function selectMode(id,persist=true){
    const mode=model.modes.find(m=>m.id===id);if(!mode)return;
    document.querySelectorAll('[data-tensor-phase]').forEach(button=>button.setAttribute('aria-pressed','false'));
    document.querySelectorAll('[data-tensor-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tensorMode===id)));
    display(mode);$('#tensor-step-number').textContent=`CONFIGURATION / ${mode.family.toUpperCase()}`;
    const i=model.modes.indexOf(mode);$('#tensor-prev').disabled=i===0;$('#tensor-next').disabled=i===model.modes.length-1;
    $('#tensor-prev').onclick=()=>selectMode(model.modes[i-1].id);$('#tensor-next').onclick=()=>selectMode(model.modes[i+1].id);
    $('#tensor-png').href=`exports/edge-e3-tensor-${mode.id}.png`;
    if(persist)saveMode(id);
  }
  document.querySelectorAll('[data-tensor-phase]').forEach(button=>button.addEventListener('click',()=>select(+button.dataset.tensorPhase)));
  document.querySelectorAll('[data-tensor-mode]').forEach(button=>button.addEventListener('click',()=>selectMode(button.dataset.tensorMode)));
  document.querySelectorAll('[data-tensor-node]').forEach(node=>{
    const focus=()=>{
      const id=node.dataset.tensorNode;
      const mode=model.modes.find(m=>m.active.includes(id)&&(['w-','s-'].some(prefix=>id.startsWith(prefix))||['rsum','zero','psum-hold','scale-hold','scale-fifo'].includes(id)));
      if(mode)selectMode(mode.id);else select(model.phases.findIndex(phase=>phase.active.includes(id)));
    };
    node.addEventListener('click',focus);node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();focus();}});
  });
  $('#tensor-slide-map').innerHTML=model.slides.map(slide=>`<article><strong>Chapter ${slide.chapter} · slides ${esc(slide.pages)}</strong><p>${esc(slide.title)}</p></article>`).join('');
  $('#tensor-fit').addEventListener('click',()=>{const fitted=$('#tensor-drawing').classList.toggle('is-fitted');$('#tensor-fit').setAttribute('aria-pressed',String(fitted));$('#tensor-fit').textContent=fitted?'Expand labels':'Fit whole path';});
  window.E3TensorExplorer={select:index=>{if(Number.isInteger(index)&&index>=-1&&index<model.phases.length)select(index);},selectMode};
  const initial=new URL(location.href).searchParams.get('tensorMode');
  if(model.modes.some(m=>m.id===initial))selectMode(initial,false);else select(-1,false);
})();
