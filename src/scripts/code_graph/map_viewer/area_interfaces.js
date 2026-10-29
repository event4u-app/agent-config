/*
 * Interfaces: the services the code calls, listed in the left rail with their
 * protocols; their operations, the flow from a call site to the operation and
 * the findings against a contract in the centre; the picked operation with its
 * parameters, callers and findings in the right rail. A configuration value
 * never reaches the map, only its name; nothing here is fetched.
 */
extendStrings({
    en: {
        iServices: 'Services', iOperation: 'Operation', iOperations: 'Operations', iFlow: 'Flow', iDiff: 'Contract change', iProtocols: 'Protocols',
        iSvcCount: function (n, m) { return 'Services · ' + n + ' of ' + m + ' shown'; }, iAll: 'all', iNone: 'none', iFilter: 'Filter services …', iFilterL: 'Filter services', iList: 'List',
        iModes: { all: 'All', find: 'Finding', shown: 'Shown', soap: 'SOAP' }, iNoMatch: 'No service matches the filter.',
        iRules: 'Rules', iRule1: 'No call to an outside service, no .env value. Only call sites, contracts in the repository and configuration names.',
        iRule2: 'The same field name is no connection — only a mapper, serializer or ORM witness is.',
        iMeta: function (o, u) { return o + ' operations · ' + u + ' without a caller'; }, iShown: 'Shown:', iHide: function (s) { return 'hide ' + s; },
        iHidden: function (o, s) { return o + ' operations from ' + s + ' services hidden'; }, iNoneShown: 'No service shown – tick services on the left.',
        iOpsMeta: function (o, c) { return o + ' op. · ' + c + ' call.'; }, iFindN: function (n) { return n + (n === 1 ? ' finding' : ' findings'); },
        iColOp: 'Operation', iColContract: 'Contract', iColCallers: 'Callers', iColState: 'State',
        iProtoRead: 'read', iProtoNone: 'none', iProtoNoneT: 'the reader looks for it; none is in this tree',
        iState: { breaking: 'breaking-risk', review: 'needs-review', uncalled: 'no caller' },
        iFlowIntro: 'From the call in the code to the database column. Each edge says how AC knows it – an edge without a witness stays open.',
        iFlowCode: 'Code', iFlowCall: function (p) { return p.toUpperCase() + ' call'; }, iFlowOp: 'Operation', iFlowDto: 'DTO', iFlowMapper: 'Mapper', iFlowColumn: 'Column',
        iFlowNoContract: 'no contract found', iFlowNoCaller: 'no call site in this tree', iFlowBeyond: 'the interfaces reader does not follow a response into DTOs, mappers or columns yet',
        iEdge: { declared: 'from the contract', parsed: 'from the code (AST)', unresolved: 'dynamic, no witness' },
        iDiffOne: 'one version in the tree', iDiffOneT: 'no second version of the contract is in the tree to compare against',
        iDiffAt: function (f) { return 'in the repository at ' + f; }, iDiffNone: 'No finding against a contract.', iNoContractSvc: 'This service has no contract in the tree.',
        iParams: 'Parameters', iCallers: 'Callers', iFindings: 'Findings', iNoFind: 'No findings for this operation.', iRequired: 'required', iOptional: 'optional',
        iKv: { dir: 'direction', proto: 'protocol', contract: 'contract', auth: 'auth', retry: 'timeout · retry', hosts: 'hosts', config: 'configuration' },
        iNoAuth: 'the reader records no auth scheme name yet', iNoRetry: 'the reader records no timeout or retry setting yet',
        iDir: { outbound: 'outbound', inbound: 'inbound' }, iRescan: 'Search usages again', iOpenContract: 'Open contract',
        iOpenNo: 'the page can open a repository file only when it lies at agents/map/ of that repository', iOpsOf: 'Operations',
        iPickOp: 'Pick an operation to see its parameters, callers and findings.'
    },
    de: {
        iServices: 'Dienste', iOperation: 'Operation', iOperations: 'Operationen', iFlow: 'Fluss', iDiff: 'Vertragsänderung', iProtocols: 'Protokolle',
        iSvcCount: function (n, m) { return 'Dienste · ' + n + ' von ' + m + ' angezeigt'; }, iAll: 'alle', iNone: 'keine', iFilter: 'Dienst filtern …', iFilterL: 'Dienste filtern', iList: 'Liste',
        iModes: { all: 'Alle', find: 'Befund', shown: 'Aktiv', soap: 'SOAP' }, iNoMatch: 'Kein Dienst passt zum Filter.',
        iRules: 'Regeln', iRule1: 'Kein Abruf fremder Dienste, keine .env-Werte. Nur Aufrufstellen, Verträge im Repo und Konfigurations-Namen.',
        iRule2: 'Gleicher Feldname ist keine Verbindung – nur Mapper-, Serializer- oder ORM-Beleg.',
        iMeta: function (o, u) { return o + ' Operationen · ' + u + ' ohne Aufrufer'; }, iShown: 'Angezeigt:', iHide: function (s) { return s + ' ausblenden'; },
        iHidden: function (o, s) { return o + ' Operationen aus ' + s + ' Diensten ausgeblendet'; }, iNoneShown: 'Kein Dienst aktiv – links Dienste anhaken.',
        iOpsMeta: function (o, c) { return o + ' Op. · ' + c + ' Aufr.'; }, iFindN: function (n) { return n + (n === 1 ? ' Befund' : ' Befunde'); },
        iColOp: 'Operation', iColContract: 'Vertrag', iColCallers: 'Aufrufer', iColState: 'Zustand',
        iProtoRead: 'gelesen', iProtoNone: 'keine', iProtoNoneT: 'der Leser sucht danach; in diesem Baum gibt es keine',
        iState: { breaking: 'breaking-risk', review: 'needs-review', uncalled: 'kein Aufruf' },
        iFlowIntro: 'Vom Aufruf im Code bis zur Datenbank-Spalte. Jede Kante zeigt, woher AC sie kennt – unbelegte Kanten bleiben offen.',
        iFlowCode: 'Code', iFlowCall: function (p) { return p.toUpperCase() + '-Aufruf'; }, iFlowOp: 'Operation', iFlowDto: 'DTO', iFlowMapper: 'Mapper', iFlowColumn: 'Spalte',
        iFlowNoContract: 'kein Vertrag gefunden', iFlowNoCaller: 'keine Aufrufstelle in diesem Baum', iFlowBeyond: 'der Schnittstellen-Leser verfolgt eine Antwort noch nicht in DTOs, Mapper oder Spalten',
        iEdge: { declared: 'aus Vertrag', parsed: 'aus Code (AST)', unresolved: 'dynamisch, nicht belegt' },
        iDiffOne: 'eine Fassung im Baum', iDiffOneT: 'im Baum liegt keine zweite Fassung des Vertrags zum Vergleich',
        iDiffAt: function (f) { return 'im Repo unter ' + f; }, iDiffNone: 'Kein Befund gegen einen Vertrag.', iNoContractSvc: 'Für diesen Dienst liegt kein Vertrag im Baum.',
        iParams: 'Parameter', iCallers: 'Aufrufer', iFindings: 'Befunde', iNoFind: 'Keine Befunde für diese Operation.', iRequired: 'pflicht', iOptional: 'optional',
        iKv: { dir: 'richtung', proto: 'protokoll', contract: 'vertrag', auth: 'auth', retry: 'timeout · retry', hosts: 'hosts', config: 'konfiguration' },
        iNoAuth: 'der Leser hält noch keinen Namen eines Auth-Verfahrens fest', iNoRetry: 'der Leser hält noch keine Timeout- oder Retry-Einstellung fest',
        iDir: { outbound: 'outbound', inbound: 'inbound' }, iRescan: 'Verwendungen neu suchen', iOpenContract: 'Vertrag öffnen',
        iOpenNo: 'die Seite kann eine Repo-Datei nur öffnen, wenn sie unter agents/map/ dieses Repos liegt', iOpsOf: 'Operationen',
        iPickOp: 'Operation wählen, um Parameter, Aufrufer und Befunde zu sehen.'
    }
});

