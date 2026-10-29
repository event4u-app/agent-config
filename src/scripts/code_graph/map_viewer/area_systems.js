/*
 * Systeme — the 2026-10-bf handover's page, built from the systems payload:
 * a Filter aside (search, package managers, workspaces, status, five segmented
 * choices, three switches), six lenses (Übersicht · Pakete · Abhängigkeiten ·
 * Runtimes · Befunde · Branches), a Detail aside for the picked package, and
 * the shared Verlauf trail: every filter, sort and pick is a history step.
 * Every count is counted from the payload on this page. A share of a package's
 * surface is never shown: it needs the installed files (`code-graph usage`).
 */
extendStrings({
    en: {
        sPackages: 'Packages', sRuntimes: 'Runtimes', sFindings: 'Findings', sBranches: 'Branches', sOverview: 'Overview', sDeps: 'Dependencies',
        sFilter: 'Filter', sDetail: 'Detail', sSearch: 'Search a package …', sSearchL: 'Search a package', sPm: 'Package manager', sNoLock: 'No lockfile or manifest found', sNotRead: 'Found, not read',
        sLooked: function (f) { return 'looked for: ' + f + ' – nothing found'; }, sUnread: function (f) { return 'present, not read by the systems lane: ' + f; },
        sWs: 'Workspace', sRoot: '. (Root)', sFxWs: 'tests/fixtures/* · test fixtures', sStatus: 'Status', sStatusNote: 'An index verdict, not proof. “Candidate” means: nothing found, not “unused”.',
        sAll: 'All', sScope: 'Scope', sOrigin: 'Origin', sDirectS: 'direct', sTransS: 'transitive', sLock: 'Lock', sLocked: 'locked', sUnlockedS: 'not locked', sDepth: 'Depth (1 = direct)', sBy: 'Required by … packages',
        sOnly: 'Only show', sFw: 'Frameworks', sWithFinding: 'With finding', sMulti: 'Several versions', sReset: 'Reset filters',
        sCount: function (a, b, g) { return a + ' of ' + b + ' packages' + (g ? ' · ' + g + ' names' : ''); }, sFxOn: function (n) { return 'Fixtures shown · ' + n + ' ✕'; }, sFxOff: function (n) { return '+ ' + n + ' in fixtures'; },
        sFxT: 'Test fixtures are sample repositories under tests/fixtures – no product code', sWithout: function (x) { return 'without ' + x; },
        sKpi: ['Packages', 'declared directly', 'Frameworks', 'not locked', 'packages with a finding', 'names in several versions', 'Runtimes'],
        sPmCount: function (n) { return n + ' packages'; }, sProdDev: ['prod', 'dev'], sDirTrans: ['direct', 'transitive'], sLockLine: function (a, b) { return a + ' locked · ' + b + ' declared only (no lockfile in the workspace)'; },
        sWsPm: 'Workspaces × package manager', sWsPmT: 'A click filters the package list', sWsH: ['Workspace', 'npm', 'Composer', 'direct', 'Findings'],
        sFwH: function (n) { return 'Frameworks · ' + n; }, sFwT: 'Area by use in files', sFwMeta: function (v, f) { return v + (v === 1 ? ' version' : ' versions') + ' · ' + f + ' files'; },
        sFkH: 'Findings by kind', sFkT: 'Advice, not a verdict · a click opens the group',
        sSort: 'Sort', sSorts: { find: 'Finding first', by: 'required', used: 'Use', depth: 'Depth', name: 'Name' }, sGroup: 'Group by name',
        sCols: ['', 'Package', 'Version', 'Scope', 'Depth', 'Workspace', 'required', 'used', 'Finding'], sDepthT: 'Depth: 1 = declared directly', sByT: 'Packages that require it', sUsedT: 'Files with an import',
        sShown: function (a, b) { return a + ' of ' + b + ' shown'; }, sMore60: 'Show 60 more', sVersions: function (n) { return n + ' versions'; }, sFixture: 'Fixture', sFixtureNp: 'Fixture · no product code',
        STV: { used: ['used', 'at least one import in the code'], thru: ['via config / script', 'no import, but a script, config, CI or framework discovery'], chain: ['only via a chain', 'transitive – another package needs it, no import of its own needed'],
            cand: ['candidate · nothing found', 'declared directly, no use found – dynamic loading is invisible'], unk: ['unknown · autoload', 'Composer: autoload/discovery not read offline – no verdict possible'], noinst: ['not installed', 'manifest only – no lockfile in the workspace'] },
        sAllStatus: 'every status',
        sDirectly: 'direct', sTransitively: 'transitive', sDevTag: 'dev', sProdTag: 'prod', sLockedTag: 'locked', sNotInLock: 'not in the lockfile',
        sVerdict: function (st, why) { return 'Status: ' + st + ' – ' + why + '. '; }, sIncluded: function (d) { return 'Included directly: ' + d + '.'; }, sNotDirect: function (r, n) { return 'Not included directly. It comes into the project via ' + r + (n > 1 ? ' – and ' + n + ' packages require it.' : '.'); },
        sDk: ['included directly', 'required by (direct)', 'depend on it in total', 'own dependencies', 'pulls in in total', 'files import it', 'versions of this name'], sYes: 'yes', sNo: 'no',
        sNb: 'Neighbourhood', sNbT: 'left: what requires it · right: what it requires · a click jumps to the package', sMoreN: function (n) { return '+' + n + ' more'; },
        sNbNone: 'nothing – declared directly', sNbUnknown: 'not given', sNbNoReq: 'no own dependencies', sFiltered: function (n) { return n + ' filtered'; },
        sWhy: function (n) { return 'Why installed? · ' + n; }, sWhyT: 'shortest paths first · from requiredBy in the lockfile', sWays: function (n) { return n + (n === 1 ? ' path' : ' paths'); }, sWay: function (i) { return 'Path ' + i; },
        sManifest: 'Manifest', sDeclDirect: 'declared directly', sRequired: 'required', sThis: 'this package', sOnlyOne: 'Only this one path.', sDeclaredHere: 'Declared directly in the manifest.',
        sAllPathsMissing: 'The map stores the shortest path only; every path (up to 20): code-graph why ',
        sReqBy: function (n) { return 'Required by · ' + n; }, sReqs: function (n) { return 'Requires itself · ' + n; }, sAllHidden: function (n) { return 'All ' + n + ' hidden by the filters on the left.'; }, sNoOther: 'No other package – the project itself declares it.', sNoInfo: 'Not given in the lockfile.', sNoDeps: 'no own dependencies',
        sUse: function (n) { return 'Use in the code · ' + n + ' files'; }, sUseT: 'which functions and types are imported in which file', sWhole: 'whole module / side effect',
        sUseMore: function (n, k) { return '+ ' + n + ' more files – the map stores at most 20, all via code-graph usage ' + k; }, sByArea: 'By folder', sTop: 'Most used', sNi: 'Use without import',
        sNoImport: 'No import found. Dynamic loading is invisible here – so it says “no use found”, not “unused”.',
        sUnknownH: 'What the map does not know here', sUnknown: [['Version spec per step of the chain:', ' not stored in the map – ', 'code-graph why {k}', ' shows it per hop.'], ['Calls per function:', ' not indexed – only the names imported per file.', '', ''],
            ['Share of use:', ' surface unknown – ', 'code-graph usage {k}', ' (needs installed packages). Never an estimated percentage.'], ['Can it go?', ' ', 'code-graph remove-plan {k}', ' – lists what would have to change.'],
            ['Vulnerabilities:', ' not in the map – ', 'agent-config audit:deps', ' (OSV, own cache). Licences, outdated, size: not recorded (offline).']],
        sRtWit: function (n) { return n + ' witnesses'; }, sRtOk: 'consistent', sRtBad: 'witnesses disagree · SY-4', sRtEx: function (w) { return 'e.g. ' + w; },
        sRtNote: 'The package filters on the left do not apply here – runtimes are not packages. Sources: declared = engines/require in the manifest · ci = setup step in the workflow · image = base image in the Dockerfile. If they differ, AC reports SY-4. Which value holds is your call – AC does not guess.',
        sFindIntro: 'Hygiene advice, not vulnerabilities. Every finding carries a proposal – never applied automatically. “No use found” is a candidate for removal, not a verdict: the map does not see dynamic loading.',
        sFxNoteOn: function (a, b) { return 'All ' + a + ' findings including ' + b + ' from test fixtures (sample repositories, no product code).'; }, sFxNoteOff: function (b, a, c) { return b + ' of ' + a + ' findings come from test fixtures and are hidden. Shown: ' + c + ' from the product.'; },
        sFxShow: 'Show fixtures', sFxHide: 'Hide fixtures', sAdvice: 'advice', sCandAdvice: 'candidate · advice', sProduct: 'Product', sProposal: function (f) { return 'Proposal: ' + f; },
        sMapKind: 'Map kind', sCommitted: 'Committed map', sLocal: 'Local with --branches', sBrNote: 'Branch is a global context – shown here because only Systems, Code and Data have branch facts.',
        sSnapH: function (c) { return 'Snapshot of commit ' + c + ' · branch state not included'; }, sSnapB: 'Branch names and dates are state of this machine. So they stay out of a map that is committed (D17). Locally: ', sSnapB2: ' adds them. The commands ', sSnapB3: ' always answer.', sAnd: ' and ',
        sCan: 'Can show branch differences', sCanT: 'Code: files, symbols · Systems: direct packages ± and versions · Data: tables, columns', sCannot: 'No branch facts', sCannotT: 'Edges, areas, use in code, findings, runtimes, interfaces, runtime, delivery',
        sDetailOpen: 'Open dependencies & use →', sFixNever: function (f) { return 'Proposal, never applied: ' + f; }, sWitnessCap: 'Witness', sIndexOnly: 'index only', sWitnessNote: 'Not yet confirmed against the file. Rung T1 = read from the lockfile or manifest.',
        sOnBranches: 'On branches', sOnBranchesNone: 'needs a local map with --branches (the branch list is not in this map)',
        sRows: ['Version', 'declared', 'installed because', 'used by', 'without import', 'required by', 'requires itself'], sFilesImport: function (n) { return n + ' files (import)'; }, sNoImportShort: 'no import found', sTimesPk: function (n) { return '×' + n + ' packages'; }, sPk: function (n) { return n + ' packages'; },
        sMeta: function (r, f, p) { return r + ' runtimes · ' + f + ' frameworks · ' + p + ' packages'; }, sUsageHint: 'share of its surface: `code-graph usage <package>` with the package installed', sRemoveHint: 'what removing it touches: `code-graph remove-plan <package>`',
        sNoBranches: 'Drawn without --branches: branch names and dates are this machine\'s state, so they stay out of a map that may be committed. `code-graph map --branches` adds them; `code-graph branches` lists them.',
        sAgainst: function (b) { return 'Each indexed branch against ' + b + ', read from git objects without a checkout.'; }, sBrCols: ['Branch', 'Commit', 'seen', 'Parent', 'Stand', 'direct packages vs. current', ''], sChainMissing: 'The chain card needs .build/branch-chain.json in the map (not yet written into it).'
    },
    de: {
        sPackages: 'Pakete', sRuntimes: 'Runtimes', sFindings: 'Befunde', sBranches: 'Branches', sOverview: 'Übersicht', sDeps: 'Abhängigkeiten',
        sFilter: 'Filter', sDetail: 'Detail', sSearch: 'Paket suchen …', sSearchL: 'Paket suchen', sPm: 'Paketmanager', sNoLock: 'Kein Lockfile oder Manifest gefunden', sNotRead: 'Gefunden, nicht gelesen',
        sLooked: function (f) { return 'gesucht: ' + f + ' – nichts gefunden'; }, sUnread: function (f) { return 'vorhanden, von der systems lane nicht gelesen: ' + f; },
        sWs: 'Workspace', sRoot: '. (Root)', sFxWs: 'tests/fixtures/* · Test-Fixtures', sStatus: 'Status', sStatusNote: 'Index-Urteil, kein Beweis. „Kandidat“ heißt: nichts gefunden, nicht „ungenutzt“.',
        sAll: 'Alle', sScope: 'Scope', sOrigin: 'Herkunft', sDirectS: 'direkt', sTransS: 'transitiv', sLock: 'Lock', sLocked: 'gelockt', sUnlockedS: 'nicht gelockt', sDepth: 'Tiefe (1 = direkt)', sBy: 'Benötigt von … Paketen',
        sOnly: 'Nur zeigen', sFw: 'Frameworks', sWithFinding: 'Mit Befund', sMulti: 'Mehrere Versionen', sReset: 'Filter zurücksetzen',
        sCount: function (a, b, g) { return a + ' von ' + b + ' Paketen' + (g ? ' · ' + g + ' Namen' : ''); }, sFxOn: function (n) { return 'Fixtures sichtbar · ' + n + ' ✕'; }, sFxOff: function (n) { return '+ ' + n + ' in Fixtures'; },
        sFxT: 'Test-Fixtures sind Beispiel-Repos unter tests/fixtures – kein Produktcode', sWithout: function (x) { return 'ohne ' + x; },
        sKpi: ['Pakete', 'direkt deklariert', 'Frameworks', 'nicht gelockt', 'Pakete mit Befund', 'Namen in mehreren Versionen', 'Runtimes'],
        sPmCount: function (n) { return n + ' Pakete'; }, sProdDev: ['prod', 'dev'], sDirTrans: ['direkt', 'transitiv'], sLockLine: function (a, b) { return a + ' gelockt · ' + b + ' nur deklariert (kein Lockfile im Workspace)'; },
        sWsPm: 'Workspaces × Paketmanager', sWsPmT: 'Klick filtert die Paketliste', sWsH: ['Workspace', 'npm', 'Composer', 'direkt', 'Befunde'],
        sFwH: function (n) { return 'Frameworks · ' + n; }, sFwT: 'Fläche nach Nutzung in Dateien', sFwMeta: function (v, f) { return v + (v === 1 ? ' Version' : ' Versionen') + ' · ' + f + ' Dateien'; },
        sFkH: 'Befunde nach Art', sFkT: 'Rat, kein Urteil · Klick öffnet die Gruppe',
        sSort: 'Sortieren', sSorts: { find: 'Befund zuerst', by: 'benötigt', used: 'Nutzung', depth: 'Tiefe', name: 'Name' }, sGroup: 'Nach Name gruppieren',
        sCols: ['', 'Paket', 'Version', 'Scope', 'Tiefe', 'Workspace', 'benötigt', 'genutzt', 'Befund'], sDepthT: 'Tiefe: 1 = direkt deklariert', sByT: 'Anzahl Pakete, die es benötigen', sUsedT: 'Dateien mit Import',
        sShown: function (a, b) { return a + ' von ' + b + ' angezeigt'; }, sMore60: 'Weitere 60 zeigen', sVersions: function (n) { return n + ' Versionen'; }, sFixture: 'Fixture', sFixtureNp: 'Fixture · kein Produktcode',
        STV: { used: ['genutzt', 'mindestens ein Import im Code'], thru: ['über Config / Script', 'kein Import, aber Script, Config, CI oder Framework-Discovery'], chain: ['nur über Kette', 'transitiv – ein anderes Paket braucht es, eigener Import nicht nötig'],
            cand: ['Kandidat · nichts gefunden', 'direkt deklariert, keine Nutzung gefunden – dynamisches Laden ist unsichtbar'], unk: ['unbekannt · Autoload', 'Composer: Autoload/Discovery noch nicht offline gelesen – kein Urteil möglich'], noinst: ['nicht installiert', 'nur im Manifest – kein Lockfile im Workspace'] },
        sAllStatus: 'alle Status',
        sDirectly: 'direkt', sTransitively: 'transitiv', sDevTag: 'dev', sProdTag: 'prod', sLockedTag: 'gelockt', sNotInLock: 'nicht im Lockfile',
        sVerdict: function (st, why) { return 'Status: ' + st + ' – ' + why + '. '; }, sIncluded: function (d) { return 'Direkt eingebunden: ' + d + '.'; }, sNotDirect: function (r, n) { return 'Nicht direkt eingebunden. Es kommt über ' + r + ' ins Projekt' + (n > 1 ? ' – und wird von ' + n + ' Paketen benötigt.' : '.'); },
        sDk: ['direkt eingebunden', 'benötigt von (direkt)', 'hängen insgesamt davon ab', 'eigene Abhängigkeiten', 'zieht insgesamt nach', 'Dateien importieren es', 'Versionen dieses Namens'], sYes: 'ja', sNo: 'nein',
        sNb: 'Nachbarschaft', sNbT: 'links: wer es benötigt · rechts: was es benötigt · Klick springt zum Paket', sMoreN: function (n) { return '+' + n + ' weitere'; },
        sNbNone: 'nichts – direkt deklariert', sNbUnknown: 'keine Angabe', sNbNoReq: 'keine eigenen Abhängigkeiten', sFiltered: function (n) { return n + ' gefiltert'; },
        sWhy: function (n) { return 'Warum installiert? · ' + n; }, sWhyT: 'kürzeste Wege zuerst · aus requiredBy im Lockfile', sWays: function (n) { return n + (n === 1 ? ' Weg' : ' Wege'); }, sWay: function (i) { return 'Weg ' + i; },
        sManifest: 'Manifest', sDeclDirect: 'direkt deklariert', sRequired: 'benötigt', sThis: 'dieses Paket', sOnlyOne: 'Nur dieser eine Weg.', sDeclaredHere: 'Direkt im Manifest deklariert.',
        sAllPathsMissing: 'Die Map speichert nur den kürzesten Weg; alle Wege (bis 20): code-graph why ',
        sReqBy: function (n) { return 'Benötigt von · ' + n; }, sReqs: function (n) { return 'Benötigt selbst · ' + n; }, sAllHidden: function (n) { return 'Alle ' + n + ' durch die Filter links ausgeblendet.'; }, sNoOther: 'Kein anderes Paket – das Projekt selbst deklariert es.', sNoInfo: 'Keine Angabe im Lockfile.', sNoDeps: 'keine eigenen Abhängigkeiten',
        sUse: function (n) { return 'Nutzung im Code · ' + n + ' Dateien'; }, sUseT: 'welche Funktionen und Typen in welcher Datei importiert werden', sWhole: 'ganzes Modul / Seiteneffekt',
        sUseMore: function (n, k) { return '+ ' + n + ' weitere Dateien – die Map speichert höchstens 20, alle über code-graph usage ' + k; }, sByArea: 'Nach Ordner', sTop: 'Meistgenutzt', sNi: 'Nutzung ohne Import',
        sNoImport: 'Kein Import gefunden. Dynamisches Laden ist hier unsichtbar – darum heißt es „keine Nutzung gefunden“, nicht „ungenutzt“.',
        sUnknownH: 'Was die Map hier nicht weiß', sUnknown: [['Versions-Spec je Schritt der Kette:', ' nicht in der Map gespeichert – ', 'code-graph why {k}', ' zeigt sie je Hop.'], ['Aufrufe je Funktion:', ' nicht indiziert – nur die importierten Namen je Datei.', '', ''],
            ['Nutzungsanteil:', ' Oberfläche unbekannt – ', 'code-graph usage {k}', ' (braucht installierte Pakete). Nie ein geschätzter Prozentwert.'], ['Kann es weg?', ' ', 'code-graph remove-plan {k}', ' – listet, was sich ändern müsste.'],
            ['Sicherheitslücken:', ' nicht in der Map – ', 'agent-config audit:deps', ' (OSV, eigener Cache). Lizenzen, veraltet, Größe: nicht erfasst (offline).']],
        sRtWit: function (n) { return n + ' Zeugen'; }, sRtOk: 'konsistent', sRtBad: 'Zeugen widersprechen sich · SY-4', sRtEx: function (w) { return 'z. B. ' + w; },
        sRtNote: 'Die Paket-Filter links gelten hier nicht – Runtimes sind keine Pakete. Quellen: declared = engines/require im Manifest · ci = setup-Schritt im Workflow · image = Basis-Image im Dockerfile. Weichen sie ab, meldet AC SY-4. Welcher Wert gilt, entscheidet ihr – AC rät nicht.',
        sFindIntro: 'Hygiene-Rat, keine Sicherheitslücken. Jeder Befund trägt einen Vorschlag – nie automatisch angewendet. „Keine Nutzung gefunden“ ist ein Kandidat zum Entfernen, kein Urteil: dynamisches Laden sieht die Map nicht.',
        sFxNoteOn: function (a, b) { return 'Alle ' + a + ' Befunde inklusive ' + b + ' aus Test-Fixtures (Beispiel-Repos, kein Produktcode).'; }, sFxNoteOff: function (b, a, c) { return b + ' von ' + a + ' Befunden stammen aus Test-Fixtures und sind ausgeblendet. Gezeigt: ' + c + ' aus dem Produkt.'; },
        sFxShow: 'Fixtures einblenden', sFxHide: 'Fixtures ausblenden', sAdvice: 'advice', sCandAdvice: 'Kandidat · advice', sProduct: 'Produkt', sProposal: function (f) { return 'Vorschlag: ' + f; },
        sMapKind: 'Map-Art', sCommitted: 'Committete Map', sLocal: 'Lokal mit --branches', sBrNote: 'Branch ist ein globaler Kontext – hier gezeigt, weil nur Systeme, Code und Data Branch-Fakten haben.',
        sSnapH: function (c) { return 'Snapshot von Commit ' + c + ' · Branch-Zustand nicht enthalten'; }, sSnapB: 'Branch-Namen und -Daten sind Zustand dieses Rechners. Darum bleiben sie aus einer Map, die committet wird (D17). Lokal: ', sSnapB2: ' nimmt sie auf. Die Befehle ', sSnapB3: ' antworten immer.', sAnd: ' und ',
        sCan: 'Kann Branch-Unterschiede zeigen', sCanT: 'Code: Dateien, Symbole · Systeme: direkte Pakete ± und Versionen · Data: Tabellen, Spalten', sCannot: 'Keine Branch-Fakten', sCannotT: 'Kanten, Areas, Nutzung im Code, Befunde, Runtimes, Interfaces, Runtime, Delivery',
        sDetailOpen: 'Abhängigkeiten & Nutzung öffnen →', sFixNever: function (f) { return 'Vorschlag, nie angewendet: ' + f; }, sWitnessCap: 'Zeuge', sIndexOnly: 'index only', sWitnessNote: 'Noch nicht gegen die Datei bestätigt. Stufe T1 = aus Lockfile oder Manifest gelesen.',
        sOnBranches: 'Auf Branches', sOnBranchesNone: 'braucht eine lokale Map mit --branches (die Branch-Liste steht nicht in dieser Map)',
        sRows: ['Version', 'deklariert', 'installiert weil', 'genutzt von', 'ohne Import', 'benötigt von', 'benötigt selbst'], sFilesImport: function (n) { return n + ' Dateien (Import)'; }, sNoImportShort: 'kein Import gefunden', sTimesPk: function (n) { return '×' + n + ' Pakete'; }, sPk: function (n) { return n + ' Pakete'; },
        sMeta: function (r, f, p) { return r + ' Runtimes · ' + f + ' Frameworks · ' + p + ' Pakete'; }, sUsageHint: 'Anteil an seiner Oberfläche: `code-graph usage <Paket>` mit installiertem Paket', sRemoveHint: 'was ein Entfernen berührt: `code-graph remove-plan <Paket>`',
        sNoBranches: 'Ohne --branches gezeichnet: Branch-Namen und Daten sind der Zustand dieses Rechners und bleiben daher aus einer Map, die committet werden kann. `code-graph map --branches` nimmt sie auf; `code-graph branches` listet sie.',
        sAgainst: function (b) { return 'Jeder indizierte Branch gegen ' + b + ', aus Git-Objekten gelesen, ohne Checkout.'; }, sBrCols: ['Branch', 'Commit', 'gesehen', 'Parent', 'Stand', 'direkte Pakete ggü. aktuell', ''], sChainMissing: 'Die Ketten-Karte braucht .build/branch-chain.json in der Map (wird noch nicht hineingeschrieben).'
    }
});

