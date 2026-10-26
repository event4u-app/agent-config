/*
 * Data — the handed-over Database page (ERD, ORM, Drift) on the shell's page
 * contract: a Schema rail (scope, sources, edge legend, findings), the centre
 * with the lenses ERD · Drift M ↔ L · Migrations, and a Detail rail. Every value
 * comes from the payload; where the design shows a field no reader fills, the
 * field stays and carries the no-data tag with its reason. The map never connects
 * to a database: "L" is the schema file the user saved, never a live catalog.
 * A table links to its model files and the request paths that reach it, a column
 * to the code that reads or writes it — each opening the file in the Code area.
 */
extendStrings({
    en: {
        dbSchema: 'Schema', dbErd: 'ERD', dbDrift: 'Drift M ↔ L', dbMig: 'Migrations',
        dColumns: function (n) { return n + ' columns'; }, dConn: 'connection', dEngine: 'engine', dType: 'type', dNull: 'nullable', dKeyT: 'key', dKind: 'Kind', dKey: 'Key',
        dOnDelete: 'on delete', dOnUpdate: 'on update', yes: 'yes', no: 'no',
        dbScope: 'Scope', dbEnv: 'environment', dbTenant: 'tenant', dbEnvNo: 'the map reads no live database, so no environment is known', dbTenantNo: 'no tenant scope is read from the schema',
        dbEngineNo: 'no engine is declared in the config, a compose file or the migrations',
        dbSources: 'Sources', srcC: 'Code / ORM', srcM: 'Migration', srcL: 'Actual schema', srcQ: 'Query use',
        srcCmeta: function (m, r) { return m + ' model file(s), ' + r + ' relation(s)'; }, srcMmeta: function (t2, f) { return 'intended state · ' + t2 + ' tables from ' + f + ' file(s)'; },
        srcLmeta: function (f) { return 'saved schema file · ' + f; }, srcLnone: 'no schema file saved', srcLno: 'save a schema-only snapshot under agents/map/data/snapshot/',
        srcQmeta: function (n) { return n + ' column(s) named in queries'; }, srcQno: 'no query names a column literally',
        covOf: function (a, b) { return a + ' of ' + b + ' tables'; },
        dbEdges: 'Edges', edgePhys: 'physical FK (L/M)', edgeOrm: 'ORM relation (C)', edgeRule: 'delete rule as label', edgeNote: 'An ORM relation is never a FK. A missing FK is a hint, not an error.',
        dbFindings: 'Findings', dbNoFindings: 'No findings.',
        dbMeta: function (t2, r) { return t2 + ' tables · ' + r + ' relations'; }, dbSnap: function (f) { return 'snapshot ' + f; },
        lines: 'Lines', lAll: 'All', lFocus: 'Focus', lOff: 'Off', lAllT: 'every relation', lFocusT: 'only the edges of the picked table, the rest dimmed', lOffT: 'no lines',
        cols: 'Columns', cAll: 'All', cKeys: 'Keys', cAllT: 'every column', cKeysT: 'only PK, FK, index and *_id',
        layout: 'Layout', yGrid: 'Grid', yDomain: 'By domain', yGridT: 'free arrangement', yDomainT: 'grouped by cluster of keys',
        fitB: 'Fit', resetPos: 'Reset arrangement', zoomL: function (z) { return 'Zoom ' + z + '×'; },
        erdHelp: 'Drag cards by their head, drag the background to move, mouse wheel or − / + to zoom. A large schema starts the ERD with “Focus” and “Keys only”: it shows only the edges of the picked table, every other table stays dimmed.',
        ormOnly: 'ORM only · no FK', fkCascade: 'FK · ON DELETE CASCADE', fkAct: function (a) { return 'FK · ' + a; },
        moreCols: function (n) { return '+ ' + n + (n === 1 ? ' more column' : ' more columns'); }, noTable: 'named by code, no table',
        driftIntro: function (c) { return 'Intended state (M, commit ' + c + ') against the observed state (L) of the saved schema file. A pending migration is not drift.'; },
        driftEl: 'Element', driftM: 'M · Migration', driftL: function (f) { return 'L · ' + f; }, driftOther: 'L · other environments', driftClass: 'Classification',
        drDiffType: 'Drift · type', drDiffNull: 'Drift · nullable', drAbsent: 'Drift · missing', drSame: 'matching', unverifiable: 'unverifiable', present: 'present',
        driftFoot: 'Other environments: the map reads no catalog → unverifiable, never “missing”.', driftNone: 'no saved schema file covers a table: put a schema-only snapshot under agents/map/data/snapshot/',
        migApplied: 'applied state unknown: the map never reads the migrations table', migNoDate: 'the file name carries no date',
        migWhat: function (tb, c, k) { return 'create ' + tb + ' · ' + c + ' column(s)' + (k ? ' · ' + k + ' FK' : ''); },
        dbDetail: 'Detail', evidence: 'Evidence', indexed: 'indexed', checked: 'source checked', checkedNo: 'no – required before a change', checkedYes: 'yes – every span re-read',
        confidence: 'confidence', rule: 'rule', why: 'Possible reasons', verifyNow: 'Verify now', openSource: 'Open source', markIntended: 'Mark as intended',
        verifyCmd: 'Run in the project to re-read the witnesses:', intendedCmd: 'Add to agents/map/data/declarations.json, then redraw the map:',
        acNote: 'AC only proposes. No automatic DDL, no “add FK” button.', whyNo: 'the rule names no fix for this finding', indexedNo: 'the map records no index date',
        links: 'Links', lModels: 'Model files', lPaths: 'Request paths', lReads: 'Read in', lWrites: 'Written in', lTable: 'Table', notOnMap: 'not on the Code map', openCode: 'open in Code',
        tableSum: function (c, m, r) { return c + ' column(s) · ' + m + ' model file(s) · ' + r + ' request path(s)'; }, nRW: function (r, w) { return 'read ×' + r + ' · written ×' + w; },
        actualT: 'actual', absentActual: 'absent in actual', notCovered: 'not in the saved schema file', notUsed: 'not named in code', pickTable: 'Pick a table or a finding.'
    },
    de: {
        dbSchema: 'Schema', dbErd: 'ERD', dbDrift: 'Drift M ↔ L', dbMig: 'Migrationen',
        dColumns: function (n) { return n + ' Spalten'; }, dConn: 'connection', dEngine: 'engine', dType: 'Typ', dNull: 'nullable', dKeyT: 'Schlüssel', dKind: 'Art', dKey: 'Schlüssel',
        dOnDelete: 'on delete', dOnUpdate: 'on update', yes: 'ja', no: 'nein',
        dbScope: 'Scope', dbEnv: 'umgebung', dbTenant: 'tenant', dbEnvNo: 'die Karte liest keine Live-Datenbank, eine Umgebung ist nicht bekannt', dbTenantNo: 'aus dem Schema wird kein Tenant-Scope gelesen',
        dbEngineNo: 'weder Config noch Compose-Datei noch Migrationen nennen eine Engine',
        dbSources: 'Quellen', srcC: 'Code / ORM', srcM: 'Migration', srcL: 'Ist-Schema', srcQ: 'Query-Nutzung',
        srcCmeta: function (m, r) { return m + ' Model-Datei(en), ' + r + ' Relation(en)'; }, srcMmeta: function (t2, f) { return 'gewünschter Stand · ' + t2 + ' Tabellen aus ' + f + ' Datei(en)'; },
        srcLmeta: function (f) { return 'gespeicherte Schema-Datei · ' + f; }, srcLnone: 'keine Schema-Datei gespeichert', srcLno: 'einen Schema-Snapshot unter agents/map/data/snapshot/ ablegen',
        srcQmeta: function (n) { return n + ' Spalte(n) in Queries benannt'; }, srcQno: 'keine Query nennt eine Spalte wörtlich',
        covOf: function (a, b) { return a + ' von ' + b + ' Tabellen'; },
        dbEdges: 'Kanten', edgePhys: 'physischer FK (L/M)', edgeOrm: 'ORM-Beziehung (C)', edgeRule: 'Löschregel als Label', edgeNote: 'Eine ORM-Beziehung ist nie ein FK. Fehlt ein FK, ist das ein Hinweis, kein Fehler.',
        dbFindings: 'Befunde', dbNoFindings: 'Keine Befunde.',
        dbMeta: function (t2, r) { return t2 + ' Tabellen · ' + r + ' Beziehungen'; }, dbSnap: function (f) { return 'Snapshot ' + f; },
        lines: 'Linien', lAll: 'Alle', lFocus: 'Fokus', lOff: 'Aus', lAllT: 'alle Beziehungen', lFocusT: 'nur Kanten der gewählten Tabelle, Rest gedimmt', lOffT: 'keine Linien',
        cols: 'Spalten', cAll: 'Alle', cKeys: 'Schlüssel', cAllT: 'alle Spalten', cKeysT: 'nur PK, FK, Index und *_id',
        layout: 'Layout', yGrid: 'Raster', yDomain: 'Nach Domäne', yGridT: 'freie Anordnung', yDomainT: 'gruppiert nach Schlüssel-Cluster',
        fitB: 'Einpassen', resetPos: 'Anordnung zurücksetzen', zoomL: function (z) { return 'Zoom ' + z + '×'; },
        erdHelp: 'Karten am Kopf ziehen, Hintergrund ziehen zum Verschieben, Mausrad oder − / + zum Zoomen. Bei großen Schemas startet das ERD mit „Fokus“ und „nur Schlüssel“: Es zeigt nur die Kanten der gewählten Tabelle, alle anderen Tabellen bleiben gedimmt.',
        ormOnly: 'ORM only · kein FK', fkCascade: 'FK · ON DELETE CASCADE', fkAct: function (a) { return 'FK · ' + a; },
        moreCols: function (n) { return '+ ' + n + (n === 1 ? ' weitere Spalte' : ' weitere Spalten'); }, noTable: 'vom Code benannt, keine Tabelle',
        driftIntro: function (c) { return 'Gewünschter Stand (M, Commit ' + c + ') gegen beobachteten Stand (L) der gespeicherten Schema-Datei. Offene Migration ist kein Drift.'; },
        driftEl: 'Element', driftM: 'M · Migration', driftL: function (f) { return 'L · ' + f; }, driftOther: 'L · weitere Umgebungen', driftClass: 'Einordnung',
        drDiffType: 'Drift · Typ', drDiffNull: 'Drift · nullable', drAbsent: 'Drift · fehlt', drSame: 'übereinstimmend', unverifiable: 'unverifiable', present: 'vorhanden',
        driftFoot: 'Weitere Umgebungen: die Karte liest keinen Katalog → unverifiable, nie „fehlt“.', driftNone: 'keine gespeicherte Schema-Datei deckt eine Tabelle ab: einen Schema-Snapshot unter agents/map/data/snapshot/ ablegen',
        migApplied: 'angewendeter Stand unbekannt: die Karte liest die migrations-Tabelle nie', migNoDate: 'der Dateiname trägt kein Datum',
        migWhat: function (tb, c, k) { return 'create ' + tb + ' · ' + c + ' Spalte(n)' + (k ? ' · ' + k + ' FK' : ''); },
        dbDetail: 'Detail', evidence: 'Nachweis', indexed: 'indiziert', checked: 'Quelle geprüft', checkedNo: 'nein – vor Änderung Pflicht', checkedYes: 'ja – jede Stelle neu gelesen',
        confidence: 'confidence', rule: 'regel', why: 'Mögliche Gründe', verifyNow: 'Jetzt verifizieren', openSource: 'Quelle öffnen', markIntended: 'Als beabsichtigt markieren',
        verifyCmd: 'Im Projekt ausführen, um die Nachweise neu zu lesen:', intendedCmd: 'In agents/map/data/declarations.json eintragen, dann die Karte neu zeichnen:',
        acNote: 'AC schlägt nur vor. Kein automatisches DDL, kein „FK hinzufügen“-Knopf.', whyNo: 'die Regel nennt für diesen Befund keinen Fix', indexedNo: 'die Karte hält kein Index-Datum fest',
        links: 'Verknüpfungen', lModels: 'Model-Dateien', lPaths: 'Request-Pfade', lReads: 'Gelesen in', lWrites: 'Geschrieben in', lTable: 'Tabelle', notOnMap: 'nicht auf der Code-Karte', openCode: 'im Code öffnen',
        tableSum: function (c, m, r) { return c + ' Spalte(n) · ' + m + ' Model-Datei(en) · ' + r + ' Request-Pfad(e)'; }, nRW: function (r, w) { return 'gelesen ×' + r + ' · geschrieben ×' + w; },
        actualT: 'tatsächlich', absentActual: 'fehlt tatsächlich', notCovered: 'nicht in der gespeicherten Schema-Datei', notUsed: 'im Code nicht benannt', pickTable: 'Tabelle oder Befund wählen.'
    }
});

