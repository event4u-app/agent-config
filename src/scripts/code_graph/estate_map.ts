/**
 * `code-graph map --estate` — one offline page of the registered projects and
 * the edges the estate index derived between them (ADR-299, step 5.4).
 *
 * Projects are nodes; a `package` edge (a declared dependency on a package
 * another project publishes) is drawn solid, the two guesses (`unique-name`,
 * `mention`) dashed. The page names client projects, so it is written under
 * the user-global home and refused anywhere inside a git work tree.
 *
 * The page exposes `window.__mapLabelBoxes` and a `#panel .plist` list in the
 * shape `map_verify` reads, so the same three-width render check applies.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { enclosingWorkTree } from '../_lib/git_common_dir.js';
import { write_atomic } from '../_lib/fs_atomic.js';
import { event4u_root } from '../_lib/user_global_paths.js';
import { openEstate, type XEdge } from './estate_index.js';
import { verifyMap } from './map_verify.js';

export interface EstateMapData {
    projects: Array<{ id: string; name: string; indexed_at: string }>;
    edges: XEdge[];
}

export function estateMapDir(): string {
    return path.join(event4u_root(), 'runtime', 'estate', 'map');
}

/** JSON safe inside a `<script>` element: no `</script>`, no `<!--`. */
function scriptJson(v: unknown): string {
    return JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const CSS = `
:root{--bg:#fbfbf9;--fg:#1d1d1b;--muted:#6b6b66;--line:#3c6e8f;--guess:#b0703a;--node:#ffffff;--ring:#3c6e8f;--hl:#d9e8f2}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ecece8;--muted:#a3a39c;--line:#7fb2d4;--guess:#e0a46b;--node:#22221f;--ring:#7fb2d4;--hl:#25343e}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:16px 16px 4px}h1{font-size:18px;margin:0 0 4px}p{margin:0;color:var(--muted);max-width:60ch}
main{display:flex;flex-wrap:wrap;gap:16px;padding:8px 16px 16px}.stage{flex:1 1 320px;min-width:0}svg{display:block;width:100%;height:auto}
#panel{flex:0 1 260px;min-width:0}.plist{list-style:none;margin:0;padding:0}.plist button{display:flex;align-items:center;gap:8px;width:100%;
border:0;background:none;color:inherit;font:inherit;text-align:left;padding:6px 4px;cursor:pointer;border-radius:6px}
.plist button[aria-pressed=true]{background:var(--hl)}.swatch{flex:0 0 10px;height:10px;border-radius:50%;background:var(--ring)}
.fname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;color:var(--muted);font-size:12px}
.k{display:inline-block;width:24px;border-top:2px solid var(--line);vertical-align:middle;margin-right:4px}.k.g{border-top:2px dashed var(--guess)}
line.package{stroke:var(--line);stroke-width:2}line.guess{stroke:var(--guess);stroke-width:1.5;stroke-dasharray:5 4}
line.dim{opacity:.15}circle{fill:var(--node);stroke:var(--ring);stroke-width:2}text{fill:var(--fg);font-size:12px}
`;

const JS = `
(function(){
var data=JSON.parse(document.getElementById('estate-data').textContent);
var svg=document.getElementById('stage');var NS='http://www.w3.org/2000/svg';
var list=document.getElementById('plist');var selected=null;
function short(s){return s.length>18?s.slice(0,17)+'\\u2026':s}
function draw(){
  while(svg.firstChild)svg.removeChild(svg.firstChild);
  var w=Math.max(240,svg.parentNode.clientWidth),h=Math.min(w,520);
  svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.setAttribute('width',w);svg.setAttribute('height',h);
  var n=data.projects.length,texts=[],maxw=0;
  var gl=document.createElementNS(NS,'g'),gn=document.createElementNS(NS,'g');svg.appendChild(gl);svg.appendChild(gn);
  data.projects.forEach(function(p){var t=document.createElementNS(NS,'text');t.textContent=short(p.name);t.setAttribute('text-anchor','middle');gn.appendChild(t);texts.push(t);maxw=Math.max(maxw,t.getComputedTextLength())});
  var r=n<2?0:Math.max(24,Math.min(w/2-maxw/2-12,h/2-40));var cx=w/2,cy=h/2-8,pos={};
  data.projects.forEach(function(p,i){var a=-Math.PI/2+2*Math.PI*i/Math.max(1,n);pos[p.id]={x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}});
  data.edges.forEach(function(e){var s=pos[e.source],t=pos[e.target];if(!s||!t)return;var l=document.createElementNS(NS,'line');
    l.setAttribute('x1',s.x);l.setAttribute('y1',s.y);l.setAttribute('x2',t.x);l.setAttribute('y2',t.y);
    var cls=e.via==='package'?'package':'guess';if(selected&&e.source!==selected&&e.target!==selected)cls+=' dim';l.setAttribute('class',cls);
    var tt=document.createElementNS(NS,'title');tt.textContent=e.via+': '+e.detail;l.appendChild(tt);gl.appendChild(l)});
  var boxes=[];
  data.projects.forEach(function(p,i){var c=document.createElementNS(NS,'circle');var q=pos[p.id];c.setAttribute('cx',q.x);c.setAttribute('cy',q.y);c.setAttribute('r',p.id===selected?9:7);
    gn.insertBefore(c,texts[0]);var t=texts[i];t.setAttribute('x',q.x);t.setAttribute('y',q.y+22);var b=t.getBBox();boxes.push({x:b.x,y:b.y,w:b.width,h:b.height})});
  window.__mapLabelBoxes={boxes:boxes,width:w,height:h};
}
data.projects.forEach(function(p){var li=document.createElement('li');var b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed','false');
  var s=document.createElement('span');s.className='swatch';var f=document.createElement('span');f.className='fname';f.textContent=p.name;f.title=p.id;
  b.appendChild(s);b.appendChild(f);b.addEventListener('click',function(){selected=selected===p.id?null:p.id;
    Array.prototype.forEach.call(list.querySelectorAll('button'),function(x){x.setAttribute('aria-pressed','false')});if(selected)b.setAttribute('aria-pressed','true');draw()});
  li.appendChild(b);list.appendChild(li)});
draw();window.addEventListener('resize',draw);
})();
`;

export function renderEstateHtml(data: EstateMapData): string {
    const packages = data.edges.filter((e) => e.via === 'package').length;
    const guesses = data.edges.length - packages;
    return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>Project estate</title>',
        `<style>${CSS}</style>`,
        '</head>',
        '<body>',
        '<header>',
        '<h1>Project estate</h1>',
        `<p>${data.projects.length} registered projects · ${packages} package links · ${guesses} guessed links. Local to this machine; never committed.</p>`,
        '<div class="legend"><span><span class="k"></span>declared dependency</span><span><span class="k g"></span>guess (unique name or mention)</span></div>',
        '</header>',
        '<main>',
        '<div class="stage"><svg id="stage" role="img" aria-label="Projects and the links between them"></svg></div>',
        '<aside id="panel"><ul class="plist" id="plist"></ul></aside>',
        '</main>',
        `<script type="application/json" id="estate-data">${scriptJson(data)}</script>`,
        `<script>${JS}</script>`,
        '</body>',
        '</html>',
        '',
    ].join('\n');
}

