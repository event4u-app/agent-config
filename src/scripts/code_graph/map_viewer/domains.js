/*
 * Domains on the Code page: the declared business boundaries with their files,
 * the crossings between them and the breaches against `domain_allow`, a
 * domain × layer matrix when both exist, and — only when nothing is declared —
 * proposals from the coupling areas, labelled inferred, with a snippet to adopt.
 */
extendStrings({
    en: {
        dmTitle: 'Domains', dmDeclared: 'declared in layers.yaml', dmStructure: 'from the folder structure', dmFiles: function (n) { return n + (n === '1' ? ' file' : ' files'); },
        dmCross: function (n) { return n + ' crossings between domains'; }, dmNoAllow: 'no domain_allow declared: crossings are counted, not judged',
        dmKinds: { domain: 'not allowed', 'domain-public': 'into a non-public part', 'domain-cycle': 'cycle', 'domain-overlap': 'claimed by two domains', 'domain-table': 'table written by two domains' },
        dmProposals: 'Domain proposals · inferred', dmPropNote: 'From coupling areas — never a boundary, never a breach. Adopt by pasting the snippet into agents/map/layers.yaml.',
        dmStable: function (s) { return Math.round(s * 100) + '% of its coupling in the folder'; }, dmCopy: 'Copy snippet', dmMatrix: 'Domain × layer', dmOwner: 'owner'
    },
    de: {
        dmTitle: 'Domänen', dmDeclared: 'deklariert in layers.yaml', dmStructure: 'aus der Ordnerstruktur', dmFiles: function (n) { return n + (n === '1' ? ' Datei' : ' Dateien'); },
        dmCross: function (n) { return n + ' Übergänge zwischen Domänen'; }, dmNoAllow: 'kein domain_allow deklariert: Übergänge werden gezählt, nicht bewertet',
        dmKinds: { domain: 'nicht erlaubt', 'domain-public': 'in einen nicht-öffentlichen Teil', 'domain-cycle': 'Zyklus', 'domain-overlap': 'von zwei Domänen beansprucht', 'domain-table': 'Tabelle von zwei Domänen beschrieben' },
        dmProposals: 'Domänen-Vorschläge · abgeleitet', dmPropNote: 'Aus Kopplungs-Areas — nie eine Grenze, nie ein Verstoß. Übernehmen durch Einfügen des Snippets in agents/map/layers.yaml.',
        dmStable: function (s) { return Math.round(s * 100) + '% der Kopplung im Ordner'; }, dmCopy: 'Snippet kopieren', dmMatrix: 'Domäne × Layer', dmOwner: 'Owner'
    }
});

/** The Domains card, or the proposals card; null when the map has neither. */
function domainCard(findCard, fileLink) {
    var dm = model.domains;
    if (dm) {
        var lines = [el('p', { class: 'muted' }, dm.source === 'declared' ? t('dmDeclared') : t('dmStructure'))];
        dm.list.forEach(function (d) {
            lines.push(add(el('p'), el('span', { class: 'mono' }, d.name + ' '), el('span', { class: 'muted' }, t('dmFiles')(num(d.files)) + (d.owner ? ' · ' + t('dmOwner') + ' ' + d.owner : ''))));
        });
        lines.push(el('p', { class: 'muted' }, t('dmCross')(num(dm.crossings)) + (dm.breaches === null ? ' · ' + t('dmNoAllow') : '')));
        dm.edges.slice(0, 5).forEach(function (e) { lines.push(el('p', { class: 'mono' }, e[0] + ' → ' + e[1] + ' (' + e[2] + ')')); });
        dm.violations.slice(0, 6).forEach(function (v) {
            var what = (t('dmKinds')[v.kind] || v.kind) + ' · ' + v.domains.join(' → ') + (v.table ? ' · ' + v.table : '');
            lines.push(v.files.length ? fileLink(v.files[0], what + ' · ' + base(files[v.files[0]].path) + (v.files[1] !== undefined ? ' → ' + base(files[v.files[1]].path) : '')) : el('p', null, what));
        });
        var layers = Object.create(null);
        files.forEach(function (f) { if (f.domain && f.layer) { var k = f.domain + '\u0000' + f.layer; layers[k] = (layers[k] || 0) + 1; } });
        var keys = Object.keys(layers).sort();
        if (keys.length) {
            lines.push(el('p', { class: 'cap' }, t('dmMatrix')));
            keys.slice(0, 12).forEach(function (k) { var p = k.split('\u0000'); lines.push(el('p', { class: 'mono' }, p[0] + ' × ' + p[1] + ': ' + layers[k])); });
        }
        return findCard(t('dmTitle'), dm.breaches === null ? num(dm.crossings) : num(dm.breaches), dm.breaches ? 'var(--alertText)' : null, lines);
    }
    var pr = model.domainProposals;
    if (!pr) return null;
    var pl = [el('p', { class: 'muted' }, t('dmPropNote'))];
    pr.list.forEach(function (x) { pl.push(add(el('p'), el('span', { class: 'mono' }, x.name + ' '), el('span', { class: 'muted' }, x.globs.join(', ') + ' · ' + t('dmFiles')(num(x.files)) + ' · ' + t('dmStable')(x.cohesion)))); });
    pl.push(rlCopy(t('dmCopy'), pr.snippet));
    return findCard(t('dmProposals'), num(pr.list.length), 'var(--cyanText)', pl, true);
}

/** Search hits for a declared domain, with its files one level down. */
function domainHits(q, push) {
    var dm = model.domains;
    if (!dm) return;
    dm.list.forEach(function (d) {
        if (d.name.toLowerCase().indexOf(q) < 0) return;
        var kids = [];
        files.forEach(function (f, i) { if (f.domain === d.name && kids.length < 500) kids.push({ kind: 'file', text: f.path, fn: function () { go('code'); openFile(i); } }); });
        push({ kind: 'domain', text: t('cDomain') + ' · ' + d.name + ' — ' + t('dmFiles')(num(d.files)), fn: function () { if (kids[0]) kids[0].fn(); }, count: kids.length, crumb: d.name, kids: kids.length ? function () { return kids; } : null });
    });
}
