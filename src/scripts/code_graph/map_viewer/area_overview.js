/*
 * Overview: the map's home. One card per area with what was read, when, how
 * much of it, how many findings, and the state its facts are in — or that no
 * reader ran, and why. The state is derived from the data on this page only.
 */
extendStrings({
    en: {
        oTitle: 'What does the map know – and how sure is it?',
        oIntro: 'The graph is an index, not the truth. Each area shows what was read and from where, and whether a witness was re-read since. Without a complete read every count is a lower bound and an absent fact is "unknown", never "missing".',
        oSource: 'source', oCommit: 'commit', oGeneration: 'generation', oState: 'graph state', oExport: 'export', oNoGlobal: 'no data of other projects ✓',
        oStateLegend: 'State per fact', oRungLegend: 'Source:', oFilters: { all: 'All areas', live: 'With data', none: 'No data yet' },
        oIndexed: 'indexed', oConfirmed: 'witness re-read', oCoverage: 'coverage', oFindings: 'findings', oNever: 'never (index only)',
        oBadge: { live: 'data', empty: 'read, empty', none: 'no data yet' },
        states: { fresh: 'fresh', stale: 'stale', contradicted: 'contradicted', unverifiable: 'unverifiable', incomplete: 'incomplete' },
        stateWhy: {
            fresh: 'the graph is level with HEAD', stale: 'the graph is behind the working tree', unverifiable: 'no graph index was found',
            contradicted: function (n) { return n + ' witness(es) changed or gone since they were read'; }, incomplete: 'the reader saw only part of its population'
        },
        oCodeWhat: function (f, e, g) { return f + ' files · ' + e + ' trusted links · ' + g + ' guessed'; }, oCodeCov: function (l, p) { return l + ' languages · ' + p + ' providers'; },
        oBarCode: 'trusted / guessed links', oBarArea: 'witnesses: confirmed / moved or added / changed / gone / index only', oConfirmedShare: function (a, b) { return a + ' of ' + b; },
        oTours: 'Tours', oStepStale: 'input changed', oProtocol: 'Before acting on a fact',
        oSteps: ['Find it with the map — a candidate, never the whole population.', 'Confirm its witness against the source: confirmed, moved, changed or gone.', 'Act, then re-read what you touched and update the map.'],
        oProjects: 'Projects live only in the hub on this machine, never in this file.'
    },
    de: {
        oTitle: 'Was weiß die Karte – und wie sicher?',
        oIntro: 'Der Graph ist ein Index, keine Wahrheit. Jede Ebene zeigt, was woraus gelesen wurde und ob ein Nachweis seither neu gelesen wurde. Ohne vollständiges Lesen ist jede Zahl eine Untergrenze, und ein fehlender Fakt heißt „unbekannt“, nie „fehlt“.',
        oSource: 'Quelle', oCommit: 'Commit', oGeneration: 'Generation', oState: 'Graph-Zustand', oExport: 'Export', oNoGlobal: 'keine Daten anderer Projekte ✓',
        oStateLegend: 'Zustand je Fakt', oRungLegend: 'Quelle:', oFilters: { all: 'Alle Ebenen', live: 'Mit Daten', none: 'Noch keine Daten' },
        oIndexed: 'indiziert', oConfirmed: 'Nachweis neu gelesen', oCoverage: 'Abdeckung', oFindings: 'Befunde', oNever: 'nie (nur Index)',
        oBadge: { live: 'Daten', empty: 'gelesen, leer', none: 'noch keine Daten' },
        states: { fresh: 'fresh', stale: 'stale', contradicted: 'contradicted', unverifiable: 'unverifiable', incomplete: 'incomplete' },
        stateWhy: {
            fresh: 'der Graph ist auf HEAD-Stand', stale: 'der Graph liegt hinter dem Arbeitsbaum', unverifiable: 'es wurde kein Graph-Index gefunden',
            contradicted: function (n) { return n + ' Nachweis(e) geändert oder weg, seit sie gelesen wurden'; }, incomplete: 'der Leser hat nur einen Teil seiner Grundgesamtheit gesehen'
        },
        oCodeWhat: function (f, e, g) { return f + ' Dateien · ' + e + ' sichere Verweise · ' + g + ' geraten'; }, oCodeCov: function (l, p) { return l + ' Sprachen · ' + p + ' Provider'; },
        oBarCode: 'sichere / geratene Verweise', oBarArea: 'Nachweise: bestätigt / verschoben oder neu / geändert / weg / nur Index', oConfirmedShare: function (a, b) { return a + ' von ' + b; },
        oTours: 'Touren', oStepStale: 'Eingabe geändert', oProtocol: 'Bevor auf einen Fakt hin gehandelt wird',
        oSteps: ['Mit der Karte finden — ein Kandidat, nie die ganze Grundgesamtheit.', 'Den Nachweis an der Quelle bestätigen: bestätigt, verschoben, geändert oder weg.', 'Handeln, dann das Berührte neu lesen und die Karte aktualisieren.'],
        oProjects: 'Projekte liegen nur im Hub auf diesem Rechner, nie in dieser Datei.'
    }
});