var SY_FXW = 'tests/fixtures/*';
var SY_PM = { npm: ['npm', 'npm', 'sy-pm-npm'], composer: ['C', 'Composer', 'sy-pm-composer'] };
var SY_STV_TONE = { used: ['var(--green)', 'ok'], thru: ['var(--cyan)', 'cyan'], chain: ['var(--line2)', 'dash'], cand: ['var(--amber)', 'warn'], unk: ['var(--violet)', 'violet'], noinst: ['var(--faint)', 'faint'] };
var SY_STV_ORDER = ['used', 'thru', 'chain', 'cand', 'unk', 'noinst'];

/** The handover's default filter: every package manager and workspace, test fixtures off. */
function syF0(rows) {
    var ws = {};
    syWorkspaces(rows).forEach(function (w) { ws[w] = w !== SY_FXW; });
    var pm = {};
    syEcos(rows).forEach(function (e) { pm[e] = true; });
    return { pm: pm, ws: ws, scope: 'all', origin: 'all', lock: 'all', st: 'all', depth: 'all', by: 'all', dup: false, fw: false, find: false, q: '' };
}
var syState = { lens: 'overview', f: null, sort: 'find', group: false, limit: 60, sel: '', open: null, bmode: 'committed', key: null };
var syHist = pageHistory({
    snap: function () { return { lens: syState.lens, sel: syState.sel, f: JSON.parse(JSON.stringify(syState.f)), limit: syState.limit, sort: syState.sort, group: syState.group }; },
    apply: function (s) { syState.lens = s.lens; syState.sel = s.sel; syState.f = s.f; syState.limit = s.limit; syState.sort = s.sort; syState.group = s.group; renderAreaPage('systems', current.item); },
    key: function (s) { return s.lens === 'deps' ? s.sel : syLensName(s.lens); }
});
// A seam for the browser suite's sensitivity probe: the spec neutralises `push` and watches the way back disappear.
window.__mapSystemsHistory = syHist;
function syLensName(l) { return t({ overview: 'sOverview', pk: 'sPackages', deps: 'sDeps', rt: 'sRuntimes', find: 'sFindings', br: 'sBranches' }[l]); }
/** One history step: the state as it was is pushed, then the change applied and the page drawn. */
function syNav(change) { syHist.nav(change); renderAreaPage('systems', current.item); }
function sySetF(patch) { syNav(function () { syState.f = Object.assign({}, syState.f, patch); syState.limit = 60; }); }

