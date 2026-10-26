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
        kindNames: { file: 'Files', symbol: 'Symbols', route: 'Routes', area: 'Code areas', table: 'Tables', column: 'Columns', fk: 'Foreign keys', rel: 'ORM relations',
            service: 'Services', operation: 'Operations', resource: 'Resources', workflow: 'Workflows', job: 'Jobs', chain: 'Build / deploy', affected: 'Affected', risk: 'Risk terms',
            verb: 'Verbs', pack: 'Context pack', finding: 'Findings' },
        allKinds: 'All kinds', kindsLabel: 'Kinds', generation: function (g) { return 'Generation ' + g; }, noHits: 'Nothing found.',
        hubChip: 'HUB · this machine only', hubChipT: 'Never committed, never inside a repository map', hubCount: function (i, n) { return i + ' of ' + n + ' indexed'; }
    },
    de: {
        kindNames: { file: 'Dateien', symbol: 'Symbole', route: 'Routen', area: 'Code-Areas', table: 'Tabellen', column: 'Spalten', fk: 'Fremdschlüssel', rel: 'ORM-Beziehungen',
            service: 'Dienste', operation: 'Operationen', resource: 'Ressourcen', workflow: 'Workflows', job: 'Jobs', chain: 'Build / Deploy', affected: 'Betroffen', risk: 'Risiko-Terme',
            verb: 'Verben', pack: 'Context-Pack', finding: 'Befunde' },
        allKinds: 'Alle Arten', kindsLabel: 'Arten', generation: function (g) { return 'Generation ' + g; }, noHits: 'Nichts gefunden.',
        hubChip: 'HUB · nur dieser Rechner', hubChipT: 'Nie committet, nie in einer Projekt-Map', hubCount: function (i, n) { return i + ' von ' + n + ' indiziert'; }
    }
});

var SHELL = data.shell || {};
var ROUTES = SHELL.routes || ['overview', 'code'].concat(KNOWLEDGE_IDS);
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
    if (SHELL.hub) {
        $('pin-commit').textContent = t('hubChip');
        $('pin-commit').setAttribute('title', t('hubChipT'));
        $('pin-fresh').textContent = t('hubCount')(num(SHELL.hub.indexed), num(SHELL.hub.projects));
        $('pin-fresh').className = 'chip fresh';
        return;
    }
    var pin = model.pin || { commit: meta.commit, freshness: meta.state, generation: meta.graph_generation || '' };
    var commit = $('pin-commit');
    clear(commit);
    add(commit, document.createTextNode(shortCommit(pin.commit)), pin.date ? el('span', { class: 'pin-date' }, ' · ' + shortDate(pin.date, true)) : null);
    commit.setAttribute('title', t('generation')(String(pin.generation || '').slice(0, 8)));
    var fresh = $('pin-fresh');
    var st = String(pin.freshness || meta.state || '');
    fresh.textContent = st === 'fresh' ? 'FRESH' : st.toUpperCase();
    fresh.className = 'chip ' + (st === 'fresh' ? 'fresh' : 'stale');
}
function renderNav() {
    var links = $('areanav').querySelectorAll('a[data-route]');
    $('areanav').setAttribute('aria-label', t('navLabel'));
    Array.prototype.forEach.call(links, function (a) {
        var r = a.getAttribute('data-route');
        a.textContent = t('areaNames')[r];
        if (r === current.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        var p = KA[r];
        a.classList.toggle('empty', r !== 'overview' && r !== 'code' && (!p || !!p.empty));
    });
    // On a narrow window the nav scrolls sideways: keep the open area in view without scrolling the page.
    var nav = $('areanav');
    var on = nav.querySelector('a[aria-current]');
    if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, on.offsetLeft - nav.offsetLeft - 8);
}
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
    if (code) { refresh(); resize(); return; }
    var overview = r === 'overview';
    $('av-main').className = 'av-main' + (overview ? ' ov' : '');
    if (overview) {
        clear($('av-bar'));
        clear($('av-main'));
        $('av-bar').hidden = true;
        $('av-body').classList.add('no-side', 'no-left');
        $('av-body').classList.remove('paged');
        $('av-body').appendChild($('av-open-left'));
        $('av-body').appendChild($('av-open'));
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
var searchKind = 'all';
var SEARCH_CAP = 30;
function runSearch() {
    var kinds = $('kinds');
    clear(results);
    clear(kinds);
    var q = searchInput.value.trim().toLowerCase();
    $('pop').hidden = q.length < 2;
    if (q.length < 2) return;
    var hits = [];
    function hit(kind, text, fn) { if (hits.length < 2000) hits.push({ kind: kind, text: text, fn: fn }); }
    codeSearchHits(q, function (kind, text, fn) { hit(kind, text, function () { go('code'); fn(); }); });
    ROUTES.filter(function (r) { return !!AREA_MODULES[r]; }).forEach(function (id) {
        areaItems(id).forEach(function (it) {
            if (it.label.toLowerCase().indexOf(q) < 0 && String(it.sub || '').toLowerCase().indexOf(q) < 0) return;
            hit(it.key.split('/')[0], t('areaNames')[id] + ' · ' + it.label, function () { avPick(id, it.key); });
        });
    });
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
    var shown = hits.filter(function (h) { return searchKind === 'all' || h.kind === searchKind; }).slice(0, SEARCH_CAP);
    shown.forEach(function (h) {
        var b = el('button', { type: 'button', title: t('kindNames')[h.kind] || h.kind }, h.text);
        b.addEventListener('click', function () { closeSearch(); h.fn(); });
        results.appendChild(add(el('li'), b));
    });
    if (!shown.length) kinds.appendChild(el('span', { class: 'muted' }, t('noHits')));
}
function closeSearch() { searchInput.value = ''; clear(results); clear($('kinds')); $('pop').hidden = true; }
searchInput.addEventListener('input', runSearch);
document.addEventListener('pointerdown', function (e) { if (!$('pop').hidden && !e.target.closest('.search')) $('pop').hidden = true; });
searchInput.addEventListener('focus', function () { if (searchInput.value.trim().length >= 2) runSearch(); });

document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); return; }
    if (e.key !== 'Escape') return;
    if (document.activeElement === searchInput && searchInput.value) { closeSearch(); return; }
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
