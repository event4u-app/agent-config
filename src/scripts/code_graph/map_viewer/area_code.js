/*
 * The Code area: the Workbench — rails, the canvas graph and its lenses, and
 * the file / findings / area detail. The one thing computed here rather than
 * read from the model is which files a blast reaches: a breadth-first walk over
 * the edges the model ships, to the depth its blast numbers were computed with.
 */
    extendStrings({
        en: {
            healthScale: '4 parts of 25 points · A ≥ 80, B ≥ 60', lever: function (part, pts) { return 'Largest lever: ' + part.toLowerCase() + ' (−' + pts + ' points)'; },
            tLines: 'Lines', langs: 'Languages by lines', langMore: function (n) { return n + ' more'; },
            pickTitle: 'Pick a file', pickHint: 'Click in the graph, search with / – or start here.', recent: 'Recently picked', topHotspots: 'Largest hotspots',
            deselect: 'Clear selection', linesN: function (n) { return n + ' lines'; }, commitsWin: function (d) { return 'commits / ' + d + ' d'; }, owners: 'owners', ownerBus: 'owner · bus factor',
            aggregated: function (f, a) { return 'aggregated: ' + f + ' files in ' + a + ' area bubbles'; }, outsideArea: 'outside this area', folderFiles: '(files)', folded: function (f, s2, z) { return 'folded: ' + f + ' files into ' + s2 + ' folder nodes · click one to open it · zoom past ' + z + '× to open all'; }, commitsShort: 'Commits', outsideHub: 'outside hub', openArea: 'Open area (double-click)', crumbMap: 'Map',
            smallParts: 'Small parts', hiddenEdges: function (n) { return '+' + n + ' hidden'; }, hubLine: function (h) { return 'Hub: ' + h; }, cSize: 'Lines', hSize: 'LOC per area', hChurn: function (d) { return 'Commits in ' + d + ' days'; }, hFolderA: 'Main folder of the area',
            lgSize: function (a, b) { return 'Lines per area: ' + a + ' → ' + b; }, lgChurnA: function (d, a, b) { return 'Commits in ' + d + ' days: ' + a + ' → ' + b; },
            crumbLayers: function (f) { return 'Blast depth · ' + f; }, crumbMatrix: function (n) { return 'Area matrix ' + n + ' × ' + n; }, crumbKnow: function (f) { return 'Knowledge of ' + f; }, crumbArea: function (id, title, n) { return id + ' ' + title + ' · ' + n + ' files'; },
            moreDirect: function (n) { return '+ ' + n + ' more direct · expand depth 2 and 3'; }, depthCollapse: 'Show depth 1 only', testsMore: function (n) { return '+' + n + ' more · import link, no coverage'; },
            symSorted: function (n) { return 'Sorted by external calls · ≥ 10 external = orange' + (n ? ' · +' + n + ' more' : ''); }, soleOwner: 'sole owner',
            ownerShare: function (p, c) { return p + ' · ' + c + ' commits'; }, ownerNote: function (d, b) { return 'Window ' + d + ' days · handles only, no e-mails' + (b ? ' · bus factor 1' : ''); },
            treemapLegend: function (c) { return 'Area = lines per folder · Colour = ' + c + ' · Click: open'; }, linesFiles: function (l, f) { return l + ' lines · ' + f + ' files'; },
            hTrusted: 'Trusted links between files, documentation links included', hotspotsUnit: 'Commits × lines', fileCycles: 'File cycles'
        },
        de: {
            healthScale: '4 Teile à 25 Punkte · A ≥ 80, B ≥ 60', lever: function (part, pts) { return 'Größter Hebel: ' + part + ' (−' + pts + ' Punkte)'; },
            tLines: 'Zeilen', langs: 'Sprachen nach Zeilen', langMore: function (n) { return n + ' weitere'; },
            pickTitle: 'Datei wählen', pickHint: 'Im Graph klicken, suchen mit / – oder hier einsteigen.', recent: 'Zuletzt gewählt', topHotspots: 'Größte Hotspots',
            deselect: 'Auswahl aufheben', linesN: function (n) { return n + ' Zeilen'; }, commitsWin: function (d) { return 'Commits / ' + d + ' T.'; }, owners: 'Owner', ownerBus: 'Owner · Bus-Faktor',
            aggregated: function (f, a) { return 'aggregiert: ' + f + ' Dateien in ' + a + ' Area-Blasen'; }, outsideArea: 'außerhalb der Area', folderFiles: '(Dateien)', folded: function (f, s2, z) { return 'gefaltet: ' + f + ' Dateien in ' + s2 + ' Ordner-Knoten · einen anklicken öffnet ihn · über ' + z + '× zoomen öffnet alle'; }, commitsShort: 'Commits', outsideHub: 'außerhalb Hub', openArea: 'Area öffnen (Doppelklick)', crumbMap: 'Karte',
            smallParts: 'Kleinteile', hiddenEdges: function (n) { return '+' + n + ' ausgeblendet'; }, hubLine: function (h) { return 'Hub: ' + h; }, cSize: 'Zeilen', hSize: 'LOC je Area', hChurn: function (d) { return 'Commits in ' + d + ' Tagen'; }, hFolderA: 'Hauptordner der Area',
            lgSize: function (a, b) { return 'Zeilen je Area: ' + a + ' → ' + b; }, lgChurnA: function (d, a, b) { return 'Commits in ' + d + ' Tagen: ' + a + ' → ' + b; },
            crumbLayers: function (f) { return 'Blast-Tiefe · ' + f; }, crumbMatrix: function (n) { return 'Area-Matrix ' + n + ' × ' + n; }, crumbKnow: function (f) { return 'Wissen zu ' + f; }, crumbArea: function (id, title, n) { return id + ' ' + title + ' · ' + n + ' Dateien'; },
            moreDirect: function (n) { return '+ ' + n + ' weitere direkt · Tiefe 2 und 3 aufklappen'; }, depthCollapse: 'Nur Tiefe 1 zeigen', testsMore: function (n) { return '+' + n + ' weitere · Import-Bezug, keine Coverage'; },
            symSorted: function (n) { return 'Sortiert nach externen Aufrufen · ≥ 10 extern = orange' + (n ? ' · +' + n + ' weitere' : ''); }, soleOwner: 'einziger Owner',
            ownerShare: function (p, c) { return p + ' · ' + c + ' Commits'; }, ownerNote: function (d, b) { return 'Fenster ' + d + ' Tage · nur Handles, keine E-Mails' + (b ? ' · Bus-Faktor 1' : ''); },
            treemapLegend: function (c) { return 'Fläche = Zeilen je Ordner · Farbe = ' + c + ' · Klick: öffnen'; }, linesFiles: function (l, f) { return l + ' Zeilen · ' + f + ' Dateien'; },
            hTrusted: 'Sichere Verweise zwischen Dateien, Doku-Links eingeschlossen', hotspotsUnit: 'Commits × Zeilen', fileCycles: 'Datei-Zyklen'
        }
    });

    /** An area's working title: the model's, unique within its kind, over its hub file's name (`order_service.ts` → "Order Service"). */
    function areaTitle(a) {
        if (a.kind === 'small-parts') return t('smallParts') + ' · ' + (a.title || base(a.name.replace(/^small parts · /, '')));
        if (a.title) return a.title;
        var stem = base(a.name).replace(/\.[^.]+$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-.]+/g, ' ').trim();
        return stem.split(/\s+/).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') || base(a.name);
    }
    /** The hub file the way the design writes it: its folder's last segment and its name. */
    function hubShort(a) {
        if (a.kind === 'small-parts') return a.name;
        var parts = files[a.hub] ? files[a.hub].path.split('/') : [a.name];
        return parts.slice(-2).join('/');
    }

    // Adjacency over trusted edges, built once.
    var inOf = files.map(function () { return []; });
    var outOf = files.map(function () { return []; });
    model.edges.forEach(function (e) { outOf[e[0]].push([e[1], e[2]]); inOf[e[1]].push([e[0], e[2]]); });
    var guessIn = files.map(function () { return 0; });
    model.guessEdges.forEach(function (e) { guessIn[e[1]] += 1; });
    var byWeight = function (a, b) { return b[1] - a[1] || a[0] - b[0]; };
    inOf.forEach(function (l) { l.sort(byWeight); });
    outOf.forEach(function (l) { l.sort(byWeight); });

    var changedSet = Object.create(null);
    var touchedArea = Object.create(null);
    if (model.diff) {
        model.diff.changed.forEach(function (i) { changedSet[i] = true; });
        model.diff.areas.forEach(function (a) { touchedArea[a[0]] = true; });
    }
    var cycleOf = Object.create(null);
    (model.violations || []).forEach(function (v, k) { if (v.kind === 'cycle') v.files.forEach(function (f) { cycleOf[f] = k; }); });

    var canvas = $('stage');
    var ctx = canvas.getContext('2d');
    var panel = $('panel');
    var lensView = $('lensview');
    var graphWrap = $('graphwrap');

    var ORB_YAW = 0.35;
    var ORB_PITCH = -0.3;
    // The orb's orientation is one rotation matrix (row-major), turned by small steps
    // about the screen's axes. Angles would lock at a pole; a matrix turns on forever.
    function rotX(a) { var c = Math.cos(a); var s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
    function rotY(a) { var c = Math.cos(a); var s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
    function matMul(A, B) {
        var out = [];
        for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) out.push(A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]);
        return out;
    }
    /** Gram–Schmidt over the rows: thousands of small turns never shear or shrink the sphere. */
    function orthonormal(m) {
        var a = [m[0], m[1], m[2]]; var b = [m[3], m[4], m[5]];
        var la = Math.hypot(a[0], a[1], a[2]); a = [a[0] / la, a[1] / la, a[2] / la];
        var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; b = [b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]];
        var lb = Math.hypot(b[0], b[1], b[2]); b = [b[0] / lb, b[1] / lb, b[2] / lb];
        return a.concat(b, [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
    }
    function startRotation() { return { m: matMul(rotX(ORB_PITCH), rotY(ORB_YAW)) }; }
    /** Turn the orb by `yaw` about the screen's vertical axis and `pitch` about its horizontal one. */
    function turnBy(yaw, pitch) { state.rot.m = orthonormal(matMul(matMul(rotX(pitch), rotY(yaw)), state.rot.m)); }

    var state = {
        lens: 'graph', colorBy: 'blast', scope: 'code', tab: 'file',
        level: 'overview', area: -1, file: -1, cell: null,
        showTrusted: true, showGuesses: false, showTests: true, showInfra: false,
        full: false, formula: false, deep: false, treePath: '', scopeDir: '', open: Object.create(null),
        view: { scale: 1, x: 0, y: 0 }, orb: false, rot: startRotation(),
        // Which areas the overview shows. A data choice, so it never depends on 2D / 3D.
        areaLimit: OVERVIEW_AREAS,
        // Side panels: `pin` null = the width's default (pinned only on a wide window).
        pin: { left: null, right: null }, fly: { left: false, right: false },
        // Folder super-nodes at area level: folded per area with hysteresis, opened per folder or by zoom.
        superOn: Object.create(null), superOpen: Object.create(null), superZoom: false
    };
    var drawn = [];
    // The names painted on the canvas, each with the node it names: a click on one is a click on that node.
    var labelHits = [];
    var superList = [];
    var superOf = Object.create(null);
    function paneMode() { var w = window.innerWidth; return w <= 700 ? 'phone' : w < 1240 ? 'tablet' : 'wide'; }
    function isPinned(side) {
        var mode = paneMode();
        if (mode === 'phone' || state.full) return false;
        return state.pin[side] !== null ? state.pin[side] : mode === 'wide';
    }
    function paneClasses() {
        var c = 'wb mode-' + paneMode() + (state.full ? ' full' : '');
        ['left', 'right'].forEach(function (side) {
            if (isPinned(side)) c += ' pin-' + side;
            else if (state.fly[side]) c += ' fly-' + side;
        });
        return c;
    }
    // A jump out of a flyout lands on the stage, so the flyout makes way.
    function closeFlyouts() { state.fly.left = false; state.fly.right = false; }
    function applyPanes(relayout) {
        $('wb').className = paneClasses();
        document.body.classList.toggle('full', state.full);
        var flyOpen = ['left', 'right'].some(function (side) { return !isPinned(side) && state.fly[side]; });
        $('scrim').hidden = !flyOpen;
        ['left', 'right'].forEach(function (side) {
            var pinned = isPinned(side);
            var pin = $('pin-' + side);
            pin.setAttribute('aria-pressed', String(pinned));
            pin.textContent = pinned ? t('unpin') : t('pin');
        });
        if (relayout) resize();
    }
    // Every step deeper records where it came from, so each lens has a way back.
    var trail = [];
    function snapshot() { return { lens: state.lens, level: state.level, area: state.area, file: state.file, tab: state.tab, treePath: state.treePath, cell: state.cell }; }
    function sameView(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
    function step() {
        var now = snapshot();
        if (trail.length && sameView(trail[trail.length - 1], now)) return;
        trail.push(now);
        if (trail.length > 50) trail.shift();
    }
    function back() {
        // A step that changed nothing leaves an entry equal to the current view; skip it.
        var prev = trail.pop();
        while (prev && sameView(prev, snapshot())) prev = trail.pop();
        if (!prev) { refresh(); return; }
        var levelChanged = prev.level !== state.level || prev.area !== state.area;
        Object.keys(prev).forEach(function (k) { state[k] = prev[k]; });
        if (levelChanged) resetView();
        refresh();
    }
    function lensHome() { step(); state.treePath = ''; state.cell = null; refresh(); }
    function exposeView() {
        window.__mapView = { lens: state.lens, treePath: state.treePath, level: state.level, area: state.area, file: state.file, shownAreas: state.level === 'overview' ? overviewAreas() : [], drawn: drawn.map(function (d) { return { kind: d.kind, idx: d.idx, x: d.x, y: d.y, deg: d.deg }; }) };
    }
    window.__mapLabelBoxes = { boxes: [], width: 0, height: 0 };

    // Nothing is preselected: a mark means the reader chose it.

    /** The files a change to `start` reaches over trusted in-edges, by depth, within the scope. */
    var walkCache = Object.create(null);
    function walk(start, scope) {
        var key = start + ':' + scope;
        if (walkCache[key]) return walkCache[key];
        var depthOf = Object.create(null);
        var byDepth = [[start], [], [], []];
        depthOf[start] = 0;
        var frontier = [start];
        for (var d = 1; d <= BLAST_DEPTH && frontier.length; d++) {
            var next = [];
            frontier.forEach(function (f) {
                inOf[f].forEach(function (x) {
                    var s = x[0];
                    if (depthOf[s] !== undefined || !inScope(files[s], scope)) return;
                    depthOf[s] = d;
                    byDepth[d].push(s);
                    next.push(s);
                });
            });
            frontier = next;
        }
        var res = { depthOf: depthOf, byDepth: byDepth };
        walkCache[key] = res;
        return res;
    }
    function selWalk() { return state.file >= 0 ? walk(state.file, state.scope) : null; }

    // Colour per file and per area for the current colour-by option.
    var maxChurn = 1;
    var maxLoc = 1;
    files.forEach(function (f) { if (f.churn) maxChurn = Math.max(maxChurn, f.churn); if (f.loc) maxLoc = Math.max(maxLoc, f.loc); });
    var areaSums = areas.map(function (a) {
        var loc = 0; var churn = 0;
        a.files.forEach(function (i) { loc += files[i].loc || 0; churn += files[i].churn || 0; });
        return { loc: loc, churn: churn };
    });
    function sumRange(key, list) {
        var lo = Infinity; var hi = 0;
        list.forEach(function (i) { var v = areaSums[i][key]; lo = Math.min(lo, v); hi = Math.max(hi, v); });
        return [lo === Infinity ? 0 : lo, hi];
    }
    var tsMin = 1;
    var tsMax = 0;
    areas.forEach(function (a) { tsMin = Math.min(tsMin, a.testShare); tsMax = Math.max(tsMax, a.testShare); });
    function mix(a, b, w) { return 'color-mix(in srgb, ' + a + ' ' + Math.round(w * 100) + '%, ' + b + ')'; }
    var colourCache = Object.create(null);
    function resolveColour(c) {
        if (colourCache[c] === undefined) colourCache[c] = resolveColourNow(c);
        return colourCache[c];
    }
    function resolveColourNow(c) {
        // Canvas cannot read `var()`: resolve tokens and approximate color-mix by its weight.
        if (c.indexOf('var(') === 0) return cssVar(c.slice(4, -1));
        var m = /^color-mix\(in srgb, (var\(--[\w]+\)|#[0-9a-f]+) (\d+)%, (var\(--[\w]+\)|#[0-9a-f]+)\)$/i.exec(c);
        if (!m) return c;
        var a = hexRgb(resolveColour(m[1]));
        var b = hexRgb(resolveColour(m[3]));
        if (!a || !b) return resolveColour(m[1]);
        var w = Number(m[2]) / 100;
        return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(a[k] * w + b[k] * (1 - w)); }).join(',') + ')';
    }
    function hexRgb(h) {
        var m = /^#([0-9a-f]{6})$/i.exec(h.trim());
        if (!m) return null;
        var n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function fileColour(i) {
        var f = files[i];
        switch (state.colorBy) {
            case 'area': return f.area >= 0 ? cat(f.area) : 'var(--node)';
            case 'tests': return f.area >= 0 ? mix('var(--green)', 'var(--node)', (areas[f.area].testShare - tsMin) / Math.max(0.01, tsMax - tsMin)) : 'var(--node)';
            case 'role': return f.role === 'test' ? 'var(--green)' : f.role === 'doc' ? 'var(--doc)' : SCOPE_CODE[f.role] ? 'var(--cyan)' : 'var(--violet)';
            case 'folder': return cat(strHash(top2(f.path)));
            case 'layer': return f.layer ? cat(strHash(f.layer)) : 'var(--node)';
            case 'domain': return f.domain ? cat(strHash(f.domain)) : 'var(--node)';
            case 'churn': return f.churn ? mix('var(--brand)', 'var(--node)', Math.sqrt(f.churn / maxChurn)) : 'var(--node)';
            case 'size': return f.loc ? mix('var(--cyan)', 'var(--node)', Math.max(0.1, Math.sqrt(f.loc / maxLoc))) : 'var(--node)';
            default: {
                var w = selWalk();
                if (!w) return f.role === 'test' ? 'var(--green)' : 'var(--cyan)';
                var d = w.depthOf[i];
                return d === 0 ? 'var(--brand)' : d === 1 ? 'var(--amber)' : d === 2 ? 'var(--sand)' : d === 3 ? 'var(--d3)' : 'var(--node)';
            }
        }
    }
    function areaHits(ai) {
        var w = selWalk();
        if (!w) return 0;
        if (!w.hits) {
            w.hits = Object.create(null);
            for (var k in w.depthOf) if (w.depthOf[k] > 0 && files[k].area >= 0) w.hits[files[k].area] = (w.hits[files[k].area] || 0) + 1;
        }
        return w.hits[ai] || 0;
    }
    function areaColour(ai) {
        var a = areas[ai];
        switch (state.colorBy) {
            case 'area': return cat(ai);
            case 'tests': return mix('var(--green)', 'var(--node)', (a.testShare - tsMin) / Math.max(0.01, tsMax - tsMin));
            case 'role': return 'var(--cyan)';
            case 'folder': return cat(strHash(top2(files[a.hub].path)));
            case 'layer': return files[a.hub].layer ? cat(strHash(files[a.hub].layer)) : 'var(--node)';
            case 'domain': return files[a.hub].domain ? cat(strHash(files[a.hub].domain)) : 'var(--node)';
            case 'churn': {
                var cr = sumRange('churn', overviewAreas());
                var sum = areaSums[ai].churn;
                return sum ? mix('var(--brand)', 'var(--node)', Math.max(0.08, Math.log(sum + 1) / Math.log(cr[1] + 1) - 0.2)) : 'var(--node)';
            }
            case 'size': {
                var lr = sumRange('loc', overviewAreas());
                return areaSums[ai].loc ? mix('var(--cyan)', 'var(--node)', Math.max(0.1, areaSums[ai].loc / Math.max(1, lr[1]))) : 'var(--node)';
            }
            default:
                if (state.file >= 0 && files[state.file].area === ai) return 'var(--brand)';
                return areaHits(ai) > 0 ? 'var(--amber)' : 'var(--node)';
        }
    }

    // Canvas.
    function size() { var r = canvas.getBoundingClientRect(); return { w: r.width, h: r.height }; }
    function resize() {
        var r = canvas.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }
    function toScreen(x, y, fill) {
        var s = size();
        var k = (Math.min(s.w, s.h) / 2 - 56) * state.view.scale;
        // The overview fills the stage on both axes, as the design spreads its areas.
        var kx = fill ? (s.w / 2 - 90) * state.view.scale : k;
        var ky = fill ? (s.h / 2 - 70) * state.view.scale : k;
        return [s.w / 2 + x * kx + state.view.x, s.h / 2 + y * ky + state.view.y];
    }
    // The orb: the precomputed 2D layout wrapped onto a sphere with the inverse
    // Lambert azimuthal equal-area projection. Distance and direction are both
    // replaced by their rank, so equal shares of nodes cover equal shares of the sphere.
    function orbPoint(share, turn) {
        var rho = 2 * Math.sqrt(share) * 0.97;
        var phi = turn * Math.PI * 2;
        var f = Math.sqrt(Math.max(0, 1 - (rho * rho) / 4));
        var px = Math.cos(phi) * rho * f;
        var py = Math.sin(phi) * rho * f;
        var pz = 1 - (rho * rho) / 2;
        var m = state.rot.m;
        return [m[0] * px + m[1] * py + m[2] * pz, m[3] * px + m[4] * py + m[5] * pz, m[6] * px + m[7] * py + m[8] * pz];
    }
    function orbRadius() { var s = size(); return (Math.min(s.w, s.h) / 2 - 48) * state.view.scale; }

    /** How many areas the overview shows: the chosen limit, never more than exist. */
    function limitCount() { return state.areaLimit === 'all' ? areas.length : Math.min(state.areaLimit, areas.length); }
    var inDirCache = Object.create(null);
    function areaInDir(i, dirPath) {
        var key = i + '|' + dirPath;
        if (!(key in inDirCache)) inDirCache[key] = areas[i].files.some(function (f) { return files[f].path.indexOf(dirPath + '/') === 0; });
        return inDirCache[key];
    }
    function overviewAreas() {
        var n = limitCount();
        var out = [];
        for (var i = 0; i < n; i++) out.push(i);
        var sel = state.file >= 0 ? files[state.file].area : state.area;
        if (sel >= n) out.push(sel);
        return out;
    }
    function currentNodes() {
        var out = [];
        if (state.level === 'overview') {
            var shown = overviewAreas();
            var max = 1;
            // The shown subset is stretched to fill the stage: the layout was computed for every area.
            var minX = Infinity; var maxX = -Infinity; var minY = Infinity; var maxY = -Infinity;
            shown.forEach(function (i) {
                max = Math.max(max, areas[i].files.length);
                minX = Math.min(minX, areas[i].x); maxX = Math.max(maxX, areas[i].x);
                minY = Math.min(minY, areas[i].y); maxY = Math.max(maxY, areas[i].y);
            });
            var spanX = Math.max(maxX - minX, 1e-6) / 2;
            var spanY = Math.max(maxY - minY, 1e-6) / 2;
            var mx = (minX + maxX) / 2;
            var my = (minY + maxY) / 2;
            shown.forEach(function (i) {
                var a = areas[i];
                var x = state.orb ? a.x : (a.x - mx) / spanX * 0.85;
                var y = state.orb ? a.y : (a.y - my) / spanY * 0.85;
                out.push({ kind: 'area', idx: i, x: x, y: y, r: 8 + 30 * Math.sqrt(a.files.length / max), label: areaTitle(a), sub: hubShort(a), weight: a.files.length });
            });
            return out;
        }
        var ar = areas[state.area];
        var maxIn = 1;
        ar.local.forEach(function (l) { maxIn = Math.max(maxIn, files[l[0]].inFiles); });
        ar.local.forEach(function (l) {
            var f = files[l[0]];
            if (!fileShown(l[0])) return;
            var outside = f.area !== state.area;
            out.push({ kind: 'file', idx: l[0], x: l[1], y: l[2], r: outside ? 4 : 4 + 12 * Math.sqrt(f.inFiles / maxIn), label: base(f.path), weight: f.inFiles + (l[0] === state.file ? 1e6 : 0) + (outside ? -1000 : 0), outside: outside });
        });
        // The local layout carries only a few outside neighbours per area. The marked file's
        // own neighbours all join, on a ring around the area grouped by their area, so every
        // trusted edge it has is drawn rather than ending at a file the view left out.
        if (state.file >= 0) {
            var have = Object.create(null);
            out.forEach(function (n) { have[n.idx] = true; });
            if (have[state.file]) {
                var extra = [];
                outOf[state.file].concat(inOf[state.file]).forEach(function (x) {
                    var g = files[x[0]];
                    if (have[x[0]] || !fileShown(x[0])) return;
                    have[x[0]] = true;
                    extra.push(x[0]);
                });
                extra.sort(function (a, b) { return files[a].area - files[b].area || (files[a].path < files[b].path ? -1 : 1); });
                extra.forEach(function (i, k) {
                    var ang = (k / extra.length) * Math.PI * 2 - Math.PI / 2;
                    out.push({ kind: 'file', idx: i, x: Math.cos(ang) * 1.12, y: Math.sin(ang) * 1.12, r: 3.5, label: base(files[i].path), weight: -2000, outside: true, ring: true });
                });
            }
        }
        return foldSupers(out);
    }

    /** Whether the tests and infra-hub toggles let a file onto the stage. */
    function fileShown(i) {
        var f = files[i];
        if (!state.showTests && f.role === 'test') return false;
        if (!state.showInfra && f.role === 'infra' && i !== state.file) return false;
        return true;
    }

    /**
     * Above the measured node count an area folds its files into one node per folder under
     * the area's common folder. It unfolds only at the lower count, so a filter that moves
     * the count across one line does not flip the view; zooming past one scale opens every
     * folder and below a lower one folds them again. A picked file and files from outside
     * the area always stay single.
     */
    function foldSupers(nodes) {
        var L = typeof SUPER_LIMITS === 'object' ? SUPER_LIMITS : { collapseAbove: 50, expandBelow: 40, zoomExpand: 2, zoomCollapse: 1.5 };
        superList = [];
        superOf = Object.create(null);
        var key = state.area;
        var on = !!state.superOn[key];
        // The marked file's ring of neighbours is not the area's own count.
        var count = nodes.filter(function (n) { return !n.ring; }).length;
        if (!on && count > L.collapseAbove) on = true;
        else if (on && count <= L.expandBelow) on = false;
        state.superOn[key] = on;
        if (!state.superZoom && state.view.scale >= L.zoomExpand) state.superZoom = true;
        else if (state.superZoom && state.view.scale < L.zoomCollapse) state.superZoom = false;
        var result = nodes;
        if (on && !state.superZoom) {
            var own = nodes.filter(function (n) { return !n.outside && n.idx !== state.file; });
            var paths = own.map(function (n) { return files[n.idx].path; });
            var prefix = paths.length ? dir(paths[0]) + '/' : '';
            paths.forEach(function (p) { while (prefix && p.indexOf(prefix) !== 0) prefix = prefix.slice(0, prefix.slice(0, -1).lastIndexOf('/') + 1); });
            // Folders under the common one; the largest is split into its own sub-folders while
            // the drawn count stays under the fold line, so a big area keeps its structure.
            function split(members, at) {
                var out2 = { groups: [], singles: [] };
                var byG = Object.create(null);
                members.forEach(function (n) {
                    var rel = files[n.idx].path.slice(at.length);
                    var cut = rel.indexOf('/');
                    if (cut < 0) { out2.singles.push(n); return; }
                    var g = at + rel.slice(0, cut + 1);
                    if (!byG[g]) { byG[g] = { path: g, members: [] }; out2.groups.push(byG[g]); }
                    byG[g].members.push(n);
                });
                return out2;
            }
            var first = split(own, prefix);
            var groups = first.groups;
            var singles = first.singles;
            var count = function () { return groups.reduce(function (c, g) { return c + (g.members.length >= 2 ? 1 : g.members.length); }, 0) + singles.length; };
            var target = Math.round(L.collapseAbove * 0.6);
            var stuck = Object.create(null);
            for (var guard = 0; guard < 200 && count() < target; guard++) {
                var big = groups.filter(function (g) { return !stuck[g.path] && g.members.length >= 2; }).sort(function (x, y) { return y.members.length - x.members.length; })[0];
                if (!big) break;
                var parts = split(big.members, big.path);
                var grown = count() - 1 + parts.groups.reduce(function (c, g) { return c + (g.members.length >= 2 ? 1 : 1); }, 0) + parts.singles.length;
                if (grown > L.collapseAbove || (parts.groups.length <= 1 && !parts.singles.length)) {
                    if (parts.groups.length === 1 && !parts.singles.length) { big.path = parts.groups[0].path; continue; }
                    stuck[big.path] = true;
                    continue;
                }
                groups.splice(groups.indexOf(big), 1);
                groups = groups.concat(parts.groups);
                singles = singles.concat(parts.singles);
            }
            // Still over the line: the files right in the common folder become one node, and so do
            // the files from outside the area that are drawn for context.
            var outside = nodes.filter(function (n) { return n.outside && n.idx !== state.file; });
            if (count() + outside.length > target && singles.length >= 2) { groups.push({ path: prefix + '\u0000', members: singles, own: true }); singles = []; }
            if (count() + outside.length > target && outside.length >= 2) groups.push({ path: '\u0000outside', members: outside, outside: true });
            var folded = Object.create(null);
            var maxCount = 1;
            groups.forEach(function (g) { if (g.members.length >= 2) maxCount = Math.max(maxCount, g.members.length); });
            result = [];
            groups.forEach(function (g) {
                var members = g.members;
                if (state.superOpen[key + '|' + g.path] || members.length < 2) return;
                var sx = 0;
                var sy = 0;
                members.forEach(function (n) { sx += n.x; sy += n.y; folded[n.idx] = true; });
                var label = g.outside ? t('outsideArea') : g.own ? (base(prefix.slice(0, -1)) || '.') + '/ ' + t('folderFiles') : g.path.slice(prefix.length);
                var node = { kind: 'super', idx: superList.length, x: sx / members.length, y: sy / members.length, r: 7 + 16 * Math.sqrt(members.length / maxCount), label: label + ' · ' + members.length, weight: 1e5 + members.length, members: members.map(function (n) { return n.idx; }) };
                superList.push({ key: g.path, node: node });
                members.forEach(function (n) { superOf[n.idx] = node; });
                result.push(node);
            });
            nodes.forEach(function (n) { if (!folded[n.idx]) result.push(n); });
        }
        window.__mapSuper = { area: key, on: on, zoomed: state.superZoom, scale: state.view.scale, nodes: nodes.length, supers: superList.length, limits: L };
        return result;
    }

    function draw() {
        if (state.lens !== 'graph') return;
        var s = size();
        // Clear the bitmap itself: a CSS-sized clear misses whatever the rounded bitmap holds beyond it.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        var nodes = currentNodes();
        var pos = Object.create(null);
        if (state.orb) {
            var byReach = nodes.slice().sort(function (a, b) { return (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y) || a.idx - b.idx; });
            var share = Object.create(null);
            byReach.forEach(function (n, i) { share[n.kind + n.idx] = (i + 0.5) / byReach.length; });
            var turn = Object.create(null);
            nodes.slice().sort(function (a, b) { return Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x) || a.idx - b.idx; })
                .forEach(function (n, i) { turn[n.kind + n.idx] = i / nodes.length; });
            var k = orbRadius();
            var fit = Math.min(1, k / 300);
            var cx = s.w / 2 + state.view.x;
            var cyy = s.h / 2 + state.view.y;
            nodes.forEach(function (n) {
                var p = orbPoint(share[n.kind + n.idx], turn[n.kind + n.idx]);
                n.u = p;
                n.sx = cx + p[0] * k;
                n.sy = cyy + p[1] * k;
                n.depth = p[2];
                n.r = n.r * fit * (0.6 + 0.4 * (p[2] + 1) / 2);
                pos[n.kind + n.idx] = n;
            });
            var nearNodes = nodes.filter(function (n) { return n.depth > 0; });
            if (nearNodes.length <= 400) {
                nearNodes.forEach(function (n) {
                    var gap = Infinity;
                    nearNodes.forEach(function (o) { if (o !== n) gap = Math.min(gap, Math.hypot(o.sx - n.sx, o.sy - n.sy)); });
                    if (gap < Infinity) n.r = Math.max(2, Math.min(n.r, gap * 0.45));
                });
            }
            nodes.sort(function (a, b) { return a.depth - b.depth || a.idx - b.idx; });
            var glow = ctx.createRadialGradient(cx - k * 0.35, cyy - k * 0.35, k * 0.1, cx, cyy, k);
            glow.addColorStop(0, cssVar('--orb-light'));
            glow.addColorStop(1, cssVar('--orb-dark'));
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cyy, k, 0, Math.PI * 2);
            ctx.fill();
        } else {
            nodes.forEach(function (n) {
                var p = toScreen(n.x, n.y, state.level === 'overview');
                n.sx = p[0];
                n.sy = p[1];
                pos[n.kind + n.idx] = n;
            });
            if (state.level === 'overview') separate(nodes, 14);
        }
        function nearness(a) { return state.orb ? 0.28 + 0.72 * (a.depth + 1) / 2 : 1; }

        var edge = cssVar('--edge');
        var brand = cssVar('--brand');
        var amber = cssVar('--amber');
        var blastMode = state.colorBy === 'blast';
        ctx.lineCap = 'round';
        nodes.forEach(function (n) { n.deg = 0; });
        if (state.level === 'overview') {
            var selArea = state.file >= 0 ? files[state.file].area : state.area;
            model.areaEdges.forEach(function (e) {
                var a = pos['area' + e[0]];
                var b = pos['area' + e[1]];
                if (!a || !b || !state.showTrusted) return;
                var touch = blastMode && (e[0] === selArea || e[1] === selArea);
                var hot = touch && areaHits(e[0]) > 0 && areaHits(e[1]) > 0;
                ctx.strokeStyle = hot ? amber : touch ? brand : edge;
                ctx.lineWidth = (0.6 + Math.log(e[2] + 1) / Math.LN2 * 0.55) * Math.min(2, Math.sqrt(state.view.scale));
                ctx.globalAlpha = (nearness(a) + nearness(b)) / 2;
                ctx.beginPath();
                ctx.moveTo(a.sx, a.sy);
                ctx.lineTo(b.sx, b.sy);
                ctx.stroke();
                a.deg += 1; b.deg += 1;
            });
            ctx.globalAlpha = 1;
        } else {
            var seenPair = Object.create(null);
            var drawEdges = function (list, dashed) {
                ctx.setLineDash(dashed ? [4, 4] : []);
                list.forEach(function (e) {
                    var a = pos['file' + e[0]] || (superOf[e[0]] && pos['super' + superOf[e[0]].idx]);
                    var b = pos['file' + e[1]] || (superOf[e[1]] && pos['super' + superOf[e[1]].idx]);
                    if (!a || !b || a === b) return;
                    var pairKey = a.kind + a.idx + '>' + b.kind + b.idx;
                    a.deg += 1; b.deg += 1;
                    if ((a.kind === 'super' || b.kind === 'super') && seenPair[pairKey]) return;
                    seenPair[pairKey] = true;
                    var toSel = e[1] === state.file;
                    ctx.strokeStyle = toSel && blastMode ? brand : edge;
                    ctx.lineWidth = toSel ? 1.6 : 0.9;
                    ctx.globalAlpha = (nearness(a) + nearness(b)) / 2;
                    ctx.beginPath();
                    ctx.moveTo(a.sx, a.sy);
                    ctx.lineTo(b.sx, b.sy);
                    ctx.stroke();
                });
                ctx.globalAlpha = 1;
                ctx.setLineDash([]);
            };
            if (state.showTrusted) drawEdges(model.edges, false);
            if (state.showGuesses) drawEdges(model.guessEdges, true);
        }

        // What a node has but the view does not draw: edges to areas or files left out, or
        // switched off. A node with such edges and none drawn says so instead of looking alone.
        var hidden = Object.create(null);
        nodes.forEach(function (n) {
            var real = 0;
            if (n.kind === 'area') model.areaEdges.forEach(function (e) { if (e[0] === n.idx || e[1] === n.idx) real += 1; });
            else if (n.kind === 'file') real = outOf[n.idx].length + inOf[n.idx].length;
            else return;
            n.hidden = Math.max(0, real - n.deg);
            if (n.hidden) hidden[n.kind + n.idx] = n.hidden;
        });
        window.__mapHidden = hidden;

        var nodeStroke = cssVar('--nodeStroke');
        var bg = cssVar('--bg');
        var glowA = Number(cssVar('--glow')) || 0.5;
        var scopeDim = state.scopeDir;
        drawn = [];
        labelHits = [];
        nodes.forEach(function (n) {
            var colour;
            var isTest = false;
            var sel = false;
            if (n.kind === 'area') {
                colour = resolveColour(areaColour(n.idx));
                sel = state.file >= 0 ? files[state.file].area === n.idx : state.area === n.idx;
            } else if (n.kind === 'super') {
                colour = resolveColour(areaColour(state.area));
            } else {
                var f = files[n.idx];
                isTest = f.role === 'test';
                colour = n.outside && !blastMode ? resolveColour('var(--node)') : resolveColour(fileColour(n.idx));
                sel = n.idx === state.file;
            }
            var alpha = nearness(n);
            if (scopeDim && n.kind === 'file' && files[n.idx].path.indexOf(scopeDim + '/') !== 0) alpha *= 0.35;
            if (scopeDim && n.kind === 'area' && !areaInDir(n.idx, scopeDim)) alpha *= 0.35;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(n.sx, n.sy, n.r, 0, Math.PI * 2);
            if (sel || (blastMode && n.kind === 'area' && colour === resolveColour('var(--amber)'))) {
                ctx.shadowColor = sel ? brand : amber;
                ctx.shadowBlur = (sel ? 10 : 6) * glowA * 1.4;
            }
            if (isTest) {
                ctx.fillStyle = bg;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = colour;
                ctx.stroke();
            } else {
                ctx.fillStyle = colour;
                ctx.fill();
                ctx.lineWidth = n.kind === 'area' ? 1.5 : 1;
                ctx.strokeStyle = colour === resolveColour('var(--node)') ? nodeStroke : colour;
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
            if (n.kind === 'area' && touchedArea[n.idx]) { ctx.lineWidth = 2.5; ctx.strokeStyle = cssVar('--cyan'); ctx.stroke(); }
            if (n.kind === 'file' && changedSet[n.idx]) { ctx.lineWidth = 2.5; ctx.strokeStyle = cssVar('--cyan'); ctx.stroke(); }
            if (n.kind === 'area' && n.r > 11) {
                ctx.font = '600 ' + Math.round(Math.min(16, Math.max(10, n.r / 2))) + 'px ' + cssVar('--monof');
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                var light = colour === resolveColour('var(--node)');
                ctx.fillStyle = light ? cssVar('--soft') : cssVar('--onColor');
                ctx.fillText(areas[n.idx].id, n.sx, n.sy + 1);
                ctx.textAlign = 'left';
            }
            if (n.kind === 'super') {
                ctx.setLineDash([3, 3]);
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = colour;
                ctx.beginPath();
                ctx.arc(n.sx, n.sy, n.r + 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.globalAlpha = 1;
            if (!state.orb || n.depth > 0) drawn.push({ kind: n.kind, idx: n.idx, x: n.sx, y: n.sy, r: Math.max(n.r, 8), deg: n.deg });
        });
        drawLabels(state.orb ? nodes.filter(function (n) { return n.depth > 0.15; }) : nodes, s, blastMode);
        window.__mapOrbNodes = state.orb ? nodes.map(function (n) { return { kind: n.kind, idx: n.idx, x: n.sx, y: n.sy, r: n.r, near: n.depth > 0, u: n.u, deg: n.deg }; }) : [];
        renderFoot();
        // The footer just written can change the stage's size. Draw again at once at the new size, so what is
        // drawn, what a click hits and what __mapView reports never come from a stage that no longer exists.
        var after = size();
        if ((after.w !== s.w || after.h !== s.h) && redrawDepth < 2) {
            redrawDepth += 1;
            resize();
            redrawDepth -= 1;
        }
    }
    var redrawDepth = 0;

    /**
     * Area bubbles laid out by community can sit on top of each other; push
     * overlapping pairs apart along the line between them, a few rounds, so
     * every bubble and its id stays readable. Deterministic: same input, same picture.
     */
    function separate(nodes, gap) {
        for (var round = 0; round < 40; round++) {
            var moved = false;
            for (var i = 0; i < nodes.length; i++) {
                for (var j = i + 1; j < nodes.length; j++) {
                    var a = nodes[i]; var b = nodes[j];
                    var dx = b.sx - a.sx; var dy = b.sy - a.sy;
                    var d = Math.hypot(dx, dy);
                    var need = a.r + b.r + gap;
                    if (d >= need) continue;
                    if (d < 0.01) { dx = (j - i) % 2 ? 1 : -1; dy = 0.5; d = Math.hypot(dx, dy); }
                    var push = (need - d) / 2;
                    a.sx -= dx / d * push; a.sy -= dy / d * push;
                    b.sx += dx / d * push; b.sy += dy / d * push;
                    moved = true;
                }
            }
            if (!moved) break;
        }
    }

    // Labels sit below their node with a halo, biggest first, only where they fit,
    // never outside the canvas, never on top of another label; badges likewise.
    function drawLabels(nodes, s, blastMode) {
        var narrow = s.w < 600;
        var order = nodes.slice().sort(function (a, b) { return b.weight - a.weight || a.idx - b.idx; });
        var limit = state.level === 'overview' ? (narrow ? 8 : 60) : (narrow ? 12 : 80);
        var placed = [];
        var text = cssVar('--text');
        var soft = cssVar('--soft');
        var brandText = cssVar('--brandText');
        var bg = cssVar('--bg');
        var mono = cssVar('--monof');
        var sans = cssVar('--sans');
        var count = 0;
        // Bubbles are obstacles too: a label never lies across another bubble.
        var bubbles = state.level === 'overview' ? nodes.map(function (n) { return { x: n.sx - n.r, y: n.sy - n.r, w: 2 * n.r, h: 2 * n.r, idx: n.idx }; }) : [];
        var owner = -1;
        function hits(box, p) { return box.x < p.x + p.w && p.x < box.x + box.w && box.y < p.y + p.h && p.y < box.y + box.h; }
        function fits(box) {
            if (box.x < 2 || box.y < 2 || box.x + box.w > s.w - 2 || box.y + box.h > s.h - 2) return false;
            if (bubbles.some(function (b) { return b.idx !== owner && hits(box, b); })) return false;
            return !placed.some(function (p) { return hits(box, p); });
        }
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        for (var i = 0; i < order.length && count < limit; i++) {
            var n = order[i];
            var sel = n.kind === 'file' && n.idx === state.file;
            owner = n.idx;
            ctx.font = n.kind === 'area' || n.kind === 'super' ? '600 12px ' + sans : (sel ? '600' : '500') + ' 11px ' + mono;
            var label = n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label;
            var w = ctx.measureText(label).width;
            // The hub file goes under the title once the reader zooms in, or when the area holds affected files.
            var sub = n.kind === 'area' && (state.view.scale > 1.5 || (blastMode && areaHits(n.idx) > 0)) ? n.sub : '';
            if (sub && sub.length > 40) sub = '…' + sub.slice(-39);
            var sw = 0;
            if (sub) { ctx.font = '400 10px ' + mono; sw = ctx.measureText(sub).width; ctx.font = '600 12px ' + sans; }
            var bw = Math.max(w, sw);
            var h = sub ? 27 : 14;
            var box = { x: n.sx - bw / 2 - 2, y: n.sy + n.r + 4, w: bw + 4, h: h };
            if (!fits(box)) {
                box = { x: n.sx + n.r + 4, y: n.sy - h / 2, w: bw + 4, h: h };
                if (!fits(box)) continue;
            }
            placed.push(box);
            labelHits.push({ x: box.x, y: box.y, w: box.w, h: box.h, kind: n.kind, idx: n.idx });
            var cx = box.x + 2 + (bw - w) / 2;
            ctx.strokeStyle = bg;
            ctx.lineWidth = 4;
            ctx.strokeText(label, cx, box.y + 7);
            ctx.fillStyle = n.kind === 'area' || n.kind === 'super' ? text : sel ? brandText : soft;
            ctx.fillText(label, cx, box.y + 7);
            if (sub) {
                ctx.font = '400 10px ' + mono;
                var sx = box.x + 2 + (bw - sw) / 2;
                ctx.strokeText(sub, sx, box.y + 20);
                ctx.fillStyle = cssVar('--muted');
                ctx.fillText(sub, sx, box.y + 20);
            }
            count += 1;
        }
        if (blastMode && state.level === 'overview') {
            ctx.font = '600 11px ' + mono;
            nodes.forEach(function (n) {
                owner = n.idx;
                var hits = areaHits(n.idx);
                if (!hits || n.r <= 12 || (state.file >= 0 && files[state.file].area === n.idx)) return;
                var txt = String(hits);
                var w = ctx.measureText(txt).width + 16;
                var box = { x: n.sx + n.r - 6, y: n.sy - n.r - 10, w: w, h: 18 };
                if (!fits(box)) return;
                placed.push(box);
                labelHits.push({ x: box.x, y: box.y, w: box.w, h: box.h, kind: n.kind, idx: n.idx });
                ctx.fillStyle = bg;
                ctx.strokeStyle = cssVar('--amber');
                ctx.lineWidth = 1;
                roundRect(box.x, box.y, box.w, box.h, 9);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = cssVar('--amberText');
                ctx.fillText(txt, box.x + 8, box.y + 9);
            });
        }
        ctx.font = '600 10px ' + mono;
        nodes.forEach(function (n) {
            var sel = n.kind === 'file' ? n.idx === state.file : n.idx === (state.file >= 0 ? files[state.file].area : state.area);
            if (!n.hidden || (n.deg && !sel)) return;
            owner = n.idx;
            var txt = t('hiddenEdges')(num(n.hidden));
            var w = ctx.measureText(txt).width + 12;
            var box = { x: n.sx + n.r + 2, y: n.sy + n.r - 4, w: w, h: 16 };
            if (!fits(box)) return;
            placed.push(box);
            labelHits.push({ x: box.x, y: box.y, w: box.w, h: box.h, kind: n.kind, idx: n.idx });
            ctx.fillStyle = bg;
            ctx.strokeStyle = cssVar('--line2');
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            roundRect(box.x, box.y, box.w, box.h, 8);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = cssVar('--muted');
            ctx.fillText(txt, box.x + 6, box.y + 8);
        });
        window.__mapLabelBoxes = { boxes: placed, labels: labelHits.slice(), width: s.w, height: s.h };
        exposeView();
    }
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /** What a click at (x, y) reaches: a painted name first — it lies over the drawing — then the nearest node. */
    function hitTest(x, y) {
        for (var i = labelHits.length - 1; i >= 0; i--) {
            var l = labelHits[i];
            if (x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) return { kind: l.kind, idx: l.idx };
        }
        var best = null;
        var bestD = Infinity;
        drawn.forEach(function (d) {
            var dist = Math.hypot(d.x - x, d.y - y);
            if (dist <= d.r && dist < bestD) { best = d; bestD = dist; }
        });
        return best;
    }

    // Left rail.
    var locTotal = 0;
    var hasLoc = false;
    files.forEach(function (f) { if (f.loc !== undefined) { hasLoc = true; locTotal += f.loc; } });
    function compact(n) {
        if (n < 1e6) return num(n);
        return (n / 1e6).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 }) + ' M';
    }
    var HEALTH_PARTS = [['dead', 'pDead', 'missDead', function (v) { return pct(v.value); }], ['hotspots', 'pHotspots', 'missHot', function (v) { return pct(v.value); }],
        ['cycles', 'pCycles', '', function (v) { return num(v.value); }], ['guesses', 'pGuesses', '', function (v) { return pct(v.value); }]];
    /** The part that costs the most points: the one a fix would move furthest. */
    function largestLever(parts) {
        var best = null;
        HEALTH_PARTS.forEach(function (p) {
            var v = parts[p[0]];
            if (v && (!best || 25 - v.points > 25 - best[1].points)) best = [p, v];
        });
        return best && best[1].points < 25 ? best : null;
    }
    function renderRail() {
        var h = $('health');
        clear(h);
        var health = model.health;
        var parts = health ? health.parts : null;
        var missing = parts ? HEALTH_PARTS.filter(function (p) { return !parts[p[0]]; }).length : 4;
        var graded = !!(health && health.grade);
        var ring = el('div', { class: 'ring' + (graded ? '' : ' none') });
        if (graded) ring.style.background = 'conic-gradient(var(--amber) 0 ' + health.score + '%, var(--line) ' + health.score + '% 100%)';
        add(ring, add(el('div', { class: 'ring-in' }), el('span', { class: 'grade' }, graded ? health.grade : '–'), graded ? el('span', { class: 'mono score' }, num(health.score)) : null));
        var title = add(el('div', { class: 'health-title' }), el('b', null, t('health')),
            el('span', null, graded ? t('healthScale') : t('noGrade')(missing)));
        var fbtn = el('button', { type: 'button', class: 'linkish', 'aria-expanded': String(state.formula), title: health ? health.formula : null }, state.formula ? t('hideFormula') : t('formula'));
        fbtn.addEventListener('click', function () { state.formula = !state.formula; renderRail(); });
        title.appendChild(fbtn);
        add(h, add(el('div', { class: 'health-head' }), ring, title));
        if (state.formula && health) h.appendChild(el('div', { class: 'formula', id: 'formel' }, health.formula));
        var list = el('div', { class: 'parts' });
        HEALTH_PARTS.forEach(function (p) {
            var v = parts ? parts[p[0]] : null;
            if (!v && !parts && p[0] === 'cycles') v = { value: an.cyclesTotal, points: null };
            if (!v && !parts && p[0] === 'guesses') v = { value: an.guessShare, points: null };
            if (!v) {
                list.appendChild(add(el('div', { class: 'part missing' }), el('span', null, t(p[1])), el('span', { class: 'dashchip mono' }, t(p[2] || 'noDataShort'))));
                return;
            }
            var row = el('div', { class: 'part' });
            var pts = el('span', { class: 'mono pts' }, v.points == null ? '–' : num(v.points) + '/25');
            add(row, el('span', null, t(p[1])), el('span', { class: 'mono' }, p[3](v)), pts);
            var b = el('div', { class: 'bar' });
            var i = el('i');
            var share = v.points == null ? 0 : v.points / 25;
            i.style.width = Math.max(0, Math.min(100, share * 100)) + '%';
            i.style.background = share >= 0.8 ? 'var(--green)' : share >= 0.5 ? 'var(--amber)' : 'var(--brand)';
            if (share < 0.5) pts.style.color = 'var(--brandText)';
            b.appendChild(i);
            row.appendChild(b);
            list.appendChild(row);
        });
        var lever = parts ? largestLever(parts) : null;
        if (lever) list.appendChild(el('span', { class: 'note-line lever' }, t('lever')(t(lever[0][1]), num(Math.round((25 - lever[1].points) * 10) / 10))));
        h.appendChild(list);

        var k = $('kpis');
        clear(k);
        var tiles = el('div', { class: 'tiles' });
        function tile(v, label, small, noData) {
            var d = el('div', { class: 'tile' + (noData ? ' nodata' : '') });
            var vv = el('div', { class: 'v' }, v);
            if (small) vv.appendChild(el('small', null, small));
            add(d, vv, el('div', { class: 'cap' }, label));
            if (noData) { d.appendChild(el('span', { class: 'nodata-tag' }, t('noDataShort'))); d.setAttribute('title', t('noDataTitle')(noData)); }
            tiles.appendChild(d);
        }
        tile(num(files.length), t('tFiles'));
        tile(hasLoc ? compact(locTotal) : '–', t('tLines'), null, hasLoc ? null : t('hTreemapMissing'));
        tile(num(an.trustedEdges), t('tTrusted'));
        tile(num(areas.length), t('tAreas'));
        tile(an.deadFiles !== undefined ? num(an.deadFiles) : '–', t('deadFiles'), null, an.deadFiles !== undefined ? null : (an.deadBasis || t('noDataUnknown')));
        tile(num(an.requestPathsResolved), t('tRoutes'), '/' + num(an.requestPathsTotal));
        k.appendChild(tiles);
        k.appendChild(languageBlock());
        var rc = an.roleCounts;
        var codeN = 0;
        Object.keys(SCOPE_CODE).forEach(function (r) { codeN += rc[r] || 0; });
        var roleRows = [['doc', rc.doc || 0, 'var(--doc)'], ['test', rc.test || 0, 'var(--green)'], ['code', codeN, 'var(--cyan)'],
            [t('other'), files.length - (rc.doc || 0) - (rc.test || 0) - codeN, 'var(--violet)']];
        k.appendChild(stackBlock(t('roles'), roleRows, files.length, true));
        var tot = an.trustedEdges + an.guessEdgeCount;
        var trust = add(el('div', { class: 'parts' }), el('span', { class: 'cap' }, t('trust')));
        var st = el('div', { class: 'stack' });
        var a1 = el('i'); a1.style.width = (tot ? an.trustedEdges / tot * 100 : 0) + '%'; a1.style.background = 'var(--cyan)';
        var a2 = el('i', { class: 'hatch' }); a2.style.width = (tot ? an.guessEdgeCount / tot * 100 : 0) + '%';
        add(st, a1, a2);
        add(trust, st, add(el('div', { class: 'between' }), el('span', null, t('sure') + ' ' + num(an.trustedEdges)), el('span', null, t('guessed') + ' ' + num(an.guessEdgeCount))));
        k.appendChild(trust);

        var c = $('colorby');
        clear(c);
        c.appendChild(el('span', { class: 'cap' }, t('colorBy')));
        var group = el('div', { class: 'opts', role: 'radiogroup', 'aria-label': t('colorBy') });
        var legendByKey = Object.create(null);
        (model.legend || []).forEach(function (l) { legendByKey[l.key] = l; });
        [['blast', 'cBlast', t('hBlast')], ['area', 'cArea', t('hArea')], ['tests', 'cTests', t('hTests')], ['role', 'cRole', t('hRole')],
            ['churn', 'cChurn', t('hChurn')(WINDOW)], ['size', 'cSize', t('hSize'), 'size'], ['folder', 'cFolder', t('hFolderA')], ['layer', 'cLayer'], ['domain', 'cDomain'], ['complexity', 'cComplexity']].forEach(function (o) {
            var lg = legendByKey[o[3] || o[0]];
            var off = lg ? !lg.available : (o[0] === 'layer' || o[0] === 'domain' || o[0] === 'churn' || o[0] === 'complexity' || (o[0] === 'size' && !hasLoc));
            var b = el('button', { type: 'button', role: 'radio', class: 'opt', 'aria-checked': String(state.colorBy === o[0]), disabled: off, title: off ? '' : (o[2] || '') }, t(o[1]));
            if (off) markNoData(b, t('noDataShort'), lg && lg.reason ? lg.reason : t('noDataUnknown'));
            b.addEventListener('click', function () { if (!off) { state.colorBy = o[0]; refresh(); } });
            group.appendChild(b);
        });
        c.appendChild(group);
        renderExplorer();
    }
    /** Lines per language, the three largest by name and the rest as one share. */
    function languageBlock() {
        var langs = (model.languages || []).filter(function (l) { return l[2] > 0; });
        var total = 0;
        langs.forEach(function (l) { total += l[2]; });
        if (!total) {
            var miss = add(el('div', { class: 'parts' }), el('span', { class: 'cap' }, t('langs')), el('span', { class: 'dashchip mono' }, t('noDataShort')));
            miss.setAttribute('title', t('noDataTitle')(t('hTreemapMissing')));
            return miss;
        }
        var colours = ['var(--cyan)', 'var(--amber)', 'var(--green)'];
        var fixed = { markdown: 'var(--doc)', typescript: 'var(--cyan)', javascript: 'var(--amber)' };
        var used = Object.create(null);
        langs.slice(0, 3).forEach(function (l) { if (fixed[l[0]]) used[fixed[l[0]]] = true; });
        var free = colours.filter(function (c) { return !used[c]; });
        var rows = [];
        langs.slice(0, 3).forEach(function (l) { rows.push([langName(l[0]), l[2], fixed[l[0]] || free.shift() || 'var(--green)', langName(l[0], true)]); });
        var rest = 0;
        langs.slice(3).forEach(function (l) { rest += l[2]; });
        if (rest) rows.push([t('langMore')(langs.length - 3), rest, 'var(--violet)']);
        return stackBlock(t('langs'), rows, total, true);
    }
    var LANG_NAMES = { typescript: ['TypeScript', 'TS'], javascript: ['JavaScript', 'JS'], markdown: ['Markdown'], php: ['PHP'], python: ['Python'], go: ['Go'], java: ['Java'], ruby: ['Ruby'], rust: ['Rust'], csharp: ['C#'], kotlin: ['Kotlin'], swift: ['Swift'], html: ['HTML'], css: ['CSS'], vue: ['Vue'], svelte: ['Svelte'], sql: ['SQL'], shell: ['Shell'], yaml: ['YAML'], json: ['JSON'] };
    /** A language's display name; `short` is the key label, which the design abbreviates for JavaScript only. */
    function langName(id, short) {
        var n = LANG_NAMES[String(id).toLowerCase()];
        if (!n) return String(id);
        return short && id === 'javascript' ? n[1] : n[0];
    }
    function stackBlock(title, rows, total, keys) {
        var wrap = add(el('div', { class: 'parts' }), el('span', { class: 'cap' }, title));
        var st = el('div', { class: 'stack' });
        rows.forEach(function (r) {
            if (!r[1]) return;
            var i = el('i', { title: r[0] + ' ' + num(r[1]) });
            i.style.width = (r[1] / Math.max(1, total) * 100) + '%';
            if (r[2].indexOf('hatch') === 0) i.className = r[2]; else i.style.background = r[2];
            st.appendChild(i);
        });
        wrap.appendChild(st);
        if (keys) {
            var kk = el('div', { class: 'keys' });
            rows.forEach(function (r) {
                if (!r[1]) return;
                var s = el('span');
                var sw = el('span', { class: 'sw' });
                sw.style.background = r[2];
                add(s, sw, document.createTextNode((r[3] || r[0]) + ' ' + pct(r[1] / Math.max(1, total))));
                kk.appendChild(s);
            });
            wrap.appendChild(kk);
        }
        return wrap;
    }

    // Explorer: a folder tree over the file paths, with counts; a folder sets the scope.
    var tree = { n: 0, kids: Object.create(null), files: [] };
    files.forEach(function (f, i) {
        var parts = f.path.split('/');
        var node = tree;
        node.n += 1;
        for (var k = 0; k < parts.length - 1; k++) {
            var p = parts[k];
            node = node.kids[p] || (node.kids[p] = { n: 0, kids: Object.create(null), files: [] });
            node.n += 1;
        }
        node.files.push(i);
    });
    function renderExplorer() {
        var x = $('explorer');
        clear(x);
        var head = add(el('div', { class: 'explorer-head' }), el('span', { class: 'cap' }, t('explorer')));
        if (state.scopeDir) {
            var chip = el('button', { type: 'button', class: 'scope', title: state.scopeDir }, t('scope') + ': ' + state.scopeDir + ' ×');
            chip.addEventListener('click', function () { state.scopeDir = ''; refresh(); });
            head.appendChild(chip);
        }
        x.appendChild(head);
        var box = el('div', { class: 'tree', role: 'tree' });
        var rows = 0;
        function walkTree(node, prefix, depth) {
            Object.keys(node.kids).sort().forEach(function (name) {
                if (rows > 400) return;
                var kid = node.kids[name];
                var p = prefix ? prefix + '/' + name : name;
                var openNow = !!state.open[p];
                var b = el('button', { type: 'button', class: state.scopeDir === p ? 'on' : '', 'aria-expanded': String(openNow) });
                b.style.paddingLeft = (6 + depth * 14) + 'px';
                add(b, el('span', null, (openNow ? '▾ ' : '▸ ') + name + '/'), el('span', { class: 'n' }, num(kid.n)));
                b.addEventListener('click', function () {
                    state.open[p] = !state.open[p];
                    state.scopeDir = state.open[p] ? p : (state.scopeDir === p ? '' : state.scopeDir);
                    refresh();
                });
                box.appendChild(b);
                rows += 1;
                if (openNow) {
                    walkTree(kid, p, depth + 1);
                    listFiles(kid.files, depth + 1);
                }
            });
        }
        function listFiles(list, depth) {
            list.slice(0, 60).forEach(function (i) {
                var fb = el('button', { type: 'button', class: i === state.file ? 'sel' : '' });
                fb.style.paddingLeft = (6 + depth * 14) + 'px';
                add(fb, el('span', null, (i === state.file ? '● ' : '') + base(files[i].path)), el('span', { class: 'n' }, files[i].role));
                fb.addEventListener('click', function () { openFile(i); });
                box.appendChild(fb);
                rows += 1;
            });
            if (list.length > 60) {
                var more = el('div', { class: 'muted' }, t('moreFiles')(num(list.length - 60)));
                more.style.paddingLeft = (6 + depth * 14) + 'px';
                box.appendChild(more);
            }
        }
        walkTree(tree, '', 0);
        if (tree.files && tree.files.length) listFiles(tree.files, 0);
        x.appendChild(box);
    }

    // Center: lens tabs, filters, crumbs, legend, footer.
    function renderLensBar() {
        var bar = $('lenses');
        clear(bar);
        var hasLoc = files.some(function (f) { return f.loc !== undefined; });
        [['graph', 'lGraph', ''], ['layers', 'lLayers', 'hLayers'], ['matrix', 'lMatrix', 'hMatrix'], ['knowledge', 'lKnowledge', 'hKnowledge'],
            ['treemap', 'lTreemap', hasLoc ? 'hTreemap' : 'hTreemapMissing', !hasLoc], ['flow', 'lFlow', 'hFlow', true]].forEach(function (o) {
            var b = el('button', { type: 'button', role: 'tab', class: 'lens', 'aria-selected': String(state.lens === o[0]), disabled: !!o[3], title: o[2] ? t(o[2]) : '' }, t(o[1]));
            if (o[3]) markNoData(b, o[0] === 'flow' ? t('noViewAbbr') : t('noDataShort'), t(o[2]));
            b.addEventListener('click', function () { if (!o[3] && state.lens !== o[0]) { step(); state.lens = o[0]; refresh(); } });
            bar.appendChild(b);
        });
    }
    function renderCrumbs() {
        var c = $('crumbs');
        clear(c);
        function btn(text, fn) { var b = el('button', { type: 'button' }, text); if (fn) b.addEventListener('click', fn); else b.disabled = true; return b; }
        if (trail.length) {
            var bk = btn(t('navBack'), back);
            bk.id = 'nav-back';
            bk.className = 'nav-back';
            c.appendChild(bk);
        }
        c.appendChild(btn(t('repo'), goHome));
        c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
        var sel = state.file >= 0 ? base(files[state.file].path) : '';
        if (state.lens === 'graph') {
            var shown = limitCount();
            if (state.level === 'area') {
                c.appendChild(btn('Areas', goHome));
                c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
                c.appendChild(btn(t('crumbArea')(areas[state.area].id, areaTitle(areas[state.area]), num(areas[state.area].files.length))));
            } else {
                c.appendChild(btn(t('areasOf')(shown, areas.length)));
                c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
                c.appendChild(btn(t('overview')));
            }
        } else {
            var atStart = !state.treePath && !state.cell;
            c.appendChild(btn('Areas', goHome));
            c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
            var label = state.lens === 'matrix' ? t('crumbMatrix')(Math.min(15, areas.length)) : state.lens === 'layers' && sel ? t('crumbLayers')(sel) : state.lens === 'knowledge' && sel ? t('crumbKnow')(sel) : t({ layers: 'lLayers', matrix: 'lMatrix', knowledge: 'lKnowledge', treemap: 'lTreemap' }[state.lens]);
            var home = btn(label, atStart ? null : lensHome);
            home.className = 'lens-home';
            c.appendChild(home);
            if (state.lens === 'treemap' && state.treePath) {
                var acc = '';
                state.treePath.split('/').forEach(function (seg) {
                    acc = acc ? acc + '/' + seg : seg;
                    var target = acc;
                    c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
                    c.appendChild(btn(seg, function () { step(); state.treePath = target; refresh(); }));
                });
            }
        }
    }
    function legendItem(label, sw) { var s = el('span', { class: 'item' }); add(s, sw, document.createTextNode(label)); return s; }
    function renderLegend() {
        var L = $('legend');
        clear(L);
        add(L, el('b', null, t('legend')), el('span', { class: 'muted' }, state.level === 'area' ? t('sizeArea') : t('sizeOverview')));
        if (state.colorBy === 'blast' && state.file < 0) {
            L.appendChild(el('span', { class: 'muted' }, t('lgPick')));
        } else if (state.colorBy === 'blast') {
            L.appendChild(legendItem(t('lgSel'), dotEl('', 'var(--brand)')));
            if (state.level === 'overview') {
                L.appendChild(legendItem(t('lgHasHit'), dotEl('', 'var(--amber)')));
            } else {
                L.appendChild(legendItem(t('lgD1'), dotEl('', 'var(--amber)')));
                L.appendChild(legendItem(t('lgD2'), dotEl('', 'var(--sand)')));
                L.appendChild(legendItem(t('lgD3'), dotEl('', 'var(--d3)')));
            }
            L.appendChild(legendItem(t('lgNotHit'), dotEl('', 'var(--node)')));
            if (state.level === 'area') L.appendChild(legendItem(t('lgRing'), dotEl('ring', 'var(--soft)')));
        } else if (state.colorBy === 'area') {
            var g = el('span', { class: 'dot' }); g.style.width = '30px'; g.style.borderRadius = '3px'; g.style.background = 'linear-gradient(90deg,#3ec5ff,#3ddc84,#c9a2ff,#ffc14d)';
            L.appendChild(legendItem(t('lgArea'), g));
        } else if (state.colorBy === 'tests') {
            var g2 = el('span', { class: 'dot' }); g2.style.width = '40px'; g2.style.borderRadius = '3px'; g2.style.background = 'linear-gradient(90deg,var(--node),var(--green))';
            L.appendChild(legendItem(t('lgTests')(pct(tsMin, 0), pct(tsMax, 0)), g2));
        } else if (state.colorBy === 'role') {
            L.appendChild(legendItem(state.level === 'area' ? 'code' : t('lgRole'), dotEl('', 'var(--cyan)')));
            if (state.level === 'area') { L.appendChild(legendItem('test', dotEl('ring', 'var(--green)'))); L.appendChild(legendItem('doc', dotEl('', 'var(--doc)'))); }
        } else if (state.colorBy === 'folder') {
            var seen = Object.create(null);
            var shownFolders = state.level === 'area' ? areas[state.area].files : overviewAreas().map(function (i) { return areas[i].hub; });
            shownFolders.forEach(function (fi) { var d = top2(files[fi].path); if (Object.keys(seen).length < 8) seen[d] = true; });
            Object.keys(seen).forEach(function (d) { L.appendChild(legendItem(d, dotEl('', cat(strHash(d))))); });
        } else if (state.colorBy === 'size') {
            var g4 = el('span', { class: 'dot' }); g4.style.width = '40px'; g4.style.borderRadius = '3px'; g4.style.background = 'linear-gradient(90deg,var(--node),var(--cyan))';
            var lr = state.level === 'area' ? [0, maxLoc] : sumRange('loc', overviewAreas());
            L.appendChild(legendItem(t('lgSize')(num(lr[0]), num(lr[1])), g4));
        } else if (state.colorBy === 'layer') {
            L.appendChild(legendItem(t('lgLayer'), dotEl('', cat(2))));
        } else if (state.colorBy === 'domain') {
            ((model.domains && model.domains.list) || []).slice(0, 8).forEach(function (d) { L.appendChild(legendItem(d.name, dotEl('', cat(strHash(d.name))))); });
        } else if (state.colorBy === 'churn') {
            var g3 = el('span', { class: 'dot' }); g3.style.width = '40px'; g3.style.borderRadius = '3px'; g3.style.background = 'linear-gradient(90deg,var(--node),var(--brand))';
            var cr = sumRange('churn', overviewAreas());
            L.appendChild(legendItem(state.level === 'area' ? t('lgChurn')(num(maxChurn)) : t('lgChurnA')(WINDOW, num(cr[0]), num(cr[1])), g3));
        }
    }
    function renderFoot() {
        var f = $('foot');
        clear(f);
        var w = selWalk();
        var hit = 0;
        if (w) for (var d = 1; d <= BLAST_DEPTH; d++) hit += w.byDepth[d].length;
        if (state.level === 'area') {
            var a = areas[state.area];
            var inside = Object.create(null);
            a.files.forEach(function (i) { inside[i] = true; });
            var ec = 0;
            model.edges.forEach(function (e) { if (inside[e[0]] && inside[e[1]]) ec += 1; });
            f.appendChild(el('span', null, t('filesIn')(num(a.files.length), a.id)));
            f.appendChild(el('span', null, t('edgesIn')(num(ec), a.id)));
        } else if (state.lens === 'graph') {
            var shownList = overviewAreas();
            var shownSet = Object.create(null);
            shownList.forEach(function (i) { shownSet[i] = true; });
            var drawnEdges = model.areaEdges.filter(function (e) { return shownSet[e[0]] && shownSet[e[1]]; }).length;
            f.appendChild(el('span', null, t('visibleAreas')(num(shownList.length), num(areas.length))));
            f.appendChild(el('span', null, t('areaEdges')(num(drawnEdges))));
        }
        if (state.level === 'area' && state.lens === 'graph' && superList.length) {
            var foldedN = superList.reduce(function (n, x) { return n + x.node.members.length; }, 0);
            f.appendChild(el('span', { class: 'note' }, t('folded')(num(foldedN), num(superList.length), String(typeof SUPER_LIMITS === 'object' ? SUPER_LIMITS.zoomExpand : 2))));
        }
        f.appendChild(el('span', { class: 'hot' }, t('affected')(num(hit), t(state.scope === 'code' ? 'sCode' : state.scope === 'tests' ? 'sTests' : 'sAll'))));
        if (state.level === 'overview' && state.lens === 'graph') f.appendChild(el('span', { class: 'note' }, t('aggregated')(num(files.length), num(overviewAreas().length))));
    }

    function renderLens() {
        var graph = state.lens === 'graph';
        graphWrap.hidden = !graph;
        lensView.hidden = graph;
        $('back').hidden = !(graph && state.level === 'area');
        var offGraph = graph && state.file >= 0 && files[state.file].area < 0;
        $('hint').textContent = offGraph ? t('offGraph')(base(files[state.file].path), files[state.file].role) : state.orb ? t('hint3d') : t('hint2d');
        // The overview draws areas and their links only: these toggles act on file edges.
        var overview = graph && state.level === 'overview';
        ['t-guess', 't-tests', 't-infra'].forEach(function (id) {
            var tb = $(id);
            tb.disabled = overview;
            tb.title = overview ? t('noEffectOverview') : '';
        });
        $('lim').parentNode.hidden = state.level === 'area';
        if (state.level === 'area') { $('limlist').hidden = true; $('lim').setAttribute('aria-expanded', 'false'); }
        $('zoomtxt').textContent = 'Zoom ' + state.view.scale.toFixed(1) + '×';
        if (graph) { renderLegend(); return; }
        clear(lensView);
        if (state.lens === 'layers') renderLayers();
        else if (state.lens === 'matrix') renderMatrix();
        else if (state.lens === 'knowledge') renderKnowledge();
        else if (state.lens === 'treemap') renderTreemap();
    }

    function kindDot(f) {
        if (f.role === 'test') return dotEl('ring', 'var(--green)');
        if (f.role === 'doc') return dotEl('small', 'var(--doc)');
        return dotEl('', 'var(--cyan)');
    }
    function renderLayers() {
        if (state.file < 0) { lensView.appendChild(el('div', { class: 'box' }, t('selectFirst'))); return; }
        var w = walk(state.file, 'all');
        var head = add(el('div', { class: 'kkeys' }), add(el('span', { class: 'muted' }, t('layersHead') + ' '), el('span', { class: 'mono' }, base(files[state.file].path))));
        head.lastChild.lastChild.style.color = 'var(--brandText)';
        add(head, legendItem('code', dotEl('', 'var(--cyan)')), legendItem('test', dotEl('ring', 'var(--green)')), legendItem('doc', dotEl('small', 'var(--doc)')));
        lensView.appendChild(head);
        var cols = ['var(--brand)', 'var(--amber)', 'var(--sand)', 'var(--d3)'];
        var notes = [t('n0'), t('n1'), t('n2'), t('n3')];
        for (var d = 0; d <= BLAST_DEPTH; d++) {
            var list = w.byDepth[d];
            var c = 0; var te = 0; var dc = 0;
            list.forEach(function (i) { var r = files[i].role; if (r === 'test') te += 1; else if (r === 'doc') dc += 1; else c += 1; });
            var band = el('div', { class: 'band' });
            band.style.borderColor = 'color-mix(in srgb, ' + cols[d] + ' 40%, transparent)';
            band.style.background = 'color-mix(in srgb, ' + cols[d] + ' 8%, transparent)';
            var hd = el('div', { class: 'head' });
            var title = el('b', null, d === 0 ? t('depth0') : t('depth')(d));
            title.style.color = cols[d];
            add(hd, title, el('span', { class: 'mono soft' }, num(c) + ' code · ' + num(te) + ' test · ' + num(dc) + ' doc'), el('span', { class: 'muted' }, notes[d]));
            var dots = el('div', { class: 'dots' });
            var sorted = list.slice().sort(function (a, b) {
                var ra = files[a].role === 'doc' ? 2 : files[a].role === 'test' ? 1 : 0;
                var rb = files[b].role === 'doc' ? 2 : files[b].role === 'test' ? 1 : 0;
                return ra - rb || a - b;
            });
            var cap = 240;
            sorted.slice(0, cap).forEach(function (i) {
                var dt = kindDot(files[i]);
                dt.setAttribute('title', files[i].path);
                if (!inScope(files[i], state.scope)) dt.style.opacity = '0.3';
                dots.appendChild(dt);
            });
            if (sorted.length > cap) dots.appendChild(el('span', { class: 'mono muted' }, '+' + num(sorted.length - cap)));
            lensView.appendChild(add(band, hd, dots));
        }
    }

    function renderMatrix() {
        var n = Math.min(15, areas.length);
        var ids = [];
        for (var i = 0; i < n; i++) ids.push(i);
        var selArea = state.file >= 0 ? files[state.file].area : state.area;
        // The marked area joins the matrix; it never displaces one of the fifteen.
        if (selArea >= n) ids.push(selArea);
        var pos = Object.create(null);
        ids.forEach(function (a, k) { pos[a] = k; });
        var M = ids.map(function () { return ids.map(function () { return 0; }); });
        var strongest = [0, 0, 0];
        model.areaEdges.forEach(function (e) {
            if (e[2] > strongest[2]) strongest = e;
            if (pos[e[0]] === undefined || pos[e[1]] === undefined) return;
            M[pos[e[0]]][pos[e[1]]] = e[2];
            M[pos[e[1]]][pos[e[0]]] = e[2];
        });
        var cycleAreas = (model.violations || []).filter(function (v) { return v.kind === 'cycle'; }).map(function (v) {
            var s = Object.create(null);
            v.files.forEach(function (f) { if (files[f].area >= 0) s[files[f].area] = true; });
            return s;
        });
        function inCycle(a, b) { return a !== b && cycleAreas.some(function (s) { return s[a] && s[b]; }); }
        lensView.appendChild(el('div', { class: 'note-line' }, t('matrixHead')));
        var wrap = el('div', { class: 'matrix' });
        var grid = el('div', { class: 'mgrid' });
        var tmpl = '170px repeat(' + ids.length + ', minmax(0, 1fr))';
        var hrow = el('div', { class: 'mrow mhead' });
        hrow.style.gridTemplateColumns = tmpl;
        hrow.appendChild(el('span'));
        ids.forEach(function (a) { hrow.appendChild(el('span', { class: a === selArea ? 'sel' : '' }, areas[a].id.slice(1))); });
        grid.appendChild(hrow);
        var maxV = 1;
        M.forEach(function (r) { r.forEach(function (v) { maxV = Math.max(maxV, v); }); });
        ids.forEach(function (a, r) {
            var row = el('div', { class: 'mrow' });
            row.style.gridTemplateColumns = tmpl;
            row.appendChild(el('span', { class: 'mlabel' + (a === selArea ? ' sel' : ''), title: areas[a].name }, areas[a].id + ' ' + areaLabel(areas[a])));
            ids.forEach(function (b, c) {
                var v = M[r][c];
                var diag = a === b;
                var cross = a === selArea || b === selArea;
                var on = state.cell && state.cell[0] === a && state.cell[1] === b;
                var cell = el('button', { type: 'button', class: 'mcell' + (on ? ' on' : '') + (inCycle(a, b) && v ? ' cycle' : ''), 'aria-label': areas[a].id + ' – ' + areas[b].id + ': ' + v }, v ? String(v) : '');
                var p = v ? Math.round(Math.min(95, 18 + Math.log(v + 1) / Math.log(maxV + 1) * 75)) : 0;
                cell.style.background = diag ? 'var(--line)' : v ? 'color-mix(in srgb, ' + (cross ? 'var(--amber)' : 'var(--cyan)') + ' ' + p + '%, transparent)' : (cross ? 'var(--brandTint)' : 'var(--rail)');
                if (p > 55) cell.style.color = '#0d1522';
                cell.addEventListener('click', function () { step(); state.cell = [a, b]; refresh(); });
                row.appendChild(cell);
            });
            grid.appendChild(row);
        });
        wrap.appendChild(grid);
        lensView.appendChild(wrap);
        var note = el('div', { class: 'box' });
        if (state.cell) {
            var A = state.cell[0];
            var B = state.cell[1];
            var pairsAB = model.edges.filter(function (e) { return (files[e[0]].area === A && files[e[1]].area === B) || (files[e[0]].area === B && files[e[1]].area === A); });
            note.appendChild(el('div', null, areas[A].id + ' ' + areaLabel(areas[A]) + ' ↔ ' + areas[B].id + ' ' + areaLabel(areas[B]) + ': ' +
                (A === B ? t('diag') : t('edgesN')(M[pos[A]][pos[B]], pairsAB.length))));
            if (A !== B) {
                var ul = el('ul', { class: 'plist' });
                pairsAB.slice(0, 20).forEach(function (e) {
                        var b2 = el('button', { type: 'button' });
                        add(b2, el('span', { class: 'fname' }, base(files[e[0]].path) + ' → ' + base(files[e[1]].path)));
                        b2.addEventListener('click', function () { openFile(e[0]); });
                        ul.appendChild(add(el('li'), b2));
                    });
                note.appendChild(ul);
            }
        } else if (strongest[2]) {
            note.textContent = t('matrixNote')(areas[strongest[0]].id + ' ' + areaLabel(areas[strongest[0]]), areas[strongest[1]].id + ' ' + areaLabel(areas[strongest[1]]), strongest[2]);
        }
        lensView.appendChild(note);
    }

    function kindStatus(k) {
        if (k === 'roadmap-active' || k === 'contract' || k === 'adr') return 'var(--green)';
        if (k === 'roadmap-planned' || k === 'roadmap-later') return 'var(--cyan)';
        if (k === 'roadmap-archived') return 'var(--doc)';
        if (k === 'evidence') return 'var(--violet)';
        return 'var(--amber)';
    }
    function knowledgeGroups(f) {
        var g = { contracts: [], roadmaps: [], evidence: [], drafts: [], docs: [] };
        ((f.knows && f.knows.files) || []).forEach(function (k) {
            var kind = files[k].knowledge;
            if (kind === 'contract' || kind === 'adr') g.contracts.push(k);
            else if (kind && kind.indexOf('roadmap') === 0) g.roadmaps.push(k);
            else if (kind === 'evidence') g.evidence.push(k);
            else if (kind === 'draft') g.drafts.push(k);
            else g.docs.push(k);
        });
        return g;
    }
    var KIND_TEXT = { contract: 'var(--greenText)', adr: 'var(--greenText)', 'roadmap-active': 'var(--greenText)', evidence: 'var(--greenText)', 'roadmap-planned': 'var(--cyanText)', 'roadmap-later': 'var(--cyanText)', draft: 'var(--amberText)' };
    function kcard(i, extra) {
        var f = files[i];
        var cls = 'kcard';
        if (f.knowledge === 'draft') cls += ' draft';
        if (f.knowledge === 'roadmap-archived') cls += ' archived';
        if (f.role === 'test') cls += ' ktest';
        if (f.duplicate) cls += ' dup';
        var b = el('button', { type: 'button', class: cls, title: f.path });
        b.appendChild(el('span', { class: 'kname' }, base(f.path)));
        var sub = extra === '' ? '' : extra || (f.knowledge === 'draft' || f.knowledge === 'evidence' ? dir(f.path) : f.knowledge ? t('kinds')[f.knowledge] + (f.duplicate ? ' · ' + t('kDup') : '') : dir(f.path));
        if (sub) {
            var sm = el('small', null, sub);
            sm.style.color = f.duplicate ? 'var(--alertText)' : KIND_TEXT[f.knowledge] || 'var(--muted)';
            b.appendChild(sm);
        }
        b.addEventListener('click', function () { openFile(i); });
        return b;
    }
    function renderKnowledge() {
        if (state.file < 0) { lensView.appendChild(el('div', { class: 'box' }, t('selectFirst'))); return; }
        var f = files[state.file];
        var keys = add(el('div', { class: 'kkeys' }), el('span', { class: 'muted' }, t('knowHead')));
        [['kActive', 'var(--green)'], ['kPlanned', 'var(--cyan)'], ['kArchived', 'var(--doc)'], ['kDraft', ''], ['kDup', 'var(--alert)']].forEach(function (k) {
            var s = el('span');
            var sq = el('span', { class: 'sq' });
            if (k[1]) sq.style.background = k[1]; else sq.style.border = '1px dashed var(--amber)';
            add(s, sq, document.createTextNode(t(k[0])));
            keys.appendChild(s);
        });
        lensView.appendChild(keys);
        var g = knowledgeGroups(f);
        var cols = el('div', { class: 'kcols' });
        var grid = el('div', { class: 'kgrid' });
        function col(title, count, children, more) {
            var c = el('section', { class: 'kcol' });
            c.appendChild(add(el('div', { class: 'cap' }), el('span', null, title), el('span', null, count)));
            children.forEach(function (ch) { c.appendChild(ch); });
            if (more) c.appendChild(el('span', { class: 'note-line kmore' }, more));
            grid.appendChild(c);
        }
        function rest(n, cap) { return n > cap ? t('moreN')(num(n - cap)) : ''; }
        var sel = add(el('div', { class: 'kcard selcard mono' }), document.createTextNode(base(f.path)), el('small', null, t('symbolsCount')(f.symbols.length + f.symbolsOmitted) + ' · in ' + f.inFiles + ' · out ' + f.outFiles));
        var uses = outOf[state.file].slice(0, 6).map(function (x) { return kcard(x[0], ''); });
        col(t('kCode'), '1 + ' + outOf[state.file].length, [sel].concat(uses), rest(outOf[state.file].length, 6));
        col(t('kTests'), String(f.tests.length), f.tests.slice(0, 3).map(function (i) { return kcard(i, ''); }), f.tests.length > 3 ? t('testsMore')(num(f.tests.length - 3)) : '');
        col(t('kContracts'), String(g.contracts.length), g.contracts.slice(0, 8).map(function (i) { return kcard(i); }), rest(g.contracts.length, 8));
        col(t('kRoadmaps'), String(g.roadmaps.length), g.roadmaps.slice(0, 8).map(function (i) { return kcard(i); }), rest(g.roadmaps.length, 8));
        col(t('kEvidence'), String(g.evidence.length), g.evidence.slice(0, 8).map(function (i) { return kcard(i); }), rest(g.evidence.length, 8));
        col(t('kDrafts'), String(g.drafts.length), g.drafts.slice(0, 3).map(function (i) { return kcard(i); }), rest(g.drafts.length, 3));
        col(t('kMemory'), t('noDataShort'), [add(el('div', { class: 'kmissing' }), el('b', null, t('collectorMissing')), el('span', null, t('memNote1')), el('span', null, t('memNote2')))]);
        lensView.appendChild(add(cols, grid));
        var cards = el('div', { class: 'kcards' });
        var art = model.artefacts;
        var rc = art ? art.relationCounts : null;
        cards.appendChild(add(el('div'), el('span', { class: 'cap' }, t('artLayer')),
            el('span', { class: 'v' }, rc ? [rc.supersedes || 0, rc.superseded_by || 0, rc.routes_to || 0].map(num).join(' / ') : '—'),
            el('span', { class: 'soft' }, rc ? 'supersedes · superseded_by · routes_to' : t('noArtLayer'))));
        var total = f.knows ? f.knows.total : 0;
        var parts = [[t('kActive'), g.roadmaps.filter(function (i) { return files[i].knowledge === 'roadmap-active'; }).length + g.contracts.length],
            [t('kPlanned'), g.roadmaps.filter(function (i) { return files[i].knowledge === 'roadmap-planned' || files[i].knowledge === 'roadmap-later'; }).length],
            [t('kArchived'), g.roadmaps.filter(function (i) { return files[i].knowledge === 'roadmap-archived'; }).length],
            [t('kDraft'), g.drafts.length], ['Evidence', g.evidence.length]];
        cards.appendChild(add(el('div'), el('span', { class: 'cap' }, t('knowFile')), el('span', { class: 'v' }, t('docs')(num(total))),
            el('span', { class: 'soft' }, parts.filter(function (p) { return p[1]; }).map(function (p) { return p[1] + ' ' + p[0]; }).join(' · ') || t('none'))));
        if (f.knows && f.knows.finding) {
            cards.appendChild(add(el('div', { class: 'alert' }), el('span', { class: 'cap' }, t('finding')), el('b', null, t('moreDrafts')),
                el('span', { class: 'soft' }, t('draftsOf')(f.knows.finding.drafts, total))));
        }
        lensView.appendChild(cards);
    }

    // Treemap: one level of the folder tree, area = lines, squarified.
    function renderTreemap() {
        var node = tree;
        if (state.treePath) state.treePath.split('/').forEach(function (seg) { node = node && node.kids[seg]; });
        if (!node) { state.treePath = ''; node = tree; }
        var locOf = function (n) {
            if (n.loc !== undefined) return n.loc;
            var s = 0;
            n.files.forEach(function (i) { s += files[i].loc || 0; });
            Object.keys(n.kids).forEach(function (k) { s += locOf(n.kids[k]); });
            n.loc = s;
            return s;
        };
        var items = [];
        Object.keys(node.kids).forEach(function (k) { var v = locOf(node.kids[k]); if (v > 0) items.push({ name: k, value: v, dir: true, count: node.kids[k].n }); });
        node.files.forEach(function (i) { if (files[i].loc) items.push({ name: base(files[i].path), value: files[i].loc, file: i }); });
        items.sort(function (a, b) { return b.value - a.value; });
        items = items.slice(0, 120);
        var box = el('div', { class: 'treemap' });
        lensView.appendChild(box);
        var W = box.clientWidth || 800;
        var H = box.clientHeight || 600;
        var total = items.reduce(function (s, i) { return s + i.value; }, 0) || 1;
        items.forEach(function (i) { i.area = i.value / total * W * H; });
        var rects = [];
        (function squarify(list, x, y, w, h) {
            if (!list.length) return;
            if (list.length === 1) { rects.push([list[0], x, y, w, h]); return; }
            var side = Math.min(w, h);
            var row = [];
            var best = Infinity;
            var k = 0;
            for (; k < list.length; k++) {
                var trial = row.concat([list[k]]);
                var s = trial.reduce(function (a, b) { return a + b.area; }, 0);
                var worst = trial.reduce(function (m, r) { return Math.max(m, Math.max(side * side * r.area / (s * s), s * s / (side * side * r.area))); }, 0);
                if (worst > best) break;
                best = worst;
                row = trial;
            }
            var sum = row.reduce(function (a, b) { return a + b.area; }, 0);
            var thick = sum / side;
            var off = 0;
            row.forEach(function (r) {
                var len = r.area / thick;
                if (w >= h) rects.push([r, x, y + off, thick, len]); else rects.push([r, x + off, y, len, thick]);
                off += len;
            });
            if (w >= h) squarify(list.slice(row.length), x + thick, y, w - thick, h);
            else squarify(list.slice(row.length), x, y + thick, w, h - thick);
        })(items, 0, 0, W, H);
        rects.forEach(function (r) {
            var it = r[0];
            var b = el('button', { type: 'button', class: 'tm', title: (state.treePath ? state.treePath + '/' : '') + it.name + ' · ' + num(it.value) });
            b.style.left = (r[1] + 2) + 'px'; b.style.top = (r[2] + 2) + 'px'; b.style.width = Math.max(0, r[3] - 4) + 'px'; b.style.height = Math.max(0, r[4] - 4) + 'px';
            var colour;
            if (it.file !== undefined) colour = fileColour(it.file);
            else {
                var sample = -1;
                (function find(n) { if (sample >= 0) return; if (n.files.length) { sample = n.files[0]; return; } Object.keys(n.kids).some(function (k) { find(n.kids[k]); return sample >= 0; }); })(node.kids[it.name]);
                colour = state.colorBy === 'blast' || sample < 0 ? cat(strHash(it.name)) : fileColour(sample);
            }
            b.style.background = colour === 'var(--node)' ? 'var(--raise)' : colour;
            if (colour === 'var(--node)') b.style.color = 'var(--soft)';
            var small = r[3] < 110 || r[4] < 56;
            if (small) b.classList.add('small');
            if (r[3] > 40 && r[4] > 22) add(b, el('span', null, it.name + (it.dir ? '/' : '')), small ? null : el('small', null, it.dir ? t('linesFiles')(num(it.value), num(it.count)) : t('linesN')(num(it.value))));
            b.addEventListener('click', function () {
                if (it.file !== undefined) openFile(it.file);
                else { step(); state.treePath = state.treePath ? state.treePath + '/' + it.name : it.name; refresh(); }
            });
            box.appendChild(b);
        });
        var names = { blast: 'cBlast', area: 'cArea', tests: 'cTests', role: 'cRole', churn: 'cChurn', size: 'cSize', folder: 'cFolder', layer: 'cLayer', domain: 'cDomain' };
        lensView.appendChild(add(el('div', { class: 'legend' }), el('b', null, t('legend')), el('span', { class: 'muted' }, t('treemapLegend')(t(names[state.colorBy] || 'cBlast')))));
    }

    // Right rail.
    function sec(title, small) {
        var s = el('section', { class: 'sec' });
        var h = add(el('div', { class: 'sec-h' }), el('span', null, title));
        if (small != null) h.appendChild(typeof small === 'string' ? el('small', null, small) : small);
        s.appendChild(h);
        return s;
    }
    function fileRow(i, metaText) {
        var b = el('button', { type: 'button', title: files[i].path });
        add(b, swatch(files[i].area >= 0 ? cat(files[i].area) : 'var(--node)'), el('span', { class: 'fname' }, base(files[i].path)), metaText ? el('span', { class: 'fdir' }, metaText) : null);
        b.addEventListener('click', function () { openFile(i); });
        return add(el('li'), b);
    }
    /** A two-column row the design draws in mono: the file and one measure beside it. */
    /**
     * Labels for files listed together: the file name, and where two names collide the shortest parent-folder
     * suffix that tells this one apart ("cart · store.ts") — the rule the area titles follow.
     */
    function fileLabels(idx) {
        var dirsOf = function (i) { var s = files[i].path.split('/'); s.pop(); return s; };
        var suffix = function (d, k) { return d.slice(Math.max(0, d.length - k)).join('/'); };
        var out = Object.create(null);
        idx.forEach(function (i) {
            var name = base(files[i].path);
            var others = idx.filter(function (j) { return j !== i && base(files[j].path) === name; });
            out[i] = name;
            if (!others.length) return;
            var mine = dirsOf(i);
            var depth = Math.max.apply(null, [mine.length].concat(others.map(function (j) { return dirsOf(j).length; })));
            for (var k = 1; k <= depth; k++) {
                var own = suffix(mine, k);
                if (others.every(function (j) { return suffix(dirsOf(j), k) !== own; })) { out[i] = own ? own + ' · ' + name : name; return; }
            }
        });
        return out;
    }
    function gridRow(i, metaText, cls, label) {
        var b = el('button', { type: 'button', title: files[i].path, class: cls || '' });
        add(b, el('span', { class: 'fname' }, label || base(files[i].path)), el('span', { class: 'fdir' }, metaText));
        b.addEventListener('click', function () { openFile(i); });
        return add(el('li'), b);
    }
    function relRow(i, metaText) {
        var b = el('button', { type: 'button', title: files[i].path });
        add(b, el('span', null, files[i].path.split('/').slice(-2).join('/')), el('span', { class: 'mt' }, metaText));
        b.addEventListener('click', function () { openFile(i); });
        return b;
    }
    function codeFindingCount() {
        return (an.cyclesTotal || 0) + (an.surprises || []).length + (an.layerBreaches || 0) + (model.domains && model.domains.breaches ? model.domains.breaches : 0) + (model.hotspots ? model.hotspots.length : 0) + (an.deadFiles || 0);
    }
    function renderTabs() {
        var tabs = $('tabs');
        clear(tabs);
        var findCount = codeFindingCount();
        [['file', t('tabFile')], ['find', t('tabFind') + ' · ' + num(findCount)], ['area', t('tabArea')]].forEach(function (o) {
            var b = el('button', { type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(state.tab === o[0]) }, o[1]);
            b.addEventListener('click', function () { state.tab = o[0]; renderPanel(); renderTabs(); });
            tabs.appendChild(b);
        });
    }
    function renderPanel() {
        clear(panel);
        if (state.tab === 'find') renderFindings();
        else if (state.tab === 'area') renderAreaTab();
        else renderFileTab();
    }
    // Files marked in this session, newest first; kept in the page only.
    var recentFiles = [];
    function remember(i) {
        if (i < 0) return;
        recentFiles = [i].concat(recentFiles.filter(function (x) { return x !== i; })).slice(0, 5);
    }
    function deselect() { step(); state.file = -1; refresh(); }
    function renderFileTab() {
        if (state.file < 0) {
            var p = add(el('div', { class: 'pad epad' }), add(el('div', { class: 'empty-head' }), el('b', null, t('pickTitle')), el('span', { class: 'muted' }, t('pickHint'))));
            if (recentFiles.length) {
                var ur = el('ul', { class: 'plist pgrid' });
                var rl = fileLabels(recentFiles);
                recentFiles.forEach(function (x) {
                    var b = files[x].blast;
                    ur.appendChild(gridRow(x, (files[x].area >= 0 ? areas[files[x].area].id : files[x].role) + (b ? ' · Blast ' + num(b.direct + 0.5 * b.transitive) : ''), 'recent', rl[x]));
                });
                p.appendChild(add(el('div', { class: 'egroup' }), el('span', { class: 'cap' }, t('recent')), ur));
            }
            var hg = add(el('div', { class: 'egroup' }), el('span', { class: 'cap' }, t('topHotspots')));
            if (model.hotspots && model.hotspots.length) {
                var uh = el('ul', { class: 'plist pgrid' });
                var hl = fileLabels(model.hotspots.slice(0, 3).map(function (h) { return h[0]; }));
                model.hotspots.slice(0, 3).forEach(function (h) { uh.appendChild(gridRow(h[0], num(h[1]) + ' × ' + num(h[2]), '', hl[h[0]])); });
                hg.appendChild(uh);
            } else hg.appendChild(el('span', { class: 'dashchip mono', title: t('noDataTitle')(t('needChurn')) }, t('noDataShort') + ' · ' + t('needChurn')));
            p.appendChild(hg);
            var ul = el('ul', { class: 'plist pgrid' });
            var ml = fileLabels((an.hubs || []).slice(0, 5));
            (an.hubs || []).slice(0, 5).forEach(function (h) { ul.appendChild(gridRow(h, 'in ' + num(files[h].inFiles), '', ml[h])); });
            p.appendChild(add(el('div', { class: 'egroup' }), el('span', { class: 'cap' }, t('mostUsed')), ul));
            panel.appendChild(p);
            return;
        }
        var i = state.file;
        var f = files[i];
        var x = el('button', { type: 'button', class: 'deselect', id: 'deselect', 'aria-label': t('deselect'), title: t('deselect') }, '×');
        x.addEventListener('click', deselect);
        var head = add(el('div', { class: 'fhead' }), add(el('div', { class: 'fhead-top' }), el('div', { class: 'fn' }, base(f.path)), x), el('div', { class: 'fp' }, f.path));
        var chips = el('div', { class: 'chips' });
        chips.appendChild(el('span', { class: SCOPE_CODE[f.role] ? 'c-cyan' : f.role === 'test' ? 'c-green' : '' }, (t('roleNames')[f.role] || f.role) + (f.lang ? ' · ' + langName(f.lang) : '')));
        if (f.loc !== undefined) chips.appendChild(el('span', null, t('linesN')(num(f.loc))));
        else chips.appendChild(el('span', { class: 'c-miss' }, t('locMissing')));
        if (f.area >= 0) chips.appendChild(el('span', null, 'Area ' + areas[f.area].id + ' ' + areaTitle(areas[f.area]) + (areas[f.area].hub === i ? ' (' + t('hub') + ')' : '')));
        if (f.tests.length) chips.appendChild(el('span', { class: 'c-green' }, t('tests')(f.tests.length)));
        chips.appendChild(el('span', null, 'in ' + f.inFiles + ' · out ' + f.outFiles));
        if (f.guesses) chips.appendChild(el('span', { class: 'c-guess' }, t('guesses')(f.guesses)));
        if (f.layer) chips.appendChild(el('span', null, 'Layer ' + f.layer));
        if (f.domain) chips.appendChild(el('span', { class: 'c-cyan' }, t('cDomain') + ' ' + f.domain));
        if (f.dead) chips.appendChild(el('span', { class: 'c-dead', title: an.deadBasis || '' }, t('dead')));
        head.appendChild(chips);
        if (f.churn !== undefined) {
            var owners = (f.owners || []).length;
            var trio = el('div', { class: 'trio' });
            var ownerV = el('div', { class: 'mono v' }, num(owners));
            if (f.soleOwner) ownerV.style.color = 'var(--brandText)';
            add(trio, add(el('div'), el('div', { class: 'mono v' }, num(f.churn)), document.createTextNode(t('commitsWin')(WINDOW))),
                add(el('div'), el('div', { class: 'mono v' }, f.lastChange ? shortDate(f.lastChange, true) : '–'), document.createTextNode(t('lastChange'))),
                add(el('div'), ownerV, document.createTextNode(f.soleOwner ? t('ownerBus') : t('owners'))));
            head.appendChild(trio);
        }
        panel.appendChild(head);
        var hist = historySection(f.path);
        if (hist) panel.appendChild(hist);

        // Blast radius.
        var w = walk(i, state.scope);
        var bl = el('section', { class: 'blast' });
        var rec = f.blast;
        var level = rec ? rec.level : 'low';
        var bhead = add(el('div', { class: 'blast-h' }), el('b', null, t('blastRadius')));
        if (rec && state.scope === 'code') bhead.appendChild(el('span', { class: 'level ' + level }, t('levels')[level]));
        bl.appendChild(bhead);
        var scopes = el('div', { class: 'scopes', role: 'radiogroup', 'aria-label': 'Scope' });
        [['code', t('sCode')], ['tests', '+ ' + t('fTests')], ['all', t('sAllShort')]].forEach(function (o) {
            var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(state.scope === o[0]) }, o[1]);
            b.addEventListener('click', function () { state.scope = o[0]; refresh(); });
            scopes.appendChild(b);
        });
        bl.appendChild(scopes);
        var direct = w.byDepth[1].length;
        var trans = w.byDepth[2].length + w.byDepth[3].length;
        if (state.scope === 'code' && rec) { direct = rec.direct; trans = rec.transitive; }
        var scopeCount = files.filter(function (x) { return inScope(x, state.scope); }).length;
        var share = scopeCount ? (direct + trans) / scopeCount : 0;
        var nums = el('div', { class: 'nums' });
        add(nums, add(el('div'), el('div', { class: 'v hot' }, num(direct)), el('div', { class: 'l' }, t('direct'))),
            add(el('div'), el('div', { class: 'v' }, num(trans)), el('div', { class: 'l' }, t('transitive3'))),
            add(el('div'), el('div', { class: 'v' }, num(direct + 0.5 * trans)), el('div', { class: 'l' }, t('score'))));
        bl.appendChild(nums);
        var sb = el('div', { class: 'sharebar' });
        var fill = el('i');
        fill.style.width = Math.min(100, share * 200) + '%';
        sb.appendChild(fill);
        [20, 50].forEach(function (x) { var m = el('span', { class: 'mark' }); m.style.left = x + '%'; sb.appendChild(m); });
        add(bl, add(el('div', { class: 'parts' }), sb, add(el('div', { class: 'between muted' }), el('span', null, t('shareText')(num(direct + trans), num(scopeCount), pct(share))), el('span', null, t('marks')))));
        var all = walk(i, 'all');
        var cc = 0; var tc = 0; var dc = 0;
        for (var d = 1; d <= BLAST_DEPTH; d++) all.byDepth[d].forEach(function (x) { var r = files[x].role; if (r === 'test') tc += 1; else if (r === 'doc') dc += 1; else if (SCOPE_CODE[r]) cc += 1; });
        bl.appendChild(el('div', { class: 'insight' }, rec ? t('insight')(num(cc), num(tc), num(dc)) : t('notScope')));
        var deeper = w.byDepth[2].length + w.byDepth[3].length;
        for (var dd = 1; dd <= (state.deep ? BLAST_DEPTH : 1); dd++) {
            var list = w.byDepth[dd];
            if (!list.length) continue;
            var dl = add(el('div', { class: 'dlist' }), el('span', { class: 'cap' }, t('depthList')(dd)));
            (state.deep && dd === 1 ? list : list.slice(0, 8)).forEach(function (x) {
                var r = el('button', { type: 'button', class: 'drow', title: files[x].path });
                add(r, kindDot(files[x]), el('span', { class: 'nm' }, base(files[x].path)), el('span', { class: 'mt' }, files[x].area >= 0 ? areas[files[x].area].id : files[x].role));
                r.addEventListener('click', function () { openFile(x); });
                dl.appendChild(r);
            });
            if (state.deep && list.length > 8 && dd > 1) dl.appendChild(el('span', { class: 'note-line' }, t('moreN')(num(list.length - 8))));
            bl.appendChild(dl);
        }
        if (w.byDepth[1].length > 8 || deeper) {
            var more = el('button', { type: 'button', class: 'linkmore', 'aria-expanded': String(!!state.deep) }, state.deep ? t('depthCollapse') : t('moreDirect')(num(Math.max(0, w.byDepth[1].length - 8))));
            more.addEventListener('click', function () { state.deep = !state.deep; renderPanel(); });
            bl.appendChild(more);
        }
        bl.appendChild(el('div', { class: 'formula' }, t('blastFormula')));
        panel.appendChild(bl);

        // Uses / used by.
        var su = sec(t('uses') + ' (' + outOf[i].length + ')', t('relTrust'));
        su.classList.add('uses');
        var ul1 = el('div', { class: 'rows' });
        outOf[i].slice(0, RAIL_CAP).forEach(function (x) { ul1.appendChild(relRow(x[0], '× ' + x[1] + ' · ●')); });
        su.appendChild(ul1);
        if (outOf[i].length > RAIL_CAP) su.appendChild(el('span', { class: 'note-line' }, t('moreN')(outOf[i].length - RAIL_CAP)));
        panel.appendChild(su);
        var sy = sec(t('usedBy') + ' (' + inOf[i].length + ')', t('relTrust'));
        var ul2 = el('div', { class: 'rows' });
        inOf[i].slice(0, RAIL_CAP).forEach(function (x) { ul2.appendChild(relRow(x[0], '× ' + x[1] + ' · ●')); });
        sy.appendChild(ul2);
        if (inOf[i].length > RAIL_CAP) sy.appendChild(el('span', { class: 'note-line' }, t('moreN')(inOf[i].length - RAIL_CAP)));
        panel.appendChild(sy);

        // Symbols.
        var ss = sec(t('symbols') + ' (' + (f.symbols.length + f.symbolsOmitted) + ')', t('symCols'));
        var grid = el('div', { class: 'symgrid' });
        var syms = f.symbols.slice().sort(function (a, b) { return (b[4] || 0) - (a[4] || 0) || (b[3] || 0) - (a[3] || 0); });
        syms.slice(0, SYMBOL_CAP).forEach(function (s) {
            var hasCalls = s.length > 3;
            var row = el('div');
            var calls = el('span', { class: 'mt' }, hasCalls ? (s[3] || 0) + ' / ' + (s[4] || 0) : '– / –');
            if (hasCalls && s[4] >= 10) calls.className = 'hot';
            else if (hasCalls && s[4] >= 7) calls.className = 'warm';
            add(row, el('span', { title: s[0] }, s[0]), el('span', { class: 'mt' }, 'L' + s[2]), el('span', { class: 'mt' }, s[1]), calls);
            grid.appendChild(row);
        });
        ss.appendChild(grid);
        var symMore = f.symbolsOmitted + Math.max(0, f.symbols.length - SYMBOL_CAP);
        ss.appendChild(el('span', { class: 'note-line' }, t('symSorted')(symMore ? num(symMore) : '')));
        panel.appendChild(ss);

        // Knowledge.
        var g = knowledgeGroups(f);
        var total = f.knows ? f.knows.total : 0;
        var openBtn = el('button', { type: 'button', class: 'btn' }, t('openCenter'));
        openBtn.style.height = '28px';
        openBtn.style.fontSize = '12px';
        openBtn.addEventListener('click', function () { state.lens = 'knowledge'; refresh(); });
        var sk = sec(t('knowledge') + ' (' + total + ')', openBtn);
        var actv = g.contracts.length + g.roadmaps.filter(function (x) { return files[x].knowledge === 'roadmap-active'; }).length;
        var plan = g.roadmaps.filter(function (x) { return files[x].knowledge === 'roadmap-planned' || files[x].knowledge === 'roadmap-later'; }).length;
        var arch = g.roadmaps.filter(function (x) { return files[x].knowledge === 'roadmap-archived'; }).length;
        sk.appendChild(stackBlock('', [[t('kActive'), actv, 'var(--green)'], [t('kPlanned'), plan, 'var(--cyan)'], [t('kArchived'), arch, 'var(--doc)'],
            [t('kDraft'), g.drafts.length, 'hatch4'], ['Evidence', g.evidence.length, 'var(--violet)']], Math.max(1, total), false).lastChild);
        var rows = el('div', { class: 'rows' });
        ((f.knows && f.knows.files) || []).slice(0, 6).forEach(function (k) {
            var b = el('button', { type: 'button', title: files[k].path });
            var kind = files[k].knowledge;
            var lab = el('span', { class: 'mt' }, files[k].duplicate ? t('kDup') : t('kinds')[kind] || kind);
            lab.style.color = files[k].duplicate ? 'var(--alertText)' : kind === 'contract' || kind === 'adr' || kind === 'roadmap-active' ? 'var(--greenText)' : 'var(--muted)';
            add(b, el('span', null, base(files[k].path)), lab);
            b.addEventListener('click', function () { openFile(k); });
            rows.appendChild(b);
        });
        sk.appendChild(rows);
        var noteBits = [];
        if (f.knows && f.knows.finding) noteBits.push(t('draftsOf')(f.knows.finding.drafts, total).split('.')[0]);
        noteBits.push(t('memMissing'));
        sk.appendChild(el('span', { class: 'note-line' }, noteBits.join(' · ')));
        panel.appendChild(sk);

        // Ownership and churn.
        if (f.churn !== undefined) {
            var so = sec(t('ownership'), f.soleOwner ? el('span', { class: 'mono solechip' }, t('soleOwner')) : null);
            so.classList.add('own');
            (f.owners || []).forEach(function (o) {
                var row = add(el('div', { class: 'owner' }), el('span', { class: 'mono' }, o[0]), el('span', { class: 'mono muted' }, t('ownerShare')(pct(o[1], 0), num(Math.round(o[1] * f.churn)))));
                var b = el('div', { class: 'bar' });
                var ii = el('i');
                ii.style.width = (o[1] * 100) + '%';
                b.appendChild(ii);
                row.appendChild(b);
                so.appendChild(row);
            });
            so.appendChild(el('span', { class: 'note-line' }, t('ownerNote')(WINDOW, !!f.soleOwner)));
            panel.appendChild(so);
        } else {
            var miss = el('span', { class: 'dashchip mono' }, t('gitMissing'));
            var sm = sec(t('ownership'), miss);
            sm.firstChild.firstChild.style.color = 'var(--muted)';
            sm.appendChild(el('span', { class: 'note-line' }, t('gitMissingNote')));
            panel.appendChild(sm);
        }

        if (f.tests.length) {
            var st = sec(t('coveredBy') + ' (' + f.tests.length + ')');
            var ul3 = el('ul', { class: 'plist' });
            f.tests.slice(0, RAIL_CAP).forEach(function (x) { ul3.appendChild(fileRow(x)); });
            add(st, ul3);
            if (f.tests.length > RAIL_CAP) st.appendChild(el('span', { class: 'note-line' }, t('moreN')(f.tests.length - RAIL_CAP)));
            panel.appendChild(st);
        }
        var reqs = (an.requestPaths || []).filter(function (r) { return r.file === i || r.handler === i; });
        if (reqs.length) {
            var sr = sec(t('requestPaths') + ' (' + reqs.length + ')');
            var rl = el('div', { class: 'rows' });
            reqs.slice(0, RAIL_CAP).forEach(function (r) {
                var parts = [];
                if (r.handler >= 0) parts.push(base(files[r.handler].path) + (r.handlerSymbol ? '::' + r.handlerSymbol : ''));
                r.views.forEach(function (v) { parts.push(base(files[v].path)); });
                r.models.forEach(function (v) { parts.push(base(files[v].path)); });
                r.tables.forEach(function (tb) { parts.push('⊞ ' + tb); });
                rl.appendChild(add(el('div', { class: 'card' }), el('p', { class: 'mono' }, r.route), el('p', { class: 'mono' }, '→ ' + (parts.join(' → ') || t('none')))));
            });
            panel.appendChild(add(sr, rl));
        }
        if (f.externals.length) {
            var se = sec(t('externals') + ' (' + f.externals.length + ')');
            se.appendChild(el('span', { class: 'mono note-line' }, f.externals.slice(0, 30).join(' · ')));
            panel.appendChild(se);
        }
    }

    function findCard(title, value, colour, lines, missing) {
        var c = el('div', { class: 'card' + (missing ? ' missing' : '') });
        var h = add(el('div', { class: 'between' }), el('b', null, title));
        if (value != null) { var v = el('span', { class: 'v' }, value); if (colour) v.style.color = colour; h.appendChild(v); }
        c.appendChild(h);
        (lines || []).forEach(function (l) { c.appendChild(l); });
        return c;
    }
    function fileLink(i, text) {
        var b = el('button', { type: 'button', title: files[i].path }, text || files[i].path);
        b.addEventListener('click', function () { state.tab = 'file'; openFile(i); });
        return b;
    }
    function renderFindings() {
        var p = el('div', { class: 'pad' });
        var cyc = (model.violations || []).filter(function (v) { return v.kind === 'cycle'; });
        var cycLines = [];
        var sev = cyc.some(function (v) { return v.severity === 'high'; }) ? 'high' : cyc.length ? 'medium' : '';
        if (an.cycles && an.cycles[0]) {
            var sizeOf = function (k) { return (an.cycleSizes && an.cycleSizes[k]) || an.cycles[k].length; };
            var first = el('p');
            if (sev) first.appendChild(el('span', { class: 'sev ' + sev }, t('levels')[sev]));
            first.appendChild(document.createTextNode(t('biggest')(sizeOf(0)) + ' · ' + an.cycles[0].slice(0, 4).map(function (x) { return base(files[x].path); }).join(' ↔ ') + (sizeOf(0) > 4 ? ' ↔ …' : '')));
            cycLines.push(first);
            an.cycles.slice(1, 3).forEach(function (c, k) { cycLines.push(el('p', null, sizeOf(k + 1) + ' · ' + dir(files[c[0]].path))); });
        }
        p.appendChild(findCard(t('fileCycles'), num(an.cyclesTotal), 'var(--amberText)', cycLines));
        if (model.hotspots) {
            var hl = el('ul', { class: 'plist pgrid' });
            var fl = fileLabels(model.hotspots.slice(0, 4).map(function (h) { return h[0]; }));
            model.hotspots.slice(0, 4).forEach(function (h) { hl.appendChild(gridRow(h[0], num(h[1]) + ' × ' + num(h[2]), '', fl[h[0]])); });
            p.appendChild(findCard(t('hotspots'), t('hotspotsUnit'), 'var(--amberText)', [hl]));
        } else p.appendChild(findCard(t('hotspots'), null, null, [el('p', null, t('needChurn'))], true));
        if (an.deadFiles !== undefined) {
            var deadList = [];
            files.forEach(function (f, i) { if (f.dead && deadList.length < 5) deadList.push(fileLink(i)); });
            p.appendChild(findCard(t('deadFiles'), num(an.deadFiles), 'var(--amberText)', [el('p', null, an.deadBasis || '')].concat(deadList)));
        } else p.appendChild(findCard(t('deadFiles'), null, null, [el('p', null, an.deadBasis || t('missDead'))], true));
        p.appendChild(findCard(t('surprises'), num((an.surprises || []).length), 'var(--amberText)',
            (an.surprises || []).slice(0, 4).map(function (s) { return fileLink(s[0], files[s[0]].path + ' → ' + base(files[s[1]].path)); })));
        if (model.drift) {
            var d = model.drift;
            var lines = [];
            d.changed.slice(0, 3).forEach(function (c) { lines.push(el('p', null, areas[c[0]].id + ' +' + c[1] + ' / −' + c[2])); });
            d.appeared.slice(0, 2).forEach(function (a) { lines.push(el('p', null, '+ ' + areas[a].id + ' ' + areaTitle(areas[a]))); });
            d.vanished.slice(0, 2).forEach(function (v) { lines.push(el('p', null, '− ' + v)); });
            p.appendChild(findCard(t('drift'), num(d.changed.length + d.appeared.length + d.vanished.length + d.split.length + d.merged.length), 'var(--cyanText)', lines));
        }
        if (an.layerBreaches !== undefined) {
            p.appendChild(findCard(t('layerBreaches'), num(an.layerBreaches), 'var(--alertText)',
                (model.violations || []).filter(function (v) { return v.kind === 'layer'; }).slice(0, 4).map(function (v) {
                    return fileLink(v.files[0], base(files[v.files[0]].path) + ' → ' + base(files[v.files[1]].path) + ' (' + v.layers[0] + ' → ' + v.layers[1] + ')');
                })));
        } else p.appendChild(findCard(t('layerBreaches'), null, null, [el('p', null, t('needLayers'))], true));
        var dc = domainCard(findCard, fileLink);
        if (dc) p.appendChild(dc);
        if (model.prOverlap && model.prOverlap.conflicts.length) {
            p.appendChild(findCard(t('prs'), num(model.prOverlap.conflicts.length), 'var(--cyanText)', model.prOverlap.conflicts.slice(0, 4).map(function (c) {
                return el('p', null, '#' + c[0] + ' · #' + c[1] + ' → ' + c[2].map(function (a) { return areas[a].id; }).join(', '));
            })));
        }
        if (model.diff) {
            p.appendChild(findCard(t('change') + ' (' + model.diff.rev + ')', num(model.diff.changed.length) + ' / ' + num(model.diff.impacted.length), 'var(--cyanText)',
                model.diff.changed.slice(0, 5).map(function (i) { return fileLink(i); })));
        }
        panel.appendChild(p);
    }

    function renderAreaTab() {
        var ai = state.file >= 0 && files[state.file].area >= 0 ? files[state.file].area : state.area;
        var p = el('div', { class: 'pad' });
        if (ai >= 0) {
            var a = areas[ai];
            p.appendChild(add(el('div', { class: 'atitle' }), el('b', null, a.id + ' · ' + areaTitle(a)), el('span', { class: 'mono muted' }, t('hubLine')(hubShort(a)))));
            var tiles = el('div', { class: 'atiles' });
            var aLoc = 0; var aChurn = 0; var aHasLoc = false; var aHasChurn = false;
            a.files.forEach(function (x) { var r = files[x]; if (r.loc !== undefined) { aHasLoc = true; aLoc += r.loc; } if (r.churn !== undefined) { aHasChurn = true; aChurn += r.churn; } });
            [[num(a.files.length), t('files')('').trim()], [pct(a.cohesion), t('cohesion')], [pct(a.testShare), t('testShare')],
                [aHasLoc ? num(aLoc) : '–', t('tLines')], [aHasChurn ? num(aChurn) : '–', t('commitsShort')], [pct(a.folderMismatch), t('outsideHub')]].forEach(function (x) {
                tiles.appendChild(add(el('div', { class: 'tile' }), el('div', { class: 'v' }, x[0]), el('div', { class: 'l' }, x[1])));
            });
            p.appendChild(tiles);
            p.appendChild(el('span', { class: 'soft' }, t('mismatch')(pct(a.folderMismatch))));
            var top = a.files.slice().sort(function (x, y) { return files[y].inFiles - files[x].inFiles || x - y; });
            var tl = fileLabels(top.slice(0, 3));
            p.appendChild(el('span', { class: 'muted', title: top.slice(0, 3).map(function (x) { return files[x].path; }).join('\n') }, t('mostUsed') + ': ' + top.slice(0, 3).map(function (x) { return tl[x]; }).join(', ')));
            if (state.level !== 'area' || state.area !== ai) {
                var ob = el('button', { type: 'button', class: 'openarea', id: 'open-area' }, t('openArea'));
                ob.addEventListener('click', function () { openArea(ai); });
                p.appendChild(ob);
            }
            panel.appendChild(p);
            return;
        }
        // Nothing marked yet: every area, to start from.
        p.appendChild(el('span', { class: 'cap' }, t('allAreasList') + ' (' + areas.length + ')'));
        var list = el('ul', { class: 'plist' });
        areas.forEach(function (a, i) {
            var b = el('button', { type: 'button', class: 'aentry', title: a.name + ' · ' + a.files.length });
            var label = add(el('span', { class: 'alabel' }), el('span', { class: 'fname' }, a.id + ' · ' + areaTitle(a) + ' · ' + a.files.length));
            add(b, swatch(cat(i)), label);
            b.addEventListener('click', function () { openArea(i); });
            list.appendChild(add(el('li'), b));
        });
        p.appendChild(list);
        panel.appendChild(p);
    }

    // Navigation.
    function refresh() {
        renderLensBar();
        renderCrumbs();
        renderRail();
        renderLens();
        renderTabs();
        renderPanel();
        applyPanes(false);
        renderFull();
        if (state.lens === 'graph') draw(); else { renderFoot(); exposeView(); }
    }
    function renderFull() {
        var fb = $('full');
        fb.setAttribute('aria-pressed', String(state.full));
        $('full-label').textContent = state.full ? t('fullOff') : t('full');
        var card = $('fullcard');
        card.hidden = !(state.full && state.file >= 0);
        clear(card);
        if (card.hidden) return;
        var f = files[state.file];
        var w = walk(state.file, state.scope);
        var trans = w.byDepth[2].length + w.byDepth[3].length;
        add(card, el('span', { class: 'mono' }, base(f.path)), el('span', { class: 'mono muted' }, dir(f.path) + (f.area >= 0 ? ' · ' + areas[f.area].id : '') + ' · in ' + f.inFiles + ' · out ' + f.outFiles));
        card.firstChild.style.color = 'var(--brandText)';
        card.firstChild.style.fontWeight = '600';
        var n = el('div', { class: 'nums' });
        add(n, add(el('div'), el('div', { class: 'v hot' }, num(w.byDepth[1].length)), el('div', { class: 'l' }, t('direct'))),
            add(el('div'), el('div', { class: 'v' }, num(trans)), el('div', { class: 'l' }, t('transitive'))),
            add(el('div'), el('div', { class: 'v' }, num(w.byDepth[1].length + 0.5 * trans)), el('div', { class: 'l' }, t('score'))));
        card.appendChild(n);
        var back = el('button', { type: 'button', class: 'btn' }, t('showPanels'));
        back.addEventListener('click', function () { state.full = false; refresh(); resize(); });
        card.appendChild(back);
    }
    function resetView() { state.view = { scale: 1, x: 0, y: 0 }; state.rot = startRotation(); }
    function goHome() { step(); state.level = 'overview'; state.lens = 'graph'; resetView(); refresh(); }
    // Entering an area decides its fold from the upper line again; the band only holds within one visit.
    function freshFold(i) {
        delete state.superOn[i];
        Object.keys(state.superOpen).forEach(function (k) { if (k.indexOf(i + '|') === 0) delete state.superOpen[k]; });
    }
    function openArea(i) {
        freshFold(i);
        step(); closeFlyouts(); if (state.file >= 0 && files[state.file].area !== i) state.file = -1; state.level = 'area'; state.area = i; state.lens = state.lens === 'graph' ? 'graph' : state.lens; resetView(); refresh(); }
    function openFile(i) {
        step();
        closeFlyouts();
        var f = files[i];
        if (state.lens === 'graph' && f.area >= 0 && (state.level !== 'area' || state.area !== f.area)) {
            freshFold(f.area);
            state.level = 'area';
            state.area = f.area;
            resetView();
        }
        state.file = i;
        state.tab = 'file';
        state.deep = false;
        remember(i);
        refresh();
    }

    // Input.
    var drag = null;
    var frame = 0;
    canvas.addEventListener('pointerdown', function (e) {
        drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, vx: state.view.x, vy: state.view.y, turn: state.orb && !e.shiftKey, moved: false };
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
        if (!drag) {
            // Over a node or its name the pointer says it can be clicked; elsewhere the stage's grab stands.
            var hr = canvas.getBoundingClientRect();
            canvas.style.cursor = hitTest(e.clientX - hr.left, e.clientY - hr.top) ? 'pointer' : '';
            return;
        }
        var dx = e.clientX - drag.x;
        var dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        if (drag.turn) { turnBy((e.clientX - drag.lx) * 0.008, -(e.clientY - drag.ly) * 0.008); drag.lx = e.clientX; drag.ly = e.clientY; }
        else { state.view.x = drag.vx + dx; state.view.y = drag.vy + dy; }
        if (!frame) frame = requestAnimationFrame(function () { frame = 0; draw(); });
    });

    canvas.addEventListener('pointerup', function (e) {
        var wasDrag = drag && drag.moved;
        drag = null;
        if (wasDrag) return;
        var r = canvas.getBoundingClientRect();
        select(hitTest(e.clientX - r.left, e.clientY - r.top));
    });
    // One click marks the node and what it reaches; a double click goes one level deeper.
    canvas.addEventListener('dblclick', function (e) {
        var r = canvas.getBoundingClientRect();
        var hit = hitTest(e.clientX - r.left, e.clientY - r.top);
        if (!hit) return;
        if (hit.kind === 'super') return;
        if (hit.kind === 'area') openArea(hit.idx);
        else openFile(hit.idx);
    });
    function select(hit) {
        if (hit && hit.kind === 'super') {
            if (superList[hit.idx]) state.superOpen[state.area + '|' + superList[hit.idx].key] = true;
            draw();
            return;
        }
        if (!hit) {
            if (state.level === 'overview') state.area = -1;
            state.file = -1;
        } else if (hit.kind === 'area') {
            state.area = hit.idx;
            state.file = -1;
            state.tab = 'area';
        } else {
            state.file = hit.idx;
            state.tab = 'file';
            remember(hit.idx);
        }
        refresh();
    }
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    function zoom(f) { state.view.scale = Math.min(8, Math.max(0.4, state.view.scale * f)); $('zoomtxt').textContent = 'Zoom ' + state.view.scale.toFixed(1) + '×'; draw(); }
    var TURN_KEYS = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15] };
    document.addEventListener('keydown', function (e) {
        if (current.route !== 'code' || document.activeElement === searchInput) return;
        var step = TURN_KEYS[e.key];
        if (step && state.orb) { e.preventDefault(); turnBy(step[0], step[1]); draw(); return; }
        if (e.key === 'Escape') {
            if (state.fly.left || state.fly.right) { state.fly.left = false; state.fly.right = false; applyPanes(false); return; }
            if (state.level === 'area') goHome(); else if (state.file >= 0 || state.area >= 0) { state.file = -1; state.area = -1; refresh(); }
        }
    });
    // What the header search finds in the Code area; the shell owns the box and the kind presets.
    // A hit that holds others (folder, area, file) carries `kids`, which the search can step into.
    function folderNode(dirPath) {
        var n = tree;
        if (dirPath) dirPath.split('/').forEach(function (seg) { n = n && n.kids[seg]; });
        return n;
    }
    function revealFolder(dirPath) {
        go('code');
        var acc = '';
        dirPath.split('/').forEach(function (seg) { acc = acc ? acc + '/' + seg : seg; state.open[acc] = true; });
        state.scopeDir = dirPath;
        refresh();
    }
    function symbolHits(i) {
        return files[i].symbols.map(function (sy) { return { kind: 'symbol', text: sy[0] + ' — L' + sy[2], fn: function () { go('code'); openFile(i); } }; });
    }
    function fileHit(i, text) {
        var n = files[i].symbols.length;
        return { kind: 'file', text: text || files[i].path, fn: function () { go('code'); openFile(i); }, count: n || null, crumb: base(files[i].path), kids: n ? function () { return symbolHits(i); } : null };
    }
    function folderHit(dirPath, text) {
        var n = folderNode(dirPath);
        return { kind: 'folder', text: text || dirPath + '/', fn: function () { revealFolder(dirPath); }, count: n.n, crumb: base(dirPath), kids: function () { return folderKids(dirPath); } };
    }
    function folderKids(dirPath) {
        var n = folderNode(dirPath);
        if (!n) return [];
        var out = Object.keys(n.kids).sort().map(function (k) { return folderHit(dirPath ? dirPath + '/' + k : k, k + '/'); });
        return out.concat(n.files.slice().sort(function (a, b) { return files[a].path < files[b].path ? -1 : 1; }).map(function (i) { return fileHit(i, base(files[i].path)); }));
    }
    function codeSearchHits(q, hit) {
        var dirs = 0;
        (function walkDirs(node, prefix) {
            Object.keys(node.kids).sort().forEach(function (k) {
                if (dirs >= 200) return;
                var p = prefix ? prefix + '/' + k : k;
                if (k.toLowerCase().indexOf(q) >= 0) { var h = folderHit(p); hit('folder', h.text, h.fn, h); dirs += 1; }
                walkDirs(node.kids[k], p);
            });
        })(tree, '');
        areas.forEach(function (a, i) {
            if (a.name.toLowerCase().indexOf(q) < 0 && areaTitle(a).toLowerCase().indexOf(q) < 0 && a.id !== q) return;
            hit('area', '◎ ' + a.id + ' · ' + areaTitle(a) + ' · ' + a.name, function () { openArea(i); }, { count: a.files.length, crumb: a.id, kids: function () { return a.files.map(function (f) { return fileHit(f); }); } });
        });
        (an.requestPaths || []).forEach(function (r) { if (r.route.toLowerCase().indexOf(q) >= 0) hit('route', '↳ ' + r.route, function () { openFile(r.handler >= 0 ? r.handler : r.file); }); });
        files.forEach(function (f, i) {
            if (f.path.toLowerCase().indexOf(q) >= 0) { var h = fileHit(i); hit('file', h.text, function () { openFile(i); }, h); return; }
            var sym = f.symbols.filter(function (s) { return s[0].toLowerCase().indexOf(q) >= 0; })[0];
            if (sym) hit('symbol', sym[0] + ' — ' + f.path, function () { openFile(i); });
        });
    }

    function toggle(id, key) {
        var b = $(id);
        b.setAttribute('aria-pressed', String(state[key]));
        b.addEventListener('click', function () { state[key] = !state[key]; b.setAttribute('aria-pressed', String(state[key])); draw(); });
    }
    toggle('t-sure', 'showTrusted');
    toggle('t-guess', 'showGuesses');
    toggle('t-tests', 'showTests');
    toggle('t-infra', 'showInfra');
    $('full').addEventListener('click', function () { state.full = !state.full; refresh(); resize(); });
    ['left', 'right'].forEach(function (side) {
        var other = side === 'left' ? 'right' : 'left';
        $('open-' + side).addEventListener('click', function () {
            state.fly[side] = true;
            if (paneMode() === 'phone') state.fly[other] = false;
            applyPanes(false);
        });
        $('close-' + side).addEventListener('click', function () { state.fly[side] = false; applyPanes(false); });
        $('pin-' + side).addEventListener('click', function () {
            state.pin[side] = !isPinned(side);
            state.fly[side] = false;
            applyPanes(true);
        });
    });
    $('scrim').addEventListener('click', function () { state.fly.left = false; state.fly.right = false; applyPanes(false); });
    $('z-in').addEventListener('click', function () { zoom(1.4); });
    $('z-out').addEventListener('click', function () { zoom(1 / 1.4); });
    $('z-fit').addEventListener('click', function () { resetView(); zoom(1); });
    $('back').addEventListener('click', goHome);
    var dim2d = $('dim2d');
    var dimButton = $('dim');
    function setOrb(on) {
        state.orb = on;
        dimButton.setAttribute('aria-checked', String(on));
        dim2d.setAttribute('aria-checked', String(!on));
        resetView();
        refresh();
    }
    // One choice of two (the handover's Darstellung radiogroup): 3D selects the orb, 2D the plane.
    dimButton.addEventListener('click', function () { setOrb(true); });
    // The area limit is a listbox, not a <select>: a native select opens the system's own list.
    var limButton = $('lim');
    var limList = $('limlist');
    function limOptions() { return Array.prototype.slice.call(limList.querySelectorAll('[role="option"]')); }
    function limLabel(v) { return v === 'all' ? t('limAll') : t('limTop')(v); }
    function limOpen(open) {
        limList.hidden = !open;
        limButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) (limList.querySelector('[aria-selected="true"]') || limOptions()[0]).focus();
    }
    function limPick(v) {
        limButton.setAttribute('data-value', v);
        limOptions().forEach(function (o) { o.setAttribute('aria-selected', o.getAttribute('data-value') === v ? 'true' : 'false'); });
        $('limtxt').textContent = limLabel(v);
        limOpen(false);
        limButton.focus();
        state.areaLimit = v === 'all' ? 'all' : Number(v);
        resetView();
        refresh();
    }
    limButton.addEventListener('click', function () { limOpen(limList.hidden); });
    limButton.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); limOpen(true); }
    });
    limList.addEventListener('click', function (e) {
        var o = e.target.closest('[role="option"]');
        if (o) limPick(o.getAttribute('data-value'));
    });
    limList.addEventListener('keydown', function (e) {
        var opts = limOptions();
        var i = opts.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            opts[Math.max(0, Math.min(opts.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
        } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            opts[e.key === 'Home' ? 0 : opts.length - 1].focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (i >= 0) limPick(opts[i].getAttribute('data-value'));
        } else if (e.key === 'Escape') {
            e.preventDefault();
            limOpen(false);
            limButton.focus();
        } else if (e.key === 'Tab') {
            limOpen(false);
        }
    });
    document.addEventListener('pointerdown', function (e) {
        if (!limList.hidden && !e.target.closest('.dd')) limOpen(false);
    });
    dim2d.addEventListener('click', function () { setOrb(false); });
    function applyCodeStrings() {
        $('edges-label').textContent = t('edges');
        $('t-sure').textContent = t('sure');
        $('t-guess').textContent = t('guessed');
        $('t-tests').textContent = t('fTests');
        $('t-infra').textContent = t('fInfra');
        $('z-in').setAttribute('aria-label', t('zoomIn'));
        $('z-out').setAttribute('aria-label', t('zoomOut'));
        $('z-fit').textContent = t('fit');
        dim2d.textContent = t('d2');
        $('dimseg').setAttribute('aria-label', t('dimRole'));
        $('open-left').textContent = t('openLeft');
        $('open-right').textContent = t('openRight');
        $('title-left').textContent = t('repository');
        $('title-right').textContent = t('detail');
        ['left', 'right'].forEach(function (side) { $('close-' + side).setAttribute('aria-label', t('closePane')); });
        limOptions().forEach(function (o) { o.textContent = limLabel(o.getAttribute('data-value')); });
        $('limtxt').textContent = limLabel(limButton.getAttribute('data-value'));
        limButton.setAttribute('aria-label', t('limLabel'));
        limList.setAttribute('aria-label', t('limLabel'));
        dimButton.textContent = t('d3');
        dimButton.setAttribute('title', t('dimHint'));
        $('back').textContent = t('allAreas');
    }

    window.addEventListener('resize', function () { applyPanes(false); resize(); if (state.lens === 'treemap') renderLens(); });
    // The stage also changes size without a window resize (controls appearing, panes, full screen).
    if (window.ResizeObserver) new ResizeObserver(function () {
        var dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
        if (r.width && (canvas.width !== Math.max(1, Math.round(r.width * dpr)) || canvas.height !== Math.max(1, Math.round(r.height * dpr)))) resize();
    }).observe(canvas);