var IF_PROTOCOLS = [['rest', 'REST · OpenAPI'], ['soap', 'SOAP · WSDL'], ['sdk', 'SDK'], ['graphql', 'GraphQL'], ['grpc', 'gRPC · proto'], ['webhook', 'Webhooks · Queues']];
var IF_PROTO_SHORT = { rest: 'REST', soap: 'SOAP', sdk: 'SDK', graphql: 'GraphQL', grpc: 'gRPC', webhook: 'Webhook', unknown: '?' };
var ifState = { q: '', mode: 'all', hidden: Object.create(null) };
// The 2026-10-bf handover opens a real map on Operationen and its demo data on the flow of the picked operation.
if (!avState.view.interfaces) avState.view.interfaces = meta.demo ? 'flow' : 'ops';

function ifOpKey(s, o) { return 'operation/' + s.name + '/' + o.name; }
function ifEndsWith(s, end) { return s.length >= end.length && s.lastIndexOf(end) === s.length - end.length; }
/** Findings that name the operation as their subject, in payload order with their index. */
function ifOpFindings(p, s, o) {
    var id = 'operation:' + s.name + ':' + o.name;
    var out = [];
    p.findings.forEach(function (f, i) { if (ifEndsWith(f.subject, id)) out.push([f, i]); });
    return out;
}
function ifSvcFindings(p, s) {
    var n = 0;
    s.operations.forEach(function (o) { n += ifOpFindings(p, s, o).length; });
    p.findings.forEach(function (f) { if (f.subject === 'service:' + s.name || ifEndsWith(f.subject, 'service:' + s.name)) n += 1; });
    return n;
}
/** The operation's state: the worst finding about it, else whether anything calls it, else its witness's confirm state. */
function ifOpState(p, s, o) {
    var fs = ifOpFindings(p, s, o);
    if (fs.some(function (fi) { return fi[0].severity === 'high'; })) return rlSt(t('iState').breaking, 'bad');
    if (fs.length) return rlSt(t('iState').review, 'rev');
    if (!o.callers.length) return rlSt(t('iState').uncalled, 'dash');
    return confirmChip(o.witness.confirm);
}
function ifContractName(o) { return o.contract ? base(o.contract.file) : '–'; }
function ifSevTone(sev) { return sev === 'high' ? 'bad' : sev === 'info' ? 'cyan' : sev === 'low' ? 'dash' : 'rev'; }

