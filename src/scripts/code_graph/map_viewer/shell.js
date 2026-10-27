/*
 * The shell: header (commit, freshness, area nav, search over every kind,
 * export, theme, language), the freshness banner, and the hash router that
 * shows one area at a time — `#/overview`, `#/code`, `#/data/<item>` …
 * An empty or unknown hash opens the map home, Overview. The hub page sets
 * `data.shell` to its own routes and home (Projects); a project map never has
 * a Projects route.
 */
extendStrings({
    en: {
        kindNames: { folder: 'Folders', file: 'Files', symbol: 'Symbols', route: 'Routes', area: 'Code areas', table: 'Tables', column: 'Columns', fk: 'Foreign keys', rel: 'ORM relations',
            service: 'Services', operation: 'Operations', resource: 'Resources', workflow: 'Workflows', job: 'Jobs', chain: 'Build / deploy', affected: 'Affected', risk: 'Risk terms',
            verb: 'Verbs', pack: 'Context pack', finding: 'Findings', ticket: 'Tickets', pr: 'Pull requests', package: 'Packages', runtime: 'Runtimes', domain: 'Domains' },
        allKinds: 'All kinds', kindsLabel: 'Kinds', searchUp: 'up one level', searchEnter: 'Step into (→)',
        searchCount: function (n) { return n + ' hits'; }, searchCountIn: function (n, p) { return n + ' hits in ' + p; }, generation: function (g) { return 'Generation ' + g; }, noHits: 'Nothing found.',
        hubChip: 'HUB · this machine only', hubChipT: 'Never committed, never inside a repository map', hubCount: function (i, n) { return i + ' of ' + n + ' indexed'; },
        demoChip: 'Sample data · Fixture', demoChipT: 'Drawn from the demo fixture, not from a repository of yours',
        builtAt: 'built at', drawnAt: function (c, g) { return 'Map drawn at ' + c + ' · Generation ' + g; },
        snapChip: 'Snapshot · no branch state', snapChipT: 'Committed map: branch state not included (D17). Locally: code-graph map --branches'
    },
    de: {
        kindNames: { folder: 'Ordner', file: 'Dateien', symbol: 'Symbole', route: 'Routen', area: 'Code-Areas', table: 'Tabellen', column: 'Spalten', fk: 'Fremdschlüssel', rel: 'ORM-Beziehungen',
            service: 'Dienste', operation: 'Operationen', resource: 'Ressourcen', workflow: 'Workflows', job: 'Jobs', chain: 'Build / Deploy', affected: 'Betroffen', risk: 'Risiko-Terme',
            verb: 'Verben', pack: 'Context-Pack', finding: 'Befunde', ticket: 'Tickets', pr: 'Pull Requests', package: 'Pakete', runtime: 'Runtimes', domain: 'Domänen' },
        allKinds: 'Alle Arten', kindsLabel: 'Arten', searchUp: 'eine Ebene hoch', searchEnter: 'Hineingehen (→)',
        searchCount: function (n) { return n + ' Treffer'; }, searchCountIn: function (n, p) { return n + ' Treffer in ' + p; }, generation: function (g) { return 'Generation ' + g; }, noHits: 'Nichts gefunden.',
        hubChip: 'HUB · nur dieser Rechner', hubChipT: 'Nie committet, nie in einer Projekt-Map', hubCount: function (i, n) { return i + ' von ' + n + ' indiziert'; },
        demoChip: 'Beispieldaten · Fixture', demoChipT: 'Aus der Demo-Fixture gezeichnet, nicht aus einem deiner Repositories',
        builtAt: 'gebaut bei', drawnAt: function (c, g) { return 'Map gezeichnet bei ' + c + ' · Generation ' + g; },
        snapChip: 'Snapshot · ohne Branch-Stand', snapChipT: 'Committete Map: Branch-Zustand nicht enthalten (D17). Lokal: code-graph map --branches'
    }
});

var SHELL = data.shell || {};
var ROUTES = SHELL.routes || NAV_ROUTES;
var HOME = SHELL.home || 'overview';
var current = { route: HOME, item: '' };

function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var cut = h.indexOf('/');
    var route = cut < 0 ? h : h.slice(0, cut);
    var item = '';
    if (cut >= 0) { try { item = decodeURIComponent(h.slice(cut + 1)); } catch (e) { item = ''; } }
    if (ROUTES.indexOf(route) < 0) return { route: HOME, item: '' };
    return { route: route, item: item };
}
function go(route, item) {
    var target = '#/' + route + (item ? '/' + encodeURIComponent(item) : '');
    if (location.hash === target) renderRoute(); else location.hash = target;
}

