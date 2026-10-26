/*
 * Systems — what the project runs: runtimes with every witness side by side,
 * frameworks and packages in their locked versions, why each package is
 * installed, the files that use it and its uses without an import. A share of a
 * package's surface is never shown here: it needs the installed files, which
 * `code-graph usage` reads on demand.
 */
extendStrings({
    en: {
        sPackages: 'Packages', sRuntimes: 'Runtimes', sFindings: 'Findings',
        sName: 'Package', sVersion: 'Version', sEco: 'Ecosystem', sScope: 'Scope', sWhy: 'Installed because', sUsed: 'Used by', sNonimport: 'Uses without import',
        sDirect: 'declared', sTransitive: 'transitive', sDev: 'dev', sProd: 'prod', sFramework: 'framework', sUnlocked: 'not locked',
        sDeclared: 'Declared', sRequiredBy: 'Required by', sRequires: 'Requires', sFiles: function (n) { return n + (n === '1' ? ' file' : ' files'); },
        sRuntime: 'Runtime', sWitness: 'Witness', sKind: 'Source', sValue: 'Value', sDisagree: 'witnesses disagree', sAgree: 'consistent',
        sMeta: function (r, f, p) { return r + ' runtimes · ' + f + ' frameworks · ' + p + ' packages'; },
        sNoUse: 'no file imports it', sUsageHint: 'share of its surface: `code-graph usage <package>` with the package installed',
        sRemoveHint: 'what removing it touches: `code-graph remove-plan <package>`', sMore: function (n) { return '+ ' + n + ' more files'; }
    },
    de: {
        sPackages: 'Pakete', sRuntimes: 'Runtimes', sFindings: 'Befunde',
        sName: 'Paket', sVersion: 'Version', sEco: 'Ökosystem', sScope: 'Scope', sWhy: 'Installiert wegen', sUsed: 'Genutzt von', sNonimport: 'Nutzung ohne Import',
        sDirect: 'deklariert', sTransitive: 'transitiv', sDev: 'dev', sProd: 'prod', sFramework: 'Framework', sUnlocked: 'nicht gelockt',
        sDeclared: 'Deklariert', sRequiredBy: 'Benötigt von', sRequires: 'Benötigt', sFiles: function (n) { return n + (n === '1' ? ' Datei' : ' Dateien'); },
        sRuntime: 'Runtime', sWitness: 'Nachweis', sKind: 'Quelle', sValue: 'Wert', sDisagree: 'Nachweise widersprechen sich', sAgree: 'stimmig',
        sMeta: function (r, f, p) { return r + ' Runtimes · ' + f + ' Frameworks · ' + p + ' Pakete'; },
        sNoUse: 'keine Datei importiert es', sUsageHint: 'Anteil an seiner Oberfläche: `code-graph usage <Paket>` mit installiertem Paket',
        sRemoveHint: 'was ein Entfernen berührt: `code-graph remove-plan <Paket>`', sMore: function (n) { return '+ ' + n + ' weitere Dateien'; }
    }
});

if (!avState.view.systems) avState.view.systems = 'packages';

function syLabel(k) { return k.name + '@' + k.version; }
function syScope(k) { return k.dev ? t('sDev') : t('sProd'); }
function syChips(k) {
    var w = el('span', { class: 'chips' });
    if (k.framework) w.appendChild(stChip(t('sFramework'), 'cyan'));
    w.appendChild(stChip(k.direct ? t('sDirect') : t('sTransitive'), k.direct ? 'ok' : 'dash'));
    if (!k.locked) w.appendChild(stChip(t('sUnlocked'), 'warn'));
    return w;
}
function syWhy(k) {
    if (k.direct) return k.declared.length ? k.declared[0] : t('sDirect');
    return k.path.length ? k.path.join(' → ') : '–';
}