var DB_BIG = 12;
var DB_CARD_W = 180;
var DB_GAP_X = 64;
var DB_GAP_Y = 80;
var dbState = { lines: null, cols: null, layout: 'grid', src: { C: true, M: true, L: true, Q: false }, focus: '', pos: Object.create(null), z: 1, panX: 0, panY: 0, fitted: false, act: '' };

function dBare(tb) { return tb.connection !== 'default' && tb.name.indexOf(tb.connection + ':') === 0 ? tb.name.slice(tb.connection.length + 1) : tb.name; }
function dTable(p, name) { for (var i = 0; i < p.tables.length; i++) if (p.tables[i].name === name) return p.tables[i]; return null; }
function dClassOf(file) { return base(file).replace(/\.[A-Za-z0-9]+$/, ''); }
/** The shipped no-data tag alone, the reason in its title: for a slot as small as a chip. */
function dNoDataTag(reason) { return el('span', { class: 'nodata-tag', title: t('noDataTitle')(reason) }, t('noDataShort')); }
function dNoData(reason) { var s = el('span', { class: 'nodata-tag', title: t('noDataTitle')(reason) }, t('noDataShort')); return add(el('span', { class: 'db-nd' }), s, el('span', { class: 'muted' }, ' ' + reason)); }

/** A relation side names a model class or a table; this resolves it to a table, or null when no table backs it. */
function dRelTable(p, name) {
    var hit = null;
    p.tables.forEach(function (tb) {
        if (hit) return;
        if (tb.name === name || dBare(tb) === name || tb.models.some(function (m) { return dClassOf(m) === name; })) hit = tb;
    });
    return hit;
}

/** How a column compares between the migrations and the saved schema file — by the type family DR-11 compares, never by spelling. */
function dActualState(c) {
    if (c.actual === undefined) return 'uncovered';
    if (c.actual === null) return 'absent';
    if (c.actual.nullable !== c.nullable) return 'nullable';
    var same = c.family && c.actual.family ? c.family === c.actual.family : String(c.type).toLowerCase() === String(c.actual.type).toLowerCase();
    return same ? 'same' : 'type';
}

/** Tables a finding is about: named in its subject, or holding the span one of its witnesses points at. */
function dFindingTables(p, f) {
    var hit = Object.create(null);
    var subj = String(f.subject || '').replace(/^(column|table):/, '');
    p.tables.forEach(function (tb) {
        var bare = dBare(tb);
        if (subj === tb.name || subj === bare || subj.indexOf(tb.name + '.') === 0 || subj.indexOf(bare + '.') === 0) hit[tb.name] = true;
        (f.witnesses || []).forEach(function (w) {
            if (tb.witness.file === w.file && tb.witness.line === w.line) hit[tb.name] = true;
            tb.columns.forEach(function (c) { if (c.witness.file === w.file && c.witness.line === w.line) hit[tb.name] = true; });
        });
    });
    return hit;
}

function dCodeIndex(path) { for (var i = 0; i < files.length; i++) if (files[i].path === path) return i; return -1; }
function dCodeLink(path, line) {
    var i = dCodeIndex(path);
    return { label: path + (line ? ':' + line : ''), go: i < 0 ? null : function () { go('code'); openFile(i); } };
}
/** Request paths whose walk reaches the table, read from the Code area's own analysis. */
function dPathsTo(tb) {
    var bare = dBare(tb);
    return ((an && an.requestPaths) || []).filter(function (r) {
        return (r.tables || []).concat(r.inferredTables || []).some(function (n) { return n === bare || n === tb.name; });
    });
}

