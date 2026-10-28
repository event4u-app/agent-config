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
        dbEdges: 'Edges', edgePhys: 'physical FK (L/M)', edgeOrm: 'ORM relation (C)', edgeRule: 'delete rule as an icon on the line', edgeNote: 'An ORM relation is never a FK. A missing FK is a hint, not an error.',
        dbFindings: 'Findings', dbNoFindings: 'No findings.',
        dbMeta: function (t2, r) { return t2 + ' tables · ' + r + ' relations'; }, dbSnap: function (f) { return 'snapshot ' + f; },
        lines: 'Lines', lAll: 'All', lFocus: 'Focus', lOff: 'Off', lAllT: 'every relation', lFocusT: 'only the edges of the picked table, the rest dimmed', lOffT: 'no lines',
        dbEmptyTab: 'ERD · no data yet', dbEmptyHead: function (r) { return 'No data yet: ' + r + '.'; }, dbEmptyWhat: 'Once a source exists this view shows: tables with columns and keys, FKs (solid), relations shown in code without an FK (dashed), keys of the same name (dotted), drift model ↔ migration and the migration timeline. Preview: the demo map.',
        dbRungs: [['T1', 'migrations, SQL in the repository'], ['T2', 'committed dump'], ['T3', 'agents/map/data/snapshot/<conn>.sql'], ['T4', 'agents/map/data/oracle/*.json (artisan model:show)']], dbNeverLive: 'Never a live database.',
        dbFoundAnyway: function (n) { return 'Found anyway · ' + n + ' findings'; }, dbEmptyFacts: function (f, n, fx) { return 'The manifest reports “empty” with ' + f + ' facts and ' + n + ' findings' + (fx ? ' – all from test fixtures' : ''); },
        cols: 'Columns', cAll: 'All', cKeys: 'Keys', cAllT: 'every column', cKeysT: 'only PK, FK, index and *_id',
        layout: 'Layout', yGrid: 'Grid', yDomain: 'By domain', yGridT: 'free arrangement', yDomainT: 'grouped by cluster of keys',
        fitB: 'Fit', resetPos: 'Reset arrangement', zoomL: function (z) { return 'Zoom ' + z + '×'; },
        erdHelp: function (k) { return 'Drag to pan, wheel to zoom; hold ' + k + ' and drag to move a table. − / + / Fit zoom too. Lines start on “Focus”: only the edges of the picked table, the rest stays calm. A large schema also starts with “Keys”.'; },
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
        actualT: 'actual', absentActual: 'absent in actual', notCovered: 'not in the saved schema file', notUsed: 'not named in code', pickTable: 'Pick a table or a finding.',
        icons: { fk: 'foreign key declared in the database', cascade: 'delete cascades', setnull: 'delete sets null', restrict: 'delete is restricted', soft: 'code only · no FK in the database', implied: 'same name, nothing states it (suggestion)', finding: 'a drift finding is attached' },
        iconsHead: 'Lines', iconOpen: function (what) { return 'Relation ' + what + ' — open details'; }, popKind: { fk: 'foreign key (database)', soft: 'soft relation (code only)', implied: 'implied by name (suggestion)', orm: 'ORM relation' },
        popRules: 'rules', popVia: 'known from', viaNames: { schema: 'schema', orm: 'ORM relation', query: 'query join', name: 'matching name' }, popSelect: 'Show in the detail rail', popClose: 'Close',
        dim3: '3D', dimLabel: '2D / 3D', help3d: function () { return 'Drag to turn the schema any way round, wheel to zoom; the arrow keys turn it too. Picking a table brings it to the front with all its columns; tables further back show their name and keys. A card\'s place in space carries no data: tables of one cluster of keys sit together.'; },
        linksHead: { fk: 'Foreign keys (database)', soft: 'Soft relations (code only · no FK in the database)', implied: 'Implied keys (suggestion)' }, missingFk: 'The database has no constraint for this relation.', linkTo: function (n) { return n + ' linked'; }
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
        dbEdges: 'Kanten', edgePhys: 'physischer FK (L/M)', edgeOrm: 'ORM-Beziehung (C)', edgeRule: 'Löschregel als Symbol auf der Linie', edgeNote: 'Eine ORM-Beziehung ist nie ein FK. Fehlt ein FK, ist das ein Hinweis, kein Fehler.',
        dbFindings: 'Befunde', dbNoFindings: 'Keine Befunde.',
        dbMeta: function (t2, r) { return t2 + ' Tabellen · ' + r + ' Beziehungen'; }, dbSnap: function (f) { return 'Snapshot ' + f; },
        lines: 'Linien', lAll: 'Alle', lFocus: 'Fokus', lOff: 'Aus', lAllT: 'alle Beziehungen', lFocusT: 'nur Kanten der gewählten Tabelle, Rest gedimmt', lOffT: 'keine Linien',
        dbEmptyTab: 'ERD · noch keine Daten', dbEmptyHead: function (r) { return 'Noch keine Daten: ' + r + '.'; }, dbEmptyWhat: 'Diese Ansicht zeigt, sobald eine Quelle da ist: Tabellen mit Spalten und Schlüsseln, FKs (durchgezogen), im Code belegte Beziehungen ohne FK (gestrichelt), gleichnamige Schlüssel (gepunktet), Drift Model ↔ Migration und die Migrations-Zeitleiste. Vorschau: die Demo-Map.',
        dbRungs: [['T1', 'Migrationen, SQL im Repo'], ['T2', 'committeter Dump'], ['T3', 'agents/map/data/snapshot/<conn>.sql'], ['T4', 'agents/map/data/oracle/*.json (artisan model:show)']], dbNeverLive: 'Nie eine Live-Datenbank.',
        dbFoundAnyway: function (n) { return 'Trotzdem gefunden · ' + n + ' Befunde'; }, dbEmptyFacts: function (f, n, fx) { return 'Manifest meldet „empty“ mit ' + f + ' Fakten und ' + n + ' Befunden' + (fx ? ' – alle aus Test-Fixtures' : ''); },
        cols: 'Spalten', cAll: 'Alle', cKeys: 'Schlüssel', cAllT: 'alle Spalten', cKeysT: 'nur PK, FK, Index und *_id',
        layout: 'Layout', yGrid: 'Raster', yDomain: 'Nach Domäne', yGridT: 'freie Anordnung', yDomainT: 'gruppiert nach Schlüssel-Cluster',
        fitB: 'Einpassen', resetPos: 'Anordnung zurücksetzen', zoomL: function (z) { return 'Zoom ' + z + '×'; },
        erdHelp: function (k) { return 'Ziehen verschiebt die Ansicht, das Mausrad zoomt; ' + k + ' halten und ziehen verschiebt eine Tabelle. − / + / Einpassen zoomen auch. Linien starten auf „Fokus“: nur die Kanten der gewählten Tabelle, der Rest bleibt ruhig. Große Schemas starten zusätzlich mit „Schlüssel“.'; },
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
        actualT: 'tatsächlich', absentActual: 'fehlt tatsächlich', notCovered: 'nicht in der gespeicherten Schema-Datei', notUsed: 'im Code nicht benannt', pickTable: 'Tabelle oder Befund wählen.',
        icons: { fk: 'Fremdschlüssel in der Datenbank deklariert', cascade: 'Löschen kaskadiert', setnull: 'Löschen setzt NULL', restrict: 'Löschen ist eingeschränkt', soft: 'nur im Code · FK fehlt in der DB', implied: 'gleicher Name, nichts belegt es (Vorschlag)', finding: 'ein Drift-Befund hängt daran' },
        iconsHead: 'Linien', iconOpen: function (what) { return 'Beziehung ' + what + ' — Details öffnen'; }, popKind: { fk: 'Fremdschlüssel (Datenbank)', soft: 'weiche Beziehung (nur im Code)', implied: 'per Name vermutet (Vorschlag)', orm: 'ORM-Beziehung' },
        popRules: 'Regeln', popVia: 'bekannt aus', viaNames: { schema: 'Schema', orm: 'ORM-Beziehung', query: 'Query-Join', name: 'gleicher Name' }, popSelect: 'In der Detail-Leiste zeigen', popClose: 'Schließen',
        dim3: '3D', dimLabel: '2D / 3D', help3d: function () { return 'Ziehen dreht das Schema in jede Richtung, das Mausrad zoomt; die Pfeiltasten drehen ebenfalls. Eine gewählte Tabelle kommt nach vorn, mit allen Spalten; Tabellen weiter hinten zeigen Name und Schlüssel. Die Lage im Raum trägt keine Daten: Tabellen eines Schlüssel-Clusters stehen beieinander.'; },
        linksHead: { fk: 'Fremdschlüssel (Datenbank)', soft: 'Weiche Beziehungen (nur im Code · FK fehlt in der DB)', implied: 'Vermutete Schlüssel (Vorschlag)' }, missingFk: 'Die Datenbank hat für diese Beziehung keinen Constraint.', linkTo: function (n) { return n + ' verknüpft'; }
    }
});

