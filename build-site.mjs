// SPDX-License-Identifier: Apache-2.0
import {readdirSync,cpSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)),out=join(root,'_site');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const entry of readdirSync(root,{withFileTypes:true})){
 if(entry.name==='exports'||entry.name==='LICENSE'||/\.(html|css|js|json|md)$/.test(entry.name))cpSync(join(root,entry.name),join(out,entry.name),{recursive:true});
}
writeFileSync(join(out,'.nojekyll'),'');
console.log('Static site prepared in _site/ (no RTL, git metadata or build tools).');