/** Which source a witness came from: a migration or dump (M), a saved schema file (L), a query (Q), or code (C). */
function dBadgeOf(w, query) {
    if (query) return 'Q';
    if (w.rung === 'T3' || w.rung === 'T4' || /^agents\/map\/data\//.test(w.file)) return 'L';
    if (w.rung === 'T2' || /migration|schema|\.sql$/i.test(w.file)) return 'M';
    return 'C';
}

function dTableLinks(tb) {
    var out = tb.models.map(function (m) { return [t('lModels'), dCodeLink(m)]; });
    dPathsTo(tb).forEach(function (r) {
        var f = r.handler >= 0 ? r.handler : r.file;
        out.push([t('lPaths'), { label: r.route, sub: files[f] ? files[f].path : '', go: files[f] ? function () { go('code'); openFile(f); } : null }]);
    });
    return out;
}
function dColumnLinks(tb, c) {
    var out = [];
    if (c.code) {
        c.code.reads.forEach(function (w) { out.push([t('lReads'), dCodeLink(w.file, w.line)]); });
        c.code.writes.forEach(function (w) { out.push([t('lWrites'), dCodeLink(w.file, w.line)]); });
    }
    out.push([t('lTable'), { label: tb.name, go: function () { avPick('data', 'table/' + tb.name); } }]);
    return out;
}
function dSev(f) { return stChip(t('sevNames')[f.severity] || f.severity, SEV_CLASS[f.severity] === 'bad' ? 'red' : SEV_CLASS[f.severity]); }

AREA_MODULES.data = {
    tabs: [['erd', 'dbErd'], ['drift', 'dbDrift'], ['mig', 'dbMig']],
    railTitles: ['dbSchema', 'dbDetail'],
    items: function (p) {
        var out = [];
        p.tables.forEach(function (tb) {
            out.push({ key: 'table/' + tb.name, kind: 'table', label: tb.name, sub: t('dColumns')(tb.columns.length),
                rows: [[t('dConn'), tb.connection], [t('dEngine'), p.engine], ['models', tb.models.join(', ')]], witnesses: [tb.witness], links: function () { return dTableLinks(tb); } });
            tb.columns.forEach(function (c) {
                var ws = [c.witness].concat(c.actual ? [c.actual.witness] : []).concat(c.code ? c.code.reads.concat(c.code.writes) : []);
                out.push({ key: 'column/' + tb.name + '.' + c.name, kind: 'column', label: tb.name + '.' + c.name, sub: c.type,
                    rows: [[t('dType'), c.type], [t('dNull'), c.nullable ? t('yes') : t('no')], [t('dKeyT'), c.key ? c.key.toUpperCase() : '']], witnesses: ws, links: function () { return dColumnLinks(tb, c); } });
            });
        });
        p.foreignKeys.forEach(function (k) {
            var name = k.from.table + '.' + k.from.column + ' → ' + k.to.table + '.' + k.to.column;
            out.push({ key: 'fk/' + name, kind: 'foreign key', label: name, rows: [[t('dOnDelete'), k.onDelete], [t('dOnUpdate'), k.onUpdate]], witnesses: [k.witness] });
        });
        p.relations.forEach(function (r) {
            var name = r.from + ' → ' + r.to;
            out.push({ key: 'rel/' + r.kind + '/' + name, kind: 'ORM ' + r.kind, label: name, rows: [[t('dKind'), r.kind], [t('dKey'), r.key]], witnesses: [r.witness] });
        });
        return out;
    },
    meta: function (p) { return t('dbMeta')(num(p.tables.length), num(p.foreignKeys.length + p.relations.length)) + ((p.actualSources || []).length ? ' · ' + t('dbSnap')(p.actualSources.map(base).join(', ')) : ''); },
    page: function (p, view, key, slots) {
        var sel = dSelection(p, key);
        dLeft(p, sel, slots.left);
        dCentre(p, view, key, sel, slots.main);
        dDetail(p, key, sel, slots.right);
    }
};

/** What the page shows as picked: the finding (the first one when nothing is picked, as the design opens), and the table in focus. */
function dSelection(p, key) {
    var fi = key.indexOf('finding/') === 0 ? Number(key.slice(8)) : !key && (p.findings || []).length ? 0 : -1;
    var finding = fi >= 0 ? p.findings[fi] || null : null;
    var hot = finding ? dFindingTables(p, finding) : Object.create(null);
    var table = key.indexOf('table/') === 0 ? key.slice(6) : key.indexOf('column/') === 0 ? key.slice(7).replace(/\.[^.]*$/, '') : '';
    var focus = table || (finding ? Object.keys(hot)[0] || '' : '') || dbState.focus;
    if ((!focus || !dTable(p, focus)) && p.tables.length) {
        var deg = Object.create(null);
        p.foreignKeys.forEach(function (k) { deg[k.from.table] = (deg[k.from.table] || 0) + 1; deg[k.to.table] = (deg[k.to.table] || 0) + 1; });
        focus = p.tables.slice().sort(function (a, b) { return (deg[b.name] || 0) - (deg[a.name] || 0) || (a.name < b.name ? -1 : 1); })[0].name;
    }
    dbState.focus = focus;
    var hotCol = finding && /^column:/.test(String(finding.subject)) ? String(finding.subject).slice(7) : '';
    return { fi: fi, finding: finding, hot: hot, hotCol: hotCol, focus: focus };
}

// ---- Schema rail ------------------------------------------------------------------

function dSection(cap, tight) { return add(el('div', { class: 'db-sec' + (tight ? ' tight' : '') }), el('span', { class: 'cap' }, cap)); }

function dLeft(p, sel, left) {
    var wrap = el('div', { class: 'db-rail' });
    var conns = [];
    p.tables.forEach(function (tb) { if (conns.indexOf(tb.connection) < 0) conns.push(tb.connection); });
    var scope = el('div', { class: 'db-kv mono' });
    function kv(k, v) { scope.appendChild(el('span', { class: 'k' }, k)); scope.appendChild(typeof v === 'string' ? el('span', null, v) : v); }
    kv(t('dConn'), conns.join(', ') + (p.engine ? ' · ' + p.engine : ''));
    kv(t('dEngine'), p.engine ? p.engine : dNoData(t('dbEngineNo')));
    kv(t('dbEnv'), dNoData(t('dbEnvNo')));
    kv(t('dbTenant'), dNoData(t('dbTenantNo')));
    wrap.appendChild(add(dSection(t('dbScope')), scope));

    var srcs = dSection(t('dbSources'));
    var models = Object.create(null);
    p.tables.forEach(function (tb) { tb.models.forEach(function (m) { models[m] = true; }); });
    var migFiles = Object.create(null);
    p.tables.forEach(function (tb) { if (dBadgeOf(tb.witness) === 'M') migFiles[tb.witness.file] = true; });
    var covered = p.tables.filter(function (tb) { return tb.columns.some(function (c) { return c.actual !== undefined; }); }).length;
    var queried = 0;
    p.tables.forEach(function (tb) { tb.columns.forEach(function (c) { if (c.code) queried += 1; }); });
    var actual = p.actualSources || [];
    var nModels = Object.keys(models).length;
    var defs = [
        ['C', t('srcC'), t('srcCmeta')(num(nModels), num(p.relations.length)), nModels || p.relations.length ? stChip(t('completeNames')[p.completeness] || p.completeness, COMPLETE_CLASS[p.completeness]) : dNoDataTag(t('noDataUnknown'))],
        ['M', t('srcM'), t('srcMmeta')(num(p.tables.length), num(Object.keys(migFiles).length)), stChip(t('completeNames')[p.completeness] || p.completeness, COMPLETE_CLASS[p.completeness])],
        ['L', t('srcL'), actual.length ? t('srcLmeta')(actual.map(base).join(', ')) : t('srcLnone') + ' · ' + t('srcLno'), actual.length ? stChip(t('covOf')(num(covered), num(p.tables.length)), covered === p.tables.length ? 'ok' : 'warn') : dNoDataTag(t('srcLno'))],
        ['Q', t('srcQ'), t('srcQmeta')(num(queried)), queried ? stChip(t('completeNames').partial, 'warn', t('lowerBound')) : dNoDataTag(t('srcQno'))]
    ];
    defs.forEach(function (d) {
        var on = dbState.src[d[0]];
        var b = el('button', { type: 'button', role: 'switch', class: 'db-switch', 'aria-checked': String(on), 'data-src': d[0] });
        add(b, el('span', { class: 'db-src ' + d[0] + (on ? '' : ' off') }, d[0]), add(el('span', { class: 'nm' }), el('b', null, d[1]), el('span', null, d[2])), d[3]);
        b.addEventListener('click', function () { dbState.src[d[0]] = !dbState.src[d[0]]; renderAreaPage('data', current.item); });
        srcs.appendChild(b);
    });
    wrap.appendChild(srcs);

    var edges = dSection(t('dbEdges'), true);
    function svgLine(cls) {
        var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('width', '34');
        s.setAttribute('height', '8');
        s.setAttribute('aria-hidden', 'true');
        var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', '0'); l.setAttribute('y1', '4'); l.setAttribute('x2', '34'); l.setAttribute('y2', '4');
        if (cls) l.setAttribute('class', cls);
        s.appendChild(l);
        return s;
    }
    add(edges, add(el('div', { class: 'db-edge' }), svgLine(''), document.createTextNode(t('edgePhys'))),
        add(el('div', { class: 'db-edge' }), svgLine('orm'), document.createTextNode(t('edgeOrm'))),
        add(el('div', { class: 'db-edge' }), stChip('CASCADE', 'red'), document.createTextNode(t('edgeRule'))),
        el('span', { class: 'db-note' }, t('edgeNote')));
    wrap.appendChild(edges);

    var fl = dSection(t('dbFindings'), true);
    var list = p.findings || [];
    if (!list.length) fl.appendChild(el('span', { class: 'db-note' }, t('dbNoFindings')));
    list.forEach(function (f, i) {
        var b = el('button', { type: 'button', class: 'db-find', 'aria-pressed': String(sel.fi === i), title: f.message });
        add(b, el('span', { class: 'id' }, f.id), el('span', { class: 'sh' }, String(f.subject).replace(/^(column|table):/, '').replace(/^.*#/, '')), dSev(f));
        b.addEventListener('click', function () { avPick('data', 'finding/' + i); });
        fl.appendChild(b);
    });
    wrap.appendChild(fl);
    left.appendChild(wrap);
}

// ---- Centre ---------------------------------------------------------------------

function dCentre(p, view, key, sel, main) {
    // The shell draws the head row (crumbs, lenses, reader line); the design's centre has no padding of its own.
    $('av-main').classList.add('db-main');
    main.classList.add('db-body');
    if (view === 'drift') dDriftLens(p, main);
    else if (view === 'mig') dMigLens(p, main);
    else dErd(p, sel, main);
}

function dSeg(label, opts, value, pick) {
    var seg = el('div', { class: 'db-seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(function (o) {
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(value === o[0]), title: o[2], 'data-v': o[0] }, o[1]);
        b.addEventListener('click', function () { pick(o[0]); });
        seg.appendChild(b);
    });
    return add(el('div', { class: 'db-ctl' }), el('span', null, label), seg);
}

/** Clusters of tables joined by foreign keys, as the map writer drew them; computed from the keys when the payload has none. */
function dClusters(p) {
    var known = Object.create(null);
    p.tables.forEach(function (tb) { known[tb.name] = true; });
    var out = (p.erd || []).map(function (c) { return { id: c.cluster, tables: c.tables.filter(function (n) { return known[n]; }) }; }).filter(function (c) { return c.tables.length; });
    var seen = Object.create(null);
    out.forEach(function (c) { c.tables.forEach(function (n) { seen[n] = true; }); });
    var rest = p.tables.filter(function (tb) { return !seen[tb.name]; }).map(function (tb) { return tb.name; });
    var link = Object.create(null);
    rest.forEach(function (n) { link[n] = []; });
    p.foreignKeys.forEach(function (k) { if (link[k.from.table] && link[k.to.table]) { link[k.from.table].push(k.to.table); link[k.to.table].push(k.from.table); } });
    var done = Object.create(null);
    var singles = [];
    rest.forEach(function (n) {
        if (done[n]) return;
        var group = [];
        var stack = [n];
        while (stack.length) { var x = stack.pop(); if (done[x]) continue; done[x] = true; group.push(x); stack.push.apply(stack, link[x]); }
        if (group.length > 1) out.push({ id: group.sort()[0], tables: group.sort() }); else singles.push(n);
    });
    if (singles.length) out.push({ id: 'standalone', tables: singles.sort() });
    return out;
}

/** Whether the straight line between two cells passes over a taken cell in between. */
function dBlocked(taken, a, b) {
    var steps = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) * 2;
    for (var i = 1; i < steps; i++) {
        var c = Math.round(a[0] + (b[0] - a[0]) * i / steps);
        var r = Math.round(a[1] + (b[1] - a[1]) * i / steps);
        if ((c !== a[0] || r !== a[1]) && (c !== b[0] || r !== b[1]) && taken[c + ',' + r]) return true;
    }
    return false;
}

/**
 * Grid cells for the ERD: the best-joined table first, then breadth-first, each into the free
 * cell closest to its placed neighbours, avoiding a line over another card. Tables joined to
 * nothing fill the first free cells. Empty rows and columns are dropped.
 */
function dGrid(names, adj, ncols) {
    var cell = Object.create(null);
    var taken = Object.create(null);
    var nrows = Math.ceil(names.length / ncols) + 2;
    var inSet = Object.create(null);
    names.forEach(function (n) { inSet[n] = true; });
    var nbOf = Object.create(null);
    names.forEach(function (n) { nbOf[n] = adj[n].filter(function (m) { return inSet[m]; }); });
    adj = nbOf;
    var byDeg = function (a, b) { return adj[b].length - adj[a].length || (a < b ? -1 : 1); };
    var seen = Object.create(null);
    var order = [];
    names.slice().sort(byDeg).forEach(function (start) {
        if (seen[start]) return;
        var q = [start];
        seen[start] = true;
        while (q.length) {
            var x = q.shift();
            order.push(x);
            adj[x].slice().sort(byDeg).forEach(function (y) { if (!seen[y]) { seen[y] = true; q.push(y); } });
        }
    });
    order.forEach(function (n, i) {
        var nb = adj[n].filter(function (m) { return cell[m]; });
        var best = null;
        var bestCost = Infinity;
        for (var r = 0; r < nrows; r++) {
            for (var c = 0; c < ncols; c++) {
                if (taken[c + ',' + r]) continue;
                var cost = i === 0 ? Math.abs(c - Math.floor((ncols - 1) / 2)) + r * 10
                    : !nb.length ? r * 100 + c
                        : nb.reduce(function (sum, m) { return sum + Math.hypot(cell[m][0] - c, cell[m][1] - r) + (dBlocked(taken, cell[m], [c, r]) ? 3 : 0); }, 0) + r * 0.01 + c * 0.001;
                if (cost < bestCost) { bestCost = cost; best = [c, r]; }
            }
        }
        cell[n] = best;
        taken[best[0] + ',' + best[1]] = true;
    });
    var usedC = [];
    var usedR = [];
    names.forEach(function (n) { usedC[cell[n][0]] = true; usedR[cell[n][1]] = true; });
    var mapC = [];
    var mapR = [];
    var k = 0;
    for (var c2 = 0; c2 < ncols; c2++) if (usedC[c2]) mapC[c2] = k++;
    var cols = k;
    k = 0;
    for (var r2 = 0; r2 < nrows; r2++) if (usedR[r2]) mapR[r2] = k++;
    names.forEach(function (n) { cell[n] = [mapC[cell[n][0]], mapR[cell[n][1]]]; });
    return { cell: cell, cols: cols };
}

function dErd(p, sel, bodyEl) {
    var big = p.tables.length > DB_BIG;
    var lines = dbState.lines || (big ? 'focus' : 'all');
    var cols = dbState.cols || (big ? 'keys' : 'all');
    var src = dbState.src;
    var rerender = function () { renderAreaPage('data', current.item); };
    var erd = el('div', { class: 'db-erd' });
    var ctl = el('div', { class: 'db-ctls' });
    add(ctl, dSeg(t('lines'), [['all', t('lAll'), t('lAllT')], ['focus', t('lFocus'), t('lFocusT')], ['off', t('lOff'), t('lOffT')]], lines, function (v) { dbState.lines = v; rerender(); }),
        dSeg(t('cols'), [['all', t('cAll'), t('cAllT')], ['keys', t('cKeys'), t('cKeysT')]], cols, function (v) { dbState.cols = v; rerender(); }),
        dSeg(t('layout'), [['grid', t('yGrid'), t('yGridT')], ['domain', t('yDomain'), t('yDomainT')]], dbState.layout, function (v) { dbState.layout = v; dbState.pos = Object.create(null); dbState.fitted = false; rerender(); }));
    erd.appendChild(ctl);
    var stage = el('div', { class: 'db-stage', id: 'db-stage' });
    var world = el('div', { class: 'db-world' });
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'db-edges');
    svg.setAttribute('aria-hidden', 'true');
    var labels = el('div');
    stage.appendChild(world);

    // ORM relations by table pair; a side no table backs becomes a card of its own.
    var rels = [];
    var ghosts = [];
    var ghostSeen = Object.create(null);
    p.relations.forEach(function (r) {
        var a = dRelTable(p, r.from);
        var b = dRelTable(p, r.to);
        var an2 = a ? a.name : 'model:' + r.from;
        var bn = b ? b.name : 'model:' + r.to;
        [[a, r.from, an2], [b, r.to, bn]].forEach(function (s) { if (!s[0] && !ghostSeen[s[2]]) { ghostSeen[s[2]] = true; ghosts.push({ id: s[2], label: s[1] }); } });
        rels.push({ from: an2, to: bn, r: r });
    });
    var fkPair = Object.create(null);
    p.foreignKeys.forEach(function (k) { fkPair[k.from.table + '|' + k.to.table] = true; fkPair[k.to.table + '|' + k.from.table] = true; });
    var ormKey = Object.create(null);
    rels.forEach(function (r) { if (r.r.key && !fkPair[r.from + '|' + r.to]) { ormKey[r.from + '.' + r.r.key] = true; ormKey[r.to + '.' + r.r.key] = true; } });

    var names = p.tables.map(function (tb) { return tb.name; }).concat(ghosts.map(function (g) { return g.id; }));
    var near = Object.create(null);
    near[sel.focus] = true;
    p.foreignKeys.forEach(function (k) { if (k.from.table === sel.focus) near[k.to.table] = true; if (k.to.table === sel.focus) near[k.from.table] = true; });
    rels.forEach(function (r) { if (r.from === sel.focus) near[r.to] = true; if (r.to === sel.focus) near[r.from] = true; });

    var cards = Object.create(null);
    p.tables.forEach(function (tb) {
        var card = el('div', { class: 'db-table', role: 'button', tabindex: '0', 'data-table': tb.name, 'aria-label': tb.name });
        if (sel.hot[tb.name]) card.classList.add('hot');
        else if (sel.focus === tb.name) card.classList.add('focus');
        if (lines === 'focus' && !near[tb.name]) card.classList.add('faded');
        var covered = tb.columns.some(function (c) { return c.actual !== undefined; });
        var coded = tb.models.length > 0 || rels.some(function (r) { return r.from === tb.name || r.to === tb.name; });
        var head = el('div', { class: 'db-thead' });
        var bd = el('span', { class: 'bd' });
        [['C', coded], ['M', true], ['L', covered]].forEach(function (s2) { bd.appendChild(el('span', { class: 'db-src ' + s2[0] + (src[s2[0]] && s2[1] ? '' : ' off') }, s2[0])); });
        add(head, el('span', { class: 'tn', title: tb.name }, tb.name), bd);
        card.appendChild(head);
        var list = cols === 'keys' ? tb.columns.filter(function (c) { return c.key || /_id$/.test(c.name); }) : tb.columns;
        list.forEach(function (c) {
            var row = el('button', { type: 'button', class: 'db-col', title: tb.name + '.' + c.name + ' · ' + c.type + (c.nullable ? ' · nullable' : '') });
            var st = dActualState(c);
            var typeText = c.type + (c.nullable ? '?' : '');
            if (src.L && st === 'absent') row.classList.add('gone');
            else if (src.L && (st === 'type' || st === 'nullable')) { row.classList.add('diff'); row.title += ' · ' + t('actualT') + ': ' + c.actual.type + (c.actual.nullable ? '?' : ''); }
            if (src.L && !src.M && c.actual) typeText = c.actual.type + (c.actual.nullable ? '?' : '');
            if (src.C && ormKey[tb.name + '.' + c.name]) row.classList.add('orm');
            if (src.Q && c.code) { typeText = 'R' + c.code.reads.length + ' W' + c.code.writes.length; row.title += ' · ' + t('nRW')(c.code.reads.length, c.code.writes.length); }
            if (current.item === 'column/' + tb.name + '.' + c.name) row.classList.add('on');
            if (sel.hotCol && (sel.hotCol === tb.name + '.' + c.name || sel.hotCol === dBare(tb) + '.' + c.name)) row.classList.add('hotcol');
            var k = c.key ? c.key.toUpperCase() : '';
            add(row, el('span', { class: 'k ' + k }, k), el('span', { class: 'n' }, c.name), el('span', { class: 'y' }, typeText));
            row.addEventListener('click', function (ev) { ev.stopPropagation(); if (!stage.moved) avPick('data', 'column/' + tb.name + '.' + c.name); });
            card.appendChild(row);
        });
        if (list.length < tb.columns.length) card.appendChild(el('div', { class: 'db-more' }, t('moreCols')(tb.columns.length - list.length)));
        if (src.L && (p.actualSources || []).length && !covered) card.appendChild(el('div', { class: 'db-tnote muted' }, t('notCovered')));
        card.addEventListener('click', function () { if (!stage.moved) avPick('data', 'table/' + tb.name); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === card) avPick('data', 'table/' + tb.name); });
        cards[tb.name] = card;
    });
    ghosts.forEach(function (g) {
        var card = el('div', { class: 'db-table ghost', 'data-table': g.id });
        if (lines === 'focus' && !near[g.id]) card.classList.add('faded');
        add(card, add(el('div', { class: 'db-thead' }), el('span', { class: 'tn', title: g.label }, g.label)), el('div', { class: 'db-tnote' }, t('noTable')));
        cards[g.id] = card;
    });

    // Layout: a grid by joins, or one block per cluster of keys drawn as a dashed group.
    var adj = Object.create(null);
    names.forEach(function (n) { adj[n] = []; });
    function join(a, b) { if (adj[a] && adj[b] && a !== b) { adj[a].push(b); adj[b].push(a); } }
    p.foreignKeys.forEach(function (k) { join(k.from.table, k.to.table); });
    rels.forEach(function (r) { join(r.from, r.to); });
    var phone = window.innerWidth <= 720;
    var groups = [];
    if (dbState.layout === 'domain') {
        groups = dClusters(p);
        var placed = Object.create(null);
        groups.forEach(function (c) { c.tables.forEach(function (n) { placed[n] = true; }); });
        var extra = names.filter(function (n) { return !placed[n]; });
        if (extra.length) groups.push({ id: 'code', tables: extra });
    } else groups = [{ id: '', tables: names, plain: true }];
    groups.forEach(function (c) {
        var g = dGrid(c.tables, adj, phone ? 1 : Math.max(1, Math.ceil(Math.sqrt(c.tables.length * (c.plain ? 1.5 : 1)))));
        c.cell = g.cell;
        c.cols = g.cols;
        if (!c.plain) { c.box = add(el('div', { class: 'db-group' }), el('span', null, c.id)); world.appendChild(c.box); }
    });
    world.appendChild(svg);
    world.appendChild(labels);
    names.forEach(function (n) { world.appendChild(cards[n]); });
    add(erd, stage);
    bodyEl.appendChild(erd);
    // Rows are as tall as their tallest card, measured now that the cards are in the page.
    var perRow = phone ? 1 : Math.max(1, Math.ceil(Math.sqrt(groups.length)));
    var gy = 16;
    for (var i0 = 0; i0 < groups.length; i0 += perRow) {
        var gx = 16;
        var rowH = 0;
        for (var j0 = i0; j0 < Math.min(groups.length, i0 + perRow); j0++) {
            var c0 = groups[j0];
            var pad = c0.plain ? 0 : 16;
            var top = pad ? 30 : 0;
            var rowsH = [];
            c0.tables.forEach(function (n) { var r = c0.cell[n][1]; rowsH[r] = Math.max(rowsH[r] || 0, cards[n].offsetHeight); });
            var ys = [];
            var y = gy + top;
            for (var r1 = 0; r1 < rowsH.length; r1++) { ys[r1] = y; y += (rowsH[r1] || 0) + DB_GAP_Y; }
            c0.tables.forEach(function (n) {
                var pos = dbState.pos[n] || [gx + pad + c0.cell[n][0] * (DB_CARD_W + DB_GAP_X), ys[c0.cell[n][1]]];
                cards[n].style.left = pos[0] + 'px';
                cards[n].style.top = pos[1] + 'px';
            });
            var w = c0.cols * (DB_CARD_W + DB_GAP_X) - DB_GAP_X + 2 * pad;
            var h = y - DB_GAP_Y - gy + pad;
            if (c0.box) { c0.box.style.left = gx + 'px'; c0.box.style.top = gy + 'px'; c0.box.style.width = w + 'px'; c0.box.style.height = h + 'px'; }
            gx += w + 36;
            rowH = Math.max(rowH, h);
        }
        gy += rowH + 36;
    }

    var zoom = el('div', { class: 'db-zoom' });
    function zb(text, aria, cls, fn) { var b = el('button', { type: 'button', class: cls || '', 'aria-label': aria, title: aria }, text); b.addEventListener('click', fn); return b; }
    var reset = zb('', t('resetPos'), 'reset', function () { dbState.pos = Object.create(null); dbState.fitted = false; rerender(); });
    var ic = document.createElementNS(svgNS, 'svg');
    [['width', '15'], ['height', '15'], ['viewBox', '0 0 16 16'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.8'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true']].forEach(function (a) { ic.setAttribute(a[0], a[1]); });
    ['M2.5 8a5.5 5.5 0 1 0 1.7-4', 'M2.5 2.5v3.5H6'].forEach(function (d) { var pa = document.createElementNS(svgNS, 'path'); pa.setAttribute('d', d); ic.appendChild(pa); });
    reset.appendChild(ic);
    add(zoom, zb('−', t('zoomOut'), '', function () { dZoom(stage, 1 / 1.2); }), zb('+', t('zoomIn'), '', function () { dZoom(stage, 1.2); }),
        zb(t('fitB'), t('fitB'), 'fit', function () { dFit(stage); }), reset);
    var zl = el('span', { class: 'db-zl' });
    add(stage, zoom, zl);
    erd.appendChild(el('div', { class: 'db-help' }, t('erdHelp')));

    stage.db = { world: world, svg: svg, labels: labels, cards: cards, zl: zl, p: p, rels: rels, fkPair: fkPair, lines: lines, src: src, sel: sel };
    dEdges(stage);
    dInteract(stage);
    dApply(stage);
    if (!dbState.fitted) {
        dbState.fitted = true;
        requestAnimationFrame(function () { if (stage.isConnected) dFit(stage, true); });
    }
}