/** Which item the rail shows: the one in the URL, else the first operation on screen. */
function ifPicked(p, key, ops) {
    var m;
    if (key && (m = /^operation\/([^/]+)\/(.+)$/.exec(key))) {
        for (var i = 0; i < p.services.length; i++) {
            var s = p.services[i];
            if (s.name !== m[1]) continue;
            for (var j = 0; j < s.operations.length; j++) if (s.operations[j].name === m[2]) return { s: s, o: s.operations[j] };
        }
    }
    if (key && (m = /^service\/(.+)$/.exec(key))) {
        for (var k = 0; k < p.services.length; k++) if (p.services[k].name === m[1]) return { s: p.services[k], o: null };
    }
    if (key && (m = /^finding\/(\d+)$/.exec(key))) {
        var f = p.findings[Number(m[1])];
        if (f) {
            var hit = null;
            p.services.forEach(function (s) { s.operations.forEach(function (o) { if (!hit && ifEndsWith(f.subject, 'operation:' + s.name + ':' + o.name)) hit = { s: s, o: o }; }); });
            return hit ? { s: hit.s, o: hit.o, f: Number(m[1]) } : { s: null, o: null, f: Number(m[1]) };
        }
    }
    return ops.length ? { s: ops[0].s, o: ops[0].o } : null;
}

