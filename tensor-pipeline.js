/* SPDX-License-Identifier: Apache-2.0 */
// Source-derived functional paths. The phases below are not clock cycles.
(() => {
  const base='src/edge-e3/edge_tensor_unit/';
  const sources={
    unit:{path:base+'edge_tensor_unit.v',line:400,token:'assign tensor_sync_stall'},
    admission:{path:base+'edge_tensor_unit.v',line:464,token:'assign start_wait_accept'},
    banks:{path:base+'rtl/edge_tensor_weight_banks.v',line:58,token:'assign weight_start_ready_o'},
    weights:{path:base+'rtl/weight/edge_tensor_weights.v',line:14,token:'edge_wld_fixed_group_buffer'},
    local:{path:base+'rtl/compute/edge_dot8_weight_bank.v',line:94,token:'reg [15:0] bank0_q,bank1_q;'},
    engine:{path:base+'rtl/edge_tensor_engine.v',line:913,token:'assign input_compute_fire'},
    drain:{path:base+'rtl/edge_tensor_engine.v',line:1007,token:'assign drain_done_next'},
    dot:{path:base+'rtl/edge_tensor_datapath.v',line:56,token:'for(dot=0;dot<8;dot=dot+1)'},
    post:{path:base+'rtl/compute/edge_tensor_scale_psum8.v',line:92,token:'edge_psum x_scaled_add'},
    ring:{path:'src/edge-e3/edge_core/rtl/edge_accel_data_ctrl.v',line:166,token:'wire circular_ring_full'},
    platform:{path:'src/edge-e3/edge_dtcm_subsys/edge_dtcm_subsys.v',line:17,token:'parameter WIDE_H4 = SRAM_H4'},
    runtime:{path:'src/edge-nnc/cpp/libnn/matmul.hpp',line:51,token:'EDGE_TENSOR_START_LAST_TILE'},
    intrinsic:{path:'src/edge-32/include/edge32_intrinsic.hpp',line:77,token:'#define EDGE_TENSOR_START_FIRST_TILE'}
  };
  Object.assign(sources,{"csr": {"path": "src/edge-e3/edge_tensor_unit/edge_tensor_unit.v", "token": "cfg_dtype_q[cfg_write_sel_q] <= cmd_setcsr_dtype", "line": 987}, "psum_modes": {"path": "src/edge-e3/edge_tensor_unit/rtl/edge_tensor_engine.v", "token": "assign psum_target_count =", "line": 963}, "start_modes": {"path": "src/edge-e3/edge_tensor_unit/rtl/edge_tensor_engine.v", "token": "scale_enable_q <= start_mode[0]", "line": 1271}, "rsum": {"path": "src/edge-asic/rtl/tensor/edge_dot_kernel.v", "token": "assign rsum_base_bits =", "line": 623}, "scale_decode": {"path": "src/edge-e3/edge_dtcm_subsys/rtl/edge_wsld_slot_reader.v", "token": "if(stype_q==3)combined=decode_scale16", "line": 118}, "scale_api": {"path": "src/edge-32/include/edge32_intrinsic.hpp", "token": "enum EdgeTensorScaleType", "line": 739}, "scale_buffers": {"path": "src/edge-e3/edge_tensor_unit/edge_tensor_unit.v", "token": "reg  [127:0]                  scale_buf_q", "line": 153}, "scale_wide": {"path": "src/edge-e3/edge_dtcm_subsys/rtl/edge_dtcm_subsys_core.v", "token": ".SCALE_BF20(1)", "line": 565}});
  sources.weight_format={path:base+'rtl/edge_tensor_wld_tile.v',line:44,token:'wire [2:0] weight_format ='};
  const slides=[
    {chapter:2,pages:'31–34',title:'Tile/vector math, partial sums and I/P/O streams'},
    {chapter:2,pages:'36–37, 41–42',title:'Circular slots and DMA/WLD transpose responsibilities'},
    {chapter:2,pages:'44–46',title:'A/B weight ownership, full datapath and three-way overlap'},
    {chapter:3,pages:'49–54',title:'GEMM tiling, Tensor work descriptors and scalar lookahead'}
  ];
  const phases=[
    {title:'Describe a tile job',short:'Descriptor',active:['owner'],paths:[],body:'Scalar configures input, output, partial-sum and vector count. Start snapshots a stable descriptor. The Tensor owner can accept direct work, queue a younger descriptor, or retain it while its weights are still loading; acceptance is distinct from compute launch.',wait:'Configuration and start admission are capacity/readiness checks. This diagram does not assume the older slide command queue is instantiated on the maintained Edge32 path.',evidence:['unit','admission']},
    {title:'Fill bounded SRAM slots',short:'DMA / ring',active:['dma','ring'],paths:['dma-ring'],body:'Strided DMA arranges source fragments into SRAM tile slots. The producer reserves capacity and publishes completed entries; circular WLD waits for a complete readable entry. Full rings stop new producer reservations; empty rings stop the consumer.',wait:'A ring slot is released through the hardware consumer-completion path. SRAM ring capacity and the two local weight banks are separate buffers with separate ownership.',evidence:['ring']},
    {title:'Prepare the inactive weight bank',short:'WLD / A–B',active:['ring','wld','banks'],paths:['ring-wld','wld-banks','weights'],body:'WLD reads a tile; WLD-T changes its load direction. Packed transport is staged, then weights are promoted locally to BF16 and shifted into dot-local cells. One physical bank supplies active weights while the other is filled or pending activation.',wait:'weight_start_ready_o blocks replacement of an unconsumed pending bank. Weight activation and descriptor readiness govern handoff; double buffering alone does not guarantee a bubble-free switch.',evidence:['weights','local','banks']},
    {title:'Admit one input vector (internal)',short:'Compute input',active:['owner','input','window','dot','banks'],paths:['input-window','window-dot','weights','owner-dot'],body:'The input window captures and reorders memory responses, including younger-work prefetch. input_compute_fire admits a vector only with a valid input, required scale/psum readiness and reserved output capacity. Eight parallel dot kernels each reduce eight products against one weight row.',wait:'The logical 8 × 8 tile performs 64 products per admitted vector. This is an eight-dot backend, not a literal nearest-neighbor systolic array or a promise of one vector every clock.',evidence:['engine','dot']},
    {title:'Scale, accumulate and drain output',short:'Post / output',active:['dot','post','sld','psum','output'],paths:['dot-post','scale','psum-post','post-output','writeback'],body:'Dot results enter the post pipeline. Optional SLD scale is applied before the partial-sum add; NO_PSUM selects zero, PSUM_ONCE reuses a captured vector, and stream mode consumes a matching P vector. Results retain their addresses and format in the output queue until memory accepts their writes.',wait:'The current tiled BF16 matmul runtime keeps intermediate partial sums in 32-bit storage and writes BF16 on its last tile. Its FIRST / PSUM / LAST / SINGLE modes refine the older slide excerpt.',evidence:['post','engine','runtime','intrinsic']},
    {title:'Handoff work, then join the drain',short:'Handoff / sync',active:['owner','banks','window','output'],paths:['owner-dot','writeback'],body:'A queued descriptor may take over after the engine handoff condition, while older results still drain with their own metadata. Final drain additionally checks input/psum state, outstanding result metadata, output queues and the physical write tail.',wait:'tensor_sync_stall covers engine activity and pending starts, weight/scale work and other Tensor-owned operations. Tensor sync is target-scoped; DMA has its own completion condition and join.',evidence:['drain','unit','ring']}
  ];
  const nodes=[
    ['gpr',40,40,240,90,'RV32 Registers','captured GPR parameters'],
    ['owner',350,40,650,100,'Tensor descriptor / control owner','CSR dtype / wtype · START options · WSLD config'],
    ['dma',40,270,210,60,'Strided DMA','external → SRAM'],
    ['ring',40,390,210,70,'SRAM circular slots','producer / consumer credits'],
    ['wld',310,390,180,70,'WLD / WLD-T','packed data + type tag'],
    ['w-bf16',600,290,180,55,'BF16 pass','wtype 1 → format 0'],
    ['w-int8',600,370,180,55,'INT8 → BF16','wtype 2 → format 1'],
    ['w-e4m3',600,450,180,55,'E4M3FN → BF16','wtype 3 → format 2'],
    ['w-fp4',600,530,180,55,'E2M1 → BF16','wtype 4 → format 3'],
    ['w-e5m2',600,610,180,55,'E5M2 → BF16','wtype 5 → format 4'],
    ['wselect',840,290,80,375,'Weight','typecast'],
    ['banks',980,440,210,90,'Local weight A / B','BF16 cells · active / fill'],
    ['input',40,910,250,80,'I · input reads','SRAM responses'],
    ['window',360,910,220,80,'Input window','order · validity · prefetch'],
    ['dot',980,910,210,80,'8 × dot8','64 products / vector'],
    ['rsum',980,1130,210,70,'RSUM accumulator','inside each dot kernel'],
    ['sld',1240,280,190,65,'SLD / WSLD reads','packed scale codes'],
    ['s-bf16',1510,260,180,60,'BF16 scale','stype 0 · 16-bit'],
    ['s-mx',1510,350,180,60,'MXFP4 scale','stype 1 · E8M0'],
    ['s-nv',1510,440,180,60,'NVFP4 scale','stype 2 · E4M3 × global'],
    ['s-fp16',1510,530,180,60,'FP16 → BF20','stype 3 · exact expand'],
    ['stype',1750,260,80,330,'Scale','decode'],
    ['scale-hold',1650,660,210,60,'Held scale vector','SLD static / reuse'],
    ['scale-fifo',1650,760,210,60,'Scale FIFO','SLD_STREAM / circular'],
    ['scale-source',1425,660,80,180,'Scale','source'],
    ['scale-mul',1370,910,190,80,'Dot × scale','BF22 × BF20 wide path'],
    ['scale-select',1610,890,60,170,'Scale','enable'],
    ['post',1740,910,160,80,'+ P','aligned partial sum'],
    ['psum',1240,1160,180,70,'P · SRAM reads','per vector / once'],
    ['zero',1240,1080,180,55,'Zero','NO_PSUM'],
    ['psum-hold',1240,1260,180,70,'P vector hold','PSUM_ONCE'],
    ['psum-select',1540,1060,80,280,'P','select'],
    ['format',1970,910,150,80,'Output format','BF16 / FP32 container'],
    ['output',2170,910,100,80,'O queue','write drain']
  ];
  const paths=[
    ['gpr-owner','M280 85H350','data'],
    ['ctrl-wld','M430 250V280H280V580H400V610','control'],
    ['ctrl-weight','M500 250V300H880V510','control'],
    ['ctrl-psum','M850 250V340H20V1260H1580V1280','control'],
    ['ctrl-rsum','M920 250V360H1205V1320H1085V1350','control'],
    ['ctrl-scale','M990 250V380H1225V850H1465V880','control'],
    ['ctrl-enable','M1060 250V400H1930V1080H1640V1110','control'],
    ['ctrl-stype','M1550 250V450H1790V480','control'],
    ['ctrl-format','M570 250V320H2220V1090H2010V1130','control'],
    ['owner-dot','M1180 250V440H1235V1100H1085V1130','control'],
    ['dma-ring','M145 330V390','data'],['ring-wld','M250 425H310','weight'],
    ['weights','M1020 530V910','weight'],
    ['input-window','M290 950H360','data'],['window-dot','M580 950H980','data'],
    ['dot-post','M1190 950H1370','data'],['scale-product','M1560 950H1610','optional'],
    ['scale-bypass','M1085 990V1020H1610','data'],
    ['scaled-to-post','M1670 950H1740','data'],
    ['post-output','M1900 950H1970','data'],['format-output','M2120 950H2170','data'],
    ['rsum-merge','M1190 975H1215V1165H1190','psum'],
    ['rsum-output','M1085 1200V1370H2040V990','psum'],
    ['static-scale','M1650 690H1505','optional'],
    ['stream-scale','M1650 790H1505','optional'],
    ['scale','M1465 840V910','optional'],
    ['sld-static','M1830 425H1900V690H1860','optional'],
    ['sld-stream','M1830 425H1920V790H1860','optional'],
    ['zero-p','M1420 1107.5H1540','psum'],
    ['read-hold','M1330 1230V1260','psum'],['hold-p','M1420 1295H1540','psum'],
    ['stream-p','M1420 1195H1540','psum'],['psum-post','M1620 1190H1830V990','psum'],
    ['writeback','M2220 990V1440H180V1320','psum']
  ];
  const weightKeys=['bf16','int8','e4m3','fp4','e5m2'];
  weightKeys.forEach((key,i)=>{
    const y=317+i*80;
    paths.push(['wld-'+key,`M490 425H550V${y}H600`,'weight']);
    paths.push(['cast-'+key,`M780 ${y}H840`,'weight']);
  });
  paths.push(['wld-banks','M920 477H950V485H980','weight']);
  ['bf16','mx','nv','fp16'].forEach((key,i)=>{
    const y=290+i*90;
    paths.push(['sld-'+key,`M1430 312H1470V${y}H1510`,'optional']);
    paths.push(['decode-'+key,`M1690 ${y}H1750`,'optional']);
  });
  // Keep a dedicated header for CSR, START and WSLD. All data geometry is
  // below it; controls drop through outer corridors into top-facing ports.
  nodes.forEach(node=>{if(!['gpr','owner'].includes(node[0]))node[2]+=220;});
  function points(d){
    const result=[];let x=0,y=0;
    for(const m of d.matchAll(/([MLHV])(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g)){
      if(m[1]==='M'||m[1]==='L'){x=+m[2];y=+m[3];}else if(m[1]==='H')x=+m[2];else y=+m[2];
      result.push([x,y]);
    }
    return result;
  }
  function pathFrom(points){return points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join('');}
  paths.forEach(path=>{if(path[2]!=='control'&&path[0]!=='gpr-owner')path[1]=pathFrom(points(path[1]).map(([x,y])=>[x,y+220]));});
  nodes.push(['csr-fields',350,180,300,70,'CSR fields','dtype / wtype'],
             ['start-fields',800,180,400,70,'START options','P / RSUM / scale / tile output'],
             ['wsld-fields',1350,180,400,70,'WSLD config','stype / scales / groups']);
  paths.push(['owner-csr','M500 140V180','control'],
             ['owner-start','M700 140V160H1000V180','control'],
             ['owner-wsld','M900 140V150H1550V180','control'],
             ['ctrl-tile-format','M1130 250V420H2250V1110H2070V1130','control']);
  const controlGroups=[
    {node:'csr-fields',feed:'owner-csr',routes:['ctrl-wld','ctrl-weight','ctrl-format']},
    {node:'start-fields',feed:'owner-start',routes:['ctrl-psum','ctrl-rsum','ctrl-scale','ctrl-enable','ctrl-tile-format','owner-dot']},
    {node:'wsld-fields',feed:'owner-wsld',routes:['ctrl-stype']}
  ];
  // Preserve data wires at crossings; interrupt only the dashed control wire.
  function controlPath(d){
    const route=points(d),segments=[];
    const other=paths.filter(p=>p[2]!=='control').flatMap(p=>{const pts=points(p[1]);return pts.slice(1).map((b,i)=>[pts[i],b]);});
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],vertical=a[0]===b[0];
      const axis=vertical?1:0,fixed=vertical?0:1,delta=b[axis]-a[axis],direction=Math.sign(delta),length=Math.abs(delta);
      const cuts=[];
      for(const [c,e] of other){
        if((c[0]===e[0])===vertical)continue;
        const cross=e[axis],t=(cross-a[axis])*direction;
        if(t>6&&t<length-6&&a[fixed]>Math.min(c[fixed],e[fixed])+1&&a[fixed]<Math.max(c[fixed],e[fixed])-1)cuts.push(t);
      }
      cuts.sort((a,b)=>a-b);let cursor=0;
      const emit=(lo,hi)=>{if(hi<=lo)return;const p=[...a],q=[...a];p[axis]+=direction*lo;q[axis]+=direction*hi;segments.push(`M${p[0]} ${p[1]}L${q[0]} ${q[1]}`);};
      for(const cut of cuts){emit(cursor,cut-5);cursor=Math.max(cursor,cut+5);}emit(cursor,length);
    }
    return segments.join('');
  }
  const phaseViews=[
    {active:['gpr','owner'],paths:['gpr-owner','ctrl-wld','ctrl-weight','ctrl-psum','ctrl-rsum','ctrl-scale','ctrl-enable','ctrl-stype','ctrl-format','owner-dot']},
    {active:['dma','ring'],paths:['dma-ring']},
    {active:['ring','wld','wselect','banks',...weightKeys.map(k=>'w-'+k)],paths:['ring-wld','wld-banks','ctrl-wld','ctrl-weight',...weightKeys.flatMap(k=>['wld-'+k,'cast-'+k])]},
    {active:['owner','input','window','dot','banks'],paths:['input-window','window-dot','weights','owner-dot']},
    {active:['dot','post','sld','psum','zero','psum-hold','psum-select','scale-mul','scale-select','scale-source','scale-hold','scale-fifo','stype','s-bf16','s-mx','s-nv','s-fp16','format','output'],paths:['dot-post','scale-product','scale-bypass','scaled-to-post','post-output','format-output','scale','static-scale','stream-scale','sld-static','sld-stream','zero-p','read-hold','hold-p','stream-p','psum-post','writeback',...['bf16','mx','nv','fp16'].flatMap(k=>['sld-'+k,'decode-'+k])]},
    {active:['owner','banks','window','format','output'],paths:['owner-dot','format-output','writeback']}
  ];
  phases.forEach((phase,i)=>Object.assign(phase,phaseViews[i]));
  const modes=[];
  const add=(id,family,label,control,active,route,body,note,evidence)=>modes.push({id,family,label,control,active,paths:route,body,note,evidence,title:label});
  const feed=['gpr','owner','ring','wld','wselect','banks'];
  const feedPaths=['gpr-owner','ring-wld','wld-banks','ctrl-wld','ctrl-weight'];
  add('weight-bf16','Weight ingress','BF16','CSR wtype=1 → transport format=0',[...feed,'w-bf16'],[...feedPaths,'wld-bf16','cast-bf16'],"BF16 words pass through unchanged.",'WLD preserves the packed numeric format through transport. Typecast occurs at each dot-local ingress before the final A/B cells; wtype and transport format use different encodings.',['weights','weight_format','local','csr']);
  add('weight-int8','Weight ingress','INT8','CSR wtype=2 → transport format=1',[...feed,'w-int8'],[...feedPaths,'wld-int8','cast-int8'],"Signed INT8 values are promoted exactly to BF16.",'WLD preserves the packed numeric format through transport. Typecast occurs at each dot-local ingress before the final A/B cells; wtype and transport format use different encodings.',['weights','weight_format','local','csr']);
  add('weight-e4m3','Weight ingress','FP8 E4M3FN','CSR wtype=3 → transport format=2',[...feed,'w-e4m3'],[...feedPaths,'wld-e4m3','cast-e4m3'],"E4M3FN codes are decoded at the dot-local weight ingress.",'WLD preserves the packed numeric format through transport. Typecast occurs at each dot-local ingress before the final A/B cells; wtype and transport format use different encodings.',['weights','weight_format','local','csr']);
  add('weight-fp4','Weight ingress','FP4 E2M1','CSR wtype=4 → transport format=3',[...feed,'w-fp4'],[...feedPaths,'wld-fp4','cast-fp4'],"Packed four-bit E2M1 values are promoted to BF16 local cells.",'WLD preserves the packed numeric format through transport. Typecast occurs at each dot-local ingress before the final A/B cells; wtype and transport format use different encodings.',['weights','weight_format','local','csr']);
  add('weight-e5m2','Weight ingress','FP8 E5M2','CSR wtype=5 → transport format=4',[...feed,'w-e5m2'],[...feedPaths,'wld-e5m2','cast-e5m2'],"E5M2 codes are decoded at the dot-local weight ingress.",'WLD preserves the packed numeric format through transport. Typecast occurs at each dot-local ingress before the final A/B cells; wtype and transport format use different encodings.',['weights','weight_format','local','csr']);
  const compute=['gpr','owner','input','window','banks','dot','scale-select','post','format','output'];
  const computePaths=['gpr-owner','owner-dot','input-window','window-dot','weights','scale-bypass','scaled-to-post','post-output','format-output','ctrl-format'];
  add('psum-stream','Partial sum','P stream','START options: NO_PSUM=0, PSUM_ONCE=0, RSUM=0',[...compute,'psum','psum-select'],[...computePaths,'stream-p','psum-post','ctrl-psum'],'Read one matching P vector for each admitted input vector, align the response and add it after the dot/optional scale result.','The P read format follows dtype / tile mode. These partial-sum choices are START option bits, not additional tensor CSR fields.',['engine','psum_modes','post','intrinsic']);
  add('psum-none','Partial sum','NO_PSUM','START bit 2',[...compute,'zero','psum-select'],[...computePaths,'zero-p','psum-post','ctrl-psum'],'Select zero for P; no P memory reads are issued. The post add receives zero.','This view shows scale bypass to isolate P selection. NO_PSUM can also be combined with a supported scaled start.',['psum_modes','post','intrinsic']);
  add('psum-once','Partial sum','PSUM_ONCE','START bit 1',[...compute,'psum','psum-hold','psum-select'],[...computePaths,'read-hold','hold-p','psum-post','ctrl-psum'],'Read and capture one P vector, then reuse that vector across the run.','Reusing one captured P vector is different from RSUM: PSUM_ONCE still produces per-vector outputs and does not fold all vectors into one dot-local accumulator.',['psum_modes','engine','intrinsic']);
  add('psum-rsum','Partial sum','RSUM','START bit 4',['gpr','owner','input','window','banks','dot','rsum','format','output'],['gpr-owner','input-window','window-dot','weights','owner-dot','ctrl-rsum','rsum-merge','rsum-output','ctrl-format','format-output'],'Accumulate across input vectors inside each dot kernel. The first vector initializes the accumulator and the last publishes one final output vector for the run.','RSUM forces NO_PSUM behavior and disables static/stream scaling in the current engine. It bypasses the external post-dot P add; it is not an SRAM P feedback loop.',['rsum','start_modes','drain','post']);
  const scaleBase=['gpr','owner','sld','stype'];
  const scalePaths=['gpr-owner','ctrl-stype'];
  add('scale-type-bf16','Scale encoding','BF16 scale','WSLD config stype=0',[...scaleBase,'s-bf16','scale-fifo'],[...scalePaths,'sld-bf16','decode-bf16','sld-stream'],"16-bit BF16 scale data passes through, with zero low extension bits.",'Scale encoding is independent of weight code type. The maintained WSLD slot reader decodes stype before SLD delivers the scale; this is not a field of tensor_setcsr. The illustration selects the circular/stream delivery branch.',['scale_decode','scale_api','scale_buffers']);
  add('scale-type-mx','Scale encoding','MXFP4 / E8M0','WSLD config stype=1',[...scaleBase,'s-mx','scale-fifo'],[...scalePaths,'sld-mx','decode-mx','sld-stream'],"Decode the unsigned E8M0 block-scale byte to the internal scale representation.",'Scale encoding is independent of weight code type. The maintained WSLD slot reader decodes stype before SLD delivers the scale; this is not a field of tensor_setcsr. The illustration selects the circular/stream delivery branch.',['scale_decode','scale_api','scale_buffers']);
  add('scale-type-nv','Scale encoding','NVFP4 / E4M3 × global','WSLD config stype=2',[...scaleBase,'s-nv','scale-fifo'],[...scalePaths,'sld-nv','decode-nv','sld-stream'],"Decode a local E4M3 scale byte and combine it with the configured BF16 global factor before delivery.",'Scale encoding is independent of weight code type. The maintained WSLD slot reader decodes stype before SLD delivers the scale; this is not a field of tensor_setcsr. The illustration selects the circular/stream delivery branch.',['scale_decode','scale_api','scale_buffers']);
  add('scale-type-fp16','Scale encoding','FP16 scale','WSLD config stype=3',[...scaleBase,'s-fp16','scale-fifo'],[...scalePaths,'sld-fp16','decode-fp16','sld-stream'],"Expand IEEE FP16 exactly into BF20; the extra fraction bits travel alongside the high BF16 slice.",'Scale encoding is independent of weight code type. The maintained WSLD slot reader decodes stype before SLD delivers the scale; this is not a field of tensor_setcsr. The illustration selects the circular/stream delivery branch.',['scale_decode','scale_api','scale_buffers']);
  const scaled=['gpr','owner','input','window','banks','dot','scale-source','scale-mul','scale-select','post','zero','psum-select','format','output'];
  const scaledPaths=['gpr-owner','owner-dot','input-window','window-dot','weights','dot-post','scale','scale-product','scaled-to-post','zero-p','psum-post','post-output','format-output','ctrl-scale','ctrl-enable','ctrl-format'];
  add('scale-off','Scale delivery','Scale bypass','START USE_SCALE=0, SCALE_STREAM=0',compute,computePaths,'Use the dot result directly, bypassing scale multiplication.','This isolates the scale-enable selector; the P source is selected independently by START options.',['start_modes','post']);
  add('scale-static','Scale delivery','Held / reuse','START USE_SCALE + SLD static/reuse',[...scaled,'scale-hold'],[...scaledPaths,'static-scale'],'Use the held scale vector captured for this work descriptor and multiply each matching dot result before adding P.','SLD can prepare or reuse a scale vector. It is separate from WLD and from choosing the packed scale encoding. This view uses zero P to isolate scaling.',['scale_buffers','start_modes','post']);
  add('scale-stream','Scale delivery','Per-vector stream','START USE_SCALE + SCALE_STREAM',[...scaled,'scale-fifo'],[...scaledPaths,'stream-scale'],'Consume a matching scale vector from the stream FIFO when input_compute_fire admits an input vector.','Scale stream availability participates in compute admission. RSUM disables this route. This view uses zero P to isolate scaling.',['engine','scale_buffers','start_modes','post']);
  for(const view of [...phases,...modes]){
    if(view.paths.includes('ctrl-format'))view.paths.push('ctrl-tile-format');
    for(const group of controlGroups)if(group.routes.some(id=>view.paths.includes(id))){view.active.push(group.node);view.paths.push(group.feed);}
    view.active=[...new Set(view.active)];view.paths=[...new Set(view.paths)];
  }
  const families=['Weight ingress','Partial sum','Scale encoding','Scale delivery'];
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const style=`.tensor-bg{fill:var(--bg,#0c111b)}.tensor-memory{fill:none;stroke:var(--rule,#29394e);stroke-dasharray:4 5}.tensor-title{font:600 17px sans-serif;fill:var(--ink,#dce5f0)}.tensor-sub{font:10px monospace;fill:var(--muted,#8c9eb5)}.tensor-caption{font:11px monospace;fill:var(--muted,#8c9eb5)}.tensor-box{fill:var(--panel,#131d2b);stroke:var(--ink,#dce5f0);stroke-width:1.4}.tensor-wire{fill:none;stroke-width:2;stroke-linejoin:round}.tensor-data{stroke:#85adff}.tensor-weight{stroke:#6ee7cf}.tensor-psum{stroke:#ffc578}.tensor-optional{stroke:#b39be8}.tensor-control{stroke:#718198;stroke-dasharray:5 5}.tensor-arrow-data{fill:#85adff}.tensor-arrow-weight{fill:#6ee7cf}.tensor-arrow-psum{fill:#ffc578}.tensor-arrow-optional{fill:#b39be8}.tensor-arrow-control{fill:#718198}[data-tensor-node],[data-tensor-path]{opacity:.18}[data-tensor-node].is-active,[data-tensor-path].is-active{opacity:1}.tensor-mux-title{font-size:12px}.tensor-control-source .tensor-box{stroke:#718198!important}.tensor-control-port{stroke:#718198;stroke-width:1.5;fill:none}.is-active .tensor-box{stroke:#6ee7cf}`;
  function render(view){
    const selected=typeof view==='string'?modes.find(m=>m.id===view):view;
    const active=(kind,key)=>!selected||selected[kind].includes(key)?'is-active':'';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2280 1760" role="img" aria-labelledby="tensor-svg-title tensor-svg-desc"><title id="tensor-svg-title">Tensor dataflow and work ownership${selected?.label?' — '+esc(selected.label):''}</title><desc id="tensor-svg-desc">RV32 registers supply captured Tensor configuration. WLD transports packed weights to per-dot ingress typecasts and local A/B cells. Descriptor controls select P, dot-local RSUM, scale decoding, scale delivery and output format.</desc><style>${style}</style><defs>${['data','weight','psum','optional','control'].map(k=>`<marker id="tensor-arrow-${k}" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L8 4L0 8Z" class="tensor-arrow-${k}"/></marker>`).join('')}</defs><rect class="tensor-bg" width="2280" height="1760"/><rect class="tensor-memory" x="570" y="470" width="660" height="1020"/><text class="tensor-caption" x="590" y="495">DOT-LOCAL PATHS · 8 INSTANCES SHOWN AS GROUPS</text><text class="tensor-caption" x="895" y="493">wtype</text><text class="tensor-caption" x="1805" y="465">stype</text><text class="tensor-caption" x="1660" y="1095">USE_SCALE</text><text class="tensor-caption" x="1490" y="865">scale source</text><text class="tensor-caption" x="1595" y="1265">P mode</text><text class="tensor-caption" x="1100" y="1335">RSUM</text>${paths.map(([id,d,kind])=>{
      const attrs=`data-tensor-path="${id}" class="tensor-wire tensor-${kind} ${active('paths',id)}"`;
      if(kind!=='control')return `<path ${attrs} d="${d}" marker-end="url(#tensor-arrow-${kind})"/>`;
      const pts=points(d),end=pts[pts.length-1],prev=pts[pts.length-2];
      const arrowStart=end.map((v,i)=>v-Math.sign(v-prev[i])*8);
      return `<g ${attrs}><path d="${controlPath(d)}"/><path d="M${arrowStart[0]} ${arrowStart[1]}L${end[0]} ${end[1]}" marker-end="url(#tensor-arrow-control)"/></g>`;
    }).join('')}${nodes.map(([id,x,y,w,h,title,sub])=>{
      const mux=['wselect','stype','scale-source','scale-select','psum-select'].includes(id);
      const down=id==='scale-source';
      const shape=down?`<path class="tensor-box" d="M${x} ${y}H${x+w}V${y+h-25}L${x+w/2} ${y+h}L${x} ${y+h-25}Z"/>`:mux?`<path class="tensor-box" d="M${x} ${y}L${x+w} ${y+25}V${y+h-25}L${x} ${y+h}Z"/>`:`<rect class="tensor-box" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
      const ty=mux?y+h/2-4:y+26;
      return `<g data-tensor-node="${id}" class="${active('active',id)} ${['csr-fields','start-fields','wsld-fields'].includes(id)?'tensor-control-source':''}" role="button" tabindex="0" aria-label="${esc(title)}: explore this path">${shape}${mux&&!down?`<path class="tensor-control-port" d="M${x+w/2} ${y}V${y+12.5}"/>`:''}<text class="tensor-title ${mux?'tensor-mux-title':''}" x="${x+w/2}" y="${ty}" text-anchor="middle">${esc(title)}</text><text class="tensor-sub" x="${x+w/2}" y="${ty+21}" text-anchor="middle">${esc(sub)}</text>${id==='owner'?'<text class="tensor-sub" x="675" y="121" text-anchor="middle">pointers · count · accepted / pending / queued work</text>':''}</g>`;
    }).join('')}<text class="tensor-caption" x="985" y="1445">RSUM: one final vector</text><text class="tensor-caption" x="985" y="1465">No scale / SRAM P</text><text class="tensor-caption" x="340" y="1640">O → SRAM → P on a later reduction tile; logical memory streams share the fabric</text><text class="tensor-caption" x="40" y="1740">Functional selected paths, not clock gating · mode families are inspected separately · CSR / START / WSLD have separate lanes · gaps at crossings mean no connection</text></svg>`;
  }
  window.E3TensorPipeline={sources,slides,phases,nodes,paths,modes,families,controlGroups,render};
})();