function dRect(card) { return { x: card.offsetLeft, y: card.offsetTop, w: card.offsetWidth, h: card.offsetHeight }; }
function dClip(r, tx, ty) {
    var cx = r.x + r.w / 2;
    var cy = r.y + r.h / 2;
    var dx = tx - cx;
    var dy = ty - cy;
    var f = Math.min(dx ? (r.w / 2) / Math.abs(dx) : 1e9, dy ? (r.h / 2) / Math.abs(dy) : 1e9, 1);
    return [cx + dx * f, cy + dy * f];
}

/** The edges as the cards stand now; drawn again after every drag. */
function dEdges(stage) {
    var e = stage.db;
    var svgNS = 'http://www.w3.org/2000/svg';
    while (e.svg.firstChild) e.svg.removeChild(e.svg.firstChild);
    clear(e.labels);
    var maxX = 0;
    var maxY = 0;
    Object.keys(e.cards).forEach(function (n) { var r = dRect(e.cards[n]); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); });
    Array.prototype.forEach.call(e.world.querySelectorAll('.db-group'), function (g) { maxX = Math.max(maxX, g.offsetLeft + g.offsetWidth); maxY = Math.max(maxY, g.offsetTop + g.offsetHeight); });
    e.world.style.width = (maxX + 24) + 'px';
    e.world.style.height = (maxY + 24) + 'px';
    e.svg.setAttribute('width', String(maxX + 24));
    e.svg.setAttribute('height', String(maxY + 24));
    if (e.lines === 'off') return;
    var phys = e.src.L || e.src.M;
    function edge(a, b, cls, off, text, lcls, title, selected) {
        var ca = e.cards[a];
        var cb = e.cards[b];
        if (!ca || !cb || a === b) return;
        if (e.lines === 'focus' && a !== e.sel.focus && b !== e.sel.focus) return;
        var ra = dRect(ca);
        var rb = dRect(cb);
        var ac = [ra.x + ra.w / 2, ra.y + ra.h / 2];
        var bc = [rb.x + rb.w / 2, rb.y + rb.h / 2];
        var len = Math.hypot(bc[0] - ac[0], bc[1] - ac[1]) || 1;
        var ox = -(bc[1] - ac[1]) / len * off;
        var oy = (bc[0] - ac[0]) / len * off;
        var p1 = dClip(ra, bc[0], bc[1]);
        var p2 = dClip(rb, ac[0], ac[1]);
        var l = document.createElementNS(svgNS, 'line');
        l.setAttribute('x1', (p1[0] + ox).toFixed(1)); l.setAttribute('y1', (p1[1] + oy).toFixed(1));
        l.setAttribute('x2', (p2[0] + ox).toFixed(1)); l.setAttribute('y2', (p2[1] + oy).toFixed(1));
        l.setAttribute('class', cls + (selected ? ' sel' : ''));
        var tt = document.createElementNS(svgNS, 'title');
        tt.textContent = title;
        l.appendChild(tt);
        e.svg.appendChild(l);
        if (!text) return;
        var mx = (p1[0] + p2[0]) / 2 + 8;
        var my = (p1[1] + p2[1]) / 2 - 10;
        if (Math.abs(bc[0] - ac[0]) > Math.abs(bc[1] - ac[1])) { mx = (p1[0] + p2[0]) / 2; my = Math.min(ra.y, rb.y) - 14; }
        // A second labelled edge between the same two cards stacks its label below the first.
        var pair = a < b ? a + '|' + b : b + '|' + a;
        my += (labelled[pair] || 0) * 18;
        labelled[pair] = (labelled[pair] || 0) + 1;
        var lb = el('div', { class: 'db-elabel ' + lcls, title: title }, text);
        lb.style.left = mx.toFixed(0) + 'px';
        lb.style.top = my.toFixed(0) + 'px';
        e.labels.appendChild(lb);
    }
    var hot = e.sel.hot;
    var labelled = Object.create(null);
    if (phys) {
        e.p.foreignKeys.forEach(function (k) {
            var cascade = /cascade/i.test(k.onDelete || '');
            var acts = [];
            if (k.onDelete) acts.push('ON DELETE ' + k.onDelete.toUpperCase());
            if (k.onUpdate) acts.push('ON UPDATE ' + k.onUpdate.toUpperCase());
            var title = k.from.table + '.' + k.from.column + ' → ' + k.to.table + '.' + k.to.column + (acts.length ? ' · ' + acts.join(' · ') : '');
            edge(k.from.table, k.to.table, cascade ? 'cascade' : '', 0, cascade ? t('fkCascade') : acts.length ? t('fkAct')(acts.join(' · ')) : '', cascade ? 'cascade' : 'act', title, hot[k.from.table] && hot[k.to.table]);
        });
    }
    if (e.src.C) {
        var seen = Object.create(null);
        var pk = function (x) { return x.from < x.to ? x.from + '|' + x.to : x.to + '|' + x.from; };
        e.rels.forEach(function (r) {
            var key = pk(r);
            if (seen[key]) return;
            seen[key] = true;
            var noFk = !e.fkPair[r.from + '|' + r.to];
            var kinds = e.rels.filter(function (x) { return pk(x) === key; }).map(function (x) { return x.r.from + ' → ' + x.r.to + ' · ' + x.r.kind; });
            edge(r.from, r.to, 'orm', phys && !noFk ? 7 : 0, noFk ? t('ormOnly') : '', 'orm', kinds.join('\n'), (hot[r.from] || /^model:/.test(r.from)) && (hot[r.to] || /^model:/.test(r.to)));
        });
    }
}

