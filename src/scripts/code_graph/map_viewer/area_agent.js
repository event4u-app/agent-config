/*
 * Agent: the graph verbs an agent can call — each named as the CLI names it,
 * so `explain` is the neighbourhood query and never generated prose — and the
 * context pack it receives, cut by rank to a token budget and said so.
 */
extendStrings({
    en: {
        gVerbs: 'Verbs', gPack: 'Context pack', gAnswers: 'answers', gCli: 'CLI', gMcp: 'MCP tool', gReturned: 'returned / total', gHasMore: 'more beyond the budget',
        gBudget: function (u, b) { return u + ' of ' + b + ' tokens used'; }, gKind: 'Kind', gItem: 'Item', gWhy: 'Why in the pack', gTokens: 'Tokens',
        gNoPack: 'No context pack was written with this map.', gMeta: function (v) { return v + ' verbs'; }, gCut: function (n) { return n + ' more item(s) cut by rank, not hidden'; }
    },
    de: {
        gVerbs: 'Verben', gPack: 'Context-Pack', gAnswers: 'beantwortet', gCli: 'CLI', gMcp: 'MCP-Tool', gReturned: 'geliefert / gesamt', gHasMore: 'weitere über dem Budget',
        gBudget: function (u, b) { return u + ' von ' + b + ' Tokens genutzt'; }, gKind: 'Art', gItem: 'Eintrag', gWhy: 'Warum im Pack', gTokens: 'Tokens',
        gNoPack: 'Mit dieser Karte wurde kein Context-Pack geschrieben.', gMeta: function (v) { return v + ' Verben'; }, gCut: function (n) { return n + ' weitere Einträge nach Rang abgeschnitten, nicht verschwiegen'; }
    }
});

AREA_MODULES.agent = {
    tabs: [['verbs', 'gVerbs'], ['pack', 'gPack'], ['findings', 'aFindings']],
    items: function (p) {
        var out = p.verbs.map(function (v) {
            return { key: 'verb/' + v.name, kind: 'verb', label: v.name, sub: v.answers, rows: [[t('gAnswers'), v.answers], [t('gCli'), v.cli], [t('gMcp'), v.mcp]], witnesses: [] };
        });
        ((p.contextPack && p.contextPack.items) || []).forEach(function (it, i) {
            out.push({ key: 'pack/' + i, kind: it.kind, label: it.name, sub: it.why, rows: [[t('gWhy'), it.why], [t('gTokens'), num(it.tokens)]], witnesses: [it.witness] });
        });
        return out;
    },
    meta: function (p) { return t('gMeta')(num(p.verbs.length)); },
    render: function (p, view, main) {
        if (view === 'pack') {
            var pk = p.contextPack;
            if (!pk) { main.appendChild(el('div', { class: 'box' }, t('gNoPack'))); return; }
            var kpis = el('div', { class: 'tiles kpi4' });
            [[num(pk.returned) + ' / ' + num(pk.total), t('gReturned')], [pk.hasMore ? '✓' : '–', t('gHasMore')], [num(pk.usedTokens), t('gBudget')(num(pk.usedTokens), num(pk.budgetTokens))]].forEach(function (k) {
                kpis.appendChild(add(el('div', { class: 'tile' }), el('div', { class: 'v' }, k[0]), el('div', { class: 'cap' }, k[1])));
            });
            main.appendChild(kpis);
            var bar = el('div', { class: 'sharebar' });
            var fill = el('i');
            fill.style.width = Math.min(100, pk.budgetTokens ? pk.usedTokens / pk.budgetTokens * 100 : 0) + '%';
            main.appendChild(add(bar, fill));
            main.appendChild(factTable('agent', [t('gItem'), t('gKind'), t('gWhy'), t('gTokens'), t('colWitness')], pk.items.map(function (it, i) {
                return { key: 'pack/' + i, cls: it.witness.confirm === 'gone' ? 'gone' : '', cells: [it.name, it.kind, it.why, num(it.tokens), add(el('span', { class: 'mono' }, wloc(it.witness) + ' '), confirmChip(it.witness.confirm))] };
            })));
            if (pk.hasMore) main.appendChild(el('span', { class: 'note-line' }, t('gCut')(num(pk.total - pk.returned))));
            return;
        }
        var grid = el('div', { class: 'vcards' });
        p.verbs.forEach(function (v) {
            var card = el('button', { type: 'button', class: 'card vcard' + (current.item === 'verb/' + v.name ? ' on' : '') });
            add(card, el('b', { class: 'mono' }, v.name), el('span', { class: 'soft' }, v.answers), el('span', { class: 'mono muted' }, v.cli), v.mcp ? el('span', { class: 'mono muted' }, 'MCP ' + v.mcp) : null);
            card.addEventListener('click', function () { avPick('agent', 'verb/' + v.name); });
            grid.appendChild(card);
        });
        main.appendChild(grid);
    }
};