function ifLeft(p, key, left) {
    var pad = el('div', { class: 'if-pad' });
    var protos = add(el('div', { class: 'if-grp' }), rlCap(t('iProtocols')));
    var grid = el('div', { class: 'mono if-protos' });
    var counts = Object.create(null);
    p.services.forEach(function (s) { counts[s.protocol] = (counts[s.protocol] || 0) + s.operations.length; });
    IF_PROTOCOLS.concat(counts.unknown ? [['unknown', '?']] : []).forEach(function (pr) {
        var n = counts[pr[0]] || 0;
        var has = p.services.some(function (s) { return s.protocol === pr[0]; });
        add(grid, el('span', { class: has ? '' : 'muted' }, pr[1]), el('span', { class: has ? '' : 'muted' }, has ? num(n) : '–'),
            has ? rlSt(t('iProtoRead'), 'ok') : rlSt(t('iProtoNone'), 'dash', t('iProtoNoneT')));
    });
    pad.appendChild(add(protos, grid));

    var svc = el('div', { class: 'if-grp if-svcs' });
    var shown = p.services.filter(function (s) { return !ifState.hidden[s.name]; }).length;
    var allB = el('button', { type: 'button', class: 'rl-mini' }, t('iAll'));
    allB.addEventListener('click', function () { ifState.hidden = Object.create(null); renderAreaPage('interfaces', current.item); });
    var noneB = el('button', { type: 'button', class: 'rl-mini' }, t('iNone'));
    noneB.addEventListener('click', function () { p.services.forEach(function (s) { ifState.hidden[s.name] = true; }); renderAreaPage('interfaces', current.item); });
    svc.appendChild(add(el('div', { class: 'between' }), rlCap(t('iSvcCount')(num(shown), num(p.services.length))), add(el('span', { class: 'if-minis' }), allB, noneB)));
    var q = el('input', { type: 'search', class: 'if-q', 'aria-label': t('iFilterL'), placeholder: t('iFilter') });
    q.value = ifState.q;
    var list = el('div', { class: 'if-list' });
    q.addEventListener('input', function () { ifState.q = q.value; fillList(); });
    var modes = el('div', { class: 'if-modes', role: 'radiogroup', 'aria-label': t('iList') });
    ['all', 'find', 'shown', 'soap'].forEach(function (m) {
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(ifState.mode === m) }, t('iModes')[m]);
        b.addEventListener('click', function () { ifState.mode = m; renderAreaPage('interfaces', current.item); });
        modes.appendChild(b);
    });
    function fillList() {
        clear(list);
        var ql = ifState.q.toLowerCase();
        var vis = p.services.filter(function (s) {
            if (ql && (s.name + ' ' + (IF_PROTO_SHORT[s.protocol] || s.protocol)).toLowerCase().indexOf(ql) < 0) return false;
            if (ifState.mode === 'find') return ifSvcFindings(p, s) > 0;
            if (ifState.mode === 'shown') return !ifState.hidden[s.name];
            if (ifState.mode === 'soap') return s.protocol === 'soap';
            return true;
        });
        vis.forEach(function (s) {
            var on = !ifState.hidden[s.name];
            var calls = 0;
            s.operations.forEach(function (o) { calls += o.callers.length; });
            var nf = ifSvcFindings(p, s);
            var b = el('button', { type: 'button', role: 'checkbox', class: 'if-svc' + (on ? ' on' : ''), 'aria-checked': String(on) });
            var info = add(el('span', { class: 'if-svc-info' }),
                add(el('span', { class: 'if-svc-row' }), el('span', { class: 'if-svc-name' }, s.name), rlSt(IF_PROTO_SHORT[s.protocol] || s.protocol, 'line')),
                add(el('span', { class: 'if-svc-row' }), el('span', { class: 'mono if-svc-meta' }, t('iOpsMeta')(num(s.operations.length), num(calls))), nf ? rlSt(t('iFindN')(nf), 'warn') : null));
            add(b, el('span', { class: 'if-tick', 'aria-hidden': 'true' }, on ? '✓' : ''), info);
            b.addEventListener('click', function () {
                if (ifState.hidden[s.name]) delete ifState.hidden[s.name]; else ifState.hidden[s.name] = true;
                renderAreaPage('interfaces', current.item);
            });
            list.appendChild(b);
        });
        if (!vis.length) list.appendChild(el('span', { class: 'if-nomatch' }, t('iNoMatch')));
    }
    fillList();
    add(svc, q, modes, list);
    pad.appendChild(svc);
    pad.appendChild(add(el('div', { class: 'if-grp if-rules' }), rlCap(t('iRules')), el('span', null, t('iRule1')), el('span', null, t('iRule2'))));
    left.appendChild(pad);
}