function syLabel(k) { return k.name + '@' + k.version; }
function syManifestDir(d) { var f = String(d || '').split(':')[0]; var cut = f.lastIndexOf('/'); return cut < 0 ? '.' : f.slice(0, cut); }
function syWsKey(dir) { return dir.indexOf('tests/fixtures/') === 0 ? SY_FXW : dir; }

/**
 * The page's rows, one per package, computed once per payload: the handover's
 * PK tuple, read from the payload's own fields. A transitive package lives in
 * the workspace of the declaration its shortest path starts from.
 */
var syCache = { p: null, rows: null };
function syRowsOf(p) {
    if (syCache.p === p) return syCache.rows;
    var byLabel = Object.create(null);
    p.packages.forEach(function (k) { byLabel[syLabel(k)] = k; });
    var findBy = Object.create(null);
    (p.findings || []).forEach(function (f) { (findBy[f.subject] = findBy[f.subject] || []).push(f.id); });
    var names = Object.create(null);
    p.packages.forEach(function (k) { var n = k.ecosystem + ' ' + k.name; names[n] = (names[n] || 0) + 1; });
    var rows = p.packages.map(function (k) {
        var root = k.direct ? k : byLabel[k.path[0]];
        var decl = root && root.declared.length ? root.declared[0] : '';
        return { k: k, id: syLabel(k), name: k.name, version: k.version, eco: k.ecosystem, dev: k.dev, direct: k.direct, fw: k.framework, locked: k.locked,
            ws: decl ? syWsKey(syManifestDir(decl)) : '.', used: k.usedByTotal, finds: (findBy[k.id] || []).slice().sort(), by: k.requiredBy.length, req: k.requires.length,
            depth: k.direct ? 1 : k.path.length || 0, dup: names[k.ecosystem + ' ' + k.name] > 1 };
    });
    syCache = { p: p, rows: rows, byLabel: byLabel };
    return rows;
}
/** Workspaces by package count, as the handover lists them; the test fixtures last. */
function syWorkspaces(rows) { var n = Object.create(null); rows.forEach(function (r) { n[r.ws] = (n[r.ws] || 0) + 1; }); return Object.keys(n).sort(function (a, b) { return (a === SY_FXW) - (b === SY_FXW) || n[b] - n[a] || (a < b ? -1 : 1); }); }
/** npm first, then Composer, then any other ecosystem by name — the handover's order. */
function syEcos(rows) { var s = []; rows.forEach(function (r) { if (s.indexOf(r.eco) < 0) s.push(r.eco); }); var rank = { npm: 0, composer: 1 }; return s.sort(function (a, b) { return (a in rank ? rank[a] : 2) - (b in rank ? rank[b] : 2) || (a < b ? -1 : 1); }); }

