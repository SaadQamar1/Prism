// Development-only helper: retrieve license files from the exact upstream npm archives.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const lock = JSON.parse(readFileSync('vendor/miniPaint/package-lock.json','utf8'));
const names = ['@babel/runtime','blueimp-canvas-to-blob','exif-js','file-saver','fuzzysort','gif.js.optimized','jquery','pica','semver-compare','uuid','webfontloader','glur','object-assign','multimath','sprintf-js','inherits','lie','immediate'];
const temporary = mkdtempSync(join(tmpdir(),'prism-license-'));
mkdirSync('public/licenses/npm',{recursive:true});
for(const name of names) {
  const entry = lock.packages['node_modules/' + name];
  if(!entry) continue;
  const url = new URL(entry.resolved);
  if(url.hostname !== 'registry.npmjs.org') throw new Error('Unexpected dependency host.');
  const response = await fetch(url);
  if(!response.ok) throw new Error('Cannot retrieve license for ' + name);
  const archive = join(temporary,name.replaceAll('/','-') + '.tgz');
  writeFileSync(archive,new Uint8Array(await response.arrayBuffer()));
  const files = execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n');
  const licenses = files.filter(path => /^package\/(licen[sc]e|copying|notice)(\.[^/]+)?$/i.test(path));
  if(!licenses.length && name === 'gif.js.optimized') {
    const response = await fetch('https://raw.githubusercontent.com/jnordberg/gif.js/master/LICENSE');
    if(!response.ok) throw new Error('Cannot retrieve gif.js license.');
    writeFileSync('public/licenses/npm/gif.js.optimized-LICENSE.txt',await response.text());
    console.log('Retained gif.js MIT license from upstream.');
    continue;
  }
  if(!licenses.length) throw new Error('Missing license file for ' + name);
  for(const file of licenses) {
    const text = execFileSync('tar',['-xOzf',archive,file],{encoding:'utf8'});
    writeFileSync(join('public/licenses/npm',name.replaceAll('/','-') + '-' + file.split('/').pop() + '.txt'),text);
  }
  console.log('Retained ' + name + '@' + entry.version + ' license.');
}
for(const [name,url] of [
 ['imagefilters-MIT.txt','https://raw.githubusercontent.com/arahaya/ImageFilters.js/master/MIT-LICENSE'],
 ['glfx-MIT.txt','https://raw.githubusercontent.com/evanw/glfx.js/master/LICENSE'],
 ['color-thief-MIT.txt','https://raw.githubusercontent.com/lokesh/color-thief/master/LICENSE'],
 ['hermite-resize-MIT.txt','https://raw.githubusercontent.com/viliusle/Hermite-resize/master/MIT-LICENSE.txt']
]) {
  const response = await fetch(url);
  if(!response.ok) throw new Error('Cannot retrieve ' + name);
  writeFileSync(join('public/licenses',name),await response.text());
  console.log('Retained ' + name);
}