function ifOpsView(p, ops, sel, main) {
    var chips = add(el('div', { class: 'if-chips' }), el('span', null, t('iShown')));
    var hiddenOps = 0;
    var hiddenSvc = 0;
    p.services.forEach(function (s) {
        if (ifState.hidden[s.name]) { hiddenSvc += 1; hiddenOps += s.operations.length; return; }
        var c = el('button', { type: 'button', class: 'mono if-chip', 'aria-label': t('iHide')(s.name) });
        add(c, document.createTextNode(s.name + ' '), el('span', { 'aria-hidden': 'true' }, '×'));
        c.addEventListener('click', function () { ifState.hidden[s.name] = true; renderAreaPage('interfaces', current.item); });
        chips.appendChild(c);
    });
    chips.appendChild(el('span', null, hiddenSvc < p.services.length ? (hiddenSvc ? t('iHidden')(num(hiddenOps), num(hiddenSvc)) : '') : t('iNoneShown')));
    main.appendChild(chips);
    var tbl = el('div', { class: 'if-tbl' });
    tbl.appendChild(add(el('div', { class: 'mono if-orow if-ohead' }), el('span'), el('span', null, t('iColOp')), el('span', null, t('iColContract')), el('span', null, t('iColCallers')), el('span', null, t('iColState'))));
    ops.slice(0, ROW_CAP).forEach(function (so) {
        var on = !!(sel && sel.o === so.o);
        var b = el('button', { type: 'button', class: 'mono if-orow' + (on ? ' on' : ''), 'aria-pressed': String(on) });
        add(b, el('span', { class: 'muted' }, so.s.direction === 'inbound' ? '↙' : '↗'),
            add(el('span', { class: 'if-opcell' }), el('b', null, so.o.name), el('br'), el('span', { class: 'muted' }, so.s.name)),
            el('span', { class: 'soft if-ctr' }, ifContractName(so.o)), el('span', null, num(so.o.callers.length)),
            add(el('span', { class: 'if-stcell' }), ifOpState(p, so.s, so.o)));
        b.addEventListener('click', function () { avPick('interfaces', ifOpKey(so.s, so.o)); });
        tbl.appendChild(b);
    });
    main.appendChild(tbl);
    if (ops.length > ROW_CAP) main.appendChild(el('span', { class: 'note-line' }, t('moreRows')(num(ops.length - ROW_CAP))));
}

