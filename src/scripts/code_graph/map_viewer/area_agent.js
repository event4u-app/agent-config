/*
 * Agent: what an agent gets before it acts. The context pack the working diff
 * seeds, the review-risk sum of that diff, and the graph verbs — each named as
 * the CLI names it, so `explain` is the neighbourhood query and never generated
 * prose. The freshness banner states the map's real state; the preview radio
 * only shows how the banner reads in the other states and says so.
 */
extendStrings({
    en: {
        gPack: 'Context pack', gRisk: 'Review risk', gVerbsTab: 'Verbs & contracts', gRequest: 'Request', gItem: 'Item',
        gTagline: 'What the agent gets before it acts · only facts from the graph, no generated text',
        gCall: 'Call', gCallVia: 'MCP tool · the same answer by CLI', gCliOnly: 'CLI only', gCliOnlyT: 'no MCP tool answers this verb', gVerbs: 'Verbs', gLive: 'live',
        gFreshPreview: 'Freshness · preview', gFreshGroup: 'Freshness state', gFreshNote: 'The banner stands above every answer. It says the state and the reason – never only a colour.',
        gBanner: {
            fresh: ['Index = HEAD.', 'The graph is level with the commit; witnesses are re-read per item before use.'],
            stale: ['The index is behind the working tree.', 'The pack stays usable because every item is confirmed on its own. Re-read changed items first.'],
            contradicted: ['Facts contradict their source.', 'Do not use the graph as the truth here – read the source, then redraw the map.'],
            unverifiable: ['The source cannot be read.', 'Items are hints only; their confirmation is unknown.']
        },
        gPreviewOf: function (s) { return 'preview · the map is ' + s; }, gIndexAt: function (c, s) { return 'index ' + c + ' · ' + s; },
        gKpi: { ret: 'returned / total', more: 'hasMore', used: 'tokens used', attn: 'need attention', id: 'answer id' }, gNoId: 'the map stores no answer id for the pack it carries',
        gBudget: function (b) { return 'Budget ' + b + ' tokens'; }, gUsed: function (u, p) { return u + ' used · ' + p; }, gLegend: 'Confirmation per item:',
        gCol: { kind: 'Kind', item: 'Item', why: 'Why in the pack', state: 'State', tok: 'Tok.' },
        gMoreYes: function (n) { return 'hasMore: true · ' + n + ' more items over budget – cut by rank, not hidden'; }, gMoreNo: function (n) { return 'hasMore: false · all ' + n + ' items within budget'; },
        gNextPage: 'Next page (cursor)', gNoCursor: 'the pack has no cursor paging yet; a larger --budget returns more',
        gNoPack: 'no context pack was written: the map carries one only for a working diff; `agent-config code-graph pack "<task>"` returns one',
        gNoRisk: 'no review-risk was written: the map was drawn without a working diff', gThresholds: 'Thresholds', gThresholdsT: 'review-risk names provisional bands only (low / medium / high / unknown), uncalibrated, read by no gate',
        gRiskCol: { term: 'Term', fact: 'Fact from the graph', calc: 'Calculation', contrib: 'Contribution' }, gSum: 'Sum', gFacts: function (n) { return num(n) + (n === 1 ? ' fact' : ' facts'); },
        gFirst: function (x) { return 'first: ' + x; }, gWeight: 'weight',
        gRiskNote: 'Weights live in RISK_WEIGHTS of review_risk.ts. Every term is a fact with its witness. There is no hidden term and no model judgement. Callers count stated edges only; guess edges stay out. A term whose lane was skipped reads unknown and stays out of the sum; a term without a fact counts 0.',
        gIn: 'in', gOut: 'out', gGuarantee: 'guarantee', gTodo: 'What the agent must do', gHow: 'How it is confirmed',
        gHowText: 'On every answer AC checks each item\'s content hash against the file in the working tree. confirmed: unchanged. moved: same content, another line. changed: content differs, re-read. gone: file or symbol gone, it stays visible as a tombstone.',
        gTodoBy: {
            confirmed: 'Use it directly.', moved: 'Use the new line. No re-read needed.', changed: 'Re-read the file before any statement or change. The excerpt in the pack is stale.',
            gone: 'Do not reference it any more. Old imports of it are errors.', added: 'New in the working tree, not yet in the index: read the file.', unconfirmed: 'Index state only: confirm it before acting on it.',
            unknown: 'Use it as a hint only – read the source yourself, the confirmation is unknown.'
        },
        gRow: { why: 'why', ctx: 'context', hash: 'hash', rank: 'rank', tokens: 'tokens', cli: 'CLI', mcp: 'MCP', count: 'count × weight', contrib: 'contribution' },
        gRank: function (i, n) { return i + ' of ' + n; }, gUnknown: 'unknown', gProvNo: 'the pack records no provenance per item',
        gPickItem: 'Pick an item to see why it is in the pack and what to do with it.', gMeta: function (v) { return v + ' verbs'; }
    },
    de: {
        gPack: 'Context-Pack', gRisk: 'Review-Risk', gVerbsTab: 'Verben & Verträge', gRequest: 'Anfrage', gItem: 'Item',
        gTagline: 'Was der Agent bekommt, bevor er handelt · nur Fakten aus dem Graph, kein erzeugter Text',
        gCall: 'Aufruf', gCallVia: 'MCP-Tool · gleiche Antwort per CLI', gCliOnly: 'nur CLI', gCliOnlyT: 'kein MCP-Tool beantwortet dieses Verb', gVerbs: 'Verben', gLive: 'live',
        gFreshPreview: 'Frische · Vorschau', gFreshGroup: 'Frische-Zustand', gFreshNote: 'Der Banner steht über jeder Antwort. Er sagt den Zustand und den Grund – nie nur eine Farbe.',
        gBanner: {
            fresh: ['Index = HEAD.', 'Der Graph steht auf dem Commit; Nachweise werden je Item vor der Nutzung neu gelesen.'],
            stale: ['Der Index liegt hinter dem Arbeitsbaum.', 'Das Pack bleibt nutzbar, weil jedes Item einzeln bestätigt wird. Geänderte Items zuerst neu lesen.'],
            contradicted: ['Fakten widersprechen der Quelle.', 'Graph hier nicht als Wahrheit nutzen – Quelle lesen, dann die Karte neu zeichnen.'],
            unverifiable: ['Quelle nicht lesbar.', 'Items sind nur Hinweise, ihre Bestätigung ist unbekannt.']
        },
        gPreviewOf: function (s) { return 'Vorschau · die Karte ist ' + s; }, gIndexAt: function (c, s) { return 'index ' + c + ' · ' + s; },
        gKpi: { ret: 'returned / total', more: 'hasMore', used: 'Tokens genutzt', attn: 'brauchen Aufmerksamkeit', id: 'Antwort-ID' }, gNoId: 'die Karte speichert keine Antwort-ID für das Pack, das sie trägt',
        gBudget: function (b) { return 'Budget ' + b + ' Tokens'; }, gUsed: function (u, p) { return u + ' genutzt · ' + p; }, gLegend: 'Bestätigung je Item:',
        gCol: { kind: 'Art', item: 'Item', why: 'Warum im Pack', state: 'Zustand', tok: 'Tok.' },
        gMoreYes: function (n) { return 'hasMore: true · ' + n + ' weitere Items über Budget – nach Rang abgeschnitten, nicht verschwiegen'; }, gMoreNo: function (n) { return 'hasMore: false · alle ' + n + ' Items im Budget'; },
        gNextPage: 'Nächste Seite (cursor)', gNoCursor: 'das Pack hat noch kein Blättern per Cursor; ein größeres --budget liefert mehr',
        gNoPack: 'es wurde kein Context-Pack geschrieben: die Karte trägt eines nur für einen Arbeits-Diff; `agent-config code-graph pack "<Aufgabe>"` liefert eines',
        gNoRisk: 'es wurde kein Review-Risiko geschrieben: die Karte wurde ohne Arbeits-Diff gezeichnet', gThresholds: 'Schwellen', gThresholdsT: 'review-risk nennt nur vorläufige Bänder (low / medium / high / unknown), unkalibriert, von keinem Gate gelesen',
        gRiskCol: { term: 'Term', fact: 'Fakt aus dem Graph', calc: 'Rechnung', contrib: 'Beitrag' }, gSum: 'Summe', gFacts: function (n) { return num(n) + (n === 1 ? ' Fakt' : ' Fakten'); },
        gFirst: function (x) { return 'erster: ' + x; }, gWeight: 'Gewicht',
        gRiskNote: 'Gewichte stehen in RISK_WEIGHTS von review_risk.ts. Jeder Term ist ein Fakt mit Nachweis. Es gibt keine versteckten Terme und kein Modell-Urteil. Aufrufer zählen nur belegte Kanten; geratene bleiben draußen. Ein Term mit übersprungener Lane heißt unbekannt und bleibt aus der Summe; ein Term ohne Fakt zählt 0.',
        gIn: 'ein', gOut: 'aus', gGuarantee: 'Garantie', gTodo: 'Was der Agent tun muss', gHow: 'Wie bestätigt wird',
        gHowText: 'Bei jeder Antwort prüft AC je Item den Inhalts-Hash gegen die Datei im Worktree. confirmed: unverändert. moved: gleicher Inhalt, andere Zeile. changed: Inhalt anders, neu lesen. gone: Datei oder Symbol weg, bleibt als Tombstone sichtbar.',
        gTodoBy: {
            confirmed: 'Direkt verwenden.', moved: 'Neue Zeile verwenden. Kein Neulesen nötig.', changed: 'Vor jeder Aussage oder Änderung die Datei neu lesen. Der Ausschnitt im Pack ist veraltet.',
            gone: 'Nicht mehr referenzieren. Alte Imports darauf sind Fehler.', added: 'Neu im Arbeitsbaum, noch nicht im Index: die Datei lesen.', unconfirmed: 'Nur Index-Stand: vor dem Handeln bestätigen.',
            unknown: 'Nur als Hinweis nutzen – Quelle selbst lesen, Bestätigung ist unbekannt.'
        },
        gRow: { why: 'warum', ctx: 'Kontext', hash: 'hash', rank: 'Rang', tokens: 'Tokens', cli: 'CLI', mcp: 'MCP', count: 'Anzahl × Gewicht', contrib: 'Beitrag' },
        gRank: function (i, n) { return i + ' von ' + n; }, gUnknown: 'unbekannt', gProvNo: 'das Pack hält je Item keine Herkunft fest',
        gPickItem: 'Item wählen, um zu sehen, warum es im Pack ist und was damit zu tun ist.', gMeta: function (v) { return v + ' Verben'; }
    }
});

