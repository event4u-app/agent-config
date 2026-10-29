/*
 * Impact: what the working diff reaches, laid out as the change bar, one box
 * per layer, the check protocol an agent walks before it changes anything, and
 * the evidence report beside it. Every count comes from the diff's affected
 * items and the confirm state of their witnesses; what an agent still has to do
 * itself — search independently, propose the change, regenerate — says so.
 */
extendStrings({
    en: {
        mEmptyTab: 'Change · none', mEmptyClean: 'No change against HEAD – the working tree is clean.', mEmptyHead: function (r) { return 'No data yet: ' + r + '.'; },
        mEmptyWhat: 'Impact runs review-risk over the working diff: what a change reaches across Code, Data, Systems, Interfaces, Runtime and Delivery – with the check protocol and an evidence report.',
        mEmptyHow: 'How content appears: change a file (uncommitted) or ', mEmptyHow2: '. A preview with a sample change: the demo map.',
        mChange: 'Change', mChangeVal: function (n, r, files) { return n + (n === 1 ? ' file changed since ' : ' files changed since ') + r + ': ' + files; },
        mRiskChip: function (v) { return 'Review risk · ' + v; }, mRiskLevel: 'level', mRiskLevelT: 'review-risk sums its terms but names no levels yet, so the page cannot say low, medium or high',
        mRiskNote: 'The sum of the review-risk terms; each term is a fact on the Agent page.',
        mLayers: { data: 'Database', code: 'Code', interfaces: 'Integrations', tests: 'Tests', ops: 'CI/CD · Infra', others: 'Other projects' },
        mUnit: function (n) { return n + ' affected'; }, mMore: function (n) { return n + ' more'; },
        mState: { none: 'not affected', conflict: 'check conflict', checked: 'checked', extended: 'extended', selected: 'selected', index: 'index only', unknown: 'unknown' },
        mOthersText: 'not shared', mOthersT: 'the project map never reads other projects; the hub page lists the links between them',
        mProtocol: 'Check protocol', mReset: 'Reset', mNext: 'Next step', mDone: 'Done', mRunning: 'running …',
        mStepState: { ok: 'done', run: 'now', wait: 'open' },
        mSteps: ['Candidates from the index', 'Resolve the scope', 'Read the fresh source', 'Search independently', 'Reconcile', 'Change and test selectively', 'Regenerate the touched layers'],
        mR1: function (n, layers) { return n + ' hits in ' + layers + ' – no completeness claimed'; },
        mR2: function (r, n) { return 'against ' + r + ' · ' + n + ' changed file(s)'; },
        mR3: function (a, b) { return a + ' of ' + b + ' witnesses re-read against the working tree'; },
        mR3No: 'no witness was re-read yet: run `agent-config code-graph confirm` and redraw',
        mR4No: 'an agent searches the source itself (text search, AST); the map does not record that search',
        mR5: function (c) { return c; }, mR5No: 'needs the re-read witnesses of step 3',
        mR6No: 'the change is the agent\'s; the map only names the tests to run', mR6: function (n) { return n + ' test file(s) selected'; },
        mR7No: '`agent-config code-graph refresh --touched` re-reads the touched files; the map does not record it',
        mReport: 'Evidence report', mTally: { cand: 'Candidates', conf: 'confirmed', added: 'newly found', stale: 'stale', dyn: 'dynamic · gap', inacc: 'not accessible' },
        mDynT: 'the map records no dynamic call or gap per change yet', mInaccT: 'the map records no inaccessible witness per change yet',
        mNew: 'Found new, the graph did not know them', mNotYet: '– not searched yet', mNoNew: 'none', mAdvice: 'Proposal',
        mAdviceT: 'the map writes no change proposal; review-risk names the facts, an agent proposes the change', mTests: 'Tests',
        mNoTests: 'no test file among the affected items', mSep: '„Indexed“, „source checked“ and „coverage“ stay apart. Green only after a source check, never because the index is fresh.',
        mPicked: 'Selected', mRisk: 'Review risk', mFact: 'Fact from the graph', mContribution: 'Contribution', mTerm: 'Term',
        mMeta: function (a, c) { return a + ' affected · ' + c + ' changed'; }
    },
    de: {
        mEmptyTab: 'Änderung · keine', mEmptyClean: 'Keine Änderung gegen HEAD – der Arbeitsbaum ist sauber.', mEmptyHead: function (r) { return 'Noch keine Daten: ' + r + '.'; },
        mEmptyWhat: 'Impact rechnet review-risk über den Arbeits-Diff: Was eine Änderung über Code, Data, Systeme, Interfaces, Runtime und Delivery erreicht – mit Prüf-Protokoll und Nachweisbericht.',
        mEmptyHow: 'So entsteht Inhalt: Datei ändern (uncommitted) oder ', mEmptyHow2: '. Vorschau mit einer Beispiel-Änderung: die Demo-Map.',
        mChange: 'Änderung', mChangeVal: function (n, r, files) { return n + (n === 1 ? ' Datei geändert seit ' : ' Dateien geändert seit ') + r + ': ' + files; },
        mRiskChip: function (v) { return 'Review-Risiko · ' + v; }, mRiskLevel: 'Stufe', mRiskLevelT: 'review-risk summiert seine Terme, nennt aber noch keine Stufen; die Seite kann daher nicht niedrig, mittel oder hoch sagen',
        mRiskNote: 'Die Summe der Review-Risiko-Terme; jeder Term ist ein Fakt auf der Agent-Seite.',
        mLayers: { data: 'Database', code: 'Code', interfaces: 'Integrations', tests: 'Tests', ops: 'CI/CD · Infra', others: 'Andere Projekte' },
        mUnit: function (n) { return n + ' betroffen'; }, mMore: function (n) { return n + ' weitere'; },
        mState: { none: 'nicht betroffen', conflict: 'Konflikt prüfen', checked: 'geprüft', extended: 'erweitert', selected: 'ausgewählt', index: 'nur Index', unknown: 'unbekannt' },
        mOthersText: 'nicht freigegeben', mOthersT: 'die Projekt-Map liest nie andere Projekte; die Hub-Seite zeigt die Verbindungen zwischen ihnen',
        mProtocol: 'Prüf-Protokoll', mReset: 'Zurücksetzen', mNext: 'Nächster Schritt', mDone: 'Abgeschlossen', mRunning: 'läuft …',
        mStepState: { ok: 'erledigt', run: 'jetzt', wait: 'offen' },
        mSteps: ['Kandidaten aus dem Index', 'Scope auflösen', 'Frische Quelle lesen', 'Unabhängig suchen', 'Abgleichen', 'Ändern und gezielt testen', 'Berührte Ebenen neu erzeugen'],
        mR1: function (n, layers) { return n + ' Treffer in ' + layers + ' – keine Vollständigkeit behauptet'; },
        mR2: function (r, n) { return 'gegen ' + r + ' · ' + n + ' geänderte Datei(en)'; },
        mR3: function (a, b) { return a + ' von ' + b + ' Nachweisen gegen den Arbeitsbaum neu gelesen'; },
        mR3No: 'noch kein Nachweis neu gelesen: `agent-config code-graph confirm` ausführen und neu zeichnen',
        mR4No: 'ein Agent sucht selbst in der Quelle (Textsuche, AST); die Karte hält diese Suche nicht fest',
        mR5: function (c) { return c; }, mR5No: 'braucht die neu gelesenen Nachweise aus Schritt 3',
        mR6No: 'die Änderung macht der Agent; die Karte nennt nur die Tests dazu', mR6: function (n) { return n + ' Testdatei(en) ausgewählt'; },
        mR7No: '`agent-config code-graph refresh --touched` liest die berührten Dateien neu; die Karte hält das nicht fest',
        mReport: 'Nachweisbericht', mTally: { cand: 'Kandidaten', conf: 'bestätigt', added: 'neu entdeckt', stale: 'veraltet', dyn: 'dynamisch · Lücke', inacc: 'nicht zugänglich' },
        mDynT: 'die Karte hält je Änderung noch keine dynamischen Aufrufe oder Lücken fest', mInaccT: 'die Karte hält je Änderung noch keine unzugänglichen Nachweise fest',
        mNew: 'Neu gefunden, Graph kannte sie nicht', mNotYet: '– noch nicht gesucht', mNoNew: 'keine', mAdvice: 'Vorschlag',
        mAdviceT: 'die Karte schreibt keinen Änderungsvorschlag; review-risk nennt die Fakten, ein Agent schlägt die Änderung vor', mTests: 'Tests',
        mNoTests: 'keine Testdatei unter den betroffenen Einträgen', mSep: '„Indiziert“, „Quelle geprüft“ und „Abdeckung“ bleiben getrennt. Grün nur nach Quellprüfung, nie wegen frischem Index.',
        mPicked: 'Ausgewählt', mRisk: 'Review-Risiko', mFact: 'Fakt aus dem Graph', mContribution: 'Beitrag', mTerm: 'Term',
        mMeta: function (a, c) { return a + ' betroffen · ' + c + ' geändert'; }
    }
});

