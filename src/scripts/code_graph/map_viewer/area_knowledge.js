/*
 * Wissen — the 2026-10-bf handover's knowledge page: five lenses (Quellen ·
 * Memory · Entscheidungen · Sessions · Arbeitsweise), a Filter aside with the
 * Besitzer and "Liest die Map?" groups and the ownership legend, KPI buttons,
 * the source registry and a Detail aside.
 *
 * Every figure comes from a payload field: the Markdown count from the doc
 * files of map.json, everything else from the knowledge source index
 * (`areas.knowledge`, sibling Stages I and K):
 *   { reader, completeness, findings, sources: [{ name, path, format, owner, read, note, gap, delete }],
 *     memory?, decisions?, sessions?, work?: [{ title, sub, kind? }] }
 * A lens whose field is absent says so and why; the handover's audit figures
 * are never drawn.
 */
extendStrings({
    en: {
        kLenses: [['src', 'Sources'], ['mem', 'Memory'], ['dec', 'Decisions'], ['ses', 'Sessions'], ['work', 'Ways of working']], kFilter: 'Filter', kDetail: 'Detail', kSearch: 'Search knowledge',
        kOwner: 'Owner', kRead: 'Does the map read it?', kOwners: { user: 'User', project: 'Project', team: 'Team', machine: 'Machine' },
        kReads: { map: 'read by the map', doc: 'as docs only', no: 'not read', wnr: 'written, never read', rns: 'read, not shown', park: 'parked' },
        kReset: 'Reset filters', kWho: 'Who owns what · K.1', kWhoRows: [['user', 'preferences, work style, chat, sessions – never committed'], ['project', 'conventions, decisions, recurring findings'], ['team', 'working agreements in the repository'], ['machine', 'derived indices']],
        kWhoNote: 'Precedence: user personal > project path > project > team. Safety gates before comfort.',
        kMdDocs: 'Markdown documents', kMdScope: function (c) { return 'doc nodes · map.json @ ' + c; }, kOnlyMd: 'The map reads Markdown only.',
        kOnlyMdWhy: 'YAML memory, JSONL stores and sessions do not reach it until the knowledge source index exists (sibling Stages I and K).',
        kSourcesH: function (a, b) { return 'Knowledge sources · ' + a + ' of ' + b; }, kSourcesT: 'Click: owner, readers, delete path', kNoIndex: 'No knowledge source index in this map',
        kNoIndexWhy: { src: 'Stores, owners, readers and delete paths are not written into map.json yet (sibling Stage I). The page draws no audit figure in their place.',
            mem: 'Memory stores are not read into the map yet (sibling Stage I); the curated memory lives in agents/memory/ and is loaded on request only.',
            dec: 'Decisions with their validity and supersession are not facts in the map yet (sibling Stages I.2, I.3); the ADRs show as doc nodes in Code.',
            ses: 'The session index is local and not written into a map (sibling Stage K, .build/sessions/).',
            work: 'Work-style candidates come from the user learning lane (sibling Stage K) and never reach a project map.' },
        kCount: function (a, b) { return a + ' of ' + b; }, kWithout: function (x) { return 'without ' + x; }, kPick: 'Pick a source to see its owner, readers and delete path.',
        kRows: ['Owner', 'Path', 'Format', 'Does the map read it?', 'Note', 'Gap', 'Delete via']
    },
    de: {
        kLenses: [['src', 'Quellen'], ['mem', 'Memory'], ['dec', 'Entscheidungen'], ['ses', 'Sessions'], ['work', 'Arbeitsweise']], kFilter: 'Filter', kDetail: 'Detail', kSearch: 'Wissen durchsuchen',
        kOwner: 'Besitzer', kRead: 'Liest die Map?', kOwners: { user: 'Nutzer', project: 'Projekt', team: 'Team', machine: 'Maschine' },
        kReads: { map: 'von der Map gelesen', doc: 'nur als Doku', no: 'nicht gelesen', wnr: 'geschrieben, nie gelesen', rns: 'gelesen, nicht gezeigt', park: 'geparkt' },
        kReset: 'Filter zurücksetzen', kWho: 'Wem gehört was · K.1', kWhoRows: [['user', 'Vorlieben, Arbeitsstil, Chat, Sessions – nie committet'], ['project', 'Konventionen, Entscheidungen, wiederkehrende Befunde'], ['team', 'Arbeitsvereinbarungen im Repo'], ['machine', 'abgeleitete Indizes']],
        kWhoNote: 'Vorrang: Nutzer persönlich > Projektpfad > Projekt > Team. Sicherheits-Gates vor Komfort.',
        kMdDocs: 'Markdown-Dokumente', kMdScope: function (c) { return 'Doc-Knoten · map.json @ ' + c; }, kOnlyMd: 'Die Map liest nur Markdown.',
        kOnlyMdWhy: 'YAML-Memory, JSONL-Stores und Sessions erreicht sie nicht, solange es den Wissensquellen-Index nicht gibt (Geschwister-Stages I und K).',
        kSourcesH: function (a, b) { return 'Wissensquellen · ' + a + ' von ' + b; }, kSourcesT: 'Klick: Besitzer, Leser, Lösch-Pfad', kNoIndex: 'Kein Wissensquellen-Index in dieser Map',
        kNoIndexWhy: { src: 'Stores, Besitzer, Leser und Lösch-Pfade werden noch nicht in map.json geschrieben (Geschwister-Stage I). Die Seite zeichnet an ihrer Stelle keine Audit-Zahl.',
            mem: 'Memory-Stores werden noch nicht in die Map gelesen (Geschwister-Stage I); die kuratierte Memory liegt in agents/memory/ und wird nur auf Abruf geladen.',
            dec: 'Entscheidungen mit Geltung und Ablösung sind noch keine Fakten der Map (Geschwister-Stages I.2, I.3); die ADRs erscheinen als Doku-Knoten in Code.',
            ses: 'Der Session-Index ist lokal und wird in keine Map geschrieben (Geschwister-Stage K, .build/sessions/).',
            work: 'Arbeitsstil-Kandidaten kommen aus der Nutzer-Lernspur (Geschwister-Stage K) und erreichen nie eine Projekt-Map.' },
        kCount: function (a, b) { return a + ' von ' + b; }, kWithout: function (x) { return 'ohne ' + x; }, kPick: 'Quelle wählen, um Besitzer, Leser und Lösch-Pfad zu sehen.',
        kRows: ['Besitzer', 'Pfad', 'Format', 'Liest die Map?', 'Notiz', 'Lücke', 'Löschen über']
    }
});

