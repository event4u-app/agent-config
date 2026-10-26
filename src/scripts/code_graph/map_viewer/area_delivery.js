/*
 * Delivery — the design's Umgebung & CI/CD page. The local environment is the
 * Compose services the Runtime reader stored (shown here, kept in the Runtime
 * payload); CI/CD is every workflow's jobs in four columns, each judged for a
 * scenario: whether the trigger and the job's own branch rule let it run. A
 * job with a condition, a path filter or a trigger from another workflow is
 * "unknown" — the map evaluates no expression and invents no result.
 */
extendStrings({
    en: {
        lLocal: 'Local environment', lCi: 'CI/CD', lRail: 'Detail', lScenario: 'Scenario:',
        lScen: { push: 'push → main', pr: 'pull_request', tag: 'tag v1.2.0' },
        lEnvMeta: function (s, n, c) { return s + (s === '1' ? ' service · ' : ' services · ') + n + (n === '1' ? ' network · ' : ' networks · ') + c + (c === '1' ? ' conflict' : ' conflicts'); },
        lCiMeta: function (w, j, r) { return w + ' workflows · ' + j + ' jobs · ' + r + ' reusable'; },
        lProfiles: 'Profiles:', lProfilesWhy: 'Compose profiles are not read', lDeclared: 'declared', lFromYaml: 'from YAML',
        lObserved: 'observed', lObservedWhy: 'AC never queries Docker; nothing here was observed running',
        lConflict: 'port conflict', lPorts: 'ports', lNet: 'network', lHealth: 'health', lHealthWhy: 'health checks are not read',
        lNetworks: 'Networks', lVolumes: 'Volumes', lNoNet: 'no service names a network', lNoVol: 'no service mounts a volume',
        lRun: { ok: 'runs', off: 'skipped', unk: 'unknown' }, lUnkHelp: 'condition not evaluable', lNoInvent: 'AC invents no results — only whether a job would run.',
        lStages: ['Check', 'Build', 'Roll out', 'Production · Clean up'], lAlways: 'always', lNeeds: 'needs', lEnv: 'env', lBuilds: 'builds', lUses: 'uses', lBranches: 'branches',
        lComposeSvc: 'Compose service', lDevSvc: 'Dev container', lImage: 'image', lPortsHC: ' (host:container)', lDeclaredK: 'declared', lObservedK: 'observed',
        lFindings: 'Findings', lNone: 'none', lNoFindEnv: 'No finding for this service.', lNoFindJob: 'No findings.',
        lEnvNote: 'Configured-to-connect is not observed-connected. Both are kept apart.',
        lJobKicker: function (f) { return 'Job · ' + f; }, lSourceK: 'source', lCond: 'condition', lDepends: 'depends', lScenK: 'scenario', lEvalK: 'evaluation',
        lJobNote: 'Diagnostics of actionlint or zizmor appear with their source, not as a rule of their own.',
        lWhy: { noTrigger: 'no trigger of the workflow fires on this event', branch: 'a branch filter excludes it', tagBranch: 'a branch filter alone never fires on a tag',
            paths: 'a path filter decides it on the changed files', called: 'started by another workflow', cond: 'its condition is not evaluated', jobBranch: 'the job runs on other branches only',
            gitlabMr: 'merge request pipelines depend on rules that are not evaluated', fires: 'the trigger fires and nothing restricts the job' },
        lMore: 'Findings outside a job or service', lNoLocal: 'no Compose service was read: the Runtime reader found no local environment on this tree',
        lNoCi: 'no CI workflow was read on this tree'
    },
    de: {
        lLocal: 'Lokale Umgebung', lCi: 'CI/CD', lRail: 'Detail', lScenario: 'Szenario:',
        lScen: { push: 'push → main', pr: 'pull_request', tag: 'tag v1.2.0' },
        lEnvMeta: function (s, n, c) { return s + (s === '1' ? ' Dienst · ' : ' Dienste · ') + n + (n === '1' ? ' Netz · ' : ' Netze · ') + c + (c === '1' ? ' Konflikt' : ' Konflikte'); },
        lCiMeta: function (w, j, r) { return w + ' Workflows · ' + j + ' Jobs · ' + r + ' wiederverwendbar'; },
        lProfiles: 'Profile:', lProfilesWhy: 'Compose-Profile werden nicht gelesen', lDeclared: 'deklariert', lFromYaml: 'aus YAML',
        lObserved: 'beobachtet', lObservedWhy: 'AC fragt Docker nie ab; nichts hier wurde laufend beobachtet',
        lConflict: 'Port-Konflikt', lPorts: 'ports', lNet: 'netz', lHealth: 'health', lHealthWhy: 'Healthchecks werden nicht gelesen',
        lNetworks: 'Netze', lVolumes: 'Volumes', lNoNet: 'kein Dienst nennt ein Netz', lNoVol: 'kein Dienst bindet ein Volume ein',
        lRun: { ok: 'läuft', off: 'übersprungen', unk: 'unbekannt' }, lUnkHelp: 'Bedingung nicht auswertbar', lNoInvent: 'AC erfindet keine Ergebnisse – nur ob ein Job laufen würde.',
        lStages: ['Prüfen', 'Bauen', 'Ausrollen', 'Produktion · Aufräumen'], lAlways: 'immer', lNeeds: 'needs', lEnv: 'env', lBuilds: 'baut', lUses: 'nutzt', lBranches: 'branches',
        lComposeSvc: 'Compose-Dienst', lDevSvc: 'Dev-Container', lImage: 'image', lPortsHC: ' (host:container)', lDeclaredK: 'deklariert', lObservedK: 'beobachtet',
        lFindings: 'Befunde', lNone: 'keine', lNoFindEnv: 'Kein Befund für diesen Dienst.', lNoFindJob: 'Keine Befunde.',
        lEnvNote: 'Konfiguriert-zu-verbinden ist nicht beobachtet-verbunden. Beides wird getrennt geführt.',
        lJobKicker: function (f) { return 'Job · ' + f; }, lSourceK: 'quelle', lCond: 'bedingung', lDepends: 'abhängig', lScenK: 'szenario', lEvalK: 'auswertung',
        lJobNote: 'Diagnosen von actionlint oder zizmor erscheinen mit Quelle, nicht als eigene Regel.',
        lWhy: { noTrigger: 'kein Auslöser des Workflows feuert bei diesem Ereignis', branch: 'ein Branch-Filter schließt es aus', tagBranch: 'ein reiner Branch-Filter feuert nie bei einem Tag',
            paths: 'ein Pfad-Filter entscheidet anhand der geänderten Dateien', called: 'von einem anderen Workflow gestartet', cond: 'seine Bedingung wird nicht ausgewertet', jobBranch: 'der Job läuft nur auf anderen Branches',
            gitlabMr: 'Merge-Request-Pipelines hängen an Regeln, die nicht ausgewertet werden', fires: 'der Auslöser feuert und nichts schränkt den Job ein' },
        lMore: 'Befunde ohne Job oder Dienst', lNoLocal: 'es wurde kein Compose-Dienst gelesen: der Runtime-Leser hat auf diesem Baum keine lokale Umgebung gefunden',
        lNoCi: 'auf diesem Baum wurde kein CI-Workflow gelesen'
    }
});