var IM_BOXES = [['data', ['data']], ['code', ['code']], ['interfaces', ['interfaces']], ['tests', ['tests']], ['ops', ['delivery', 'runtime']], ['others', []]];
var imStep = null;

function imCounts(p) {
    var c = { confirmed: 0, moved: 0, changed: 0, gone: 0, added: 0, unconfirmed: 0, total: 0 };
    p.affected.forEach(function (a) { if (c[a.witness.confirm] !== undefined) { c[a.witness.confirm] += 1; c.total += 1; } });
    return c;
}
/** The state a layer box shows, read from the confirm states of its items' witnesses. */
function imLayerState(id, list) {
    if (!list.length) return rlSt(t('mState').none, 'dash');
    var st = list.map(function (ai) { return ai[0].witness.confirm; });
    if (st.some(function (s) { return s === 'changed' || s === 'gone'; })) return rlSt(t('mState').conflict, 'warn');
    if (st.some(function (s) { return s === 'added'; })) return rlSt(t('mState').extended, 'ok');
    if (st.every(function (s) { return s === 'confirmed' || s === 'moved'; })) return rlSt(t('mState').checked, 'ok');
    if (id === 'tests') return rlSt(t('mState').selected, 'ok');
    return rlSt(t('mState').index, 'warn');
}
/** Each protocol step's result, or null where the map holds nothing for it (with the reason). */
function imSteps(p) {
    var c = imCounts(p);
    var layers = [];
    IM_BOXES.forEach(function (b) { if (p.affected.some(function (a) { return b[1].indexOf(a.layer) >= 0; })) layers.push(t('mLayers')[b[0]]); });
    var reread = c.total - c.unconfirmed;
    var tests = p.affected.filter(function (a) { return a.layer === 'tests'; }).length;
    var recon = [[c.confirmed, 'confirmed'], [c.moved, 'moved'], [c.changed, 'changed'], [c.gone, 'gone'], [c.added, 'added']]
        .filter(function (x) { return x[0] > 0; }).map(function (x) { return x[0] + ' ' + t('confirmNames')[x[1]]; }).join(' · ');
    return [
        [t('mR1')(num(p.affected.length), layers.join(', ') || '–'), null],
        [t('mR2')(p.rev, num(p.changed.length)), null],
        reread ? [t('mR3')(num(reread), num(c.total)), null] : [null, t('mR3No')],
        [null, t('mR4No')],
        reread ? [t('mR5')(recon), null] : [null, t('mR5No')],
        tests ? [t('mR6')(num(tests)), null] : [null, t('mR6No')],
        [null, t('mR7No')]
    ];
}