function ifFlowView(p, sel, main) {
    var wrap = add(el('div', { class: 'if-flowwrap' }), el('div', { class: 'if-intro' }, t('iFlowIntro')));
    if (!sel || !sel.o) { wrap.appendChild(el('span', { class: 'if-nomatch' }, t('iPickOp'))); main.appendChild(wrap); return; }
    var s = sel.s;
    var o = sel.o;
    var caller = o.callers[0];
    var nodes = [
        [t('iFlowCode'), caller ? base(caller.file) : '–', caller ? wloc(caller) : t('iFlowNoCaller'), 'brand', caller ? 'parsed' : null],
        [t('iFlowCall')(IF_PROTO_SHORT[s.protocol] || 'HTTP'), [o.method, o.path].filter(Boolean).join(' ') || o.name, caller ? base(caller.file) + ':' + caller.line : '–', null, o.contract ? 'declared' : 'unresolved'],
        [t('iFlowOp'), s.name + ':' + o.name, o.contract ? base(o.contract.file) + ':' + o.contract.line : t('iFlowNoContract'), o.contract ? null : 'amber', 'none'],
        [t('iFlowDto'), null, null, null, 'none'],
        [t('iFlowMapper'), null, null, null, 'none'],
        [t('iFlowColumn'), null, null, 'cyan', null]
    ];
    var chain = el('div', { class: 'if-chain' });
    nodes.forEach(function (n, i) {
        var box = el('div', { class: 'if-node' + (n[3] ? ' acc-' + n[3] : '') + (n[1] === null ? ' nodata' : '') });
        add(box, el('span', { class: 'cap' }, n[0]), el('span', { class: 'mono if-nname' }, n[1] === null ? '–' : n[1]), n[1] === null ? rlNd(t('iFlowBeyond')) : el('span', { class: 'mono if-nloc' }, n[2]));
        var step = add(el('div', { class: 'if-step' }), box);
        if (i < nodes.length - 1) {
            var edge = n[4];
            var arrow = el('div', { class: 'if-arrow' });
            add(arrow, el('span', { class: 'if-line' + (edge === 'unresolved' || edge === 'none' ? ' dash' : '') }),
                edge === 'none' ? rlNd(t('iFlowBeyond')) : edge ? rlSt(edge, edge === 'declared' ? 'cyan' : edge === 'parsed' ? 'line' : 'udash') : null);
            step.appendChild(arrow);
        }
        chain.appendChild(step);
    });
    wrap.appendChild(chain);
    wrap.appendChild(add(el('div', { class: 'if-legend' }),
        add(el('span'), rlSt('declared', 'cyan'), document.createTextNode(' ' + t('iEdge').declared)),
        add(el('span'), rlSt('parsed', 'line'), document.createTextNode(' ' + t('iEdge').parsed)),
        add(el('span'), rlSt('unresolved', 'udash'), document.createTextNode(' ' + t('iEdge').unresolved))));
    main.appendChild(wrap);
}

function ifDiffView(p, sel, main) {
    var wrap = el('div', { class: 'if-diff' });
    var svc = sel && sel.s;
    var contracts = (svc && svc.contracts) || [];
    if (!contracts.length) {
        p.services.forEach(function (s) { (s.contracts || []).forEach(function (c) { if (contracts.indexOf(c) < 0) contracts.push(c); }); });
    }
    if (!contracts.length) wrap.appendChild(el('span', { class: 'if-nomatch' }, t('iNoContractSvc')));
    contracts.forEach(function (c) {
        wrap.appendChild(add(el('div', { class: 'if-diffhead' }), el('span', { class: 'mono' }, base(c)), rlSt(t('iDiffOne'), 'line'), el('span', { class: 'muted' }, '→'), rlNd(t('iDiffOneT')),
            el('span', { class: 'muted' }, t('iDiffAt')(dir(c) + '/'))));
    });
    var rows = [];
    p.findings.forEach(function (f, i) {
        if ((f.witnesses || []).some(function (w) { return contracts.indexOf(w.file) >= 0; })) rows.push([f, i]);
    });
    rows.forEach(function (fi) {
        var f = fi[0];
        var r = el('button', { type: 'button', class: 'if-drow' + (current.item === 'finding/' + fi[1] ? ' on' : '') });
        add(r, rlSt(t('sevNames')[f.severity] || f.severity, ifSevTone(f.severity)),
            add(el('div', { class: 'if-dwhat' }), el('span', { class: 'mono' }, f.message), el('span', { class: 'soft' }, f.subject)),
            el('span', { class: 'mono muted' }, f.id));
        r.addEventListener('click', function () { avPick('interfaces', 'finding/' + fi[1]); });
        wrap.appendChild(r);
    });
    if (contracts.length && !rows.length) wrap.appendChild(el('span', { class: 'if-nomatch' }, t('iDiffNone')));
    main.appendChild(wrap);
}

