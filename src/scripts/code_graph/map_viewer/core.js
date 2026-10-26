/*
 * Offline viewer for agents/map/index.html — shared core.
 *
 * The viewer is several files that `renderHtml` joins, in a fixed order, into
 * ONE inline script inside one function scope: core, the area modules, then
 * the shell that routes between them. Each file is a list of statements that
 * reads the names the files before it declared.
 *
 * Every number on the page is a field of the inline `#map-data` JSON block:
 * `model` is the Code area, `areas` the payloads of the other knowledge areas.
 * Every string from the data reaches the page through textContent, never
 * innerHTML: file paths and symbol names come from the scanned repository.
 */
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

    // Payloads of the knowledge areas beside Code; a missing key means its reader did not run.
    var KA = data.areas || {};

    var STR = {
        en: {
            search: 'File, symbol, table, service …', exportBtn: 'Export', light: 'Light theme', dark: 'Dark theme', langBtn: 'DE',
            health: 'Health', noGrade: function (n) { return 'No grade while ' + n + ' of 4 parts are missing'; }, gradeOf: 'Score {s} of 100',
            formula: 'Show formula', hideFormula: 'Hide formula',
            pCycles: 'Cycles (SCC)', pGuesses: 'Guessed edges', pDead: 'Dead code', pHotspots: 'Hotspots',
            missDead: 'dead → not in map.json', missHot: 'churn missing',
            tFiles: 'Files', tTrusted: 'Trusted links (incl. doc links)', tAreas: 'Areas', tRoutes: 'Routes resolved',
            roles: 'Roles', trust: 'Edges by trust', sure: 'trusted', guessed: 'guessed', other: 'infra/config/…',
            colorBy: 'Colour by', explorer: 'Explorer', scope: 'Scope', all: 'all',
            cBlast: 'Blast', cArea: 'Area', cTests: 'Test share', cRole: 'Role', cFolder: 'Folder', cLayer: 'Layer', cChurn: 'Churn', cComplexity: 'Complexity',
            hBlast: 'How far the selection reaches', hArea: 'Louvain community', hTests: 'testShare per area', hRole: 'code / test / doc …', hFolder: 'folder of each file',
            lGraph: 'Graph', lLayers: 'Layers', lMatrix: 'Matrix', lKnowledge: 'Knowledge', lTreemap: 'Treemap', lFlow: 'Flow',
            hLayers: 'Depth rings from the selection', hMatrix: 'DSM', hKnowledge: 'Knowledge sources of the selection', hTreemap: 'Area = lines per folder', hTreemapMissing: 'needs line counts per file', hFlow: 'the request-path view is not built yet; the paths themselves are listed per file in the detail panel',
            edges: 'Edges:', fTests: 'Tests', fInfra: 'Infra hubs', full: 'Full screen', fullOff: 'Exit full screen',
            lgPick: 'Mark a file to see what a change to it reaches', moreFiles: function (n) { return '+ ' + n + ' more'; }, offGraph: function (f, r) { return f + ' is not on the graph (' + r + '): areas hold code, tests and views'; }, noEffectOverview: 'Acts on file edges: open an area to use it', sAllShort: '+ Docs', noDataShort: 'no data', noViewShort: 'no view yet', noDataUnknown: 'the source is unknown', noDataTitle: function (r) { return 'No data yet: ' + r + '. It switches on by itself once the data exists.'; }, navBack: '← Back', openLeft: '☰ Repository', openRight: 'Details ☰', repository: 'Repository', pin: 'Pin', unpin: 'Unpin', closePane: 'Close', repo: 'Repo', overview: 'Overview', areasOf: function (a, b) { return 'Areas (' + a + ' of ' + b + ')'; }, allAreas: '← All areas',
            hint2d: 'Drag: move · Wheel: zoom · Click: mark · Double-click: open', hint3d: 'Drag: turn · Shift+drag: move · Wheel: zoom · Click: mark · Double-click: open',
            zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit', limTop: function (n) { return 'Top ' + n; }, limAll: 'All areas', limLabel: 'Areas shown', d2: '2D', d3: '3D Orb', dimHint: 'Show the map as an orb. Drag to turn it, Shift+drag to move it, arrow keys turn it too. The position on the sphere carries no data: it wraps the 2D layout.',
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
            matrixHead: 'Dependency structure matrix at area level · cell = links (symbol references) between two areas · highlighted row/column = selection · red frame = both areas hold files of one cycle',
            matrixNote: function (a, b, n) { return 'Pick a cell to list the edges between two areas. Strongest coupling: ' + a + ' ↔ ' + b + ' with ' + n + ' edges.'; },
            diag: 'diagonal (inside the area)', edgesN: function (n, p) { return n + ' links across ' + p + ' file pairs'; },
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
            search: 'Datei, Symbol, Tabelle, Dienst …', exportBtn: 'Export', light: 'Helles Design', dark: 'Dunkles Design', langBtn: 'EN',
            health: 'Health', noGrade: function (n) { return 'Kein Grade, solange ' + n + ' von 4 Teilwerten fehlen'; }, gradeOf: 'Score {s} von 100',
            formula: 'Formel ansehen', hideFormula: 'Formel ausblenden',
            pCycles: 'Zyklen (SCC)', pGuesses: 'Geratene Kanten', pDead: 'Toter Code', pHotspots: 'Hotspots',
            missDead: 'dead → map.json fehlt', missHot: 'churn fehlt',
            tFiles: 'Dateien', tTrusted: 'Sichere Verweise (inkl. Doku-Links)', tAreas: 'Areas', tRoutes: 'Routen gelöst',
            roles: 'Rollen', trust: 'Kanten nach Vertrauen', sure: 'sicher', guessed: 'geraten', other: 'infra/config/…',
            colorBy: 'Färben nach', explorer: 'Explorer', scope: 'Scope', all: 'alles',
            cBlast: 'Blast', cArea: 'Area', cTests: 'Test-Anteil', cRole: 'Rolle', cFolder: 'Ordner', cLayer: 'Layer', cChurn: 'Churn', cComplexity: 'Komplexität',
            hBlast: 'Betroffenheit der Auswahl', hArea: 'Louvain-Community', hTests: 'testShare je Area', hRole: 'code / test / doc …', hFolder: 'Ordner jeder Datei',
            lGraph: 'Graph', lLayers: 'Layers', lMatrix: 'Matrix', lKnowledge: 'Knowledge', lTreemap: 'Treemap', lFlow: 'Flow',
            hLayers: 'Tiefenringe ab Auswahl', hMatrix: 'DSM', hKnowledge: 'Wissensquellen zur Auswahl', hTreemap: 'Fläche = Zeilen je Ordner', hTreemapMissing: 'braucht Zeilenzahlen je Datei', hFlow: 'die Ansicht für Request-Pfade ist noch nicht gebaut; die Pfade selbst stehen je Datei im Detail-Panel',
            edges: 'Kanten:', fTests: 'Tests', fInfra: 'Infra-Hubs', full: 'Vollbild', fullOff: 'Vollbild beenden',
            lgPick: 'Datei markieren, um zu sehen, was eine Änderung erreicht', moreFiles: function (n) { return '+ ' + n + ' weitere'; }, offGraph: function (f, r) { return f + ' ist nicht im Graph (' + r + '): Areas enthalten Code, Tests und Views'; }, noEffectOverview: 'Wirkt auf Datei-Kanten: Area öffnen, um es zu nutzen', sAllShort: '+ Doku', noDataShort: 'keine Daten', noViewShort: 'noch keine Ansicht', noDataUnknown: 'die Quelle ist unbekannt', noDataTitle: function (r) { return 'Noch keine Daten: ' + r + '. Schaltet sich von selbst frei, sobald die Daten da sind.'; }, navBack: '← Zurück', openLeft: '☰ Repository', openRight: 'Details ☰', repository: 'Repository', pin: 'Anheften', unpin: 'Lösen', closePane: 'Schließen', repo: 'Repo', overview: 'Übersicht', areasOf: function (a, b) { return 'Areas (' + a + ' von ' + b + ')'; }, allAreas: '← Alle Areas',
            hint2d: 'Ziehen: verschieben · Rad: zoomen · Klick: markieren · Doppelklick: öffnen', hint3d: 'Ziehen: drehen · Shift+Ziehen: verschieben · Rad: zoomen · Klick: markieren · Doppelklick: öffnen',
            zoomIn: 'Hineinzoomen', zoomOut: 'Herauszoomen', fit: 'Einpassen', limTop: function (n) { return 'Top ' + n; }, limAll: 'Alle Areas', limLabel: 'Angezeigte Areas', d2: '2D', d3: '3D Orb', dimHint: 'Karte als Kugel zeigen. Ziehen dreht sie, Shift+Ziehen verschiebt sie, die Pfeiltasten drehen ebenfalls. Die Lage auf der Kugel trägt keine Daten: Sie wickelt das 2D-Layout auf.',
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
            matrixHead: 'Dependency-Structure-Matrix auf Area-Ebene · Zelle = Verweise (Symbol-Referenzen) zwischen zwei Areas · hervorgehobene Zeile/Spalte = Auswahl · roter Rahmen = beide Areas enthalten Dateien eines Zyklus',
            matrixNote: function (a, b, n) { return 'Zelle wählen, um die Kanten zwischen zwei Areas zu listen. Stärkste Kopplung: ' + a + ' ↔ ' + b + ' mit ' + n + ' Kanten.'; },
            diag: 'Diagonale (innerhalb der Area)', edgesN: function (n, p) { return n + ' Verweise in ' + p + ' Dateipaaren'; },
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
    // Each part adds the strings it uses, in both languages, before anything renders.
    function extendStrings(more) {
        Object.keys(more).forEach(function (l) { Object.keys(more[l]).forEach(function (k) { STR[l][k] = more[l][k]; }); });
    }

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
    // A control whose data is missing stays visible: it says so and names what is missing.
    function markNoData(b, tag, reason) {
        b.classList.add('nodata');
        b.appendChild(el('span', { class: 'nodata-tag' }, tag));
        b.setAttribute('title', t('noDataTitle')(reason));
    }
    function swatch(colour) { var s = el('span', { class: 'swatch' }); s.style.background = colour; return s; }
    function dotEl(cls, colour) { var d = el('span', { class: 'dot' + (cls ? ' ' + cls : '') }); if (colour) { if (cls === 'ring') d.style.borderColor = colour; else d.style.background = colour; } return d; }

    var $ = function (id) { return document.getElementById(id); };
    var searchInput = $('search');
    var results = $('results');