/** The verdict state of a package — never a boolean "unused". */
function syStatus(r, p) {
    if (!r.locked) return 'noinst';
    if (r.used) return 'used';
    if (r.k.nonimport.length) return 'thru';
    if (!r.direct) return 'chain';
    return r.eco === 'composer' && !p.autoloadRead ? 'unk' : 'cand';
}
function syMatch(r, p, f, noWs, noSt) {
    if (!f.pm[r.eco]) return false;
    if (!noWs && !f.ws[r.ws]) return false;
    if (!noSt && f.st !== 'all' && syStatus(r, p) !== f.st) return false;
    if (f.scope === 'prod' && r.dev) return false;
    if (f.scope === 'dev' && !r.dev) return false;
    if (f.origin === 'direct' && !r.direct) return false;
    if (f.origin === 'trans' && r.direct) return false;
    if (f.lock === 'locked' && !r.locked) return false;
    if (f.lock === 'unlocked' && r.locked) return false;
    if (f.fw && !r.fw) return false;
    if (f.find && !r.finds.length) return false;
    if (f.dup && !r.dup) return false;
    if (f.depth !== 'all' && (f.depth === '4' ? r.depth < 4 : String(r.depth) !== f.depth)) return false;
    if (f.by !== 'all') {
        var b = r.by;
        if (f.by === '0' && b !== 0) return false;
        if (f.by === '1' && b !== 1) return false;
        if (f.by === '2' && (b < 2 || b > 4)) return false;
        if (f.by === '5' && b < 5) return false;
    }
    if (f.q && r.name.toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
    return true;
}
function syPmBadge(eco) { var m = SY_PM[eco] || [eco.slice(0, 3), eco, 'sy-pm-other']; return el('span', { class: 'pm ' + m[2] }, m[0]); }
function syStChip(r, p) { var s = syStatus(r, p); var x = t('STV')[s]; return stChip(x[0], 'sy-' + s, x[1]); }

// ---- the Filter aside ----

function sySeg(key, label, opts) {
    var wrap = add(el('div', { class: 'sy-fgroup' }), el('span', { class: 'cap' }, label));
    var g = el('div', { class: 'sy-seg', role: 'radiogroup', 'aria-label': label });
    opts.forEach(function (o) {
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(syState.f[key] === o[0]), 'data-v': o[0] }, o[1]);
        b.addEventListener('click', function () { var x = {}; x[key] = o[0]; sySetF(x); });
        g.appendChild(b);
    });
    wrap.appendChild(g);
    return wrap;
}
function syFilter(p, rows, left) {
    var f = syState.f;
    var pad = el('div', { class: 'sy-filter' });
    var sb = el('div', { class: 'sy-search' });
    var inp = el('input', { type: 'search', 'aria-label': t('sSearchL'), placeholder: t('sSearch'), id: 'sy-q' });
    inp.value = f.q;
    inp.addEventListener('change', function () { sySetF({ q: inp.value }); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') sySetF({ q: inp.value }); });
    pad.appendChild(add(sb, inp));
    var pm = add(el('div', { class: 'sy-fgroup' }), el('span', { class: 'cap' }, t('sPm')));
    syEcos(rows).forEach(function (e) {
        var on = !!f.pm[e];
        var locks = (p.lockfiles || []).filter(function (l) { return e === 'npm' ? /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock)$/.test(l) : e === 'composer' ? /(^|\/)composer\.lock$/.test(l) : false; });
        var byName = Object.create(null);
        locks.forEach(function (l) { var n = l.split('/').pop(); byName[n] = (byName[n] || 0) + 1; });
        var meta = Object.keys(byName).map(function (n) { return byName[n] + ' × ' + n; }).join(' · ') || t('sNoLock');
        var b = el('button', { type: 'button', role: 'checkbox', 'aria-checked': String(on), class: 'sy-pmrow' + (on ? ' on' : ''), 'data-eco': e });
        add(b, syPmBadge(e), add(el('span', { class: 'sy-pmname' }), el('b', null, (SY_PM[e] || [0, e])[1]), el('span', { class: 'mono' }, meta)), el('span', { class: 'mono sy-n' }, num(rows.filter(function (r) { return r.eco === e; }).length)));
        b.addEventListener('click', function () { var m = Object.assign({}, syState.f.pm); m[e] = !m[e]; sySetF({ pm: m }); });
        pm.appendChild(b);
    });
    // Decision D5: an ecosystem without a file says so; one present but unread says that, never "nothing found".
    var ecos = (p.ecosystems || []).filter(function (x) { return x.name !== 'npm' && x.name !== 'Composer'; });
    var none = ecos.filter(function (x) { return !x.files.length; });
    var unread = ecos.filter(function (x) { return x.files.length && !x.read; });
    if (none.length) {
        pm.appendChild(el('span', { class: 'cap sy-subcap' }, t('sNoLock')));
        pm.appendChild(add.apply(null, [el('div', { class: 'sy-chips', id: 'sy-nolock' })].concat(none.map(function (x) { return stChip(x.name, 'dash', t('sLooked')(x.name)); }))));
    }
    if (unread.length) {
        pm.appendChild(el('span', { class: 'cap sy-subcap' }, t('sNotRead')));
        pm.appendChild(add.apply(null, [el('div', { class: 'sy-chips', id: 'sy-unread' })].concat(unread.map(function (x) { return stChip(x.name, 'warn', t('sUnread')(x.files.join(', '))); }))));
    }
    pad.appendChild(pm);
    var ws = add(el('div', { class: 'sy-fgroup' }), el('span', { class: 'cap' }, t('sWs')));
    syWorkspaces(rows).forEach(function (w) {
        var on = !!f.ws[w];
        var b = el('button', { type: 'button', role: 'checkbox', 'aria-checked': String(on), class: 'sy-wsrow', 'data-ws': w });
        add(b, el('span', { class: 'sy-tick' + (on ? ' on' : '') }, on ? '✓' : ''), el('span', { class: 'mono sy-wsname' }, w === '.' ? t('sRoot') : w === SY_FXW ? t('sFxWs') : w), el('span', { class: 'mono sy-n' }, num(rows.filter(function (r) { return r.ws === w; }).length)));
        b.addEventListener('click', function () { var m = Object.assign({}, syState.f.ws); m[w] = !m[w]; sySetF({ ws: m }); });
        ws.appendChild(b);
    });
    pad.appendChild(ws);
    var st = add(el('div', { class: 'sy-fgroup' }), el('span', { class: 'cap' }, t('sStatus')));
    var sg = el('div', { class: 'sy-status', role: 'radiogroup', 'aria-label': t('sStatus') });
    ['all'].concat(SY_STV_ORDER).forEach(function (k) {
        var on = f.st === k;
        var n = rows.filter(function (r) { return syMatch(r, p, f, false, true) && (k === 'all' || syStatus(r, p) === k); }).length;
        var dot = el('span', { class: 'sy-dot' });
        dot.style.background = k === 'all' ? 'var(--line2)' : SY_STV_TONE[k][0];
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(on), title: k === 'all' ? t('sAllStatus') : t('STV')[k][1], class: 'sy-strow' + (n || on ? '' : ' none'), 'data-st': k });
        add(b, dot, el('span', { class: 'sy-stl' }, k === 'all' ? t('sAll') : t('STV')[k][0]), el('span', { class: 'mono sy-n' }, num(n)));
        b.addEventListener('click', function () { sySetF({ st: k }); });
        sg.appendChild(b);
    });
    add(st, sg, el('span', { class: 'sy-note' }, t('sStatusNote')));
    pad.appendChild(st);
    add(pad, sySeg('scope', t('sScope'), [['all', t('sAll')], ['prod', 'prod'], ['dev', 'dev']]),
        sySeg('origin', t('sOrigin'), [['all', t('sAll')], ['direct', t('sDirectS')], ['trans', t('sTransS')]]),
        sySeg('lock', t('sLock'), [['all', t('sAll')], ['locked', t('sLocked')], ['unlocked', t('sUnlockedS')]]),
        sySeg('depth', t('sDepth'), [['all', t('sAll')], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '≥ 4']]),
        sySeg('by', t('sBy'), [['all', t('sAll')], ['0', '0'], ['1', '1'], ['2', '2–4'], ['5', '≥ 5']]));
    var only = add(el('div', { class: 'sy-fgroup' }), el('span', { class: 'cap' }, t('sOnly')));
    var sw = el('div', { class: 'sy-chips' });
    [['fw', 'sFw'], ['find', 'sWithFinding'], ['dup', 'sMulti']].forEach(function (o) {
        var on = !!f[o[0]];
        var b = el('button', { type: 'button', role: 'switch', 'aria-checked': String(on), class: 'chip sy-switch' + (on ? ' on' : ''), 'data-flag': o[0] }, t(o[1]));
        b.addEventListener('click', function () { var x = {}; x[o[0]] = !on; sySetF(x); });
        sw.appendChild(b);
    });
    pad.appendChild(add(only, sw));
    var reset = el('button', { type: 'button', class: 'sy-reset' }, t('sReset'));
    reset.addEventListener('click', function () { syNav(function () { syState.f = syF0(rows); syState.limit = 60; }); });
    pad.appendChild(reset);
    left.appendChild(pad);
}

// ---- the sticky bar above every lens ----

function syActiveChips(rows, f) {
    var out = [];
    Object.keys(f.pm).forEach(function (k) { if (!f.pm[k]) out.push([t('sWithout')((SY_PM[k] || [0, k])[1]), function () { var m = Object.assign({}, syState.f.pm); m[k] = true; sySetF({ pm: m }); }]); });
    Object.keys(f.ws).forEach(function (w) { if (!f.ws[w]) out.push([t('sWithout')(w), function () { var m = Object.assign({}, syState.f.ws); m[w] = true; sySetF({ ws: m }); }]); });
    var lab = { scope: { prod: 'prod', dev: 'dev' }, origin: { direct: t('sDirectS'), trans: t('sTransS') }, lock: { locked: t('sLocked'), unlocked: t('sUnlockedS') },
        depth: { '1': t('sDepth').split(' (')[0] + ' 1', '2': t('sDepth').split(' (')[0] + ' 2', '3': t('sDepth').split(' (')[0] + ' 3', '4': t('sDepth').split(' (')[0] + ' ≥ 4' }, by: { '0': '0', '1': '1', '2': '2–4', '5': '≥ 5' } };
    Object.keys(lab).forEach(function (k) { if (f[k] !== 'all') out.push([k === 'by' ? t('sBy').split(' …')[0] + ' ' + lab.by[f.by] : lab[k][f[k]], function () { var x = {}; x[k] = 'all'; sySetF(x); }]); });
    if (f.st !== 'all') out.push([t('STV')[f.st][0], function () { sySetF({ st: 'all' }); }]);
    if (f.fw) out.push([t('sFw'), function () { sySetF({ fw: false }); }]);
    if (f.find) out.push([t('sWithFinding'), function () { sySetF({ find: false }); }]);
    if (f.dup) out.push([t('sMulti'), function () { sySetF({ dup: false }); }]);
    if (f.q) out.push(['„' + f.q + '“', function () { sySetF({ q: '' }); }]);
    return out;
}
function syStickyBar(p, rows, list, groups, main) {
    var bar = el('div', { class: 'sy-sticky', id: 'sy-bar' });
    bar.appendChild(syHist.node());
    bar.appendChild(el('span', { class: 'sy-flex' }));
    bar.appendChild(el('span', { class: 'mono sy-count', id: 'sy-count' }, t('sCount')(num(list.length), num(rows.length), syState.group ? num(groups.length) : '')));
    var fxN = rows.filter(function (r) { return r.ws === SY_FXW && syMatch(r, p, syState.f, true); }).length;
    if (rows.some(function (r) { return r.ws === SY_FXW; })) {
        var on = !!syState.f.ws[SY_FXW];
        var fx = el('button', { type: 'button', role: 'switch', 'aria-checked': String(on), title: t('sFxT'), class: 'mono sy-fx' + (on ? ' on' : ''), id: 'sy-fx' }, on ? t('sFxOn')(num(fxN)) : t('sFxOff')(num(fxN)));
        fx.addEventListener('click', function () { var m = Object.assign({}, syState.f.ws); m[SY_FXW] = !on; sySetF({ ws: m }); });
        bar.appendChild(fx);
    }
    syActiveChips(rows, syState.f).forEach(function (c) {
        var b = el('button', { type: 'button', class: 'mono sy-active' }, c[0] + ' ×');
        b.addEventListener('click', c[1]);
        bar.appendChild(b);
    });
    main.appendChild(bar);
}