function renderHeader() {
    var demo = $('pin-demo');
    if (demo) { demo.textContent = t('demoChip'); demo.setAttribute('title', t('demoChipT')); }
    if (SHELL.hub) {
        $('pin-commit').textContent = t('hubChip');
        $('pin-commit').setAttribute('title', t('hubChipT'));
        $('pin-fresh').textContent = t('hubCount')(num(SHELL.hub.indexed), num(SHELL.hub.projects));
        $('pin-fresh').className = 'chip fresh';
        if (typeof hubHeader === 'function') hubHeader();
        return;
    }
    var pin = model.pin || { commit: meta.commit, freshness: meta.state, generation: meta.graph_generation || '' };
    var commit = $('pin-commit');
    clear(commit);
    add(commit, document.createTextNode(t('builtAt') + ' ' + shortCommit(pin.commit)), pin.date ? el('span', { class: 'pin-date' }, ' · ' + shortDate(pin.date, true)) : null);
    commit.setAttribute('title', t('drawnAt')(String(pin.commit || '').slice(0, 12), String(pin.generation || '').slice(0, 16)));
    // The state as built (Decision D4): a static file cannot know how far HEAD moved since.
    var fresh = $('pin-fresh');
    var st = String(pin.freshness || meta.state || '');
    fresh.textContent = st.toLowerCase();
    fresh.className = 'chip ' + (st === 'fresh' ? 'fresh' : 'stale');
    var snap = $('pin-snap');
    snap.hidden = !!model.branches;
    snap.textContent = t('snapChip');
    snap.setAttribute('title', t('snapChipT'));
}
function renderNav() {
    var links = $('areanav').querySelectorAll('a[data-route]');
    $('areanav').setAttribute('aria-label', t('navLabel'));
    Array.prototype.forEach.call(links, function (a) {
        var r = a.getAttribute('data-route');
        a.textContent = t('areaNames')[r];
        if (r === current.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        var p = KA[r];
        var empty = r !== 'overview' && r !== 'code' && (!p || !!p.empty);
        a.classList.toggle('empty', empty);
        // The handover names why an entry is dim; Bugs is local data, never in a committed map.
        if (empty) a.setAttribute('title', r === 'bugs' ? t('navBugsLocal') : t('navNoData')); else a.removeAttribute('title');
    });
    // On a phone the nav folds into one menu button that names the open area.
    var menu = $('areamenu');
    if (!menu) return;
    menu.textContent = '☰ ' + (t('areaNames')[current.route] || current.route);
    menu.setAttribute('aria-label', t('navLabel') + ': ' + (t('areaNames')[current.route] || current.route));
    setAreaMenu(false);
}
function setAreaMenu(open) {
    if (!$('areamenu')) return;
    $('areamenu').setAttribute('aria-expanded', String(open));
    $('areanav').classList.toggle('open', open);
}
if ($('areamenu')) $('areamenu').addEventListener('click', function () { setAreaMenu($('areamenu').getAttribute('aria-expanded') !== 'true'); });
document.addEventListener('pointerdown', function (e) { if ($('areanav').classList.contains('open') && !e.target.closest('#areanav, #areamenu')) setAreaMenu(false); });
/**
 * While the graph is not level with HEAD the header's freshness chip carries
 * the reason and what to do, as its tooltip: the design draws no banner row.
 */
function renderBanner() {
    var b = $('banner');
    clear(b);
    b.hidden = true;
    if (SHELL.hub) return;
    var chip = $('pin-fresh');
    var st = String((model.pin && model.pin.freshness) || meta.state || '');
    if (st === 'fresh') { chip.removeAttribute('title'); chip.removeAttribute('aria-label'); return; }
    var m = /^behind:(\d+)$/.exec(st);
    var key = m ? 'behind' : st === 'edited' ? 'edited' : st === 'absent' || !st ? 'absent' : 'other';
    var title = key === 'behind' ? t('bannerStale').behind(m[1]) : key === 'other' ? t('bannerStale').other(st) : t('bannerStale')[key];
    var text = title + ' — ' + t('bannerWhy')[key];
    chip.setAttribute('title', text);
    chip.setAttribute('aria-label', t('bannerLabel') + ': ' + text);
}
function renderRoute() {
    var r = current.route;
    var code = r === 'code';
    if (!code && state.full) { state.full = false; applyPanes(false); }
    $('wb').hidden = !code;
    $('av').hidden = code;
    renderNav();
    renderBanner();
    window.__mapRoute = { route: r, item: current.item };
    // Whatever the last page lent out comes back first, so every page draws from a whole shell.
    releaseShellNodes();
    if (code) { refresh(); resize(); return; }
    var overview = r === 'overview';
    $('av-main').className = 'av-main' + (overview ? ' ov' : '');
    if (overview) {
        clear($('av-bar'));
        clear($('av-main'));
        $('av-bar').hidden = true;
        $('av-body').classList.add('no-side', 'no-left');
        $('av-body').classList.remove('paged');
        renderOverview();
        applyAvPanes();
        return;
    }
    $('av-bar').hidden = false;
    renderAreaPage(r, current.item);
}
function onHash() {
    var next = parseHash();
    if (next.route !== current.route) { avState.fly = false; avState.flyL = false; }
    current = next;
    renderRoute();
}

// Search over every kind the map holds; the presets above the hits only narrow the kind.
// The list is an ARIA combobox: the arrow keys move one active row that the
// pointer shares, → steps into a hit that holds others, ← and Backspace on an
// empty query step back out.
var searchKind = 'all';
var SEARCH_CAP = 30;
var SEARCH_PAGE = 8;
var searchStack = [];
var searchShown = [];
var searchActive = -1;

/** What an area item holds, as hits one level down; null for a leaf. */
function areaItemKids(id, it) {
    var all = areaItems(id);
    var kids = null;
    if (it.kind === 'table') kids = all.filter(function (x) { return x.key.indexOf('column/' + it.label + '.') === 0; });
    else if (it.key.indexOf('service/') === 0) kids = all.filter(function (x) { return x.kind === 'operation' && x.label.indexOf(it.label + ' · ') === 0; });
    else if (it.kind === 'workflow') kids = all.filter(function (x) { return x.kind === 'job' && x.sub === it.sub; });
    else if (it.kind === 'project') kids = all.filter(function (x) { return x.key.indexOf('edge/') === 0 && x.label.indexOf(it.label) >= 0; });
    if (!kids || !kids.length) return null;
    return kids.map(function (k) { return areaItemHit(id, k, k.label); });
}
function areaItemHit(id, it, text) {
    var kids = areaItemKids(id, it);
    return { kind: it.key.split('/')[0], text: text, fn: function () { avPick(id, it.key); }, count: kids ? kids.length : null, crumb: it.label, kids: kids ? function () { return kids; } : null };
}
function rootHits(q) {
    var hits = [];
    function hit(kind, text, fn, extra) {
        if (hits.length >= 2000) return;
        var h = { kind: kind, text: text, fn: function () { go('code'); fn(); } };
        if (extra) { h.count = extra.count; h.crumb = extra.crumb; h.kids = extra.kids; }
        hits.push(h);
    }
    codeSearchHits(q, hit);
    historyHits(q, function (h) { if (hits.length < 2000) hits.push(h); });
    domainHits(q, function (h) { if (hits.length < 2000) hits.push(h); });
    ROUTES.filter(function (r) { return !!AREA_MODULES[r]; }).forEach(function (id) {
        areaItems(id).forEach(function (it) {
            if (hits.length >= 2000) return;
            if (it.label.toLowerCase().indexOf(q) < 0 && String(it.sub || '').toLowerCase().indexOf(q) < 0) return;
            hits.push(areaItemHit(id, it, t('areaNames')[id] + ' · ' + it.label));
        });
    });
    return hits;
}
function searchOpen(open) {
    $('pop').hidden = !open;
    searchInput.setAttribute('aria-expanded', String(open));
    if (!open) { searchInput.removeAttribute('aria-activedescendant'); searchActive = -1; }
}
function setActive(i) {
    var rows = results.querySelectorAll('[role="option"]');
    if (!rows.length) { searchActive = -1; searchInput.removeAttribute('aria-activedescendant'); return; }
    searchActive = i < -1 ? rows.length - 1 : (i + rows.length) % rows.length;
    Array.prototype.forEach.call(rows, function (r, k) { r.setAttribute('aria-selected', String(k === searchActive)); });
    var row = rows[searchActive];
    searchInput.setAttribute('aria-activedescendant', row.id);
    if (row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
}
function runSearch(keep) {
    var kinds = $('kinds');
    clear(results);
    clear(kinds);
    var crumbRow = $('searchcrumb');
    clear(crumbRow);
    var q = searchInput.value.trim().toLowerCase();
    var level = searchStack[searchStack.length - 1];
    if (!level && q.length < 2) { searchShown = []; searchOpen(false); $('search-live').textContent = ''; return; }
    var hits = level ? level.kids().filter(function (h) { return !q || h.text.toLowerCase().indexOf(q) >= 0; }) : rootHits(q);
    if (level) {
        crumbRow.hidden = false;
        var up = el('button', { type: 'button', class: 'scrumb-up' }, '← ' + t('searchUp'));
        up.addEventListener('mousedown', function (e) { e.preventDefault(); });
        up.addEventListener('click', function () { searchLeave(); });
        add(crumbRow, up, el('span', { class: 'mono' }, searchStack.map(function (l) { return l.crumb; }).join(' › ') + ' ›'));
    } else crumbRow.hidden = true;
    var counts = Object.create(null);
    var order = [];
    hits.forEach(function (h) { if (!counts[h.kind]) { counts[h.kind] = 0; order.push(h.kind); } counts[h.kind] += 1; });
    if (searchKind !== 'all' && !counts[searchKind]) searchKind = 'all';
    if (order.length > 1) {
        kinds.setAttribute('aria-label', t('kindsLabel'));
        ['all'].concat(order).forEach(function (k) {
            var b = el('button', { type: 'button', class: 'kind', 'aria-pressed': String(searchKind === k) }, (k === 'all' ? t('allKinds') + ' ' + num(hits.length) : (t('kindNames')[k] || k) + ' ' + num(counts[k])));
            // A preset keeps the box focused and the query typed: it changes the kind filter and nothing else.
            b.addEventListener('mousedown', function (e) { e.preventDefault(); });
            b.addEventListener('click', function () { searchKind = k; runSearch(); searchInput.focus(); });
            kinds.appendChild(b);
        });
    }
    var matching = hits.filter(function (h) { return searchKind === 'all' || h.kind === searchKind; });
    searchShown = matching.slice(0, SEARCH_CAP);
    searchShown.forEach(function (h, i) {
        var li = el('li', { role: 'option', id: 'sr-' + i, class: 'srow' + (h.kids ? ' holds' : ''), 'aria-selected': 'false' });
        var b = el('button', { type: 'button', tabindex: '-1', title: t('kindNames')[h.kind] || h.kind }, h.text);
        li.appendChild(b);
        if (h.kids) add(li, el('span', { class: 'scount mono', 'aria-hidden': 'true' }, h.count != null ? num(h.count) : ''), el('span', { class: 'schev', 'aria-hidden': 'true', title: t('searchEnter') }, '›'));
        li.addEventListener('mousedown', function (e) { e.preventDefault(); });
        li.addEventListener('mousemove', function () { if (searchActive !== i) setActive(i); });
        li.addEventListener('click', function (e) {
            if (h.kids && e.target.classList.contains('schev')) { searchEnter(i); return; }
            searchPick(i, false);
        });
        results.appendChild(li);
    });
    if (!searchShown.length) kinds.appendChild(el('span', { class: 'muted' }, t('noHits')));
    $('search-live').textContent = level ? t('searchCountIn')(num(matching.length), searchStack.map(function (l) { return l.crumb; }).join('/')) : t('searchCount')(num(matching.length));
    searchOpen(true);
    // No row is active until the reader moves; stepping back out re-activates the container left.
    searchActive = -1;
    searchInput.removeAttribute('aria-activedescendant');
    if (keep != null && searchShown.length) setActive(Math.min(keep, searchShown.length - 1));
}
function searchPick(i, stay) {
    var h = searchShown[i];
    if (!h) return;
    if (!stay) closeSearch();
    h.fn();
    if (stay) searchInput.focus();
}
function searchEnter(i) {
    var h = searchShown[i];
    if (!h || !h.kids) return;
    searchStack.push({ crumb: h.crumb || h.text, kids: h.kids, query: searchInput.value, index: i, kind: searchKind });
    searchKind = 'all';
    searchInput.value = '';
    runSearch();
}
function searchLeave() {
    var level = searchStack.pop();
    if (!level) return;
    searchInput.value = level.query;
    searchKind = level.kind;
    runSearch(level.index);
    searchInput.focus();
}
function closeSearch() { searchInput.value = ''; searchStack = []; searchShown = []; clear(results); clear($('kinds')); clear($('searchcrumb')); $('searchcrumb').hidden = true; searchOpen(false); }
searchInput.setAttribute('role', 'combobox');
searchInput.setAttribute('aria-autocomplete', 'list');
searchInput.setAttribute('aria-controls', 'results');
searchInput.setAttribute('aria-expanded', 'false');
results.setAttribute('role', 'listbox');
searchInput.addEventListener('input', function () { runSearch(); });
searchInput.addEventListener('keydown', function (e) {
    var open = !$('pop').hidden && searchShown.length > 0;
    var atStart = searchInput.selectionStart === 0 && searchInput.selectionEnd === 0;
    var atEnd = searchInput.selectionStart === searchInput.value.length && searchInput.selectionEnd === searchInput.value.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if ($('pop').hidden) { runSearch(); return; }
        if (open) setActive(searchActive < 0 && e.key === 'ArrowUp' ? -2 : searchActive + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (open && (e.key === 'PageDown' || e.key === 'PageUp')) {
        e.preventDefault();
        setActive(Math.max(0, Math.min(searchShown.length - 1, searchActive + (e.key === 'PageDown' ? SEARCH_PAGE : -SEARCH_PAGE))));
    } else if (open && (e.key === 'Home' || e.key === 'End')) {
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : searchShown.length - 1);
    } else if (e.key === 'Enter') {
        if (!open) return;
        e.preventDefault();
        searchPick(searchActive < 0 ? 0 : searchActive, e.metaKey || e.ctrlKey);
    } else if (e.key === 'ArrowRight') {
        if (!open || !atEnd || searchActive < 0 || !searchShown[searchActive].kids) return;
        e.preventDefault();
        searchEnter(searchActive);
    } else if (e.key === 'ArrowLeft') {
        if (!searchStack.length || !(atStart || !searchInput.value)) return;
        e.preventDefault();
        searchLeave();
    } else if (e.key === 'Backspace') {
        if (searchInput.value || !searchStack.length) return;
        e.preventDefault();
        searchLeave();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!$('pop').hidden) searchOpen(false); else closeSearch();
    }
});
document.addEventListener('pointerdown', function (e) { if (!$('pop').hidden && !e.target.closest('.search')) searchOpen(false); });
searchInput.addEventListener('focus', function () { if (searchStack.length || searchInput.value.trim().length >= 2) runSearch(); });

document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); return; }
    if (e.key !== 'Escape') return;
    if ($('areamenu') && $('areanav').classList.contains('open')) { setAreaMenu(false); $('areamenu').focus(); return; }
    if (current.route !== 'code' && (avState.fly || avState.flyL)) { avState.fly = false; avState.flyL = false; applyAvPanes(); }
});

