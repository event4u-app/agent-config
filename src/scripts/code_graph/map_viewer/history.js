/*
 * History: since when a file, a table, a column or a route exists and for which
 * pull request and ticket, from `model.provenance` — keys, numbers, dates and
 * author names only. The ticket's and the PR's text stay in their tracker.
 */
extendStrings({
    en: {
        hHistory: 'History', hIntroduced: 'introduced', hLast: 'last changed', hChanges: 'changes', hUnknown: 'unknown — older than the history read',
        hWhy: 'Ticket and PR text stays in its tracker; ask it for the why.', hTicket: 'Ticket', hPr: 'Pull request',
        hBuilt: function (f, r) { return f + (f === '1' ? ' file' : ' files') + ' · ' + r + (r === '1' ? ' route' : ' routes'); },
        hRoutesHere: 'Routes declared here'
    },
    de: {
        hHistory: 'Historie', hIntroduced: 'eingeführt', hLast: 'zuletzt geändert', hChanges: 'Änderungen', hUnknown: 'unbekannt — älter als die gelesene Historie',
        hWhy: 'Ticket- und PR-Text bleibt im Tracker; dort nach dem Warum fragen.', hTicket: 'Ticket', hPr: 'Pull Request',
        hBuilt: function (f, r) { return f + (f === '1' ? ' Datei' : ' Dateien') + ' · ' + r + (r === '1' ? ' Route' : ' Routen'); },
        hRoutesHere: 'Hier deklarierte Routen'
    }
});

function provCommit(i) {
    var pv = model.provenance;
    var c = pv && i >= 0 ? pv.commits[i] : null;
    return c ? { sha: c[0], date: c[1], author: c[2], pr: c[3], tickets: c[4] } : null;
}
function commitText(c) {
    return c.date + ' · ' + c.sha.slice(0, 8) + (c.pr ? ' · ' + c.pr : '') + (c.tickets.length ? ' · ' + c.tickets.join(', ') : '') + ' · ' + c.author;
}
/** The History section for a file, or for a route when its label is given; null when the map holds none. */
function historySection(filePath, routeLabel) {
    var pv = model.provenance;
    if (!pv) return null;
    var r = routeLabel ? pv.routes[routeLabel] : null;
    var f = filePath ? pv.files[filePath] : null;
    if (!r && !f) return null;
    var rec = r || f;
    var sec = add(el('section', { class: 'sec hist' }), add(el('div', { class: 'sec-h' }), el('span', null, t('hHistory'))));
    var intro = provCommit(rec[0]);
    var last = provCommit(rec[1]);
    var rows = [[t('hIntroduced'), intro ? commitText(intro) : t('hUnknown')], [t('hLast'), last ? commitText(last) : '–']];
    if (!r && f) rows.push([t('hChanges'), String(f[2])]);
    sec.appendChild(kvGrid(rows));
    var refs = [];
    [intro, last].forEach(function (c) {
        if (!c) return;
        c.tickets.forEach(function (k) { if (refs.indexOf(k) < 0) refs.push(k); });
        if (c.pr && refs.indexOf(c.pr) < 0) refs.push(c.pr);
    });
    if (refs.length) {
        var chips = el('div', { class: 'chips' });
        refs.forEach(function (k) { chips.appendChild(el('span', { class: 'c-cyan mono' }, k)); });
        sec.appendChild(chips);
    }
    if (!r && filePath) {
        var here = Object.keys(pv.routes).filter(function (k) { return pv.routes[k][2] === filePath; }).sort();
        if (here.length) {
            sec.appendChild(el('span', { class: 'cap' }, t('hRoutesHere') + ' (' + here.length + ')'));
            sec.appendChild(kvGrid(here.map(function (k) { var c = provCommit(pv.routes[k][0]); return [k, c ? commitText(c) : t('hUnknown')]; })));
        }
    }
    sec.appendChild(el('span', { class: 'note-line' }, t('hWhy') + (pv.gap ? ' · ' + pv.gap : '')));
    return sec;
}
/** Files and routes whose introducing commit is one of `ids`. */
function introducedBy(ids) {
    var pv = model.provenance;
    var set = Object.create(null);
    ids.forEach(function (i) { set[i] = 1; });
    var out = { files: [], routes: [] };
    Object.keys(pv.files).forEach(function (p) { if (set[pv.files[p][0]]) out.files.push(p); });
    Object.keys(pv.routes).forEach(function (r) { if (set[pv.routes[r][0]]) out.routes.push(r); });
    return out;
}
var histFileIndex = null;
function histFileAt(p) {
    if (!histFileIndex) { histFileIndex = Object.create(null); files.forEach(function (f, i) { histFileIndex[f.path] = i; }); }
    return histFileIndex[p] === undefined ? -1 : histFileIndex[p];
}
/** Search hits for a ticket key or a PR number: what it introduced, one level down. */
function historyHits(q, push) {
    var pv = model.provenance;
    if (!pv) return;
    [['ticket', pv.tickets], ['pr', pv.prs]].forEach(function (g) {
        Object.keys(g[1]).forEach(function (key) {
            if (key.toLowerCase().indexOf(q) < 0) return;
            var built = introducedBy(g[1][key]);
            var kids = built.files.map(function (p) {
                var i = histFileAt(p);
                return { kind: 'file', text: p, fn: function () { if (i >= 0) { go('code'); openFile(i); } } };
            }).concat(built.routes.map(function (r) {
                var rp = ((an && an.requestPaths) || []).filter(function (x) { return x.route === r; })[0];
                return { kind: 'route', text: '↳ ' + r, fn: function () { if (rp) { go('code'); openFile(rp.handler >= 0 ? rp.handler : rp.file); } } };
            }));
            push({ kind: g[0], text: (g[0] === 'ticket' ? t('hTicket') : t('hPr')) + ' · ' + key + ' — ' + t('hBuilt')(num(built.files.length), num(built.routes.length)),
                fn: function () { if (kids[0]) kids[0].fn(); }, count: kids.length, crumb: key, kids: kids.length ? function () { return kids; } : null });
        });
    });
}