var STATE_CLASS = { fresh: 'ok', stale: 'warn', contradicted: 'bad', unverifiable: 'dash', incomplete: 'violet' };
var ovFilter = 'all';

/** The freshness of the whole graph, as one of the fact states. */
function graphFactState() {
    var st = String((model.pin && model.pin.freshness) || meta.state || '');
    if (st === 'fresh') return 'fresh';
    if (st === 'absent' || st === '') return 'unverifiable';
    return 'stale';
}
function areaFactState(id) {
    var c = confirmCounts(id);
    var off = c.changed + c.gone;
    if (off) return ['contradicted', t('stateWhy').contradicted(num(off))];
    if (KA[id].completeness !== 'complete') return ['incomplete', t('stateWhy').incomplete];
    var g = graphFactState();
    return [g, t('stateWhy')[g]];
}

function ovBar(parts) {
    var b = el('div', { class: 'stack' });
    parts.forEach(function (p) {
        if (!p[0]) return;
        var i = el('i', { class: p[2] === 'hatch' ? 'hatch' : '' });
        i.style.width = p[0] + '%';
        if (p[2] !== 'hatch') i.style.background = p[2];
        b.appendChild(i);
    });
    return b;
}

function ovCard(id) {
    var live = id === 'code' || (KA[id] && !KA[id].empty);
    var kind = id === 'code' || live ? 'live' : KA[id] ? 'empty' : 'none';
    var a = el('a', { href: '#/' + id, class: 'card ocard ' + kind, id: 'ov-' + id });
    var badge = kind === 'live' ? stChip(t('oBadge').live, 'ok') : el('span', { class: 'nodata-tag' }, t('oBadge')[kind]);
    add(a, add(el('div', { class: 'between' }), el('b', null, t('areaNames')[id]), badge));
    var pin = model.pin || { commit: meta.commit, date: '' };
    var indexed = pin.commit + (pin.date ? ' · ' + pin.date : '');
    if (id === 'code') {
        var provs = model.providers || [];
        a.appendChild(el('span', { class: 'what' }, t('oCodeWhat')(num(files.length), num(an.trustedEdges), pct(an.guessShare))));
        var never = el('span', null, t('oNever'));
        never.style.color = 'var(--amberText)';
        a.appendChild(kvGrid([[t('oIndexed'), indexed], [t('oConfirmed'), never], [t('oCoverage'), t('oCodeCov')(num((model.languages || []).length), num(provs.length))], [t('oFindings'), num(codeFindingCount())]]));
        var tot = an.trustedEdges + an.guessEdgeCount || 1;
        a.appendChild(ovBar([[an.trustedEdges / tot * 100, '', 'var(--cyan)'], [an.guessEdgeCount / tot * 100, '', 'hatch']]));
        a.appendChild(el('span', { class: 'note-line' }, t('oBarCode')));
        var gs = graphFactState();
        a.appendChild(add(el('div', { class: 'ostate' }), stChip(t('states')[gs], STATE_CLASS[gs]), el('span', { class: 'muted' }, t('stateWhy')[gs])));
        return a;
    }
    a.appendChild(el('span', { class: 'what' }, t('areaWhat')[id]));
    var p = KA[id];
    if (!p) { a.appendChild(el('p', { class: 'reason' }, t('noReader')[id])); return a; }
    if (p.empty) { a.appendChild(el('p', { class: 'reason' }, t('foundNothing')(p.reader) + ': ' + p.empty)); return a; }
    var c = confirmCounts(id);
    var reread = c.total - c.unconfirmed;
    a.appendChild(kvGrid([[t('oIndexed'), indexed], [t('oConfirmed'), reread ? t('oConfirmedShare')(num(reread), num(c.total)) : t('oNever')],
        [t('oCoverage'), t('completeNames')[p.completeness]], [t('oFindings'), num((p.findings || []).length)], [t('reader'), p.reader]]));
    var tc = c.total || 1;
    a.appendChild(ovBar([[c.confirmed / tc * 100, '', 'var(--green)'], [(c.moved + c.added) / tc * 100, '', 'var(--cyan)'], [c.changed / tc * 100, '', 'hatch'], [c.gone / tc * 100, '', 'var(--alert)']]));
    a.appendChild(el('span', { class: 'note-line' }, t('oBarArea')));
    var st = areaFactState(id);
    a.appendChild(add(el('div', { class: 'ostate' }), stChip(t('states')[st[0]], STATE_CLASS[st[0]]), el('span', { class: 'muted' }, st[1])));
    return a;
}