var dlState = { scen: 'tag' };
if (!avState.view.delivery) avState.view.delivery = 'ci';

function wfBase(f) { var i = f.lastIndexOf('/'); return i < 0 ? f : f.slice(i + 1); }
/** The Compose services of the Runtime payload: the local environment, read where Runtime stored it. */
function localServices() {
    var r = KA.runtime;
    return r && !r.empty && r.services ? r.services : [];
}
function runtimeFindings() { var r = KA.runtime; return (r && r.findings) || []; }
/** Runtime findings about one service: a witness at its declaration, or its name in the subject. */
function svcFindings(s) {
    var bare = s.name.replace(/ \(.*\)$/, '');
    return runtimeFindings().map(function (f, i) { return [f, i]; }).filter(function (fi) {
        return (fi[0].witnesses || []).some(function (w) { return sameSpot(w, s.witness); }) || fi[0].subject.indexOf(s.witness.file + '#' + bare + ':') >= 0 || fi[0].subject === 'service:compose:' + s.witness.file + '#' + bare;
    });
}
/** Host ports two services of one Compose file publish: `<file>#<port>/<proto>` → the service names. */
function portClashes(services) {
    var by = Object.create(null);
    services.forEach(function (s) {
        s.ports.forEach(function (pt) {
            if (pt.published == null) return;
            var k = s.witness.file + '#' + pt.published + '/' + (pt.protocol || 'tcp');
            if (!by[k]) by[k] = [];
            if (by[k].indexOf(s.name) < 0) by[k].push(s.name);
        });
    });
    var out = Object.create(null);
    Object.keys(by).forEach(function (k) { if (by[k].length > 1) out[k] = by[k]; });
    return out;
}
function svcConflict(s) {
    if (svcFindings(s).some(function (fi) { return fi[0].id === 'RT-1'; })) return true;
    var c = portClashes(localServices());
    return Object.keys(c).some(function (k) { return c[k].indexOf(s.name) >= 0; });
}
function svcNetworks(services) {
    var by = Object.create(null);
    var order = [];
    services.forEach(function (s) { s.networks.forEach(function (n) { if (!by[n]) { by[n] = []; order.push(n); } by[n].push(s.name); }); });
    return order.map(function (n) { return [n, by[n]]; });
}

