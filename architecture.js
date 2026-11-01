/* SPDX-License-Identifier: Apache-2.0 */
/* Architectural model + explicit layout. No network or build step required. */
(() => {
  const scalar = 'src/edge-32/rtl/';
  const product = 'src/edge-e3/edge_core/';
  const nodes = [
    {id:'pc',x:55,y:174,w:95,h:92,title:'PC',lines:['32-bit','next_pc'],kind:'scalar',modes:['overlap','done'],source:scalar+'edge_32_if.sv',detail:'A 32-bit program counter. IF fetches the next instruction; an EX branch redirect changes the fetch direction.',tags:['RV32','IF']},
    {id:'fetch',x:200,y:174,w:155,h:92,title:'I-cache / IF',lines:['fetch + predecode','source indices'],kind:'scalar',modes:['overlap','done'],source:scalar+'edge_32_if.sv',detail:'IF fetches instructions and predecodes source indices and instruction classes, moving index extraction ahead of the ID register-read path.',tags:['IF','predecode']},
    {id:'ifid',x:386,y:148,w:22,h:228,title:'IF / ID',kind:'register',modes:['overlap','done'],source:scalar+'edge_32_id.sv',detail:'On if_id_fire, IF/ID captures the instruction-matched if_pc, if_inst and if_error. PC comes from the parcel FIFO, rather than the current fetch request. There is no separately captured PC+4 field. The bar summarizes stage ownership.',tags:['stage boundary']},
    {id:'decode',x:445,y:174,w:160,h:80,title:'Decode',lines:['legality / hazards','issue controls'],kind:'scalar',modes:['setup','overlap','done'],source:scalar+'id/decode.svh',detail:'ID checks instruction legality, dependencies and admission. ASIC32 capture-source controls select the GPR operand carried by the command.',tags:['ID','ASIC32']},
    {id:'gpr',x:445,y:291,w:160,h:96,title:'GPR',lines:['x0–x31 · 32 bits','2 read / 1 write','WB → ID forwarding'],kind:'scalar',modes:['setup','overlap','done'],source:scalar+'edge_32_gpr.v',detail:'The RV32 register file has two read ports and one write port. Resolved operands are captured into EX. An ASIC command does not reread live GPR state later.',tags:['32-bit values','captured operand']},
    {id:'idex',x:658,y:148,w:22,h:310,title:'ID / EX',kind:'register',modes:['setup','overlap','sync','done'],source:scalar+'ex/issue_registers.svh',detail:'ID/EX captures the instruction, operands and issue controls. EX retains instruction ownership during multicycle operations and pending sync requests.',tags:['captured GPR','EX ownership']},
    {id:'alu',x:1000,y:390,w:200,h:160,title:'ALU',lines:['RV32IM'],kind:'scalar',shape:'alu',modes:['overlap','done'],source:scalar+'ex/units.svh',detail:'This functional group contains integer arithmetic, logic and RV32M multiplication/division. RTL still instantiates separate edge_32_alu and edge_32_muldiv_asap7 leaves. Multicycle operations retain EX ownership. Branch has its own block.',tags:['EX','integer + RV32M','functional grouping']},
    {id:'csr',x:850,y:555,w:350,h:65,title:'CSR',lines:['read / modify'],kind:'scalar',shape:'csr',modes:['overlap','done'],source:scalar+'ex/result.svh',detail:'The CSR/counter functional group consumes captured CSR controls, rs1 or uimm and produces CSR, cycle and instret results. State changes commit in WB. This symbol does not imply a separate RTL leaf. Link values bypass it.',tags:['EX','CSR / counters','WB commit']},
    {id:'branch',x:850,y:645,w:350,h:75,title:'Branch',lines:['compare / target','taken / redirect'],kind:'scalar',modes:['overlap','done'],source:scalar+'edge_32_branch.v',detail:'The branch unit consumes EX PC, rs1, rs2 and immediate, computes the condition and target, and redirects IF. It is separate from the ALU/Mul-div functional group.',tags:['EX','compare','redirect']},
    {id:'lsu',x:735,y:291,w:160,h:80,title:'LSU',lines:['load / store','D-cache / DTCM'],kind:'scalar',modes:['overlap','done'],source:scalar+'edge_32_lsu.v',detail:'The EX-owned LSU executes scalar loads and stores. Request/response interfaces connect it to D-cache and DTCM/SRAM; address routing selects the memory path.',tags:['EX','scalar memory']},
    {id:'issue',x:735,y:407,w:393,h:64,title:'ASIC request / EX ownership',lines:['inst[31:0] + captured GPR · wait for response'],kind:'command',modes:['setup','start','sync','done'],source:scalar+'ex/completion.svh',detail:'EX sends accel_req_inst and captured operands. The product connects accel_req_src1 to req_capture_value, zero-extending a 32-bit GPR onto the 64-bit transport. The instruction completes only after accel_resp_valid.',tags:['ASIC32','GPR → command','EX hold']},
    {id:'exwb',x:1192,y:148,w:22,h:310,title:'EX / WB',kind:'register',modes:['overlap','done'],source:scalar+'edge_32_wb.sv',detail:'Completed EX results transfer to WB. A pending sync response retains the instruction in EX; instructions already in WB may still retire.',tags:['completion boundary']},
    {id:'wb',x:1270,y:174,w:237,h:92,title:'WB / retire',lines:['GPR / FPR / CSR commit','in-order retirement'],kind:'scalar',modes:['overlap','done'],source:scalar+'wb/retirement.svh',detail:'WB commits architectural state and retires instructions in order. GPR writeback also supports WB-to-ID forwarding.',tags:['WB','in-order']},
    {id:'capture',x:90,y:557,w:254,h:92,title:'Captured command',lines:['ASIC32 + imm8','GPR value carried with request'],kind:'command',modes:['setup','start','sync','done'],source:product+'edge_core_scalar_product_top.v',detail:'The product carries scalar_accel_req_inst and connects accel_req_src1 to req_capture_value. This parameter belongs to the accepted instruction; it is not a later register-file read.',tags:['32-bit parameter','64-bit transport']},
    {id:'dispatch',x:424,y:557,w:280,h:92,title:'ASIC instruction pipe',lines:['decode · configuration · dispatch','ordered command handshake'],kind:'command',modes:['setup','start','sync','done'],source:product+'rtl/edge_lite_accel_dispatch.v',detail:'edge_lite_accel_dispatch connects the command bridge and edge_accel_pipe to decode configuration, start and sync operations. This command path does not claim another fixed four-stage CPU pipeline.',tags:['edge_accel_pipe','ordered commands']},
    {id:'launch',x:785,y:557,w:285,h:92,title:'Target / launch control',lines:['set_* → configuration','start → accepted work descriptor'],kind:'command',modes:['setup','start','overlap'],source:scalar+'edge_accel_pipe.v',detail:'Opcode/subop routes commands to their target. set_* updates configuration; start submits a stable work descriptor. Start may wait for capacity or a launch response, without waiting for the whole computation.',tags:['start ≈ fork','ready / capacity']},
    {id:'join',x:1240,y:557,w:267,h:92,title:'Sync / completion gate',lines:['target-scoped drain condition','response releases scalar EX'],kind:'control',modes:['sync','done'],source:scalar+'edge_accel_pipe.v',detail:'Target-specific sync uses tensor_sync_stall, dma_sync_done, actu_sync_stall or cmpu_sync_stall. Until the condition permits a response, EX retains the instruction. Engines keep executing during the wait.',tags:['sync ≈ join','target-scoped','EX hold']},
    {id:'tensor',x:400,y:771,w:236,h:100,title:'Tensor',lines:['8 × 8 compute engine','active / pending work'],kind:'thread',modes:['start','overlap','sync','done'],source:'src/edge-e3/edge_tensor_unit/edge_tensor_unit.v',detail:'The E3 8-by-8 tensor engine progresses independently after launch and maintains active/pending work state. Hardware thread here means an execution engine, rather than an ISA hart with its own PC and GPRs.',tags:['hardware thread','8 × 8','independent progress']},
    {id:'dma',x:686,y:771,w:236,h:100,title:'DMA',lines:['system memory ↔ DTCM','independent data movement'],kind:'thread',modes:['start','overlap','sync','done'],source:product+'rtl/edge_lite_accel_platform.v',detail:'DMA moves data independently and may overlap scalar and engine work. RV32 commands combine low/high 32-bit values into 64-bit DMA addresses. Dependencies, memory ports and arbitration constrain overlap.',tags:['hardware thread','64-bit DMA address']},
    {id:'actu',x:972,y:771,w:236,h:100,title:'ACTU',lines:['activation / nonlinear','independent execution'],kind:'thread',modes:['start','overlap','sync','done'],source:'src/edge-asic/rtl/actu/edge_actu.v',detail:'ACTU progresses independently after configuration and start. Target-specific sync waits for earlier ACTU work to drain. Shared resources remain subject to platform arbitration.',tags:['hardware thread','activation']},
    {id:'cmpu',x:1258,y:771,w:236,h:100,title:'CMPU',lines:['compare / reduction','independent execution'],kind:'thread',modes:['start','overlap','sync','done'],source:product+'rtl/edge_lite_accel_platform.v',detail:'CMPU has its own start-ready and sync-stall state for independent comparison/reduction work. A target-specific sync joins it with scalar execution.',tags:['hardware thread','compare / reduction']},
    {id:'memory',x:400,y:989,w:1094,h:66,title:'Shared DTCM / SRAM fabric',lines:['Tensor data / weights / psum · DMA · ACTU / CMPU · arbitration & visibility'],kind:'memory',modes:['overlap'],source:product+'rtl/edge_lite_accel_platform.v',detail:'The diagram abstracts DTCM, weights and I/O storage as a shared fabric. Software must respect data dependencies; hardware still arbitrates ports and ownership.',tags:['shared resources','not a port-level netlist']}
  ];
  // Textbook-style datapath: stage registers span the scalar lane; symbols
  // represent functional ownership rather than a literal RTL leaf netlist.
  const layout = {
    pc:[50,355,80,100],fetch:[180,330,130,140],ifid:[350,120,26,660],
    decode:[435,330,250,140],gpr:[435,560,250,170],idex:[735,120,26,660],
    lsu:[850,270,350,95],issue:[850,745,350,55],exwb:[1480,120,26,660],wb:[1540,335,150,210]
  };
  const asicIds = ['capture','dispatch','launch','join', 'tensor','dma','actu','cmpu','memory'];
  nodes.forEach(n=>{
    if(layout[n.id]) [n.x,n.y,n.w,n.h]=layout[n.id];
    if(asicIds.includes(n.id)) n.y+=400;
  });
  Object.assign(nodes.find(n=>n.id==='fetch'),{title:'IFU',lines:[],shape:'ifu',modes:['setup','overlap','done'],source:scalar+'edge_32_frontend.v',tags:['single outstanding fetch','2-entry parcel FIFO'],detail:'edge_32_frontend owns one outstanding fetch, a two-entry PC/inst/error parcel FIFO, capacity/ready, start/stop and redirect cancellation. Predecode is separately instantiated in the same IF stage. I-cache sits outside the imem interface; PC, +4 and next-PC expand frontend functions for readability.'});
  nodes.find(n=>n.id==='ifid').modes=['setup','overlap','done'];
  Object.assign(nodes.find(n=>n.id==='decode'),{title:'Decoder',lines:['issue decode / imm','EX + WB control packet'],shape:'decoder',detail:'edge_32_issue_decode consumes the instruction, the IF-predecoded destination index and register classification retained by IF/ID. It produces id_issue_control and immediate. rd travels in issue_control_t for EX RAW checks and later WB. uses_gpr selects operand use; no separate Control module is implied.'});
  Object.assign(nodes.find(n=>n.id==='gpr'),{title:'Registers',lines:['32 × 32 bits','2R / 1W'],shape:'gpr',source:scalar+'edge_32_gpr_read_port.sv',detail:'IF supplies both GPR read addresses; the read-port owner captures if_rs1/if_rs2 on if_accept. Decoder use_rs1/use_rs2 controls value-or-zero selection after reading. This selection is grouped inside the symbol for readability, but RTL applies it during EX capture. Read addresses are not masked. WB forwarding remains active.'});
  Object.assign(nodes.find(n=>n.id==='issue'),{title:'ASIC issue',lines:['inst / GPR · response wait'],shape:'issue'});
  Object.assign(nodes.find(n=>n.id==='wb'),{title:'Writeback',lines:['GPR / CSR','in-order retire'],shape:'wb'});
  Object.assign(nodes.find(n=>n.id==='lsu'),{title:'LSU',lines:['base + imm','D-cache / DTCM'],shape:'lsu'});
  nodes.push(
    {id:'predecode',x:180,y:560,w:130,h:170,title:'Predecode',kind:'scalar',shape:'predecode',modes:['setup','overlap','done'],source:scalar+'if/admission.svh',detail:'IF edge_32_decode and edge_32_register_decode produce classification, legality, unmasked GPR indices and if_write_rd. Register metadata crosses IF/ID on if_id_fire and feeds issue decode. Instruction-matched if_pc comes directly from the IFU parcel FIFO. No additional stage boundary separates IFU and Predecode.',tags:['IF stage','unmasked GPR indices']},
    {id:'imem',x:180,y:280,w:130,h:28,title:'I-cache / imem',kind:'memory',shape:'interface',modes:['overlap','done'],source:scalar+'edge_32_cached_core.v',detail:'The IFU imem request/response boundary connects to I-cache and its adapter in the cached core. Cache data/tag arrays are outside the IF frontend.',tags:['outside IFU','request / response']},
    {id:'dcache',x:850,y:225,w:140,h:28,title:'D-cache',kind:'memory',shape:'interface',modes:['overlap','done'],source:scalar+'edge_32_dcache_adapter.v',detail:'Address routing and the D-cache adapter connect LSU to cached memory. This small block denotes the external request/response boundary, matching the I-cache/imem notation above IFU.',tags:['LSU memory route','D-cache adapter']},
    {id:'scalar-dtcm',x:1060,y:225,w:140,h:28,title:'DTCM / SRAM',kind:'memory',shape:'interface',modes:['overlap','done'],source:scalar+'edge_32_dtcm_router.v',detail:'The scalar LSU direct DTCM/SRAM route. edge_32_dtcm_router selects DTCM or cache using configured regions; the E3 platform connects the selected path to SRAM. This is the scalar entry into the shared memory fabric.',tags:['LSU memory route','DTCM router']},
    {id:'mux-a',x:850,y:390,w:26,h:70,title:'Operand A',kind:'scalar',shape:'mux',modes:['overlap','done'],source:scalar+'edge_32_alu.v',detail:'Operand A selects captured rs1 or PC according to the instruction. The symbol summarizes selection within the ALU functional group.',tags:['operand select']},
    {id:'mux-b',x:850,y:480,w:26,h:70,title:'Operand B',kind:'scalar',shape:'mux',modes:['overlap','done'],source:scalar+'edge_32_alu.v',detail:'Operand B selects captured rs2 or immediate. Mul/div uses the two captured GPR operands. The symbol represents inputs to the functional group.',tags:['operand select']},
    {id:'result',x:1428,y:270,w:26,h:390,title:'Result select',kind:'scalar',shape:'mux',modes:['overlap','done'],source:scalar+'ex/result.svh',detail:'Selects completed EX results for EX/WB: LSU load, integer ALU/Mul-div, CSR/counter or link value. Only the main integer paths are expanded.',tags:['EX result select']},
    {id:'pc4',x:57.5,y:540,w:65,h:40,title:'+ 4',kind:'scalar',shape:'adder',modes:['overlap','done'],source:scalar+'edge_32_if.sv',detail:'The sequential fetch path advances by four bytes. PC+4 also supplies a link value. Frontend buffering is abstracted in this view.',tags:['next PC']},
    {id:'nextpc',x:57.5,y:755,w:26,h:95,title:'Next PC',kind:'scalar',shape:'mux',flip:true,modes:['overlap','done'],source:scalar+'edge_32_if.sv',detail:'Selects sequential PC+4 or the EX branch redirect target. Fetch-PC+4 stays in the lower next-PC path; IF/ID separately captures the instruction-matched parcel PC. The frontend also owns buffering, hold and redirect control.',tags:['next PC select']},
    {id:'ex-completion',x:970,y:145,w:280,h:48,title:'EX completion',lines:['unit done / capacity'],shape:'completion',kind:'control',modes:['overlap','sync','done'],source:scalar+'ex/completion.svh',detail:'completion.svh combines ex_immediate_complete_q, is_instret && instret_read_ready_q, is_muldiv && mul_started_q && mul_result_valid, memory-class && mem_started_q && lsu_done, accel_done, cache_done, fence_i_done and ex_decode_fault_q to produce ex_release_ready. Completion requires its class/started guards. Ordinary ALU, Branch and most CSR operations use the immediate path. No extra branch_done is implied. FPU completion is outside this view.',tags:['EX capacity','completion aggregate']},
    {id:'interlock',x:435,y:150,w:250,h:90,title:'Hazard / admission',lines:['GPR / CSR / EX / WB','IF ready · capture enable'],kind:'control',modes:['sync','overlap','done'],source:scalar+'id/slot.svh',detail:'The ID dependency/admission group consumes gpr_stall, CSR hazards, EX valid/release_ready, WB pending/header state and pipeline_kill. It produces if_ready, if_id_fire and id_capture_enable. An empty ID slot can fill while EX is busy. RAW comparison belongs to the GPR read-port owner; this is distributed logic.',tags:['ID ownership','ready / capture','distributed hazard logic']}
  );
  ['csr','dcache','imem','scalar-dtcm','wb','ex-completion'].forEach(id=>nodes.find(n=>n.id===id).modes.push('cache'));
  // Paths are deliberately routed; crossing without a dot is not a connection.
  const edges = [
    {id:'pc-fetch',from:'pc',to:'fetch',d:'M130 405H180',kind:'scalar',modes:['overlap','done'],label:[131,395,'fetch_pc']},
    {id:'fetch-id',from:'fetch',to:'ifid',d:'M310 360H350',kind:'scalar',modes:['overlap','done'],label:[313,349,'inst']},
    {id:'pc-pass',from:'fetch',to:'ifid',d:'M310 340H330V305H350',kind:'scalar',modes:['overlap','done'],label:[313,294,'if_pc']},
    {id:'id-pc-pass',from:'ifid',to:'idex',d:'M376 305H735',kind:'scalar',modes:['overlap','done'],label:[650,294,'id_pc']},
    {id:'fetch-predecode',from:'fetch',to:'predecode',d:'M245 470V560',kind:'scalar',modes:['setup','overlap','done'],label:[253,520,'parcel']},
    {id:'id-decode',from:'ifid',to:'decode',d:'M376 360H435',kind:'scalar',modes:['overlap','done']},
    {id:'imem-request',from:'fetch',to:'imem',d:'M220 330V308',kind:'scalar',modes:['overlap','done']},
    {id:'imem-response',from:'imem',to:'fetch',d:'M270 308V330',kind:'scalar',modes:['overlap','done']},
    {id:'if-read1',from:'predecode',to:'ifid',d:'M310 611H350',kind:'scalar',modes:['setup','overlap','done']},
    {id:'if-read2',from:'predecode',to:'ifid',d:'M310 676H350',kind:'scalar',modes:['setup','overlap','done']},
    {id:'read',from:'ifid',to:'gpr',d:'M376 611H435',kind:'scalar',modes:['setup','overlap','done']},
    {id:'read2',from:'ifid',to:'gpr',d:'M376 676H435',kind:'scalar',modes:['setup','overlap','done']},
    {id:'operand',from:'gpr',to:'idex',d:'M685 611H735',kind:'scalar',modes:['setup','overlap','done'],label:[694,600,'rs1']},
    {id:'operand2',from:'gpr',to:'idex',d:'M685 676H735',kind:'scalar',modes:['setup','overlap','done'],label:[694,665,'rs2']},
    {id:'mask-control1',from:'decode',to:'gpr',d:'M505 470V560',kind:'control',modes:['setup','overlap','done']},
    {id:'mask-control2',from:'decode',to:'gpr',d:'M575 470V560',kind:'control',modes:['setup','overlap','done']},
    {id:'immediate',from:'decode',to:'idex',d:'M685 360H735',kind:'scalar',modes:['overlap','done'],label:[690,349,'imm']},
    {id:'issue-controls',from:'decode',to:'idex',d:'M685 345H735',kind:'control',modes:['setup','overlap','done']},
    {id:'ex-wb-controls',from:'idex',to:'exwb',d:'M761 220H1480',kind:'control',modes:['setup','overlap','done'],label:[1000,210,'rd / WB controls']},
    {id:'wb-commit-controls',from:'exwb',to:'wb',d:'M1506 220H1615V335',kind:'control',modes:['overlap','done'],label:[1520,210,'rd / WB ctrl']},
    {id:'interlock-hold',from:'interlock',to:'ifid',d:'M460 150V105H363V120',kind:'control',modes:['sync','overlap','done']},
    {id:'if-ready',from:'interlock',to:'fetch',d:'M490 150V30H155V320H195V330',kind:'control',modes:['setup','overlap','sync','done'],label:[180,41,'if_ready']},
    {id:'id-capture',from:'interlock',to:'idex',d:'M685 230H735',kind:'control',modes:['setup','overlap','sync','done']},
    {id:'ex-valid-status',from:'idex',to:'interlock',d:'M748 120V90H640V150',kind:'control',modes:['overlap','sync','done'],dots:[[700,90]],label:[650,80,'EX valid']},
    {id:'ex-capacity',from:'ex-completion',to:'interlock',d:'M990 145V60H600V150',kind:'control',modes:['overlap','sync','done'],label:[820,50,'EX release_ready']},
    {id:'wb-admission',from:'wb',to:'interlock',d:'M1660 335V30H560V150',kind:'control',modes:['overlap','sync','done'],label:[1100,20,'WB pending / CSR']},
    {id:'ex-rd-hazard',from:'idex',to:'gpr',d:'M748 120V90H700V520H640V560',kind:'control',modes:['overlap','sync','done'],label:[641,510,'EX rd/we']},
    {id:'gpr-hazard',from:'gpr',to:'interlock',d:'M685 585H720V130H680V150',kind:'control',modes:['setup','overlap','sync','done']},
    {id:'decode-hazard',from:'decode',to:'interlock',d:'M520 330V240',kind:'control',modes:['setup','overlap','sync','done'],label:[530,280,'CSR flags']},
    {id:'predecode-rd',from:'predecode',to:'ifid',d:'M310 585H350',kind:'control',modes:['setup','overlap','done']},
    {id:'id-rd',from:'ifid',to:'decode',d:'M376 585H415V375H435',kind:'control',modes:['setup','overlap','done']},
    {id:'execute',from:'idex',to:'mux-a',d:'M761 410H850',kind:'scalar',modes:['overlap','done'],label:[774,399,'rs1']},
    {id:'operand-pc',from:'idex',to:'mux-a',d:'M761 445H850',kind:'scalar',modes:['overlap','done'],label:[774,434,'pc']},
    {id:'operand-b',from:'idex',to:'mux-b',d:'M761 500H850',kind:'scalar',modes:['overlap','done'],label:[774,489,'rs2']},
    {id:'operand-imm',from:'idex',to:'mux-b',d:'M761 535H850',kind:'scalar',modes:['overlap','done'],label:[774,524,'imm']},
    {id:'alu-a',from:'mux-a',to:'alu',d:'M876 425H1000',kind:'scalar',modes:['overlap','done'],label:[927,414,'opA']},
    {id:'alu-b',from:'mux-b',to:'alu',d:'M876 515H1000',kind:'scalar',modes:['overlap','done'],label:[927,504,'opB']},
    // RTL completion terms: dedicated dashed returns, separate from result data.
    {id:'done-lsu',from:'lsu',to:'ex-completion',d:'M1200 289H1225V-160H1065V145',kind:'control',modes:['overlap','done'],label:[1040,-170,'lsu_done']},
    {id:'done-muldiv',from:'alu',to:'ex-completion',d:'M1200 440H1245V-140H1105V145',kind:'control',modes:['overlap','done'],label:[1080,-150,'mul_result_valid']},
    {id:'done-instret',from:'csr',to:'ex-completion',d:'M1200 565H1265V-120H1145V145',kind:'control',modes:['overlap','done'],label:[1120,-130,'instret_read_ready_q']},
    {id:'done-asic',from:'issue',to:'ex-completion',d:'M1200 760H1285V-100H1185V145',kind:'control',modes:['start','sync','done'],label:[1160,-110,'accel_done']},
    {id:'done-cache',from:'dcache',to:'ex-completion',d:'M990 239H1010V205H1305V-80H1225V145',kind:'control',modes:['cache','overlap','done'],label:[1200,-90,'cache_done']},
    {id:'done-fence',from:'imem',to:'ex-completion',d:'M180 292H130V-60H1030V145',kind:'control',modes:['cache','overlap','done'],label:[1050,-70,'fence_i_done']},
    {id:'done-static',from:'idex',to:'ex-completion',d:'M761 130H810V110H1008V145',kind:'control',modes:['overlap','done'],label:[815,101,'immediate / decode fault']},
    // Separate control lanes enter unit tops (CSR uses its upper-left port).
    {id:'lsu-control',from:'idex',to:'lsu',d:'M761 260H875V270',kind:'control',modes:['overlap','done'],label:[775,249,'lsu_ctrl']},
    {id:'alu-control',from:'idex',to:'alu',d:'M761 380H1090V402.6',kind:'control',modes:['overlap','done'],label:[775,369,'alu_ctrl']},
    {id:'csr-control',from:'idex',to:'csr',d:'M761 565H850',kind:'control',modes:['overlap','done'],label:[775,554,'csr_ctrl']},
    {id:'branch-control',from:'idex',to:'branch',d:'M761 635H900V645',kind:'control',modes:['overlap','done'],label:[915,640,'br_ctrl']},
    {id:'asic-control',from:'idex',to:'issue',d:'M761 735H900V745',kind:'control',modes:['setup','start','sync','done'],label:[775,724,'asic_ctrl']},
    {id:'ex-lsu',from:'idex',to:'lsu',d:'M761 317H850',kind:'scalar',modes:['overlap','done'],label:[770,306,'addr/data']},
    {id:'dcache-request',from:'lsu',to:'dcache',d:'M910 270V253',kind:'scalar',modes:['overlap','done']},
    {id:'dcache-response',from:'dcache',to:'lsu',d:'M930 253V270',kind:'scalar',modes:['overlap','done']},
    {id:'dtcm-request',from:'lsu',to:'scalar-dtcm',d:'M1120 270V253',kind:'scalar',modes:['overlap','done']},
    {id:'dtcm-response',from:'scalar-dtcm',to:'lsu',d:'M1140 253V270',kind:'scalar',modes:['overlap','done']},
    // Quiet system-control sideband; details and RTL ownership live in view 06.
    {id:'csr-dcache',from:'csr',to:'dcache',d:'M1200 605H1380V210H970V225',kind:'cache',modes:['cache'],dots:[[1380,210],[1180,210]]},
    {id:'csr-dtcm',from:'csr',to:'scalar-dtcm',d:'M1200 605H1380V210H1180V225',kind:'cache',modes:['cache']},
    {id:'csr-icache',from:'csr',to:'imem',d:'M1200 605H1380V5H320V265H245V280',kind:'cache',modes:['cache']},
    {id:'csr-input',from:'idex',to:'csr',d:'M761 587.5H850',kind:'scalar',modes:['overlap','done'],label:[770,577,'op/src']},
    {id:'branch-rs1',from:'idex',to:'branch',d:'M761 665H850',kind:'scalar',modes:['overlap','done'],label:[781,654,'rs1']},
    {id:'branch-rs2',from:'idex',to:'branch',d:'M761 687H850',kind:'scalar',modes:['overlap','done'],label:[781,676,'rs2']},
    {id:'branch-pc-imm',from:'idex',to:'branch',d:'M761 709H850',kind:'scalar',modes:['overlap','done'],label:[770,698,'pc/imm']},
    {id:'alu-result',from:'alu',to:'result',d:'M1200 465H1428',kind:'scalar',modes:['overlap','done'],label:[1380,454,'alu']},
    {id:'lsu-result',from:'lsu',to:'result',d:'M1200 317H1428',kind:'scalar',modes:['overlap','done'],label:[1345,306,'load_value']},
    {id:'csr-result',from:'csr',to:'result',d:'M1200 587.5H1428',kind:'scalar',modes:['overlap','done'],label:[1380,577,'csr']},
    {id:'link-result',from:'idex',to:'result',d:'M761 625H1428',kind:'scalar',modes:['overlap','done'],label:[1380,615,'link']},
    {id:'result-wb',from:'result',to:'exwb',d:'M1454 465H1466V417H1480',kind:'scalar',modes:['overlap','done']},
    {id:'retire',from:'exwb',to:'wb',d:'M1506 417H1540',kind:'scalar',modes:['overlap','done']},
    {id:'writeback',from:'wb',to:'gpr',d:'M1615 545V850H560V730',kind:'scalar',modes:['overlap','done'],label:[1160,842,'wb_value → GPR / WB-to-ID forwarding']},
    {id:'redirect',from:'branch',to:'nextpc',d:'M1200 700H1230V820H83.5',kind:'scalar',modes:['overlap','done'],label:[395,810,'branch_target']},
    {id:'redirect-select',from:'branch',to:'nextpc',d:'M1200 677H1345V-45H140V735H83.5V755',kind:'control',modes:['overlap','done'],label:[1010,-32,'branch_taken']},
    {id:'nextpc-pc',from:'nextpc',to:'pc',d:'M57.5 802.5H20V405H50',kind:'scalar',modes:['overlap','done'],label:[24,737,'next_pc']},
    {id:'pc-increment',from:'pc',to:'pc4',d:'M90 455V540',kind:'scalar',modes:['overlap','done']},
    {id:'pc4-next',from:'pc4',to:'nextpc',d:'M122.5 560H150V775H83.5',kind:'scalar',modes:['overlap','done'],label:[91,765,'PC + 4']},
    {id:'capture-ex',from:'idex',to:'issue',d:'M761 772.5H850',kind:'command',modes:['setup','start','sync','done'],label:[770,761,'inst/GPR']},
    {id:'request',from:'issue',to:'capture',d:'M1170 800V918H217V957',kind:'command',modes:['setup','start','sync','done'],label:[300,910,'accel_req_inst + zero-extended captured GPR']},
    {id:'command',from:'capture',to:'dispatch',d:'M344 603H424',kind:'command',modes:['setup','start','sync','done'],label:[351,587,'req']},
    {id:'dispatch-launch',from:'dispatch',to:'launch',d:'M704 603H785',kind:'command',modes:['setup','start'],label:[716,586,'cmd']},
    {id:'dispatch-sync',from:'dispatch',to:'join',d:'M564 557V540H1373V557',kind:'control',modes:['sync','done'],label:[1090,532,'sync(target)']},
    {id:'response',from:'join',to:'issue',d:'M1373 557V439H1128',kind:'control',modes:['start','sync','done'],label:[1388,470,'accel_resp_valid']},
    {id:'start-response',from:'launch',to:'join',d:'M1070 603H1240',kind:'control',modes:['start'],label:[1086,587,'command response']},
    {id:'launch-bus',from:'launch',to:'tensor',d:'M927 649V707H518V771',kind:'command',modes:['setup','start'],target:'tensor',label:[536,697,'set_* / start(target)']},
    ...[['dma',804],['actu',1090],['cmpu',1376]].map(([id,x])=>({id:'launch-'+id,from:'launch',to:id,d:`M927 649V707H${x}V771`,kind:'command',modes:['setup','start'],target:id})),
    ...[['tensor',518,636],['dma',804,922],['actu',1090,1208],['cmpu',1376,1494]].flatMap(([id,x,right])=>[
      {id:'status-'+id,from:id,to:'join',d:`M${right} 820H${right+16}V927H1530V625H1507`,kind:'control',modes:['sync','done'],target:id},
      {id:'memory-'+id,from:id,to:'memory',d:`M${x} 871V989`,kind:'memory',modes:['overlap'],target:id}
    ])
  ];
  // Keep the lower parallel-engine drawing, translated below the taller scalar
  // datapath. All paths here use absolute M/H/V commands.
  const lowerEdges = ['command','dispatch-launch','dispatch-sync','start-response','launch-bus','launch-dma','launch-actu','launch-cmpu'];
  function shiftPath(path,dy) {
    return path.replace(/M([\d.]+) ([\d.]+)|V([\d.]+)/g,(_,x,y,v)=>x===undefined?'V'+(+v+dy):`M${x} ${+y+dy}`);
  }
  edges.forEach(e=>{
    if(lowerEdges.includes(e.id)||e.id.startsWith('status-')||e.id.startsWith('memory-')) {
      e.d=shiftPath(e.d,400);if(e.label)e.label[1]+=400;
    }
    if(e.id==='response'){e.d='M1373 957V-20H1365V725H1170V745';e.label=[1280,-29,'ASIC response'];}
  });
  const modes = {
    cache:{number:'06 / CACHE CONTROL',title:'Cache maintenance and 64-bit address headers',body:'Gray sidebands summarize CSR/system control of I-cache, D-cache and DTCM. Read the maintenance handshake, WB-committed headers and platform routing notes below.'},
    all:{number:'00 / OVERVIEW',title:'One instruction stream, parallel execution paths',body:'RV32 runs the control program above; ASIC commands configure and launch independent work below. Select a block to inspect its role and RTL source.'},
    setup:{number:'01 / CAPTURE',title:'Capture GPR parameters into the command',body:'set_* carries an EX-captured GPR value and imm8 to configure target work. The ASIC does not reread live GPR state later.'},
    start:{number:'02 / FORK',title:'Start submits work to an independent engine',body:'Start waits for command acceptance or launch response, rather than whole-job completion. Insufficient target capacity can still backpressure scalar issue.'},
    overlap:{number:'03 / OVERLAP',title:'Scalar and ASIC engines make progress together',body:'Scalar can prepare subsequent indices and pointers while accepted engine work progresses. Overlap requires satisfied data dependencies and available shared resources.'},
    sync:{number:'04 / JOIN WAIT',title:'Sync retains EX until the target drains',body:'A pending target-specific sync retains EX ownership and backpressures admission. ASIC work continues; other engines are not globally stopped by this join.'},
    done:{number:'05 / RESUME',title:'The response releases EX and scalar continues',body:'When the target drain condition is met, sync receives a completion response and proceeds to WB. Other ASIC engines may still be running.'}
  };
  const svgStyle = `
    svg{--sheet:#111a28;--ink:#dce5f0;--muted:#8c9eb5;--rule:#29394e;--accent:#6ee7cf;--blue:#85adff;--amber:#ffc578;--dot:#223149;--panel:#141e2d;--cache:#48525f;background:var(--sheet)}
    svg[data-theme="light"]{--sheet:#fafcfe;--ink:#21324a;--muted:#586c84;--rule:#c9d4df;--accent:#087a68;--blue:#315dc0;--amber:#a8590b;--dot:#dce4ed;--panel:#e9eef3;--cache:#818b95}
    text{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;fill:var(--ink)}
    .bg{fill:var(--sheet)}.grid-dot{fill:var(--dot)}.rule{stroke:var(--rule);stroke-width:1}.lane-num{font-size:11px;fill:var(--accent);letter-spacing:2px}.lane-name{font-size:19px;font-weight:700;letter-spacing:2px}.stage{font-size:13px;fill:var(--muted);letter-spacing:2px}.note{font-size:11px;fill:var(--muted)}.tiny{font-size:10px;fill:var(--muted)}.wire{fill:none;stroke-width:1.5;stroke:var(--ink);stroke-linejoin:round}.edge-command .wire{stroke:var(--accent);stroke-width:1.8}.edge-control .wire{stroke:var(--blue);stroke-dasharray:6 5}.edge-cache .wire{stroke:var(--cache);stroke-dasharray:3 5;stroke-width:1.1}.edge-cache .junction{fill:var(--cache)}.edge-memory .wire{stroke:var(--muted);stroke-width:1.4}.wire-label{font-size:10px;fill:var(--muted);paint-order:stroke;stroke:var(--sheet);stroke-width:5;stroke-linejoin:round}.edge-command .wire-label{fill:var(--accent)}.edge-control .wire-label{fill:var(--blue)}
    .node{cursor:pointer;outline:none}.box{fill:var(--sheet);stroke:var(--ink);stroke-width:1.4}.node-register .box{fill:var(--panel)}.node-command .box,.node-thread .box{stroke:var(--accent)}.node-control .box{stroke:var(--blue)}.node-memory .box{stroke:var(--muted)}.node-title{font-family:"Arial Narrow","Helvetica Neue",Arial,sans-serif;font-size:18px;font-weight:700}.node-sub{font-size:10.5px;fill:var(--muted)}.register-title{font-size:12px;font-weight:700;letter-spacing:1px}.pin{fill:var(--sheet);stroke:var(--ink);stroke-width:1.3}.port-label{font-size:9px;fill:var(--muted)}.control-port{fill:var(--blue)}.mux-number{font-size:9px;fill:var(--muted)}.symbol-label{font-size:10px;fill:var(--muted)}.symbol-rule{fill:none;stroke:var(--muted);stroke-width:.8}.engine-mark{fill:var(--accent)}.engine-index{font-size:10px;fill:var(--accent);letter-spacing:2px}.junction{fill:var(--ink)}.edge-command .junction{fill:var(--accent)}.node:focus-visible .box,.node:hover .box,.node.selected .box{stroke:var(--amber);stroke-width:2.5}.node.selected .node-title{fill:var(--amber)}.dynamic-label{font-size:10px;fill:var(--amber);font-weight:700}.status{fill:var(--panel);stroke:var(--rule);stroke-width:1}.status-text{font-size:10px;fill:var(--accent)}.hold-badge{fill:var(--amber)}.hold-text{fill:var(--sheet);font-size:11px;font-weight:700}
    .cache-view{--cache:#8c99a8}.cache-view[data-theme="light"]{--cache:#5d6977}.tracing .trace:not(.active){opacity:.16}.trace{transition:opacity .24s}.tracing .active .wire{stroke-width:2.4}.tracing .active.node .box{stroke-width:2}.trace.flow .wire{stroke-dasharray:7 6;animation:travel 1s linear infinite}@keyframes travel{to{stroke-dashoffset:-26}}@media(prefers-reduced-motion:reduce){.trace{transition:none}.trace.flow .wire{animation:none}}
  `;
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const text = (cls,x,y,value,anchor='start')=>`<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(value)}</text>`;
  function renderNode(n) {
    const {x,y,w,h}=n, cx=x+w/2;
    let box=`<rect class="box" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    let title=text('node-title',x+16,y+29,n.title)+(n.lines||[]).map((line,i)=>text('node-sub',x+16,y+49+i*15,line)).join('');
    if(n.kind==='register') {
      title=`<text class="register-title" transform="translate(${x+17},${y+h/2}) rotate(-90)" text-anchor="middle">${esc(n.title)}</text><path class="pin" d="M${x+5} ${y+h}l8 -10 8 10"/>`;
    } else if(n.shape==='alu') {
      box=`<path class="box" d="M${x} ${y}L${x+w} ${y+28}V${y+h-28}L${x} ${y+h}V${y+h*.6}L${x+22} ${y+h/2}L${x} ${y+h*.4}Z"/>`;
      title=text('node-title',cx+8,y+68,'ALU','middle')+text('node-sub',cx+8,y+90,'RV32IM','middle')+text('port-label',x+6,y+35,'A')+text('port-label',x+6,y+h-35,'B');
    } else if(n.shape==='ifu') {
      title=text('node-title',cx,y+62,'IFU','middle')+text('node-sub',cx,y+84,'fetch / FIFO','middle');
      title+=text('port-label',x+6,398,'PC')+text('port-label',x+w-6,352,'inst','end')+text('port-label',x+w-6,337,'pc','end');
    } else if(n.shape==='predecode') {
      title=text('node-title',cx,y+75,'Predecode','middle')+text('port-label',cx,y+95,'register indices','middle')+text('port-label',x+w-6,579,'rd_idx','end');
      title+=text('port-label',x+w-6,605,'rs1_idx','end')+text('port-label',x+w-6,670,'rs2_idx','end');
    } else if(n.shape==='interface') {
      title=text('symbol-label',cx,y+18,n.title,'middle');
    } else if(n.shape==='mux') {
      box=n.flip?`<path class="box" d="M${x+w} ${y}L${x} ${y+13}V${y+h-13}L${x+w} ${y+h}Z"/>`:`<path class="box" d="M${x} ${y}L${x+w} ${y+13}V${y+h-13}L${x} ${y+h}Z"/>`;
      title=text('mux-number',x+7,n.id==='result'?317:y+25,'0')+text('mux-number',x+7,n.id==='result'?465:n.id==='nextpc'?825:y+h-17,'1');
      if(n.id==='result')title+=text('mux-number',x+7,587.5,'2')+text('mux-number',x+7,625,'3');
    } else if(n.shape||n.id==='pc'||n.id==='branch') {
      const ty=n.shape==='completion'?y+20:n.id==='decode'?y+58:n.id==='gpr'?y+75:n.id==='pc'?y+46:n.id==='fetch'?y+95:n.id==='wb'?y+91:n.id==='lsu'?y+40:n.shape==='issue'?y+26:n.shape==='adder'?y+27:y+36;
      title=text('node-title',cx,ty,n.title,'middle')+(n.lines||[]).map((line,i)=>text('node-sub',cx,ty+20+i*15,line,'middle')).join('');
      if(n.id==='decode')title+=text('port-label',x+6,y+40,'rd')+text('port-label',x+w-6,339,'ctrl','end')+text('port-label',x+6,y+22,'inst[31:0]')+text('port-label',x+w-6,354,'imm','end')+text('port-label',505,y+h-10,'use_rs1','middle')+text('port-label',575,y+h-10,'use_rs2','middle');
      if(n.id==='gpr')title+=text('port-label control-port',x+w-6,y+20,'gpr_stall','end')+text('port-label',x+6,605,'rs1_idx')+text('port-label',x+6,670,'rs2_idx')+text('port-label',x+w-6,605,'rs1','end')+text('port-label',x+w-6,670,'rs2','end')+text('port-label',cx,y+h-10,'we   rd   wd','middle');
      if(n.id==='pc')title+=text('port-label',cx,y+14,'pc_en','middle')+`<path class="pin" d="M${x+7} ${y+h}l7 -9 7 9"/>`;
      if(n.id==='branch')title+=text('port-label',x+6,y+15,'rs1')+text('port-label',x+6,y+40,'rs2');
      if(n.id==='lsu')title+=text('port-label',cx,y+14,'load / store','middle')+text('port-label',cx,y+h-8,'base / imm / data','middle');
    }
    return `<g id="node-${n.id}" class="trace node node-${n.kind}" data-node="${n.id}" role="button" tabindex="0" aria-label="${esc(n.title)}: inspect block"><title>${esc(n.detail)}</title>${box}${title}${n.kind==='thread'?`<rect class="engine-mark" x="${x}" y="${y}" width="4" height="${h}"/><text class="dynamic-label" data-status="${n.id}" x="${x+16}" y="${y+h-10}"></text>`:''}</g>`;
  }
  function render() {
    const defs = ['scalar','command','control','memory','cache'].map(k=>`<marker id="arrow-${k}" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${({scalar:'var(--ink)',command:'var(--accent)',control:'var(--blue)',memory:'var(--muted)',cache:'var(--cache)'})[k]}"/></marker>`).join('');
    return compactSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1740 1730" width="1740" height="1730" role="img" aria-labelledby="schematic-title schematic-desc"><title id="schematic-title">Edge E3 — RV32 four-stage pipeline and parallel ASIC hardware threads</title><desc id="schematic-desc">Textbook-style datapath with IFU frontend and separate IF-stage Predecode, IF/ID, ID/EX, EX/WB registers, operand and result multiplexers, integer ALU including a Mul/div functional group, a separate CSR block and Branch unit, and LSU. FPU omitted. Captured GPR commands fork Tensor, DMA, ACTU and CMPU work; sync retains scalar EX ownership until target completion.</desc><style>${svgStyle}</style><defs>${defs}<pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><circle class="grid-dot" cx="8" cy="8" r=".85"/></pattern></defs><rect class="bg" width="1740" height="1730"/><rect width="1740" height="1730" fill="url(#grid)"/>
      <path class="rule" d="M32 61H1708M32 1140H1708M32 1384H1708"/>
      <text class="lane-num" x="40" y="34">01 / SCALAR CONTROL THREAD</text><text class="lane-name" x="40" y="56">RV32 · FOUR STAGES</text><text class="note" x="1700" y="42" text-anchor="end">single issue · in order · EX owns variable-latency work</text>
      <g id="datapath" transform="translate(0,240)">
      <text class="stage" x="200" y="135" text-anchor="middle">IF</text><text class="stage" x="450" y="115" text-anchor="middle">ID</text><text class="stage" x="1040" y="135" text-anchor="middle">EX</text><text class="stage" x="1615" y="135" text-anchor="middle">WB</text>
      <text class="tiny" x="1560" y="608">No MEM stage:</text><text class="tiny" x="1560" y="627">LSU belongs to EX.</text>
      <text class="lane-num" x="40" y="1096">02 / ASIC COMMAND PATH</text><text class="lane-name" x="40" y="1123">HARDWARE THREADS</text>
      <text class="note" x="40" y="1189">start ≈ fork</text><text class="note" x="40" y="1210">sync ≈ join</text><text class="tiny" x="40" y="1251">Independent engines;</text><text class="tiny" x="40" y="1269">not separate ISA contexts.</text><text class="tiny" x="40" y="1323">Control path ↗</text><text class="tiny" x="40" y="1409">Data fabric →</text>
      ${edges.map(e=>`<g class="trace edge edge-${e.kind}" data-edge="${e.id}"><path class="wire" d="${e.d}" marker-end="url(#arrow-${e.kind})"/>${(e.dots||[]).map(([x,y])=>`<circle class="junction" cx="${x}" cy="${y}" r="2.5"/>`).join('')}${e.label?`<text class="wire-label" x="${e.label[0]}" y="${e.label[1]}">${esc(e.label[2])}</text>`:''}</g>`).join('')}
      ${nodes.map(renderNode).join('')}
      <text class="tiny" x="423" y="1154">THREAD 00</text><text class="tiny" x="709" y="1154">THREAD 01</text><text class="tiny" x="995" y="1154">THREAD 02</text><text class="tiny" x="1281" y="1154">THREAD 03</text>
      <text class="wire-label" x="1040" y="1319">target busy / drain status → join gate</text><text class="wire-label" x="547" y="1367">Data paths · schematic connections, not physical port widths</text>
      <g id="ex-hold" visibility="hidden"><rect class="hold-badge" x="1000" y="145" width="218" height="26" rx="2"/><text class="hold-text" x="1109" y="162" text-anchor="middle">EX HELD · ASIC RUNS</text></g>
      <text id="join-target-label" class="dynamic-label" x="1256" y="1071"></text>
      <text class="tiny" x="40" y="1475">EDGE E3 / Drawing 01</text><text class="tiny" x="1700" y="1475" text-anchor="end">Architectural view · no cycle / port / bandwidth equivalence implied</text>
      </g>
    </svg>`);
  }
  // Compact actual geometry, rather than scaling a <g>: keep font sizes and
  // vertical spacing intact. The generated paths use only M/L/H/V/C/Z commands.
  function compactSvg(markup) {
    const sx=.9, number=v=>String(Math.round(Number(v)*sx*1000)/1000);
    return markup.replace('viewBox="0 0 1740 1730"','viewBox="0 0 1566 1730"')
      .replace(/\b(x|x1|x2|cx|width)="([\d.-]+)"/g,(_,key,value)=>`${key}="${number(value)}"`)
      .replace(/translate\(([\d.-]+),/g,(_,value)=>`translate(${number(value)},`)
      .replace(/\bd="([^"]+)"/g,(_,path)=>{
        let command='', index=0;
        return 'd="'+path.replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g,token=>{
          if(/^[a-zA-Z]$/.test(token)){command=token.toUpperCase();index=0;return token;}
          const isX=command==='H'||command!=='V'&&index%2===0;
          index++;return isX?number(token):token;
        })+'"';
      });
  }
  window.E3Architecture = {nodes,edges,modes,render};
})();
