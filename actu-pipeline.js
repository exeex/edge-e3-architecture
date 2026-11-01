/* SPDX-License-Identifier: Apache-2.0 */
// Functional, mode-selected result dependencies; not clock-enable or timing claims.
(() => {
  const base='src/edge-asic/rtl/actu/';
  const sources={
    core:{path:base+'edge_actu.v',token:'edge_actu_exp_ingress #',line:141},
    ingress:{path:base+'rtl/edge_actu_exp_ingress.v',token:'function [21:0] native_exp_operand;',line:40},
    frontend:{path:base+'rtl/edge_actu_exp_frontend.v',token:'assign den_raw_s2 =',line:343},
    select:{path:base+'rtl/edge_actu_exp_frontend.v',token:'if (mode_s2 == EDGE_ACTU_MODE_RCP_ONLY)',line:422},
    backend:{path:base+'rtl/edge_actu_rcp_backend.v',token:'edge_actu_rcp_rsqrt_classified_pipe #',line:77},
    final:{path:base+'rtl/edge_actu_finalizer.v',token:'assign stage3_bypass_bf22 =',line:326},
    rounding:{path:base+'rtl/edge_actu_finalizer.v',token:'wire [15:0] finite_result=bf22_to_bf16',line:335},
    sum:{path:base+'edge_actu.v',token:'edge_actu_softmax_rsum x_softmax_rsum(',line:128},
    software:{path:'src/edge-32/include/edge32_intrinsic.hpp',token:'#define EDGE_ACCEL_CSR_ACTU_EXP_SUM',line:774}
  };
  const nodes=[
    ['input',40,260,120,70,'BF16 input','x · SRAM stream'],
    ['prepare',200,260,160,70,'Prepare EXP','−|x| / −2|x| / x−m'],
    ['exp',400,260,160,70,'Shared EXP','range → exp2 → pack'],
    ['scalar',200,100,160,70,'Scalar','m / epsilon / S'],
    ['one',600,100,150,55,'1','constant'],
    ['subtract',600,210,150,70,'1 − e','tanh numerator'],
    ['add',600,430,150,70,'1 + e','fused denominator'],
    ['epsilon',600,650,150,70,'x + epsilon','RSQRT divisor'],
    ['nselect',780,180,80,190,'N select','mode'],
    ['dselect',780,430,80,240,'D select','mode'],
    ['rcp',960,510,160,80,'RCP / RSQRT','r = 1/D or 1/√D'],
    ['multiply',1150,235,160,80,'N × r','BF22 multiply'],
    ['silu-multiply',1370,150,180,70,'SiLU × x','x × sigmoid(x)'],
    ['tanh-sign',1370,350,180,70,'Tanh sign restore','sign(x) → result sign'],
    ['result-select',1600,180,80,500,'Result','mode'],
    ['bf16',1730,390,150,80,'BF16 convert','round · output policy'],
    ['output',1910,395,100,70,'Output','SRAM write'],
    ['sum',960,780,180,70,'Row sum Σe','clear · last · done'],
    ['sumcsr',1200,780,250,70,'EXP_SUM CSR','software reads full sum']
  ];
  // Separate wires allow mode selection to illuminate only consumed operands.
  const paths=[
    ['input-prepare','M160 295H200','data'],['prepare-exp','M360 295H400','exp'],
    ['scalar-prepare','M280 170V260','control'],
    ['exp-subtract','M560 295H580V245H600','numerator'],
    ['subtract-n','M750 245H780','numerator'],
    ['one-n','M750 127H765V205H780','numerator'],
    ['exp-n','M560 295H580V325H780','numerator'],
    ['input-n','M140 330V400H760V345H780','data'],
    ['exp-add','M560 295H580V465H600','denominator'],
    ['add-d','M750 465H780','denominator'],
    ['input-d','M100 330V525H780','data'],
    ['scalar-d','M360 135H380V585H780','control'],
    ['input-epsilon','M100 330V685H600','data'],
    ['scalar-epsilon','M360 150H390V750H675V720','control'],
    ['epsilon-d','M750 685H770V645H780','denominator'],
    ['numerator','M860 275H1150','numerator'],
    ['divisor','M860 550H960','denominator'],
    ['reciprocal','M1120 550H1135V295H1150','denominator'],
    ['quotient','M1310 275H1570V300H1600','numerator'],
    ['quotient-silu','M1310 275H1340V185H1370','numerator'],
    ['quotient-tanh','M1310 275H1340V385H1370','numerator'],
    ['silu-result','M1550 185H1570V205H1600','numerator'],
    ['tanh-result','M1550 385H1600','numerator'],
    ['direct-rcp','M1120 566H1580V485H1600','denominator'],
    ['direct-exp','M560 310H575V755H1590V605H1600','exp'],
    ['payload-x','M60 330V820H900V740H1325V230H1460V220','data'],
    ['payload-sign','M60 330V820H900V740H1460V420','data'],
    ['result','M1680 430H1730','data'],['bf16-output','M1880 430H1910','data'],
    ['reduce','M575 755H1050V780','exp'],['sum-csr','M1140 815H1200','exp']
  ];
  const modes=[
    {id:'sigmoid',code:2,label:'Sigmoid',formula:'sigmoid(x) = N / D',n:'x < 0 ? e : 1',d:'1 + e',e:'e = exp(−|x|)',result:'N × reciprocal(D)',active:['input','prepare','exp','add','nselect','dselect','rcp','multiply','output','one','result-select','bf16'],paths:['result','input-prepare','prepare-exp','exp-add','add-d','numerator','divisor','reciprocal','quotient','one-n','exp-n','bf16-output'],body:'The stable form keeps e between zero and one. The frontend chooses e for negative x and 1 otherwise, and forms 1 + e. The backend computes the reciprocal; the finalizer multiplies the aligned numerator by it.',note:'The slide’s 1/(1+exp(−x)) is the mathematical identity. The RTL uses the equivalent sign-dependent form above.',evidence:['ingress','frontend','select','backend','final']},
    {id:'silu',code:3,label:'SiLU',formula:'SiLU(x) = x × N / D',n:'x < 0 ? e : 1',d:'1 + e',e:'e = exp(−|x|)',result:'x × (N × reciprocal(D))',active:['input','prepare','exp','add','nselect','dselect','rcp','multiply','output','one','result-select','bf16','silu-multiply'],paths:['result','input-prepare','prepare-exp','exp-add','add-d','numerator','divisor','reciprocal','one-n','exp-n','bf16-output','quotient-silu','silu-result','payload-x'],body:'SiLU reuses the complete sigmoid route. The original x travels beside the nonlinear work, then a second multiply in the finalizer forms x × sigmoid(x).',note:'Payload and numerator are latency-aligned with the reciprocal before post arithmetic. The highlighted payload is a carried value, not a second SRAM read.',evidence:['ingress','select','backend','final']},
    {id:'tanh',code:4,label:'Tanh',formula:'tanh(x) = sign(x) × N / D',n:'1 − e',d:'1 + e',e:'e = exp(−2|x|)',result:'restore sign of N × reciprocal(D)',active:['input','prepare','exp','add','nselect','dselect','rcp','multiply','output','subtract','result-select','bf16','tanh-sign'],paths:['result','input-prepare','prepare-exp','exp-add','add-d','numerator','divisor','reciprocal','exp-subtract','subtract-n','bf16-output','quotient-tanh','tanh-result','payload-sign'],body:'The same EXP block takes −2|x|. The frontend forms both 1 − e and 1 + e; the backend inverts the denominator. The finalizer restores the original sign after multiplication.',note:'The sign route carries the original sign into its own restore block. Tanh does not use SiLU’s second numerical multiply.',evidence:['ingress','frontend','final']},
    {id:'softmax',code:5,label:'Softmax · Exp + Sum',formula:'Pass 1: eᵢ = exp(xᵢ − m), S = Σeᵢ',n:'eᵢ',d:'S is reduced across the row',e:'eᵢ = exp(xᵢ − m)',result:'store eᵢ; publish S in EXP_SUM',active:['input','prepare','exp','scalar','output','sum','sumcsr','result-select','bf16'],paths:['result','input-prepare','prepare-exp','scalar-prepare','direct-exp','reduce','sum-csr','bf16-output'],body:'A supplied row maximum m is subtracted before EXP. This pass writes each exponential and reduces a separate row sum. It does not divide each element by the still-incomplete sum.',note:'After actu_sync, software reads EXP_SUM, configures mode 7 and passes S with setscalar. The row maximum is supplied; no max-reduction block is implied inside ACTU.',evidence:['ingress','sum','software'],next:'normalize'},
    {id:'normalize',code:7,label:'Softmax · Normalize',formula:'Pass 2: yᵢ = stored_eᵢ / S',n:'stored BF16 eᵢ (input payload)',d:'S from scalar parameter',e:'EXP route bypassed',result:'stored_eᵢ × reciprocal(S)',active:['input','scalar','nselect','dselect','rcp','multiply','output','result-select','bf16'],paths:['result','input-n','scalar-d','numerator','divisor','reciprocal','quotient','bf16-output'],body:'Software points the input at the stored exponentials and supplies the completed sum S. The reciprocal route handles S; the finalizer selects the input payload as its multiplication numerator.',note:'This is a separate start/sync pass. There is no same-pass feedback from the row reducer into the reciprocal input. The full sum uses the scalar’s BF22 slice; stored exponentials are BF16.',evidence:['select','backend','final','software'],next:'softmax'},
    {id:'exp',code:0,label:'EXP',formula:'y = exp(x)',n:'exp(x)',d:'unused',e:'e = exp(x)',result:'direct e → BF16 output',active:['input','prepare','exp','output','result-select','bf16'],paths:['result','input-prepare','prepare-exp','direct-exp','bf16-output'],body:'EXP-only uses the shared exponential ingress and frontend. The aligned exponential is selected directly at the finalizer; reciprocal and quotient results do not contribute to the output.',note:'Dim paths mean their numerical results are not selected. They do not assert hardware clock gating or zero switching.',evidence:['ingress','final']},
    {id:'rcp',code:1,label:'Reciprocal',formula:'y = 1 / x',n:'implicit 1',d:'x',e:'EXP result unused',result:'direct reciprocal(x) → output',active:['input','dselect','rcp','output','result-select','bf16'],paths:['result','input-d','divisor','direct-rcp','bf16-output'],body:'The frontend selects the original input as the divisor. The backend runs the reciprocal core; the finalizer selects that result without using the N × r product.',note:'Direct modes still use registered transport and alignment. The drawing emphasizes selected result dependencies, not a zero-latency shortcut.',evidence:['select','backend','final']},
    {id:'rsqrt',code:6,label:'RSQRT',formula:'y = 1 / √(x + epsilon)',n:'implicit 1',d:'x + epsilon',e:'EXP result unused',result:'direct reciprocal-square-root(D)',active:['input','scalar','epsilon','dselect','rcp','output','result-select','bf16'],paths:['result','input-epsilon','scalar-epsilon','epsilon-d','divisor','direct-rcp','bf16-output'],body:'The frontend forms x + epsilon from input and scalar, and the shared nonlinear backend selects RSQRT rather than reciprocal. Its result is selected directly for BF16 output.',note:'This describes the non-negative numerical domain. Input classification and exceptional-value actions travel beside the arithmetic and are applied at the output.',evidence:['select','backend','final']}
  ];
  for(const mode of modes)mode.evidence.push('rounding');
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const style=`.a-bg{fill:var(--bg,#0c111b)}.a-region{fill:none;stroke:var(--rule,#29394e);stroke-dasharray:5 6}.a-box{fill:var(--panel,#131d2b);stroke:var(--ink,#dce5f0);stroke-width:1.4}.a-title{font:600 18px sans-serif;fill:var(--ink,#dce5f0)}.a-sub{font:11px monospace;fill:var(--muted,#8c9eb5)}.a-caption{font:11px monospace;fill:var(--muted,#8c9eb5)}.a-heading{font:600 15px monospace;fill:var(--ink,#dce5f0)}.a-wire{fill:none;stroke-width:2;stroke-linejoin:round}.a-data{stroke:#85adff}.a-exp{stroke:#6ee7cf}.a-numerator{stroke:#6ee7cf}.a-denominator{stroke:#ffc578}.a-control{stroke:#b39be8;stroke-dasharray:5 5}.a-arrow-data{fill:#85adff}.a-arrow-exp,.a-arrow-numerator{fill:#6ee7cf}.a-arrow-denominator{fill:#ffc578}.a-arrow-control{fill:#b39be8}.a-dim{opacity:.16}.a-on{opacity:1}.a-on .a-box{stroke:#6ee7cf}.a-mux-title{font-size:13px}.a-on.a-den-node .a-box{stroke:#ffc578}.a-port{font:12px monospace;fill:var(--ink,#dce5f0)}`;
  function render(id='all'){
    const mode=modes.find(m=>m.id===id);const on=(kind,key)=>!mode||mode[kind].includes(key)?'a-on':'a-dim';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2030 930" role="img" aria-labelledby="actu-svg-title actu-svg-desc"><title id="actu-svg-title">ACTU shared numerator and denominator paths${mode?' — '+esc(mode.label):''}</title><desc id="actu-svg-desc">Front half prepares EXP, numerator and divisor; back half computes reciprocal or reciprocal square root and composes the result. Softmax reduction and normalization are separate software passes.</desc><style>${style}</style><defs>${['data','exp','numerator','denominator','control'].map(k=>`<marker id="actu-arrow-${k}" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L8 4L0 8Z" class="a-arrow-${k}"/></marker>`).join('')}</defs><rect class="a-bg" width="2030" height="930"/><text class="a-heading" x="44" y="42">01 / FRONT HALF · NUMERATOR &amp; DIVISOR PREPARE</text><text class="a-heading" x="924" y="42">02 / BACK HALF · DENOMINATOR INVERSE &amp; COMPOSE</text><rect class="a-region" x="24" y="72" width="850" height="815"/><rect class="a-region" x="904" y="72" width="1102" height="815"/>${paths.map(([key,d,kind])=>`<path data-actu-path="${key}" class="a-wire a-${kind} ${on('paths',key)}" d="${d}" marker-end="url(#actu-arrow-${kind})"/>`).join('')}${nodes.map(([key,x,y,w,h,title,sub])=>{
      const mux=key==='nselect'||key==='dselect'||key==='result-select';
      const shape=mux?`<path class="a-box" d="M${x} ${y}L${x+w} ${y+30}V${y+h-30}L${x} ${y+h}Z"/>`:`<rect class="a-box" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
      const textY=mux?y+h/2-5:y+28;
      return `<g data-actu-node="${key}" class="${on('active',key)} ${['add','epsilon','dselect','rcp'].includes(key)?'a-den-node':''}">${shape}<text class="a-title ${mux?'a-mux-title':''}" x="${x+w/2}" y="${textY}" text-anchor="middle">${esc(title)}</text><text class="a-sub" x="${x+w/2}" y="${textY+22}" text-anchor="middle">${esc(sub)}</text></g>`;
    }).join('')}<text class="a-port" x="880" y="265">N</text><text class="a-port" x="880" y="540">D</text><text class="a-caption" x="615" y="395">NUMERATOR CANDIDATES</text><text class="a-caption" x="615" y="625">DIVISOR CANDIDATES</text><text class="a-caption" x="927" y="258">aligned numerator</text><text class="a-caption" x="1490" y="592">direct r</text><text class="a-caption" x="520" y="845">original x / sign payload</text><text class="a-caption" x="1500" y="740">direct EXP result</text><text class="a-caption" x="1070" y="875">SOFTMAX: read S, then launch mode 7</text><text class="a-caption" x="44" y="912">Functional result dependencies · dim ≠ clock gated · classification / valid / alignment registers abstracted</text></svg>`;
  }
  window.E3ActuPipeline={sources,nodes,paths,modes,render,example:"example/fork_join/fork_join.cpp",code:[[21, "    edge_actu_setcsr<0, 2>();            // BF16 sigmoid"], [22, "    edge_actu_setin((const void *)buffers->input);"], [23, "    edge_actu_setout((void *)buffers->output);"], [24, "    edge_actu_setn(kCount);"], [25, "    edge_actu_start();                  // Fork: command response precedes drain"], [26, ""], [27, "    unsigned scalar = 0;"], [28, "    for (unsigned i = 0; i < 32; ++i)"], [29, "        __asm__ volatile(\"addi %0, %0, 1\" : \"+r\"(scalar));"], [30, ""], [31, "    edge_actu_sync();                   // Join: retain EX until ACTU drains"]]};
})();