var DB_BIG = 12;
// Measured on the demo schema at 1440 px: fitting the whole schema gives 1.0 at 4 tables, 0.59–0.67 at 6–16,
// 0.47 at 20 and the 0.4 floor from 30 up — unreadable cards. Above this count the ERD opens on the picked
// table and its linked tables at a readable zoom instead; Fit still shows the whole schema.
var DB_FOCUS_OPEN = 16;
var DB_READABLE_Z = 0.9;
// Below this a card's column text is under 7 px at 11 px type: framing the picked table's links stops there.
var DB_MIN_READABLE_Z = 0.6;
var DB_CARD_W = 180;
var DB_GAP_X = 64;
var DB_GAP_Y = 80;
var dbState = { dim: '2d', rot: null, z3: 1, front: '', lines: null, cols: null, layout: 'grid', src: { C: true, M: true, L: true, Q: false }, focus: '', pos: Object.create(null), z: 1, panX: 0, panY: 0, fitted: false, act: '' };

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
/** One glyph per kind of line annotation, drawn inline so the CSP never has to allow an image. */
var DB_ICONS = {
    fk: ['M2.5 8a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0', 'M7.5 8H14', 'M12 8v3'],
    cascade: ['M4 3.5l4 4l4 -4', 'M4 8.5l4 4l4 -4'],
    setnull: ['M3 8a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M4.5 11.5l7 -7'],
    restrict: ['M3 8a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M5.5 8h5'],
    soft: ['M6.5 5H4.5a3 3 0 0 0 0 6h2', 'M9.5 5h2a3 3 0 0 1 0 6h-2', 'M7.2 8h1.6'],
    implied: ['M3 6.5c1.6 -1.6 3.4 -1.6 5 0s3.4 1.6 5 0', 'M3 10.5c1.6 -1.6 3.4 -1.6 5 0s3.4 1.6 5 0'],
    finding: ['M8 2.5l6 10.5H2z', 'M8 6.5v3', 'M8 11.2v.3']
};
function dIcon(kind) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    [['width', '14'], ['height', '14'], ['viewBox', '0 0 16 16'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.6'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true']].forEach(function (a) { svg.setAttribute(a[0], a[1]); });
    (DB_ICONS[kind] || []).forEach(function (d) { var pa = document.createElementNS(ns, 'path'); pa.setAttribute('d', d); svg.appendChild(pa); });
    return svg;
}
/** The icon a delete rule draws on its foreign key. */
function dRuleIcon(onDelete) {
    var r = String(onDelete || '').toLowerCase();
    return /cascade/.test(r) ? 'cascade' : /set\s*null/.test(r) ? 'setnull' : /restrict|no\s*action/.test(r) ? 'restrict' : 'fk';
}
/** The picked column and the links it takes part in, when the pick is a column with links. */
function dLinkSel(p, key) {
    if (key.indexOf('column/') !== 0) return null;
    var full = key.slice(7);
    var tn = full.replace(/\.[^.]*$/, '');
    var tb = dTable(p, tn);
    var col = tb ? tb.columns.filter(function (c) { return tn + '.' + c.name === full; })[0] : null;
    if (!col || !(col.links || []).length) return null;
    var tables = Object.create(null);
    var cols = Object.create(null);
    tables[tn] = true;
    col.links.forEach(function (l) { tables[l.to.table] = true; cols[l.to.table + '.' + l.to.column] = l.kind; });
    return { table: tn, column: col.name, links: col.links, tables: tables, cols: cols };
}

function dSev(f) { return stChip(t('sevNames')[f.severity] || f.severity, SEV_CLASS[f.severity] === 'bad' ? 'red' : SEV_CLASS[f.severity]); }

/** The handover's real state of an empty data lane: the reason, what the view will show, the four rungs, and what was found anyway. */
function dbEmptyPage(p, main) {
    var card = el('div', { class: 'empty-page dbempty', id: 'nodata-data' });
    add(card, add(el('span', { class: 'ep-chips' }), stChip('empty', 'dash'), stChip('completeness: ' + p.completeness, 'dash')),
        el('span', { class: 'ep-head' }, t('dbEmptyHead')(p.empty)), el('span', { class: 'ep-what' }, t('dbEmptyWhat')));
    var rungs = el('div', { class: 'ep-rungs' });
    t('dbRungs').forEach(function (r) { rungs.appendChild(add(el('div'), el('b', { class: 'mono' }, r[0]), el('br'), el('span', null, r[1]))); });
    add(card, rungs, el('span', { class: 'ep-note' }, t('dbNeverLive')));
    main.appendChild(card);
    var fl = p.findings || [];
    if (!fl.length) return;
    var fx = fl.every(function (f) { return String(f.subject).indexOf('tests/fixtures/') === 0; });
    main.appendChild(add(el('div', { class: 'ep-found' }), el('span', { class: 'ep-foundh' }, t('dbFoundAnyway')(num(fl.length))), el('span', { class: 'ep-facts' }, t('dbEmptyFacts')(num(payloadWitnesses(p, []).length), num(fl.length), fx))));
    var list = el('div', { class: 'ep-list' });
    fl.forEach(function (f) {
        var sub = String(f.subject);
        var cut = sub.indexOf('#');
        var row = el('div', { class: 'ep-row' });
        add(row, el('span', { class: 'mono ep-id' }, f.id), el('span', { class: 'mono ep-model' }, cut < 0 ? sub : sub.slice(cut + 1)), el('span', { class: 'mono ep-file', title: cut < 0 ? '' : sub.slice(0, cut) }, cut < 0 ? ((f.witnesses || [])[0] || {}).file || '–' : sub.slice(0, cut)));
        list.appendChild(row);
    });
    main.appendChild(list);
}

