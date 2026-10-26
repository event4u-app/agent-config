/*
 * Data: tables with their columns and keys, foreign keys with their delete
 * rules, and ORM relations — which are never foreign keys, so they are drawn
 * dashed beside them.
 */
extendStrings({
    en: {
        dTables: 'Tables', dRelations: 'Keys & relations', dColumns: function (n) { return n + ' columns'; }, dModels: function (n) { return n + ' model file(s)'; },
        dMeta: function (t2, k, r) { return t2 + ' tables · ' + k + ' foreign keys · ' + r + ' ORM relations'; }, dConn: 'connection', dEngine: 'engine',
        dFk: 'Foreign keys (physical)', dOrm: 'ORM relations (not a foreign key)', dFrom: 'From', dTo: 'To', dOnDelete: 'on delete', dOnUpdate: 'on update', dKind: 'Kind', dKey: 'Key',
        dType: 'type', dNull: 'nullable', dKeyT: 'key', yes: 'yes', no: 'no', dNoFk: 'No foreign keys were read.', dNoOrm: 'No ORM relations were read.'
    },
    de: {
        dTables: 'Tabellen', dRelations: 'Schlüssel & Beziehungen', dColumns: function (n) { return n + ' Spalten'; }, dModels: function (n) { return n + ' Model-Datei(en)'; },
        dMeta: function (t2, k, r) { return t2 + ' Tabellen · ' + k + ' Fremdschlüssel · ' + r + ' ORM-Beziehungen'; }, dConn: 'Connection', dEngine: 'Engine',
        dFk: 'Fremdschlüssel (physisch)', dOrm: 'ORM-Beziehungen (kein Fremdschlüssel)', dFrom: 'Von', dTo: 'Nach', dOnDelete: 'on delete', dOnUpdate: 'on update', dKind: 'Art', dKey: 'Schlüssel',
        dType: 'Typ', dNull: 'nullable', dKeyT: 'Schlüssel', yes: 'ja', no: 'nein', dNoFk: 'Es wurden keine Fremdschlüssel gelesen.', dNoOrm: 'Es wurden keine ORM-Beziehungen gelesen.'
    }
});

AREA_MODULES.data = {
    tabs: [['tables', 'dTables'], ['relations', 'dRelations'], ['findings', 'aFindings']],
    items: function (p) {
        var out = [];
        p.tables.forEach(function (tb) {
            out.push({ key: 'table/' + tb.name, kind: 'table', label: tb.name, sub: t('dColumns')(tb.columns.length),
                rows: [[t('dConn'), tb.connection], [t('dEngine'), p.engine], ['models', tb.models.join(', ')]], witnesses: [tb.witness] });
            tb.columns.forEach(function (c) {
                out.push({ key: 'column/' + tb.name + '.' + c.name, kind: 'column', label: tb.name + '.' + c.name, sub: c.type,
                    rows: [[t('dType'), c.type], [t('dNull'), c.nullable ? t('yes') : t('no')], [t('dKeyT'), c.key ? c.key.toUpperCase() : '']], witnesses: [c.witness] });
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
    meta: function (p) { return t('dMeta')(num(p.tables.length), num(p.foreignKeys.length), num(p.relations.length)); },
    render: function (p, view, main) {
        if (view === 'relations') {
            main.appendChild(el('span', { class: 'cap' }, t('dFk')));
            main.appendChild(p.foreignKeys.length ? factTable('data', [t('dFrom'), t('dTo'), t('dOnDelete'), t('colWitness')], p.foreignKeys.map(function (k) {
                var name = k.from.table + '.' + k.from.column + ' → ' + k.to.table + '.' + k.to.column;
                var del = k.onDelete ? stChip(k.onDelete, /cascade/i.test(k.onDelete) ? 'bad' : 'dash') : '–';
                return { key: 'fk/' + name, cells: [k.from.table + '.' + k.from.column, k.to.table + '.' + k.to.column, del, add(el('span', { class: 'mono' }, wloc(k.witness) + ' '), confirmChip(k.witness.confirm))] };
            })) : el('div', { class: 'box' }, t('dNoFk')));
            main.appendChild(el('span', { class: 'cap' }, t('dOrm')));
            main.appendChild(p.relations.length ? factTable('data', [t('dFrom') + ' → ' + t('dTo'), t('dKind'), t('dKey'), t('colWitness')], p.relations.map(function (r) {
                var name = r.from + ' → ' + r.to;
                return { key: 'rel/' + r.kind + '/' + name, cls: 'orm', cells: [name, r.kind, r.key || '–', add(el('span', { class: 'mono' }, wloc(r.witness) + ' '), confirmChip(r.witness.confirm))] };
            })) : el('div', { class: 'box' }, t('dNoOrm')));
            return;
        }
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
};
