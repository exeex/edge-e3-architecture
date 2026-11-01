// SPDX-License-Identifier: Apache-2.0
(() => {
 const m=window.E3SramScheduling;let view='butterfly',phase=0,channel=4;
 const draw=document.querySelector('#sram-drawing'),controls=document.querySelector('#sram-phase-controls');
 const pFormat=document.querySelector('#sram-p-format'),oFormat=document.querySelector('#sram-o-format'),half=document.querySelector('#sram-address-half');
 function update(){
  const pWide=pFormat.value==='fp32',oWide=oFormat.value==='fp32',addrHalf=+half.value;
  draw.innerHTML=m.render(view,phase,channel,pWide,oWide,addrHalf);controls.hidden=view==='buffered';
  document.querySelector('#sram-channel-label').hidden=view!=='butterfly';
  document.querySelector('#sram-formats').hidden=view!=='services';
  document.querySelectorAll('[data-sram-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sramView===view)));
  document.querySelectorAll('[data-sram-phase]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.sramPhase===phase)));
  document.querySelector('#sram-mapping').textContent=view==='services'?m.allocation(phase,pWide,oWide,addrHalf).map(r=>`${r.label}: B${r.banks.join('/B')}`).join(' · '):m.channels.map((c,i)=>`C${i} ${c} → B${(i+phase)%8}`).join(' · ');
  document.querySelector('#sram-png').href=`exports/edge-e3-sram-${view==='butterfly'?'phase-'+phase:view==='services'?`services-${pFormat.value}-${oFormat.value}-h${addrHalf}-phase-${phase}`:view}.png`;
  document.querySelector('#sram-png-note').textContent=view==='services'?'PNG matches this phase, P/O format and address-half selection.':'Teaching phase PNGs highlight DMA; all channels are selectable here.';
 }
 document.querySelectorAll('[data-sram-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.sramView;update();}));
 document.querySelector('#sram-phases').innerHTML=Array.from({length:8},(_,i)=>`<button data-sram-phase="${i}" aria-pressed="${i===phase}">${i}</button>`).join('');
 document.querySelectorAll('[data-sram-phase]').forEach(b=>b.addEventListener('click',()=>{phase=+b.dataset.sramPhase;update();}));
 const select=document.querySelector('#sram-channel');select.innerHTML=m.channels.map((c,i)=>`<option value="${i}" ${i===4?'selected':''}>C${i} · ${c}</option>`).join('');select.addEventListener('change',()=>{channel=+select.value;update();});
 for(const input of [pFormat,oFormat,half])input.addEventListener('change',update);
 document.querySelector('#sram-sources').innerHTML=m.sources.map(([label,path])=>`<a href="../../${path}">${label} RTL ↗</a>`).join(' · ');
 update();
})();