var K_OWN_CLS = { user: 'violetline', project: 'sy-direct', team: 'cyan', machine: 'sy-line' };
var K_OWN_DOT = { user: 'var(--violet)', project: 'var(--brand)', team: 'var(--cyan)', machine: 'var(--line2)' };
var K_READ_CLS = { map: 'ok', doc: 'sy-fixture', no: 'dash', wnr: 'warn', rns: 'warn', park: 'dash' };
var K_READ_DOT = { map: 'var(--green)', doc: 'var(--amber)', no: 'var(--line2)', wnr: 'var(--amber)', rns: 'var(--amber)', park: 'var(--faint)' };
var kState = { lens: 'src', off: { own: {}, read: {} }, q: '', sel: null };

function kSources() { var p = KA.knowledge; return p && !p.empty && p.sources ? p.sources : null; }
function kHit(s, skip) {
    if (skip !== 'own' && kState.off.own[s.owner]) return false;
    if (skip !== 'read' && kState.off.read[s.read]) return false;
    var q = kState.q.toLowerCase();
    return !q || (s.name + ' ' + s.path + ' ' + (s.note || '')).toLowerCase().indexOf(q) >= 0;
}
function kRedraw() { renderAreaPage('knowledge', current.item); }

function kFilter(left) {
    var src = kSources() || [];
    var pad = el('div', { class: 'sy-filter' });
    var inp = el('input', { type: 'search', 'aria-label': t('kSearch'), placeholder: t('kSearch') + ' …', id: 'k-q' });
    inp.value = kState.q;
    inp.addEventListener('change', function () { kState.q = inp.value; kRedraw(); });
    pad.appendChild(add(el('div', { class: 'sy-search' }), el('span', { 'aria-hidden': 'true', class: 'muted' }, '⌕'), inp));
    [['own', 'kOwner', t('kOwners'), K_OWN_DOT], ['read', 'kRead', t('kReads'), K_READ_DOT]].forEach(function (g) {
        var box = add(el('div', { class: 'sy-fgroup', 'data-group': g[0] }), el('span', { class: 'cap' }, t(g[1])));
        Object.keys(g[2]).forEach(function (v) {
            var on = !kState.off[g[0]][v];
            var n = src.filter(function (s) { return s[g[0] === 'own' ? 'owner' : 'read'] === v && kHit(s, g[0]); }).length;
            var dot = el('span', { class: 'sy-dot' });
            dot.style.background = g[3][v];
            var b = el('button', { type: 'button', role: 'checkbox', 'aria-checked': String(on), class: 'sy-wsrow', 'data-v': v });
            add(b, el('span', { class: 'sy-tick' + (on ? ' on' : '') }, on ? '✓' : ''), dot, el('span', { class: 'sy-wsname' }, g[2][v]), el('span', { class: 'mono sy-n' }, src.length ? num(n) : '–'));
            b.addEventListener('click', function () { kState.off[g[0]][v] = on; kRedraw(); });
            box.appendChild(b);
        });
        pad.appendChild(box);
    });
    var reset = el('button', { type: 'button', class: 'sy-reset' }, t('kReset'));
    reset.addEventListener('click', function () { kState.off = { own: {}, read: {} }; kState.q = ''; kRedraw(); });
    pad.appendChild(reset);
    var who = add(el('div', { class: 'k-who', id: 'k-who' }), el('span', { class: 'cap' }, t('kWho')));
    t('kWhoRows').forEach(function (r) { who.appendChild(add(el('span'), stChip(t('kOwners')[r[0]], K_OWN_CLS[r[0]]), document.createTextNode(' ' + r[1]))); });
    who.appendChild(el('span', { class: 'muted' }, t('kWhoNote')));
    pad.appendChild(who);
    left.appendChild(pad);
}
function kEmpty(main, lens) {
    main.appendChild(add(el('div', { class: 'empty-page', id: 'nodata-knowledge-' + lens }), add(el('span', { class: 'ep-chips' }), stChip('empty', 'dash')), el('span', { class: 'ep-head' }, t('kNoIndex')), el('span', { class: 'ep-what' }, t('kNoIndexWhy')[lens])));
}
function kMain(main, right) {
    var lens = kState.lens;
    var src = kSources();
    var lab = t('kLenses').filter(function (l) { return l[0] === lens; })[0][1];
    var shown = src ? src.filter(function (s) { return kHit(s); }) : [];
    var bar = add(el('div', { class: 'sy-sticky', id: 'k-bar' }), el('span', { class: 'mono sy-count' }, lab), el('span', { class: 'sy-flex' }));
    if (lens === 'src' && src) bar.appendChild(el('span', { class: 'mono sy-count', id: 'k-count' }, t('kCount')(num(shown.length), num(src.length))));
    Object.keys(kState.off).forEach(function (g) {
        Object.keys(kState.off[g]).forEach(function (v) {
            if (!kState.off[g][v]) return;
            var c = el('button', { type: 'button', class: 'mono sy-active' }, t('kWithout')((g === 'own' ? t('kOwners') : t('kReads'))[v]) + ' ×');
            c.addEventListener('click', function () { kState.off[g][v] = false; kRedraw(); });
            bar.appendChild(c);
        });
    });
    main.appendChild(bar);
    if (lens !== 'src') {
        var list = KA.knowledge && !KA.knowledge.empty ? KA.knowledge[{ mem: 'memory', dec: 'decisions', ses: 'sessions', work: 'work' }[lens]] : null;
        if (!list) { kEmpty(main, lens); return; }
        var box = el('div', { class: 'sy-box k-rows' });
        list.forEach(function (r) { box.appendChild(add(el('div', { class: 'k-row' }), add(el('span', { class: 'k-rowl' }), r.kind ? el('span', { class: 'cap' }, r.kind) : null, el('b', null, r.title)), el('span', { class: 'mono muted' }, r.sub || ''))); });
        main.appendChild(box);
        return;
    }
    // The one figure the map holds today: its Markdown doc nodes.
    var docs = files.filter(function (f) { return f.role === 'doc'; }).length;
    var pin = model.pin || { commit: meta.commit };
    var kp = el('div', { class: 'k-kpis', id: 'k-kpis' });
    kp.appendChild(add(el('button', { type: 'button', class: 'k-kpi' }), el('span', { class: 'mono k-kv' }, num(docs)), el('span', null, t('kMdDocs')), el('span', { class: 'mono muted' }, t('kMdScope')(String(pin.commit || '').slice(0, 8)))));
    ((KA.knowledge && KA.knowledge.kpis) || []).forEach(function (k) { kp.appendChild(add(el('button', { type: 'button', class: 'k-kpi' }), el('span', { class: 'mono k-kv' }, String(k.v)), el('span', null, k.l), el('span', { class: 'mono muted' }, k.scope || ''))); });
    main.appendChild(kp);
    if (!src) main.appendChild(add(el('div', { class: 'k-note' }), el('b', null, t('kOnlyMd')), el('span', null, t('kOnlyMdWhy'))));
    if (!src) { kEmpty(main, 'src'); return; }
    var sec = add(el('section', { class: 'hub-me-sec' }), add(el('div', { class: 'between' }), el('b', null, t('kSourcesH')(num(shown.length), num(src.length))), el('span', { class: 'muted' }, t('kSourcesT'))));
    var rows = el('div', { class: 'sy-box', id: 'k-sources' });
    shown.forEach(function (s) {
        var b = el('button', { type: 'button', class: 'k-src' + (kState.sel === s.name ? ' on' : ''), 'data-name': s.name });
        add(b, add(el('span', { class: 'k-rowl' }), add(el('span', { class: 'k-rowt' }), el('span', { class: 'cap' }, String(s.format || '').toUpperCase()), el('b', null, s.name)), el('span', { class: 'mono muted' }, s.path + (s.note ? ' · ' + s.note : '')),
            add(el('span', { class: 'sy-chips' }), stChip(t('kOwners')[s.owner] || s.owner, K_OWN_CLS[s.owner]), stChip(t('kReads')[s.read] || s.read, K_READ_CLS[s.read]))), el('span', { class: 'mono k-right' }, s.delete || ''));
        b.addEventListener('click', function () { kState.sel = s.name; kRedraw(); });
        rows.appendChild(b);
    });
    main.appendChild(add(sec, rows));
    var cur = shown.filter(function (s) { return s.name === kState.sel; })[0];
    var pad = el('div', { class: 'sy-detail', id: 'k-detail' });
    if (!cur) pad.appendChild(el('span', { class: 'soft' }, t('kPick')));
    else {
        pad.appendChild(el('span', { class: 'mono sy-dn' }, cur.name));
        var kv = el('div', { class: 'mono sy-kv' });
        [[0, t('kOwners')[cur.owner] || cur.owner], [1, cur.path], [2, cur.format], [3, t('kReads')[cur.read] || cur.read], [4, cur.note], [5, cur.gap], [6, cur.delete]].forEach(function (x) { if (x[1]) add(kv, el('span', { class: 'muted' }, t('kRows')[x[0]]), el('span', null, x[1])); });
        pad.appendChild(kv);
    }
    right.appendChild(pad);
}

