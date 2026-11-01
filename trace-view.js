/* SPDX-License-Identifier: Apache-2.0 */
(() => {
  'use strict';
  const fixtures={actu:window.E3MeasuredTrace,tensor:window.E3TensorMeasuredTrace};
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hex=value=>'0x'+value.toString(16).padStart(8,'0');
  let data,begin,span=128,cursor,anchor,selectedEvent=0;
  const internals=()=>data.target!=='tensor'||$('#trace-internals').checked;
  const valueAt=(runs,cycle)=>(runs||[]).find(([a,b])=>a<=cycle&&cycle<b)?.[2]??0;
  const runs=id=>data.channels.find(item=>item.id===id)?.runs||data.state?.[id]||[];
  const bit=id=>valueAt(runs(id),cursor);
  function sample(){
    cursor=Math.max(begin,Math.min(begin+span-1,cursor));
    $('#trace-cursor').value=String(cursor);$('#trace-cycle').textContent=String(cursor);
    const owned=bit('ex_valid');
    const ex=owned?`EX PC ${hex(valueAt(data.ex_pc,cursor))}, instruction ${hex(valueAt(data.ex_inst,cursor))}`:'EX empty';
    const state=data.target==='tensor'?`DMA ${bit('dma_busy')?'busy':'idle'} · WLD ${bit('wld_active')?'loading':'idle'} · Tensor active ${bit('tensor_busy')}${internals()?` · tensor_start accepted ${bit('start_command')} · internal bank ${bit('weight_valid')?(bit('active_bank')?'B':'A'):'invalid'} · Compute input valid ${bit('compute_issue')} · O write ${bit('output_write')} · write tail ${bit('write_tail')}`:''}`:`ACTU ${bit('actu_busy')?'busy':'idle'} · WB commit ${bit('wb_commit')}`;
    $('#trace-sample').textContent=`Cycle ${cursor} · ${ex} · ${state} · ${data.target==='tensor'?'tensor_sync waiting':'sync waiting'} ${bit('sync_wait')}`;
    const line=$('#trace-cursor-line');
    if(line){const x=210+(cursor-begin)/span*940;line.setAttribute('x1',x);line.setAttribute('x2',x);}
  }
  function color(id){
    if(id==='sync_wait')return 'is-wait';
    if(['active_a','fill_a'].includes(id))return 'is-bank-a';
    if(['active_b','fill_b'].includes(id))return 'is-bank-b';
    if(id.startsWith('wld'))return 'is-wld';
    if(['actu_busy','dma_write','compute_issue'].includes(id))return 'is-engine';
    return '';
  }
  function render(){
    span=$('#trace-span').value==='all'?data.end-data.begin:Math.min(+$('#trace-span').value,data.end-data.begin);
    begin=Math.max(data.begin,Math.min(data.end-span,begin));
    const end=begin+span,x=cycle=>210+(cycle-begin)/span*940;
    const visible=data.channels.filter(channel=>internals()||channel.group!=='internal');
    const groups=[];let rowY=39,lastGroup;const layout=visible.map(item=>{
      if(item.group&&item.group!==lastGroup){groups.push({group:item.group,y:rowY+10});rowY+=20;lastGroup=item.group;}
      const y=rowY;rowY+=34;return {item,y};
    });
    const bottom=rowY+11,height=bottom+32;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1180 ${height}" role="img" aria-label="Measured ${data.target.toUpperCase()} RTL signals from cycle ${begin} through ${end-1}"><title>Observed RTL signals; true intervals are colored</title>`;
    for(let i=0;i<=4;i++){const cycle=begin+Math.round(span*i/4),px=x(cycle);svg+=`<line class="trace-grid" x1="${px}" x2="${px}" y1="26" y2="${bottom}"/><text class="trace-tick" x="${px}" y="16" text-anchor="middle">${cycle}</text>`;}
    const groupNames={activity:'Hardware activity',software:'Software instruction interface',internal:'Internal hardware signals'};
    for(const group of groups)svg+=`<text class="trace-group-label" x="12" y="${group.y}">${groupNames[group.group]}</text>`;
    layout.forEach(({item,y})=>{
      svg+=`<text class="trace-row-label" x="195" y="${y+13}" text-anchor="end">${esc(item.label)}</text><line class="trace-baseline" x1="210" x2="1150" y1="${y+21}" y2="${y+21}"/>`;
      for(const [a,b,value] of item.runs){if(!value||b<=begin||a>=end)continue;
        const left=x(Math.max(a,begin)),right=x(Math.min(b,end));
        svg+=`<rect class="trace-high ${color(item.id)}" x="${left}" y="${y}" width="${Math.max(.8,right-left)}" height="21"><title>${esc(item.label)}: cycles ${a}–${b-1}</title></rect>`;
      }
    });
    for(const event of data.events){if(!internals()&&event.group==='internal')continue;if(event.cycle<begin||event.cycle>=end)continue;const px=x(event.cycle);svg+=`<path class="trace-event-marker" d="M${px} 26V${bottom}"><title>${esc(event.label)} at cycle ${event.cycle}</title></path>`;}
    svg+=`<line id="trace-cursor-line" class="trace-cursor-line" x1="210" x2="210" y1="26" y2="${bottom}"/></svg>`;
    $('#trace-chart').innerHTML=svg;$('#trace-window').textContent=`${begin}–${end-1}`;
    $('#trace-cursor').min=String(begin);$('#trace-cursor').max=String(end-1);
    $('#trace-back').disabled=begin<=data.begin;$('#trace-forward').disabled=end>=data.end;
    sample();
  }
  function showAt(event,focusArchitecture){
    anchor=event.cycle;begin=anchor-16;cursor=anchor;render();
    if(focusArchitecture){window.E3Atlas.showTraceEvent({...event,target:data.target});if(data.target==='tensor')window.E3TensorExplorer?.select(event.tensorPhase);}
  }
  function choose(index,focusArchitecture){
    selectedEvent=index;$('#trace-command-note').textContent='';
    document.querySelectorAll('[data-trace-event]').forEach(button=>button.setAttribute('aria-pressed',String(+button.dataset.traceEvent===index)));
    $('#trace-job').value='';showAt(data.events[index],focusArchitecture);
  }
  function eventButtons(){
    $('#trace-events').innerHTML=data.events.map((event,i)=>({event,i})).filter(({event})=>internals()||event.group!=='internal').map(({event,i})=>`<button data-trace-event="${i}" aria-pressed="${i===selectedEvent}">${esc(event.label)} · ${event.cycle}</button>`).join('');
    document.querySelectorAll('[data-trace-event]').forEach(button=>button.addEventListener('click',()=>choose(+button.dataset.traceEvent,true)));
  }
  const names={1:'DMA start',2:'DMA sync',16:'Tensor setcsr',17:'Tensor WLD',18:'Tensor setin',19:'Tensor setout',20:'Tensor setpsum',21:'tensor_start',22:'tensor_sync',23:'Tensor setn',24:'Tensor WLD-T',27:'Tensor WLD circular',28:'Tensor WLD-T circular',32:'ACTU setcsr',33:'ACTU setin',34:'ACTU setout',35:'ACTU setn',37:'ACTU start',38:'ACTU sync'};
  function load(kind,focusArchitecture=false){
    data=fixtures[kind];
    if(!data){$('#trace-chart').textContent='Trace fixture unavailable. Run the corresponding example with --publish-trace.';return;}
    $('#trace-kind').value=kind;
    $('#trace-title').textContent=data.title||'See scalar progress while ACTU runs.';
    $('#trace-description').textContent=data.description||'A measured run of example/fork_join/fork_join.cpp: launch ACTU sigmoid on 4,096 BF16 zeros, perform 32 scalar increments, join, then verify every output is 0.5. Actual simulation cycles are independent of the illustrative story above.';
    $('#trace-kind-label').textContent=kind==='tensor'?'64 × 64 × 128-token matmul · numerically checked':'ACTU fork / join · self-checking example';
    $('#trace-reproduce').textContent=data.provenance.reproduction;
    $('#trace-readme').href=kind==='tensor'?'../../example/tensor/TRACE.md':'../../example/fork_join/README.md';
    $('#trace-internals').checked=false;$('#trace-internals-label').hidden=kind!=='tensor';$('#trace-wld-note').hidden=kind!=='tensor';
    $('#trace-job-label').hidden=kind!=='tensor';$('#trace-downloads').hidden=kind!=='tensor';
    $('#trace-job').innerHTML='<option value="">Choose a software start…</option>'+(data.starts||[]).map((start,i)=>`<option value="${i}">tensor_start #${start.index} · ${start.cycle}</option>`).join('');
    if(kind==='tensor'){
      const w=data.wld_explanation;
      $('#trace-wld-note').textContent=`Why is WLD short? One 8 × 8 INT8 weight tile is ${w.tile_bytes} bytes: ${w.reads_per_tile} accepted ${w.read_bits}-bit reads. Complete WLD loading lasts ${w.min_cycles}–${w.max_cycles} cycles in this capture, then those weights are reused for ${w.vectors_per_start} input vectors per tensor_start. WLD does not remain active while weights are used. The whole capture spans ${data.end-data.begin} cycles, so loads look thin; select WLD tile loading with a 128-cycle window. Internal read/complete lanes are single-cycle pulses. Compute input valid is internal, not a software instruction.`;
    }
    const m=data.metrics;
    const cards=data.metric_cards||[[m.scalar_commits_while_busy_before_join,'scalar commits while ACTU busy, before sync'],[m.sync_wait_cycles,'cycles with sync retaining EX, not ready'],[m.start_to_sync_completion,'cycles from start acceptance to sync transfer']];
    $('#trace-metrics').innerHTML=cards.map(([number,label])=>`<div><b>${number.toLocaleString('en-US')}</b><span>${esc(label)}</span></div>`).join('');
    eventButtons();
    $('#trace-commands').innerHTML='<div class="trace-table-wrap"><table><caption>Observed ASIC command handshakes</caption><thead><tr><th>Cycle</th><th>Command</th><th>Instruction word</th><th>Captured GPR parameter</th></tr></thead><tbody>'+data.commands.map(item=>`<tr><td>${item.cycle}</td><td>${names[(parseInt(item.inst,16)>>>25)&127]||'ASIC command'}</td><td><code>0x${item.inst}</code></td><td><code>0x${item.capture}</code></td></tr>`).join('')+'</tbody></table></div>';
    $('#trace-overlap-evidence').innerHTML=kind==='tensor'?`<h3>Measured overlap in this capture</h3><p>Exact simultaneous accepted-transfer cycles: DMA SRAM write + Compute input valid <b>${m.dma_compute_cycles}</b>; WLD read + Compute input valid <b>${m.wld_compute_cycles}</b>; O write + Compute input valid <b>${m.write_compute_cycles}</b>. WLD active overlapped compute-job occupancy for ${m.wld_while_compute_busy} cycles. EX Tensor sync waited ${m.sync_wait_cycles} cycles. These are different definitions; busy is not a transfer.</p><p>This standalone example has 64 circular slots, enough for all 64 weight tiles. DMA finishes early; sustained later overlap is WLD, alternating A/B, compute and O writes. It is not evidence of continuous DMA activity throughout the kernel.</p>`:'';
    const p=data.provenance;
    $('#trace-provenance').innerHTML=`<p>${esc(data.sampling)}</p><p>${esc(data.derived)}</p><p><b>Simulator report</b></p><pre>${esc(p.report)}</pre><p><b>Tools</b><br>${esc(p.verilator)}<br>${esc(p.compiler)}</p><p><b>Repository base revision</b><br><code>${esc(p.parent_revision)}</code></p><p>The observer is a workspace addition. File hashes identify exact inputs; the base revision alone does not describe workspace additions.</p><dl>${Object.entries(p.submodules).map(([name,rev])=>`<dt>${esc(name)}</dt><dd><code>${esc(rev)}</code></dd>`).join('')}</dl><details><summary>Source and artifact SHA-256</summary><dl>${Object.entries(p.source_sha256).map(([file,hash])=>`<dt>${esc(file)}</dt><dd><code>${esc(hash)}</code></dd>`).join('')}<dt>Raw CSV</dt><dd><code>${esc(p.csv_sha256)}</code></dd><dt>ELF</dt><dd><code>${esc(p.elf_sha256)}</code></dd></dl></details>`;
    choose(0,focusArchitecture);
    const url=new URL(location.href);url.searchParams.set('trace',kind);try{history.replaceState(null,'',url);}catch{/* File previews may restrict history. */}
  }
  $('#trace-kind').addEventListener('change',event=>load(event.target.value,true));
  $('#trace-span').addEventListener('change',()=>{begin=anchor-16;render();});
  $('#trace-back').addEventListener('click',()=>{begin-=span;cursor=begin;render();});
  $('#trace-forward').addEventListener('click',()=>{begin+=span;cursor=begin;render();});
  $('#trace-cursor').addEventListener('input',event=>{cursor=+event.target.value;sample();});
  $('#trace-internals').addEventListener('change',()=>{eventButtons();render();});
  $('#trace-job').addEventListener('change',event=>{
    const start=data.starts?.[+event.target.value];if(event.target.value===''||!start)return;
    selectedEvent=null;document.querySelectorAll('[data-trace-event]').forEach(button=>button.setAttribute('aria-pressed','false'));
    showAt({cycle:start.cycle,mode:'start',node:'tensor',tensorPhase:0},true);
    $('#trace-command-note').textContent=`Software tensor_start #${start.index} accepted at cycle ${start.cycle}; its internal compute job launches at cycle ${start.launch_cycle}. One command processes 128 input vectors in this example.`;
  });
  load(new URL(location.href).searchParams.get('trace')==='tensor'?'tensor':'actu');
})();