function dApply(stage) {
    stage.db.world.style.transform = 'translate(' + dbState.panX + 'px, ' + dbState.panY + 'px) scale(' + dbState.z + ')';
    stage.db.zl.textContent = t('zoomL')(dbState.z.toFixed(1).replace('.', lang === 'de' ? ',' : '.'));
    window.__mapErd = { z: dbState.z, tables: Object.keys(stage.db.cards), focus: stage.db.sel.focus, src: dbState.src, lines: stage.db.lines };
}
function dZoom(stage, f) {
    var nz = Math.max(0.4, Math.min(3, dbState.z * f));
    var cx = stage.clientWidth / 2;
    var cy = stage.clientHeight / 2;
    dbState.panX = cx - (cx - dbState.panX) * nz / dbState.z;
    dbState.panY = cy - (cy - dbState.panY) * nz / dbState.z;
    dbState.z = nz;
    dApply(stage);
}
/** Fit the whole schema into the stage; a narrow stage fits the width and pans down. */
function dFit(stage, onlyShrink) {
    var w = stage.db.world;
    var bw = parseFloat(w.style.width) || 1;
    var bh = parseFloat(w.style.height) || 1;
    var z = stage.clientWidth < 600 ? stage.clientWidth / bw : Math.min(stage.clientWidth / bw, (stage.clientHeight - 48) / bh);
    z = Math.max(0.4, Math.min(onlyShrink ? 1 : 1.5, z));
    dbState.z = z;
    dbState.panX = Math.max(0, (stage.clientWidth - bw * z) / 2);
    dbState.panY = Math.max(48, (stage.clientHeight - bh * z) / 2);
    dApply(stage);
}