// ---- lenses ----

function syGoPk(patch) { syNav(function () { syState.lens = 'pk'; syState.f = Object.assign({}, syState.f, patch); syState.limit = 60; }); }
function syOverview(p, rows, list, main) {
    var fw = Object.create(null);
    list.forEach(function (r) { if (r.fw) fw[r.name] = 1; });
    var dupNames = Object.create(null);
    list.forEach(function (r) { if (r.dup) dupNames[r.eco + r.name] = 1; });
    var kp = el('div', { class: 'sy-kpis', id: 'sy-kpis' });
    var rtNames = p.runtimes.map(function (r) { return r.name; }).join(', ');
    [[list.length, {}], [list.filter(function (r) { return r.direct; }).length, { origin: 'direct' }], [Object.keys(fw).length, { fw: true }], [list.filter(function (r) { return !r.locked; }).length, { lock: 'unlocked' }],
        [list.filter(function (r) { return r.finds.length; }).length, { find: true }], [Object.keys(dupNames).length, { dup: true }], [p.runtimes.length, null]].forEach(function (k, i) {
        var b = el('button', { type: 'button', class: 'sy-kpi' + (i === 4 ? ' amber' : i === 5 ? ' violet' : ''), 'data-kpi': String(i) });
        add(b, el('span', { class: 'mono sy-kv' }, num(k[0])), el('span', { class: 'sy-kl' }, t('sKpi')[i] + (i === 6 && rtNames ? ' · ' + rtNames : '')));
        b.addEventListener('click', function () { if (k[1]) syGoPk(k[1]); else syNav(function () { syState.lens = 'rt'; }); });
        kp.appendChild(b);
    });
    main.appendChild(kp);
    var cards = el('div', { class: 'sy-pmcards' });
    syEcos(rows).forEach(function (e) {
        var all = list.filter(function (r) { return r.eco === e; });
        var n = all.length;
        var dev = all.filter(function (r) { return r.dev; }).length;
        var dir = all.filter(function (r) { return r.direct; }).length;
        var lk = all.filter(function (r) { return r.locked; }).length;
        var card = add(el('div', { class: 'sy-pmcard' }), add(el('div', { class: 'sy-row' }), syPmBadge(e), el('b', null, (SY_PM[e] || [0, e])[1]), el('span', { class: 'mono sy-right' }, t('sPmCount')(num(n)))));
        [[t('sProdDev')[0] + ' ' + num(n - dev), t('sProdDev')[1] + ' ' + num(dev), n - dev, 'var(--cyan)'], [t('sDirTrans')[0] + ' ' + num(dir), t('sDirTrans')[1] + ' ' + num(n - dir), dir, 'var(--brand)']].forEach(function (bar) {
            var w = n ? Math.round(bar[2] / n * 1000) / 10 : 0;
            var track = el('div', { class: 'sy-track' });
            var a = el('div');
            a.style.width = w + '%';
            a.style.background = bar[3];
            add(track, a, el('div', { class: 'sy-rest' }));
            card.appendChild(add(el('div', { class: 'sy-barrow' }), add(el('div', { class: 'sy-barlab' }), el('span', null, bar[0]), el('span', null, bar[1])), track));
        });
        card.appendChild(el('span', { class: 'mono sy-small' }, t('sLockLine')(num(lk), num(n - lk))));
        cards.appendChild(card);
    });
    main.appendChild(cards);
    var grid = add(el('div', { class: 'sy-box sy-wsgrid' }), add(el('div', { class: 'sy-boxh' }), el('b', null, t('sWsPm')), el('span', { class: 'muted' }, t('sWsPmT'))));
    var head = el('div', { class: 'mono sy-wsh' });
    t('sWsH').forEach(function (h) { head.appendChild(el('span', null, h)); });
    grid.appendChild(head);
    syWorkspaces(rows).forEach(function (w) {
        var a = list.filter(function (r) { return r.ws === w; });
        var fc = a.filter(function (r) { return r.finds.length; }).length;
        var b = el('button', { type: 'button', class: 'mono sy-wsr', 'data-ws': w });
        add(b, el('span', null, w === '.' ? t('sRoot') : w), el('span', null, num(a.filter(function (r) { return r.eco === 'npm'; }).length)), el('span', null, num(a.filter(function (r) { return r.eco === 'composer'; }).length) || '–'),
            el('span', null, num(a.filter(function (r) { return r.direct; }).length)), el('span', { class: fc ? 'amber' : 'muted' }, fc ? num(fc) : '–'));
        b.addEventListener('click', function () { var m = {}; Object.keys(syState.f.ws).forEach(function (x) { m[x] = x === w; }); syGoPk({ ws: m }); });
        grid.appendChild(b);
    });
    main.appendChild(grid);
    var fwm = Object.create(null);
    var ford = [];
    list.forEach(function (r) { if (!r.fw) return; if (!fwm[r.name]) { fwm[r.name] = { name: r.name, v: [], used: 0 }; ford.push(r.name); } fwm[r.name].v.push(r.version); fwm[r.name].used += r.used; });
    var fws = ford.map(function (k) { return fwm[k]; }).sort(function (a, b) { return b.used - a.used; });
    var fsec = add(el('div', { class: 'sy-sec' }), add(el('div', { class: 'sy-sech' }), el('b', null, t('sFwH')(num(fws.length))), el('span', { class: 'muted' }, t('sFwT'))));
    var tiles = el('div', { class: 'sy-tiles' });
    fws.forEach(function (e) {
        var b = el('button', { type: 'button', class: 'sy-fwtile' + (e.used ? ' used' : ''), title: e.v.join(', ') });
        b.style.width = Math.max(110, Math.min(260, 110 + e.used * 3)) + 'px';
        add(b, el('span', { class: 'mono sy-fwn' }, e.name), el('span', { class: 'mono sy-fwm' }, t('sFwMeta')(e.v.length, num(e.used))));
        b.addEventListener('click', function () { syGoPk({ q: e.name, fw: true }); });
        tiles.appendChild(b);
    });
    main.appendChild(add(fsec, tiles));
    var groups = syFindingGroups(p, rows);
    var max = 1;
    groups.forEach(function (g) { max = Math.max(max, g.items.length); });
    var ksec = add(el('div', { class: 'sy-sec' }), add(el('div', { class: 'sy-sech' }), el('b', null, t('sFkH')), el('span', { class: 'muted' }, t('sFkT'))));
    groups.forEach(function (g) {
        var b = el('button', { type: 'button', class: 'sy-fkind' });
        var bar = el('span', { class: 'sy-fkbar' });
        var fill = el('span');
        fill.style.width = Math.max(3, g.items.length / max * 100) + '%';
        fill.style.background = g.id === 'SY-1' ? 'var(--line2)' : 'var(--amber)';
        add(b, el('span', { class: 'mono sy-b' }, g.id), el('span', null, g.title), add(bar, fill), el('span', { class: 'mono sy-right' }, num(g.items.length)));
        b.addEventListener('click', function () { syNav(function () { syState.lens = 'find'; syState.open = {}; syState.open[g.id] = true; }); });
        ksec.appendChild(b);
    });
    main.appendChild(ksec);
}

function sySorted(list) {
    var s = list.slice();
    var by = function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; };
    if (syState.sort === 'find') s.sort(function (a, b) { return (b.finds.length ? 1 : 0) - (a.finds.length ? 1 : 0) || b.used - a.used || (b.direct ? 1 : 0) - (a.direct ? 1 : 0) || by(a, b); });
    else if (syState.sort === 'name') s.sort(by);
    else if (syState.sort === 'used') s.sort(function (a, b) { return b.used - a.used || (b.direct ? 1 : 0) - (a.direct ? 1 : 0) || by(a, b); });
    else if (syState.sort === 'by') s.sort(function (a, b) { return b.by - a.by || by(a, b); });
    else if (syState.sort === 'depth') s.sort(function (a, b) { return b.depth - a.depth || by(a, b); });
    return s;
}
/** The handover's "Nach Name gruppieren": one row per name, its versions listed, uses summed. */
function syGrouped(sorted) {
    if (!syState.group) return sorted;
    var g = Object.create(null);
    var ord = [];
    sorted.forEach(function (r) {
        var key = r.eco + ' ' + r.name;
        if (!g[key]) { g[key] = { r: r, vs: [], ws: [], used: 0, finds: [] }; ord.push(key); }
        var e = g[key];
        e.vs.push(r.version);
        if (e.ws.indexOf(r.ws) < 0) e.ws.push(r.ws);
        e.used += r.used;
        r.finds.forEach(function (x) { if (e.finds.indexOf(x) < 0) e.finds.push(x); });
    });
    return ord.map(function (k) {
        var e = g[k];
        return Object.assign({}, e.r, { version: e.vs.length > 1 ? t('sVersions')(e.vs.length) + ' · ' + e.vs.slice(0, 3).join(', ') + (e.vs.length > 3 ? ' …' : '') : e.vs[0], ws: e.ws.join(', '), used: e.used, finds: e.finds, multi: e.vs.length });
    });
}
/**
 * One grid table for a payload list (sibling G.1's shared table): a header row,
 * one button row per item, and paging of 60 — every row is reachable by
 * scrolling and paging, the filters narrow, nothing is cut silently.
 */
