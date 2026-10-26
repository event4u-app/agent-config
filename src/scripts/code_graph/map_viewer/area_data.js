/*
 * Data: the ERD per cluster of tables joined by foreign keys, with the column
 * set as the code uses it, as the migrations intend it and as the actual schema
 * file holds it; the tables as cards; foreign keys beside ORM relations, which
 * are never foreign keys and are drawn dashed; and the drift between them, every
 * finding with all of its witnesses. A table links to its model files and to the
 * request paths that reach it, a column to the code that reads or writes it —
 * each opening the file in the Code area.
 */
extendStrings({
    en: {
        dErd: 'ERD', dTables: 'Tables', dRelations: 'Keys & relations', dColumns: function (n) { return n + ' columns'; }, dModels: function (n) { return n + ' model file(s)'; },
        dMeta: function (t2, k, r) { return t2 + ' tables · ' + k + ' foreign keys · ' + r + ' ORM relations'; }, dConn: 'connection', dEngine: 'engine',
        dFk: 'Foreign keys (physical)', dOrm: 'ORM relations (not a foreign key)', dFrom: 'From', dTo: 'To', dOnDelete: 'on delete', dOnUpdate: 'on update', dKind: 'Kind', dKey: 'Key',
        dType: 'type', dNull: 'nullable', dKeyT: 'key', yes: 'yes', no: 'no', dNoFk: 'No foreign keys were read.', dNoOrm: 'No ORM relations were read.',
        dCluster: 'Cluster', dLines: 'Lines', dLinesAll: 'All', dLinesFocus: 'Focus', dLinesOff: 'Off', dLinesAllT: 'every key and relation', dLinesFocusT: 'only the lines of the picked table, the rest dimmed', dLinesOffT: 'no lines',
        dCols: 'Columns', dColsAll: 'All', dColsKeys: 'Keys', dColsAllT: 'every column', dColsKeysT: 'only PK, FK, unique, index and *_id',
        dLayer: 'Schema as', ovCode: 'code', ovIntended: 'intended', ovActual: 'actual',
        ovCodeT: 'What the code reads and writes by column name, and the ORM relations between models',
        ovIntendedT: 'What the migrations and committed dumps declare',
        ovActualT: 'What the actual schema file holds — a schema-only snapshot or framework oracle output the user saved',
        noActual: 'No actual schema file was read: save a schema-only snapshot under agents/map/data/snapshot/ to compare against it. The map never connects to a database.',
        actualFrom: function (s) { return 'actual schema from ' + s; },
        notCovered: 'not in the actual schema file', absentActual: 'absent in actual', notUsed: 'not used by name in code', nRead: function (n) { return 'read ×' + n; }, nWrite: function (n) { return 'written ×' + n; },
        resetLayout: 'Reset layout', erdHelp: 'Drag a card by its head, drag the background to move, wheel or − / + to zoom. A cluster of more than 12 tables starts with Focus and Keys.',
        ormNoFk: function (k) { return 'ORM ' + k + ' · no FK'; }, ormKind: function (k) { return 'ORM ' + k; }, fkPlain: 'FK',
        noTable: 'model with no table', moreCols: function (n) { return '+ ' + n + ' more columns'; },
        legFk: 'foreign key', legCascade: 'delete cascades', legOrm: 'ORM relation (never a FK)', legGhost: 'named by code, no table',
        diffSummary: function (n, m) { return n + ' column(s) differ, ' + m + ' absent'; },
        cmpHead: 'Code ∣ intended ∣ actual', cmpCol: 'Column', cmpCode: 'Code', cmpIntended: 'Intended', cmpActual: 'Actual', cmpState: 'State',
        stDiffers: 'differs', stAbsent: 'absent in actual', stSame: 'matches', stUncovered: 'unverifiable', stDropped: 'used by code, absent in actual',
        cmpNone: 'Nothing differs between code, intended and actual where a source covers it.',
        links: 'Links', lModels: 'Model files', lPaths: 'Request paths', lReads: 'Read in', lWrites: 'Written in', lTables: 'Tables', notOnMap: 'not on the Code map', openCode: 'open in Code'
    },
    de: {
        dErd: 'ERD', dTables: 'Tabellen', dRelations: 'Schlüssel & Beziehungen', dColumns: function (n) { return n + ' Spalten'; }, dModels: function (n) { return n + ' Model-Datei(en)'; },
        dMeta: function (t2, k, r) { return t2 + ' Tabellen · ' + k + ' Fremdschlüssel · ' + r + ' ORM-Beziehungen'; }, dConn: 'Connection', dEngine: 'Engine',
        dFk: 'Fremdschlüssel (physisch)', dOrm: 'ORM-Beziehungen (kein Fremdschlüssel)', dFrom: 'Von', dTo: 'Nach', dOnDelete: 'on delete', dOnUpdate: 'on update', dKind: 'Art', dKey: 'Schlüssel',
        dType: 'Typ', dNull: 'nullable', dKeyT: 'Schlüssel', yes: 'ja', no: 'nein', dNoFk: 'Es wurden keine Fremdschlüssel gelesen.', dNoOrm: 'Es wurden keine ORM-Beziehungen gelesen.',
        dCluster: 'Cluster', dLines: 'Linien', dLinesAll: 'Alle', dLinesFocus: 'Fokus', dLinesOff: 'Aus', dLinesAllT: 'alle Schlüssel und Beziehungen', dLinesFocusT: 'nur die Linien der gewählten Tabelle, der Rest gedimmt', dLinesOffT: 'keine Linien',
        dCols: 'Spalten', dColsAll: 'Alle', dColsKeys: 'Schlüssel', dColsAllT: 'alle Spalten', dColsKeysT: 'nur PK, FK, Unique, Index und *_id',
        dLayer: 'Schema als', ovCode: 'Code', ovIntended: 'geplant', ovActual: 'tatsächlich',
        ovCodeT: 'Was der Code per Spaltenname liest und schreibt, und die ORM-Beziehungen zwischen Models',
        ovIntendedT: 'Was Migrationen und eingecheckte Dumps deklarieren',
        ovActualT: 'Was die tatsächliche Schema-Datei enthält — ein Schema-Snapshot oder Framework-Orakel, das der Nutzer abgelegt hat',
        noActual: 'Es wurde keine tatsächliche Schema-Datei gelesen: einen Schema-Snapshot unter agents/map/data/snapshot/ ablegen, um damit zu vergleichen. Die Karte verbindet sich nie mit einer Datenbank.',
        actualFrom: function (s) { return 'tatsächliches Schema aus ' + s; },
        notCovered: 'nicht in der tatsächlichen Schema-Datei', absentActual: 'fehlt tatsächlich', notUsed: 'im Code nicht per Name benutzt', nRead: function (n) { return 'gelesen ×' + n; }, nWrite: function (n) { return 'geschrieben ×' + n; },
        resetLayout: 'Anordnung zurücksetzen', erdHelp: 'Karten am Kopf ziehen, Hintergrund ziehen zum Verschieben, Mausrad oder − / + zum Zoomen. Ein Cluster mit mehr als 12 Tabellen startet mit Fokus und Schlüssel.',
        ormNoFk: function (k) { return 'ORM ' + k + ' · kein FK'; }, ormKind: function (k) { return 'ORM ' + k; }, fkPlain: 'FK',
        noTable: 'Model ohne Tabelle', moreCols: function (n) { return '+ ' + n + ' weitere Spalten'; },
        legFk: 'Fremdschlüssel', legCascade: 'Löschen kaskadiert', legOrm: 'ORM-Beziehung (nie ein FK)', legGhost: 'vom Code benannt, keine Tabelle',
        diffSummary: function (n, m) { return n + ' Spalte(n) weichen ab, ' + m + ' fehlen'; },
        cmpHead: 'Code ∣ geplant ∣ tatsächlich', cmpCol: 'Spalte', cmpCode: 'Code', cmpIntended: 'Geplant', cmpActual: 'Tatsächlich', cmpState: 'Zustand',
        stDiffers: 'weicht ab', stAbsent: 'fehlt tatsächlich', stSame: 'stimmt', stUncovered: 'unüberprüfbar', stDropped: 'vom Code benutzt, fehlt tatsächlich',
        cmpNone: 'Wo eine Quelle es abdeckt, weicht nichts zwischen Code, geplant und tatsächlich ab.',
        links: 'Verknüpfungen', lModels: 'Model-Dateien', lPaths: 'Request-Pfade', lReads: 'Gelesen in', lWrites: 'Geschrieben in', lTables: 'Tabellen', notOnMap: 'nicht auf der Code-Karte', openCode: 'im Code öffnen'
    }
});

