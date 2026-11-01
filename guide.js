/* SPDX-License-Identifier: Apache-2.0 */
(() => {
  const example = 'example/tensor/matmul64x64_128tokens_tiled_circular.cpp';
  // Literal source lines with their original line numbers; gaps are explicit.
  const code = [
    [133,'edge_tensor_setin(static_cast<addr_t>(reinterpret_cast<uintptr_t>('],
    [134,'    &dtcm->x[k_blk * MM64_TOKENS * MM64_TILE])));'],
    [135,'edge_tensor_setout(static_cast<addr_t>(reinterpret_cast<uintptr_t>('],
    [136,'    &dtcm->y[out_blk * MM64_TOKENS * MM64_TILE])));'],
    [137,'edge_tensor_setpsum(static_cast<addr_t>(reinterpret_cast<uintptr_t>('],
    [138,'    psum_ptr)));'],
    [139,'edge_tensor_start();'],
    [140,'if (tile_id + 1u < (MM64_BLOCKS * MM64_BLOCKS))'],
    [141,'    edge_tensor_wld_t_circular();'],
    [null,'// … remaining tile-loop iterations …'],
    [145,'edge_tensor_sync();'],[146,'edge_dma_sync();'],
    [null,'// …'],[148,'uintptr_t cycle_end = edge_get_cycle();']
  ];
  const steps = [
    {title:'Capture tile pointers',short:'Parameters',mode:'setup',target:'tensor',node:'capture',lines:[133,134,135,136,137,138],body:'Each tile configures input, output and partial-sum pointers. The custom instructions carry captured GPR values into the ordered command path. Reusing a register later does not change an accepted parameter.',scalar:'Issue configuration commands in order.',engine:'Configuration is updated for subsequent work.'},
    {title:'Submit the tile',short:'Start',mode:'start',target:'tensor',node:'launch',lines:[139],body:'edge_tensor_start() submits the configured tile. Scalar waits for the command response; target capacity or launch readiness may delay it. The response does not mean the full matrix operation has finished.',scalar:'Wait for the start response, then advance.',engine:'Accepted work may execute independently.'},
    {title:'Prepare subsequent work',short:'Overlap',mode:'overlap',target:'tensor',node:'tensor',lines:[140,141],body:'After start, scalar checks whether another tile remains and requests the next circular weight load. The surrounding loops calculate subsequent tile pointers. This permits overlap with accepted tensor work; queues, dependencies and memory arbitration still impose limits.',scalar:'Evaluate loop conditions and issue subsequent work.',engine:'Tensor and accepted DMA work may progress.'},
    {title:'Join Tensor work',short:'Tensor join',mode:'sync',target:'tensor',node:'join',lines:[145],body:'After all tile starts, edge_tensor_sync() waits for earlier Tensor work to drain. The instruction retains EX until its response arrives. An empty ID slot may still fill, and older WB work may retire.',scalar:'EX owns the pending Tensor sync.',engine:'Tensor progresses toward its drain condition.'},
    {title:'Join DMA separately',short:'DMA join',mode:'sync',target:'dma',node:'join',lines:[146],body:'The next instruction joins DMA explicitly. Tensor completion does not imply DMA completion. This sync can return promptly if DMA has already drained, or retain EX until the DMA target condition is satisfied.',scalar:'EX waits only if the DMA join is still pending.',engine:'DMA continues; other engines are not globally paused.'},
    {title:'Continue scalar execution',short:'Resume',mode:'done',target:'dma',node:'wb',lines:[148],body:'Once both joins have returned, the program reads the cycle counter and later validates its output. This walkthrough shows source ordering only; the displayed slots do not report this example’s measured latency.',scalar:'Retire completed commands and read cycle_end.',engine:'The joined Tensor and DMA work has drained.'}
  ];
  const contracts = {
    fetch:['Fetch PC; imem response; ready / redirect','Instruction-matched PC, instruction and error parcels','Frontend capacity and downstream admission govern parcel transfer.'],
    predecode:['IF instruction','rs1_idx, rs2_idx, rd_idx and register classification','Metadata follows the accepted instruction into ID.'],
    ifid:['Accepted instruction parcel and predecoded metadata','ID instruction, PC and register metadata','Capture on if_id_fire; pipeline kill clears ownership.'],
    decode:['ID instruction, predecoded rd and register classes','Immediate, operand-use masks and EX/WB controls','Legality and dependency checks participate in ID admission.'],
    gpr:['IF-issued read indices; operand-use controls; WB forwarding','Resolved operands and local gpr_stall','EX rd/we participates in local RAW checks; masks apply at EX capture.'],
    idex:['Admitted ID instruction, operands and issue controls','Owned EX slot, unit inputs and carried WB controls','Retains ownership until the current instruction can complete.'],
    interlock:['GPR/CSR hazards, EX capacity, WB status and kill','if_ready, if_id_fire and id_capture_enable','An empty ID may fill while EX remains occupied.'],
    alu:['Captured operands, immediate/PC selection and EX controls','Integer or Mul/div result; mul_result_valid','Ordinary integer operations use the immediate path; Mul/div uses its owned completion.'],
    lsu:['Base operand, immediate, store data and EX controls','Load result, memory request and lsu_done','Memory-class and mem_started_q qualify completion.'],
    csr:['Captured CSR controls, operand/uimm and counter state','CSR/counter result and system-control sidebands','Most CSR reads use the static path; instret has a readiness condition. State commits in WB.'],
    branch:['EX PC, rs1, rs2, immediate and branch controls','Taken condition and redirect target','Branch uses fast/immediate completion; there is no separate branch_done.'],
    issue:['Captured instruction and GPR operands; request ready','ASIC request and response-qualified completion','accel_done requires accelerator class, started state and accel_resp_valid.'],
    'ex-completion':['Guarded unit done/readiness and immediate/fault state','ex_release_ready for EX capacity','Actual transfer also requires valid ownership and the RTL run/terminal guards.'],
    exwb:['Completed EX result and carried rd/WB controls','WB result and commit metadata','Pending EX work stays in EX until its completion condition.'],
    wb:['Completed result, destination and commit controls','GPR/CSR commit, retirement and forwarding','Commit follows the in-order retirement rules.'],
    capture:['ASIC32 instruction and captured GPR parameter','Stable command payload','The payload belongs to this instruction, rather than live register state.'],
    launch:['Ordered target command and configuration','Accepted target work and start response','Target readiness can backpressure the command. Start response is distinct from whole-job completion.'],
    join:['Target-specific sync command and engine status','Response to the scalar-owned ASIC instruction','The selected target must drain its earlier accepted work.']
  };
  const waits = [
    {id:'raw',title:'GPR dependency',node:'gpr',mode:'overlap',hold:'The dependent ID instruction cannot advance with unresolved operands.',progress:'The older EX instruction and already accepted ASIC work can continue.',release:'The read-port RAW hazard clears through the RTL result/forwarding path.',source:'src/edge-32/rtl/edge_32_gpr_read_port.sv'},
    {id:'memory',title:'LSU response',node:'lsu',mode:'overlap',hold:'The memory instruction retains EX while its owned LSU transaction is pending.',progress:'Memory services the request; accepted ASIC work can progress subject to shared-resource arbitration.',release:'Memory class, mem_started_q and lsu_done make the completion path ready.',source:'src/edge-32/rtl/ex/completion.svh'},
    {id:'muldiv',title:'Mul/div result',node:'alu',mode:'overlap',hold:'The multiply/divide instruction retains EX during multicycle execution.',progress:'The Mul/div unit runs; previously launched ASIC engines remain independent.',release:'is_muldiv && mul_started_q && mul_result_valid makes EX ready to release.',source:'src/edge-32/rtl/ex/completion.svh'},
    {id:'join',title:'ASIC sync',node:'join',mode:'sync',hold:'Sync retains EX until the selected target returns its response.',progress:'Target work continues, other engines can run, and older WB work may retire. An empty ID slot may fill.',release:'The target drain condition permits the response; accel_done then releases EX capacity.',source:'src/edge-32/rtl/edge_accel_pipe.v'}
  ];
  window.E3Guide={example,code,steps,contracts,waits};
})();