AREA_MODULES.data = {
    tabs: [['erd', 'dbErd'], ['drift', 'dbDrift'], ['mig', 'dbMig']],
    railTitles: ['dbSchema', 'dbDetail'],
    emptyTab: 'dbEmptyTab',
    emptyPage: dbEmptyPage,
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
        add(el('div', { class: 'db-edge' }), add(el('span', { class: 'db-badge cascade', 'aria-hidden': 'true' }), dIcon('cascade')), document.createTextNode(t('edgeRule'))),
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
    var lines = dbState.lines || 'focus';
    var cols = dbState.cols || (big ? 'keys' : 'all');
    var src = dbState.src;
    var rerender = function () { renderAreaPage('data', current.item); };
    var erd = el('div', { class: 'db-erd' });
    var ctl = el('div', { class: 'db-ctls' });
    // The handover's 2D / 3D is one choice of two: a radiogroup.
    var dim = el('div', { class: 'seg dimseg', role: 'radiogroup', 'aria-label': t('dimLabel') });
    [['2d', t('d2')], ['3d', t('dim3')]].forEach(function (o) {
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(dbState.dim === o[0]), 'data-dim': o[0] }, o[1]);
        b.addEventListener('click', function () { dbState.dim = o[0]; rerender(); });
        dim.appendChild(b);
    });
    if (dbState.dim === '3d') {
        add(ctl, dSeg(t('lines'), [['all', t('lAll'), t('lAllT')], ['focus', t('lFocus'), t('lFocusT')], ['off', t('lOff'), t('lOffT')]], lines, function (v) { dbState.lines = v; rerender(); }));
        erd.appendChild(ctl);
        bodyEl.appendChild(erd);
        dErd3d(p, sel, erd, lines, dim);
        return;
    }
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

    var link = dLinkSel(p, current.item);
    var cards = Object.create(null);
    p.tables.forEach(function (tb) {
        var card = el('div', { class: 'db-table', role: 'button', tabindex: '0', 'data-table': tb.name, 'aria-label': tb.name });
        if (sel.hot[tb.name]) card.classList.add('hot');
        else if (sel.focus === tb.name) card.classList.add('focus');
        if (link ? !link.tables[tb.name] : lines === 'focus' && !near[tb.name]) card.classList.add('faded');
        if (link && link.tables[tb.name] && link.table !== tb.name) card.classList.add('linked');
        var covered = tb.columns.some(function (c) { return c.actual !== undefined; });
        var coded = tb.models.length > 0 || rels.some(function (r) { return r.from === tb.name || r.to === tb.name; });
        var head = el('div', { class: 'db-thead' });
        var bd = el('span', { class: 'bd' });
        [['C', coded], ['M', true], ['L', covered]].forEach(function (s2) { bd.appendChild(el('span', { class: 'db-src ' + s2[0] + (src[s2[0]] && s2[1] ? '' : ' off') }, s2[0])); });
        add(head, el('span', { class: 'tn', title: tb.name }, tb.name), bd);
        card.appendChild(head);
        var list = cols === 'keys' ? tb.columns.filter(function (c) { return c.key || /_id$/.test(c.name) || (link && link.cols[tb.name + '.' + c.name]); }) : tb.columns;
        list.forEach(function (c) {
            var row = el('button', { type: 'button', class: 'db-col', 'data-col': c.name, title: tb.name + '.' + c.name + ' · ' + c.type + (c.nullable ? ' · nullable' : '') });
            if (link && link.cols[tb.name + '.' + c.name]) row.classList.add('linked', 'lk-' + link.cols[tb.name + '.' + c.name]);
            if ((c.links || []).length) row.classList.add('haslinks');
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
        if (link || (lines === 'focus' && !near[g.id])) card.classList.add('faded');
        add(card, add(el('div', { class: 'db-thead' }), el('span', { class: 'tn', title: g.label }, g.label)), el('div', { class: 'db-tnote' }, t('noTable')));
        cards[g.id] = card;
    });

    // Layout: a grid by joins, or one block per cluster of keys drawn as a dashed group.
    var adj = Object.create(null);
    names.forEach(function (n) { adj[n] = []; });
    function join(a, b) { if (adj[a] && adj[b] && a !== b) { adj[a].push(b); adj[b].push(a); } }
    p.foreignKeys.forEach(function (k) { join(k.from.table, k.to.table); });
    rels.forEach(function (r) { join(r.from, r.to); });
    var phone = window.innerWidth <= 700;
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
    // The 2D / 3D switch sits on the stage beside the zoom, where the Code workbench keeps its own.
    add(stage, add(el('div', { class: 'db-overlay' }), dim, zoom), zl);
    var legend = add(el('div', { class: 'db-legend', 'aria-label': t('iconsHead') }), el('span', { class: 'cap' }, t('iconsHead')));
    ['fk', 'cascade', 'setnull', 'restrict', 'soft', 'implied', 'finding'].forEach(function (k) {
        legend.appendChild(add(el('span', { class: 'db-leg', 'data-icon': k }), add(el('span', { class: 'db-badge ' + k + (k === 'finding' ? ' has-finding' : ''), 'aria-hidden': 'true' }), dIcon(k)), el('span', null, t('icons')[k])));
    });
    erd.appendChild(legend);
    erd.appendChild(el('div', { class: 'db-help' }, t('erdHelp')(dModKeyName())));

    stage.db = { world: world, svg: svg, labels: labels, cards: cards, zl: zl, p: p, rels: rels, fkPair: fkPair, lines: lines, src: src, sel: sel, link: link, near: near };
    dBindKeys();
    dBindModifier();
    dClosePopup();
    dEdges(stage);
    dInteract(stage);
    dApply(stage);
    // Framed once, when the page opens: a large schema on the picked table and what it links to.
    // A later pick never moves or zooms the view — only the reader's own zoom, pan or drag does.
    if (!dbState.fitted) {
        dbState.fitted = true;
        requestAnimationFrame(function () { if (stage.isConnected) { if (p.tables.length > DB_FOCUS_OPEN) dFitFocus(stage); else dFit(stage, true); } });
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

/**
 * A line annotation: one icon badge on the line instead of a text label. It is a
 * button; it opens a popup with everything the label would have said and more.
 * `pts` is the drawn connector — the part between the two card borders — as a
 * polyline in its layer's coordinates; the badge sits at its middle.
 */
function dBadge(stage, pts, icon, info) {
    var b = el('button', { type: 'button', class: 'db-badge ' + icon + (info.finding ? ' has-finding' : ''), 'data-icon': icon, 'aria-label': t('iconOpen')(info.title), title: t('icons')[icon] });
    b.appendChild(dIcon(icon));
    b._pts = pts;
    b.style.left = pts[0][0].toFixed(1) + 'px';
    b.style.top = pts[0][1].toFixed(1) + 'px';
    b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    b.addEventListener('click', function (ev) { ev.stopPropagation(); dPopup(stage, b, info); });
    stage.db.labels.appendChild(b);
    return b;
}

/** The point at share `f` of a polyline's length, and that length. */
function dAlong(pts, f) {
    var cum = [0];
    for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    var total = cum[cum.length - 1];
    var d = Math.max(0, Math.min(1, f)) * total;
    var k = 1;
    while (k < pts.length - 1 && cum[k] < d) k++;
    var seg = cum[k] - cum[k - 1] || 1;
    var u = (d - cum[k - 1]) / seg;
    return { x: pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, y: pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u, len: total };
}
/** Badges closer than this, in their layer's units, would cover each other. */
var DB_BADGE_GAP = 24;
/**
 * Every badge at the middle of its drawn connector, in the layer the line lives in,
 * so pan, zoom, a page scroll or a resize move it with the line and never along it.
 * A badge whose middle would cover one placed before it moves once along its own
 * line, by a fixed step — shortened on a short connector so it stays clear of the
 * cards at the line's ends, and left out where the connector has no room at all. Run only when the lines themselves are drawn again. A connector
 * shorter than `minLen` has no room for a badge between its cards and carries none.
 */
function dPlaceBadges(stage, minLen) {
    var taken = [];
    var clash = function (q) { return taken.some(function (o) { return Math.abs(o.x - q.x) < DB_BADGE_GAP && Math.abs(o.y - q.y) < DB_BADGE_GAP; }); };
    Array.prototype.forEach.call(stage.db.labels.querySelectorAll('.db-badge'), function (b) {
        if (!b._pts) return;
        var pos = dAlong(b._pts, 0.5);
        b.hidden = pos.len < (minLen || 0);
        if (b.hidden) return;
        if (clash(pos) && pos.len) {
            var step = Math.min(DB_BADGE_GAP + 2, pos.len / 2 - 16);
            if (step >= 8) pos = dAlong(b._pts, 0.5 + step / pos.len);
        }
        taken.push(pos);
        b.style.left = pos.x.toFixed(1) + 'px';
        b.style.top = pos.y.toFixed(1) + 'px';
    });
}
/** 2D: badges live in the panned and zoomed world, so they only keep their on-screen size here. */
function dBadgeScale(stage) {
    var tr = 'translate(-50%, -50%) scale(' + (1 / dbState.z).toFixed(3) + ')';
    Array.prototype.forEach.call(stage.db.labels.querySelectorAll('.db-badge'), function (b) { b.style.transform = tr; });
}

function dClosePopup() {
    var old = document.getElementById('db-pop');
    if (old) old.remove();
}
/** The popup a badge opens: both ends, the kind, the rules, where it was read, the finding and its fix. */
function dPopup(stage, badge, info) {
    var open = document.getElementById('db-pop');
    var same = open && open.getAttribute('data-for') === info.title;
    dClosePopup();
    if (same) return;
    var pop = el('div', { class: 'db-pop', id: 'db-pop', role: 'dialog', 'aria-label': info.title, 'data-for': info.title });
    var head = add(el('div', { class: 'db-pop-h' }), add(el('span', { class: 'db-badge ' + info.icon, 'aria-hidden': 'true' }), dIcon(info.icon)), el('b', { class: 'mono' }, info.title));
    var x = el('button', { type: 'button', class: 'deselect', 'aria-label': t('popClose'), title: t('popClose') }, '×');
    x.addEventListener('click', dClosePopup);
    head.appendChild(x);
    pop.appendChild(head);
    var kv = el('div', { class: 'db-kv mono' });
    add(kv, el('span', { class: 'k' }, t('dKind')), el('span', null, t('popKind')[info.kind] || info.kind));
    if (info.via && info.via.length) add(kv, el('span', { class: 'k' }, t('popVia')), el('span', null, info.via.map(function (v) { return t('viaNames')[v] || v; }).join(', ')));
    if (info.rules) add(kv, el('span', { class: 'k' }, t('popRules')), el('span', null, info.rules));
    pop.appendChild(kv);
    if (info.kind === 'soft') pop.appendChild(el('p', { class: 'db-pop-miss' }, t('missingFk')));
    if (info.witnesses.length) pop.appendChild(dEvidence(info.witnesses));
    var f = info.finding;
    if (f) {
        var fb = el('button', { type: 'button', class: 'db-find' });
        add(fb, el('span', { class: 'id' }, f.f.id), el('span', { class: 'sh' }, f.f.title || f.f.message), dSev(f.f));
        fb.addEventListener('click', function () { dClosePopup(); avPick('data', 'finding/' + f.i); });
        pop.appendChild(fb);
        if (f.f.fix) pop.appendChild(el('pre', { class: 'db-cmd' }, f.f.fix));
    }
    if (info.pick) {
        var pb = el('button', { type: 'button', class: 'db-pop-pick' }, t('popSelect'));
        pb.addEventListener('click', function () { dClosePopup(); avPick('data', info.pick); });
        pop.appendChild(pb);
    }
    pop.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    stage.appendChild(pop);
    var sr = stage.getBoundingClientRect();
    var br = badge.getBoundingClientRect();
    var left = Math.min(Math.max(8, br.right - sr.left + 6), Math.max(8, stage.clientWidth - pop.offsetWidth - 8));
    var top = Math.min(Math.max(8, br.top - sr.top - 8), Math.max(8, stage.clientHeight - pop.offsetHeight - 8));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    var focusable = pop.querySelector('button');
    if (focusable) focusable.focus();
}
var dbKeysBound = false;
function dBindKeys() {
    if (dbKeysBound) return;
    dbKeysBound = true;
    document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape' || current.route !== 'data') return;
        if (document.getElementById('db-pop')) { dClosePopup(); return; }
        if (current.item.indexOf('column/') === 0) avPick('data', '');
    });
    document.addEventListener('pointerdown', function (ev) { if (!ev.target.closest('#db-pop, .db-badge')) dClosePopup(); });
}

function dFindingFor(p, ids, rule) {
    var list = p.findings || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === rule && ids.indexOf(String(list[i].subject).replace(/^column:/, '')) >= 0) return { f: list[i], i: i };
    return null;
}

