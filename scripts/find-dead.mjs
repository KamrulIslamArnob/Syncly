import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function globFiles() {
  try {
    const out = execSync('find src -type f -name "*.js" | sort', {encoding: 'utf8', cwd: 'E:\\07_Open-source\\Syncly'});
    return out.trim().split('\n').filter(Boolean).map(p=>p.replace(/^\.\//,'')); 
  } catch(e){
    // fallback for windows
    return [];
  }
}

// Use simple glob via fs
function getAllJsFiles(dir) {
  const res = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, {withFileTypes:true})) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name.endsWith('.js')) res.push(p.replace(/\\/g,'/'));
    }
  }
  walk(dir);
  return res.sort();
}

const files = getAllJsFiles('src');
console.log('total', files.length);
const fileSet = new Set(files.map(f=>path.normalize(f).replace(/\\/g,'/')));

const entryPoints = [
  'src/presentation/newTab/newTabController.js',
  'src/presentation/popup/popupController.js',
  'src/presentation/options/optionsController.js',
  'src/presentation/shared/serviceWorker.js',
  'src/infrastructure/di/container.js',
];

const importRegex = /from\s+['"]([^'"]+)['"]/g;

function resolveImport(importer, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
  let base = path.dirname(importer);
  let resolved = path.normalize(path.join(base, spec)).replace(/\\/g,'/');
  const candidates = [resolved, resolved + '.js'];
  for (const c of candidates) {
    const norm = path.normalize(c).replace(/\\/g,'/');
    if (fileSet.has(norm)) return norm;
  }
  if (fileSet.has(path.normalize(resolved).replace(/\\/g,'/'))) return path.normalize(resolved).replace(/\\/g,'/');
  return null;
}

const reachable = new Set(entryPoints.map(p=>path.normalize(p).replace(/\\/g,'/')));
const queue = [...reachable];
const visited = new Set();

while(queue.length){
  const cur = queue.shift();
  if (visited.has(cur)) continue;
  visited.add(cur);
  const fullPath = path.join('E:\\07_Open-source\\Syncly', cur);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath,'utf8');
  let m;
  const regex = new RegExp(importRegex.source, 'g');
  while((m=regex.exec(content))!==null){
    const spec = m[1];
    const resolved = resolveImport(cur, spec);
    if (resolved && !reachable.has(resolved)) {
      reachable.add(resolved);
      queue.push(resolved);
    }
  }
}

const dead = files.map(f=>f.replace(/\\/g,'/')).filter(f=>!reachable.has(path.normalize(f).replace(/\\/g,'/')));
console.log('reachable', reachable.size);
console.log('dead', dead.length);
console.log(dead.join('\n'));

// also check which reachable are actually used but maybe not?
// Write to file for inspection
fs.writeFileSync('dead-list.txt', dead.join('\n'));
