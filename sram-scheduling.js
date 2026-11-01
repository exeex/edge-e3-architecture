// SPDX-License-Identifier: Apache-2.0
(() => {
  const channels=['Tensor I','Tensor O','Tensor P','WLD','DMA','Reserved 5','Reserved 6','Reserved 7'];
  const route=(channel,phase)=>{
    let row=(channel+phase)%8;
    return [1,2,4].map(distance=>{const from=row,select=Math.floor((phase+row%distance)/distance)%2;if(select)row^=distance;return {from,to:row,select,distance};});
  };
  const sources=[
    ['Product default','src/edge-e3/edge_dtcm_subsys/edge_dtcm_subsys.v','parameter WIDE_H4'],
    ['Bank fabric','src/edge-e3/edge_dtcm_subsys/rtl/edge_dtcm_h4_bank.v','assign phase={q'],
    ['Narrow reorder','src/edge-e3/edge_dtcm_subsys/rtl/edge_dtcm_h4_narrow_reader.v','half_idx'],
    ['Shared client admission','src/edge-e3/edge_dtcm_subsys/rtl/edge_dtcm_subsys_core.v','upper4_pair'],
    ['ACTU / CMPU queues','src/edge-asic/rtl/accel_io/edge_accel_io.v','SRC0_BEATS = 8'],
    ['Tensor bank ownership','src/edge-e3/edge_tensor_unit/rtl/edge_tensor_engine.v','wide_input_bank ='],
    ['WSLD half','src/edge-e3/edge_dtcm_subsys/rtl/edge_wsld_h4.v','parameter HALF = 1'],
    ['DMA half','src/edge-e3/edge_dtcm_subsys/rtl/edge_dma_h4.v','parameter HALF=1'],
    ['Scalar boundary','src/edge-e3/edge_lsu_dtcm_adapter/edge_lsu_dtcm_adapter.v','assign dtcm_req = mem_req;']
  ];
  const txt=(x,y,s,size=16,color='#dce5f2',anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${s}</text>`;
  const box=(x,y,w,h,title,sub,color='#6da8fa')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#172130" stroke="${color}"/>${txt(x+16,y+29,title,18,color)}${txt(x+16,y+53,sub,13,'#9aaabd')}`;
  const wire=(d,color='#64748b',dash=false)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" ${dash?'stroke-dasharray="6 5"':''}/>`;
  function butterfly(phase,channel){
    let s=txt(36,43,'BUTTERFLY / FIXED WIRES, ROTATING OWNERSHIP',22)+txt(36,72,`Teaching model · phase ${phase} / 7 · bank = (channel + phase) mod 8`,14,'#9aaabd');
    const xs=[210,430,650,870],yy=r=>145+r*59;
    ['BANKS','H1 · XOR 1','H2 · XOR 2','H4 · XOR 4'].forEach((t,i)=>s+=txt(xs[i],112,t,13,'#9aaabd','middle'));
    for(let stage=0;stage<3;stage++)for(let r=0;r<8;r++){
      const d=[1,2,4][stage];
      s+=`<path d="M${xs[stage]},${yy(r)} L${xs[stage+1]},${yy(r)} M${xs[stage]},${yy(r)} L${xs[stage+1]},${yy(r^d)}" stroke="#354154" stroke-width="1" fill="none"/>`;
    }
    const steps=route(channel,phase),bank=(channel+phase)%8;
    steps.forEach((r,i)=>s+=`<path d="M${xs[i]},${yy(r.from)} L${xs[i+1]},${yy(r.to)}" stroke="#57d6bd" stroke-width="4" fill="none"/><circle cx="${xs[i+1]}" cy="${yy(r.to)}" r="5" fill="#57d6bd"/>`);
    for(let r=0;r<8;r++){
      s+=txt(160,yy(r)+5,`B${r}`,15,r===bank?'#57d6bd':'#9aaabd','end');
      s+=txt(905,yy(r)+5,`C${r} · ${channels[r]}`,15,r===channel?'#57d6bd':'#9aaabd');
      xs.forEach(x=>s+=`<circle cx="${x}" cy="${yy(r)}" r="3" fill="#9aaabd"/>`);
    }
    s+=txt(36,655,`B${bank} → C${channel} (${channels[channel]})`,20,'#57d6bd');
    s+=txt(36,685,steps.map(r=>`H${r.distance}: ${r.select?'exchange':'straight'} (s=${r.select})`).join('   /   '),14,'#9aaabd');
    s+=txt(36,724,'The boxes stay put. Local mux selections change each cycle; the same clock drives every stage.',14,'#9aaabd');
    return s;
  }
  function services(buffered=false){
    let s=txt(36,43,buffered?'BUFFERED CLIENTS / MATCH BEAT RATE TO CONSUMPTION':'DTCM / TWO SERVICE WIDTHS',22)+txt(36,72,'Current wide schedule · logical service view, not a literal placement or a cycle trace',14,'#9aaabd');
    if(!buffered){
      s+=box(40,130,260,90,'FAST / 256b per cycle','O / P · 8 × FP32 storage', '#efbd69');
      s+=box(40,340,260,90,'SLOW / 128b per cycle','I / O / P · 8 × BF16', '#6da8fa');
      s+=box(400,130,275,90,'Wide group rotation','Four 256-bit group doors','#efbd69');
      s+=box(400,340,275,90,'Local half selection','128-bit beats + response reorder');
      s+=box(790,230,295,105,'DTCM bank fabric','16 × 64-bit banks · 128 KiB');
      s+=wire('M300 175H400','#efbd69')+wire('M675 175H735V260H790','#efbd69')+wire('M300 385H400','#6da8fa')+wire('M675 385H735V305H790','#6da8fa');
      s+=txt(40,490,'One wide beat = two 128-bit halves. Narrow clients use one half at a time.',17);
      s+=txt(40,527,'A four-group tour changes the half selection; indexed buffers restore logical beat order.',15,'#9aaabd');
      s+=txt(40,580,'WIDTH ≠ GUARANTEED THROUGHPUT',14,'#efbd69');
      s+=txt(40,612,'Rates describe service width at a nominal accepted beat. Readiness, address phase and sharing still apply.',14,'#9aaabd');
      s+=txt(40,647,'FP32 here describes the O/P storage container, not the precision of every internal arithmetic stage.',14,'#9aaabd');
      s+=txt(40,705,'Unlike the slide model, current storage uses four dual-port H1 tiles with locally compensated phase mapping.',14,'#9aaabd');
    }else{
      s+=box(40,280,245,90,'128-bit slow service','Phase-qualified beats');
      s+=box(380,140,300,90,'ACTU / CMPU queues','Read reservations + write FIFO','#57d6bd');
      s+=box(380,420,300,90,'LSU request / response','Lane adapter / backpressure','#efbd69');
      s+=box(810,100,245,80,'ACTU','Element stream','#57d6bd');
      s+=box(810,230,245,80,'CMPU','Operand streams','#57d6bd');
      s+=box(810,420,245,90,'LSU','Scalar load / store','#efbd69');
      s+=wire('M285 305H330V185H380','#57d6bd')+wire('M285 345H330V465H380','#efbd69');
      s+=wire('M680 170H740V140H810','#57d6bd')+wire('M680 205H740V270H810','#57d6bd')+wire('M680 465H810','#efbd69');
      s+=txt(40,570,'BUFFERING LAYER',14,'#57d6bd');
      s+=txt(40,606,'Consumers drain buffered beats at their own rate. Queues absorb bursts; they do not create bandwidth.',15,'#9aaabd');
      s+=txt(40,642,'ACTU / CMPU share the accelerator I/O queues. LSU and accelerator requests share local admission.',14,'#9aaabd');
      s+=txt(40,678,'The LSU boundary is a direct ready / response adapter, not another identical accelerator FIFO.',14,'#9aaabd');
      s+=txt(40,714,'Queue capacity, in-flight reservations and dependencies can all stop new requests.',14,'#9aaabd');
    }return s;
  }
  // q = fabric_phase[3:1]; these are logical bank doors, before local H1 compensation.
  function allocation(phase,pWide=true,oWide=true,addrHalf=0){
    const g=phase&3,h=(phase>>2)&1;
    const lane=(id,label,port,half,wide,color)=>{const group=(g+port)&3;return {id,label,group,half,wide,color,banks:Array.from({length:wide?4:2},(_,i)=>4*group+(wide?0:2*half)+i)};};
    return [lane('p','Tensor P',0,addrHalf,pWide,'#efbd69'),lane('o','Tensor O',1,addrHalf,oWide,'#f19b77'),lane('i','Tensor I',2,h,false,'#6da8fa'),lane('wsld','WSLD transport',2,h^1,false,'#57d6bd'),lane('shared','LSU / ACTU / CMPU',3,h,false,'#b39be8'),lane('dma','DMA',3,h^1,false,'#c7cf74')];
  }
  function schedule(phase,pWide=true,oWide=true,addrHalf=0){
    const rows=allocation(phase,pWide,oWide,addrHalf),x=350,w=45,y=218,dy=48;
    let s=txt(36,40,'DTCM / RTL BANK-DOOR ROTATION',22)+txt(36,69,`q = fabric_phase[3:1] = ${phase} · group phase = ${phase&3} · half tour = ${(phase>>2)&1}`,15,'#9aaabd');
    for(let g=0;g<4;g++){
      s+=txt(x+g*4*w+2*w,112,`G${g} / 256b`,16,'#dce5f2','middle');
      for(let h=0;h<2;h++)s+=txt(x+(4*g+2*h+1)*w,141,`H${h} / 128b`,12,'#9aaabd','middle');
    }
    for(let b=0;b<16;b++)s+=txt(x+b*w+w/2,178,`B${b}`,12,'#9aaabd','middle');
    rows.forEach((r,i)=>{
      const yy=y+i*dy;
      s+=txt(36,yy+5,r.label,16,r.color)+txt(36,yy+22,`${r.wide?'256b / H0+H1':'128b / H'+r.half} → G${r.group}`,12,'#9aaabd');
      s+=wire(`M280 ${yy}H${x+16*w}`, '#293447');
      for(let b=0;b<16;b++){
        const on=r.banks.includes(b);
        s+=`<rect x="${x+b*w+2}" y="${yy-15}" width="${w-4}" height="30" fill="${on?r.color:'#172130'}" stroke="${on?r.color:'#354154'}"/>`;
        if(on)s+=txt(x+b*w+w/2,yy+5,'64',12,'#101824','middle');
      }
    });
    s+=txt(36,534,'EIGHT-PHASE TOUR / I and shared half; WSLD and DMA take the complement',13,'#9aaabd');
    for(let q=0;q<8;q++){
      const xx=36+q*135,a=allocation(q,pWide,oWide,addrHalf);
      s+=`<rect x="${xx}" y="551" width="128" height="97" rx="3" fill="#172130" stroke="${q===phase?'#57d6bd':'#354154'}" stroke-width="${q===phase?2:1}"/>`;
      s+=txt(xx+10,573,`q${q} · H${q>>2}`,14,q===phase?'#57d6bd':'#dce5f2');
      s+=txt(xx+10,595,`P:G${a[0].group} O:G${a[1].group}`,12,'#efbd69');
      s+=txt(xx+10,615,`I/W:G${a[2].group}`,12,'#6da8fa')+txt(xx+10,635,`S/D:G${a[4].group}`,12,'#b39be8');
    }
    s+=txt(36,678,'P/O BF16 half comes from request address[1] (64-bit word units), not q[2].',14,'#9aaabd');
    s+=txt(36,705,'Colored cells are eligible bank doors for an aligned beat; request, grant and credit still gate access.',14,'#9aaabd');
    s+=txt(36,732,'Both halves stay owned by P/O even for a narrow beat. H1 physical pair swaps are compensated locally.',14,'#9aaabd');
    return s;
  }
  function render(view='butterfly',phase=0,channel=4,pWide=true,oWide=true,addrHalf=0){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1140 760" role="img" aria-label="SRAM scheduling: ${view}" style="font-family:ui-monospace,monospace"><rect width="1140" height="760" fill="#101824"/>${view==='butterfly'?butterfly(phase,channel):view==='services'?schedule(phase,pWide,oWide,addrHalf):services(true)}</svg>`;}
  window.E3SramScheduling={channels,route,sources,allocation,render};
})();