/** The edges as the cards stand now, each badge at the middle of its line; drawn again after every drag. */
function dEdges(stage) {
    dEdgesDraw(stage);
    dPlaceBadges(stage);
    dBadgeScale(stage);
}
function dEdgesDraw(stage) {
    var e = stage.db;
    var svgNS = 'http://www.w3.org/2000/svg';
    while (e.svg.firstChild) e.svg.removeChild(e.svg.firstChild);
    clear(e.labels);
    e.badges = [];
    var maxX = 0;
    var maxY = 0;
    Object.keys(e.cards).forEach(function (n) { var r = dRect(e.cards[n]); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); });
    Array.prototype.forEach.call(e.world.querySelectorAll('.db-group'), function (g) { maxX = Math.max(maxX, g.offsetLeft + g.offsetWidth); maxY = Math.max(maxY, g.offsetTop + g.offsetHeight); });
    e.world.style.width = (maxX + 24) + 'px';
    e.world.style.height = (maxY + 24) + 'px';
    e.svg.setAttribute('width', String(maxX + 24));
    e.svg.setAttribute('height', String(maxY + 24));
    function title(el2, text) { var tt = document.createElementNS(svgNS, 'title'); tt.textContent = text; el2.appendChild(tt); }
    if (e.link) { dLinkLines(stage); return; }
    if (e.lines === 'off') return;
    var phys = e.src.L || e.src.M;
    function edge(a, b, cls, off, info, selected) {
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
        title(l, info ? info.title : '');
        e.svg.appendChild(l);
        if (!info) return;
        dBadge(stage, [[p1[0] + ox, p1[1] + oy], [p2[0] + ox, p2[1] + oy]], info.icon, info);
    }
    var hot = e.sel.hot;
    if (phys) {
        e.p.foreignKeys.forEach(function (k) {
            var cascade = /cascade/i.test(k.onDelete || '');
            var acts = [];
            if (k.onDelete) acts.push('ON DELETE ' + k.onDelete.toUpperCase());
            if (k.onUpdate) acts.push('ON UPDATE ' + k.onUpdate.toUpperCase());
            var name = k.from.table + '.' + k.from.column + ' → ' + k.to.table + '.' + k.to.column;
            edge(k.from.table, k.to.table, cascade ? 'cascade' : '', 0,
                { title: name, icon: dRuleIcon(k.onDelete), kind: 'fk', via: ['schema'], rules: acts.join(' · '), witnesses: [k.witness], pick: 'fk/' + name }, hot[k.from.table] && hot[k.to.table]);
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
            var same = e.rels.filter(function (x) { return pk(x) === key; });
            var name = r.from.replace(/^model:/, '') + ' ↔ ' + r.to.replace(/^model:/, '');
            var keyed = same.filter(function (x) { return x.r.key; }).map(function (x) { return [x.from + '.' + x.r.key, x.to + '.' + x.r.key]; });
            var finding = null;
            keyed.forEach(function (k2) { finding = finding || dFindingFor(e.p, k2, 'DR-1'); });
            var info = noFk ? { title: name, icon: 'soft', kind: 'soft', via: ['orm'], rules: same.map(function (x) { return x.r.from + ' → ' + x.r.to + ' · ' + x.r.kind; }).join('; '), witnesses: same.map(function (x) { return x.r.witness; }), finding: finding, pick: 'rel/' + r.r.kind + '/' + r.r.from + ' → ' + r.r.to } : null;
            edge(r.from, r.to, 'orm', phys && !noFk ? 7 : 0, info, (hot[r.from] || /^model:/.test(r.from)) && (hot[r.to] || /^model:/.test(r.to)));
        });
    }
}

/** With a key column picked: one line from it to every column it links to, styled by kind, each with its badge. */
function dLinkLines(stage) {
    var e = stage.db;
    var svgNS = 'http://www.w3.org/2000/svg';
    var link = e.link;
    function anchor(table, column, towards) {
        var card = e.cards[table];
        if (!card) return null;
        var r = dRect(card);
        var row = card.querySelector('.db-col[data-col="' + column.replace(/"/g, '') + '"]');
        var y = row ? r.y + row.offsetTop + row.offsetHeight / 2 : r.y + r.h / 2;
        var right = towards > r.x + r.w / 2;
        return { x: right ? r.x + r.w : r.x, y: y, dir: right ? 1 : -1 };
    }
    var self = e.cards[link.table];
    if (!self) return;
    var sr = dRect(self);
    link.links.forEach(function (l) {
        var other = e.cards[l.to.table];
        if (!other) return;
        var or = dRect(other);
        var a = anchor(link.table, link.column, or.x + or.w / 2);
        var b = anchor(l.to.table, l.to.column, sr.x + sr.w / 2);
        if (!a || !b) return;
        if (l.to.table === link.table) { b.x = a.x; b.dir = a.dir; }
        var bend = Math.max(36, Math.abs(b.x - a.x) * 0.35);
        var c1 = [a.x + a.dir * bend, a.y];
        var c2 = [b.x + b.dir * bend, b.y];
        var path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1));
        var cascade = l.kind === 'fk' && /cascade/i.test(l.onDelete || '');
        path.setAttribute('class', 'db-link ' + l.kind + (cascade ? ' cascade' : ''));
        path.setAttribute('data-kind', l.kind);
        var name = (l.direction === 'out' ? link.table + '.' + link.column + ' → ' + l.to.table + '.' + l.to.column : l.to.table + '.' + l.to.column + ' → ' + link.table + '.' + link.column);
        var tt = document.createElementNS(svgNS, 'title');
        tt.textContent = name;
        path.appendChild(tt);
        e.svg.appendChild(path);
        // The curve as drawn, sampled, so its badge sits on the curve and not on the chord.
        var curve = [];
        for (var i = 0; i <= 24; i++) {
            var u = i / 24;
            var v = 1 - u;
            curve.push([v * v * v * a.x + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * b.x, v * v * v * a.y + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * b.y]);
        }
        var acts = [];
        if (l.onDelete) acts.push('ON DELETE ' + l.onDelete.toUpperCase());
        if (l.onUpdate) acts.push('ON UPDATE ' + l.onUpdate.toUpperCase());
        var f = l.finding !== undefined && e.p.findings[l.finding] ? { f: e.p.findings[l.finding], i: l.finding } : null;
        dBadge(stage, curve, l.kind === 'fk' ? dRuleIcon(l.onDelete) : l.kind, { title: name, icon: l.kind === 'fk' ? dRuleIcon(l.onDelete) : l.kind, kind: l.kind, via: l.via, rules: acts.join(' · '), witnesses: l.witnesses, finding: f, pick: 'column/' + l.to.table + '.' + l.to.column });
    });
}