function imBar(p, bar) {
    var files = p.changed.join(', ');
    var input = el('input', { id: 'im-chg', class: 'mono im-chg', readonly: true, value: t('mChangeVal')(p.changed.length, p.rev, files), title: files });
    var total = p.risk ? p.risk.total : null;
    add(bar, el('label', { for: 'im-chg', class: 'cap' }, t('mChange')), input,
        total === null ? rlNd(t('mRiskLevelT'), t('mRisk')) : rlSt(t('mRiskChip')(num(total)), total > 0 ? 'warn' : 'ok', t('mRiskNote')),
        add(el('span', { class: 'im-why' }, t('mRiskLevel') + ' '), rlNd(t('mRiskLevelT'))));
    bar.classList.add('im-bar');
}

function imLayers(p, main) {
    var grid = el('div', { class: 'im-layers' });
    IM_BOXES.forEach(function (b) {
        var list = [];
        p.affected.forEach(function (a, i) { if (b[1].indexOf(a.layer) >= 0) list.push([a, i]); });
        var others = b[0] === 'others';
        var box = el('div', { class: 'im-layer' + (others ? ' unk' : '') });
        box.appendChild(add(el('div', { class: 'im-lhead' }), el('span', { class: 'im-lname' }, t('mLayers')[b[0]]), others ? rlSt(t('mState').unknown, 'dash') : imLayerState(b[0], list)));
        box.appendChild(el('span', { class: 'mono im-lcount' }, others ? '–' : t('mUnit')(num(list.length))));
        box.appendChild(others ? add(el('span', { class: 'im-ltext' }, t('mOthersText') + ' '), rlNd(t('mOthersT'))) : el('span', { class: 'im-ltext' }, list.length ? list[0][0].why : '–'));
        var items = el('span', { class: 'mono im-litems' });
        list.slice(0, 2).forEach(function (ai, k) {
            if (k) items.appendChild(document.createTextNode(' · '));
            var nb = el('button', { type: 'button', class: 'im-ilink' + (current.item === 'affected/' + ai[1] ? ' on' : ''), title: wloc(ai[0].witness) }, ai[0].name);
            nb.addEventListener('click', function () { avPick('impact', 'affected/' + ai[1]); });
            items.appendChild(nb);
        });
        if (list.length > 2) items.appendChild(document.createTextNode(' · ' + t('mMore')(num(list.length - 2))));
        if (others) items.textContent = '';
        box.appendChild(items);
        grid.appendChild(box);
    });
    main.appendChild(grid);
}

