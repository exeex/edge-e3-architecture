// SPDX-License-Identifier: Apache-2.0
// Proxy the original controls so their handlers, URL state and highlighting stay unified.
(() => {
 const dock=document.querySelector('#chapter-mode-dock');
 const groups={
  workbench:[['MODE','#workbench .modes','target']],
  'tensor-pipeline':[['PATH','#tensor-steps'],['CONFIG','#tensor-mode-groups']],
  'actu-pipeline':[['MODE','#actu-modes']],
  'execution-model':[['TRACE','#trace-events','trace-kind'],['WAIT','#wait-buttons']],
  'sram-scheduling':[['VIEW','#sram-views'],['PHASE','#sram-phases']]
 };
 let bindings=[];
 let chapter=document.querySelector('#chapter-directory [aria-current]')?.hash.slice(1)||'workbench';
 function sync(){
  const phaseRow=dock.querySelector('[data-dock-kind=PHASE]');if(phaseRow)phaseRow.hidden=document.querySelector('#sram-phase-controls').hidden;
  for(const {original,proxy,select} of bindings){
   if(select){proxy.value=original.value;continue;}
   proxy.setAttribute('aria-pressed',original.getAttribute('aria-pressed')||'false');proxy.disabled=original.disabled;
  }
 }
 function refresh(){
  const scrolls=[...dock.querySelectorAll('.dock-buttons')].map(row=>row.scrollLeft);
  dock.replaceChildren();bindings=[];
  for(const [index,[label,selector,selectId]] of (groups[chapter]||[]).entries()){
   const source=document.querySelector(selector);if(!source)continue;
   const row=document.createElement('div');row.className='dock-row';row.dataset.dockKind=label;
   const name=document.createElement('span');name.className='dock-label';name.textContent=label;row.append(name);
   const strip=document.createElement('div');strip.className='dock-buttons';strip.setAttribute('role','group');strip.setAttribute('aria-label',`${chapter} ${label.toLowerCase()}`);
   const originals=[...source.querySelectorAll('button')];
   originals.forEach((original,i)=>{
    const proxy=document.createElement('button');proxy.type='button';proxy.textContent=original.textContent;
    proxy.dataset.original=`${index}:${i}`;
    proxy.setAttribute('aria-pressed',original.getAttribute('aria-pressed')||'false');
    const family=original.closest('.tensor-mode-family')?.querySelector('span')?.textContent;
    if(family){proxy.title=`${family}: ${original.textContent}`;proxy.setAttribute('aria-label',proxy.title);}
    proxy.disabled=original.disabled;
    proxy.addEventListener('click',()=>original.click());bindings.push({original,proxy});strip.append(proxy);
   });row.append(strip);
   if(selectId){
    const original=document.getElementById(selectId),select=original.cloneNode(true);select.removeAttribute('id');select.value=original.value;
    select.setAttribute('aria-label',selectId==='target'?'Join target':'Trace workload');select.dataset.original=`${index}:select`;
    select.addEventListener('change',()=>{original.value=select.value;original.dispatchEvent(new Event('change',{bubbles:true}));});row.append(select);bindings.push({original,proxy:select,select:true});
   }
   dock.append(row);strip.scrollLeft=scrolls[index]||0;
  }
  sync();
 }
 for(const [id,rows] of Object.entries(groups))for(const [,selector,selectId] of rows){
  const source=document.querySelector(selector);if(!source)continue;
  source.setAttribute('data-dock-source','');
  new MutationObserver(records=>{if(chapter===id){if(records.some(record=>record.type==='childList'))refresh();else sync();}}).observe(source,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','disabled']});
  if(selectId){const input=document.getElementById(selectId);input.closest('label')?.setAttribute('data-dock-source','');input.addEventListener('change',()=>{if(chapter===id)sync();});}
 }
 document.addEventListener('atlas:chapterchange',event=>{chapter=event.detail.id;refresh();});
 document.documentElement.classList.add('has-chapter-dock');refresh();
})();