function dApply(stage) {
    stage.db.world.style.transform = 'translate(' + dbState.panX + 'px, ' + dbState.panY + 'px) scale(' + dbState.z + ')';
    stage.db.zl.textContent = t('zoomL')(dbState.z.toFixed(1).replace('.', lang === 'de' ? ',' : '.'));
    window.__mapErd = { z: dbState.z, tables: Object.keys(stage.db.cards), focus: stage.db.sel.focus, src: dbState.src, lines: stage.db.lines };
    dBadgeScale(stage);
}
/** Zoom by `f` about a stage point (default: the stage's centre), which stays where it is. */
function dZoom(stage, f, cx, cy) {
    var nz = Math.max(0.4, Math.min(3, dbState.z * f));
    if (cx === undefined) { cx = stage.clientWidth / 2; cy = stage.clientHeight / 2; }
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

/**
 * Centre the picked table and its linked tables at a readable zoom. When they do not all fit at that zoom, the
 * picked table is centred instead, its lines leading out to the rest, and it stays fully in view (top-left
 * first, if it is taller than the stage).
 */
function dFitFocus(stage) {
    var db = stage.db;
    var focus = db.cards[db.sel.focus];
    if (!focus) { dFit(stage, true); return; }
    // The picked table and every table its drawn lines reach: the picked key's links, or the focused table's keys.
    var around = db.link ? db.link.tables : db.near;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    Object.keys(around).concat([db.sel.focus]).forEach(function (n) {
        if (!db.cards[n]) return;
        var r = dRect(db.cards[n]);
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    });
    var top = 56;
    var m = 24;
    var vw = stage.clientWidth;
    var vh = stage.clientHeight - top - 30;
    // All of them at the largest zoom that holds them while it stays readable; when they lie too far apart for
    // that, the picked table at a readable zoom, its lines leading out with their badges kept on the stage.
    var fitZ = Math.min(1.2, (vw - 2 * m) / (x1 - x0), (vh - 2 * m) / (y1 - y0));
    var f = dRect(focus);
    var z = fitZ >= DB_MIN_READABLE_Z ? fitZ : DB_READABLE_Z;
    if (fitZ < DB_MIN_READABLE_Z) { x0 = f.x; x1 = f.x + f.w; y0 = f.y; y1 = f.y + f.h; }
    dbState.z = z;
    dbState.panX = vw / 2 - (x0 + x1) / 2 * z;
    dbState.panY = top + vh / 2 - (y0 + y1) / 2 * z;
    var over = dbState.panX + (f.x + f.w) * z - (vw - m);
    if (over > 0) dbState.panX -= over;
    var under = m - (dbState.panX + f.x * z);
    if (under > 0) dbState.panX += under;
    over = dbState.panY + (f.y + f.h) * z - (top + vh - m);
    if (over > 0) dbState.panY -= over;
    under = top + m - (dbState.panY + f.y * z);
    if (under > 0) dbState.panY += under;
    if (fitZ < DB_MIN_READABLE_Z) dKeepABadge(db, f, z, m, top, vw, vh);
    dApply(stage);
}
/**
 * The picked table alone is framed, so its lines run out of view and a badge at a line's middle can sit at the
 * stage's very edge — a few pixels of header or font metrics put it outside. When no badge is in the free part
 * of the stage (below the controls, inside the margin), the view moves the least it can to bring the nearest one
 * in, and only as far as the picked table stays wholly in view.
 */
function dKeepABadge(db, f, z, m, top, vw, vh) {
    var bs = Array.prototype.filter.call(db.labels.querySelectorAll('.db-badge'), function (b) { return !b.hidden && b._pts; })
        .map(function (b) { return [parseFloat(b.style.left), parseFloat(b.style.top)]; });
    var box = [m, top + m, vw - m, top + vh - m];
    var inBox = function (px, py, b) { var x = px + b[0] * z; var y = py + b[1] * z; return x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]; };
    if (!bs.length || bs.some(function (b) { return inBox(dbState.panX, dbState.panY, b); })) return;
    var clamp = function (v, lo, hi) { return lo > hi ? v : Math.max(lo, Math.min(hi, v)); };
    var best = null;
    bs.forEach(function (b) {
        // A table larger than the free part keeps the top-left framing it was given on that axis.
        var px = f.w * z > box[2] - box[0] ? dbState.panX : clamp(clamp(dbState.panX, box[0] - b[0] * z, box[2] - b[0] * z), box[0] - f.x * z, box[2] - (f.x + f.w) * z);
        var py = f.h * z > box[3] - box[1] ? dbState.panY : clamp(clamp(dbState.panY, box[1] - b[1] * z, box[3] - b[1] * z), box[1] - f.y * z, box[3] - (f.y + f.h) * z);
        var d = Math.abs(px - dbState.panX) + Math.abs(py - dbState.panY);
        if (inBox(px, py, b) && (!best || d < best[2])) best = [px, py, d];
    });
    if (best) { dbState.panX = best[0]; dbState.panY = best[1]; }
}