var ERD_BIG = 12;
var ERD_CARD_W = 230;
var ERD_GAP_X = 150;
var ERD_GAP_Y = 110;
var ERD_COL_CAP = 14;
var erdView = { cluster: null, lines: Object.create(null), cols: Object.create(null), layer: 'intended', z: 1, panX: 0, panY: 0, fitted: Object.create(null), pos: Object.create(null) };

function dBare(tb) { return tb.connection !== 'default' && tb.name.indexOf(tb.connection + ':') === 0 ? tb.name.slice(tb.connection.length + 1) : tb.name; }
function dTable(p, name) { for (var i = 0; i < p.tables.length; i++) if (p.tables[i].name === name) return p.tables[i]; return null; }
function dClassOf(file) { return base(file).replace(/\.[A-Za-z0-9]+$/, ''); }

/** A relation side names a model class or a table; this resolves it to a table, or null when no table backs it. */
function dRelTable(p, name) {
    var hit = null;
    p.tables.forEach(function (tb) {
        if (hit) return;
        if (tb.name === name || dBare(tb) === name) hit = tb;
        else if (tb.models.some(function (m) { return dClassOf(m) === name; })) hit = tb;
    });
    return hit;
}

/** How a column compares between the migrations and the actual schema file — by the type family DR-11 compares, never by spelling. */
function dActualState(c) {
    if (c.actual === undefined) return 'uncovered';
    if (c.actual === null) return c.code ? 'dropped' : 'absent';
    var typeSame = c.family && c.actual.family ? c.family === c.actual.family : String(c.type).toLowerCase() === String(c.actual.type).toLowerCase();
    return typeSame && c.actual.nullable === c.nullable ? 'same' : 'differs';
}
var ACTUAL_CLASS = { same: 'ok', differs: 'warn', absent: 'bad', dropped: 'bad', uncovered: 'dash' };
var ACTUAL_LABEL = { same: 'stSame', differs: 'stDiffers', absent: 'stAbsent', dropped: 'stDropped', uncovered: 'stUncovered' };