function renderOverview() {
    var main = $('av-main');
    var head = el('div', { class: 'ov-head' });
    add(head, add(el('div', { class: 'ov-intro' }), el('h1', null, t('oTitle')), el('p', { class: 'soft' }, t('oIntro'))));
    var pin = model.pin || { commit: meta.commit, date: '', freshness: meta.state, generation: meta.graph_generation || '' };
    var nog = el('span', null, t('oNoGlobal'));
    nog.style.color = 'var(--greenText)';
    head.appendChild(add(el('div', { class: 'manifest' }), kvGrid([[t('oSource'), 'map.json'], [t('oCommit'), pin.commit + (pin.date ? ' · ' + pin.date : '')],
        [t('oGeneration'), String(pin.generation || '').slice(0, 8)], [t('oState'), String(pin.freshness || meta.state || '')], [t('oExport'), nog]])));
    main.appendChild(head);

    var legend = add(el('div', { class: 'legend ov-legend' }), el('b', null, t('oStateLegend')));
    ['fresh', 'stale', 'contradicted', 'unverifiable', 'incomplete'].forEach(function (s) { legend.appendChild(stChip(t('states')[s], STATE_CLASS[s])); });
    legend.appendChild(el('span', { class: 'muted' }, t('oRungLegend')));
    legend.appendChild(el('span', { class: 'mono soft' }, ['T1', 'T2', 'T3', 'T4'].map(function (r) { return t('rungNames')[r]; }).join(' · ')));
    main.appendChild(legend);

    var tabs = el('div', { class: 'ov-filters', role: 'tablist', 'aria-label': 'Filter' });
    ['all', 'live', 'none'].forEach(function (f) {
        var b = el('button', { type: 'button', role: 'tab', class: 'fbtn', 'aria-selected': String(ovFilter === f), 'aria-pressed': String(ovFilter === f) }, t('oFilters')[f]);
        b.addEventListener('click', function () { ovFilter = f; renderRoute(); });
        tabs.appendChild(b);
    });
    main.appendChild(tabs);
    var grid = el('div', { class: 'ogrid' });
    ['code'].concat(KNOWLEDGE_IDS).forEach(function (id) {
        var live = id === 'code' || (KA[id] && !KA[id].empty);
        if (ovFilter === 'live' && !live) return;
        if (ovFilter === 'none' && live) return;
        grid.appendChild(ovCard(id));
    });
    main.appendChild(grid);

    var lower = el('div', { class: 'ov-lower' });
    if (KA.tours && KA.tours.length) {
        var tc = add(el('section', { class: 'card' }), el('b', null, t('oTours')));
        KA.tours.forEach(function (tour) {
            tc.appendChild(el('span', { class: 'cap' }, tour.title));
            var ol = el('ol', { class: 'tour' });
            tour.steps.forEach(function (s) {
                var b = el('a', { href: '#/' + s.area + (s.item ? '/' + encodeURIComponent(s.item) : ''), class: 'frow' });
                add(b, el('span', null, s.text), s.state === 'stale' ? stChip(t('oStepStale'), 'warn', s.inputHash) : null);
                ol.appendChild(add(el('li'), b));
            });
            tc.appendChild(ol);
        });
        lower.appendChild(tc);
    }
    var proto = add(el('section', { class: 'card' }), el('b', null, t('oProtocol')));
    var steps = el('ol', { class: 'steps' });
    t('oSteps').forEach(function (s) { steps.appendChild(el('li', null, s)); });
    add(proto, steps, el('span', { class: 'note-line' }, t('oProjects')));
    lower.appendChild(proto);
    main.appendChild(lower);
}