function ifRight(p, sel, right) {
    var pad = el('div', { class: 'if-pad if-rpad' });
    if (!sel || (!sel.s && sel.f === undefined)) { pad.appendChild(el('span', { class: 'soft' }, t('iPickOp'))); right.appendChild(pad); return; }
    if (!sel.s) {
        var lone = p.findings[sel.f];
        pad.appendChild(ifFindCard(lone, sel.f, true));
        if (lone.witnesses.length) pad.appendChild(add(el('div', { class: 'if-grp' }), rlCap(t('witnesses')), witnessList(lone.witnesses)));
        right.appendChild(pad);
        return;
    }
    var s = sel.s;
    var o = sel.o;
    var head = add(el('div', { class: 'between if-rhead' }),
        add(el('div', { class: 'if-rtitle' }), el('span', { class: 'mono muted' }, (t('iDir')[s.direction] || s.direction) + ' · ' + s.name), el('span', { class: 'mono if-opname' }, o ? o.name : s.name)),
        o ? ifOpState(p, s, o) : rlSt(IF_PROTO_SHORT[s.protocol] || s.protocol, 'line'));
    pad.appendChild(head);
    var kv = el('div', { class: 'mono if-kv' });
    function row(k, v) { add(kv, el('span', { class: 'muted' }, k), typeof v === 'string' ? el('span', null, v) : v); }
    row(t('iKv').dir, t('iDir')[s.direction] || s.direction);
    row(t('iKv').proto, IF_PROTO_SHORT[s.protocol] || s.protocol);
    row(t('iKv').contract, o ? (o.contract ? wloc(o.contract) : (s.contracts || []).join(', ') || '–') : (s.contracts || []).join(', ') || '–');
    if (!o && s.hosts && s.hosts.length) row(t('iKv').hosts, s.hosts.join(', '));
    if (s.configNames.length) row(t('iKv').config, s.configNames.join(', '));
    row(t('iKv').auth, rlNd(t('iNoAuth')));
    row(t('iKv').retry, rlNd(t('iNoRetry')));
    pad.appendChild(kv);
    if (!o) {
        var ol = add(el('div', { class: 'if-grp' }), rlCap(t('iOpsOf')));
        s.operations.forEach(function (x) {
            var b = el('button', { type: 'button', class: 'mono if-param if-oplink' });
            add(b, el('span', null, x.name), el('span', { class: 'muted' }, num(x.callers.length)), ifOpState(p, s, x));
            b.addEventListener('click', function () { avPick('interfaces', ifOpKey(s, x)); });
            ol.appendChild(b);
        });
        pad.appendChild(ol);
    } else {
        var pl = add(el('div', { class: 'if-grp' }), rlCap(t('iParams')));
        o.params.forEach(function (x) {
            pl.appendChild(add(el('div', { class: 'mono if-param' }), el('span', null, x.name), el('span', { class: 'muted' }, x.type || '–'),
                el('span', { class: x.required ? 'soft' : 'muted' }, x.required ? t('iRequired') : t('iOptional'))));
        });
        if (!o.params.length) pl.appendChild(el('span', { class: 'if-nomatch' }, t('none')));
        pad.appendChild(pl);
        var cl = add(el('div', { class: 'if-grp' }), rlCap(t('iCallers')));
        o.callers.forEach(function (w) { cl.appendChild(add(el('div', { class: 'mono if-caller' }), el('span', { title: '#' + w.hash }, wloc(w)), confirmChip(w.confirm))); });
        if (!o.callers.length) cl.appendChild(el('span', { class: 'if-nomatch' }, t('iFlowNoCaller')));
        pad.appendChild(cl);
    }
    var fl = add(el('div', { class: 'if-grp' }), rlCap(t('iFindings')));
    var fs = o ? ifOpFindings(p, s, o) : [];
    if (sel.f !== undefined && !fs.some(function (fi) { return fi[1] === sel.f; })) fs.unshift([p.findings[sel.f], sel.f]);
    fs.forEach(function (fi) { fl.appendChild(ifFindCard(fi[0], fi[1], sel.f === fi[1])); });
    if (!fs.length) fl.appendChild(add(el('div', { class: 'if-find' }), add(el('div', { class: 'between' }), el('span', { class: 'mono if-fid' }, '–'), rlSt(t('iNone'), 'ok')), el('span', { class: 'soft' }, t('iNoFind'))));
    pad.appendChild(fl);
    var acts = el('div', { class: 'if-acts' });
    acts.appendChild(rlCopy(t('iRescan'), 'agent-config code-graph confirm "' + (o ? 'operation:' + s.name + ':' + o.name : 'service:' + s.name) + '"', 'rl-btn brand'));
    var ctr = o && o.contract ? o.contract.file : (s.contracts || [])[0];
    var href = ctr ? rlRepoHref(ctr) : null;
    if (href) acts.appendChild(el('a', { class: 'rl-btn', href: href, target: '_blank', rel: 'noopener' }, t('iOpenContract')));
    else acts.appendChild(add(el('button', { type: 'button', class: 'rl-btn nodata', disabled: true }, t('iOpenContract') + ' '), rlNd(ctr ? t('iOpenNo') : t('iNoContractSvc'))));
    pad.appendChild(acts);
    right.appendChild(pad);
}