AREA_MODULES.knowledge = {
    tabs: [],
    railTitles: ['kFilter', 'kDetail'],
    ownsBar: true,
    // The page is live without a payload: the Markdown count comes from the code model.
    extra: function () { return true; },
    extraItems: function () { return []; },
    items: function (p) { return (p.sources || []).map(function (s) { return { key: 'source/' + s.name, kind: 'source', label: s.name, sub: s.path, rows: [], witnesses: [] }; }); },
    meta: function (p) { return num((p.sources || []).length) + ' sources'; },
    page: function (p, view, key, host) {
        var tabs = el('div', { class: 'lenses', role: 'tablist', 'aria-label': t('views') });
        t('kLenses').forEach(function (o) {
            var b = el('button', { type: 'button', role: 'tab', class: 'lens', 'aria-selected': String(kState.lens === o[0]), 'data-lens': o[0] }, o[1]);
            b.addEventListener('click', function () { kState.lens = o[0]; kState.sel = null; kRedraw(); });
            tabs.appendChild(b);
        });
        var pk = KA.knowledge;
        host.bar.appendChild(tabs);
        host.bar.appendChild(add(el('span', { class: 'mono av-barmeta' }), el('span', null, pk && !pk.empty ? pk.reader : 'map.json · doc nodes'), document.createTextNode(' '), stChip(t('completeNames')[pk && !pk.empty ? pk.completeness : 'partial'], pk && !pk.empty ? COMPLETE_CLASS[pk.completeness] : 'warn')));
        kFilter(host.left);
        kMain(host.main, host.right);
    }
};
