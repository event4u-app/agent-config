/*
 * Impact: what the working diff reaches in every area, each item with the
 * confirm state of its witness, and the review-risk terms as a visible sum.
 */
extendStrings({
    en: {
        mAffected: 'Affected', mRisk: 'Review risk', mChanged: function (n, r) { return n + ' changed file(s) since ' + r; },
        mLayers: { code: 'Code', tests: 'Tests', data: 'Data', interfaces: 'Interfaces', runtime: 'Runtime', delivery: 'Delivery' },
        mNone: 'nothing affected', mTerm: 'Term', mFact: 'Fact from the graph', mContribution: 'Contribution', mTotal: 'Sum',
        mNoRisk: 'No review-risk terms were written for this diff.', mMeta: function (a, c) { return a + ' affected · ' + c + ' changed'; }
    },
    de: {
        mAffected: 'Betroffen', mRisk: 'Review-Risiko', mChanged: function (n, r) { return n + ' geänderte Datei(en) seit ' + r; },
        mLayers: { code: 'Code', tests: 'Tests', data: 'Data', interfaces: 'Interfaces', runtime: 'Runtime', delivery: 'Delivery' },
        mNone: 'nichts betroffen', mTerm: 'Term', mFact: 'Fakt aus dem Graph', mContribution: 'Beitrag', mTotal: 'Summe',
        mNoRisk: 'Für diesen Diff wurden keine Review-Risiko-Terme geschrieben.', mMeta: function (a, c) { return a + ' betroffen · ' + c + ' geändert'; }
    }
});

var IMPACT_LAYERS = ['code', 'tests', 'data', 'interfaces', 'runtime', 'delivery'];

AREA_MODULES.impact = {
    tabs: [['affected', 'mAffected'], ['risk', 'mRisk'], ['findings', 'aFindings']],
    items: function (p) {
        var out = p.affected.map(function (a, i) {
            return { key: 'affected/' + i, kind: t('mLayers')[a.layer] || a.layer, label: a.name, sub: a.why, rows: [['why', a.why]], witnesses: [a.witness] };
        });
        ((p.risk && p.risk.terms) || []).forEach(function (r, i) {
            out.push({ key: 'risk/' + i, kind: 'risk term', label: r.term, sub: r.fact, rows: [[t('mFact'), r.fact], [t('mContribution'), num(r.contribution)]], witnesses: r.witness ? [r.witness] : [] });
        });
        return out;
    },
    meta: function (p) { return t('mMeta')(num(p.affected.length), num(p.changed.length)); },
    render: function (p, view, main) {
        main.appendChild(el('div', { class: 'mono soft' }, t('mChanged')(num(p.changed.length), p.rev)));
        if (view === 'risk') {
            if (!p.risk || !p.risk.terms.length) { main.appendChild(el('div', { class: 'box' }, t('mNoRisk'))); return; }
            var rows = p.risk.terms.map(function (r, i) { return { key: 'risk/' + i, cells: [r.term, r.fact, num(r.contribution)] }; });
            rows.push({ cells: [t('mTotal'), '', num(p.risk.total)], cls: 'sum' });
            main.appendChild(factTable('impact', [t('mTerm'), t('mFact'), t('mContribution')], rows));
            return;
        }
        var grid = el('div', { class: 'lgrid' });
        IMPACT_LAYERS.forEach(function (layer) {
            var list = [];
            p.affected.forEach(function (a, i) { if (a.layer === layer) list.push([a, i]); });
            var box = el('section', { class: 'card' + (list.length ? '' : ' missing') });
            add(box, add(el('div', { class: 'between' }), el('b', null, t('mLayers')[layer]), el('span', { class: 'mono' }, num(list.length))));
            if (!list.length) box.appendChild(el('span', { class: 'note-line' }, t('mNone')));
            list.slice(0, 12).forEach(function (ai) {
                var b = el('button', { type: 'button', class: 'frow' + (current.item === 'affected/' + ai[1] ? ' on' : ''), title: ai[0].why });
                add(b, confirmChip(ai[0].witness.confirm), el('span', { class: 'mono' }, ai[0].name));
                b.addEventListener('click', function () { avPick('impact', 'affected/' + ai[1]); });
                box.appendChild(b);
            });
            if (list.length > 12) box.appendChild(el('span', { class: 'note-line' }, t('moreN')(num(list.length - 12))));
            grid.appendChild(box);
        });
        main.appendChild(grid);
    }
};
