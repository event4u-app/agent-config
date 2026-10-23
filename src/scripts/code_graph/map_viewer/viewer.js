/*
 * Offline viewer for agents/map/index.html.
 *
 * Reads the map model from the inline `#map-data` JSON block and draws it on a
 * canvas: areas → an area's files → a file's symbols in the side panel. The
 * layout is precomputed by the build, so nothing here simulates physics.
 *
 * Every string from the model reaches the page through textContent, never
 * innerHTML: file paths and symbol names come from the scanned repository.
 */
(function () {
    'use strict';

    var data = JSON.parse(document.getElementById('map-data').textContent);
    var model = data.model;
    var files = model.files;
    var areas = model.areas;

    var STR = {
        en: {
            map: 'Map',
            areas: 'Areas',
            groups: 'Not in an area',
            lensAreas: 'Areas',
            lensFolders: 'Folders',
            folderHint: 'Each file carries the colour of its area: a folder of many colours is one whose layout and coupling disagree.',
            search: 'Search files and areas',
            files: function (n) { return n === 1 ? '1 file' : n + ' files'; },
            role: 'Role',
            area: 'Area',
            usedBy: 'Used by',
            uses: 'Uses',
            symbols: 'Symbols',
            tests: 'Covered by tests',
            externals: 'External dependencies',
            guesses: 'Guessed links',
            state: 'Graph state',
            cohesion: 'Cohesion',
            testShare: 'Test share',
            mismatch: 'Outside the hub folder',
            hub: 'Hub',
            more: function (n) { return '+ ' + n + ' more'; },
            infra: 'Infrastructure',
            guessToggle: 'Guesses',
            testsToggle: 'Tests',
            theme: 'Theme',
            lang: 'Deutsch',
            zoomIn: 'Zoom in',
            zoomOut: 'Zoom out',
            reset: 'Fit',
            none: 'none',
            hint: 'Click an area to open it. Click a file to inspect it. Esc goes back.',
            roles: {
                code: 'code', test: 'test', entry: 'entry point', view: 'view', migration: 'migration',
                translation: 'translation', config: 'config', infra: 'infrastructure', isolated: 'isolated'
            }
        },
        de: {
            map: 'Karte',
            areas: 'Bereiche',
            groups: 'Ohne Bereich',
            lensAreas: 'Bereiche',
            lensFolders: 'Ordner',
            folderHint: 'Jede Datei trägt die Farbe ihres Bereichs: Ein bunter Ordner ist einer, dessen Ablage und Kopplung auseinanderlaufen.',
            search: 'Dateien und Bereiche suchen',
            files: function (n) { return n === 1 ? '1 Datei' : n + ' Dateien'; },
            role: 'Rolle',
            area: 'Bereich',
            usedBy: 'Verwendet von',
            uses: 'Verwendet',
            symbols: 'Symbole',
            tests: 'Abgedeckt durch Tests',
            externals: 'Externe Abhängigkeiten',
            guesses: 'Geratene Verbindungen',
            state: 'Graph-Stand',
            cohesion: 'Zusammenhalt',
            testShare: 'Testanteil',
            mismatch: 'Außerhalb des Hub-Ordners',
            hub: 'Hub',
            more: function (n) { return '+ ' + n + ' weitere'; },
            infra: 'Infrastruktur',
            guessToggle: 'Vermutungen',
            testsToggle: 'Tests',
            theme: 'Design',
            lang: 'English',
            zoomIn: 'Vergrößern',
            zoomOut: 'Verkleinern',
            reset: 'Einpassen',
            none: 'keine',
            hint: 'Bereich anklicken zum Öffnen, Datei anklicken zum Ansehen. Esc geht zurück.',
            roles: {
                code: 'Code', test: 'Test', entry: 'Einstiegspunkt', view: 'View', migration: 'Migration',
                translation: 'Übersetzung', config: 'Konfiguration', infra: 'Infrastruktur', isolated: 'isoliert'
            }
        }
    };
    var lang = (navigator.language || 'en').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
    function t(key) { return STR[lang][key]; }

    // Adjacency, built once.
    var inOf = files.map(function () { return []; });
    var outOf = files.map(function () { return []; });
    model.edges.forEach(function (e) {
        outOf[e[0]].push([e[1], e[2]]);
        inOf[e[1]].push([e[0], e[2]]);
    });
    var byWeight = function (a, b) { return b[1] - a[1] || a[0] - b[0]; };
    inOf.forEach(function (l) { l.sort(byWeight); });
    outOf.forEach(function (l) { l.sort(byWeight); });

    function hue(i) { return Math.round((i * 137.508) % 360); }
    function areaColor(i, alpha) {
        return 'hsla(' + hue(i) + ', 62%, ' + (document.documentElement.dataset.resolvedTheme === 'dark' ? '62%' : '46%') + ', ' + (alpha == null ? 1 : alpha) + ')';
    }
    function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
    function base(p) { var i = p.lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); }
    function areaLabel(a) {
        return a.kind === 'small-parts' ? '… ' + base(a.name.replace(/^small parts · /, '')) : base(a.name);
    }
    function dir(p) { var i = p.lastIndexOf('/'); return i < 0 ? '.' : p.slice(0, i); }

    // DOM helpers — text only.
    function el(tag, attrs, text) {
        var n = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
        if (text != null) n.textContent = String(text);
        return n;
    }
    function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
    function swatch(i) {
        var s = el('span', { class: 'swatch' });
        s.style.background = areaColor(i);
        return s;
    }

    var canvas = document.getElementById('stage');
    var ctx = canvas.getContext('2d');
    var panel = document.getElementById('panel');
    var crumbs = document.getElementById('crumbs');
    var searchInput = document.getElementById('search');
    var results = document.getElementById('results');

    var state = {
        level: 'overview', // overview | area
        area: -1,
        file: -1,
        showInfra: true,
        showGuesses: false,
        showTests: true,
        lens: 'areas', // areas | folders
        view: { scale: 1, x: 0, y: 0 }
    };
    var drawn = []; // {kind, idx, x, y, r} in screen space, for hit tests
    window.__mapLabelBoxes = { boxes: [], width: 0, height: 0 };

    function resize() {
        var r = canvas.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    function size() {
        var r = canvas.getBoundingClientRect();
        return { w: r.width, h: r.height };
    }

    function toScreen(x, y) {
        var s = size();
        var pad = 48;
        var k = (Math.min(s.w, s.h) / 2 - pad) * state.view.scale;
        return [s.w / 2 + (x * k) + state.view.x, s.h / 2 + (y * k) + state.view.y];
    }

    // Visible nodes for the current level.
    function currentNodes() {
        var out = [];
        if (state.level === 'overview') {
            var max = 1;
            areas.forEach(function (a) { max = Math.max(max, a.files.length); });
            areas.forEach(function (a, i) {
                out.push({ kind: 'area', idx: i, x: a.x, y: a.y, r: 5 + 26 * Math.sqrt(a.files.length / max), label: areaLabel(a), weight: a.files.length });
            });
            return out;
        }
        var a = areas[state.area];
        var maxIn = 1;
        a.local.forEach(function (l) { maxIn = Math.max(maxIn, files[l[0]].inFiles); });
        a.local.forEach(function (l) {
            var f = files[l[0]];
            if (!state.showTests && f.role === 'test') return;
            if (!state.showInfra && f.role === 'infra') return;
            var outside = f.area !== state.area;
            out.push({ kind: 'file', idx: l[0], x: l[1], y: l[2], r: outside ? 4 : 4 + 10 * Math.sqrt(f.inFiles / maxIn), label: base(f.path), weight: f.inFiles + (outside ? -1000 : 0), outside: outside });
        });
        return out;
    }

    function draw() {
        var s = size();
        ctx.clearRect(0, 0, s.w, s.h);
        var nodes = currentNodes();
        var pos = {};
        nodes.forEach(function (n) {
            var p = toScreen(n.x, n.y);
            n.sx = p[0];
            n.sy = p[1];
            pos[n.kind + n.idx] = n;
        });

        // Edges first.
        var edge = cssVar('--edge');
        var strong = cssVar('--edge-strong');
        ctx.lineCap = 'round';
        if (state.level === 'overview') {
            var maxW = 1;
            model.areaEdges.forEach(function (e) { maxW = Math.max(maxW, e[2]); });
            model.areaEdges.forEach(function (e) {
                var a = pos['area' + e[0]];
                var b = pos['area' + e[1]];
                if (!a || !b) return;
                var hot = state.area === e[0] || state.area === e[1];
                ctx.strokeStyle = hot ? strong : edge;
                ctx.lineWidth = 0.5 + 4 * Math.sqrt(e[2] / maxW);
                ctx.beginPath();
                ctx.moveTo(a.sx, a.sy);
                ctx.lineTo(b.sx, b.sy);
                ctx.stroke();
            });
        } else {
            var drawEdges = function (list, dashed) {
                ctx.setLineDash(dashed ? [4, 4] : []);
                list.forEach(function (e) {
                    var a = pos['file' + e[0]];
                    var b = pos['file' + e[1]];
                    if (!a || !b) return;
                    var hot = state.file === e[0] || state.file === e[1];
                    ctx.strokeStyle = hot ? strong : edge;
                    ctx.lineWidth = hot ? 1.8 : 0.8;
                    ctx.beginPath();
                    ctx.moveTo(a.sx, a.sy);
                    ctx.lineTo(b.sx, b.sy);
                    ctx.stroke();
                });
                ctx.setLineDash([]);
            };
            drawEdges(model.edges, false);
            if (state.showGuesses) drawEdges(model.guessEdges, true);
        }

        // Nodes.
        var grey = cssVar('--grey-node');
        var dimOthers = state.file >= 0 && state.level === 'area';
        var linked = {};
        if (dimOthers) {
            linked[state.file] = true;
            inOf[state.file].forEach(function (x) { linked[x[0]] = true; });
            outOf[state.file].forEach(function (x) { linked[x[0]] = true; });
        }
        drawn = [];
        nodes.forEach(function (n) {
            var r = n.r;
            var dim = dimOthers && !linked[n.idx];
            if (dim) r = Math.max(2.5, r * 0.6);
            var color;
            if (n.kind === 'area') color = areaColor(n.idx, state.area >= 0 && state.area !== n.idx ? 0.55 : 1);
            else if (n.outside) color = grey;
            else {
                var f = files[n.idx];
                color = f.role === 'test' ? areaColor(state.area, 0.45) : f.role === 'infra' ? grey : areaColor(state.area, 1);
            }
            ctx.globalAlpha = dim ? 0.35 : 1;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
            ctx.fill();
            if ((n.kind === 'file' && n.idx === state.file) || (n.kind === 'area' && n.idx === state.area)) {
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = cssVar('--accent');
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            drawn.push({ kind: n.kind, idx: n.idx, x: n.sx, y: n.sy, r: Math.max(r, 8) });
        });

        drawLabels(nodes, s);
    }

    // Labels: biggest first, placed only where they fit, flipped near the right
    // edge, never outside the canvas, never on top of another label.
    function drawLabels(nodes, s) {
        ctx.font = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.textBaseline = 'middle';
        var narrow = s.w < 600;
        var order = nodes.slice().sort(function (a, b) { return b.weight - a.weight || a.idx - b.idx; });
        var limit = state.level === 'overview' ? (narrow ? 8 : 60) : (narrow ? 12 : 80);
        var placed = [];
        var text = cssVar('--text');
        var bg = cssVar('--bg');
        var count = 0;
        for (var i = 0; i < order.length && count < limit; i++) {
            var n = order[i];
            var label = n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label;
            var w = ctx.measureText(label).width;
            var h = 14;
            var x = n.sx + n.r + 4;
            var y = n.sy - h / 2;
            if (x + w > s.w - 2) x = n.sx - n.r - 4 - w;
            if (x < 2 || y < 2 || y + h > s.h - 2 || x + w > s.w - 2) continue;
            var box = { x: x - 2, y: y, w: w + 4, h: h };
            var hit = placed.some(function (p) { return box.x < p.x + p.w && p.x < box.x + box.w && box.y < p.y + p.h && p.y < box.y + box.h; });
            if (hit) continue;
            placed.push(box);
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = bg;
            ctx.fillRect(box.x, box.y, box.w, box.h);
            ctx.globalAlpha = 1;
            ctx.fillStyle = text;
            ctx.fillText(label, x, n.sy);
            count += 1;
        }
        window.__mapLabelBoxes = { boxes: placed, width: s.w, height: s.h };
    }

    function hitTest(x, y) {
        var best = null;
        var bestD = Infinity;
        drawn.forEach(function (d) {
            var dx = d.x - x;
            var dy = d.y - y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= d.r && dist < bestD) { best = d; bestD = dist; }
        });
        return best;
    }

    // Panel rendering.
    function fileButton(i) {
        var b = el('button', { type: 'button' });
        b.appendChild(el('span', { class: 'fname' }, base(files[i].path)));
        b.appendChild(el('span', { class: 'fdir' }, dir(files[i].path)));
        b.addEventListener('click', function () { openFile(i); });
        return el('li').appendChild(b).parentNode;
    }
    function fileList(title, list, cap) {
        panel.appendChild(el('h3', null, title + ' (' + list.length + ')'));
        if (!list.length) { panel.appendChild(el('div', { class: 'more' }, t('none'))); return; }
        var ul = el('ul', { class: 'plist' });
        list.slice(0, cap).forEach(function (i) { ul.appendChild(fileButton(i)); });
        panel.appendChild(ul);
        if (list.length > cap) panel.appendChild(el('div', { class: 'more' }, t('more')(list.length - cap)));
    }
    function kv(pairs) {
        var dl = el('dl', { class: 'kv' });
        pairs.forEach(function (p) { dl.appendChild(el('dt', null, p[0])); dl.appendChild(el('dd', null, p[1])); });
        panel.appendChild(dl);
    }

    function renderPanel() {
        clear(panel);
        if (state.file >= 0) {
            var f = files[state.file];
            panel.appendChild(el('h2', null, base(f.path)));
            panel.appendChild(el('div', { class: 'meta' }, dir(f.path)));
            kv([
                [t('area'), f.area >= 0 ? areas[f.area].name : '—'],
                [t('role'), STR[lang].roles[f.role]],
                [t('guesses'), String(f.guesses)],
                [t('state'), data.meta.state]
            ]);
            fileList(t('usedBy'), inOf[state.file].map(function (x) { return x[0]; }), 30);
            fileList(t('uses'), outOf[state.file].map(function (x) { return x[0]; }), 30);
            fileList(t('tests'), f.tests, 20);
            panel.appendChild(el('h3', null, t('symbols') + ' (' + (f.symbols.length + f.symbolsOmitted) + ')'));
            var ul = el('ul', { class: 'plist' });
            f.symbols.forEach(function (s) {
                var li = el('li');
                li.appendChild(el('code', null, s[0]));
                li.appendChild(el('span', { class: 'meta' }, ' ' + s[1] + ' · ' + s[2]));
                ul.appendChild(li);
            });
            panel.appendChild(ul);
            if (f.symbolsOmitted) panel.appendChild(el('div', { class: 'more' }, t('more')(f.symbolsOmitted)));
            if (f.externals.length) {
                panel.appendChild(el('h3', null, t('externals') + ' (' + f.externals.length + ')'));
                var ex = el('ul', { class: 'plist' });
                f.externals.slice(0, 30).forEach(function (x) { ex.appendChild(el('li', null, x)); });
                panel.appendChild(ex);
            }
            return;
        }
        if (state.area >= 0) {
            var a = areas[state.area];
            var h = el('h2');
            h.appendChild(swatch(state.area));
            h.appendChild(document.createTextNode(a.name));
            panel.appendChild(h);
            panel.appendChild(el('div', { class: 'meta' }, t('files')(a.files.length)));
            kv([
                [t('hub'), files[a.hub].path],
                [t('cohesion'), Math.round(a.cohesion * 100) + ' %'],
                [t('testShare'), Math.round(a.testShare * 100) + ' %'],
                [t('mismatch'), Math.round(a.folderMismatch * 100) + ' %']
            ]);
            fileList(t('files')(a.files.length), a.files.slice().sort(function (x, y) { return files[y].inFiles - files[x].inFiles || x - y; }), 60);
            return;
        }
        if (state.lens === 'folders') { renderFolders(); return; }
        panel.appendChild(el('h2', null, data.meta.title));
        panel.appendChild(el('div', { class: 'meta' }, data.meta.summary));
        panel.appendChild(el('p', { class: 'meta' }, t('hint')));
        panel.appendChild(el('h3', null, t('areas') + ' (' + areas.length + ')'));
        var list = el('ul', { class: 'plist' });
        areas.forEach(function (a, i) {
            var b = el('button', { type: 'button' });
            b.appendChild(swatch(i));
            b.appendChild(document.createTextNode(a.name + ' · ' + a.files.length));
            b.addEventListener('click', function () { openArea(i); });
            var li = el('li');
            li.appendChild(b);
            list.appendChild(li);
        });
        panel.appendChild(list);
        panel.appendChild(el('h3', null, t('groups')));
        var groups = {};
        files.forEach(function (f, i) { if (f.area < 0) (groups[f.role] = groups[f.role] || []).push(i); });
        Object.keys(groups).sort().forEach(function (role) {
            fileList(STR[lang].roles[role], groups[role], 15);
        });
    }

    function renderFolders() {
        panel.appendChild(el('h2', null, t('lensFolders')));
        panel.appendChild(el('p', { class: 'meta' }, t('folderHint')));
        var byDir = {};
        files.forEach(function (f, i) { (byDir[dir(f.path)] = byDir[dir(f.path)] || []).push(i); });
        Object.keys(byDir).sort().forEach(function (d) {
            var list = byDir[d];
            var colours = {};
            list.forEach(function (i) { if (files[i].area >= 0) colours[files[i].area] = true; });
            var details = el('details');
            var summary = el('summary', null, d + ' · ' + list.length);
            Object.keys(colours).slice(0, 12).forEach(function (a) { summary.appendChild(swatch(Number(a))); });
            details.appendChild(summary);
            var ul = el('ul', { class: 'plist' });
            list.forEach(function (i) {
                var b = el('button', { type: 'button' });
                if (files[i].area >= 0) b.appendChild(swatch(files[i].area));
                b.appendChild(document.createTextNode(base(files[i].path)));
                b.addEventListener('click', function () { state.lens = 'areas'; syncLens(); openFile(i); });
                var li = el('li');
                li.appendChild(b);
                ul.appendChild(li);
            });
            details.appendChild(ul);
            panel.appendChild(details);
        });
    }

    function syncLens() {
        document.getElementById('lens-areas').setAttribute('aria-pressed', String(state.lens === 'areas'));
        document.getElementById('lens-folders').setAttribute('aria-pressed', String(state.lens === 'folders'));
    }

    function renderCrumbs() {
        clear(crumbs);
        var home = el('button', { type: 'button' }, t('map'));
        home.addEventListener('click', goHome);
        crumbs.appendChild(home);
        if (state.area >= 0) {
            crumbs.appendChild(el('span', null, '›'));
            var ab = el('button', { type: 'button', title: areas[state.area].name }, areaLabel(areas[state.area]));
            ab.addEventListener('click', function () { openArea(state.area); });
            crumbs.appendChild(ab);
        }
        if (state.file >= 0) {
            crumbs.appendChild(el('span', null, '›'));
            crumbs.appendChild(el('button', { type: 'button', title: files[state.file].path, disabled: 'disabled' }, base(files[state.file].path)));
        }
    }

    function refresh() {
        renderCrumbs();
        renderPanel();
        draw();
    }
    function resetView() { state.view = { scale: 1, x: 0, y: 0 }; }
    function goHome() { state.level = 'overview'; state.area = -1; state.file = -1; resetView(); refresh(); }
    function openArea(i) { state.level = 'area'; state.area = i; state.file = -1; resetView(); refresh(); }
    function openFile(i) {
        var f = files[i];
        if (f.area >= 0 && (state.level !== 'area' || state.area !== f.area)) {
            state.level = 'area';
            state.area = f.area;
            resetView();
        }
        state.file = i;
        refresh();
    }

    // Input.
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
        drag = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y, moved: false };
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x;
        var dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (drag.moved) { state.view.x = drag.vx + dx; state.view.y = drag.vy + dy; draw(); }
    });
    canvas.addEventListener('pointerup', function (e) {
        var wasDrag = drag && drag.moved;
        drag = null;
        if (wasDrag) return;
        var r = canvas.getBoundingClientRect();
        var hit = hitTest(e.clientX - r.left, e.clientY - r.top);
        if (!hit) return;
        if (hit.kind === 'area') openArea(hit.idx);
        else openFile(hit.idx);
    });
    canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    function zoom(f) {
        state.view.scale = Math.min(12, Math.max(0.3, state.view.scale * f));
        draw();
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (document.activeElement === searchInput && searchInput.value) { searchInput.value = ''; clear(results); return; }
            if (state.file >= 0) { state.file = -1; refresh(); } else if (state.area >= 0) goHome();
        }
    });

    searchInput.addEventListener('input', function () {
        clear(results);
        var q = searchInput.value.trim().toLowerCase();
        if (q.length < 2) return;
        var hits = 0;
        areas.forEach(function (a, i) {
            if (hits >= 30 || a.name.toLowerCase().indexOf(q) < 0) return;
            var b = el('button', { type: 'button' }, '◎ ' + a.name);
            b.addEventListener('click', function () { clear(results); openArea(i); });
            var li = el('li'); li.appendChild(b); results.appendChild(li);
            hits += 1;
        });
        files.forEach(function (f, i) {
            if (hits >= 30 || f.path.toLowerCase().indexOf(q) < 0) return;
            var b = el('button', { type: 'button' }, f.path);
            b.addEventListener('click', function () { clear(results); openFile(i); });
            var li = el('li'); li.appendChild(b); results.appendChild(li);
            hits += 1;
        });
    });

    function toggle(id, key) {
        var b = document.getElementById(id);
        b.setAttribute('aria-pressed', String(state[key]));
        b.addEventListener('click', function () {
            state[key] = !state[key];
            b.setAttribute('aria-pressed', String(state[key]));
            draw();
        });
    }
    document.getElementById('lens-areas').addEventListener('click', function () { state.lens = 'areas'; syncLens(); refresh(); });
    document.getElementById('lens-folders').addEventListener('click', function () {
        state.lens = 'folders'; state.file = -1; state.area = -1; state.level = 'overview'; syncLens(); refresh();
    });
    toggle('t-infra', 'showInfra');
    toggle('t-guess', 'showGuesses');
    toggle('t-tests', 'showTests');
    document.getElementById('z-in').addEventListener('click', function () { zoom(1.25); });
    document.getElementById('z-out').addEventListener('click', function () { zoom(1 / 1.25); });
    document.getElementById('z-fit').addEventListener('click', function () { resetView(); draw(); });

    var themes = ['system', 'light', 'dark'];
    var theme = 'system';
    function applyTheme() {
        var root = document.documentElement;
        if (theme === 'system') root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', theme);
        var dark = theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.dataset.resolvedTheme = dark ? 'dark' : 'light';
        document.getElementById('theme').textContent = t('theme') + ': ' + theme;
    }
    document.getElementById('theme').addEventListener('click', function () {
        theme = themes[(themes.indexOf(theme) + 1) % themes.length];
        applyTheme();
        draw();
    });
    document.getElementById('lang').addEventListener('click', function () {
        lang = lang === 'de' ? 'en' : 'de';
        applyStrings();
        refresh();
    });
    function applyStrings() {
        document.documentElement.lang = lang;
        searchInput.setAttribute('placeholder', t('search'));
        searchInput.setAttribute('aria-label', t('search'));
        document.getElementById('lens-areas').textContent = t('lensAreas');
        document.getElementById('lens-folders').textContent = t('lensFolders');
        document.getElementById('t-infra').textContent = t('infra');
        document.getElementById('t-guess').textContent = t('guessToggle');
        document.getElementById('t-tests').textContent = t('testsToggle');
        document.getElementById('z-in').setAttribute('aria-label', t('zoomIn'));
        document.getElementById('z-out').setAttribute('aria-label', t('zoomOut'));
        document.getElementById('z-fit').textContent = t('reset');
        document.getElementById('lang').textContent = t('lang');
        applyTheme();
    }

    applyStrings();
    syncLens();
    window.addEventListener('resize', resize);
    resize();
    refresh();
})();