export async function estateMapMain(argv: string[]): Promise<number> {
    const i = argv.indexOf('--out');
    const outDir = i >= 0 && i + 1 < argv.length ? path.resolve(argv[i + 1] as string) : estateMapDir();
    const tree = enclosingWorkTree(outDir);
    if (tree !== null) {
        process.stderr.write(`code-graph: refusing to write the estate map inside a git work tree (${tree}): it names client projects\n`);
        return 1;
    }
    const db = openEstate();
    if (!db) {
        process.stderr.write('code-graph: no estate index — `code-graph projects index on`, then build or refresh each project\n');
        return 1;
    }
    let data: EstateMapData;
    try {
        data = { projects: db.projects().map(({ id, name, indexed_at }) => ({ id, name, indexed_at })), edges: db.xedges() };
    } finally {
        db.close();
    }
    const page = path.join(outDir, 'index.html');
    fs.mkdirSync(outDir, { recursive: true });
    write_atomic(page, renderEstateHtml(data));
    process.stdout.write(`✅  estate map — ${data.projects.length} projects · ${data.edges.length} links\n    wrote ${page}\n`);
    if (argv.includes('--no-verify')) return 0;
    const check = await verifyMap(page);
    process.stdout.write(`    render check: ${check.verification}${check.reason ? ` — ${check.reason}` : ''}\n`);
    return check.verification === 'failed' ? 1 : 0;
}
