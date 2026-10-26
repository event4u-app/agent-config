/*
 * The shell: header (commit, freshness, area nav, search over every kind,
 * export, theme, language), the freshness banner, and the hash router that
 * shows one area at a time — `#/overview`, `#/code`, `#/data/<item>` …
 * An empty or unknown hash opens Code, the area with the most facts.
 */
extendStrings({
    en: {
        kindNames: { file: 'Files', symbol: 'Symbols', route: 'Routes', area: 'Code areas', table: 'Tables', column: 'Columns', fk: 'Foreign keys', rel: 'ORM relations',
            service: 'Services', operation: 'Operations', resource: 'Resources', workflow: 'Workflows', job: 'Jobs', chain: 'Build / deploy', affected: 'Affected', risk: 'Risk terms',
            verb: 'Verbs', pack: 'Context pack', finding: 'Findings' },
        allKinds: 'All kinds', kindsLabel: 'Kinds', generation: function (g) { return 'Generation ' + g; }, noHits: 'Nothing found.'
    },
    de: {
        kindNames: { file: 'Dateien', symbol: 'Symbole', route: 'Routen', area: 'Code-Areas', table: 'Tabellen', column: 'Spalten', fk: 'Fremdschlüssel', rel: 'ORM-Beziehungen',
            service: 'Dienste', operation: 'Operationen', resource: 'Ressourcen', workflow: 'Workflows', job: 'Jobs', chain: 'Build / Deploy', affected: 'Betroffen', risk: 'Risiko-Terme',
            verb: 'Verben', pack: 'Context-Pack', finding: 'Befunde' },
        allKinds: 'Alle Arten', kindsLabel: 'Arten', generation: function (g) { return 'Generation ' + g; }, noHits: 'Nichts gefunden.'
    }
});

var ROUTES = ['overview', 'code'].concat(KNOWLEDGE_IDS);
var current = { route: 'code', item: '' };

function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var cut = h.indexOf('/');
    var route = cut < 0 ? h : h.slice(0, cut);
    var item = '';
    if (cut >= 0) { try { item = decodeURIComponent(h.slice(cut + 1)); } catch (e) { item = ''; } }
    if (ROUTES.indexOf(route) < 0) return { route: 'code', item: '' };
    return { route: route, item: item };
}
function go(route, item) {
    var target = '#/' + route + (item ? '/' + encodeURIComponent(item) : '');
    if (location.hash === target) renderRoute(); else location.hash = target;
}

function renderHeader() {
    var pin = model.pin || { commit: meta.commit, freshness: meta.state, generation: meta.graph_generation || '' };
    var commit = $('pin-commit');
    clear(commit);
    add(commit, document.createTextNode(pin.commit), pin.date ? el('span', { class: 'pin-date' }, ' · ' + pin.date) : null);
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
/** Shown on every area while the graph is not level with HEAD, with the reason and what to do. */
function renderBanner() {
    var b = $('banner');
    clear(b);
    var st = String((model.pin && model.pin.freshness) || meta.state || '');
    if (st === 'fresh') { b.hidden = true; return; }
    var m = /^behind:(\d+)$/.exec(st);
    var key = m ? 'behind' : st === 'edited' ? 'edited' : st === 'absent' || !st ? 'absent' : 'other';
    var title = key === 'behind' ? t('bannerStale').behind(m[1]) : key === 'other' ? t('bannerStale').other(st) : t('bannerStale')[key];
    add(b, stChip(t('bannerLabel') + ' · ' + (st || 'absent'), key === 'absent' ? 'dash' : 'warn'), el('b', null, title), el('span', { class: 'soft' }, t('bannerWhy')[key]));
    b.hidden = false;
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
        $('av-body').classList.add('no-side');
        renderOverview();
        applyAvPanes();
        return;
    }
    $('av-bar').hidden = false;
    renderAreaPage(r, current.item);
}
function onHash() {
    var next = parseHash();
    if (next.route !== current.route) avState.fly = false;
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
    KNOWLEDGE_IDS.forEach(function (id) {
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
    if (current.route !== 'code' && avState.fly) { avState.fly = false; applyAvPanes(); }
});

$('av-open').addEventListener('click', function () { avState.fly = true; applyAvPanes(); });
$('av-close').addEventListener('click', function () { avState.fly = false; applyAvPanes(); });
$('av-scrim').addEventListener('click', function () { avState.fly = false; applyAvPanes(); });
$('av-pin').addEventListener('click', function () {
    var mode = paneMode();
    var pinned = mode !== 'phone' && (avState.pin !== null ? avState.pin : mode === 'wide');
    avState.pin = !pinned;
    avState.fly = false;
    applyAvPanes();
});
window.addEventListener('resize', function () { if (current.route !== 'code') applyAvPanes(); });

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
