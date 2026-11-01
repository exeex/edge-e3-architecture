/* SPDX-License-Identifier: Apache-2.0 */
(() => {
  const model=window.E3ActuPipeline,$=s=>document.querySelector(s);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $('#actu-modes').innerHTML=[['all','Overview'],...model.modes.map(m=>[m.id,m.label])].map(([id,label])=>`<button data-actu-mode="${id}" aria-pressed="false">${esc(label)}</button>`).join('');
  function select(id,persist=true){
    const mode=model.modes.find(m=>m.id===id);
    $('#actu-drawing').innerHTML=model.render(mode?.id);
    $('#actu-mode-code').textContent=mode?`MODE ${mode.code} / ${mode.label.toUpperCase()}`:'SHARED DATAPATH / ALL MODES';
    $('#actu-mode-title').textContent=mode?.formula||'One EXP frontend. One shared nonlinear backend.';
    $('#actu-mode-body').textContent=mode?.body||'Read the green numerator route beside the amber divisor / reciprocal route. The frontend prepares the exponential and N/D candidates; the backend inverts D and aligns N and the original payload for result composition. SiLU multiply and tanh sign restoration are separate branches, followed by result selection and common BF16 conversion. Select a mode to reveal the paths that contribute to its result.';
    $('#actu-mode-note').textContent=mode?.note||'The two halves are functional responsibilities, not two clock stages. Both N and D are formed in the frontend; the back half computes the denominator inverse. Muted arithmetic may still run: highlighting describes result selection, not clock gating.';
    $('#actu-formula').textContent=mode?.e||'Shared exp · sign-aware numerator · reciprocal / rsqrt';
    $('#actu-values').innerHTML=[['NUMERATOR N',mode?.n||'1 / e / 1−e / stored e'],['DIVISOR D',mode?.d||'1+e / x / x+epsilon / S'],['RESULT',mode?.result||'direct e / direct r / N×r / x×N×r']].map(([k,v])=>`<div><span>${k}</span><strong>${esc(v)}</strong></div>`).join('');
    $('#actu-mode-sources').innerHTML=(mode?.evidence||['core','frontend','backend','final','rounding','sum']).map(key=>{const s=model.sources[key];return `<a href="../../${esc(s.path)}#L${s.line}" title="${esc(s.path)}:${s.line}">${esc(s.path.split('/').pop())}:${s.line} ↗</a>`;}).join('');
    $('#actu-next-pass').hidden=!mode?.next;
    if(mode?.next){$('#actu-next-pass').textContent=mode.next==='normalize'?'Follow pass 2 · Normalize →':'← Return to pass 1 · Exp + Sum';$('#actu-next-pass').onclick=()=>select(mode.next);}
    document.querySelectorAll('[data-actu-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.actuMode===(mode?.id||'all'))));
    $('#actu-png').href=`exports/edge-e3-actu-${mode?.id||'overview'}.png`;
    if(persist){const url=new URL(location.href);url.searchParams.set('actu',mode?.id||'all');try{history.replaceState(null,'',url);}catch{/* File previews may restrict history. */}}
  }
  document.querySelectorAll('[data-actu-mode]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.actuMode)));
  $('#actu-fit').addEventListener('click',()=>{const fit=$('#actu-drawing').classList.toggle('is-fitted');$('#actu-fit').setAttribute('aria-pressed',String(fit));$('#actu-fit').textContent=fit?'Expand labels':'Fit whole path';});
  $('#actu-demo-path').addEventListener('click',()=>{select('sigmoid');window.E3Atlas.showTraceEvent({target:'actu',mode:'overlap',node:'actu'});});
  $('#actu-demo-code').innerHTML=model.code.map(([line,text])=>`<span class="code-line"><span class="line-number">${line}</span>${esc(text)}</span>`).join('');
  const initial=new URL(location.href).searchParams.get('actu');select(initial,false);
})();