function gridTable(opts) {
    var box = el('div', { class: 'gtable ' + (opts.cls || ''), id: opts.id || null });
    var head = el('div', { class: 'mono gt-head ' + opts.grid });
    opts.cols.forEach(function (c) { head.appendChild(el('span', { title: c[1] || null }, c[0])); });
    box.appendChild(head);
    opts.rows.slice(0, opts.limit).forEach(function (r) { box.appendChild(opts.row(r)); });
    var foot = add(el('div', { class: 'gt-foot' }), el('span', { class: 'gt-note' }, t('sShown')(num(Math.min(opts.limit, opts.rows.length)), num(opts.rows.length))));
    if (opts.rows.length > opts.limit) {
        var more = el('button', { type: 'button', class: 'gt-more' }, t('sMore60'));
        more.addEventListener('click', opts.more);
        foot.appendChild(more);
    }
    box.appendChild(foot);
    return box;
}
function syPackages(p, rows, list, main) {
    var ctl = add(el('div', { class: 'sy-pkctl' }), el('span', null, t('sSort')));
    var sg = el('div', { class: 'sy-seg inline', role: 'radiogroup', 'aria-label': t('sSort') });
    ['find', 'by', 'used', 'depth', 'name'].forEach(function (k) {
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(syState.sort === k), 'data-sort': k }, t('sSorts')[k]);
        b.addEventListener('click', function () { syNav(function () { syState.sort = k; }); });
        sg.appendChild(b);
    });
    var grp = el('button', { type: 'button', role: 'switch', 'aria-checked': String(syState.group), class: 'chip sy-switch' + (syState.group ? ' on' : ''), id: 'sy-group' }, t('sGroup'));
    grp.addEventListener('click', function () { syNav(function () { syState.group = !syState.group; syState.limit = 60; }); });
    main.appendChild(add(ctl, sg, grp));
    var groups = syGrouped(sySorted(list));
    var cols = t('sCols').map(function (c, i) { return [c, i === 4 ? t('sDepthT') : i === 6 ? t('sByT') : i === 7 ? t('sUsedT') : null]; });
    main.appendChild(gridTable({ id: 'sy-list', grid: 'pkgrid', cols: cols, rows: groups, limit: syState.limit,
        more: function () { syState.limit += 60; renderAreaPage('systems', current.item); },
        row: function (r) {
            var on = syState.sel === r.id;
            var b = el('button', { type: 'button', class: 'pkgrid gt-row' + (on ? ' on' : ''), 'data-id': r.id });
            var tags = add(el('span', { class: 'sy-tags' }), syStChip(r, p), r.fw ? stChip('framework', 'cyan') : null, r.ws === SY_FXW ? stChip(t('sFixture'), 'sy-fixture') : null, r.multi > 1 ? stChip(t('sVersions')(r.multi), 'violet-tint') : null);
            add(b, add(el('span'), syPmBadge(r.eco)), add(el('span', { class: 'gt-name' }), el('span', { class: 'gt-n' }, r.name), tags), el('span', { class: 'gt-v' }, r.version), el('span', { class: 'gt-s' }, r.dev ? 'dev' : 'prod'),
                el('span', { class: 'gt-d' }, r.depth ? String(r.depth) : '–'), el('span', { class: 'gt-w' }, r.ws), el('span', { class: 'gt-r' }, r.by ? '×' + num(r.by) : '–'), el('span', { class: 'gt-r gt-u' }, r.used ? num(r.used) : '–'),
                add(el('span'), stChip(r.finds.join(', ') || '–', r.finds.length ? 'warn' : 'sy-none')));
            b.addEventListener('click', function () { syPick(r.multi > 1 ? (rows.filter(function (x) { return x.eco === r.eco && x.name === r.name; })[0] || r).id : r.id); });
            return b;
        } }));
}
function syPick(id) { if (id === syState.sel) return; syNav(function () { syState.sel = id; }); }