/** Whether a job would run for a scenario, and why: 'ok', 'off' or 'unk'. */
function jobEval(p, j, scen) {
    var wf = null;
    p.workflows.forEach(function (w) { if (w.file === j.workflow) wf = w; });
    var declared = wf ? wf.events || wf.triggers.map(function (ev) { return { event: ev, branches: [], paths: false }; }) : [];
    var events = declared.filter(function (e) { return !e.job || e.job === j.id; });
    var res;
    if (j.system === 'gitlab') {
        if (scen === 'pr') return ['unk', 'gitlabMr'];
        var br = j.branches || [];
        if (scen === 'tag') res = br.length ? ['off', 'tagBranch'] : ['ok', 'fires'];
        else res = !br.length || br.indexOf('<default>') >= 0 || br.indexOf('main') >= 0 ? ['ok', 'fires'] : ['off', 'jobBranch'];
        if (res[0] === 'ok' && events.some(function (e) { return e.paths; })) return ['unk', 'paths'];
        return res[0] === 'ok' && j.condition ? ['unk', 'cond'] : res;
    }
    var want = scen === 'pr' ? ['pull_request', 'pull_request_target'] : ['push'];
    var hits = events.filter(function (e) { return want.indexOf(e.event) >= 0; });
    if (!hits.length) {
        if (events.some(function (e) { return e.event === 'workflow_call' || e.event === 'workflow_run'; })) return ['unk', 'called'];
        return ['off', 'noTrigger'];
    }
    var fire = hits.filter(function (e) {
        if (scen === 'tag') return !e.branches.length;
        if (scen === 'push') return !e.branches.length || e.branches.some(function (b) { return b === 'main' || b === '*' || b === '**'; });
        return true;
    });
    if (!fire.length) return ['off', scen === 'tag' ? 'tagBranch' : 'branch'];
    if (fire.every(function (e) { return e.paths; })) return ['unk', 'paths'];
    var jb = j.branches || [];
    if (jb.length && (scen !== 'push' || (jb.indexOf('main') < 0 && jb.indexOf('<default>') < 0))) return ['off', 'jobBranch'];
    if (j.condition) return ['unk', 'cond'];
    return ['ok', 'fires'];
}
var EVAL_CLASS = { ok: 'ok', off: 'off', unk: 'unkA' };

