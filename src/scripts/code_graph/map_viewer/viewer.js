/*
 * Offline Workbench viewer for agents/map/index.html.
 *
 * Reads the map model from the inline `#map-data` JSON block. Every number on
 * the page is a field of that model; the one thing computed here is which files
 * a blast reaches — a breadth-first walk over the edges the model ships, to the
 * depth the model's blast numbers were computed with (decision D3).
 *
 * Every string from the model reaches the page through textContent, never
 * innerHTML: file paths and symbol names come from the scanned repository.
 */
(function () {
    'use strict';

    var data = JSON.parse(document.getElementById('map-data').textContent);
    var model = data.model;
    var meta = data.meta;
    var files = model.files;
    var areas = model.areas;
    var an = model.analyses;
    var BLAST_DEPTH = model.blastDepth || 3;
    var WINDOW = model.gitWindowDays || 180;
    var OVERVIEW_AREAS = 15;
    var RAIL_CAP = 8;
    var SYMBOL_CAP = 12;
    var SCOPE_CODE = { code: 1, entry: 1, view: 1, infra: 1, isolated: 1 };

    var STR = {
        en: {
            search: 'File, symbol, route, area …', exportBtn: 'Export', light: 'Light theme', dark: 'Dark theme', langBtn: 'DE',
            health: 'Health', noGrade: function (n) { return 'No grade while ' + n + ' of 4 parts are missing'; }, gradeOf: 'Score {s} of 100',
            formula: 'Show formula', hideFormula: 'Hide formula',
            pCycles: 'Cycles (SCC)', pGuesses: 'Guessed edges', pDead: 'Dead code', pHotspots: 'Hotspots',
            missDead: 'dead → not in map.json', missHot: 'churn missing',
            tFiles: 'Files', tTrusted: 'Trusted edges', tAreas: 'Areas', tRoutes: 'Routes resolved',
            roles: 'Roles', trust: 'Edges by trust', sure: 'trusted', guessed: 'guessed', other: 'infra/config/…',
            colorBy: 'Colour by', explorer: 'Explorer', scope: 'Scope', all: 'all',
            cBlast: 'Blast', cArea: 'Area', cTests: 'Test share', cRole: 'Role', cFolder: 'Folder', cLayer: 'Layer', cChurn: 'Churn', cComplexity: 'Complexity',
            hBlast: 'How far the selection reaches', hArea: 'Louvain community', hTests: 'testShare per area', hRole: 'code / test / doc …', hFolder: 'folder of each file',
            lGraph: 'Graph', lLayers: 'Layers', lMatrix: 'Matrix', lKnowledge: 'Knowledge', lTreemap: 'Treemap', lFlow: 'Flow',
            hLayers: 'Depth rings from the selection', hMatrix: 'DSM', hKnowledge: 'Knowledge sources of the selection', hTreemap: 'Area = lines per folder', hTreemapMissing: 'needs loc per file', hFlow: 'Request paths – next design',
            edges: 'Edges:', fTests: 'Tests', fInfra: 'Infra hubs', full: 'Full screen', fullOff: 'Exit full screen',
            navBack: '← Back', repo: 'Repo', overview: 'Overview', areasOf: function (a, b) { return 'Areas (' + a + ' of ' + b + ')'; }, allAreas: '← All areas',
            hint2d: 'Drag: move · Wheel: zoom · Click: mark · Double-click: open', hint3d: 'Drag: turn · Shift+drag: move · Wheel: zoom · Click: mark · Double-click: open',
            zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit', limTop: 'Top 15', limAll: 'All areas', d2: '2D', d3: '3D Orb', dimHint: 'Show the map as an orb. Drag to turn it, Shift+drag to move it, arrow keys turn it too.',
            showPanels: 'Show panels again', direct: 'direct', transitive: 'transitive', transitive3: 'transitive ≤ 3', score: 'Score',
            legend: 'Legend', sizeOverview: 'Name = hub file of the area · Size = files per area · Line = edges between areas',
            sizeArea: 'Size = incoming edges · Line = edge, orange = points at the selection',
            lgSel: 'Selection', lgHasHit: 'holds affected files (number = files)', lgNotHit: 'not affected', lgD1: 'Depth 1', lgD2: 'Depth 2', lgD3: 'Depth 3', lgRing: 'Ring = test',
            lgArea: 'Colour = area (categorical)', lgTests: function (a, b) { return 'Test share ' + a + ' → ' + b; }, lgRole: 'Role: areas are mixed – meaningful at file level',
            lgFolder: 'Colour = top folder', lgLayer: 'Colour = layer from layers.yaml', lgChurn: function (a) { return 'Commits in the git window, 0 → ' + a; },
            visibleAreas: function (a, b) { return a + ' / ' + b + ' areas'; }, filesIn: function (n, a) { return n + ' files in ' + a; },
            areaEdges: function (n) { return n + ' area edges'; }, edgesIn: function (n, a) { return n + ' edges in ' + a; },
            affected: function (n, s) { return n + ' affected · ' + s; }, sCode: 'Code', sTests: 'Code + tests', sAll: 'everything',
            layersHead: 'Depth = hops over incoming edges from', depth0: 'Depth 0', depth: function (d) { return 'Depth ' + d; },
            n0: 'the selection', n1: 'import directly', n2: 'through one step', n3: 'edge of the analysis', selectFirst: 'Select a file to see how far it reaches.',
            matrixHead: 'Dependency structure matrix at area level · cell = edges between two areas · highlighted row/column = selection · red frame = both areas hold files of one cycle',
            matrixNote: function (a, b, n) { return 'Pick a cell to list the edges between two areas. Strongest coupling: ' + a + ' ↔ ' + b + ' with ' + n + ' edges.'; },
            diag: 'diagonal (inside the area)', edgesN: function (n) { return n + ' edges'; },
            knowHead: 'The same selection, along the knowledge sources · only files with an edge to the selection',
            kActive: 'active', kPlanned: 'planned', kArchived: 'archived', kDraft: 'draft', kDup: 'duplicate',
            kCode: 'Code', kTests: 'Tests', kContracts: 'Contracts', kRoadmaps: 'Roadmaps', kEvidence: 'Evidence', kDrafts: 'Drafts', kMemory: 'Memory',
            collectorMissing: 'Collector missing', memNote1: 'mem entries for the file with validity (valid_from / valid_to), source and use in retrieval.',
            memNote2: 'Mentioned ≠ describes: the same entity shows as a guessed edge.', artLayer: 'Artefact layer', knowFile: 'Knowledge of the file',
            docs: function (n) { return n + ' documents'; }, finding: 'Finding', moreDrafts: 'More drafts than contracts',
            draftsOf: function (d, n) { return d + ' of ' + n + ' sources sit in tmp folders. An agent in doubt reads the draft instead of the contract.'; },
            noArtLayer: 'not an agent-config tree', symbolsCount: function (n) { return n + ' symbols'; },
            tabFile: 'File', tabFind: 'Findings', tabArea: 'Area', pickFile: 'Pick a file — the most used ones:',
            tests: function (n) { return n + ' tests'; }, guesses: function (n) { return n + ' guessed'; }, locMissing: 'LOC / language missing', hub: 'Hub', dead: 'dead',
            blastRadius: 'Blast radius', notScope: 'Not a code file: no blast record; the walk below follows the selected scope.',
            shareText: function (a, b, p) { return a + ' of ' + b + ' · ' + p; }, marks: 'Marks 10 / 25 %',
            insight: function (c, t, d) { return c + ' code files reachable. Also ' + t + ' tests and ' + d + ' documentation files – shown through the scope switch.'; },
            depthList: function (d) { return d === 1 ? 'Depth 1 · direct' : 'Depth ' + d; }, moreN: function (n) { return '+ ' + n + ' more'; },
            blastFormula: 'Score = direct + 0.5 × transitive · trusted edges only · level by share of scope: ≥ 50 % critical, ≥ 25 % high, ≥ 10 % medium',
            levels: { critical: 'critical', high: 'high', medium: 'medium', low: 'low' },
            uses: 'Uses', usedBy: 'Used by', relTrust: 'edge · trust', symbols: 'Symbols', symCols: 'line · kind · calls int/ext',
            knowledge: 'Knowledge', openCenter: 'Open in the centre', memMissing: 'Memory: collector missing',
            ownership: 'Ownership · Churn', gitMissing: 'Git collector missing', gitMissingNote: 'Top 3 authors, commits in the git window, last change, bus factor. Hidden until the refresh writes owners / churn.',
            commits: function (n) { return n + ' commits in ' + WINDOW + ' days'; }, lastChange: 'last change', busFactor: 'Bus factor: one author holds more than 80 %',
            coveredBy: 'Covered by tests', requestPaths: 'Request paths', externals: 'External dependencies',
            cycles: 'Cycles', biggest: function (n) { return 'Largest: ' + n + ' files'; }, surprises: 'Surprising edges', drift: 'Drift since the last map',
            layerBreaches: 'Layer breaches', hotspots: 'Hotspots', deadFiles: 'Dead files', needLayers: 'Needs agents/map/layers.yaml', needChurn: 'Needs git history',
            prs: 'Open PRs sharing an area', change: 'This change',
            files: function (n) { return n + ' files'; }, cohesion: 'Cohesion', testShare: 'Tests',
            mismatch: function (p) { return p + ' of the files sit outside the hub folder – folders and real coupling differ here.'; }, mostUsed: 'Most used',
            allAreasList: 'All areas', none: 'none', kinds: { contract: 'Contract', adr: 'ADR', 'roadmap-active': 'active', 'roadmap-planned': 'planned', 'roadmap-later': 'later', 'roadmap-archived': 'archived', evidence: 'Evidence', draft: 'Draft', doc: 'Doc' },
            roleNames: { code: 'code', test: 'test', entry: 'entry point', view: 'view', migration: 'migration', translation: 'translation', config: 'config', doc: 'doc', infra: 'infrastructure', isolated: 'isolated' }
        },
        de: {
            search: 'Datei, Symbol, Route, Area …', exportBtn: 'Export', light: 'Helles Design', dark: 'Dunkles Design', langBtn: 'EN',
            health: 'Health', noGrade: function (n) { return 'Kein Grade, solange ' + n + ' von 4 Teilwerten fehlen'; }, gradeOf: 'Score {s} von 100',
            formula: 'Formel ansehen', hideFormula: 'Formel ausblenden',
            pCycles: 'Zyklen (SCC)', pGuesses: 'Geratene Kanten', pDead: 'Toter Code', pHotspots: 'Hotspots',
            missDead: 'dead → map.json fehlt', missHot: 'churn fehlt',
            tFiles: 'Dateien', tTrusted: 'Sichere Kanten', tAreas: 'Areas', tRoutes: 'Routen gelöst',
            roles: 'Rollen', trust: 'Kanten nach Vertrauen', sure: 'sicher', guessed: 'geraten', other: 'infra/config/…',
            colorBy: 'Färben nach', explorer: 'Explorer', scope: 'Scope', all: 'alles',
            cBlast: 'Blast', cArea: 'Area', cTests: 'Test-Anteil', cRole: 'Rolle', cFolder: 'Ordner', cLayer: 'Layer', cChurn: 'Churn', cComplexity: 'Komplexität',
            hBlast: 'Betroffenheit der Auswahl', hArea: 'Louvain-Community', hTests: 'testShare je Area', hRole: 'code / test / doc …', hFolder: 'Ordner jeder Datei',
            lGraph: 'Graph', lLayers: 'Layers', lMatrix: 'Matrix', lKnowledge: 'Knowledge', lTreemap: 'Treemap', lFlow: 'Flow',
            hLayers: 'Tiefenringe ab Auswahl', hMatrix: 'DSM', hKnowledge: 'Wissensquellen zur Auswahl', hTreemap: 'Fläche = Zeilen je Ordner', hTreemapMissing: 'braucht loc je Datei', hFlow: 'Request-Pfade – nächster Entwurf',
            edges: 'Kanten:', fTests: 'Tests', fInfra: 'Infra-Hubs', full: 'Vollbild', fullOff: 'Vollbild beenden',
            navBack: '← Zurück', repo: 'Repo', overview: 'Übersicht', areasOf: function (a, b) { return 'Areas (' + a + ' von ' + b + ')'; }, allAreas: '← Alle Areas',
            hint2d: 'Ziehen: verschieben · Rad: zoomen · Klick: markieren · Doppelklick: öffnen', hint3d: 'Ziehen: drehen · Shift+Ziehen: verschieben · Rad: zoomen · Klick: markieren · Doppelklick: öffnen',
            zoomIn: 'Hineinzoomen', zoomOut: 'Herauszoomen', fit: 'Einpassen', limTop: 'Top 15', limAll: 'Alle Areas', d2: '2D', d3: '3D Orb', dimHint: 'Karte als Kugel zeigen. Ziehen dreht sie, Shift+Ziehen verschiebt sie, die Pfeiltasten drehen ebenfalls.',
            showPanels: 'Panels wieder einblenden', direct: 'direkt', transitive: 'transitiv', transitive3: 'transitiv ≤ 3', score: 'Score',
            legend: 'Legende', sizeOverview: 'Name = Hub-Datei der Area · Größe = Dateien je Area · Linie = Kanten zwischen Areas',
            sizeArea: 'Größe = eingehende Kanten · Linie = Kante, orange = zeigt auf die Auswahl',
            lgSel: 'Auswahl', lgHasHit: 'enthält Betroffene (Zahl = Dateien)', lgNotHit: 'nicht betroffen', lgD1: 'Tiefe 1', lgD2: 'Tiefe 2', lgD3: 'Tiefe 3', lgRing: 'Ring = Test',
            lgArea: 'Farbe = Area (kategorisch)', lgTests: function (a, b) { return 'Test-Anteil ' + a + ' → ' + b; }, lgRole: 'Rolle: Areas sind gemischt – erst auf Datei-Ebene sinnvoll',
            lgFolder: 'Farbe = oberster Ordner', lgLayer: 'Farbe = Layer aus layers.yaml', lgChurn: function (a) { return 'Commits im Git-Fenster, 0 → ' + a; },
            visibleAreas: function (a, b) { return a + ' / ' + b + ' Areas'; }, filesIn: function (n, a) { return n + ' Dateien in ' + a; },
            areaEdges: function (n) { return n + ' Area-Kanten'; }, edgesIn: function (n, a) { return n + ' Kanten in ' + a; },
            affected: function (n, s) { return n + ' betroffen · ' + s; }, sCode: 'Code', sTests: 'Code + Tests', sAll: 'alles',
            layersHead: 'Tiefe = Hops über eingehende Kanten von', depth0: 'Tiefe 0', depth: function (d) { return 'Tiefe ' + d; },
            n0: 'die Auswahl', n1: 'importieren direkt', n2: 'über einen Zwischenschritt', n3: 'Rand der Analyse', selectFirst: 'Wähle eine Datei, um zu sehen, wie weit sie reicht.',
            matrixHead: 'Dependency-Structure-Matrix auf Area-Ebene · Zelle = Kanten zwischen zwei Areas · hervorgehobene Zeile/Spalte = Auswahl · roter Rahmen = beide Areas enthalten Dateien eines Zyklus',
            matrixNote: function (a, b, n) { return 'Zelle wählen, um die Kanten zwischen zwei Areas zu listen. Stärkste Kopplung: ' + a + ' ↔ ' + b + ' mit ' + n + ' Kanten.'; },
            diag: 'Diagonale (innerhalb der Area)', edgesN: function (n) { return n + ' Kanten'; },
            knowHead: 'Dieselbe Auswahl, entlang der Wissensquellen · nur Dateien mit Kante zur Auswahl',
            kActive: 'aktiv', kPlanned: 'geplant', kArchived: 'archiviert', kDraft: 'Entwurf', kDup: 'Dublette',
            kCode: 'Code', kTests: 'Tests', kContracts: 'Verträge', kRoadmaps: 'Roadmaps', kEvidence: 'Evidence', kDrafts: 'Entwürfe', kMemory: 'Memory',
            collectorMissing: 'Collector fehlt', memNote1: 'mem-Einträge zur Datei mit Gültigkeit (valid_from / valid_to), Quelle und Nutzung im Retrieval.',
            memNote2: 'Erwähnt ≠ beschreibt: gleiche Entität erscheint als geratene Kante.', artLayer: 'Artefakt-Schicht', knowFile: 'Wissen zur Datei',
            docs: function (n) { return n + ' Dokumente'; }, finding: 'Befund', moreDrafts: 'Mehr Entwürfe als Verträge',
            draftsOf: function (d, n) { return d + ' von ' + n + ' Quellen liegen in tmp-Ordnern. Ein Agent liest im Zweifel den Entwurf statt des Vertrags.'; },
            noArtLayer: 'kein agent-config-Baum', symbolsCount: function (n) { return n + ' Symbole'; },
            tabFile: 'Datei', tabFind: 'Befunde', tabArea: 'Area', pickFile: 'Datei wählen — die meistgenutzten:',
            tests: function (n) { return n + ' Tests'; }, guesses: function (n) { return n + ' geraten'; }, locMissing: 'LOC / Sprache fehlt', hub: 'Hub', dead: 'tot',
            blastRadius: 'Blast Radius', notScope: 'Keine Code-Datei: kein Blast-Datensatz; die Liste folgt dem gewählten Scope.',
            shareText: function (a, b, p) { return a + ' von ' + b + ' · ' + p; }, marks: 'Marken 10 / 25 %',
            insight: function (c, t, d) { return c + ' Code-Dateien erreichbar. Zusätzlich ' + t + ' Tests und ' + d + ' Doku-Dateien – über den Scope-Schalter einblendbar.'; },
            depthList: function (d) { return d === 1 ? 'Tiefe 1 · direkt' : 'Tiefe ' + d; }, moreN: function (n) { return '+ ' + n + ' weitere'; },
            blastFormula: 'Score = direkt + 0,5 × transitiv · nur sichere Kanten · Level nach Anteil am Scope: ≥ 50 % kritisch, ≥ 25 % hoch, ≥ 10 % mittel',
            levels: { critical: 'kritisch', high: 'hoch', medium: 'mittel', low: 'niedrig' },
            uses: 'Nutzt', usedBy: 'Genutzt von', relTrust: 'Kante · Vertrauen', symbols: 'Symbole', symCols: 'Zeile · Art · Aufrufe int/ext',
            knowledge: 'Wissen', openCenter: 'In der Mitte öffnen', memMissing: 'Memory: Collector fehlt',
            ownership: 'Ownership · Churn', gitMissing: 'Git-Collector fehlt', gitMissingNote: 'Top-3-Autoren, Commits im Git-Fenster, letzte Änderung, Bus-Faktor. Ausgeblendet, bis der Refresh owners / churn schreibt.',
            commits: function (n) { return n + ' Commits in ' + WINDOW + ' Tagen'; }, lastChange: 'letzte Änderung', busFactor: 'Bus-Faktor: ein Autor hält mehr als 80 %',
            coveredBy: 'Abgedeckt durch Tests', requestPaths: 'Request-Pfade', externals: 'Externe Abhängigkeiten',
            cycles: 'Zyklen', biggest: function (n) { return 'Größter: ' + n + ' Dateien'; }, surprises: 'Überraschende Kanten', drift: 'Drift seit letzter Karte',
            layerBreaches: 'Layer-Verletzungen', hotspots: 'Hotspots', deadFiles: 'Tote Dateien', needLayers: 'Braucht agents/map/layers.yaml', needChurn: 'Braucht Git-Historie',
            prs: 'Offene PRs im selben Bereich', change: 'Diese Änderung',
            files: function (n) { return n + ' Dateien'; }, cohesion: 'Kohäsion', testShare: 'Tests',
            mismatch: function (p) { return p + ' der Dateien liegen außerhalb des Hub-Ordners – Ordner und echte Kopplung weichen hier ab.'; }, mostUsed: 'Meistgenutzt',
            allAreasList: 'Alle Areas', none: 'keine', kinds: { contract: 'Vertrag', adr: 'ADR', 'roadmap-active': 'aktiv', 'roadmap-planned': 'geplant', 'roadmap-later': 'später', 'roadmap-archived': 'archiviert', evidence: 'Evidence', draft: 'Entwurf', doc: 'Doku' },
            roleNames: { code: 'code', test: 'test', entry: 'Einstieg', view: 'view', migration: 'Migration', translation: 'Übersetzung', config: 'config', doc: 'doc', infra: 'Infrastruktur', isolated: 'isoliert' }
        }
    };
    var lang = (navigator.language || 'en').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
    function t(key) { return STR[lang][key]; }
    function num(n) { return Number(n).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US'); }
    function pct(x, digits) { return (x * 100).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: digits == null ? 1 : digits }) + ' %'; }

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

    var CAT = ['#3ec5ff', '#3ddc84', '#c9a2ff', '#ffc14d', '#6fd3e0', '#f28fb3', '#d6c46b', '#9fb4c8'];
    function cat(i) { return CAT[((i % CAT.length) + CAT.length) % CAT.length]; }
    function strHash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
    function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
    function base(p) { var i = p.lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); }
    function dir(p) { var i = p.lastIndexOf('/'); return i < 0 ? '.' : p.slice(0, i); }
    function top2(p) { var s = p.split('/'); return s.length > 2 ? s[0] + '/' + s[1] : s[0]; }
    function areaLabel(a) { return a.kind === 'small-parts' ? '… ' + base(a.name.replace(/^small parts · /, '')) : base(a.name); }
    function inScope(f, scope) {
        if (scope === 'all') return true;
        if (scope === 'tests') return SCOPE_CODE[f.role] === 1 || f.role === 'test';
        return SCOPE_CODE[f.role] === 1;
    }

    function el(tag, attrs, text) {
        var n = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]); });
        if (text != null) n.textContent = String(text);
        return n;
    }
    function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
    function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
    function swatch(colour) { var s = el('span', { class: 'swatch' }); s.style.background = colour; return s; }
    function dotEl(cls, colour) { var d = el('span', { class: 'dot' + (cls ? ' ' + cls : '') }); if (colour) { if (cls === 'ring') d.style.borderColor = colour; else d.style.background = colour; } return d; }

    var $ = function (id) { return document.getElementById(id); };
    var canvas = $('stage');
    var ctx = canvas.getContext('2d');
    var panel = $('panel');
    var searchInput = $('search');
    var results = $('results');
    var lensView = $('lensview');
    var graphWrap = $('graphwrap');

    var ORB_YAW = 0.35;
    var ORB_PITCH = -0.3;

    var state = {
        lens: 'graph', colorBy: 'blast', scope: 'code', tab: 'file',
        level: 'overview', area: -1, file: -1, cell: null,
        showTrusted: true, showGuesses: false, showTests: true, showInfra: false,
        full: false, formula: false, treePath: '', scopeDir: '', open: Object.create(null),
        view: { scale: 1, x: 0, y: 0 }, orb: false, rot: { yaw: ORB_YAW, pitch: ORB_PITCH },
        // Which areas the overview shows. A data choice, so it never depends on 2D / 3D.
        areaLimit: 'all'
    };
    var drawn = [];
    // Every step deeper records where it came from, so each lens has a way back.
    var trail = [];
    function step() {
        trail.push({ lens: state.lens, level: state.level, area: state.area, file: state.file, tab: state.tab, treePath: state.treePath, cell: state.cell });
        if (trail.length > 50) trail.shift();
    }
    function back() {
        var prev = trail.pop();
        if (!prev) return;
        var levelChanged = prev.level !== state.level || prev.area !== state.area;
        Object.keys(prev).forEach(function (k) { state[k] = prev[k]; });
        if (levelChanged) resetView();
        refresh();
    }
    function lensHome() { step(); state.treePath = ''; state.cell = null; refresh(); }
    function exposeView() {
        window.__mapView = { lens: state.lens, treePath: state.treePath, level: state.level, area: state.area, file: state.file, shownAreas: state.level === 'overview' ? overviewAreas() : [], drawn: drawn.map(function (d) { return { kind: d.kind, idx: d.idx, x: d.x, y: d.y }; }) };
    }
    window.__mapLabelBoxes = { boxes: [], width: 0, height: 0 };

    // Preselect the most used code file that sits in an area: a held-out hub has no area to open.
    files.forEach(function (f, i) {
        if (!f.blast || f.area < 0) return;
        if (state.file < 0 || f.inFiles > files[state.file].inFiles) state.file = i;
    });

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
    files.forEach(function (f) { if (f.churn) maxChurn = Math.max(maxChurn, f.churn); });
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
            case 'churn': return f.churn ? mix('var(--brand)', 'var(--node)', Math.sqrt(f.churn / maxChurn)) : 'var(--node)';
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
            case 'churn': {
                var sum = 0;
                a.files.forEach(function (f) { sum += files[f].churn || 0; });
                return sum ? mix('var(--brand)', 'var(--node)', Math.sqrt(sum / a.files.length / maxChurn)) : 'var(--node)';
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
    function toScreen(x, y) {
        var s = size();
        var k = (Math.min(s.w, s.h) / 2 - 56) * state.view.scale;
        return [s.w / 2 + x * k + state.view.x, s.h / 2 + y * k + state.view.y];
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
        var cy = Math.cos(state.rot.yaw);
        var sy = Math.sin(state.rot.yaw);
        var x1 = px * cy + pz * sy;
        var z1 = -px * sy + pz * cy;
        var cp = Math.cos(state.rot.pitch);
        var sp = Math.sin(state.rot.pitch);
        return [x1, py * cp - z1 * sp, py * sp + z1 * cp];
    }
    function orbRadius() { var s = size(); return (Math.min(s.w, s.h) / 2 - 48) * state.view.scale; }

    function overviewAreas() {
        var n = state.areaLimit === 'top' ? Math.min(OVERVIEW_AREAS, areas.length) : areas.length;
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
            var span = Math.max(maxX - minX, maxY - minY, 1e-6) / 2;
            var mx = (minX + maxX) / 2;
            var my = (minY + maxY) / 2;
            shown.forEach(function (i) {
                var a = areas[i];
                var x = state.orb ? a.x : (a.x - mx) / span * 0.85;
                var y = state.orb ? a.y : (a.y - my) / span * 0.85;
                out.push({ kind: 'area', idx: i, x: x, y: y, r: 8 + 30 * Math.sqrt(a.files.length / max), label: areaLabel(a), weight: a.files.length });
            });
            return out;
        }
        var ar = areas[state.area];
        var maxIn = 1;
        ar.local.forEach(function (l) { maxIn = Math.max(maxIn, files[l[0]].inFiles); });
        ar.local.forEach(function (l) {
            var f = files[l[0]];
            if (!state.showTests && f.role === 'test') return;
            if (!state.showInfra && f.role === 'infra' && l[0] !== state.file) return;
            var outside = f.area !== state.area;
            out.push({ kind: 'file', idx: l[0], x: l[1], y: l[2], r: outside ? 4 : 4 + 12 * Math.sqrt(f.inFiles / maxIn), label: base(f.path), weight: f.inFiles + (l[0] === state.file ? 1e6 : 0) + (outside ? -1000 : 0), outside: outside });
        });
        return out;
    }

    function draw() {
        if (state.lens !== 'graph') return;
        var s = size();
        ctx.clearRect(0, 0, s.w, s.h);
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
                var p = toScreen(n.x, n.y);
                n.sx = p[0];
                n.sy = p[1];
                pos[n.kind + n.idx] = n;
            });
        }
        function nearness(a) { return state.orb ? 0.28 + 0.72 * (a.depth + 1) / 2 : 1; }

        var edge = cssVar('--edge');
        var brand = cssVar('--brand');
        var amber = cssVar('--amber');
        var blastMode = state.colorBy === 'blast';
        ctx.lineCap = 'round';
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
            });
            ctx.globalAlpha = 1;
        } else {
            var drawEdges = function (list, dashed) {
                ctx.setLineDash(dashed ? [4, 4] : []);
                list.forEach(function (e) {
                    var a = pos['file' + e[0]];
                    var b = pos['file' + e[1]];
                    if (!a || !b) return;
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

        var nodeStroke = cssVar('--nodeStroke');
        var bg = cssVar('--bg');
        var glowA = Number(cssVar('--glow')) || 0.5;
        var scopeDim = state.scopeDir;
        drawn = [];
        nodes.forEach(function (n) {
            var colour;
            var isTest = false;
            var sel = false;
            if (n.kind === 'area') {
                colour = resolveColour(areaColour(n.idx));
                sel = state.file >= 0 ? files[state.file].area === n.idx : state.area === n.idx;
            } else {
                var f = files[n.idx];
                isTest = f.role === 'test';
                colour = n.outside && !blastMode ? resolveColour('var(--node)') : resolveColour(fileColour(n.idx));
                sel = n.idx === state.file;
            }
            var alpha = nearness(n);
            if (scopeDim && n.kind === 'file' && files[n.idx].path.indexOf(scopeDim + '/') !== 0) alpha *= 0.35;
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
            ctx.globalAlpha = 1;
            if (!state.orb || n.depth > 0) drawn.push({ kind: n.kind, idx: n.idx, x: n.sx, y: n.sy, r: Math.max(n.r, 8) });
        });
        drawLabels(state.orb ? nodes.filter(function (n) { return n.depth > 0.15; }) : nodes, s, blastMode);
        window.__mapOrbNodes = state.orb ? nodes.map(function (n) { return { x: n.sx, y: n.sy, r: n.r, near: n.depth > 0, u: n.u }; }) : [];
        renderFoot();
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
        function fits(box) {
            if (box.x < 2 || box.y < 2 || box.x + box.w > s.w - 2 || box.y + box.h > s.h - 2) return false;
            return !placed.some(function (p) { return box.x < p.x + p.w && p.x < box.x + box.w && box.y < p.y + p.h && p.y < box.y + box.h; });
        }
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        for (var i = 0; i < order.length && count < limit; i++) {
            var n = order[i];
            var sel = n.kind === 'file' && n.idx === state.file;
            ctx.font = n.kind === 'area' ? '600 12px ' + sans : (sel ? '600' : '500') + ' 11px ' + mono;
            var label = n.label.length > 34 ? n.label.slice(0, 33) + '…' : n.label;
            var w = ctx.measureText(label).width;
            var h = 14;
            var box = { x: n.sx - w / 2 - 2, y: n.sy + n.r + 4, w: w + 4, h: h };
            if (!fits(box)) {
                box = { x: n.sx + n.r + 4, y: n.sy - h / 2, w: w + 4, h: h };
                if (!fits(box)) continue;
            }
            placed.push(box);
            ctx.strokeStyle = bg;
            ctx.lineWidth = 4;
            ctx.strokeText(label, box.x + 2, box.y + h / 2);
            ctx.fillStyle = n.kind === 'area' ? text : sel ? brandText : soft;
            ctx.fillText(label, box.x + 2, box.y + h / 2);
            count += 1;
        }
        if (blastMode && state.level === 'overview') {
            ctx.font = '600 11px ' + mono;
            nodes.forEach(function (n) {
                var hits = areaHits(n.idx);
                if (!hits || n.r <= 12 || (state.file >= 0 && files[state.file].area === n.idx)) return;
                var txt = String(hits);
                var w = ctx.measureText(txt).width + 16;
                var box = { x: n.sx + n.r - 6, y: n.sy - n.r - 10, w: w, h: 18 };
                if (!fits(box)) return;
                placed.push(box);
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
        window.__mapLabelBoxes = { boxes: placed, width: s.w, height: s.h };
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

    function hitTest(x, y) {
        var best = null;
        var bestD = Infinity;
        drawn.forEach(function (d) {
            var dist = Math.hypot(d.x - x, d.y - y);
            if (dist <= d.r && dist < bestD) { best = d; bestD = dist; }
        });
        return best;
    }

    // Header.
    function renderHeader() {
        var pin = model.pin || { commit: meta.commit, freshness: meta.state, generation: meta.graph_generation || '' };
        $('pin-commit').textContent = '@ ' + pin.commit + (pin.date ? ' · ' + pin.date : '');
        var fresh = $('pin-fresh');
        var st = String(pin.freshness || meta.state || '');
        fresh.textContent = st === 'fresh' ? 'FRESH' : st.toUpperCase();
        fresh.className = 'chip ' + (st === 'fresh' ? 'fresh' : 'stale');
        $('pin-gen').textContent = 'gen ' + String(pin.generation || '').slice(0, 8);
    }

    // Left rail.
    function renderRail() {
        var h = $('health');
        clear(h);
        var health = model.health;
        var head = el('div', { class: 'health-head' });
        var parts = health ? health.parts : null;
        var missing = parts ? ['dead', 'cycles', 'guesses', 'hotspots'].filter(function (k) { return !parts[k]; }).length : 4;
        var ring = el('div', { class: 'ring mono' + (health && health.grade ? '' : ' none') }, health && health.grade ? health.grade : '–');
        var title = add(el('div', { class: 'health-title' }), el('b', null, t('health')),
            el('span', null, health && health.grade ? t('gradeOf').replace('{s}', num(health.score)) : t('noGrade')(missing)));
        var fbtn = el('button', { type: 'button', class: 'linkish', 'aria-expanded': String(state.formula) }, state.formula ? t('hideFormula') : t('formula'));
        fbtn.addEventListener('click', function () { state.formula = !state.formula; renderRail(); });
        title.appendChild(fbtn);
        add(h, add(head, ring, title));
        if (state.formula && health) h.appendChild(el('div', { class: 'formula', id: 'formel' }, health.formula));
        var list = el('div', { class: 'parts' });
        function bar(label, valueText, ratio, colour, cls) {
            var p = el('div', { class: 'part' });
            var v = el('span', { class: 'mono' }, valueText);
            if (cls) v.style.color = 'var(' + cls + ')';
            add(p, el('span', null, label), v);
            var b = el('div', { class: 'bar' });
            var i = el('i');
            i.style.width = Math.max(0, Math.min(100, ratio * 100)) + '%';
            i.style.background = colour;
            b.appendChild(i);
            p.appendChild(b);
            list.appendChild(p);
        }
        function miss(label, note) {
            list.appendChild(add(el('div', { class: 'part missing' }), el('span', null, label), el('span', { class: 'dashchip mono' }, note)));
        }
        if (parts) {
            bar(t('pCycles'), num(parts.cycles.value), 1 - parts.cycles.points / 25, 'var(--amber)', '--amberText');
            bar(t('pGuesses'), pct(parts.guesses.value), 1 - parts.guesses.points / 25, 'var(--cyan)');
            if (parts.dead) bar(t('pDead'), pct(parts.dead.value), 1 - parts.dead.points / 25, 'var(--alert)');
            else miss(t('pDead'), t('missDead'));
            if (parts.hotspots) bar(t('pHotspots'), pct(parts.hotspots.value), 1 - parts.hotspots.points / 25, 'var(--brand)');
            else miss(t('pHotspots'), t('missHot'));
        } else {
            bar(t('pCycles'), num(an.cyclesTotal), 0, 'var(--amber)', '--amberText');
            bar(t('pGuesses'), pct(an.guessShare), an.guessShare, 'var(--cyan)');
            miss(t('pDead'), t('missDead'));
            miss(t('pHotspots'), t('missHot'));
        }
        h.appendChild(list);

        var k = $('kpis');
        clear(k);
        var tiles = el('div', { class: 'tiles' });
        function tile(v, label, small) {
            var d = el('div', { class: 'tile' });
            var vv = el('div', { class: 'v' }, v);
            if (small) vv.appendChild(el('small', null, small));
            add(d, vv, el('div', { class: 'cap' }, label));
            tiles.appendChild(d);
        }
        tile(num(files.length), t('tFiles'));
        tile(num(an.trustedEdges), t('tTrusted'));
        tile(num(areas.length), t('tAreas'));
        tile(num(an.requestPathsResolved), t('tRoutes'), '/' + num(an.requestPathsTotal));
        k.appendChild(tiles);
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
        [['blast', 'cBlast', 'hBlast'], ['area', 'cArea', 'hArea'], ['tests', 'cTests', 'hTests'], ['role', 'cRole', 'hRole'],
            ['folder', 'cFolder', 'hFolder'], ['layer', 'cLayer'], ['churn', 'cChurn'], ['complexity', 'cComplexity']].forEach(function (o) {
            var lg = legendByKey[o[0]];
            var off = lg ? !lg.available : (o[0] === 'layer' || o[0] === 'churn' || o[0] === 'complexity');
            var b = el('button', { type: 'button', role: 'radio', class: 'opt', 'aria-checked': String(state.colorBy === o[0]), disabled: off, title: off ? (lg && lg.reason ? lg.reason : '') : (o[2] ? t(o[2]) : '') }, t(o[1]));
            b.addEventListener('click', function () { if (!off) { state.colorBy = o[0]; refresh(); } });
            group.appendChild(b);
        });
        c.appendChild(group);
        renderExplorer();
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
                add(s, sw, document.createTextNode(r[0] + ' ' + pct(r[1] / Math.max(1, total))));
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
                    kid.files.slice(0, 60).forEach(function (i) {
                        var fb = el('button', { type: 'button', class: i === state.file ? 'sel' : '' });
                        fb.style.paddingLeft = (6 + (depth + 1) * 14) + 'px';
                        add(fb, el('span', null, (i === state.file ? '● ' : '') + base(files[i].path)), el('span', { class: 'n' }, files[i].role));
                        fb.addEventListener('click', function () { openFile(i); });
                        box.appendChild(fb);
                        rows += 1;
                    });
                }
            });
        }
        walkTree(tree, '', 0);
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
            b.addEventListener('click', function () { if (!o[3]) { state.lens = o[0]; refresh(); } });
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
            var shown = state.areaLimit === 'top' ? Math.min(OVERVIEW_AREAS, areas.length) : areas.length;
            if (state.level === 'area') {
                c.appendChild(btn('Areas', goHome));
                c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
                c.appendChild(btn(areas[state.area].id + ' · ' + t('files')(areas[state.area].files.length)));
            } else {
                c.appendChild(btn(t('areasOf')(shown, areas.length)));
                c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
                c.appendChild(btn(t('overview')));
            }
        } else {
            var atStart = !state.treePath && !state.cell;
            var home = btn(t({ layers: 'lLayers', matrix: 'lMatrix', knowledge: 'lKnowledge', treemap: 'lTreemap' }[state.lens]), atStart ? null : lensHome);
            home.className = 'lens-home';
            c.appendChild(home);
            if (sel && state.lens !== 'treemap' && state.lens !== 'matrix') { c.appendChild(el('span', { 'aria-hidden': 'true' }, '›')); c.appendChild(btn(sel)); }
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
        if (state.colorBy === 'blast') {
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
            L.appendChild(legendItem(t('lgFolder'), dotEl('', cat(1))));
        } else if (state.colorBy === 'layer') {
            L.appendChild(legendItem(t('lgLayer'), dotEl('', cat(2))));
        } else if (state.colorBy === 'churn') {
            var g3 = el('span', { class: 'dot' }); g3.style.width = '40px'; g3.style.borderRadius = '3px'; g3.style.background = 'linear-gradient(90deg,var(--node),var(--brand))';
            L.appendChild(legendItem(t('lgChurn')(num(maxChurn)), g3));
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
        } else {
            var shown = overviewAreas().length;
            f.appendChild(el('span', null, t('visibleAreas')(num(shown), num(areas.length))));
            f.appendChild(el('span', null, t('areaEdges')(num(model.areaEdges.length))));
        }
        f.appendChild(el('span', { class: 'hot' }, t('affected')(num(hit), t(state.scope === 'code' ? 'sCode' : state.scope === 'tests' ? 'sTests' : 'sAll'))));
    }

    function renderLens() {
        var graph = state.lens === 'graph';
        graphWrap.hidden = !graph;
        lensView.hidden = graph;
        $('back').hidden = !(graph && state.level === 'area');
        $('hint').textContent = state.orb ? t('hint3d') : t('hint2d');
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
        if (selArea >= n) ids[n - 1] = selArea;
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
            note.appendChild(el('div', null, areas[A].id + ' ' + areaLabel(areas[A]) + ' ↔ ' + areas[B].id + ' ' + areaLabel(areas[B]) + ': ' +
                (A === B ? t('diag') : t('edgesN')(M[pos[A]][pos[B]]))));
            if (A !== B) {
                var ul = el('ul', { class: 'plist' });
                model.edges.filter(function (e) { return (files[e[0]].area === A && files[e[1]].area === B) || (files[e[0]].area === B && files[e[1]].area === A); })
                    .slice(0, 20).forEach(function (e) {
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
    function kcard(i, extra) {
        var f = files[i];
        var cls = 'kcard';
        if (f.knowledge === 'draft') cls += ' draft';
        if (f.knowledge === 'roadmap-archived') cls += ' archived';
        if (f.duplicate) cls += ' dup';
        var b = el('button', { type: 'button', class: cls, title: f.path });
        b.appendChild(document.createTextNode(base(f.path)));
        var sub = extra || (f.knowledge ? t('kinds')[f.knowledge] + (f.duplicate ? ' · ' + t('kDup') : '') : dir(f.path));
        b.appendChild(el('small', null, sub));
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
        function col(title, count, children) {
            var c = el('section', { class: 'kcol' });
            c.appendChild(add(el('div', { class: 'cap' }), el('span', null, title), el('span', null, count)));
            children.forEach(function (ch) { c.appendChild(ch); });
            grid.appendChild(c);
        }
        var sel = add(el('div', { class: 'kcard selcard mono' }), document.createTextNode(base(f.path)), el('small', null, t('symbolsCount')(f.symbols.length + f.symbolsOmitted) + ' · in ' + f.inFiles + ' · out ' + f.outFiles));
        var uses = outOf[state.file].slice(0, 6).map(function (x) { return kcard(x[0], dir(files[x[0]].path)); });
        col(t('kCode'), '1 + ' + outOf[state.file].length, [sel].concat(uses));
        col(t('kTests'), String(f.tests.length), f.tests.slice(0, 8).map(function (i) { return kcard(i, dir(files[i].path)); }));
        col(t('kContracts'), String(g.contracts.length), g.contracts.slice(0, 8).map(function (i) { return kcard(i); }));
        col(t('kRoadmaps'), String(g.roadmaps.length), g.roadmaps.slice(0, 8).map(function (i) { return kcard(i); }));
        col(t('kEvidence'), String(g.evidence.length), g.evidence.slice(0, 8).map(function (i) { return kcard(i); }));
        col(t('kDrafts'), String(g.drafts.length), g.drafts.slice(0, 8).map(function (i) { return kcard(i); }));
        col(t('kMemory'), '?', [add(el('div', { class: 'kmissing' }), el('b', null, t('collectorMissing')), el('span', null, t('memNote1')), el('span', null, t('memNote2')))]);
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
        Object.keys(node.kids).forEach(function (k) { var v = locOf(node.kids[k]); if (v > 0) items.push({ name: k, value: v, dir: true }); });
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
            b.style.left = r[1] + 'px'; b.style.top = r[2] + 'px'; b.style.width = Math.max(0, r[3]) + 'px'; b.style.height = Math.max(0, r[4]) + 'px';
            var colour;
            if (it.file !== undefined) colour = fileColour(it.file);
            else {
                var sample = -1;
                (function find(n) { if (sample >= 0) return; if (n.files.length) { sample = n.files[0]; return; } Object.keys(n.kids).some(function (k) { find(n.kids[k]); return sample >= 0; }); })(node.kids[it.name]);
                colour = state.colorBy === 'blast' || sample < 0 ? cat(strHash(it.name)) : fileColour(sample);
            }
            b.style.background = colour === 'var(--node)' ? 'var(--raise)' : colour;
            if (colour === 'var(--node)') b.style.color = 'var(--soft)';
            if (r[3] > 50 && r[4] > 22) add(b, el('span', null, it.name + (it.dir ? '/' : '')), r[4] > 36 ? el('small', null, num(it.value)) : null);
            b.addEventListener('click', function () {
                if (it.file !== undefined) openFile(it.file);
                else { step(); state.treePath = state.treePath ? state.treePath + '/' + it.name : it.name; refresh(); }
            });
            box.appendChild(b);
        });
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
    function renderTabs() {
        var tabs = $('tabs');
        clear(tabs);
        var findCount = (an.cyclesTotal || 0) + (an.surprises || []).length + (an.layerBreaches || 0) + (model.hotspots ? model.hotspots.length : 0) + (an.deadFiles || 0);
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
    function renderFileTab() {
        if (state.file < 0) {
            var p = add(el('div', { class: 'pad' }), el('span', { class: 'soft' }, t('pickFile')));
            var ul = el('ul', { class: 'plist' });
            (an.hubs || []).forEach(function (h) { ul.appendChild(fileRow(h, 'in ' + files[h].inFiles)); });
            panel.appendChild(add(p, ul));
            return;
        }
        var i = state.file;
        var f = files[i];
        var head = add(el('div', { class: 'fhead' }), el('div', { class: 'fn' }, base(f.path)), el('div', { class: 'fp' }, f.path));
        var chips = el('div', { class: 'chips' });
        chips.appendChild(el('span', { class: SCOPE_CODE[f.role] ? 'c-cyan' : f.role === 'test' ? 'c-green' : '' }, t('roleNames')[f.role] || f.role));
        if (f.area >= 0) chips.appendChild(el('span', null, 'Area ' + areas[f.area].id + (areas[f.area].hub === i ? ' (' + t('hub') + ')' : '')));
        if (f.tests.length) chips.appendChild(el('span', { class: 'c-green' }, t('tests')(f.tests.length)));
        chips.appendChild(el('span', null, 'in ' + f.inFiles + ' · out ' + f.outFiles));
        if (f.guesses) chips.appendChild(el('span', { class: 'c-guess' }, t('guesses')(f.guesses)));
        if (f.loc !== undefined) chips.appendChild(el('span', null, num(f.loc) + ' LOC · ' + f.lang));
        else chips.appendChild(el('span', { class: 'c-miss' }, t('locMissing')));
        if (f.layer) chips.appendChild(el('span', null, 'Layer ' + f.layer));
        if (f.dead) chips.appendChild(el('span', { class: 'c-dead', title: an.deadBasis || '' }, t('dead')));
        panel.appendChild(add(head, chips));

        // Blast radius.
        var w = walk(i, state.scope);
        var bl = el('section', { class: 'blast' });
        var rec = f.blast;
        var level = rec ? rec.level : 'low';
        var head = add(el('div', { class: 'blast-h' }), el('b', null, t('blastRadius')));
        if (rec && state.scope === 'code') head.appendChild(el('span', { class: 'level ' + level }, t('levels')[level]));
        bl.appendChild(head);
        var scopes = el('div', { class: 'scopes', role: 'radiogroup', 'aria-label': 'Scope' });
        [['code', t('sCode')], ['tests', '+ ' + t('fTests')], ['all', '+ Doku']].forEach(function (o) {
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
        var depthCols = ['var(--amber)', 'var(--sand)', 'var(--d3)'];
        for (var dd = 1; dd <= BLAST_DEPTH; dd++) {
            var list = w.byDepth[dd];
            if (!list.length) continue;
            var dl = add(el('div', { class: 'dlist' }), el('span', { class: 'cap' }, t('depthList')(dd)));
            list.slice(0, 8).forEach(function (x) {
                var r = el('button', { type: 'button', class: 'drow', title: files[x].path });
                var dt = files[x].role === 'test' ? dotEl('ring', depthCols[dd - 1]) : dotEl(files[x].role === 'doc' ? 'small' : '', depthCols[dd - 1]);
                add(r, dt, el('span', { class: 'nm' }, base(files[x].path)), el('span', { class: 'mt' }, files[x].area >= 0 ? areas[files[x].area].id : files[x].role));
                r.addEventListener('click', function () { openFile(x); });
                dl.appendChild(r);
            });
            if (list.length > 8) dl.appendChild(el('span', { class: 'note-line' }, t('moreN')(num(list.length - 8))));
            bl.appendChild(dl);
        }
        bl.appendChild(el('div', { class: 'formula' }, t('blastFormula')));
        panel.appendChild(bl);

        // Uses / used by.
        var su = sec(t('uses') + ' (' + outOf[i].length + ')', t('relTrust'));
        var ul1 = el('ul', { class: 'plist' });
        outOf[i].slice(0, RAIL_CAP).forEach(function (x) { ul1.appendChild(fileRow(x[0], '× ' + x[1] + ' · ●')); });
        su.appendChild(ul1);
        if (outOf[i].length > RAIL_CAP) su.appendChild(el('span', { class: 'note-line' }, t('moreN')(outOf[i].length - RAIL_CAP)));
        panel.appendChild(su);
        var sy = sec(t('usedBy') + ' (' + inOf[i].length + ')', t('relTrust'));
        var ul2 = el('ul', { class: 'plist' });
        inOf[i].slice(0, RAIL_CAP).forEach(function (x) { ul2.appendChild(fileRow(x[0], '× ' + x[1] + ' · ●')); });
        sy.appendChild(ul2);
        if (inOf[i].length > RAIL_CAP) sy.appendChild(el('span', { class: 'note-line' }, t('moreN')(inOf[i].length - RAIL_CAP)));
        panel.appendChild(sy);

        // Symbols.
        var ss = sec(t('symbols') + ' (' + (f.symbols.length + f.symbolsOmitted) + ')', t('symCols'));
        var grid = el('div', { class: 'symgrid' });
        f.symbols.slice(0, SYMBOL_CAP).forEach(function (s) {
            var hasCalls = s.length > 3;
            var row = el('div');
            var calls = el('span', { class: 'mt' }, hasCalls ? (s[3] || '–') + ' / ' + (s[4] || '–') : '– / –');
            if (hasCalls && s[4] >= 20) calls.className = 'hot';
            add(row, el('span', { title: s[0] }, s[0]), el('span', { class: 'mt' }, 'L' + s[2]), el('span', { class: 'mt' }, s[1]), calls);
            grid.appendChild(row);
        });
        ss.appendChild(grid);
        var symMore = f.symbolsOmitted + Math.max(0, f.symbols.length - SYMBOL_CAP);
        if (symMore) ss.appendChild(el('span', { class: 'note-line' }, t('moreN')(symMore)));
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
            [t('kDraft'), g.drafts.length, 'hatch4'], ['Evidence', g.evidence.length, 'var(--violet)'], ['doc', g.docs.length, 'var(--line2)']], Math.max(1, total), false).lastChild);
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
            var so = sec(t('ownership'), t('commits')(num(f.churn)));
            (f.owners || []).forEach(function (o) {
                var row = add(el('div', { class: 'owner' }), el('span', null, o[0]), el('span', { class: 'mono muted' }, pct(o[1], 0)));
                var b = el('div', { class: 'bar' });
                var ii = el('i');
                ii.style.width = (o[1] * 100) + '%';
                b.appendChild(ii);
                row.appendChild(b);
                so.appendChild(row);
            });
            if (f.lastChange) so.appendChild(el('span', { class: 'note-line' }, t('lastChange') + ' ' + f.lastChange));
            if (f.soleOwner) so.appendChild(el('span', { class: 'note-line' }, t('busFactor')));
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
        if (an.cycles && an.cycles[0]) {
            cycLines.push(el('p', null, t('biggest')(an.cycles[0].length) + ' · ' + an.cycles[0].slice(0, 4).map(function (x) { return base(files[x].path); }).join(' ↔ ') + (an.cycles[0].length > 4 ? ' ↔ …' : '')));
            an.cycles.slice(1, 3).forEach(function (c) { cycLines.push(el('p', null, c.length + ' · ' + dir(files[c[0]].path))); });
        }
        p.appendChild(findCard(t('cycles'), num(an.cyclesTotal), 'var(--amberText)', cycLines));
        p.appendChild(findCard(t('surprises'), num((an.surprises || []).length), 'var(--amberText)',
            (an.surprises || []).slice(0, 4).map(function (s) { return fileLink(s[0], files[s[0]].path + ' → ' + base(files[s[1]].path)); })));
        if (model.drift) {
            var d = model.drift;
            var lines = [];
            d.changed.slice(0, 3).forEach(function (c) { lines.push(el('p', null, areas[c[0]].id + ' +' + c[1] + ' / −' + c[2])); });
            d.appeared.slice(0, 2).forEach(function (a) { lines.push(el('p', null, '+ ' + areas[a].id + ' ' + areaLabel(areas[a]))); });
            d.vanished.slice(0, 2).forEach(function (v) { lines.push(el('p', null, '− ' + v)); });
            p.appendChild(findCard(t('drift'), num(d.changed.length + d.appeared.length + d.vanished.length + d.split.length + d.merged.length), 'var(--cyanText)', lines));
        }
        if (an.layerBreaches !== undefined) {
            p.appendChild(findCard(t('layerBreaches'), num(an.layerBreaches), 'var(--alertText)',
                (model.violations || []).filter(function (v) { return v.kind === 'layer'; }).slice(0, 4).map(function (v) {
                    return fileLink(v.files[0], base(files[v.files[0]].path) + ' → ' + base(files[v.files[1]].path) + ' (' + v.layers[0] + ' → ' + v.layers[1] + ')');
                })));
        } else p.appendChild(findCard(t('layerBreaches'), null, null, [el('p', null, t('needLayers'))], true));
        if (model.hotspots) {
            p.appendChild(findCard(t('hotspots'), num(model.hotspots.length), 'var(--brandText)', model.hotspots.slice(0, 5).map(function (h) {
                return fileLink(h[0], base(files[h[0]].path) + ' · ' + h[1] + ' × ' + num(h[2]));
            })));
        } else p.appendChild(findCard(t('hotspots'), null, null, [el('p', null, t('needChurn'))], true));
        if (an.deadFiles !== undefined) {
            var deadList = [];
            files.forEach(function (f, i) { if (f.dead && deadList.length < 5) deadList.push(fileLink(i)); });
            p.appendChild(findCard(t('deadFiles'), num(an.deadFiles), 'var(--alertText)', [el('p', null, an.deadBasis || '')].concat(deadList)));
        } else p.appendChild(findCard(t('deadFiles'), null, null, [el('p', null, an.deadBasis || t('missDead'))], true));
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
            p.appendChild(el('div', { class: 'mono' }, a.id + ' · ' + a.name)).style.fontWeight = '600';
            var tiles = el('div', { class: 'atiles' });
            [[num(a.files.length), t('files')('').trim()], [pct(a.cohesion), t('cohesion')], [pct(a.testShare), t('testShare')]].forEach(function (x) {
                tiles.appendChild(add(el('div', { class: 'tile' }), el('div', { class: 'v' }, x[0]), el('div', { class: 'l' }, x[1])));
            });
            p.appendChild(tiles);
            p.appendChild(el('span', { class: 'soft' }, t('mismatch')(pct(a.folderMismatch))));
            var top = a.files.slice().sort(function (x, y) { return files[y].inFiles - files[x].inFiles || x - y; });
            p.appendChild(el('span', { class: 'muted' }, t('mostUsed') + ': ' + top.slice(0, 3).map(function (x) { return base(files[x].path); }).join(', ')));
            var ul = el('ul', { class: 'plist' });
            top.slice(0, 60).forEach(function (x) { ul.appendChild(fileRow(x, 'in ' + files[x].inFiles)); });
            p.appendChild(ul);
        }
        p.appendChild(el('span', { class: 'cap' }, t('allAreasList') + ' (' + areas.length + ')'));
        var list = el('ul', { class: 'plist' });
        areas.forEach(function (a, i) {
            var b = el('button', { type: 'button', class: 'aentry', title: a.name + ' · ' + a.files.length });
            var label = add(el('span', { class: 'alabel' }), el('span', { class: 'fname' }, a.id + ' · ' + areaLabel(a) + ' · ' + a.files.length));
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
        $('wb').className = 'wb' + (state.full ? ' full' : '');
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
    function resetView() { state.view = { scale: 1, x: 0, y: 0 }; state.rot = { yaw: ORB_YAW, pitch: ORB_PITCH }; }
    function goHome() { step(); state.level = 'overview'; state.lens = 'graph'; resetView(); refresh(); }
    function openArea(i) { step(); state.level = 'area'; state.area = i; state.lens = state.lens === 'graph' ? 'graph' : state.lens; resetView(); refresh(); }
    function openFile(i) {
        step();
        var f = files[i];
        if (state.lens === 'graph' && f.area >= 0 && (state.level !== 'area' || state.area !== f.area)) {
            state.level = 'area';
            state.area = f.area;
            resetView();
        }
        state.file = i;
        state.tab = 'file';
        refresh();
    }

    // Input.
    var drag = null;
    var frame = 0;
    canvas.addEventListener('pointerdown', function (e) {
        drag = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y, yaw: state.rot.yaw, pitch: state.rot.pitch, turn: state.orb && !e.shiftKey, moved: false };
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x;
        var dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        if (drag.turn) { state.rot.yaw = drag.yaw + dx * 0.008; state.rot.pitch = Math.max(-1.4, Math.min(1.4, drag.pitch - dy * 0.008)); }
        else { state.view.x = drag.vx + dx; state.view.y = drag.vy + dy; }
        if (!frame) frame = requestAnimationFrame(function () { frame = 0; draw(); });
    });
    function turnTo(yaw, pitch) { state.rot.yaw = yaw; state.rot.pitch = Math.max(-1.4, Math.min(1.4, pitch)); draw(); }
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
        if (hit.kind === 'area') openArea(hit.idx);
        else openFile(hit.idx);
    });
    function select(hit) {
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
        }
        refresh();
    }
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    function zoom(f) { state.view.scale = Math.min(8, Math.max(0.4, state.view.scale * f)); $('zoomtxt').textContent = 'Zoom ' + state.view.scale.toFixed(1) + '×'; draw(); }
    var TURN_KEYS = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15] };
    document.addEventListener('keydown', function (e) {
        var step = TURN_KEYS[e.key];
        if (step && state.orb && document.activeElement !== searchInput) { e.preventDefault(); turnTo(state.rot.yaw + step[0], state.rot.pitch + step[1]); return; }
        if (e.key === '/' && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); return; }
        if (e.key === 'Escape') {
            if (document.activeElement === searchInput && searchInput.value) { searchInput.value = ''; clear(results); return; }
            if (state.level === 'area') goHome(); else if (state.file >= 0 || state.area >= 0) { state.file = -1; state.area = -1; refresh(); }
        }
    });
    searchInput.addEventListener('input', function () {
        clear(results);
        var q = searchInput.value.trim().toLowerCase();
        if (q.length < 2) return;
        var hits = 0;
        function hit(text, fn) {
            var b = el('button', { type: 'button' }, text);
            b.addEventListener('click', function () { clear(results); searchInput.value = ''; fn(); });
            results.appendChild(add(el('li'), b));
            hits += 1;
        }
        areas.forEach(function (a, i) { if (hits < 30 && (a.name.toLowerCase().indexOf(q) >= 0 || a.id === q)) hit('◎ ' + a.id + ' · ' + a.name, function () { openArea(i); }); });
        (an.requestPaths || []).forEach(function (r) { if (hits < 30 && r.route.toLowerCase().indexOf(q) >= 0) hit('↳ ' + r.route, function () { openFile(r.handler >= 0 ? r.handler : r.file); }); });
        files.forEach(function (f, i) {
            if (hits >= 30) return;
            if (f.path.toLowerCase().indexOf(q) >= 0) { hit(f.path, function () { openFile(i); }); return; }
            var sym = f.symbols.filter(function (s) { return s[0].toLowerCase().indexOf(q) >= 0; })[0];
            if (sym) hit(sym[0] + ' — ' + f.path, function () { openFile(i); });
        });
    });

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
    $('z-in').addEventListener('click', function () { zoom(1.4); });
    $('z-out').addEventListener('click', function () { zoom(1 / 1.4); });
    $('z-fit').addEventListener('click', function () { resetView(); zoom(1); });
    $('back').addEventListener('click', goHome);
    var dim2d = $('dim2d');
    var dimButton = $('dim');
    function setOrb(on) {
        state.orb = on;
        dimButton.setAttribute('aria-pressed', String(on));
        dim2d.setAttribute('aria-pressed', String(!on));
        resetView();
        refresh();
    }
    dimButton.addEventListener('click', function () { setOrb(!state.orb); });
    var limTop = $('lim-top');
    var limAll = $('lim-all');
    function setLimit(v) {
        state.areaLimit = v;
        limTop.setAttribute('aria-pressed', String(v === 'top'));
        limAll.setAttribute('aria-pressed', String(v === 'all'));
        resetView();
        refresh();
    }
    limTop.addEventListener('click', function () { setLimit('top'); });
    limAll.addEventListener('click', function () { setLimit('all'); });
    dim2d.addEventListener('click', function () { setOrb(false); });
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
    $('theme').addEventListener('click', function () { theme = theme === 'light' ? 'dark' : 'light'; applyTheme(); refresh(); });
    $('lang').addEventListener('click', function () { lang = lang === 'de' ? 'en' : 'de'; applyStrings(); refresh(); });
    function applyStrings() {
        document.documentElement.lang = lang;
        searchInput.setAttribute('placeholder', t('search'));
        searchInput.setAttribute('aria-label', t('search'));
        $('export').textContent = t('exportBtn');
        $('lang').textContent = t('langBtn');
        $('edges-label').textContent = t('edges');
        $('t-sure').textContent = t('sure');
        $('t-guess').textContent = t('guessed');
        $('t-tests').textContent = t('fTests');
        $('t-infra').textContent = t('fInfra');
        $('z-in').setAttribute('aria-label', t('zoomIn'));
        $('z-out').setAttribute('aria-label', t('zoomOut'));
        $('z-fit').textContent = t('fit');
        dim2d.textContent = t('d2');
        limTop.textContent = t('limTop');
        limAll.textContent = t('limAll');
        dimButton.textContent = t('d3');
        dimButton.setAttribute('title', t('dimHint'));
        $('back').textContent = t('allAreas');
        applyTheme();
    }

    applyStrings();
    renderHeader();
    window.addEventListener('resize', resize);
    refresh();
    resize();
})();
