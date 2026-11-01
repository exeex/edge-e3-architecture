// SPDX-License-Identifier: Apache-2.0
// Catch source drift in the walkthrough without a build or browser dependency.
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(process.env.EDGE_CORES_ROOT||resolve(dir,'../..'));
const context={window:{}};
for(const file of ['architecture.js','guide.js','trace-data.js','tensor-trace-data.js','tensor-pipeline.js','actu-pipeline.js'])vm.runInNewContext(readFileSync(resolve(dir,file),'utf8'),context);
const model=context.window.E3Architecture,guide=context.window.E3Guide;
const ids=new Set(model.nodes.map(n=>n.id));
assert.equal(ids.size,model.nodes.length,'Node IDs must be unique');
for(const node of model.nodes)assert(existsSync(resolve(root,node.source)),`Missing RTL: ${node.source}`);
for(const edge of model.edges){assert(ids.has(edge.from),`Invalid source: ${edge.id}`);assert(ids.has(edge.to),`Invalid target: ${edge.id}`);}
const original=readFileSync(resolve(root,guide.example),'utf8').split('\n');
const lines=new Set();
for(const [line,text] of guide.code){if(line!==null){assert.equal(original[line-1]?.trim(),text.trim(),`Example changed at line ${line}; refresh the excerpt`);lines.add(line);}}
for(const step of guide.steps){assert(ids.has(step.node),`Missing guide node: ${step.node}`);assert(model.modes[step.mode],`Invalid guide mode: ${step.mode}`);assert(['tensor','dma','actu','cmpu'].includes(step.target));for(const line of step.lines)assert(lines.has(line),`Missing highlighted line ${line}`);}
for(const item of guide.waits){assert(ids.has(item.node));assert(model.modes[item.mode]);assert(existsSync(resolve(root,item.source)));}
for(const id of Object.keys(guide.contracts))assert(ids.has(id),`Contract has no node: ${id}`);
for(const file of ['index.html','architecture.js','app.js','guide.js','trace-view.js','tensor-pipeline.js','tensor-view.js'])assert(!/\p{Script=Han}/u.test(readFileSync(resolve(dir,file),'utf8')),`Untranslated text in ${file}`);
assert(model.render().includes('viewBox="0 0 1566 1730"'));
console.log(`PASS: ${ids.size} nodes, ${model.edges.length} routes, ${guide.steps.length} source steps, ${guide.waits.length} wait cases; excerpt matches source.`);