function imProtocol(p, main) {
    var steps = imSteps(p);
    if (imStep === null) { imStep = 0; while (imStep < steps.length && steps[imStep][0] !== null) imStep += 1; }
    var k = imStep;
    var sec = el('section', { class: 'im-proto' });
    var reset = el('button', { type: 'button', class: 'im-reset' }, t('mReset'));
    reset.addEventListener('click', function () { imStep = 0; renderAreaPage('impact', current.item); });
    var done = k >= steps.length;
    var next = el('button', { type: 'button', class: 'im-next', disabled: done }, done ? t('mDone') : t('mNext'));
    next.addEventListener('click', function () { if (imStep < steps.length) { imStep += 1; renderAreaPage('impact', current.item); } });
    sec.appendChild(add(el('div', { class: 'im-phead' }), el('span', { class: 'im-ptitle' }, t('mProtocol')), add(el('div', { class: 'im-pbtns' }), reset, next)));
    steps.forEach(function (s, i) {
        var st = i < k ? 'ok' : i === k ? 'run' : 'wait';
        var result;
        if (i < k) result = s[0] !== null ? el('span', { class: 'im-sres' }, s[0]) : add(el('span', { class: 'im-sres' }), rlNd(s[1]));
        else if (i === k) result = s[0] !== null ? el('span', { class: 'im-sres' }, t('mRunning')) : add(el('span', { class: 'im-sres' }), rlNd(s[1]));
        else result = el('span', { class: 'im-sres' }, '–');
        sec.appendChild(add(el('div', { class: 'im-step ' + st }), el('span', { class: 'im-dot' }, String(i + 1)),
            add(el('div', { class: 'im-stxt' }), el('span', { class: 'im-stitle' }, t('mSteps')[i]), result),
            rlSt(t('mStepState')[st], st === 'ok' ? 'ok' : st === 'run' ? 'brand' : 'dash')));
    });
    main.appendChild(sec);
}