var AG_FRESH = ['fresh', 'stale', 'contradicted', 'unverifiable'];
var AG_FRESH_TONE = { fresh: 'ok', stale: 'warn', contradicted: 'bad', unverifiable: 'dash' };
var AG_STATES = ['confirmed', 'moved', 'changed', 'gone', 'added', 'unconfirmed'];
var agState = { verb: null, fresh: null };

/** The map's own freshness, in the banner's four words. */
function agRealFresh() {
    var st = String((model.pin && model.pin.freshness) || meta.state || '');
    if (st === 'fresh') return 'fresh';
    if (/^behind:/.test(st) || st === 'edited') return 'stale';
    return 'unverifiable';
}
function agItemState(it) { return agState.fresh === 'unverifiable' ? 'unknown' : it.witness.confirm; }
function agStateChip(s) { return s === 'unknown' ? rlSt(t('gUnknown'), 'dash') : confirmChip(s); }

function agBar(p, key, bar) {
    add(bar, viewTabs('agent', key, AREA_MODULES.agent.tabs), el('span', { class: 'mono av-barmeta ag-tagline' }, t('gTagline')));
    bar.classList.add('ag-bar');
}

function agLeft(p, key, left) {
    var pad = el('div', { class: 'ag-pad' });
    var verb = null;
    p.verbs.forEach(function (v) { if (v.name === agState.verb) verb = v; });
    if (!verb) verb = p.verbs.filter(function (v) { return v.name === 'pack'; })[0] || p.verbs[0];
    if (verb) {
        pad.appendChild(add(el('div', { class: 'ag-grp' }), rlCap(t('gCall')), el('div', { class: 'mono ag-call' }, verb.mcp || verb.cli),
            verb.mcp ? add(el('span', { class: 'ag-via' }), document.createTextNode(t('gCallVia') + ' '), el('span', { class: 'mono' }, verb.cli))
                : add(el('span', { class: 'ag-via' }), document.createTextNode(t('gCliOnly') + ' '), rlNd(t('gCliOnlyT')))));
    }
    var vl = add(el('div', { class: 'ag-grp' }), rlCap(t('gVerbs')));
    p.verbs.forEach(function (v) {
        var on = verb && v.name === verb.name;
        var b = el('button', { type: 'button', class: 'ag-verb' + (on ? ' on' : ''), 'aria-pressed': String(!!on) });
        add(b, add(el('span', { class: 'ag-vrow' }), el('span', { class: 'mono ag-vname' }, v.name), rlSt(t('gLive'), 'live')), el('span', { class: 'ag-vshort' }, v.answers));
        b.addEventListener('click', function () {
            agState.verb = v.name;
            avState.view.agent = v.name === 'pack' ? 'pack' : v.name === 'review-risk' ? 'risk' : 'verbs';
            avPick('agent', 'verb/' + v.name);
        });
        vl.appendChild(b);
    });
    pad.appendChild(vl);
    var real = agRealFresh();
    var cur = agState.fresh || real;
    var radios = el('div', { class: 'ag-fresh', role: 'radiogroup', 'aria-label': t('gFreshGroup') });
    AG_FRESH.forEach(function (f) {
        var b = el('button', { type: 'button', role: 'radio', class: 'mono', 'aria-checked': String(cur === f) }, f);
        b.addEventListener('click', function () { agState.fresh = f === real ? null : f; renderAreaPage('agent', current.item); });
        radios.appendChild(b);
    });
    pad.appendChild(add(el('div', { class: 'ag-grp' }), rlCap(t('gFreshPreview')), radios, el('span', { class: 'ag-note' }, t('gFreshNote'))));
    left.appendChild(pad);
}