const measured=context.window.E3MeasuredTrace;
assert.equal(measured.schema,1);
assert(measured.begin<measured.end);
for(const channel of measured.channels){
  let end=measured.begin;
  for(const [a,b,value] of channel.runs){assert.equal(a,end,`Trace gap in ${channel.id}`);assert(b>a);assert(value===0||value===1);end=b;}
  assert.equal(end,measured.end,`Incomplete trace channel: ${channel.id}`);
}
for(const [file,hash] of Object.entries(measured.provenance.source_sha256))assert.equal(createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex'),hash,`Measured source changed: ${file}; rerun fork_join/run.sh --publish-trace`);
for(const event of measured.events){assert(event.cycle>=measured.begin&&event.cycle<measured.end);assert(ids.has(event.node));assert(model.modes[event.mode]);}
const sync=measured.channels.find(c=>c.id==='sync_wait');
assert.equal(sync.runs.reduce((sum,[a,b,value])=>sum+(value?b-a:0),0),measured.metrics.sync_wait_cycles);
assert(measured.metrics.scalar_commits_while_busy_before_join>=32);
assert(measured.provenance.report.split('\n').includes('TEST PASS'));
console.log('PASS: measured trace intervals, source provenance, event links and sync-wait total.');

const tensor=context.window.E3TensorPipeline;
const tensorNodes=new Set(tensor.nodes.map(n=>n[0])),tensorPaths=new Set(tensor.paths.map(p=>p[0]));
for(const phase of tensor.phases){
  for(const id of phase.active)assert(tensorNodes.has(id));
  for(const id of phase.paths)assert(tensorPaths.has(id));
  for(const key of phase.evidence)assert(tensor.sources[key]);
}
for(const [key,source] of Object.entries(tensor.sources)){
  const content=readFileSync(resolve(root,source.path),'utf8').split('\n');
  assert(content[source.line-1]?.includes(source.token),`Tensor source anchor changed: ${key}`);
}
const html=readFileSync(resolve(dir,'index.html'),'utf8');
assert(html.indexOf('id="chapter-directory"')<html.indexOf('id="workbench"'),'Chapter navigation must precede the architecture');
assert(html.indexOf('id="workbench"')<html.indexOf('id="tensor-pipeline"'));
assert(html.indexOf('id="tensor-pipeline"')<html.indexOf('id="walkthrough"'));
assert(tensor.render().includes('viewBox="0 0 2280 1760"'));
console.log(`PASS: ${tensor.phases.length} Tensor phases, ${Object.keys(tensor.sources).length} current source anchors, architecture-first reading order.`);

const tensorTrace=context.window.E3TensorMeasuredTrace;
assert.equal(tensorTrace.schema,1);assert.equal(tensorTrace.target,'tensor');
const tc=id=>tensorTrace.channels.find(channel=>channel.id===id).runs;
const highs=runs=>runs.filter(run=>run[2]);
const total=id=>highs(tc(id)).reduce((sum,[a,b])=>sum+b-a,0);
for(const channel of tensorTrace.channels){
  let end=tensorTrace.begin;
  for(const [a,b,value] of channel.runs){assert.equal(a,end);assert(b>a);assert(value===0||value===1);end=b;}
  assert.equal(end,tensorTrace.end);
}
for(const [file,hash] of Object.entries(tensorTrace.provenance.source_sha256))assert.equal(createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex'),hash,`Tensor capture source changed: ${file}`);
function intersection(a,b){
  a=highs(tc(a));b=highs(tc(b));let i=0,j=0,count=0;
  while(i<a.length&&j<b.length){count+=Math.max(0,Math.min(a[i][1],b[j][1])-Math.max(a[i][0],b[j][0]));if(a[i][1]<=b[j][1])i++;else j++;}
  return count;
}
const tm=tensorTrace.metrics;
assert.equal(total('engine_start'),tm.launches);assert.equal(tm.launches,64);
assert.equal(total('weight_activate'),tm.weight_activations);assert.equal(total('wld_done'),64);
assert.equal(total('compute_issue'),8192);assert.equal(total('dot_output'),8192);
assert.equal(intersection('compute_issue','dma_write'),tm.dma_compute_cycles);
assert.equal(intersection('compute_issue','wld_read'),tm.wld_compute_cycles);
assert.equal(intersection('compute_issue','output_write'),tm.write_compute_cycles);
assert.equal(intersection('compute_busy','wld_active'),tm.wld_while_compute_busy);
assert.equal(total('sync_wait'),tm.sync_wait_cycles);
assert.equal(highs(tc('active_a')).length+highs(tc('active_b')).length-1,tm.bank_switches);
assert.equal(tensorTrace.jobs.length,64);
for(const [i,job] of tensorTrace.jobs.entries()){assert.equal(job.index,i+1);assert(job.cycle>=tensorTrace.begin&&job.cycle<tensorTrace.end);assert(job.bank===0||job.bank===1);}
for(const event of tensorTrace.events){assert(event.cycle>=tensorTrace.begin&&event.cycle<tensorTrace.end);assert(ids.has(event.node));assert(model.modes[event.mode]);assert(tensor.phases[event.tensorPhase]);}
assert(tensorTrace.provenance.report.split('\n').includes('TENSOR_OUTPUT_CHECK=PASS'));
console.log('PASS: Tensor numerical-check evidence, 64 launches, A/B state, exact overlap intersections and source hashes.');

assert.equal(tm.start_commands,64);assert.equal(tm.sync_commands,1);
assert.equal(total('start_command'),64);assert.equal(total('sync_complete'),1);
assert.equal(tensorTrace.channels.filter(c=>c.group!=='internal').map(c=>c.id).join(','),'dma_busy,wld_active,tensor_busy,sync_wait');
assert.equal(tensorTrace.channels.find(c=>c.id==='start_command').group,'internal');
assert.equal(tensorTrace.channels.find(c=>c.id==='compute_issue').label,'Compute input valid');
assert.equal(tensorTrace.channels.find(c=>c.id==='compute_issue').group,'internal');
assert.equal(tensorTrace.starts.length,64);assert.equal(tensorTrace.wld_loads.length,64);
for(const [i,start] of tensorTrace.starts.entries()){assert.equal(start.index,i+1);assert(start.cycle<=start.launch_cycle);assert.equal(start.launch_cycle,tensorTrace.jobs[i].cycle);}
for(const load of tensorTrace.wld_loads){assert.equal(load.reads,4);assert(load.end>load.begin);}
assert.equal(Math.min(...tensorTrace.wld_loads.map(x=>x.end-x.begin)),tensorTrace.wld_explanation.min_cycles);
assert.equal(Math.max(...tensorTrace.wld_loads.map(x=>x.end-x.begin)),tensorTrace.wld_explanation.max_cycles);
console.log('PASS: four main lanes, software/internal separation, 64 starts and measured WLD widths/reads.');

const actu=context.window.E3ActuPipeline;
const anodes=new Set(actu.nodes.map(n=>n[0])),apaths=new Set(actu.paths.map(p=>p[0]));
assert.equal(anodes.size,actu.nodes.length);assert.equal(apaths.size,actu.paths.length);
assert.equal(actu.modes.length,8);
for(const source of Object.values(actu.sources))assert(readFileSync(resolve(root,source.path),'utf8').split('\n')[source.line-1].includes(source.token),`ACTU source drift: ${source.path}:${source.line}`);
for(const mode of actu.modes){
  assert(mode.active.every(id=>anodes.has(id)));assert(mode.paths.every(id=>apaths.has(id)));
  assert(mode.evidence.every(id=>actu.sources[id]));assert(actu.render(mode.id).includes('ACTU shared numerator'));
  if(mode.next)assert(actu.modes.some(m=>m.id===mode.next));
}
assert.equal(actu.modes.map(m=>m.code).sort().join(','),'0,1,2,3,4,5,6,7');
assert(actu.modes.find(m=>m.id==='softmax').active.includes('sum'));
assert(!actu.modes.find(m=>m.id==='softmax').active.includes('rcp'));
assert(!actu.modes.find(m=>m.id==='normalize').active.includes('exp'));
assert(actu.modes.find(m=>m.id==='normalize').paths.includes('numerator'));
const actuExample=readFileSync(resolve(root,actu.example),'utf8').split('\n');
for(const [line,code] of actu.code)assert.equal(actuExample[line-1],code);
const actuHtml=readFileSync(resolve(dir,'index.html'),'utf8');
assert(actuHtml.indexOf('id="actu-pipeline"')<actuHtml.indexOf('id="actu-walkthrough"'));
assert(actuHtml.indexOf('id="actu-walkthrough"')<actuHtml.indexOf('id="timeline"'));
for(const file of ['actu-pipeline.js','actu-view.js'])assert(!/\p{Script=Han}/u.test(readFileSync(resolve(dir,file),'utf8')));
console.log('PASS: 8 ACTU modes, selected routes, RTL anchors, literal software excerpt and architecture-before-example order.');
for(const id of ['sigmoid','silu']){
  const m=actu.modes.find(m=>m.id===id);
  assert(m.active.includes('add'));assert(!m.active.includes('subtract'));
  assert(m.paths.includes('one-n')&&m.paths.includes('exp-n')&&m.paths.includes('add-d'));
}
const tanhMode=actu.modes.find(m=>m.id==='tanh');
assert(tanhMode.active.includes('subtract')&&tanhMode.active.includes('add'));
assert(tanhMode.paths.includes('subtract-n')&&tanhMode.paths.includes('add-d'));
const rsqrtMode=actu.modes.find(m=>m.id==='rsqrt');
assert(rsqrtMode.active.includes('epsilon')&&!rsqrtMode.active.includes('exp'));
assert(rsqrtMode.paths.includes('epsilon-d'));
const normalizeMode=actu.modes.find(m=>m.id==='normalize');
assert(normalizeMode.paths.includes('input-n')&&normalizeMode.paths.includes('scalar-d'));
assert(!anodes.has('form'));assert(anodes.has('nselect')&&anodes.has('dselect'));
console.log('PASS: independent N/D muxes and mode-specific 1−e, 1+e and x+epsilon paths.');
assert(!anodes.has('finish'));
for(const m of actu.modes){
  assert(m.active.includes('result-select')&&m.active.includes('bf16'));
  assert(m.paths.includes('result')&&m.paths.includes('bf16-output'));
  assert.equal(m.active.includes('silu-multiply'),m.id==='silu');
  assert.equal(m.active.includes('tanh-sign'),m.id==='tanh');
  assert.equal(m.paths.includes('payload-x'),m.id==='silu');
  assert.equal(m.paths.includes('payload-sign'),m.id==='tanh');
  assert.equal(m.paths.includes('quotient'),['sigmoid','normalize'].includes(m.id));
}
console.log('PASS: separate SiLU multiply, tanh sign restoration, result selection and shared BF16 conversion.');
assert.equal(tensor.modes.length,16);
assert.equal(new Set(tensor.modes.map(m=>m.id)).size,tensor.modes.length);
for(const m of tensor.modes){
  assert(tensor.families.includes(m.family));
  for(const id of m.active)assert(tensorNodes.has(id),`Tensor mode node: ${m.id}/${id}`);
  for(const id of m.paths)assert(tensorPaths.has(id),`Tensor mode route: ${m.id}/${id}`);
  for(const key of m.evidence)assert(tensor.sources[key]);
  assert(m.active.includes('gpr')&&m.active.includes('owner'));
  assert(m.paths.includes('gpr-owner'));
  if(m.family==='Weight ingress')assert.equal(m.active.filter(id=>id.startsWith('w-')).length,1);
  if(m.family==='Scale encoding')assert.equal(m.active.filter(id=>/^s-(bf16|mx|nv|fp16)$/.test(id)).length,1);
  assert(tensor.render(m.id).includes('viewBox="0 0 2280 1760"'));
}
const rsumView=tensor.modes.find(m=>m.id==='psum-rsum');
assert(rsumView.active.includes('rsum')&&rsumView.paths.includes('rsum-output'));
for(const id of ['psum','psum-hold','post','scale-mul','scale-source'])assert(!rsumView.active.includes(id));
assert(tensor.modes.find(m=>m.id==='psum-none').paths.includes('zero-p'));
assert(tensor.modes.find(m=>m.id==='psum-once').paths.includes('hold-p'));
assert(tensor.modes.find(m=>m.id==='psum-stream').paths.includes('stream-p'));
assert(tensor.modes.find(m=>m.id==='scale-static').paths.includes('static-scale'));
assert(tensor.modes.find(m=>m.id==='scale-stream').paths.includes('stream-scale'));
assert(tensor.modes.find(m=>m.id==='scale-off').paths.includes('scale-bypass'));
assert(html.includes('id="tensor-mode-groups"'));
console.log('PASS: 16 Tensor configuration paths, RV32 capture/control ownership, per-dot cast, isolated P/RSUM and scale modes.');
// Routing constraints: control arrows enter top ports and never cross a block.
function tensorRoutePoints(d){
  let x=0,y=0;
  return [...d.matchAll(/([MLHV])(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g)].map(m=>{
    if(m[1]==='M'||m[1]==='L'){x=+m[2];y=+m[3];}else if(m[1]==='H')x=+m[2];else y=+m[2];return[x,y];
  });
}
const tensorControlTargets={'ctrl-wld':'wld','ctrl-weight':'wselect','ctrl-psum':'psum-select','ctrl-rsum':'rsum','ctrl-scale':'scale-source','ctrl-enable':'scale-select','ctrl-stype':'stype','ctrl-format':'format','ctrl-tile-format':'format','owner-dot':'dot','owner-csr':'csr-fields','owner-start':'start-fields','owner-wsld':'wsld-fields'};
for(const [id,d,kind] of tensor.paths.filter(p=>p[2]==='control')){
  const points=tensorRoutePoints(d),end=points.at(-1),prev=points.at(-2);
  const target=tensor.nodes.find(n=>n[0]===tensorControlTargets[id]);assert(target,`Missing control target ${id}`);
  assert.equal(end[1],target[2]);assert(end[0]>target[1]&&end[0]<target[1]+target[3]);
  assert.equal(prev[0],end[0]);assert(prev[1]<end[1],`Control must enter from above: ${id}`);
  for(let i=1;i<points.length;i++){
    const [a,b]=[points[i-1],points[i]];
    for(const [node,x,y,w,h] of tensor.nodes){
      const hit=a[0]===b[0]?a[0]>x&&a[0]<x+w&&Math.max(Math.min(a[1],b[1]),y)<Math.min(Math.max(a[1],b[1]),y+h):a[1]>y&&a[1]<y+h&&Math.max(Math.min(a[0],b[0]),x)<Math.min(Math.max(a[0],b[0]),x+w);
      assert(!hit,`Control ${id} crosses ${node}`);
    }
  }
}
assert.equal(tensor.controlGroups.length,3);
for(const mode of tensor.modes)for(const group of tensor.controlGroups){
  const used=group.routes.some(id=>mode.paths.includes(id));
  assert.equal(mode.active.includes(group.node),used);assert.equal(mode.paths.includes(group.feed),used);
}
console.log('PASS: CSR/START/WSLD routing groups, top-entry control ports and no control/block intersections.');
const tensorDataRoute=id=>tensorRoutePoints(tensor.paths.find(p=>p[0]===id)[1]);
for(const id of ['scale','static-scale','stream-scale','zero-p','stream-p','hold-p','dot-post','scale-product','scaled-to-post','post-output','format-output'])assert.equal(tensorDataRoute(id).length,2,`Expected a straight data route: ${id}`);
const scaleDrop=tensorDataRoute('scale');assert.equal(scaleDrop[0][0],scaleDrop[1][0]);assert(scaleDrop[0][1]<scaleDrop[1][1]);
assert.equal(tensorDataRoute('psum-post').length,3,'Selected P should need only one bend');
assert.equal(tensorDataRoute('scale-bypass').length,3,'Scale bypass should need only one bend');
for(const [id,d] of tensor.paths.filter(p=>p[2]!=='control')){
  const points=tensorRoutePoints(d);
  for(let i=1;i<points.length;i++)for(const [node,x,y,w,h] of tensor.nodes){
    const [a,b]=[points[i-1],points[i]];
    const hit=a[0]===b[0]?a[0]>x&&a[0]<x+w&&Math.max(Math.min(a[1],b[1]),y)<Math.min(Math.max(a[1],b[1]),y+h):a[1]>y&&a[1]<y+h&&Math.max(Math.min(a[0],b[0]),x)<Math.min(Math.max(a[0],b[0]),x+w);
    assert(!hit,`Data route ${id} crosses ${node}`);
  }
}
console.log('PASS: straight scale/P inputs, one-bend P join and scale bypass, aligned result chain and no data/block intersections.');

vm.runInNewContext(readFileSync(resolve(dir,'sram-scheduling.js'),'utf8'),context);
const sram=context.window.E3SramScheduling;
for(let phase=0;phase<8;phase++){
 const endpoints=new Set();
 for(let channel=0;channel<8;channel++){
  const steps=sram.route(channel,phase);let row=(channel+phase)%8;
  for(const step of steps){assert.equal(step.from,row);assert([0,step.distance].includes(step.from^step.to));row=step.to;}
  assert.equal(row,channel,`Butterfly phase ${phase}, channel ${channel}`);endpoints.add(row);
 }
 assert.equal(endpoints.size,8);
}
for(const [label,path,token] of sram.sources)assert(readFileSync(resolve(root,path),'utf8').includes(token),`SRAM source anchor changed: ${label}`);
for(const file of ['sram-scheduling.js','sram-view.js'])assert(!/\p{Script=Han}/u.test(readFileSync(resolve(dir,file),'utf8')));
assert(html.indexOf('id="sram-scheduling"')>html.indexOf('id="wait-cases"'));
for(const view of ['butterfly','services','buffered'])assert(sram.render(view).includes('viewBox="0 0 1140 760"'));
assert.equal(8*32,256);assert.equal(8*16,128);
console.log('PASS: 64 butterfly routes, all phase bijections, current SRAM source anchors and final chapter order.');

for(let q=0;q<8;q++)for(const pWide of [true,false])for(const oWide of [true,false])for(const half of [0,1]){
 const rows=sram.allocation(q,pWide,oWide,half),seen=new Set();
 for(const r of rows){
  assert.equal(r.group,((q&3)+({p:0,o:1,i:2,wsld:2,shared:3,dma:3}[r.id]))%4);
  assert.equal(r.banks.length,(r.wide?256:128)/64);
  for(const b of r.banks){assert(b>=0&&b<16);assert(!seen.has(b),`Shared bank at phase ${q}: B${b}`);seen.add(b);assert.equal(Math.floor(b/4),r.group);}
 }
 assert.equal(rows[2].half,q>>2);assert.equal(rows[3].half,(q>>2)^1);
 assert.equal(rows[4].half,q>>2);assert.equal(rows[5].half,(q>>2)^1);
 assert.equal(rows[0].half,half);assert.equal(rows[1].half,half);
 if(pWide&&oWide)assert.equal(seen.size,16);
 for(let i=0;i<6;i++)assert.equal(sram.allocation((q+4)%8,pWide,oWide,half)[i].group,rows[i].group);
}
const tensorEngine=readFileSync(resolve(root,'src/edge-e3/edge_tensor_unit/rtl/edge_tensor_engine.v'),'utf8');
for(const token of ["{fabric_phase[2:1],2'b00}","{2'(fabric_phase[2:1]+2'd1),2'b00}","{2'(fabric_phase[2:1]+2'd2),fabric_phase[3],1'b0}","16'h000f << psum_channel_bank","16'h000f << output_channel_bank"])assert(tensorEngine.includes(token),`Wide bank formula drift: ${token}`);
assert(readFileSync(resolve(root,'src/edge-e3/edge_dtcm_subsys/rtl/edge_dtcm_h4_narrow_reader.v'),'utf8').includes("1'(HALF) ^ phase_i[2]"));
assert(readFileSync(resolve(root,'src/edge-e3/edge_dtcm_subsys/rtl/edge_dtcm_subsys_core.v'),'utf8').includes("{2'(tensor_native_phase[2:1]+3),tensor_native_phase[3]}"));
console.log('PASS: 64 RTL service configurations, disjoint bank masks, full wide utilization, half-tour exchange and P/O address-half independence.');

const chapterTitles=[...html.matchAll(/<h2>(.*?)<\/h2>/g)].map(m=>m[1]);
assert.deepEqual(chapterTitles,['System architecture','Tensor','ACTU','Execution &amp; synchronization','SRAM scheduling']);
assert.equal([...html.matchAll(/<h1[ >]/g)].length,1);
assert.equal([...html.matchAll(/class="chapter-header"/g)].length,5);
for(const label of ['1.1','2.1','2.2','2.3','3.1','3.2','4.1','4.2','4.3','4.4','5.1','5.2'])assert(html.includes(`>${label} `),`Missing subsection ${label}`);
assert(html.indexOf('id="execution-model"')<html.indexOf('id="measured-trace"'));
assert(html.indexOf('id="execution-model"')<html.indexOf('id="wait-cases"'));
console.log('PASS: one page title, five chapter headings, numbered subsections and engine/runtime grouping.');
