/*
 * Runtime — the design's Infrastruktur page: the declared infrastructure as a
 * topology of zones, and a comparison of what each environment declares.
 * Declared only: no plan, no state file and no cloud inventory is read, so the
 * planned, last-deployed and observed stands show as "no data yet" with why.
 */
extendStrings({
    en: {
        rTopo: 'Topology', rCmp: 'Environment comparison', rRail: 'Resource',
        rClean: function (n) { return 'Cleaned · ' + n + (n === '1' ? ' link hidden' : ' links hidden'); }, rRawOn: function (n) { return 'Raw view · ' + n + (n === '1' ? ' link visible' : ' links visible'); },
        rCleanNote: 'Cleaned: security groups, routes and policy attachments hidden — each with its link kept, shown again at any time.',
        rRawNote: 'Raw view: security groups, routes and policy attachments visible.',
        rModules: function (n) { return n + (n === 1 ? ' module' : ' modules'); }, rNoCloud: 'no cloud query', rPlan: 'plan.json',
        rPlanWhy: 'no Terraform plan file was read: the planned stand is unknown',
        rState: { ok: 'declared', drift: 'drift?', raw: 'raw' },
        rNoLinks: 'no reference between two resources was read', rUnresolved: 'declared in no file',
        rStands: 'Each cell four stands:', rStandsKey: 'D declared · P planned · R last deployed · O observed',
        rReplaced: 'replaced', rDrift: 'drift suspected', rUnknown: 'unknown',
        rPROWhy: 'P, R and O need a plan file, a deploy record and a read-only inventory; none was read',
        rDeclaredCell: 'D declared · P ? · R ? · O ?', rNotDeclared: 'not declared', rNoEnvs: 'no environment is named in the declared files',
        rProdNote: '"prod" in a variable name proves no production. No read-only inventory was released → O unknown everywhere.',
        rSource: 'source', rPlanK: 'plan', rEvidence: 'evidence', rChecked: 'last checked',
        rEvDeclared: 'declared', rEvHidden: 'declared · hidden in the cleaned view',
        rNoFinding: 'No findings', rNoFindingText: 'The reader found no drift for this resource.',
        rRailNote: 'Terraform state is never read and never copied into the map; no cloud is queried.',
        rMore: 'Findings outside a resource', rTypeCount: function (n) { return n + (n === 1 ? ' resource' : ' resources'); },
        rNamespace: function (n) { return 'namespace ' + n; }, rModule: function (n) { return 'module ' + n; }
    },
    de: {
        rTopo: 'Topologie', rCmp: 'Umgebungsvergleich', rRail: 'Ressource',
        rClean: function (n) { return 'Bereinigt · ' + n + (n === '1' ? ' Kante ausgeblendet' : ' Kanten ausgeblendet'); }, rRawOn: function (n) { return 'Rohansicht · ' + n + (n === '1' ? ' Kante sichtbar' : ' Kanten sichtbar'); },
        rCleanNote: 'Bereinigt: Security Groups, Routen, Policy-Anhänge ausgeblendet – mit Begründung je Kante, jederzeit einblendbar.',
        rRawNote: 'Rohansicht: Security Groups, Routen und Policy-Anhänge sichtbar.',
        rModules: function (n) { return n + (n === 1 ? ' Modul' : ' Module'); }, rNoCloud: 'keine Cloud-Abfrage', rPlan: 'plan.json',
        rPlanWhy: 'es wurde keine Terraform-Plan-Datei gelesen: der geplante Stand ist unbekannt',
        rState: { ok: 'deklariert', drift: 'Drift?', raw: 'roh' },
        rNoLinks: 'es wurde keine Referenz zwischen zwei Ressourcen gelesen', rUnresolved: 'in keiner Datei deklariert',
        rStands: 'Je Zelle vier Stände:', rStandsKey: 'D deklariert · P geplant · R zuletzt deployt · O beobachtet',
        rReplaced: 'ersetzt', rDrift: 'Drift vermutet', rUnknown: 'unbekannt',
        rPROWhy: 'P, R und O brauchen eine Plan-Datei, einen Deploy-Nachweis und ein Read-only-Inventar; nichts davon wurde gelesen',
        rDeclaredCell: 'D deklariert · P ? · R ? · O ?', rNotDeclared: 'nicht deklariert', rNoEnvs: 'die deklarierten Dateien nennen keine Umgebung',
        rProdNote: '„prod“ im Variablennamen beweist keine Produktion. Kein Read-only-Inventar freigegeben → O überall unbekannt.',
        rSource: 'quelle', rPlanK: 'plan', rEvidence: 'evidence', rChecked: 'zuletzt geprüft',
        rEvDeclared: 'deklariert', rEvHidden: 'deklariert · in der bereinigten Ansicht ausgeblendet',
        rNoFinding: 'Keine Befunde', rNoFindingText: 'Der Leser hat für diese Ressource keine Drift gefunden.',
        rRailNote: 'Terraform-State wird nie gelesen und nie in die Map kopiert; keine Cloud wird abgefragt.',
        rMore: 'Befunde ohne Ressource', rTypeCount: function (n) { return n + (n === 1 ? ' Ressource' : ' Ressourcen'); },
        rNamespace: function (n) { return 'Namespace ' + n; }, rModule: function (n) { return 'Modul ' + n; }
    }
});