/** Clusters as the map writer drew them; recomputed from the foreign keys when a payload has none. */
function dClusters(p) {
    var known = Object.create(null);
    p.tables.forEach(function (tb) { known[tb.name] = true; });
    var out = (p.erd || []).map(function (c) { return { id: c.cluster, tables: c.tables.filter(function (n) { return known[n]; }) }; }).filter(function (c) { return c.tables.length; });
    var seen = Object.create(null);
    out.forEach(function (c) { c.tables.forEach(function (n) { seen[n] = true; }); });
    var rest = p.tables.filter(function (tb) { return !seen[tb.name]; }).map(function (tb) { return tb.name; });
    if (!rest.length) return out;
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
            if (tb.models.indexOf(w.file) >= 0 && /#/.test(subj) === false && subj.indexOf(dClassOf(w.file)) === 0) hit[tb.name] = true;
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

function dColumnItem(tb, c) {
    var st = dActualState(c);
    var rows = [[t('dType'), c.type], [t('dNull'), c.nullable ? t('yes') : t('no')], [t('dKeyT'), c.key ? c.key.toUpperCase() : '']];
    rows.push([t('cmpCode'), c.code ? t('nRead')(c.code.reads.length) + ' · ' + t('nWrite')(c.code.writes.length) : t('notUsed')]);
    rows.push([t('cmpActual'), c.actual ? c.actual.type + (c.actual.nullable ? ' · ' + t('dNull') : '') : t(ACTUAL_LABEL[st])]);
    if (st !== 'uncovered') rows.push([t('cmpState'), stChip(t(ACTUAL_LABEL[st]), ACTUAL_CLASS[st])]);
    var ws = [c.witness].concat(c.actual ? [c.actual.witness] : []).concat(c.code ? c.code.reads.concat(c.code.writes) : []);
    return { key: 'column/' + tb.name + '.' + c.name, kind: 'column', label: tb.name + '.' + c.name, sub: c.type, rows: rows, witnesses: ws,
        links: function () {
            var out = [];
            if (c.code) {
                c.code.reads.forEach(function (w) { out.push([t('lReads'), dCodeLink(w.file, w.line)]); });
                c.code.writes.forEach(function (w) { out.push([t('lWrites'), dCodeLink(w.file, w.line)]); });
            }
            out.push([t('lTables'), { label: tb.name, go: function () { avPick('data', 'table/' + tb.name); } }]);
            return out;
        } };
}

AREA_MODULES.data = {
    tabs: [['erd', 'dErd'], ['tables', 'dTables'], ['relations', 'dRelations'], ['findings', 'aFindings']],
    items: function (p) {
        var out = [];
        p.tables.forEach(function (tb) {
            out.push({ key: 'table/' + tb.name, kind: 'table', label: tb.name, sub: t('dColumns')(tb.columns.length),
                rows: [[t('dConn'), tb.connection], [t('dEngine'), p.engine], ['models', tb.models.join(', ')]], witnesses: [tb.witness],
                links: function () {
                    var out2 = tb.models.map(function (m) { return [t('lModels'), dCodeLink(m)]; });
                    dPathsTo(tb).forEach(function (r) {
                        var f = r.handler >= 0 ? r.handler : r.file;
                        out2.push([t('lPaths'), { label: r.route, sub: files[f] ? files[f].path : '', go: files[f] ? function () { go('code'); openFile(f); } : null }]);
                    });
                    return out2;
                } });
            tb.columns.forEach(function (c) { out.push(dColumnItem(tb, c)); });
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
    meta: function (p) {
        var s = t('dMeta')(num(p.tables.length), num(p.foreignKeys.length), num(p.relations.length));
        return p.actualSources && p.actualSources.length ? s + ' · ' + t('actualFrom')(p.actualSources.join(', ')) : s;
    },
    renderFindings: function (p, main) { dCompare(p, main); findingsView('data', main); },
    render: function (p, view, main) {
        if (view === 'erd') { dErd(p, main); return; }
        if (view === 'relations') { dRelationsView(p, main); return; }
        dCards(p, main);
    }
};

function dRelationsView(p, main) {
    main.appendChild(el('span', { class: 'cap' }, t('dFk')));
    main.appendChild(p.foreignKeys.length ? factTable('data', [t('dFrom'), t('dTo'), t('dOnDelete'), t('dOnUpdate'), t('colWitness')], p.foreignKeys.map(function (k) {
        var name = k.from.table + '.' + k.from.column + ' → ' + k.to.table + '.' + k.to.column;
        var del = k.onDelete ? stChip(k.onDelete, /cascade/i.test(k.onDelete) ? 'bad' : 'dash') : '–';
        return { key: 'fk/' + name, cells: [k.from.table + '.' + k.from.column, k.to.table + '.' + k.to.column, del, k.onUpdate || '–', add(el('span', { class: 'mono' }, wloc(k.witness) + ' '), confirmChip(k.witness.confirm))] };
    })) : el('div', { class: 'box' }, t('dNoFk')));
    main.appendChild(el('span', { class: 'cap' }, t('dOrm')));
    main.appendChild(p.relations.length ? factTable('data', [t('dFrom') + ' → ' + t('dTo'), t('dKind'), t('dKey'), t('colWitness')], p.relations.map(function (r) {
        var name = r.from + ' → ' + r.to;
        return { key: 'rel/' + r.kind + '/' + name, cls: 'orm', cells: [name, r.kind, r.key || '–', add(el('span', { class: 'mono' }, wloc(r.witness) + ' '), confirmChip(r.witness.confirm))] };
    })) : el('div', { class: 'box' }, t('dNoOrm')));
}

function dCards(p, main) {
    var grid = el('div', { class: 'tcards' });
    p.tables.slice(0, ROW_CAP).forEach(function (tb) {
        var card = el('section', { class: 'tcard' + (current.item === 'table/' + tb.name ? ' on' : '') });
        var name = el('button', { type: 'button', class: 'tname mono' }, tb.name);
        name.addEventListener('click', function () { avPick('data', 'table/' + tb.name); });
        add(card, add(el('div', { class: 'between' }), name, confirmChip(tb.witness.confirm)),
            el('span', { class: 'mono muted' }, tb.connection + (tb.models.length ? ' · ' + t('dModels')(tb.models.length) : '')));
        var cols = el('div', { class: 'tcols' });
        tb.columns.slice(0, 12).forEach(function (c) {
            var b = el('button', { type: 'button', class: 'tcol mono' });
            add(b, el('span', { class: 'tkey' }, c.key ? c.key.toUpperCase() : ''), el('span', null, c.name), el('span', { class: 'muted' }, c.type + (c.nullable ? '?' : '')));
            if (c.witness.confirm === 'gone') b.classList.add('gone');
            if (current.item === 'column/' + tb.name + '.' + c.name) b.classList.add('on');
            b.addEventListener('click', function () { avPick('data', 'column/' + tb.name + '.' + c.name); });
            cols.appendChild(b);
        });
        card.appendChild(cols);
        if (tb.columns.length > 12) card.appendChild(el('span', { class: 'note-line' }, t('moreN')(num(tb.columns.length - 12))));
        grid.appendChild(card);
    });
    main.appendChild(grid);
    if (p.tables.length > ROW_CAP) main.appendChild(el('span', { class: 'note-line' }, t('moreRows')(num(p.tables.length - ROW_CAP))));
}

/** Every column where code, intended and actual do not agree, in one grid. */
function dCompare(p, main) {
    main.appendChild(el('span', { class: 'cap' }, t('cmpHead')));
    if (!p.actualSources || !p.actualSources.length) main.appendChild(el('div', { class: 'box soft' }, t('noActual')));
    var rows = [];
    p.tables.forEach(function (tb) {
        tb.columns.forEach(function (c) {
            var st = dActualState(c);
            if (st === 'same' || st === 'uncovered') return;
            var code = c.code ? t('nRead')(c.code.reads.length) + ' · ' + t('nWrite')(c.code.writes.length) : '–';
            var actual = c.actual ? c.actual.type + (c.actual.nullable ? '?' : '') : t('absentActual');
            rows.push({ key: 'column/' + tb.name + '.' + c.name, cls: st === 'differs' ? '' : 'gone',
                cells: [tb.name + '.' + c.name, code, c.type + (c.nullable ? '?' : ''), actual, stChip(t(ACTUAL_LABEL[st]), ACTUAL_CLASS[st])] });
        });
    });
    if (rows.length) main.appendChild(factTable('data', [t('cmpCol'), t('cmpCode'), t('cmpIntended'), t('cmpActual'), t('cmpState')], rows));
    else if (p.actualSources && p.actualSources.length) main.appendChild(el('div', { class: 'box' }, t('cmpNone')));
    main.appendChild(el('span', { class: 'cap' }, t('aFindings')));
}

// ---- ERD ----------------------------------------------------------------------

function dSeg(label, opts, value, pick) {
    var wrap = add(el('div', { class: 'erd-ctl' }), el('span', { class: 'muted' }, label));
    var seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(function (o) {
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(value === o[0]), title: o[2] || null, 'data-v': o[0] }, o[1]);
        b.addEventListener('click', function () { pick(o[0]); });
        seg.appendChild(b);
    });
    return add(wrap, seg);
}

function dErd(p, main) {
    var clusters = dClusters(p);
    if (!clusters.length) { main.appendChild(el('div', { class: 'box' }, t('noFindings'))); return; }
    var picked = current.item.indexOf('table/') === 0 ? current.item.slice(6) : current.item.indexOf('column/') === 0 ? current.item.slice(7).replace(/\.[^.]*$/, '') : '';
    var finding = current.item.indexOf('finding/') === 0 ? (p.findings || [])[Number(current.item.slice(8))] : null;
    var hot = finding ? dFindingTables(p, finding) : Object.create(null);
    var cl = null;
    if (picked) clusters.forEach(function (c) { if (!cl && c.tables.indexOf(picked) >= 0) cl = c; });
    if (!cl && finding) clusters.forEach(function (c) { if (!cl && c.tables.some(function (n) { return hot[n]; })) cl = c; });
    if (!cl) clusters.forEach(function (c) { if (!cl && c.id === erdView.cluster) cl = c; });
    if (!cl) cl = clusters[0];
    erdView.cluster = cl.id;
    var big = cl.tables.length > ERD_BIG;
    var lines = erdView.lines[cl.id] || (big ? 'focus' : 'all');
    var cols = erdView.cols[cl.id] || (big ? 'keys' : 'all');
    var layer = erdView.layer;
    var hasActual = !!(p.actualSources && p.actualSources.length);
    var hotCol = finding && /^column:/.test(String(finding.subject)) ? String(finding.subject).slice(7) : '';
    var flagged = Object.create(null);
    (p.findings || []).forEach(function (f) { var h = dFindingTables(p, f); Object.keys(h).forEach(function (n) { flagged[n] = (flagged[n] || 0) + 1; }); });
    var focus = Object.create(null);
    if (picked) focus[picked] = true;
    Object.keys(hot).forEach(function (n) { focus[n] = true; });

    var rerender = function () { renderAreaPage('data', current.item); };
    var ctl = el('div', { class: 'erd-ctls' });
    if (clusters.length > 1) ctl.appendChild(dSeg(t('dCluster'), clusters.map(function (c) { return [c.id, c.id + ' (' + c.tables.length + ')']; }), cl.id, function (v) { erdView.cluster = v; if (picked) avPick('data', ''); else rerender(); }));
    ctl.appendChild(dSeg(t('dLines'), [['all', t('dLinesAll'), t('dLinesAllT')], ['focus', t('dLinesFocus'), t('dLinesFocusT')], ['off', t('dLinesOff'), t('dLinesOffT')]], lines, function (v) { erdView.lines[cl.id] = v; rerender(); }));
    ctl.appendChild(dSeg(t('dCols'), [['all', t('dColsAll'), t('dColsAllT')], ['keys', t('dColsKeys'), t('dColsKeysT')]], cols, function (v) { erdView.cols[cl.id] = v; rerender(); }));
    var layerSeg = dSeg(t('dLayer'), [['code', t('ovCode'), t('ovCodeT')], ['intended', t('ovIntended'), t('ovIntendedT')], ['actual', t('ovActual'), t('ovActualT')]], layer, function (v) { erdView.layer = v; rerender(); });
    layerSeg.classList.add('erd-layer');
    ctl.appendChild(layerSeg);
    main.appendChild(ctl);
    if (layer === 'actual' && !hasActual) main.appendChild(el('div', { class: 'box soft erd-note' }, t('noActual')));

    var stage = el('div', { class: 'erd-stage', id: 'erd-stage', 'data-layer': layer, 'data-lines': lines });
    var world = el('div', { class: 'erd-world' });
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'erd-edges');
    svg.setAttribute('aria-hidden', 'true');
    world.appendChild(svg);
    var labels = el('div', { class: 'erd-labels' });
    world.appendChild(labels);
    stage.appendChild(world);

    // Ghost cards: a model the ORM relates to that no table backs. Context cards:
    // a table of another cluster an ORM relation reaches, drawn faint with its keys.
    var outside = Object.create(null);
    var inCluster = Object.create(null);
    cl.tables.forEach(function (n) { inCluster[n] = true; });
    var rels = [];
    var ghosts = [];
    var ghostSeen = Object.create(null);
    p.relations.forEach(function (r, i) {
        var a = dRelTable(p, r.from);
        var b = dRelTable(p, r.to);
        if ((!a || !inCluster[a.name]) && (!b || !inCluster[b.name])) return;
        var an2 = a ? a.name : 'model:' + r.from;
        var bn = b ? b.name : 'model:' + r.to;
        [[a, r.from, an2], [b, r.to, bn]].forEach(function (s) {
            if (s[0] || ghostSeen[s[2]]) return;
            ghostSeen[s[2]] = true;
            ghosts.push({ id: s[2], label: s[1] });
        });
        if (a && !inCluster[a.name]) outside[a.name] = true;
        if (b && !inCluster[b.name]) outside[b.name] = true;
        rels.push({ from: an2, to: bn, r: r, idx: i });
    });
    var fkPairs = Object.create(null);
    p.foreignKeys.forEach(function (k) { fkPairs[k.from.table + '|' + k.to.table] = true; fkPairs[k.to.table + '|' + k.from.table] = true; });

    var cards = Object.create(null);
    var degree = Object.create(null);
    cl.tables.forEach(function (n) { degree[n] = 0; });
    p.foreignKeys.forEach(function (k) { if (inCluster[k.from.table] && inCluster[k.to.table]) { degree[k.from.table] += 1; degree[k.to.table] += 1; } });
    var order = cl.tables.slice().sort(function (a, b) { return degree[b] - degree[a] || (a < b ? -1 : 1); }).concat(Object.keys(outside).sort());
    var colsShown = Object.create(null);

    order.forEach(function (name) {
        var tb = dTable(p, name);
        if (!tb) return;
        var covered = tb.columns.some(function (c) { return c.actual !== undefined; });
        var coded = tb.models.length > 0 || tb.columns.some(function (c) { return !!c.code; });
        var ctx = !!outside[name];
        var card = el('div', { class: 'erd-card' + (ctx ? ' outside' : ''), 'data-table': name });
        if (current.item === 'table/' + name) card.classList.add('on');
        if (hot[name]) card.classList.add('hot');
        else if (flagged[name]) card.classList.add('flag');
        if (lines === 'focus' && Object.keys(focus).length && !focus[name] && !dTouches(name, focus, p, rels)) card.classList.add('dim');
        var head = el('div', { class: 'erd-head' });
        var nameB = el('button', { type: 'button', class: 'erd-name mono', title: name }, name);
        nameB.addEventListener('click', function () { if (!stage.dragged) avPick('data', 'table/' + name); });
        var badges = el('span', { class: 'erd-src' });
        add(badges, el('span', { class: 'src c' + (coded ? '' : ' off'), title: t('ovCodeT') }, 'C'), el('span', { class: 'src m', title: t('ovIntendedT') }, 'M'),
            el('span', { class: 'src l' + (covered ? '' : ' off'), title: covered ? t('ovActualT') : t('notCovered') }, 'L'));
        if (flagged[name]) badges.appendChild(el('span', { class: 'erd-flag', title: t('aFindings') }, String(flagged[name])));
        add(head, nameB, badges);
        card.appendChild(head);
        if (layer === 'actual' && hasActual && !covered) card.appendChild(el('div', { class: 'erd-note-line muted' }, t('notCovered')));
        var list = cols === 'keys' || ctx ? tb.columns.filter(function (c) { return c.key || /_id$/.test(c.name); }) : tb.columns;
        var shown = list.slice(0, ERD_COL_CAP);
        colsShown[name] = shown.length;
        shown.forEach(function (c) {
            var b = el('button', { type: 'button', class: 'tcol erd-col mono', title: tb.name + '.' + c.name });
            var st = dActualState(c);
            var typeText = c.type + (c.nullable ? '?' : '');
            if (layer === 'actual') {
                if (st === 'absent' || st === 'dropped') { b.classList.add('gone'); typeText = t('absentActual'); }
                else if (st === 'differs') { b.classList.add('diff'); typeText = c.actual.type + (c.actual.nullable ? '?' : ''); b.title = tb.name + '.' + c.name + ' — ' + t('cmpIntended') + ': ' + c.type + (c.nullable ? '?' : '') + ' · ' + t('cmpActual') + ': ' + typeText; }
                else if (st === 'uncovered') b.classList.add('faint');
                else typeText = c.actual.type + (c.actual.nullable ? '?' : '');
            } else if (layer === 'code') {
                if (c.code) { b.classList.add('used'); typeText = (c.code.reads.length ? 'R' + c.code.reads.length : '') + (c.code.writes.length ? (c.code.reads.length ? ' ' : '') + 'W' + c.code.writes.length : ''); }
                else b.classList.add('faint');
                if (st === 'dropped') b.classList.add('gone');
            } else if (c.witness.confirm === 'gone') b.classList.add('gone');
            if (current.item === 'column/' + tb.name + '.' + c.name) b.classList.add('on');
            if (hotCol && (hotCol === tb.name + '.' + c.name || hotCol === dBare(tb) + '.' + c.name)) b.classList.add('hotcol');
            add(b, el('span', { class: 'tkey' }, c.key ? c.key.toUpperCase() : ''), el('span', { class: 'cn' }, c.name), el('span', { class: 'ct', title: typeText }, typeText));
            b.addEventListener('click', function () { if (!stage.dragged) avPick('data', 'column/' + tb.name + '.' + c.name); });
            card.appendChild(b);
        });
        if (list.length > shown.length || tb.columns.length > list.length) card.appendChild(el('div', { class: 'erd-more muted mono' }, t('moreCols')(num(tb.columns.length - shown.length))));
        world.appendChild(card);
        cards[name] = card;
        dDrag(card, head, name, stage);
    });
    ghosts.forEach(function (g) {
        var card = el('div', { class: 'erd-card ghost', 'data-table': g.id });
        add(card, add(el('div', { class: 'erd-head' }), el('span', { class: 'erd-name mono', title: g.label }, g.label)), el('div', { class: 'erd-note-line' }, t('noTable')));
        world.appendChild(card);
        cards[g.id] = card;
        dDrag(card, card.firstChild, g.id, stage);
    });

    var zoom = el('div', { class: 'seg erd-zoom' });
    var zl = el('span', { class: 'mono erd-zl' });
    function zbtn(text, aria, fn) { var b = el('button', { type: 'button', class: 'z', 'aria-label': aria, title: aria }, text); b.addEventListener('click', fn); return b; }
    add(zoom, zbtn('−', t('zoomOut'), function () { dZoomAt(stage, 1 / 1.2); }), zbtn('+', t('zoomIn'), function () { dZoomAt(stage, 1.2); }));
    var fitB = el('button', { type: 'button', class: 'fit' }, t('fit'));
    fitB.addEventListener('click', function () { dFit(stage); });
    var resetB = zbtn('↺', t('resetLayout'), function () { Object.keys(erdView.pos).forEach(function (k) { if (k.indexOf(cl.id + '|') === 0) delete erdView.pos[k]; }); erdView.fitted[cl.id] = false; rerender(); });
    add(zoom, fitB, resetB);
    stage.appendChild(zoom);
    stage.appendChild(zl);
    main.appendChild(stage);
    var legend = add(el('div', { class: 'erd-legend' }),
        add(el('span'), el('i', { class: 'k fk' }), document.createTextNode(t('legFk'))),
        add(el('span'), el('i', { class: 'k cascade' }), document.createTextNode(t('legCascade'))),
        add(el('span'), el('i', { class: 'k orm' }), document.createTextNode(t('legOrm'))),
        ghosts.length ? add(el('span'), el('i', { class: 'k ghost' }), document.createTextNode(t('legGhost'))) : null);
    main.appendChild(legend);
    main.appendChild(el('div', { class: 'muted erd-help' }, t('erdHelp')));

    // Layout: each table goes to the free grid cell nearest the tables it is joined to, so a line
    // seldom crosses a card; rows are as tall as their tallest card. A dragged card keeps its place.
    var all = order.filter(function (n) { return cards[n]; }).concat(ghosts.map(function (g) { return g.id; }));
    var adj = Object.create(null);
    all.forEach(function (n) { adj[n] = []; });
    function join(a, b) { if (adj[a] && adj[b] && a !== b) { adj[a].push(b); adj[b].push(a); } }
    p.foreignKeys.forEach(function (k) { join(k.from.table, k.to.table); });
    rels.forEach(function (r) { join(r.from, r.to); });
    // The width the stage will have once the detail rail settles; the rail is placed after this page renders.
    var sw = Math.max(320, window.innerWidth - (paneMode() === 'wide' ? 440 : 0) - 64);
    // A phone gets one column it pans down; a wider stage takes a near-square grid and the fit scales it.
    var maxCols = sw < 600 ? 1 : all.length;
    var cell = dGrid(all, adj, Math.min(maxCols, Math.max(1, Math.ceil(Math.sqrt(all.length * 1.5)))));
    var rowH = [];
    all.forEach(function (n) { var r = cell[n][1]; rowH[r] = Math.max(rowH[r] || 0, cards[n].offsetHeight); });
    var rowY = [];
    var y = 24;
    for (var r1 = 0; r1 < rowH.length; r1++) { rowY[r1] = y; y += (rowH[r1] || 0) + ERD_GAP_Y; }
    all.forEach(function (n) {
        var at = erdView.pos[cl.id + '|' + n] || [24 + cell[n][0] * (ERD_CARD_W + ERD_GAP_X), rowY[cell[n][1]]];
        cards[n].style.left = at[0] + 'px';
        cards[n].style.top = at[1] + 'px';
    });
    stage.erd = { cluster: cl.id, cards: cards, svg: svg, labels: labels, world: world, zl: zl, p: p, rels: rels, focus: focus, lines: lines, fkPairs: fkPairs, inCluster: inCluster, layer: layer };
    dEdges(stage);
    dPan(stage);
    dApply(stage);
    if (!erdView.fitted[cl.id]) {
        erdView.fitted[cl.id] = true;
        requestAnimationFrame(function () { if (stage.isConnected) dFit(stage, true); });
    }
}

/**
 * Grid cells for the ERD: the best-joined table first, then breadth-first, each into the free
 * cell closest to its placed neighbours (a column step costs more than a row step: cards are
 * wider than tall). Tables joined to nothing fill the first free cells. Empty rows and columns
 * are dropped.
 */
function dGrid(names, adj, ncols) {
    var cell = Object.create(null);
    var taken = Object.create(null);
    var nrows = Math.ceil(names.length / ncols) + 2;
    var queue = names.slice().sort(function (a, b) { return adj[b].length - adj[a].length || (a < b ? -1 : 1); });
    var seen = Object.create(null);
    var order = [];
    queue.forEach(function (start) {
        if (seen[start]) return;
        var q = [start];
        seen[start] = true;
        while (q.length) {
            var x = q.shift();
            order.push(x);
            adj[x].slice().sort(function (a, b) { return adj[b].length - adj[a].length || (a < b ? -1 : 1); }).forEach(function (y) { if (!seen[y]) { seen[y] = true; q.push(y); } });
        }
    });
    order.forEach(function (n, i) {
        var placedNb = adj[n].filter(function (m) { return cell[m]; });
        var best = null;
        var bestCost = Infinity;
        for (var r = 0; r < nrows; r++) {
            for (var c = 0; c < ncols; c++) {
                if (taken[c + ',' + r]) continue;
                var cost;
                if (i === 0) cost = Math.abs(c - Math.floor((ncols - 1) / 2)) + r * 10;
                else if (!placedNb.length) cost = r * 100 + c;
                else cost = placedNb.reduce(function (sum, m) { return sum + Math.hypot(cell[m][0] - c, cell[m][1] - r) + (dBlocked(taken, cell[m], [c, r]) ? 3 : 0); }, 0) + r * 0.01 + c * 0.001;
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
    k = 0;
    for (var r2 = 0; r2 < nrows; r2++) if (usedR[r2]) mapR[r2] = k++;
    names.forEach(function (n) { cell[n] = [mapC[cell[n][0]], mapR[cell[n][1]]]; });
    return cell;
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

function dTouches(name, focus, p, rels) {
    var on = false;
    p.foreignKeys.forEach(function (k) { if ((k.from.table === name && focus[k.to.table]) || (k.to.table === name && focus[k.from.table])) on = true; });
    rels.forEach(function (r) { if ((r.from === name && focus[r.to]) || (r.to === name && focus[r.from])) on = true; });
    return on;
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

/** Lines between the cards as they stand now; called again after every drag. */
function dEdges(stage) {
    var e = stage.erd;
    var svgNS = 'http://www.w3.org/2000/svg';
    while (e.svg.firstChild) e.svg.removeChild(e.svg.firstChild);
    clear(e.labels);
    var maxX = 0;
    var maxY = 0;
    Object.keys(e.cards).forEach(function (n) { var r = dRect(e.cards[n]); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); });
    e.svg.setAttribute('width', String(maxX + 40));
    e.svg.setAttribute('height', String(maxY + 40));
    e.world.style.width = (maxX + 40) + 'px';
    e.world.style.height = (maxY + 40) + 'px';
    if (e.lines === 'off') return;
    var focusOn = Object.keys(e.focus).length > 0;
    var pairCount = Object.create(null);
    function line(a, b, cls, text, title, at) {
        var ca = e.cards[a];
        var cb = e.cards[b];
        if (!ca || !cb) return;
        var touches = e.focus[a] || e.focus[b];
        if (e.lines === 'focus' && focusOn && !touches) return;
        var key = a < b ? a + '|' + b : b + '|' + a;
        var nth = pairCount[key] = (pairCount[key] || 0) + 1;
        var ra = dRect(ca);
        var rb = dRect(cb);
        var p1;
        var p2;
        if (a === b) {
            p1 = [ra.x + ra.w, ra.y + 14];
            p2 = [ra.x + ra.w, ra.y + 34];
        } else {
            p1 = dClip(ra, rb.x + rb.w / 2, rb.y + rb.h / 2);
            p2 = dClip(rb, ra.x + ra.w / 2, ra.y + ra.h / 2);
        }
        var len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
        var off = (nth - 1) * 8;
        var ox = -(p2[1] - p1[1]) / len * off;
        var oy = (p2[0] - p1[0]) / len * off;
        var path = document.createElementNS(svgNS, 'path');
        var d = a === b ? 'M' + p1[0] + ' ' + p1[1] + ' c 40 -10 40 30 0 20' : 'M' + (p1[0] + ox).toFixed(1) + ' ' + (p1[1] + oy).toFixed(1) + ' L' + (p2[0] + ox).toFixed(1) + ' ' + (p2[1] + oy).toFixed(1);
        path.setAttribute('d', d);
        path.setAttribute('class', 'erd-e ' + cls + (focusOn && touches ? ' hi' : ''));
        var tt = document.createElementNS(svgNS, 'title');
        tt.textContent = title;
        path.appendChild(tt);
        e.svg.appendChild(path);
        var dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', String((p2[0] + ox).toFixed(1)));
        dot.setAttribute('cy', String((p2[1] + oy).toFixed(1)));
        dot.setAttribute('r', '3.5');
        dot.setAttribute('class', 'erd-end ' + cls);
        e.svg.appendChild(dot);
        if (text) {
            var lb = el('span', { class: 'erd-lbl mono ' + cls, title: title }, text);
            var f = Math.min(0.85, (at == null ? 0.5 : at) + (nth - 1) * 0.06);
            var side = (/orm/.test(cls) ? 1 : -1) * (11 + (nth - 1) * 17);
            // Labels of one pair stack on the screen's vertical, whatever the line's direction: they are wider than tall.
            lb.style.left = (p1[0] + (p2[0] - p1[0]) * f + ox) + 'px';
            lb.style.top = (p1[1] + (p2[1] - p1[1]) * f + oy + side) + 'px';
            e.labels.appendChild(lb);
        }
    }
    e.p.foreignKeys.forEach(function (k) {
        if (!e.inCluster[k.from.table] || !e.inCluster[k.to.table]) return;
        var cascade = /cascade/i.test(k.onDelete || '');
        var acts = [];
        if (k.onDelete) acts.push('ON DELETE ' + k.onDelete.toUpperCase());
        if (k.onUpdate) acts.push('ON UPDATE ' + k.onUpdate.toUpperCase());
        var title = k.from.table + '.' + k.from.column + ' → ' + k.to.table + '.' + k.to.column + (acts.length ? ' · ' + acts.join(' · ') : '');
        line(k.from.table, k.to.table, cascade ? 'cascade' : 'fk', acts.length ? t('fkPlain') + ' · ' + acts.join(' · ') : '', title, 0.55);
    });
    if (e.layer === 'actual') return;
    // One dashed line per pair of tables, however many relations the models declare between them.
    var pairs = Object.create(null);
    var pairOrder = [];
    e.rels.forEach(function (r) {
        var key = r.from < r.to ? r.from + '|' + r.to : r.to + '|' + r.from;
        if (!pairs[key]) { pairs[key] = { from: r.from, to: r.to, kinds: [], titles: [] }; pairOrder.push(key); }
        if (pairs[key].kinds.indexOf(r.r.kind) < 0) pairs[key].kinds.push(r.r.kind);
        pairs[key].titles.push(r.r.from + ' → ' + r.r.to + ' · ' + r.r.kind + (r.r.key ? ' · ' + r.r.key : ''));
    });
    pairOrder.forEach(function (key) {
        var g = pairs[key];
        var kinds = g.kinds.join(', ');
        var noFk = !e.fkPairs[g.from + '|' + g.to];
        var ghost = g.from.indexOf('model:') === 0 || g.to.indexOf('model:') === 0;
        line(g.from, g.to, 'orm' + (ghost ? ' ghost' : ''), noFk ? t('ormNoFk')(kinds) : (e.layer === 'code' ? t('ormKind')(kinds) : ''), g.titles.join('\n'), 0.4);
    });
}

function dApply(stage) {
    stage.erd.world.style.transform = 'translate(' + erdView.panX + 'px, ' + erdView.panY + 'px) scale(' + erdView.z + ')';
    stage.erd.zl.textContent = Math.round(erdView.z * 100) + ' %';
    window.__mapErd = { cluster: stage.erd.cluster, z: erdView.z, tables: Object.keys(stage.erd.cards), layer: stage.erd.layer };
}
function dZoomAt(stage, f, cx, cy) {
    var nz = Math.max(0.3, Math.min(2.5, erdView.z * f));
    var px = cx == null ? stage.clientWidth / 2 : cx;
    var py = cy == null ? stage.clientHeight / 2 : cy;
    erdView.panX = px - (px - erdView.panX) * nz / erdView.z;
    erdView.panY = py - (py - erdView.panY) * nz / erdView.z;
    erdView.z = nz;
    dApply(stage);
}
function dFit(stage, onlyShrink) {
    var w = stage.erd.world;
    var bw = parseFloat(w.style.width) || 1;
    var bh = parseFloat(w.style.height) || 1;
    var z = Math.min(stage.clientWidth / bw, (stage.clientHeight - 44) / bh);
    // A narrow stage fits the width and lets the height scroll by panning: a phone-sized whole schema is unreadable.
    if (stage.clientWidth < 600) z = stage.clientWidth / bw;
    z = Math.max(0.3, Math.min(onlyShrink ? 1 : 1.5, z));
    erdView.z = z;
    erdView.panX = Math.max(0, (stage.clientWidth - bw * z) / 2);
    erdView.panY = Math.max(44, (stage.clientHeight - bh * z) / 2);
    dApply(stage);
}

function dDrag(card, handle, name, stage) {
    handle.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        var startX = ev.clientX;
        var startY = ev.clientY;
        var x0 = card.offsetLeft;
        var y0 = card.offsetTop;
        stage.dragged = false;
        function move(m) {
            var dx = (m.clientX - startX) / erdView.z;
            var dy = (m.clientY - startY) / erdView.z;
            if (!stage.dragged && Math.abs(dx) + Math.abs(dy) < 4) return;
            stage.dragged = true;
            card.style.left = Math.max(0, x0 + dx) + 'px';
            card.style.top = Math.max(0, y0 + dy) + 'px';
            erdView.pos[stage.erd.cluster + '|' + name] = [Math.max(0, x0 + dx), Math.max(0, y0 + dy)];
            dEdges(stage);
        }
        function up() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            setTimeout(function () { stage.dragged = false; }, 0);
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    });
}
function dPan(stage) {
    stage.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || ev.target.closest('.erd-card, .erd-zoom')) return;
        var sx = ev.clientX;
        var sy = ev.clientY;
        var px = erdView.panX;
        var py = erdView.panY;
        function move(m) { erdView.panX = px + m.clientX - sx; erdView.panY = py + m.clientY - sy; dApply(stage); }
        function up() { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    });
    stage.addEventListener('wheel', function (ev) {
        ev.preventDefault();
        var r = stage.getBoundingClientRect();
        dZoomAt(stage, ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });
}