function agBanner() {
    var real = agRealFresh();
    var cur = agState.fresh || real;
    var st = String((model.pin && model.pin.freshness) || meta.state || 'absent');
    var commit = String((model.pin && model.pin.commit) || meta.commit || '').slice(0, 10);
    var b = el('div', { role: 'status', class: 'ag-banner t-' + cur });
    add(b, rlSt(cur.toUpperCase(), AG_FRESH_TONE[cur]), add(el('span', { class: 'ag-btxt' }), el('b', null, t('gBanner')[cur][0]), document.createTextNode(' '), el('span', { class: 'soft' }, t('gBanner')[cur][1])),
        el('span', { class: 'mono ag-bmeta' }, cur === real ? t('gIndexAt')(commit, st) : t('gPreviewOf')(real)));
    return b;
}

function agPackView(p, key, main) {
    var pk = p.contextPack;
    var kpis = el('div', { class: 'ag-kpis' });
    var attn = 0;
    if (pk) pk.items.forEach(function (it) { var s = agItemState(it); if (s === 'changed' || s === 'gone') attn += 1; });
    [[pk ? num(pk.returned) + ' / ' + num(pk.total) : null, t('gKpi').ret], [pk ? String(pk.hasMore) : null, t('gKpi').more], [pk ? num(pk.usedTokens) : null, t('gKpi').used],
        [pk ? num(attn) : null, t('gKpi').attn], [null, t('gKpi').id, t('gNoId')]].forEach(function (k) {
        kpis.appendChild(add(el('div', { class: 'ag-kpi' }), k[0] === null ? add(el('span', { class: 'mono ag-kv' }, '– '), rlNd(k[2] || t('gNoPack'))) : el('span', { class: 'mono ag-kv' }, k[0]), el('span', { class: 'ag-kl' }, k[1])));
    });
    main.appendChild(kpis);
    var share = pk && pk.budgetTokens ? Math.min(1, pk.usedTokens / pk.budgetTokens) : 0;
    var fill = el('div', { class: 'ag-fill' });
    fill.style.width = (share * 100).toFixed(1) + '%';
    main.appendChild(add(el('div', { class: 'ag-budget' }), add(el('div', { class: 'ag-bl' }), el('span', null, pk ? t('gBudget')(num(pk.budgetTokens)) : t('gBudget')('–')),
        pk ? el('span', null, t('gUsed')(num(pk.usedTokens), pct(share, 0))) : rlNd(t('gNoPack'))), add(el('div', { class: 'ag-track' }), fill)));
    var counts = Object.create(null);
    if (pk) pk.items.forEach(function (it) { var s = agItemState(it); counts[s] = (counts[s] || 0) + 1; });
    var legend = add(el('div', { class: 'ag-legend' }), el('span', null, t('gLegend')));
    AG_STATES.concat(counts.unknown ? ['unknown'] : []).forEach(function (s) {
        if ((s === 'added' || s === 'unconfirmed' || s === 'unknown') && !counts[s]) return;
        var c = agStateChip(s);
        c.textContent += ' · ' + num(counts[s] || 0);
        legend.appendChild(c);
    });
    main.appendChild(legend);
    var tbl = el('div', { class: 'ag-tbl' });
    tbl.appendChild(add(el('div', { class: 'mono ag-prow ag-phead' }), el('span', null, t('gCol').kind), el('span', null, t('gCol').item), el('span', null, t('gCol').why), el('span', null, t('gCol').state), el('span', null, t('gCol').tok)));
    if (!pk) tbl.appendChild(add(el('div', { class: 'ag-pempty' }), rlNd(t('gNoPack')), el('span', { class: 'muted' }, ' ' + t('gNoPack'))));
    else {
        pk.items.slice(0, ROW_CAP).forEach(function (it, i) {
            var s = agItemState(it);
            var on = key === 'pack/' + i;
            var r = el('button', { type: 'button', class: 'mono ag-prow' + (on ? ' on' : ''), 'aria-pressed': String(on) });
            add(r, el('span', { class: 'muted' }, it.kind), add(el('span', { class: 'ag-pitem' }), el('span', { class: 'ag-pname' + (s === 'gone' ? ' gone' : '') }, it.name), el('br'), el('span', { class: 'muted ag-psub' }, wloc(it.witness))),
                el('span', { class: 'soft ag-pwhy' }, it.why), add(el('span', { class: 'ag-pst' }), agStateChip(s)), el('span', { class: 'soft ag-ptok' }, num(it.tokens)));
            r.addEventListener('click', function () { avPick('agent', 'pack/' + i); });
            tbl.appendChild(r);
        });
    }
    var nextB = add(el('button', { type: 'button', class: 'ag-nextpage nodata', disabled: true }, t('gNextPage') + ' '), rlNd(t('gNoCursor')));
    tbl.appendChild(add(el('div', { class: 'ag-pfoot' }), el('span', null, pk ? (pk.hasMore ? t('gMoreYes')(num(pk.total - pk.returned)) : t('gMoreNo')(num(pk.total))) : '–'), nextB));
    main.appendChild(tbl);
}