function jobBuilds(p, j) {
    return p.chain.filter(function (c) { return c.kind === 'build' && c.job === j.id; }).map(function (c) { return c.name.replace(/^.* → /, ''); });
}
function jobStage(p, j, depth) {
    if (j.isTest) return 0;
    if (jobBuilds(p, j).length) return 1;
    if (j.isDeploy || (j.isDeploy === undefined && !!j.environment)) return /prod/i.test(j.environment || '') ? 3 : 2;
    return Math.min(3, depth[j.id] || 0);
}
/** Depth of each job by its `needs`, within its workflow; a cycle or a missing need stops at the last known depth. */
function jobDepths(jobs) {
    var byId = Object.create(null);
    jobs.forEach(function (j) { byId[j.id] = j; });
    var depth = Object.create(null);
    function d(j, seen) {
        if (depth[j.id] !== undefined) return depth[j.id];
        if (seen[j.id]) return 0;
        seen[j.id] = true;
        var m = 0;
        j.needs.forEach(function (n) {
            var other = byId[n] || byId[j.workflow + '#' + n];
            if (other) m = Math.max(m, d(other, seen) + 1);
        });
        depth[j.id] = m;
        return m;
    }
    jobs.forEach(function (j) { d(j, Object.create(null)); });
    return depth;
}
function needName(n) { var i = n.lastIndexOf('#'); return i < 0 ? n : n.slice(i + 1); }
function jobMeta(p, j) {
    var parts = [];
    if (j.needs.length) parts.push(t('lNeeds') + ': ' + j.needs.map(needName).join(', '));
    if (j.environment) parts.push(t('lEnv') + ': ' + j.environment);
    var b = jobBuilds(p, j);
    if (b.length) parts.push(t('lBuilds') + ': ' + b.join(', '));
    else if (j.uses.length && !j.needs.length) parts.push(t('lUses') + ': ' + j.uses.join(', '));
    return parts.join(' · ') || '–';
}
function jobCond(j) {
    if (j.condition) return 'if: ' + j.condition;
    if (j.branches && j.branches.length) return t('lBranches') + ': ' + j.branches.join(', ');
    return t('lAlways');
}
/** Delivery findings about one job: its own, its environment's, and its workflow's triggers. */
function jobFindings(p, j) {
    return (p.findings || []).map(function (f, i) { return [f, i]; }).filter(function (fi) {
        var s = fi[0].subject;
        var body = s.slice(s.indexOf(':') + 1);
        if (body === j.id || body.indexOf(j.id + ':') === 0) return true;
        if (s.indexOf('environment:') === 0) return !!j.environment && body === j.workflow + '#' + j.environment;
        if (s.indexOf('trigger:') === 0) return body.indexOf(j.workflow + '#') === 0;
        return false;
    });
}

function dlSelected(p, key) {
    if (key.indexOf('job/') === 0) { for (var i = 0; i < p.jobs.length; i++) if (p.jobs[i].id === key.slice(4)) return p.jobs[i]; return null; }
    if (key) return null;
    var pick = null;
    p.jobs.forEach(function (j) { if (!pick && jobEval(p, j, dlState.scen)[0] === 'unk') pick = j; });
    return pick || p.jobs[0] || null;
}
function svcSelected(key) {
    var services = localServices();
    if (key.indexOf('local/') === 0) { for (var i = 0; i < services.length; i++) if (services[i].name === key.slice(6)) return services[i]; return null; }
    if (key) return null;
    for (var k = 0; k < services.length; k++) if (svcFindings(services[k]).length) return services[k];
    return services[0] || null;
}