function dInteract(stage) {
    stage.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || ev.target.closest('.db-zoom')) return;
        var card = ev.target.closest('.db-table');
        var sx = ev.clientX;
        var sy = ev.clientY;
        var px = dbState.panX;
        var py = dbState.panY;
        var x0 = card ? card.offsetLeft : 0;
        var y0 = card ? card.offsetTop : 0;
        stage.moved = false;
        function move(m) {
            var dx = m.clientX - sx;
            var dy = m.clientY - sy;
            if (!stage.moved && Math.abs(dx) + Math.abs(dy) <= 3) return;
            stage.moved = true;
            if (card) {
                card.classList.add('dragging');
                stage.classList.add('grabbing');
                var nx = Math.max(0, x0 + dx / dbState.z);
                var ny = Math.max(0, y0 + dy / dbState.z);
                card.style.left = nx + 'px';
                card.style.top = ny + 'px';
                dbState.pos[card.getAttribute('data-table')] = [nx, ny];
                dEdges(stage);
            } else {
                dbState.panX = px + dx;
                dbState.panY = py + dy;
                dApply(stage);
            }
        }
        function up() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            if (card) card.classList.remove('dragging');
            stage.classList.remove('grabbing');
            setTimeout(function () { stage.moved = false; }, 0);
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    });
    stage.addEventListener('wheel', function (ev) { ev.preventDefault(); dZoom(stage, ev.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
}

// ---- Drift and Migrations lenses ----------------------------------------------------------

var DRIFT_CLASS = { type: 'red', nullable: 'red', absent: 'red', same: 'ok' };
var DRIFT_LABEL = { type: 'drDiffType', nullable: 'drDiffNull', absent: 'drAbsent', same: 'drSame' };

function dDriftLens(p, bodyEl) {
    var wrap = el('div', { class: 'db-drift' });
    var commit = (model.pin && model.pin.commit) || meta.commit || '';
    wrap.appendChild(el('div', { class: 'intro' }, t('driftIntro')(commit)));
    var actual = p.actualSources || [];
    var grid = el('div', { class: 'db-grid' });
    var g = el('div');
    [t('driftEl'), t('driftM'), t('driftL')(actual.length ? actual.map(base).join(', ') : t('srcL')), t('driftOther'), t('driftClass')].forEach(function (h) { g.appendChild(el('span', { class: 'h' }, h)); });
    var rows = [];
    p.tables.forEach(function (tb) {
        tb.columns.forEach(function (c) {
            var st = dActualState(c);
            if (st !== 'uncovered') rows.push({ tb: tb, c: c, st: st });
        });
    });
    rows.sort(function (a, b) { return (a.st === 'same') - (b.st === 'same') || (a.tb.name + a.c.name < b.tb.name + b.c.name ? -1 : 1); });
    rows.slice(0, ROW_CAP).forEach(function (r) {
        var key = 'column/' + r.tb.name + '.' + r.c.name;
        var b = el('button', { type: 'button', class: 'c', title: key }, r.tb.name + '.' + r.c.name);
        b.addEventListener('click', function () { avPick('data', key); });
        add(g, b, el('span', { class: 'c' }, r.c.type + (r.c.nullable ? ' · null' : '')),
            el('span', { class: 'c' }, r.c.actual ? r.c.actual.type + (r.c.actual.nullable ? ' · null' : '') : '–'),
            el('span', { class: 'c m' }, t('unverifiable')),
            add(el('span', { class: 'c s' }), stChip(t(DRIFT_LABEL[r.st]), DRIFT_CLASS[r.st])));
    });
    if (!rows.length) {
        add(g, el('span', { class: 'c' }, '–'), el('span', { class: 'c' }, t('present')), add(el('span', { class: 'c' }), dNoData(t('driftNone'))), el('span', { class: 'c m' }, t('unverifiable')),
            add(el('span', { class: 'c s' }), stChip(t('unverifiable'), 'dash')));
    }
    grid.appendChild(g);
    wrap.appendChild(grid);
    if (rows.length > ROW_CAP) wrap.appendChild(el('span', { class: 'db-foot' }, t('moreRows')(num(rows.length - ROW_CAP))));
    wrap.appendChild(el('span', { class: 'db-foot' }, t('driftFoot')));
    bodyEl.appendChild(wrap);
}

function dMigLens(p, bodyEl) {
    var byFile = Object.create(null);
    p.tables.forEach(function (tb) {
        if (dBadgeOf(tb.witness) !== 'M') return;
        var f = byFile[tb.witness.file] = byFile[tb.witness.file] || { tables: [], cols: 0, fks: 0 };
        f.tables.push(tb.name);
        f.cols += tb.columns.length;
    });
    p.foreignKeys.forEach(function (k) { if (byFile[k.witness.file]) byFile[k.witness.file].fks += 1; });
    var wrap = el('div', { class: 'db-migs' });
    Object.keys(byFile).sort(function (a, b) { return base(a) < base(b) ? -1 : 1; }).forEach(function (file) {
        var f = byFile[file];
        var m = /^(\d{4})_(\d{2})_(\d{2})/.exec(base(file));
        add(wrap, add(el('div', { class: 'db-mig' }), el('span', { class: 'dot' }), m ? el('div', { class: 'when' }, m[1] + '-' + m[2] + '-' + m[3]) : add(el('div', { class: 'when' }), dNoData(t('migNoDate'))),
            el('div', { class: 'file', title: file }, base(file)), el('div', { class: 'what' }, t('migWhat')(f.tables.join(', '), num(f.cols), f.fks)), dNoData(t('migApplied'))));
    });
    if (!wrap.firstChild) wrap.appendChild(add(el('div', { class: 'db-mig' }), el('span', { class: 'dot' }), dNoData(t('noDataUnknown'))));
    bodyEl.appendChild(wrap);
}

// ---- Detail rail ------------------------------------------------------------------

function dEvidence(ws, queries) {
    var sec = add(el('div', { class: 'db-sec tight' }), el('span', { class: 'cap' }, t('evidence')));
    ws.forEach(function (w, i) {
        var b = dBadgeOf(w, queries && queries[i]);
        var link = dCodeLink(w.file, w.line);
        var loc = link.go ? el('button', { type: 'button', class: 'loc', title: t('openCode') }, link.label) : el('span', { class: 'loc', title: t('notOnMap') }, link.label);
        if (link.go) loc.addEventListener('click', link.go);
        sec.appendChild(add(el('div', { class: 'db-ev' }), el('span', { class: 'db-src ' + b }, b),
            add(el('div'), loc, el('span', { class: 'tx' }, (w.rung ? (t('rungNames')[w.rung] || w.rung) + ' · ' : '') + '#' + String(w.hash).slice(0, 8)), add(el('span'), confirmChip(w.confirm)))));
    });
    return sec;
}
function dKv(ws, completeness, rule) {
    var kv = el('div', { class: 'db-kv mono' });
    var pin = model.pin || {};
    var checked = ws.length > 0 && ws.every(function (w) { return w.confirm === 'confirmed'; });
    add(kv, el('span', { class: 'k' }, t('indexed')), pin.date ? el('span', null, pin.date) : dNoData(t('indexedNo')),
        el('span', { class: 'k' }, t('checked')), el('span', { class: checked ? 'db-ok' : 'db-warn' }, checked ? t('checkedYes') : t('checkedNo')),
        el('span', { class: 'k' }, t('confidence')), el('span', null, t('completeNames')[completeness] || completeness),
        el('span', { class: 'k' }, t('rule')), el('span', null, rule || '–'));
    return kv;
}
function dLinks(links) {
    var sec = add(el('div', { class: 'db-sec tight' }), el('span', { class: 'cap' }, t('links') + ' (' + links.length + ')'));
    links.forEach(function (l) {
        var b = el('button', { type: 'button', class: 'frow link', title: l[1].go ? t('openCode') : t('notOnMap'), disabled: !l[1].go });
        add(b, el('span', { class: 'muted' }, l[0]), el('span', { class: 'mono' }, l[1].label), l[1].sub ? el('span', { class: 'mono muted' }, l[1].sub) : null);
        if (l[1].go) b.addEventListener('click', l[1].go);
        sec.appendChild(b);
    });
    return sec;
}

function dFindingDetail(f, d) {
    var head = add(el('div', { class: 'db-dhead' }), add(el('div'), el('span', { class: 'kick' }, String(f.subject).replace(/^(column|table):/, '') + ' · ' + f.id), el('span', { class: 'ttl' }, f.title || f.id)), dSev(f));
    add(d, head, el('p', { class: 'db-sum' }, String(f.message).split('\nfix (proposal')[0]), dEvidence(f.witnesses || []), dKv(f.witnesses || [], f.completeness, f.id + (f.tier ? ' · ' + f.tier : '')),
        add(el('div', { class: 'db-sec tight' }), el('span', { class: 'cap' }, t('why')), f.fix ? el('span', { class: 'db-why' }, f.fix) : dNoData(t('whyNo'))));
    var acts = el('div', { class: 'db-acts' });
    var verify = el('button', { type: 'button', class: 'pri', 'aria-expanded': String(dbState.act === 'verify') }, t('verifyNow'));
    verify.addEventListener('click', function () { dbState.act = dbState.act === 'verify' ? '' : 'verify'; renderAreaPage('data', current.item); });
    var first = (f.witnesses || [])[0];
    var link = first ? dCodeLink(first.file, first.line) : { go: null };
    var open = el('button', { type: 'button', disabled: !link.go, title: link.go ? t('openCode') : t('notOnMap') }, t('openSource'));
    if (link.go) open.addEventListener('click', link.go);
    var mark = el('button', { type: 'button', 'aria-expanded': String(dbState.act === 'intended') }, t('markIntended'));
    mark.addEventListener('click', function () { dbState.act = dbState.act === 'intended' ? '' : 'intended'; renderAreaPage('data', current.item); });
    d.appendChild(add(acts, verify, open, mark));
    if (dbState.act === 'verify') add(d, el('span', { class: 'db-note' }, t('verifyCmd')), el('pre', { class: 'db-cmd' }, 'agent-config code-graph confirm ' + f.subject));
    if (dbState.act === 'intended') add(d, el('span', { class: 'db-note' }, t('intendedCmd')), el('pre', { class: 'db-cmd' }, JSON.stringify({ virtual_relations: [{ rule: f.id, subject: f.subject, reason: '…' }] }, null, 2)));
    d.appendChild(el('span', { class: 'db-note' }, t('acNote')));
}

function dDetail(p, key, sel, right) {
    var d = el('div', { class: 'db-detail' });
    right.appendChild(d);
    if (sel.finding && (!key || key.indexOf('finding/') === 0)) { dFindingDetail(sel.finding, d); return; }
    var item = key ? itemByKey('data', key) : null;
    if (!item) { d.appendChild(el('span', { class: 'soft' }, t('pickTable'))); return; }
    var x = el('button', { type: 'button', class: 'deselect', 'aria-label': t('deselect'), title: t('deselect') }, '×');
    x.addEventListener('click', function () { avPick('data', ''); });
    var tb = item.kind === 'table' ? dTable(p, item.label) : item.kind === 'column' ? dTable(p, item.label.replace(/\.[^.]*$/, '')) : null;
    var col = item.kind === 'column' && tb ? tb.columns.filter(function (c) { return tb.name + '.' + c.name === item.label; })[0] : null;
    add(d, add(el('div', { class: 'db-dhead' }), add(el('div'), el('span', { class: 'kick' }, (tb ? tb.connection + ' · ' : '') + item.kind), el('span', { class: 'ttl mono' }, item.label)), x));
    if (item.kind === 'table' && tb) d.appendChild(el('p', { class: 'db-sum' }, t('tableSum')(num(tb.columns.length), num(tb.models.length), num(dPathsTo(tb).length))));
    if (col) {
        var st = dActualState(col);
        d.appendChild(el('p', { class: 'db-sum' }, col.type + (col.nullable ? ' · nullable' : '') + (col.key ? ' · ' + col.key.toUpperCase() : '') + '\n' +
            t('actualT') + ': ' + (col.actual ? col.actual.type + (col.actual.nullable ? ' · nullable' : '') : col.actual === null ? t('absentActual') : t('notCovered')) + '\n' +
            (col.code ? t('nRW')(col.code.reads.length, col.code.writes.length) : t('notUsed'))));
        if (st !== 'uncovered') d.appendChild(add(el('span'), stChip(t(DRIFT_LABEL[st]), DRIFT_CLASS[st])));
    }
    if (!tb && item.rows) d.appendChild(kvGrid(item.rows));
    var codeFrom = col ? 1 + (col.actual ? 1 : 0) : Infinity;
    add(d, dEvidence(item.witnesses, item.witnesses.map(function (w, i) { return i >= codeFrom; })), dKv(item.witnesses, p.completeness, ''));
    var links = item.links ? item.links() : [];
    if (links.length) d.appendChild(dLinks(links));
    var related = (p.findings || []).map(function (f2, i) { return [f2, i]; }).filter(function (fi) {
        if (!tb || !dFindingTables(p, fi[0])[tb.name]) return false;
        return !col || !/^column:/.test(fi[0].subject) || String(fi[0].subject).slice(-col.name.length - 1) === '.' + col.name;
    });
    if (related.length) {
        var sf = add(el('div', { class: 'db-sec tight' }), el('span', { class: 'cap' }, t('dbFindings') + ' (' + related.length + ')'));
        related.forEach(function (fi) {
            var b = el('button', { type: 'button', class: 'db-find' });
            add(b, el('span', { class: 'id' }, fi[0].id), el('span', { class: 'sh' }, fi[0].title || fi[0].message), dSev(fi[0]));
            b.addEventListener('click', function () { avPick('data', 'finding/' + fi[1]); });
            sf.appendChild(b);
        });
        d.appendChild(sf);
    }
}