var rtState = { raw: false };
if (!avState.view.runtime) avState.view.runtime = 'cmp';

/** The "no data yet" tag; the reason shows beside it, or as its title where space is short. */
function ndTag(reason, inline) {
    var s = el('span', { class: 'ops-nd' + (inline ? ' inline' : ''), title: inline ? null : reason });
    s.appendChild(el('span', { class: 'nodata-tag' }, t('noDataShort')));
    if (inline) s.appendChild(el('span', { class: 'ops-nd-why' }, reason));
    return s;
}
function opsChip(text, cls, title) { return el('span', { class: 'st ops-' + cls, title: title || null }, text); }
function sameSpot(a, b) { return a.file === b.file && a.line === b.line; }
function portText(pt) { return (pt.published != null ? pt.published + '→' : '') + pt.target + (pt.protocol && pt.protocol !== 'tcp' ? '/' + pt.protocol : ''); }
/** Detail-rail head shared by the three pages: kicker, name, state chip. */
function railHead(kicker, name, chip, plain) {
    return add(el('div', { class: 'ops-dhead' }), add(el('div', { class: 'ops-dname' }), el('span', { class: 'mono ops-kicker' }, kicker), el('span', { class: 'mono ops-title' + (plain ? ' plain' : '') }, name)), chip);
}
function railRows(rows) {
    var g = el('div', { class: 'mono ops-kv' });
    rows.forEach(function (r) {
        if (r[1] == null || r[1] === '') return;
        g.appendChild(el('span', { class: 'muted' }, r[0]));
        g.appendChild(typeof r[1] === 'object' ? r[1] : el('span', null, String(r[1])));
    });
    return g;
}
function findBox(title, chip, text) {
    return add(el('div', { class: 'ops-fbox' }), add(el('div', { class: 'ops-row' }), el('span', { class: 'mono ops-fid' }, title), chip), el('span', { class: 'ops-ftext' }, text));
}
function findingBoxes(id, list) {
    return list.map(function (fi) {
        var f = fi[0];
        var b = findBox(f.id, opsChip(t('sevNames')[f.severity] || f.severity, f.severity === 'high' ? 'bad' : 'unk'), f.message);
        var open = el('button', { type: 'button', class: 'ops-flink mono' }, (f.witnesses || []).map(wloc).join(' · '));
        open.addEventListener('click', function () { avPick(id, 'finding/' + fi[1]); });
        b.appendChild(open);
        return b;
    });
}