function dlBar(p, view, key, bar, tabList) {
    bar.appendChild(el('span', { class: 'ops-mark' }));
    bar.appendChild(viewTabs('delivery', key, tabList));
    if (view === 'ci') {
        var rg = add(el('div', { class: 'ops-scen', role: 'radiogroup', 'aria-label': t('lScenario').replace(':', '') }), el('span', { class: 'muted' }, t('lScenario')));
        ['push', 'pr', 'tag'].forEach(function (s) {
            var b = el('button', { type: 'button', role: 'radio', class: 'mono' + (dlState.scen === s ? ' on' : ''), 'aria-checked': String(dlState.scen === s) }, t('lScen')[s]);
            b.addEventListener('click', function () { dlState.scen = s; renderAreaPage('delivery', key); });
            rg.appendChild(b);
        });
        bar.appendChild(rg);
        var reusable = p.workflows.filter(function (w) { return w.triggers.indexOf('workflow_call') >= 0; }).length;
        bar.appendChild(el('span', { class: 'mono av-barmeta' }, t('lCiMeta')(num(p.workflows.length), num(p.jobs.length), num(reusable))));
    } else {
        var s = localServices();
        var conflicts = Object.keys(portClashes(s)).length;
        bar.appendChild(el('span', { class: 'mono av-barmeta' }, t('lEnvMeta')(num(s.length), num(svcNetworks(s).length), num(conflicts))));
    }
}

function localView(sel, main) {
    var services = localServices();
    if (!services.length) { main.appendChild(ndTag(t('lNoLocal'), true)); return; }
    var files = [];
    services.forEach(function (s) { if (files.indexOf(s.witness.file) < 0) files.push(s.witness.file); });
    var wrap = el('div', { class: 'ops-col' });
    wrap.appendChild(add(el('div', { class: 'ops-legend wide' }),
        add(el('span'), document.createTextNode(files.join(' + ') + ' · ' + t('lProfiles') + ' '), ndTag(t('lProfilesWhy'))),
        add(el('span'), opsChip(t('lDeclared'), 'none'), document.createTextNode(' ' + t('lFromYaml'))),
        add(el('span'), opsChip(t('lObserved'), 'unk'), document.createTextNode(' '), ndTag(t('lObservedWhy'), true))));
    var cards = el('div', { class: 'ops-svcgrid' });
    services.forEach(function (s) {
        var clash = svcConflict(s);
        var b = el('button', { type: 'button', class: 'ops-card' + (sel === s ? ' on' : '') });
        add(b, add(el('div', { class: 'ops-row' }), el('span', { class: 'mono ops-cname' }, s.name), clash ? opsChip(t('lConflict'), 'bad') : opsChip(t('lDeclared'), 'none')),
            el('span', { class: 'mono ops-cimg' }, s.image || '–'),
            add(el('div', { class: 'mono ops-ckv' }), el('span', { class: 'muted' }, t('lPorts')), el('span', { class: clash ? 'ops-clash' : null }, s.ports.map(portText).join(', ') || '–'),
                el('span', { class: 'muted' }, t('lNet')), el('span', null, s.networks.join(', ') || '–'),
                el('span', { class: 'muted' }, t('lHealth')), ndTag(t('lHealthWhy'))));
        b.addEventListener('click', function () { avPick('delivery', 'local/' + s.name); });
        cards.appendChild(b);
    });
    wrap.appendChild(cards);
    var boxes = el('div', { class: 'ops-boxes' });
    var nets = svcNetworks(services);
    var nb = add(el('div', { class: 'ops-box' }), el('span', { class: 'cap' }, t('lNetworks')));
    var nl = el('div', { class: 'mono ops-boxlist' });
    if (!nets.length) nl.appendChild(ndTag(t('lNoNet'), true));
    nets.forEach(function (n, i) { nl.appendChild(add(el('span'), el('span', { class: i % 2 ? 'ops-net2' : 'ops-net1' }, n[0]), document.createTextNode(' · ' + n[1].join(', ')))); });
    nb.appendChild(nl);
    var vb = add(el('div', { class: 'ops-box' }), el('span', { class: 'cap' }, t('lVolumes')));
    var vl = el('div', { class: 'mono ops-boxlist' });
    var any = false;
    services.forEach(function (s) { (s.volumes || []).forEach(function (v) { any = true; vl.appendChild(el('span', null, v.name + ' → ' + s.name + ':' + v.target)); }); });
    if (!any) vl.appendChild(ndTag(t('lNoVol'), true));
    vb.appendChild(vl);
    add(boxes, nb, vb);
    wrap.appendChild(boxes);
    main.appendChild(wrap);
}