function agRiskView(p, key, main) {
    var m = KA.impact && !KA.impact.empty ? KA.impact : null;
    var risk = m && m.risk;
    var head = el('div', { class: 'ag-rhead' });
    head.appendChild(el('span', { class: 'mono ag-rcall' }, 'review-risk(--diff ' + (m ? m.rev : 'HEAD') + ')'));
    head.appendChild(risk ? rlSt(num(risk.total), risk.total > 0 ? 'warn' : 'ok') : rlNd(t('gNoRisk')));
    head.appendChild(add(el('span', { class: 'ag-rthr' }, t('gThresholds') + ' '), rlNd(t('gThresholdsT'))));
    main.appendChild(head);
    var tbl = el('div', { class: 'ag-tbl' });
    tbl.appendChild(add(el('div', { class: 'mono ag-rrow ag-rh' }), el('span', null, t('gRiskCol').term), el('span', null, t('gRiskCol').fact), el('span', null, t('gRiskCol').calc), el('span', null, t('gRiskCol').contrib)));
    if (!risk) tbl.appendChild(add(el('div', { class: 'ag-pempty' }), rlNd(t('gNoRisk')), el('span', { class: 'muted' }, ' ' + t('gNoRisk'))));
    else {
        risk.terms.forEach(function (r, i) {
            var first = /\(first: (.*)\)$/.exec(r.fact);
            var on = key === 'risk/' + i;
            var row = el('button', { type: 'button', class: 'mono ag-rrow' + (on ? ' on' : '') });
            add(row, el('span', { class: 'ag-rterm' }, r.term), el('span', { class: 'soft' }, r.count !== undefined ? t('gFacts')(r.count) + (first ? ' · ' + t('gFirst')(first[1]) : '') : r.fact),
                el('span', { class: 'muted' }, r.count !== undefined && r.weight !== undefined ? num(r.count) + ' × ' + num(r.weight) : '–'),
                el('span', { class: 'ag-rv' + (r.contribution > 0 ? ' pos' : ' zero') }, (r.contribution > 0 ? '+' : '') + num(r.contribution)));
            row.addEventListener('click', function () { avPick('agent', 'risk/' + i); });
            tbl.appendChild(row);
        });
        tbl.appendChild(add(el('div', { class: 'mono ag-rsum' }), el('span', null, t('gSum')), el('span', { class: 'ag-rv pos' }, num(risk.total))));
    }
    main.appendChild(tbl);
    main.appendChild(el('div', { class: 'ag-note' }, t('gRiskNote')));
}