var RAW_TYPE = /security_group|route_table|(^|_)route$|policy_attachment|^NetworkPolicy$/;
function isRawType(type) { return RAW_TYPE.test(type); }
/** The provider a resource belongs to: the prefix of its Terraform type, or Kubernetes for a manifest. */
function rtProvider(r) {
    if (/\.ya?ml$/.test(r.witness.file)) return 'kubernetes';
    var ty = r.type === 'data' || r.type === 'provider' ? r.name.replace(/^(data|provider)\./, '') : r.type;
    var i = ty.indexOf('_');
    return i > 0 ? ty.slice(0, i) : r.type === 'provider' ? ty : '';
}
/** One outer zone per folder of declaration files, named by the providers declared in it. */
function rtZoneLabels(p) {
    var by = Object.create(null);
    p.resources.forEach(function (r) {
        var d = rtDir(r);
        var pv = rtProvider(r);
        if (!by[d]) by[d] = [];
        if (pv && by[d].indexOf(pv) < 0) by[d].push(pv);
    });
    var out = Object.create(null);
    Object.keys(by).forEach(function (d) { out[d] = (by[d].length ? by[d].join(', ') + ' · ' : '') + d; });
    return out;
}
function rtDir(r) { var i = r.witness.file.indexOf('/'); return i < 0 ? './' : r.witness.file.slice(0, i + 1); }
function rtFindings(p, r) {
    return (p.findings || []).map(function (f, i) { return [f, i]; }).filter(function (fi) {
        return (fi[0].witnesses || []).some(function (w) { return sameSpot(w, r.witness); }) || fi[0].subject.slice(-r.name.length - 1) === ':' + r.name;
    });
}
function rtLinks(p) { return p.links || []; }
function rtHiddenLinks(p) {
    var raw = Object.create(null);
    p.resources.forEach(function (r) { if (isRawType(r.type)) raw[r.name] = 1; });
    return rtLinks(p).filter(function (l) { return raw[l.from] || raw[l.to] || l.relation === 'connects'; });
}
function rtSelected(p, key) {
    var name = key.indexOf('resource/') === 0 ? key.slice(9) : '';
    var hit = null;
    p.resources.forEach(function (r) { if (r.name === name) hit = r; });
    if (hit || key) return hit;
    for (var i = 0; i < p.resources.length; i++) if (rtFindings(p, p.resources[i]).length) return p.resources[i];
    return p.resources[0] || null;
}
function rtChip(p, r) {
    if (isRawType(r.type)) return opsChip(t('rState').raw, 'raw');
    if (rtFindings(p, r).length) return opsChip(t('rState').drift, 'drift');
    return opsChip(t('rState').ok, 'ok');
}

function rtBar(p, view, key, bar) {
    bar.appendChild(el('span', { class: 'ops-mark' }));
    bar.appendChild(viewTabs('runtime', key, AREA_MODULES.runtime.tabs));
    if (view === 'topo') {
        var n = rtHiddenLinks(p).length;
        var sw = el('button', { type: 'button', role: 'switch', class: 'ops-switch' + (rtState.raw ? ' on' : ''), 'aria-checked': String(rtState.raw) }, rtState.raw ? t('rRawOn')(num(n)) : t('rClean')(num(n)));
        sw.addEventListener('click', function () { rtState.raw = !rtState.raw; renderAreaPage('runtime', key); });
        bar.appendChild(sw);
    }
    var dirs = [];
    var mods = Object.create(null);
    p.resources.forEach(function (r) {
        if (dirs.indexOf(rtDir(r)) < 0) dirs.push(rtDir(r));
        if (r.module) mods[r.module] = 1;
        if (r.type === 'module') mods[r.name] = 1;
    });
    var meta = el('span', { class: 'mono av-barmeta' });
    add(meta, document.createTextNode(dirs.join(' ') + ' · ' + t('rModules')(Object.keys(mods).length) + ' · ' + t('rPlan') + ' '), ndTag(t('rPlanWhy')), document.createTextNode(' · ' + t('rNoCloud')));
    bar.appendChild(meta);
}

function rtResourceButton(p, r, sel) {
    var b = el('button', { type: 'button', class: 'ops-res' + (sel ? ' on' : '') + (isRawType(r.type) ? ' raw' : '') });
    add(b, el('span', { class: 'mono ops-rname' }, r.name), el('span', { class: 'ops-rtype' }, r.type), rtChip(p, r));
    b.addEventListener('click', function () { avPick('runtime', 'resource/' + r.name); });
    return b;
}