function ciView(p, sel, main) {
    if (!p) { main.appendChild(ndTag(t('lNoCi'), true)); return; }
    var depth = jobDepths(p.jobs);
    var wrap = el('div', { class: 'ops-col' });
    p.workflows.forEach(function (w, wi) {
        var jobs = p.jobs.filter(function (j) { return j.workflow === w.file; });
        var block = el('div', { class: 'ops-col tight' });
        var head = add(el('div', { class: 'ops-legend wide' }), el('span', { class: 'mono', title: wloc(w.witness) }, w.file));
        if (wi === 0) {
            add(head, opsChip(t('lRun').ok, 'ok'), opsChip(t('lRun').off, 'off'), add(el('span'), opsChip(t('lRun').unk, 'unkA'), document.createTextNode(' ' + t('lUnkHelp'))),
                el('span', { class: 'muted' }, t('lNoInvent')));
        } else head.appendChild(el('span', { class: 'muted mono' }, w.triggers.join(', ')));
        block.appendChild(head);
        var grid = el('div', { class: 'ops-stages' });
        for (var s = 0; s < 4; s++) {
            var col = add(el('div', { class: 'ops-stage' }), el('span', { class: 'cap' }, t('lStages')[s]));
            jobs.filter(function (j) { return jobStage(p, j, depth) === s; }).forEach(function (j) {
                var ev = jobEval(p, j, dlState.scen);
                var b = el('button', { type: 'button', class: 'ops-job ev-' + ev[0] + (sel === j ? ' on' : ''), title: t('lWhy')[ev[1]] });
                add(b, add(el('div', { class: 'ops-row' }), el('span', { class: 'mono ops-jname' }, j.name), opsChip(t('lRun')[ev[0]], EVAL_CLASS[ev[0]])),
                    el('span', { class: 'mono ops-jmeta' }, jobMeta(p, j)),
                    el('span', { class: 'mono ops-jcond' }, jobCond(j)));
                b.addEventListener('click', function () { avPick('delivery', 'job/' + j.id); });
                col.appendChild(b);
            });
            grid.appendChild(col);
        }
        block.appendChild(grid);
        wrap.appendChild(block);
    });
    main.appendChild(wrap);
}

function dlLoose(p, view, main) {
    var rest = [];
    if (view === 'ci' && p) {
        var tied = Object.create(null);
        p.jobs.forEach(function (j) { jobFindings(p, j).forEach(function (fi) { tied[fi[1]] = 1; }); });
        rest = (p.findings || []).map(function (f, i) { return [f, i]; }).filter(function (fi) { return !tied[fi[1]]; });
    }
    if (!rest.length) return;
    var sec = add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('lMore') + ' (' + rest.length + ')'));
    findingBoxes('delivery', rest).forEach(function (b) { sec.appendChild(b); });
    main.appendChild(sec);
}

function railFindings(pad, area, list, none) {
    var sec = add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('lFindings')));
    if (!list.length) sec.appendChild(findBox('–', opsChip(t('lNone'), 'ok'), none));
    findingBoxes(area, list).forEach(function (b) { sec.appendChild(b); });
    pad.appendChild(sec);
}