/** Everything that depends on a package, transitively, and everything it pulls in: counted over requiredBy / requires. */
function syClosure(id, field) {
    var seen = Object.create(null);
    var queue = [id];
    while (queue.length) {
        var k = syCache.byLabel[queue.shift()];
        if (!k) continue;
        k[field].forEach(function (x) { if (!seen[x] && x !== id) { seen[x] = 1; queue.push(x); } });
    }
    return Object.keys(seen).length;
}
function syDeps(p, rows, cur, main) {
    var k = cur.k;
    var st = syStatus(cur, p);
    var visible = function (id) { var x = syCache.byLabel[id]; if (!x) return true; var r = rows.filter(function (y) { return y.k === x; })[0]; return !r || syMatch(r, p, syState.f); };
    var tagOf = function (id) { var x = syCache.byLabel[id]; if (!x) return [t('sNotInLock'), 'dash']; return x.direct ? [t('sDirectly') + (x.dev ? ' · dev' : ''), 'sy-direct'] : [t('sTransitively') + (x.dev ? ' · dev' : ''), 'dash']; };
    var head = add(el('div', { class: 'sy-dhead' }), syPmBadge(cur.eco), el('span', { class: 'mono sy-dname' }, cur.id));
    syDetailTags(cur, p).forEach(function (c) { head.appendChild(c); });
    var verdict = t('sVerdict')(t('STV')[st][0], t('STV')[st][1]) + (k.direct ? t('sIncluded')(k.declared.join(' · ') || '–') : t('sNotDirect')(k.path.length > 1 ? k.path[0] : '?', k.requiredBy.length));
    head.appendChild(el('span', { class: 'sy-verdict' }, verdict));
    main.appendChild(head);
    var same = rows.filter(function (r) { return r.eco === cur.eco && r.name === cur.name; }).length;
    var kp = el('div', { class: 'sy-dkpis', id: 'sy-dkpis' });
    [k.direct ? t('sYes') : t('sNo'), '×' + num(k.requiredBy.length), num(syClosure(cur.id, 'requiredBy')), num(k.requires.length), num(syClosure(cur.id, 'requires')), num(k.usedByTotal), num(same)].forEach(function (v, i) {
        kp.appendChild(add(el('div', { class: 'sy-dkpi' }), el('span', { class: 'mono' }, v), el('span', null, t('sDk')[i])));
    });
    main.appendChild(kp);
    // Neighbourhood: left what requires it, right what it requires, ten a side.
    var byV = k.requiredBy.filter(visible);
    var reqV = k.requires.filter(visible);
    var hidBy = k.requiredBy.length - byV.length;
    var hidReq = k.requires.length - reqV.length;
    var L = byV.slice(0, 10);
    var R = reqV.slice(0, 10);
    if (byV.length > 10) L.push(t('sMoreN')(byV.length - 10));
    if (reqV.length > 10) R.push(t('sMoreN')(reqV.length - 10));
    var rowsN = Math.max(L.length, R.length, 1);
    var H = rowsN * 34 + 16;
    var yc = H / 2;
    var nb = add(el('div', { class: 'sy-box sy-nb' }), add(el('div', { class: 'sy-boxh' }), el('b', null, t('sNb')), el('span', { class: 'muted' }, t('sNbT'))));
    var stage = el('div', { class: 'sy-nbstage', id: 'sy-nb' });
    stage.style.height = H + 'px';
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    var node = function (name, x, y, w, main2, link, side) {
        var b = el('button', { type: 'button', class: 'mono sy-nbnode' + (main2 ? ' main' : ''), title: name, 'data-side': side }, name);
        b.style.left = x + '%';
        b.style.top = (y - 13) + 'px';
        b.style.width = w + '%';
        if (link) b.addEventListener('click', function () { if (syCache.byLabel[name]) syPick(name); });
        else b.disabled = !main2;
        stage.appendChild(b);
    };
    var line = function (x1, y1, x2, y2, cls) { var l = document.createElementNS(svgNS, 'line'); l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); l.setAttribute('class', cls); svg.appendChild(l); };
    stage.appendChild(svg);
    L.forEach(function (n, i) { var y = 25 + i * 34 + (rowsN - L.length) * 17; var more = n.charAt(0) === '+'; node(n, 0, y, 30, false, !more, 'left'); line(30, y, 36, yc, 'sy-nbl'); });
    R.forEach(function (n, i) { var y = 25 + i * 34 + (rowsN - R.length) * 17; var more = n.charAt(0) === '+'; node(n, 70, y, 30, false, !more, 'right'); line(64, yc, 70, y, 'sy-nbr'); });
    node(cur.id, 36, yc, 28, true, false, 'main');
    if (!L.length) { var eL = el('span', { class: 'sy-nbempty' }, hidBy ? t('sFiltered')(num(hidBy)) : k.direct ? t('sNbNone') : t('sNbUnknown')); eL.style.left = '0'; eL.style.top = (yc - 8) + 'px'; stage.appendChild(eL); }
    if (!R.length) { var eR = el('span', { class: 'sy-nbempty' }, hidReq ? t('sFiltered')(num(hidReq)) : t('sNbNoReq')); eR.style.left = '70%'; eR.style.top = (yc - 8) + 'px'; stage.appendChild(eR); }
    main.appendChild(add(nb, stage));
    // Why installed: the map carries the shortest path (sibling E.5 brings every chain).
    var chains = k.direct ? [[]] : [k.path.slice(0, -1)];
    var why = add(el('div', { class: 'sy-box sy-why', id: 'sy-why' }), add(el('div', { class: 'sy-boxh' }), el('b', null, t('sWhy')(t('sWays')(chains.length))), el('span', { class: 'muted' }, t('sWhyT'))));
    chains.forEach(function (ids, i) {
        var rootK = syCache.byLabel[ids.length ? ids[0] : cur.id];
        var decl = rootK && rootK.declared[0] ? rootK.declared[0].split(' ')[0].replace(/:\d+$/, '') : t('sManifest');
        var items = [[decl, t('sManifest'), null]].concat(ids.map(function (n, j) { return [n, j === 0 ? t('sDeclDirect') : t('sRequired'), n]; })).concat([[cur.id, ids.length ? t('sThis') : t('sDeclDirect'), null]]);
        var row = add(el('div', { class: 'sy-chain' }), el('span', { class: 'mono sy-way' }, t('sWay')(i + 1)));
        items.forEach(function (c, j) {
            var last = j === items.length - 1;
            var b = el('button', { type: 'button', class: 'sy-hop' + (last ? ' last' : j === 0 ? ' first' : '') });
            add(b, el('span', { class: 'cap' }, c[1]), el('span', { class: 'mono' }, c[0]));
            if (c[2]) b.addEventListener('click', function () { syPick(c[2]); });
            row.appendChild(b);
            if (!last) row.appendChild(el('span', { class: 'sy-arrow', 'aria-hidden': 'true' }, '→'));
        });
        why.appendChild(row);
    });
    why.appendChild(el('span', { class: 'sy-note' }, k.direct ? t('sDeclaredHere') : k.requiredBy.length > 1 ? t('sAllPathsMissing') + cur.name : t('sOnlyOne')));
    main.appendChild(why);
    var two = el('div', { class: 'sy-two' });
    [[t('sReqBy')(num(k.requiredBy.length)), hidBy, 'requiredBy', byV, hidBy ? t('sAllHidden')(num(hidBy)) : k.direct ? t('sNoOther') : t('sNoInfo'), 'sy-reqby'],
        [t('sReqs')(num(k.requires.length)), hidReq, 'requires', reqV, hidReq ? t('sAllHidden')(num(hidReq)) : t('sNoDeps'), 'sy-reqs']].forEach(function (c) {
        var box = add(el('div', { class: 'sy-box', id: c[5] }), add(el('div', { class: 'sy-boxh' }), add(el('b', null, c[0]), c[1] ? el('span', { class: 'sy-hid' }, ' · ' + t('sFiltered')(num(c[1]))) : null), el('span', { class: 'mono muted' }, c[2])));
        c[3].forEach(function (id) {
            var tg = tagOf(id);
            var b = el('button', { type: 'button', class: 'sy-lrow' });
            add(b, el('span', { class: 'mono sy-ln' }, id), stChip(tg[0], tg[1]));
            b.addEventListener('click', function () { if (syCache.byLabel[id]) syPick(id); });
            box.appendChild(b);
        });
        if (!c[3].length) box.appendChild(el('span', { class: 'sy-empty' }, c[4]));
        two.appendChild(box);
    });
    main.appendChild(two);
    var use = add(el('div', { class: 'sy-box', id: 'sy-use' }), add(el('div', { class: 'sy-boxh' }), el('b', null, t('sUse')(num(k.usedByTotal))), el('span', { class: 'muted' }, t('sUseT'))));
    k.usedBy.forEach(function (u) {
        var parts = u.file.split('/');
        var names = u.names.length ? u.names.map(function (n) { return stChip(n, 'cyan'); }) : [stChip(t('sWhole'), 'dash')];
        use.appendChild(add(el('div', { class: 'sy-urow' }), add(el('span', { class: 'mono sy-uf', title: u.file }, parts.length > 3 ? '…/' + parts.slice(-3).join('/') : u.file), el('span', { class: 'muted' }, ':' + u.witness.line)), add.apply(null, [el('span', { class: 'sy-chips' })].concat(names))));
    });
    if (k.usedByTotal > k.usedBy.length) use.appendChild(el('span', { class: 'sy-umore' }, t('sUseMore')(num(k.usedByTotal - k.usedBy.length), cur.name)));
    if (k.byArea) {
        var areasW = add(el('div', { class: 'sy-usub', id: 'sy-byarea' }), el('span', { class: 'cap' }, t('sByArea')));
        var ac = el('div', { class: 'sy-chips' });
        Object.keys(k.byArea).sort(function (a, b) { return k.byArea[b] - k.byArea[a] || (a < b ? -1 : 1); }).forEach(function (a) { ac.appendChild(stChip(a + ' · ' + num(k.byArea[a]), 'sy-line')); });
        use.appendChild(add(areasW, ac));
    }
    if (!k.usedBy.length) use.appendChild(el('span', { class: 'sy-empty' }, t('sNoImport')));
    var top = k.topNames && k.topNames.length ? k.topNames : null;
    if (top) use.appendChild(add(el('div', { class: 'sy-usub', id: 'sy-top' }), el('span', { class: 'cap' }, t('sTop')), add.apply(null, [el('div', { class: 'sy-chips' })].concat(top.map(function (n) { return stChip(n[0] + ' · ' + num(n[1]), 'cyan'); })))));
    if (k.nonimport.length) use.appendChild(add.apply(null, [el('div', { class: 'sy-usub' }), el('span', { class: 'cap' }, t('sNi'))].concat(k.nonimport.map(function (n) { return el('span', { class: 'mono soft' }, n); }))));
    main.appendChild(use);
    var unk = add(el('div', { class: 'sy-unknown', id: 'sy-unknown' }), el('b', null, t('sUnknownH')));
    t('sUnknown').forEach(function (l) { unk.appendChild(add(el('span'), el('b', null, l[0]), document.createTextNode(l[1]), l[2] ? el('span', { class: 'mono' }, l[2].replace('{k}', cur.name)) : null, document.createTextNode(l[3]))); });
    main.appendChild(unk);
}
function syRuntimes(p, main) {
    p.runtimes.forEach(function (r) {
        var m = Object.create(null);
        var ord = [];
        r.witnesses.forEach(function (w) { var key = w.kind + '|' + w.value; if (!m[key]) { m[key] = { kind: w.kind, value: w.value, n: 0, ex: wloc(w.witness) }; ord.push(key); } m[key].n += 1; });
        var max = 0;
        ord.forEach(function (key) { max = Math.max(max, m[key].n); });
        var card = add(el('div', { class: 'sy-box sy-rt', 'data-rt': r.name }), add(el('div', { class: 'sy-rth' }), el('span', { class: 'mono sy-rtn' }, r.name), stChip(r.disagrees ? t('sRtBad') : t('sRtOk'), r.disagrees ? 'warn' : 'ok'), el('span', { class: 'muted sy-right' }, t('sRtWit')(num(r.witnesses.length)))));
        var body = el('div', { class: 'sy-rtb' });
        ord.sort(function (a, b) { return m[b].n - m[a].n; }).forEach(function (key) {
            var v = m[key];
            var bar = el('div', { class: 'sy-track' });
            var fill = el('div');
            fill.style.width = Math.max(4, v.n / max * 100) + '%';
            fill.style.background = v.kind === 'declared' ? 'var(--violet)' : v.kind === 'ci' ? 'var(--cyan)' : 'var(--green)';
            bar.appendChild(fill);
            body.appendChild(add(el('div', { class: 'sy-rtrow' }), el('span', { class: 'mono sy-b' }, v.value), stChip(v.kind, 'sy-line'), bar, el('span', { class: 'mono sy-right' }, num(v.n))));
        });
        body.appendChild(el('span', { class: 'mono sy-small' }, t('sRtEx')(wloc(r.witnesses[0].witness))));
        main.appendChild(add(card, body));
    });
    main.appendChild(el('div', { class: 'sy-note' }, t('sRtNote')));
}
function syIsFixture(f, rows) {
    if (/tests\/fixtures/.test(((f.witnesses || [])[0] || {}).file || '')) return true;
    var k = (syCache.p.packages || []).filter(function (x) { return x.id === f.subject; })[0];
    var r = k ? rows.filter(function (y) { return y.k === k; })[0] : null;
    return !!(r && r.ws === SY_FXW);
}
function syFindingGroups(p, rows) {
    var fxOn = !!syState.f.ws[SY_FXW];
    var groups = Object.create(null);
    (p.findings || []).forEach(function (f, i) {
        if (!fxOn && syIsFixture(f, rows)) return;
        var k = (p.packages || []).filter(function (x) { return x.id === f.subject; })[0];
        var r = k ? rows.filter(function (y) { return y.k === k; })[0] : null;
        if (r && !syMatch(r, p, syState.f)) return;
        (groups[f.id] = groups[f.id] || { id: f.id, title: f.title || f.message, sev: f.severity, items: [] }).items.push({ f: f, i: i, r: r });
    });
    return Object.keys(groups).sort().map(function (k) { return groups[k]; });
}
function syFindings(p, rows, main) {
    var all = p.findings || [];
    var nFx = all.filter(function (f) { return syIsFixture(f, rows); }).length;
    var fxOn = !!syState.f.ws[SY_FXW];
    var groups = syFindingGroups(p, rows);
    var shown = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    main.appendChild(el('div', { class: 'sy-intro' }, t('sFindIntro')));
    var note = add(el('div', { class: 'sy-fxnote' + (fxOn ? ' on' : '') }), el('span', { class: 'sy-flex' }, fxOn ? t('sFxNoteOn')(num(all.length), num(nFx)) : t('sFxNoteOff')(num(nFx), num(all.length), num(shown))));
    var fb = el('button', { type: 'button', class: 'sy-btn' }, fxOn ? t('sFxHide') : t('sFxShow'));
    fb.addEventListener('click', function () { var m = Object.assign({}, syState.f.ws); m[SY_FXW] = !fxOn; sySetF({ ws: m }); });
    main.appendChild(add(note, fb));
    // The handover opens the largest group that is not the removal candidates.
    if (!syState.open) { syState.open = {}; var big = groups.filter(function (g) { return g.id !== 'SY-1'; }).sort(function (a, b) { return b.items.length - a.items.length; })[0]; if (big) syState.open[big.id] = true; }
    groups.forEach(function (g) {
        var open = !!syState.open[g.id];
        var box = el('div', { class: 'sy-box sy-fgrp', 'data-rule': g.id });
        var h = el('button', { type: 'button', class: 'sy-fgh', 'aria-expanded': String(open) });
        add(h, el('span', { class: 'mono sy-b' }, g.id), el('span', { class: 'sy-flex' }, g.title), stChip(g.id === 'SY-1' ? t('sCandAdvice') : g.sev + ' · ' + t('sAdvice'), g.id === 'SY-1' ? 'sy-line' : 'warn'), el('span', { class: 'mono sy-fgn' }, num(g.items.length)), el('span', { class: 'muted', 'aria-hidden': 'true' }, open ? '▾' : '▸'));
        h.addEventListener('click', function () { syState.open[g.id] = !open; renderAreaPage('systems', current.item); });
        box.appendChild(h);
        if (open) {
            var list = el('div', { class: 'sy-fitems' });
            g.items.forEach(function (it) {
                var fx = syIsFixture(it.f, rows);
                var b = el('button', { type: 'button', class: 'sy-fitem' });
                add(b, add(el('span', { class: 'sy-fsub' }), el('span', { class: 'mono sy-b' }, it.r ? it.r.id : it.f.subject), stChip(fx ? t('sFixture') : t('sProduct'), fx ? 'sy-fixture' : 'sy-line')),
                    add(el('span', { class: 'sy-fwhere' }), el('span', { class: 'mono muted' }, wloc((it.f.witnesses || [])[0] || { file: '–', line: 0 })), it.f.fix ? el('span', { class: 'mono sy-fix' }, t('sProposal')(it.f.fix)) : null));
                b.addEventListener('click', function () { if (it.r) syNav(function () { syState.sel = it.r.id; syState.lens = 'deps'; }); });
                list.appendChild(b);
            });
            box.appendChild(list);
        }
        main.appendChild(box);
    });
}
function syBranches(main) {
    var b = model.branches;
    var local = !!b;
    var ctl = add(el('div', { class: 'sy-pkctl' }));
    var g = el('div', { class: 'sy-seg inline', role: 'radiogroup', 'aria-label': t('sMapKind') });
    [['committed', t('sCommitted')], ['local', t('sLocal')]].forEach(function (o) {
        var on = (local ? 'local' : 'committed') === o[0];
        var x = el('button', { type: 'button', role: 'radio', 'aria-checked': String(on), disabled: !on ? true : null }, o[1]);
        g.appendChild(x);
    });
    main.appendChild(add(ctl, g, el('span', { class: 'muted' }, t('sBrNote'))));
    if (!local) {
        var pin = model.pin || { commit: meta.commit };
        var card = add(el('div', { class: 'sy-snap', id: 'sy-snap' }), el('b', null, t('sSnapH')(String(pin.commit || '').slice(0, 8))),
            add(el('span', { class: 'soft' }), document.createTextNode(t('sSnapB')), el('span', { class: 'mono' }, 'code-graph map --branches'), document.createTextNode(t('sSnapB2')), el('span', { class: 'mono' }, 'branches'), document.createTextNode(', '), el('span', { class: 'mono' }, 'branch-diff A B'), document.createTextNode(t('sAnd')), el('span', { class: 'mono' }, 'on-branches <paket>'), document.createTextNode(t('sSnapB3'))));
        card.appendChild(add(el('div', { class: 'sy-snapgrid' }), add(el('div', { class: 'yes' }), el('b', null, t('sCan')), el('br'), el('span', { class: 'soft' }, t('sCanT'))), add(el('div', { class: 'no' }), el('b', null, t('sCannot')), el('br'), el('span', { class: 'soft' }, t('sCannotT')))));
        main.appendChild(card);
        return;
    }
    main.appendChild(el('p', { class: 'sy-note' }, t('sAgainst')(b.current) + (b.chain && b.chain.length > 1 ? '' : ' ' + t('sChainMissing'))));
    var box = el('div', { class: 'gtable', id: 'sy-brtable' });
    var head = el('div', { class: 'mono gt-head brgrid' });
    t('sBrCols').forEach(function (c) { head.appendChild(el('span', null, c)); });
    box.appendChild(head);
    b.list.forEach(function (x) {
        var behind = (b.chain || []).filter(function (l) { return l.branch === x.ref; })[0];
        box.appendChild(add(el('div', { class: 'mono gt-row brgrid' }), el('b', null, x.ref), el('span', null, x.commit.slice(0, 8)), el('span', null, x.seen), el('span', { class: x.parent ? '' : 'amber' }, x.parent || 'unknown'),
            el('span', null, behind && behind.behind != null ? String(behind.behind) : '–'), el('span', null, x.packages.join(' · ') || '–'), el('span')));
    });
    main.appendChild(box);
}