function agVerbsView(p, main) {
    var grid = el('div', { class: 'ag-cards' });
    p.verbs.forEach(function (v) {
        var on = agState.verb === v.name;
        var c = el('button', { type: 'button', class: 'ag-card' + (on ? ' on' : '') });
        add(c, add(el('div', { class: 'ag-vrow' }), el('span', { class: 'mono ag-cname' }, v.name), rlSt(t('gLive'), 'live')), el('span', { class: 'soft ag-clong' }, v.answers),
            add(el('div', { class: 'mono ag-ckv' }), el('span', { class: 'muted' }, t('gIn')), el('span', null, v.input || '–'), el('span', { class: 'muted' }, t('gOut')), el('span', null, v.output || '–'),
                el('span', { class: 'muted' }, t('gGuarantee')), el('span', { class: 'ag-cg' }, v.guarantee || '–')));
        c.addEventListener('click', function () { agState.verb = v.name; avPick('agent', 'verb/' + v.name); });
        grid.appendChild(c);
    });
    main.appendChild(grid);
}

function agRight(p, key, right) {
    var pad = el('div', { class: 'ag-pad ag-rpad' });
    var pk = p.contextPack;
    var m;
    var kind;
    var prov;
    var name;
    var text;
    var state = null;
    var rows = [];
    if (key && (m = /^pack\/(\d+)$/.exec(key)) && pk && pk.items[Number(m[1])]) {
        var i = Number(m[1]);
        var it = pk.items[i];
        kind = it.kind; prov = it.witness.rung || null; name = it.name; text = it.why; state = agItemState(it);
        rows = [[t('gRow').why, it.why], [t('gRow').ctx, wloc(it.witness)], [t('gRow').hash, '#' + String(it.witness.hash).slice(0, 8)], [t('gRow').rank, t('gRank')(num(i + 1), num(pk.total))], [t('gRow').tokens, num(it.tokens)]];
    } else if (key && (m = /^risk\/(\d+)$/.exec(key)) && KA.impact && KA.impact.risk && KA.impact.risk.terms[Number(m[1])]) {
        var r = KA.impact.risk.terms[Number(m[1])];
        kind = 'risk term'; prov = 'review-risk'; name = r.term; text = r.fact;
        rows = [[t('gRow').count, r.count !== undefined ? num(r.count) + ' × ' + num(r.weight) : '–'], [t('gRow').contrib, num(r.contribution)], [t('gRow').ctx, r.witness ? wloc(r.witness) : '–']];
    } else {
        var vname = key && (m = /^verb\/(.+)$/.exec(key)) ? m[1] : null;
        var v = p.verbs.filter(function (x) { return x.name === (vname || agState.verb); })[0] || p.verbs.filter(function (x) { return x.name === 'pack'; })[0];
        if (!v) { pad.appendChild(el('span', { class: 'soft' }, t('gPickItem'))); right.appendChild(pad); return; }
        kind = 'verb'; prov = 'cli'; name = v.name; text = v.answers;
        rows = [[t('gIn'), v.input], [t('gOut'), v.output], [t('gGuarantee'), v.guarantee], [t('gRow').cli, v.cli], [t('gRow').mcp, v.mcp || t('gCliOnly')]];
    }
    pad.appendChild(add(el('div', { class: 'between' }), add(el('span', { class: 'mono ag-kick' }), document.createTextNode(kind + ' · '), prov ? document.createTextNode(prov) : rlNd(t('gProvNo'))),
        state ? agStateChip(state) : rlSt(t('gLive'), 'live')));
    pad.appendChild(el('span', { class: 'mono ag-iname' + (state === 'gone' ? ' gone' : '') }, name));
    pad.appendChild(el('span', { class: 'soft ag-itext' }, text));
    var kv = el('div', { class: 'mono ag-ikv' });
    rows.forEach(function (r) { if (r[1] != null && r[1] !== '') add(kv, el('span', { class: 'muted' }, r[0]), el('span', null, String(r[1]))); });
    pad.appendChild(kv);
    if (state) {
        var tone = { confirmed: 'green', moved: 'cyan', changed: 'amber', gone: 'red', added: 'violet', unconfirmed: 'amber', unknown: 'cyan' }[state] || 'cyan';
        pad.appendChild(add(el('div', { class: 'ag-todo t-' + tone }), el('span', { class: 'cap' }, t('gTodo')), el('span', null, t('gTodoBy')[state])));
    }
    pad.appendChild(add(el('div', { class: 'ag-how' }), rlCap(t('gHow')), el('span', null, t('gHowText'))));
    right.appendChild(pad);
}

