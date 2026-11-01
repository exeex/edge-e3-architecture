// SPDX-License-Identifier: Apache-2.0
// Standalone CI: no parent checkout or private RTL required.
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url)),html=readFileSync(resolve(root,'index.html'),'utf8');
const context={window:{},document:{querySelectorAll:()=>[],body:{}},MutationObserver:class{observe(){}}};
for(const file of ['source-links.js','architecture.js','guide.js','tensor-pipeline.js','actu-pipeline.js','trace-data.js','tensor-trace-data.js','sram-scheduling.js'])vm.runInNewContext(readFileSync(resolve(root,file),'utf8'),context);
const w=context.window;
const manifest=JSON.parse(readFileSync(resolve(root,'source-manifest.json'),'utf8'));
assert.equal(JSON.stringify(w.E3Sources.manifest),JSON.stringify(manifest));
for(const file of readdirSync(root).filter(x=>x.endsWith('.js')))new vm.Script(readFileSync(resolve(root,file),'utf8'),{filename:file});
assert(!/href="\.\.\/\.\.\//.test(html),'Static source links must point at public GitHub revisions');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
 const path=match[1].split(/[?#]/)[0];if(/^https?:/.test(path))continue;
 assert(!path.startsWith('/'),`Root-absolute URL breaks project Pages: ${path}`);
 assert(existsSync(resolve(root,path)),`Missing static asset: ${path}`);
}
const ids=new Set(w.E3Architecture.nodes.map(n=>n.id));
for(const edge of w.E3Architecture.edges){assert(ids.has(edge.from));assert(ids.has(edge.to));}
for(const source of w.E3Architecture.nodes.map(n=>n.source))assert(w.E3Sources.url(source).startsWith('https://github.com/'));
assert(w.E3Sources.url('src/edge-32/rtl/ex/completion.svh',12).endsWith('/rtl/ex/completion.svh#L12'));
assert.equal(w.E3Sources.url('src/test-e3/anything'),'https://github.com/exeex/edge-e3-architecture/blob/main/sram-scheduling.md#maintained-implementation');
for(let phase=0;phase<8;phase++){
 for(let channel=0;channel<8;channel++)assert.equal(w.E3SramScheduling.route(channel,phase).at(-1).to,channel);
 for(const a of [false,true])for(const b of [false,true])for(const half of [0,1]){
  const rows=w.E3SramScheduling.allocation(phase,a,b,half),banks=rows.flatMap(r=>r.banks);assert.equal(new Set(banks).size,banks.length);
  assert(existsSync(resolve(root,`exports/edge-e3-sram-services-${a?'fp32':'bf16'}-${b?'fp32':'bf16'}-h${half}-phase-${phase}.png`)));
 }
}
for(const fixture of [w.E3MeasuredTrace,w.E3TensorMeasuredTrace])for(const channel of fixture.channels){let cursor=fixture.begin;for(const [a,b] of channel.runs){assert.equal(a,cursor);assert(b>a);cursor=b;}assert.equal(cursor,fixture.end);}
assert.equal((html.match(/class="chapter-header"/g)||[]).length,5);
console.log('PASS: standalone assets, JavaScript, public source URLs, model routes, trace continuity and 64 bank allocations / PNGs.');

for(const mode of w.E3TensorPipeline.modes){
 const svg=w.E3TensorPipeline.render(mode.id);
 assert(svg.includes('data-tensor-node="post"'));
 assert(svg.includes('PSUM add'));
 assert(svg.includes('[data-tensor-node]{opacity:1}'),'Focused modes must keep hardware blocks readable');
}
console.log('PASS: PSUM add remains present and readable in all 16 focused Tensor modes.');