// ---- the Detail aside ----

function syDetailTags(r, p) {
    var k = r.k;
    var out = [syStChip(r, p), stChip(k.dev ? 'dev' : 'prod', 'sy-line'), stChip(k.direct ? t('sDirectly') : t('sTransitively'), k.direct ? 'sy-direct' : 'dash')];
    if (k.framework) out.push(stChip('framework', 'cyan'));
    if (k.locked) out.push(stChip(t('sLockedTag'), 'sy-line'));
    if (r.ws === SY_FXW) out.push(stChip(t('sFixtureNp'), 'sy-fixture'));
    return out;
}
function syDetail(p, r, right) {
    var k = r.k;
    var pad = el('div', { class: 'sy-detail', id: 'sy-detail' });
    add(pad, add(el('div', { class: 'sy-row' }), syPmBadge(r.eco), el('span', { class: 'mono muted sy-small' }, (SY_PM[r.eco] || [0, r.eco])[1] + ' · ' + (r.ws === '.' ? 'Root' : r.ws))), el('span', { class: 'mono sy-dn' }, k.name));
    pad.appendChild(add.apply(null, [el('div', { class: 'sy-chips' })].concat(syDetailTags(r, p))));
    var kv = el('div', { class: 'mono sy-kv' });
    var why = k.direct ? (k.declared[0] || '–') : k.path.length ? k.path.join(' → ') : '–';
    [[t('sRows')[0], k.version], [k.direct ? t('sRows')[1] : t('sRows')[2], why], [t('sRows')[3], k.usedByTotal ? t('sFilesImport')(num(k.usedByTotal)) : t('sNoImportShort')], [t('sRows')[4], k.nonimport.join(' · ') || '–'],
        [t('sRows')[5], t('sTimesPk')(num(k.requiredBy.length))], [t('sRows')[6], t('sPk')(num(k.requires.length))]].forEach(function (x) { add(kv, el('span', { class: 'muted' }, x[0]), el('span', null, x[1])); });
    pad.appendChild(kv);
    var open = el('button', { type: 'button', class: 'sy-open', id: 'sy-open' }, t('sDetailOpen'));
    open.addEventListener('click', function () { syNav(function () { syState.lens = 'deps'; }); });
    pad.appendChild(open);
    (p.findings || []).filter(function (f) { return f.subject === k.id; }).forEach(function (f) {
        pad.appendChild(add(el('div', { class: 'sy-fcard' }), el('span', { class: 'mono sy-b' }, f.id + ' · ' + (f.title || '')), el('span', { class: 'sy-fmsg' }, f.message), el('span', { class: 'mono sy-small' }, t('sFixNever')(f.fix || '–'))));
    });
    pad.appendChild(add(el('div', { class: 'sy-onbr' }), el('span', { class: 'cap' }, t('sOnBranches')), el('span', { class: 'muted sy-small' }, t('sOnBranchesNone'))));
    pad.appendChild(add(el('div', { class: 'sy-wit' }), el('span', { class: 'cap' }, t('sWitnessCap')), el('span', { class: 'mono soft' }, wloc(k.witness)),
        add(el('span'), confirmChip(k.witness.confirm), document.createTextNode(' ' + t('sWitnessNote')))));
    right.appendChild(pad);
}

AREA_MODULES.systems = {
    tabs: [['overview', 'sOverview'], ['pk', 'sPackages'], ['deps', 'sDeps'], ['rt', 'sRuntimes'], ['find', 'sFindings'], ['br', 'sBranches']],
    railTitles: ['sFilter', 'sDetail'],
    ownsBar: true,
    items: function (p) {
        var out = p.packages.map(function (k) {
            return {
                key: 'package/' + syLabel(k), kind: 'package', label: syLabel(k), sub: k.ecosystem + ' · ' + (k.dev ? 'dev' : 'prod') + (k.framework ? ' · framework' : ''),
                rows: [[t('sRows')[0], k.version], ['usage', t('sUsageHint')], ['remove-plan', t('sRemoveHint')]],
                witnesses: [k.witness].concat(k.usedBy.map(function (u) { return u.witness; }))
            };
        });
        p.runtimes.forEach(function (r) {
            out.push({ key: 'runtime/' + r.name, kind: 'runtime', label: r.name, sub: r.disagrees ? t('sRtBad') : t('sRtOk'), rows: r.witnesses.map(function (w) { return [w.kind, w.value + '  ' + wloc(w.witness)]; }), witnesses: r.witnesses.map(function (w) { return w.witness; }) });
        });
        return out;
    },
    meta: function (p) { return t('sMeta')(num(p.runtimes.length), num(p.packages.filter(function (k) { return k.framework; }).length), num(p.packages.length)); },
    page: function (p, view, key, host) {
        var rows = syRowsOf(p);
        if (!syState.f) syState.f = syF0(rows);
        // A search hit or a deep link names a package or runtime: it becomes the selection, as one history step.
        if (key && key !== syState.key) {
            syState.key = key;
            if (key.indexOf('package/') === 0 && syCache.byLabel[key.slice(8)]) syHist.nav(function () { syState.sel = key.slice(8); });
            else if (key.indexOf('runtime/') === 0) syHist.nav(function () { syState.lens = 'rt'; });
        }
        // The lens is the page's own state; the shell's view tabs are drawn from it.
        avState.view.systems = syState.lens;
        var list = rows.filter(function (r) { return syMatch(r, p, syState.f); });
        var groups = syGrouped(sySorted(list));
        var cur = rows.filter(function (r) { return r.id === syState.sel; })[0] || sySorted(list)[0] || rows[0];
        if (cur && !syState.sel) syState.sel = cur.id;
        var bar = host.bar;
        bar.appendChild(el('span', { class: 'ops-mark' }));
        var tabs = el('div', { class: 'lenses', role: 'tablist', 'aria-label': t('views') });
        var findN = syFindingGroups(p, rows).reduce(function (n, g) { return n + g.items.length; }, 0);
        AREA_MODULES.systems.tabs.forEach(function (o) {
            var b = el('button', { type: 'button', role: 'tab', class: 'lens', 'aria-selected': String(syState.lens === o[0]), 'data-lens': o[0] }, t(o[1]) + (o[0] === 'find' ? ' · ' + num(findN) : ''));
            b.addEventListener('click', function () { if (syState.lens !== o[0]) syNav(function () { syState.lens = o[0]; }); });
            tabs.appendChild(b);
        });
        bar.appendChild(tabs);
        bar.appendChild(add(el('span', { class: 'mono av-barmeta' }), el('span', null, p.reader.replace(' (', ' · ').replace(')', '')), document.createTextNode(' '), stChip(t('completeNames')[p.completeness] || p.completeness, COMPLETE_CLASS[p.completeness])));
        syFilter(p, rows, host.left);
        var main = host.main;
        main.classList.add('sy-main');
        syStickyBar(p, rows, list, groups, main);
        if (syState.lens === 'pk') syPackages(p, rows, list, main);
        else if (syState.lens === 'deps' && cur) syDeps(p, rows, cur, main);
        else if (syState.lens === 'rt') syRuntimes(p, main);
        else if (syState.lens === 'find') syFindings(p, rows, main);
        else if (syState.lens === 'br') syBranches(main);
        else syOverview(p, rows, list, main);
        if (cur) syDetail(p, cur, host.right);
    }
};