function rtTopology(p, sel, main) {
    var visible = p.resources.filter(function (r) { return rtState.raw || !isRawType(r.type); });
    var zones = [];
    var byZone = Object.create(null);
    var labels = rtZoneLabels(p);
    visible.forEach(function (r) {
        var zk = labels[rtDir(r)];
        if (!byZone[zk]) { byZone[zk] = { label: zk, inner: [], innerBy: Object.create(null), loose: [], all: [] }; zones.push(byZone[zk]); }
        var z = byZone[zk];
        z.all.push(r);
        var ik = r.module ? t('rModule')(r.module) : r.environments.length ? t('rNamespace')(r.environments[0]) : '';
        if (!ik) { z.loose.push(r); return; }
        if (!z.innerBy[ik]) { z.innerBy[ik] = { label: ik, list: [] }; z.inner.push(z.innerBy[ik]); }
        z.innerBy[ik].list.push(r);
    });
    var wrap = el('div', { class: 'ops-col' });
    zones.forEach(function (z) {
        var box = el('div', { class: 'zone ops-zone-outer' });
        box.appendChild(add(el('div', { class: 'ops-row' }), el('span', { class: 'mono ops-zname' }, z.label), el('span', { class: 'ops-zmeta' }, t('rTypeCount')(num(z.all.length)))));
        if (z.inner.length) {
            var grid = el('div', { class: 'ops-zgrid' });
            z.inner.forEach(function (iz) {
                var inner = add(el('div', { class: 'zone ops-zone-inner' }), el('span', { class: 'cap' }, iz.label));
                iz.list.forEach(function (r) { inner.appendChild(rtResourceButton(p, r, sel === r)); });
                grid.appendChild(inner);
            });
            box.appendChild(grid);
        }
        if (z.loose.length) {
            var row = el('div', { class: 'ops-loose' });
            z.loose.forEach(function (r) { row.appendChild(rtResourceButton(p, r, sel === r)); });
            box.appendChild(row);
        }
        wrap.appendChild(box);
    });
    var hidden = rtHiddenLinks(p);
    var links = rtLinks(p).filter(function (l) { return rtState.raw || hidden.indexOf(l) < 0; });
    var known = Object.create(null);
    p.resources.forEach(function (r) { known[r.name] = 1; });
    var lrow = el('div', { class: 'mono ops-links' });
    if (!rtLinks(p).length) lrow.appendChild(ndTag(t('rNoLinks'), true));
    links.forEach(function (l) {
        var s = el('span', { class: hidden.indexOf(l) >= 0 ? 'raw' : null, title: wloc(l.witness) }, l.from + ' → ' + l.to + ' (' + l.relation + (l.mechanism ? ' · ' + l.mechanism : '') + ')');
        if (!known[l.to]) s.appendChild(el('span', { class: 'ops-unres' }, ' · ' + t('rUnresolved')));
        lrow.appendChild(s);
    });
    wrap.appendChild(lrow);
    wrap.appendChild(el('span', { class: 'ops-note' }, rtState.raw ? t('rRawNote') : t('rCleanNote')));
    main.appendChild(wrap);
}

function rtCompare(p, sel, main) {
    var wrap = el('div', { class: 'ops-col tight' });
    add(wrap, add(el('div', { class: 'ops-legend' }), el('span', null, t('rStands')), el('span', { class: 'mono' }, t('rStandsKey')),
        opsChip(t('rReplaced'), 'rep'), opsChip(t('rDrift'), 'drift'), opsChip(t('rUnknown'), 'unk'), ndTag(t('rPROWhy'), true)));
    var envs = p.environments.length ? p.environments : null;
    var cols = envs ? envs.length : 1;
    var box = el('div', { class: 'ops-cmp' });
    var grid = el('div', { class: 'mono ops-cmpgrid' });
    grid.style.gridTemplateColumns = 'minmax(150px, 1.1fr) repeat(' + cols + ', minmax(0, 1fr))';
    grid.appendChild(el('span', { class: 'ops-th' }, t('rRail')));
    if (envs) envs.forEach(function (e) { grid.appendChild(el('span', { class: 'ops-th' }, e)); });
    else grid.appendChild(add(el('span', { class: 'ops-th' }), ndTag(t('rNoEnvs'), true)));
    // One row per resource, whatever namespace declares it: the same Deployment in dev, staging and prod is one row
    // with three cells. A resource no environment names stays a row of its own file.
    var rows = [];
    var byKey = Object.create(null);
    p.resources.filter(function (r) { return !isRawType(r.type); }).forEach(function (r) {
        var k = r.type + '\u0000' + r.name + (r.environments.length ? '' : '\u0000' + r.witness.file);
        if (!byKey[k]) { byKey[k] = { name: r.name, type: r.type, members: [] }; rows.push(byKey[k]); }
        byKey[k].members.push(r);
    });
    rows.slice(0, ROW_CAP).forEach(function (row) {
        var first = row.members[0];
        var nb = el('button', { type: 'button', class: 'ops-cmpname' + (row.members.indexOf(sel) >= 0 ? ' on' : '') });
        add(nb, el('span', { class: 'ops-b' }, row.name), el('br'), el('span', { class: 'muted' }, row.type));
        nb.addEventListener('click', function () { avPick('runtime', 'resource/' + first.name); });
        grid.appendChild(nb);
        (envs || ['']).forEach(function (e) {
            var r = null;
            row.members.forEach(function (m) { if (!r && e && m.environments.indexOf(e) >= 0) r = m; });
            var on = !!r;
            var hasF = on && rtFindings(p, r).length > 0;
            grid.appendChild(add(el('span', { class: 'ops-cell' }), el('span', { class: 'soft' }, on ? t('rDeclaredCell') : '–'),
                add(el('span'), on ? opsChip(hasF ? t('rDrift') : t('rState').ok, hasF ? 'drift' : 'ok') : opsChip(e ? t('rNotDeclared') : '–', 'none'))));
        });
    });
    box.appendChild(grid);
    wrap.appendChild(box);
    if (rows.length > ROW_CAP) wrap.appendChild(el('span', { class: 'ops-note' }, t('moreRows')(num(rows.length - ROW_CAP))));
    wrap.appendChild(el('span', { class: 'ops-note' }, t('rProdNote')));
    main.appendChild(wrap);
}