function dlRail(p, view, key, right) {
    var pad = el('div', { class: 'ops-rail' });
    if (key.indexOf('finding/') === 0) {
        var item = itemByKey('delivery', key);
        if (item) {
            add(pad, railHead(item.finding.engine || 'finding', item.label, opsChip(t('sevNames')[item.finding.severity] || item.finding.severity, 'unk')),
                el('span', { class: 'ops-ftext' }, item.finding.message), add(el('section', { class: 'sec' }), witnessList(item.witnesses)));
            right.appendChild(pad);
            return;
        }
    }
    if (view === 'env') {
        var s = svcSelected(key);
        if (!s) { right.appendChild(add(pad, el('span', { class: 'soft' }, t('pickItem')))); return; }
        add(pad, railHead(/devcontainer/.test(s.witness.file) ? t('lDevSvc') : t('lComposeSvc'), s.name, svcConflict(s) ? opsChip(t('lConflict'), 'bad') : opsChip(t('lDeclared'), 'none')),
            railRows([[t('lImage'), s.image || '–'], [t('lPorts'), (s.ports.map(portText).join(', ') || '–') + t('lPortsHC')], [t('lNet'), s.networks.join(', ') || '–'],
                [t('lDeclaredK'), add(el('span'), document.createTextNode(wloc(s.witness) + ' '), confirmChip(s.witness.confirm))], [t('lObservedK'), ndTag(t('lObservedWhy'))]]));
        railFindings(pad, 'runtime', svcFindings(s), t('lNoFindEnv'));
        pad.appendChild(el('span', { class: 'ops-railnote' }, t('lEnvNote')));
        right.appendChild(pad);
        return;
    }
    var j = p ? dlSelected(p, key) : null;
    if (!j) { right.appendChild(add(pad, el('span', { class: 'soft' }, t('pickItem')))); return; }
    var ev = jobEval(p, j, dlState.scen);
    add(pad, railHead(t('lJobKicker')(wfBase(j.workflow)), j.name, opsChip(t('lRun')[ev[0]], EVAL_CLASS[ev[0]])),
        railRows([[t('lCond'), jobCond(j)], [t('lDepends'), jobMeta(p, j)], [t('lScenK'), t('lScen')[dlState.scen]], [t('lEvalK'), t('lRun')[ev[0]] + ' — ' + t('lWhy')[ev[1]]],
            [t('lSourceK'), add(el('span'), document.createTextNode(wloc(j.witness) + ' '), confirmChip(j.witness.confirm))]]));
    railFindings(pad, 'delivery', jobFindings(p, j), t('lNoFindJob'));
    pad.appendChild(el('span', { class: 'ops-railnote' }, t('lJobNote')));
    right.appendChild(pad);
}

AREA_MODULES.delivery = {
    tabs: [['env', 'lLocal'], ['ci', 'lCi']],
    railTitles: [null, 'lRail'],
    ownsBar: true,
    tabsFor: function (p) {
        var local = localServices().length > 0;
        return this.tabs.filter(function (o) { return o[0] === 'env' ? local : !!p; });
    },
    extra: function () { return localServices().length > 0; },
    extraItems: function () {
        return localServices().map(function (s) {
            return { key: 'local/' + s.name, kind: 'service', label: s.name, sub: s.image || '',
                rows: [[t('lImage'), s.image], [t('lPorts'), s.ports.map(portText).join(', ')], [t('lNet'), s.networks.join(', ')]], witnesses: [s.witness] };
        });
    },
    items: function (p) {
        var out = [];
        p.workflows.forEach(function (w) {
            out.push({ key: 'workflow/' + w.file, kind: 'workflow', label: w.name, sub: w.file, rows: [[t('lCi'), w.file], ['on', w.triggers.join(', ')]], witnesses: [w.witness] });
        });
        p.jobs.forEach(function (j) {
            out.push({ key: 'job/' + j.id, kind: 'job', label: j.name, sub: j.workflow, rows: [[t('lCond'), jobCond(j)], [t('lDepends'), jobMeta(p, j)]], witnesses: [j.witness] });
        });
        return out;
    },
    meta: function (p) { return t('lCiMeta')(num(p.workflows.length), num(p.jobs.length), num(p.workflows.filter(function (w) { return w.triggers.indexOf('workflow_call') >= 0; }).length)); },
    render: function (p, view, main) { if (view === 'env') localView(null, main); else ciView(p, null, main); },
    page: function (p, view, key, c) {
        if (key.indexOf('workflow/') === 0) key = '';
        if (key.indexOf('local/') === 0 && view !== 'env') view = avState.view.delivery = 'env';
        if (key.indexOf('job/') === 0 && view !== 'ci' && p) view = avState.view.delivery = 'ci';
        dlBar(p, view, key, c.bar, this.tabsFor(p));
        if (view === 'env') localView(svcSelected(key), c.main); else ciView(p, dlSelected(p, key), c.main);
        dlLoose(p, view, c.main);
        dlRail(p, view, key, c.right);
    }
};