function ifFindCard(f, i, on) {
    var c = el('button', { type: 'button', class: 'if-find' + (on ? ' on' : '') });
    add(c, add(el('div', { class: 'between' }), el('span', { class: 'mono if-fid' }, f.id), rlSt(t('sevNames')[f.severity] || f.severity, ifSevTone(f.severity))), el('span', { class: 'soft' }, f.message));
    c.addEventListener('click', function () { avPick('interfaces', 'finding/' + i); });
    return c;
}

AREA_MODULES.interfaces = {
    tabs: [['ops', 'iOperations'], ['flow', 'iFlow'], ['diff', 'iDiff']],
    railTitles: ['iServices', 'iOperation'],
    items: function (p) {
        var out = [];
        p.services.forEach(function (s) {
            out.push({ key: 'service/' + s.name, kind: 'service · ' + s.protocol, label: s.name, sub: s.configNames.join(', '),
                rows: [[t('iKv').proto, s.protocol], [t('iKv').dir, s.direction], [t('iKv').config, s.configNames.join(', ')], [t('iOperations'), num(s.operations.length)]],
                witnesses: [s.witness] });
            s.operations.forEach(function (o) {
                out.push({ key: ifOpKey(s, o), kind: 'operation', label: s.name + ' · ' + o.name, sub: [o.method, o.path].filter(Boolean).join(' '),
                    rows: [[t('iKv').contract, o.contract ? wloc(o.contract) : '–'], [t('iCallers'), num(o.callers.length)]],
                    witnesses: [o.witness].concat(o.contract ? [o.contract] : [], o.callers) });
            });
        });
        return out;
    },
    meta: function (p) {
        var ops = 0;
        var idle = 0;
        p.services.forEach(function (s) { ops += s.operations.length; s.operations.forEach(function (o) { if (!o.callers.length) idle += 1; }); });
        return t('iMeta')(num(ops), num(idle));
    },
    page: function (p, view, key, host) {
        ifLeft(p, key, host.left);
        var ops = [];
        p.services.forEach(function (s) { if (!ifState.hidden[s.name]) s.operations.forEach(function (o) { ops.push({ s: s, o: o }); }); });
        var sel = ifPicked(p, key, ops);
        var centre = host.main.parentNode;
        if (centre) centre.classList.add('if-host');
        host.main.classList.add('if-body');
        if (view === 'flow') ifFlowView(p, sel, host.main);
        else if (view === 'diff') ifDiffView(p, sel, host.main);
        else ifOpsView(p, ops, sel, host.main);
        ifRight(p, sel, host.right);
    }
};