/** The key that unlocks moving and zooming, named as the platform names it. */
function dModKeyName() { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘' : lang === 'de' ? 'Strg' : 'Ctrl'; }
function dMod(ev) { return !!(ev.ctrlKey || ev.metaKey); }

/**
 * DEC-19 as corrected: the wheel zooms around the pointer and a drag pans, from the
 * background and from a table alike; only moving a table needs Ctrl / ⌘ held, so a
 * table never moves by accident. A click without a drag picks as before. Touch:
 * two fingers pinch and pan, one finger scrolls the page.
 */
function dInteract(stage) {
    var touches = Object.create(null);
    var pinch = null;
    stage.addEventListener('pointerdown', function (ev) {
        if (ev.target.closest('.db-overlay, .db-badge, #db-pop')) return;
        if (ev.pointerType === 'touch') {
            touches[ev.pointerId] = [ev.clientX, ev.clientY];
            var ids = Object.keys(touches);
            if (ids.length === 2) {
                var a = touches[ids[0]];
                var b = touches[ids[1]];
                pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, z: dbState.z, px: dbState.panX, py: dbState.panY };
            }
            return;
        }
        if (ev.button !== 0) return;
        ev.preventDefault();
        var card = dMod(ev) ? ev.target.closest('.db-table') : null;
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
    stage.addEventListener('pointermove', function (ev) {
        if (ev.pointerType !== 'touch') { stage.classList.toggle('mod', dMod(ev)); return; }
        if (!touches[ev.pointerId]) return;
        touches[ev.pointerId] = [ev.clientX, ev.clientY];
        var ids = Object.keys(touches);
        if (!pinch || ids.length !== 2) return;
        var a = touches[ids[0]];
        var b = touches[ids[1]];
        var d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        var r = stage.getBoundingClientRect();
        var nz = Math.max(0.4, Math.min(3, pinch.z * d / pinch.d));
        var cx = pinch.mx - r.left;
        var cy = pinch.my - r.top;
        dbState.panX = cx - (cx - pinch.px) * nz / pinch.z + ((a[0] + b[0]) / 2 - pinch.mx);
        dbState.panY = cy - (cy - pinch.py) * nz / pinch.z + ((a[1] + b[1]) / 2 - pinch.my);
        dbState.z = nz;
        dApply(stage);
    });
    var lift = function (ev) { delete touches[ev.pointerId]; if (Object.keys(touches).length < 2) pinch = null; };
    stage.addEventListener('pointerup', lift);
    stage.addEventListener('pointercancel', lift);
    stage.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch') stage.classList.remove('mod'); });
    // A click on the empty stage clears a picked key; on a card, a key or an icon it picks as before.
    stage.addEventListener('click', function (ev) {
        if (stage.moved || ev.target.closest('.db-table, .db-overlay, .db-badge, #db-pop')) return;
        if (current.item.indexOf('column/') === 0) avPick('data', '');
    });
    stage.addEventListener('wheel', function (ev) {
        if (ev.target.closest('#db-pop')) return;
        ev.preventDefault();
        var r = stage.getBoundingClientRect();
        dZoom(stage, Math.pow(1.0015, -ev.deltaY * (ev.deltaMode === 1 ? 16 : 1)), ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });
}
var dbModBound = false;
/** The stage shows grab and move cursors while the modifier is down, even before the pointer moves. */
function dBindModifier() {
    if (dbModBound) return;
    dbModBound = true;
    var set = function (on) { var st = document.getElementById('db-stage'); if (st) st.classList.toggle('mod', on); };
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Control' || ev.key === 'Meta') set(true); });
    document.addEventListener('keyup', function (ev) { if (ev.key === 'Control' || ev.key === 'Meta') set(false); });
    window.addEventListener('blur', function () { set(false); });
}

// ---- ERD in 3D -------------------------------------------------------------------

/** Cards drawn in 3D: the picked table and its neighbourhood; every other table is a dot further out. */
var D3_MAX = 24;
/** Readable names for the 3D chips; an overlapping pair is pushed apart until this gap remains. */
var D3_GAP = 6;
/** Between the front card and a chip: room for a badge (22 px, 31 px across its diagonal) at the connector's middle with air on both sides, at any angle. */
var D3_FRONT_GAP = 48;

/** Tables joined to a table: foreign keys, key links of every kind and ORM relations. */
function d3Adjacency(p) {
    var adj = Object.create(null);
    p.tables.forEach(function (tb) { adj[tb.name] = adj[tb.name] || Object.create(null); });
    var join = function (a, b) { if (adj[a] && adj[b] && a !== b) { adj[a][b] = true; adj[b][a] = true; } };
    p.foreignKeys.forEach(function (k) { join(k.from.table, k.to.table); });
    p.tables.forEach(function (tb) { tb.columns.forEach(function (c) { (c.links || []).forEach(function (l) { join(tb.name, l.to.table); }); }); });
    p.relations.forEach(function (r) { var a = dRelTable(p, r.from); var b = dRelTable(p, r.to); if (a && b) join(a.name, b.name); });
    return adj;
}
/** The picked table, then breadth-first by joins (best-joined first), up to the card budget. */
function d3Neighbourhood(p, adj, focus, first) {
    var out = [focus];
    var seen = Object.create(null);
    seen[focus] = true;
    var deg = function (n) { return Object.keys(adj[n] || {}).length; };
    (first || []).forEach(function (n) { if (!seen[n] && adj[n] && out.length < D3_MAX) { seen[n] = true; out.push(n); } });
    for (var i = 0; i < out.length && out.length < D3_MAX; i++) {
        Object.keys(adj[out[i]] || {}).sort(function (a, b) { return deg(b) - deg(a) || (a < b ? -1 : 1); }).forEach(function (n) {
            if (!seen[n] && out.length < D3_MAX) { seen[n] = true; out.push(n); }
        });
    }
    return out;
}
/** `n` points spread evenly over a sphere (golden-angle spiral), the same for the same `n`. */
function d3Sphere(n, radius) {
    var pts = [];
    for (var i = 0; i < n; i++) {
        var y = n > 1 ? 1 - 2 * (i + 0.5) / n : 0;
        var rad = Math.sqrt(Math.max(0, 1 - y * y));
        var th = i * 2.399963;
        pts.push([Math.cos(th) * rad * radius, y * radius, Math.sin(th) * rad * radius]);
    }
    return pts;
}
/*
 * The view's orientation is one rotation matrix, turned by small steps about the
 * screen's axes and re-orthonormalised — the Code orb's trackball — so dragging and
 * the arrow keys turn it without end on any axis, over the poles too.
 */
function d3RotY(a) { var c = Math.cos(a); var s2 = Math.sin(a); return [c, 0, s2, 0, 1, 0, -s2, 0, c]; }
function d3RotX(a) { var c = Math.cos(a); var s2 = Math.sin(a); return [1, 0, 0, 0, c, -s2, 0, s2, c]; }
function d3Mul(A, B) {
    var out = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) out.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]);
    return out;
}
function d3Ortho(m) {
    var a = [m[0], m[1], m[2]];
    var b = [m[3], m[4], m[5]];
    var la = Math.hypot(a[0], a[1], a[2]);
    a = [a[0] / la, a[1] / la, a[2] / la];
    var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    b = [b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]];
    var lb = Math.hypot(b[0], b[1], b[2]);
    b = [b[0] / lb, b[1] / lb, b[2] / lb];
    return a.concat(b, [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
}
/** The opening tilt: turned a little to the side and looked at slightly from above. */
function d3Start() { return d3Mul(d3RotX(-0.35), d3RotY(0.5)); }
/** Turn by `yaw` about the screen's vertical axis and `pitch` about its horizontal one. */
function d3Turn(yaw, pitch) { dbState.rot = d3Ortho(d3Mul(d3Mul(d3RotX(pitch), d3RotY(yaw)), d3View())); }
function d3View() { if (!dbState.rot) dbState.rot = d3Start(); return dbState.rot; }
function d3Rotate(v) {
    var m = d3View();
    return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/**
 * The ERD in space. The picked table stands in front with all its columns; its
 * neighbourhood (≤ D3_MAX tables) sits on a shell around it, the side facing the
 * viewer as named chips, the far side as small fogged dots; every other table is a
 * faint dot on an outer shell. Overlapping chips are pushed apart on screen. Lines
 * keep the 2D styles and their badges, placed on the stage. A drag and the arrow
 * keys turn it freely, the wheel and the buttons zoom; a click picks what is in front.
 */
function dErd3d(p, sel, erd, lines, dim) {
    var stage = el('div', { class: 'db-stage db-3d', id: 'db-stage', tabindex: '0', 'aria-label': t('dim3') });
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'db-edges');
    var labels = el('div', { class: 'db-3d-badges' });
    stage.appendChild(svg);
    stage.appendChild(labels);
    erd.appendChild(stage);
    var link = dLinkSel(p, current.item);
    var focus = link ? link.table : sel.focus;
    var adj = d3Adjacency(p);
    var hood = d3Neighbourhood(p, adj, focus, link ? Object.keys(link.tables) : Object.keys(adj[focus] || {}));
    var inHood = Object.create(null);
    hood.forEach(function (n) { inHood[n] = true; });
    var others = p.tables.map(function (tb) { return tb.name; }).filter(function (n) { return !inHood[n]; });
    var R = Math.max(240, 70 * Math.sqrt(hood.length));
    // Direct neighbours take the places that face the viewer when the view opens.
    var shell = d3Sphere(hood.length - 1, R).sort(function (a, b) { return d3Rotate(b)[2] - d3Rotate(a)[2]; });
    var place = Object.create(null);
    hood.slice(1).forEach(function (n, i) { place[n] = shell[i]; });
    var outer = d3Sphere(others.length, R * 1.7);
    others.forEach(function (n, i) { place[n] = outer[i]; });
    var cards = Object.create(null);
    hood.forEach(function (n) {
        var card = el('div', { class: 'db-table db-3card', role: 'button', tabindex: '0', 'data-table': n, 'aria-label': n });
        card.addEventListener('click', function () { if (!stage.moved) avPick('data', 'table/' + n); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === card) avPick('data', 'table/' + n); });
        stage.appendChild(card);
        cards[n] = card;
    });
    stage.db = { labels: labels, badges: [], p: p };
    // The front card: every column; the others: the name and how many keys they hold.
    (function fillAll() {
        hood.forEach(function (n) {
            var card = cards[n];
            var tb = dTable(p, n);
            clear(card);
            if (n !== focus) {
                card.classList.add('chip');
                var keys = tb.columns.filter(function (c) { return c.key || /_id$/.test(c.name); }).length;
                add(card, add(el('div', { class: 'db-thead' }), el('span', { class: 'tn', title: n }, n), el('span', { class: 'muted mono' }, String(keys))));
                return;
            }
            card.classList.add('front');
            add(card, add(el('div', { class: 'db-thead' }), el('span', { class: 'tn', title: n }, n)));
            tb.columns.forEach(function (c) {
                var row = el('button', { type: 'button', class: 'db-col', 'data-col': c.name, title: n + '.' + c.name + ' · ' + c.type });
                if (link && link.column === c.name) row.classList.add('on');
                var k = c.key ? c.key.toUpperCase() : '';
                add(row, el('span', { class: 'k ' + k }, k), el('span', { class: 'n' }, c.name), el('span', { class: 'y' }, c.type));
                row.addEventListener('click', function (ev) { ev.stopPropagation(); if (!stage.moved) avPick('data', 'column/' + n + '.' + c.name); });
                card.appendChild(row);
            });
        });
    })();
    function draw() {
        var w = stage.clientWidth;
        var h = stage.clientHeight;
        var D = R * 3.2;
        var fit = Math.min(w, h) * 0.44 / (R * D / (D - R)) * dbState.z3;
        var proj = Object.create(null);
        var project = function (v) { var q = d3Rotate(v); var s2 = D / (D - q[2]); return { x: w / 2 + q[0] * s2 * fit, y: h / 2 + q[1] * s2 * fit, z: q[2] / R, s: s2 }; };
        Object.keys(place).forEach(function (n) { proj[n] = project(place[n]); });
        proj[focus] = { x: w / 2, y: h / 2, z: 2, s: 1 };
        // Cards: the front one fixed in the middle, the near side as chips, the far side hidden behind dots.
        var rects = [];
        hood.forEach(function (n) {
            var q = proj[n];
            var card = cards[n];
            var front = n === focus;
            var facing = front || q.z > -0.2;
            card.hidden = !facing;
            q.facing = facing;
            if (!facing) return;
            var depth = front ? 1 : Math.max(0, Math.min(1, (q.z + 0.2) / 1.2));
            var k = front ? 1 : 0.72 + 0.28 * depth;
            card.style.transform = 'translate(-50%, -50%) scale(' + k.toFixed(3) + ')';
            card.style.opacity = String(front ? 1 : (0.55 + 0.45 * depth).toFixed(2));
            card.style.zIndex = String(front ? 400 : Math.round(100 + depth * 100));
            card.classList.toggle('hot', !!sel.hot[n]);
            card.classList.toggle('linked', !!(link && link.tables[n] && !front));
            rects.push({ n: n, x: q.x, y: q.y, w: card.offsetWidth * k, h: card.offsetHeight * k, fixed: front });
        });
        // Push overlapping cards apart on the screen, inside the stage; the front card does not move. A chip that
        // still overlaps a nearer card after that falls back to a dot — the view never stacks cards.
        var clampR = function (r) {
            r.x = Math.max(r.w / 2 + 4, Math.min(w - r.w / 2 - 4, r.x));
            r.y = Math.max(r.h / 2 + 52, Math.min(h - r.h / 2 - 4, r.y));
        };
        // Chips keep a badge's width plus a margin clear of the front card, so a line between them has room for its icon.
        var gapOf = function (a, b) { return a.fixed || b.fixed ? D3_FRONT_GAP : D3_GAP; };
        var overlap = function (a, b) { var g = gapOf(a, b); return [(a.w + b.w) / 2 + g - Math.abs(a.x - b.x), (a.h + b.h) / 2 + g - Math.abs(a.y - b.y)]; };
        rects.forEach(clampR);
        for (var it = 0; it < 80; it++) {
            var moved = false;
            for (var i = 0; i < rects.length; i++) {
                for (var j = i + 1; j < rects.length; j++) {
                    var a = rects[i];
                    var b = rects[j];
                    var o = overlap(a, b);
                    if (o[0] <= 0 || o[1] <= 0) continue;
                    moved = true;
                    var horiz = o[0] / (a.w + b.w) < o[1] / (a.h + b.h);
                    var dir = horiz ? (b.x >= a.x ? 1 : -1) : (b.y >= a.y ? 1 : -1);
                    var amt = (horiz ? o[0] : o[1]) + 0.5;
                    var sa = a.fixed ? 0 : b.fixed ? 1 : 0.5;
                    if (horiz) { a.x -= dir * amt * sa; b.x += dir * amt * (1 - sa); } else { a.y -= dir * amt * sa; b.y += dir * amt * (1 - sa); }
                    clampR(a);
                    clampR(b);
                }
            }
            if (!moved) break;
        }
        // A chip the stage edge has kept on the front card goes above or below it, whichever side it is nearer.
        var fr = rects.filter(function (q) { return q.fixed; })[0];
        if (fr) rects.forEach(function (q) {
            if (q.fixed) return;
            var o3 = overlap(q, fr);
            if (o3[0] <= 0 || o3[1] <= 0) return;
            var up = q.y <= fr.y;
            q.y = up ? fr.y - fr.h / 2 - D3_FRONT_GAP - q.h / 2 : fr.y + fr.h / 2 + D3_FRONT_GAP + q.h / 2;
            clampR(q);
            if (overlap(q, fr)[1] > 0) { q.y = up ? fr.y + fr.h / 2 + D3_FRONT_GAP + q.h / 2 : fr.y - fr.h / 2 - D3_FRONT_GAP - q.h / 2; clampR(q); }
        });
        // The front card first, then the tables its drawn lines reach, then the rest, nearest first: a card stays
        // only when it clears every card kept before it, so on a narrow stage the linked chips are the ones kept.
        var kept = [];
        var rank = function (q) { return q.fixed ? 9 : proj[q.n].z + ((link ? link.tables[q.n] : adj[focus] && adj[focus][q.n]) ? 4 : 0); };
        rects.slice().sort(function (a, b) { return rank(b) - rank(a); }).forEach(function (r) {
            var clear2 = kept.every(function (k2) { var o2 = overlap(r, k2); var g2 = r.fixed || k2.fixed ? 0.5 : D3_GAP; return o2[0] <= g2 || o2[1] <= g2; });
            if (!clear2 && !r.fixed) { cards[r.n].hidden = true; proj[r.n].facing = false; return; }
            kept.push(r);
        });
        rects = kept;
        rects.forEach(function (r) {
            proj[r.n].x = r.x;
            proj[r.n].y = r.y;
            cards[r.n].style.left = r.x.toFixed(1) + 'px';
            cards[r.n].style.top = r.y.toFixed(1) + 'px';
        });
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        clear(labels);
        svg.setAttribute('width', String(w));
        svg.setAttribute('height', String(h));
        // Dots: the far side of the neighbourhood and every table outside it, fogged by depth.
        // Far ones first, so a nearer dot is drawn — and hit — in front of a farther one. Each dot is a group: the
        // fogged disc as drawn, and a ring around it that a hand can hit.
        Object.keys(proj).filter(function (n) { return n !== focus && !(inHood[n] && proj[n].facing); })
            .sort(function (a, b) { return proj[a].z - proj[b].z; }).forEach(function (n) {
                var q = proj[n];
                var dot = document.createElementNS(svgNS, 'g');
                dot.setAttribute('class', 'db-3dot' + (inHood[n] ? ' near' : ''));
                dot.setAttribute('data-table', n);
                var hit = document.createElementNS(svgNS, 'circle');
                hit.setAttribute('class', 'hit');
                var disc = document.createElementNS(svgNS, 'circle');
                disc.setAttribute('class', 'disc');
                [hit, disc].forEach(function (c) { c.setAttribute('cx', q.x.toFixed(1)); c.setAttribute('cy', q.y.toFixed(1)); });
                var rad = Math.max(2, (inHood[n] ? 5 : 3) * q.s);
                disc.setAttribute('r', rad.toFixed(1));
                hit.setAttribute('r', Math.max(9, rad + 4).toFixed(1));
                disc.style.opacity = String((0.18 + 0.5 * Math.max(0, Math.min(1, (q.z + 1.7) / 3.4))).toFixed(2));
                var tt = document.createElementNS(svgNS, 'title');
                tt.textContent = n;
                add(dot, tt, hit, disc);
                dot.addEventListener('click', function () { if (!stage.moved) avPick('data', 'table/' + n); });
                svg.appendChild(dot);
            });
        function edgeLine(a, b, cls, kind, info) {
            var pa = proj[a];
            var pb = proj[b];
            if (!pa || !pb || a === b) return;
            // A line leaves a card at its edge, so neither the line nor its badge lies on the card.
            var edgeOf = function (n, q, toward) {
                var c = cards[n];
                if (!c || c.hidden) return [q.x, q.y];
                var r = c.getBoundingClientRect();
                var sr = stage.getBoundingClientRect();
                return dClip({ x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height }, toward.x, toward.y);
            };
            var ea = edgeOf(a, pa, pb);
            var eb = edgeOf(b, pb, pa);
            pa = { x: ea[0], y: ea[1], z: pa.z, facing: pa.facing };
            pb = { x: eb[0], y: eb[1], z: pb.z, facing: pb.facing };
            var l = document.createElementNS(svgNS, 'path');
            l.setAttribute('d', 'M' + pa.x.toFixed(1) + ' ' + pa.y.toFixed(1) + ' L' + pb.x.toFixed(1) + ' ' + pb.y.toFixed(1));
            l.setAttribute('class', 'db-link ' + cls);
            l.setAttribute('data-kind', kind);
            if (info) { var lt = document.createElementNS(svgNS, 'title'); lt.textContent = info.title; l.appendChild(lt); }
            l.style.opacity = String(pb.facing === false || pa.facing === false ? 0.45 : 1);
            svg.insertBefore(l, svg.firstChild);
            if (!info) return;
            // The badge sits at the middle of the projected connector, between the two card borders.
            dBadge(stage, [[pa.x, pa.y], [pb.x, pb.y]], info.icon, info);
        }
        var touches = function (a, b) { return lines === 'all' ? inHood[a] && inHood[b] : a === focus || b === focus; };
        if (link) {
            link.links.forEach(function (l2) {
                var icon = l2.kind === 'fk' ? dRuleIcon(l2.onDelete) : l2.kind;
                var name = l2.direction === 'out' ? link.table + '.' + link.column + ' → ' + l2.to.table + '.' + l2.to.column : l2.to.table + '.' + l2.to.column + ' → ' + link.table + '.' + link.column;
                var f = l2.finding !== undefined && p.findings[l2.finding] ? { f: p.findings[l2.finding], i: l2.finding } : null;
                edgeLine(link.table, l2.to.table, l2.kind + (l2.kind === 'fk' && /cascade/i.test(l2.onDelete || '') ? ' cascade' : ''), l2.kind,
                    { title: name, icon: icon, kind: l2.kind, via: l2.via, rules: l2.onDelete ? 'ON DELETE ' + l2.onDelete.toUpperCase() : '', witnesses: l2.witnesses, finding: f, pick: 'column/' + l2.to.table + '.' + l2.to.column });
            });
        } else if (lines !== 'off') {
            p.foreignKeys.forEach(function (k2) {
                if (!touches(k2.from.table, k2.to.table)) return;
                var name = k2.from.table + '.' + k2.from.column + ' → ' + k2.to.table + '.' + k2.to.column;
                edgeLine(k2.from.table, k2.to.table, 'fk' + (/cascade/i.test(k2.onDelete || '') ? ' cascade' : ''), 'fk',
                    { title: name, icon: dRuleIcon(k2.onDelete), kind: 'fk', via: ['schema'], rules: k2.onDelete ? 'ON DELETE ' + k2.onDelete.toUpperCase() : '', witnesses: [k2.witness], pick: 'fk/' + name });
            });
            p.tables.forEach(function (tb) {
                tb.columns.forEach(function (c) {
                    (c.links || []).forEach(function (l2) {
                        if (l2.kind === 'fk' || l2.direction !== 'out' || !touches(tb.name, l2.to.table)) return;
                        var name = tb.name + '.' + c.name + ' → ' + l2.to.table + '.' + l2.to.column;
                        var f = l2.finding !== undefined && p.findings[l2.finding] ? { f: p.findings[l2.finding], i: l2.finding } : null;
                        edgeLine(tb.name, l2.to.table, l2.kind, l2.kind, { title: name, icon: l2.kind, kind: l2.kind, via: l2.via, rules: '', witnesses: l2.witnesses, finding: f, pick: 'column/' + tb.name + '.' + c.name });
                    });
                });
            });
        }
        dPlaceBadges(stage, DB_BADGE_GAP + 10);
        window.__mapErd3d = { rot: d3View().slice(), z: dbState.z3, front: focus, hood: hood.slice(), proj: proj };
    }
    var zoom = el('div', { class: 'db-zoom' });
    function zb(text, aria, cls, fn) { var b = el('button', { type: 'button', class: cls || '', 'aria-label': aria, title: aria }, text); b.addEventListener('click', fn); return b; }
    add(zoom, zb('−', t('zoomOut'), '', function () { dbState.z3 = Math.max(0.4, dbState.z3 / 1.2); draw(); }), zb('+', t('zoomIn'), '', function () { dbState.z3 = Math.min(3, dbState.z3 * 1.2); draw(); }),
        zb(t('fitB'), t('fitB'), 'fit', function () { dbState.z3 = 1; draw(); }), zb('↺', t('resetPos'), 'reset', function () { dbState.rot = d3Start(); draw(); }));
    stage.appendChild(add(el('div', { class: 'db-overlay' }), dim, zoom));
    var legend = add(el('div', { class: 'db-legend', 'aria-label': t('iconsHead') }), el('span', { class: 'cap' }, t('iconsHead')));
    ['fk', 'cascade', 'setnull', 'restrict', 'soft', 'implied', 'finding'].forEach(function (k) {
        legend.appendChild(add(el('span', { class: 'db-leg', 'data-icon': k }), add(el('span', { class: 'db-badge ' + k + (k === 'finding' ? ' has-finding' : ''), 'aria-hidden': 'true' }), dIcon(k)), el('span', null, t('icons')[k])));
    });
    erd.appendChild(legend);
    erd.appendChild(el('div', { class: 'db-help' }, t('help3d')()));
    stage.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType === 'touch' || ev.button !== 0 || ev.target.closest('.db-overlay, .db-badge, #db-pop')) return;
        ev.preventDefault();
        // The default focus is suppressed with the text selection; the arrow keys still need the stage focused.
        stage.focus({ preventScroll: true });
        var sx = ev.clientX;
        var sy = ev.clientY;
        var lx = sx;
        var ly = sy;
        stage.moved = false;
        function move(m) {
            if (!stage.moved && Math.abs(m.clientX - sx) + Math.abs(m.clientY - sy) <= 3) return;
            stage.moved = true;
            stage.classList.add('grabbing');
            d3Turn((m.clientX - lx) * 0.01, (m.clientY - ly) * 0.01);
            lx = m.clientX;
            ly = m.clientY;
            draw();
        }
        function up() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            stage.classList.remove('grabbing');
            setTimeout(function () { stage.moved = false; }, 0);
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    });
    stage.addEventListener('wheel', function (ev) {
        if (ev.target.closest('#db-pop')) return;
        ev.preventDefault();
        dbState.z3 = Math.max(0.4, Math.min(3, dbState.z3 * Math.pow(1.0015, -ev.deltaY * (ev.deltaMode === 1 ? 16 : 1))));
        draw();
    }, { passive: false });
    stage.addEventListener('click', function (ev) {
        if (stage.moved || ev.target.closest('.db-table, .db-overlay, .db-badge, #db-pop, .db-3dot')) return;
        if (current.item.indexOf('column/') === 0) avPick('data', '');
    });
    stage.addEventListener('keydown', function (ev) {
        var step = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15] }[ev.key];
        if (!step || ev.target !== stage) return;
        ev.preventDefault();
        d3Turn(step[0], step[1]);
        draw();
    });
    dBindKeys();
    dClosePopup();
    draw();
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
    if (tb && tb.domains && tb.domains.length) d.appendChild(add(el('div', { class: 'chips' }), el('span', { class: tb.domains.length > 1 ? 'c-miss' : 'c-cyan' }, t('cDomain') + ' ' + tb.domains.join(', '))));
    if (col) {
        var st = dActualState(col);
        d.appendChild(el('p', { class: 'db-sum' }, col.type + (col.nullable ? ' · nullable' : '') + (col.key ? ' · ' + col.key.toUpperCase() : '') + '\n' +
            t('actualT') + ': ' + (col.actual ? col.actual.type + (col.actual.nullable ? ' · nullable' : '') : col.actual === null ? t('absentActual') : t('notCovered')) + '\n' +
            (col.code ? t('nRW')(col.code.reads.length, col.code.writes.length) : t('notUsed'))));
        if (st !== 'uncovered') d.appendChild(add(el('span'), stChip(t(DRIFT_LABEL[st]), DRIFT_CLASS[st])));
        ['fk', 'soft', 'implied'].forEach(function (kind) {
            var group = (col.links || []).filter(function (l) { return l.kind === kind; });
            if (!group.length) return;
            var sec = add(el('div', { class: 'db-sec tight db-links', 'data-kind': kind }), el('span', { class: 'cap' }, t('linksHead')[kind] + ' (' + group.length + ')'));
            group.forEach(function (l) {
                var icon = kind === 'fk' ? dRuleIcon(l.onDelete) : kind;
                var b = el('button', { type: 'button', class: 'db-find' });
                add(b, add(el('span', { class: 'db-badge ' + icon, 'aria-hidden': 'true' }), dIcon(icon)), el('span', { class: 'sh mono' }, (l.direction === 'out' ? '→ ' : '← ') + l.to.table + '.' + l.to.column),
                    el('span', { class: 'muted' }, l.via.map(function (v) { return t('viaNames')[v] || v; }).join(', ') + (l.onDelete ? ' · ON DELETE ' + l.onDelete.toUpperCase() : '')));
                b.addEventListener('click', function () { avPick('data', 'column/' + l.to.table + '.' + l.to.column); });
                sec.appendChild(b);
                if (kind === 'soft') sec.appendChild(el('span', { class: 'db-note' }, t('missingFk')));
                sec.appendChild(dEvidence(l.witnesses));
                var f = l.finding !== undefined ? p.findings[l.finding] : null;
                if (f) {
                    var fb = el('button', { type: 'button', class: 'db-find' });
                    add(fb, el('span', { class: 'id' }, f.id), el('span', { class: 'sh' }, f.title || f.message), dSev(f));
                    fb.addEventListener('click', function () { avPick('data', 'finding/' + l.finding); });
                    sec.appendChild(fb);
                    if (f.fix) sec.appendChild(el('pre', { class: 'db-cmd' }, f.fix));
                }
            });
            d.appendChild(sec);
        });
    }
    if (!tb && item.rows) d.appendChild(kvGrid(item.rows));
    var hist = historySection(col ? col.witness.file : tb ? tb.witness.file : null);
    if (hist) d.appendChild(hist);
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