function rtLoose(p, main) {
    var tied = Object.create(null);
    p.resources.forEach(function (r) { rtFindings(p, r).forEach(function (fi) { tied[fi[1]] = 1; }); });
    var rest = (p.findings || []).map(function (f, i) { return [f, i]; }).filter(function (fi) { return !tied[fi[1]]; });
    if (!rest.length) return;
    var sec = add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('rMore') + ' (' + rest.length + ')'));
    findingBoxes('runtime', rest).forEach(function (b) { sec.appendChild(b); });
    main.appendChild(sec);
}

function rtRail(p, key, right) {
    var item = key && key.indexOf('finding/') === 0 ? itemByKey('runtime', key) : null;
    var pad = el('div', { class: 'ops-rail' });
    if (item) {
        add(pad, railHead(item.finding.engine || 'finding', item.label, opsChip(t('sevNames')[item.finding.severity] || item.finding.severity, 'unk')),
            el('span', { class: 'ops-ftext' }, item.finding.message), add(el('section', { class: 'sec' }), witnessList(item.witnesses)));
        right.appendChild(pad);
        return;
    }
    var r = rtSelected(p, key);
    if (!r) { right.appendChild(add(pad, el('span', { class: 'soft' }, t('pickItem')))); return; }
    var where = r.module ? 'module.' + r.module : r.environments.length ? r.environments.join(', ') : rtDir(r);
    var raw = isRawType(r.type);
    add(pad, railHead(r.type + ' · ' + where, r.name, rtChip(p, r)),
        railRows([[t('rSource'), wloc(r.witness)], [t('rPlanK'), ndTag(t('rPlanWhy'))], [t('rEvidence'), raw && !rtState.raw ? t('rEvHidden') : t('rEvDeclared')],
            [t('rChecked'), confirmChip(r.witness.confirm)]]));
    var fs = rtFindings(p, r);
    if (!fs.length) pad.appendChild(findBox(t('rNoFinding'), null, t('rNoFindingText')));
    findingBoxes('runtime', fs).forEach(function (b) { pad.appendChild(b); });
    Array.prototype.forEach.call(pad.querySelectorAll('.ops-fbox'), function (b) { b.classList.add('wide'); });
    pad.appendChild(el('span', { class: 'ops-railnote' }, t('rRailNote')));
    right.appendChild(pad);
}

AREA_MODULES.runtime = {
    tabs: [['topo', 'rTopo'], ['cmp', 'rCmp']],
    railTitles: [null, 'rRail'],
    ownsBar: true,
    items: function (p) {
        return p.resources.map(function (r) {
            return { key: 'resource/' + r.name, kind: r.type, label: r.name, sub: r.module || '',
                rows: [[t('rSource'), wloc(r.witness)], [t('rEnvs'), r.environments.join(', ')]], witnesses: [r.witness] };
        });
    },
    meta: function (p) { return t('rTypeCount')(num(p.resources.length)); },
    render: function (p, view, main) { if (view === 'cmp') rtCompare(p, null, main); else rtTopology(p, null, main); },
    page: function (p, view, key, c) {
        rtBar(p, view, key, c.bar);
        var sel = rtSelected(p, key);
        if (!p.resources.length) c.main.appendChild(ndTag(t('rNoIac'), true));
        else if (view === 'cmp') rtCompare(p, sel, c.main); else rtTopology(p, sel, c.main);
        rtLoose(p, c.main);
        rtRail(p, key, c.right);
    }
};
extendStrings({ en: { rEnvs: 'Environments', rNoIac: 'no Terraform or Kubernetes resource was read; the Compose services are on Delivery' }, de: { rEnvs: 'Umgebungen', rNoIac: 'es wurde keine Terraform- oder Kubernetes-Ressource gelesen; die Compose-Dienste stehen unter Delivery' } });