AREA_MODULES.agent = {
    tabs: [['pack', 'gPack'], ['risk', 'gRisk'], ['verbs', 'gVerbsTab']],
    railTitles: ['gRequest', 'gItem'],
    ownsBar: true,
    items: function (p) {
        var out = p.verbs.map(function (v) {
            return { key: 'verb/' + v.name, kind: 'verb', label: v.name, sub: v.answers, rows: [[t('gRow').cli, v.cli], [t('gRow').mcp, v.mcp]], witnesses: [] };
        });
        ((p.contextPack && p.contextPack.items) || []).forEach(function (it, i) {
            out.push({ key: 'pack/' + i, kind: it.kind, label: it.name, sub: it.why, rows: [[t('gRow').why, it.why], [t('gRow').tokens, num(it.tokens)]], witnesses: [it.witness] });
        });
        return out;
    },
    meta: function (p) { return t('gMeta')(num(p.verbs.length)); },
    page: function (p, view, key, host) {
        var m = key ? /^verb\/(.+)$/.exec(key) : null;
        if (m) agState.verb = m[1];
        // Like the handover, the pack opens with an item in the rail: the first that needs attention, else the first.
        var urlKey = key;
        if (!key && p.contextPack && p.contextPack.items.length) {
            var its = p.contextPack.items;
            var pick = its.filter(function (x) { var s = agItemState(x); return s === 'changed' || s === 'gone'; })[0] || its[0];
            key = 'pack/' + its.indexOf(pick);
        }
        agBar(p, urlKey, host.bar);
        agLeft(p, key, host.left);
        host.main.classList.add('ag-main');
        host.main.appendChild(agBanner());
        if (view === 'risk') agRiskView(p, key, host.main);
        else if (view === 'verbs') agVerbsView(p, host.main);
        else agPackView(p, key, host.main);
        agRight(p, key, host.right);
    }
};