function syPackages(p, main) {
    main.appendChild(factTable('systems', [t('sName'), t('sVersion'), t('sEco'), t('sScope'), t('sWhy'), t('sUsed'), t('sNonimport')], p.packages.map(function (k) {
        var name = add(el('span'), el('span', { class: 'mono' }, k.name + ' '), syChips(k));
        return {
            key: 'package/' + syLabel(k),
            cells: [name, k.version, k.ecosystem, syScope(k), el('span', { class: 'mono muted' }, syWhy(k)), k.usedByTotal ? t('sFiles')(num(k.usedByTotal)) : '–', k.nonimport.length ? String(k.nonimport.length) : '–']
        };
    })));
}

function syRuntimes(p, main) {
    var rows = [];
    p.runtimes.forEach(function (r) {
        r.witnesses.forEach(function (w, i) {
            rows.push({
                key: i === 0 ? 'runtime/' + r.name : null,
                cls: r.disagrees ? 'warn' : '',
                cells: [i === 0 ? add(el('span'), el('span', { class: 'mono' }, r.name + ' '), stChip(r.disagrees ? t('sDisagree') : t('sAgree'), r.disagrees ? 'warn' : 'ok')) : '', w.kind, el('span', { class: 'mono' }, w.value), el('span', { class: 'mono muted' }, wloc(w.witness))]
            });
        });
    });
    main.appendChild(factTable('systems', [t('sRuntime'), t('sKind'), t('sValue'), t('sWitness')], rows));
}

function syPackageLinks(p, k) {
    var out = [];
    k.usedBy.forEach(function (u) { out.push([t('sUsed'), dCodeLink(u.file, u.witness.line)]); });
    if (k.usedByTotal > k.usedBy.length) out.push([t('sUsed'), { label: t('sMore')(num(k.usedByTotal - k.usedBy.length)), go: null }]);
    k.requiredBy.forEach(function (r) { out.push([t('sRequiredBy'), { label: r, go: function () { avPick('systems', 'package/' + r); } }]); });
    k.requires.forEach(function (r) { out.push([t('sRequires'), { label: r, go: function () { avPick('systems', 'package/' + r); } }]); });
    return out;
}

AREA_MODULES.systems = {
    tabs: [['packages', 'sPackages'], ['runtimes', 'sRuntimes'], ['findings', 'sFindings']],
    items: function (p) {
        var out = p.packages.map(function (k) {
            var ws = [k.witness].concat(k.usedBy.map(function (u) { return u.witness; }));
            return {
                key: 'package/' + syLabel(k), kind: 'package', label: syLabel(k), sub: k.ecosystem + ' · ' + syScope(k) + (k.framework ? ' · ' + t('sFramework') : ''),
                rows: [[t('sVersion'), k.version], [t('sScope'), syScope(k)], [t('sDeclared'), k.declared.join('\n')], [t('sWhy'), syWhy(k)],
                    [t('sUsed'), k.usedByTotal ? t('sFiles')(num(k.usedByTotal)) : t('sNoUse')], [t('sNonimport'), k.nonimport.join('\n')],
                    [t('cDomain'), (k.domains || []).join(', ')], ['usage', t('sUsageHint')], ['remove-plan', t('sRemoveHint')]],
                witnesses: ws,
                links: function () { return syPackageLinks(p, k); }
            };
        });
        p.runtimes.forEach(function (r) {
            out.push({
                key: 'runtime/' + r.name, kind: 'runtime', label: r.name, sub: r.disagrees ? t('sDisagree') : t('sAgree'),
                rows: r.witnesses.map(function (w) { return [w.kind, w.value + '  ' + wloc(w.witness)]; }),
                witnesses: r.witnesses.map(function (w) { return w.witness; })
            });
        });
        return out;
    },
    meta: function (p) {
        return t('sMeta')(num(p.runtimes.length), num(p.packages.filter(function (k) { return k.framework; }).length), num(p.packages.length));
    },
    render: function (p, view, main) {
        if (view === 'runtimes') syRuntimes(p, main); else syPackages(p, main);
    }
};