$('av-open').addEventListener('click', function () { avFly('right', true); });
$('av-open-left').addEventListener('click', function () { avFly('left', true); });
$('av-close').addEventListener('click', function () { avFly('right', false); });
$('av-close-left').addEventListener('click', function () { avFly('left', false); });
$('av-scrim').addEventListener('click', function () { avState.fly = false; avState.flyL = false; applyAvPanes(); });
function avTogglePin(side) {
    var pinned = isAvPinned(side);
    if (side === 'left') { avState.pinL = !pinned; avState.flyL = false; } else { avState.pin = !pinned; avState.fly = false; }
    applyAvPanes();
    avRailButtons();
}
$('av-pin').addEventListener('click', function () { avTogglePin('right'); });
$('av-pin-left').addEventListener('click', function () { avTogglePin('left'); });
window.addEventListener('resize', function () { if (current.route !== 'code') { applyAvPanes(); avRailButtons(); } });

$('export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = el('a', { download: 'map.json' });
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
});

var theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
function applyTheme() {
    document.documentElement.dataset.resolvedTheme = theme;
    colourCache = Object.create(null);
    var b = $('theme');
    var label = theme === 'light' ? t('dark') : t('light');
    b.setAttribute('aria-label', label);
    b.setAttribute('title', label);
    $('theme-sun').hidden = theme === 'light';
    $('theme-moon').hidden = theme !== 'light';
}
function applyStrings() {
    document.documentElement.lang = lang;
    searchInput.setAttribute('placeholder', t('search'));
    searchInput.setAttribute('aria-label', t('search'));
    $('export').textContent = t('exportBtn');
    $('lang').textContent = t('langBtn');
    applyCodeStrings();
    renderHeader();
    applyTheme();
}
$('theme').addEventListener('click', function () { theme = theme === 'light' ? 'dark' : 'light'; applyTheme(); renderRoute(); });
$('lang').addEventListener('click', function () { lang = lang === 'de' ? 'en' : 'de'; applyStrings(); renderRoute(); if (searchInput.value) runSearch(); });
window.addEventListener('hashchange', onHash);

window.__mapStrings = STR;
applyStrings();
onHash();