function imReport(p, key, right) {
    var pad = el('div', { class: 'im-rpad' });
    var item = key ? itemByKey('impact', key) : null;
    if (item) {
        var x = el('button', { type: 'button', class: 'deselect', 'aria-label': t('deselect'), title: t('deselect') }, '×');
        x.addEventListener('click', function () { avPick('impact', ''); });
        pad.appendChild(add(el('div', { class: 'im-picked' }), add(el('div', { class: 'between' }), rlCap(t('mPicked') + ' · ' + item.kind), x),
            el('span', { class: 'mono im-pname' }, item.label), item.sub ? el('span', { class: 'soft' }, item.sub) : null, witnessList(item.witnesses)));
    }
    pad.appendChild(el('span', { class: 'im-rtitle' }, t('mReport')));
    var c = imCounts(p);
    var k = imStep === null ? 0 : imStep;
    var tiles = el('div', { class: 'im-tally' });
    [[t('mTally').cand, num(p.affected.length), 'line'], [t('mTally').conf, k >= 5 ? num(c.confirmed) : '–', 'green'], [t('mTally').added, k >= 4 ? num(c.added) : '–', 'cyan'],
        [t('mTally').stale, k >= 5 ? num(c.changed + c.gone) : '–', 'amber'], [t('mTally').dyn, null, 'amber', t('mDynT')], [t('mTally').inacc, null, 'line', t('mInaccT')]].forEach(function (x) {
        tiles.appendChild(add(el('div', { class: 'im-tile b-' + x[2] }), x[1] === null ? add(el('span', { class: 'mono im-tv' }, '–'), rlNd(x[3])) : el('span', { class: 'mono im-tv' }, x[1]), el('span', { class: 'im-tk' }, x[0])));
    });
    pad.appendChild(tiles);
    var fresh = add(el('div', { class: 'im-grp' }), rlCap(t('mNew')));
    var added = p.affected.filter(function (a) { return a.witness.confirm === 'added'; });
    if (k < 4) fresh.appendChild(el('span', { class: 'mono im-line' }, t('mNotYet')));
    else if (!added.length) fresh.appendChild(el('span', { class: 'mono im-line' }, t('mNoNew')));
    else added.forEach(function (a) { fresh.appendChild(el('span', { class: 'mono im-line' }, wloc(a.witness))); });
    pad.appendChild(fresh);
    pad.appendChild(add(el('div', { class: 'im-grp' }), rlCap(t('mAdvice')), add(el('span', { class: 'im-advice' }), rlNd(t('mAdviceT')))));
    var tests = p.affected.filter(function (a) { return a.layer === 'tests'; }).map(function (a) { return a.name; });
    pad.appendChild(add(el('div', { class: 'im-grp' }), rlCap(t('mTests')), tests.length ? el('span', { class: 'mono im-tests' }, tests.join(' · ') + ' · ' + num(tests.length)) : add(el('span', { class: 'mono im-tests' }, '– '), rlNd(t('mNoTests')))));
    pad.appendChild(el('span', { class: 'im-sep' }, t('mSep')));
    right.appendChild(pad);
}

/** The handover's real state of an empty change preview: the revision line, the clean-tree sentence, how content appears. */
function impactEmptyPage(p, main) {
    var card = el('div', { class: 'empty-page', id: 'nodata-impact' });
    var clean = !(p.changed || []).length && !(p.affected || []).length;
    var how = add(el('span', { class: 'ep-what' }), document.createTextNode(t('mEmptyHow')), el('span', { class: 'mono' }, 'code-graph map --diff <rev>'), document.createTextNode(t('mEmptyHow2')));
    add(card, add(el('span', { class: 'ep-chips' }), stChip('empty', 'dash'), el('span', { class: 'mono ep-rev' }, 'rev: ' + (p.rev || 'HEAD') + ' · changed: ' + num((p.changed || []).length) + ' · affected: ' + num((p.affected || []).length))),
        el('span', { class: 'ep-head' }, clean && /HEAD/.test(String(p.empty)) ? t('mEmptyClean') : t('mEmptyHead')(p.empty)), el('span', { class: 'ep-what' }, t('mEmptyWhat')), how);
    main.appendChild(card);
}

AREA_MODULES.impact = {
    tabs: [],
    railTitles: [null, 'mReport'],
    emptyTab: 'mEmptyTab',
    emptyPage: impactEmptyPage,
    ownsBar: true,
    items: function (p) {
        var out = p.affected.map(function (a, i) {
            return { key: 'affected/' + i, kind: t('mLayers')[a.layer === 'delivery' || a.layer === 'runtime' ? 'ops' : a.layer] || a.layer, label: a.name, sub: a.why, rows: [['why', a.why]], witnesses: [a.witness] };
        });
        ((p.risk && p.risk.terms) || []).forEach(function (r, i) {
            out.push({ key: 'risk/' + i, kind: 'risk term', label: r.term, sub: r.fact, rows: [[t('mFact'), r.fact], [t('mContribution'), num(r.contribution)]], witnesses: r.witness ? [r.witness] : [] });
        });
        return out;
    },
    meta: function (p) { return t('mMeta')(num(p.affected.length), num(p.changed.length)); },
    page: function (p, view, key, host) {
        imBar(p, host.bar);
        host.main.classList.add('im-main');
        imLayers(p, host.main);
        imProtocol(p, host.main);
        imReport(p, key, host.right);
    }
};
