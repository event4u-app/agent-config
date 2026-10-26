/*
 * Delivery: workflows and their jobs in stages by `needs` depth, the
 * environments they deploy to, and the build → image → deploy chain. A job's
 * condition is shown as written; the map never decides whether a job would run.
 */
extendStrings({
    en: {
        lPipeline: 'Pipeline', lChain: 'Build → deploy', lWorkflow: 'Workflow', lTriggers: 'Triggers', lJob: 'Job', lNeeds: 'needs', lEnv: 'environment', lIf: 'condition', lUses: 'uses',
        lStage: function (n) { return n === 0 ? 'Stage 1 · no needs' : 'Stage ' + (n + 1); }, lKind: { build: 'build', image: 'image', deploy: 'deploy' },
        lMeta: function (w, j, e) { return w + ' workflows · ' + j + ' jobs · ' + e + ' environments'; }, lNoChain: 'No build → image → deploy step was read.'
    },
    de: {
        lPipeline: 'Pipeline', lChain: 'Build → Deploy', lWorkflow: 'Workflow', lTriggers: 'Auslöser', lJob: 'Job', lNeeds: 'needs', lEnv: 'Umgebung', lIf: 'Bedingung', lUses: 'nutzt',
        lStage: function (n) { return n === 0 ? 'Stufe 1 · ohne needs' : 'Stufe ' + (n + 1); }, lKind: { build: 'Build', image: 'Image', deploy: 'Deploy' },
        lMeta: function (w, j, e) { return w + ' Workflows · ' + j + ' Jobs · ' + e + ' Umgebungen'; }, lNoChain: 'Es wurde kein Schritt Build → Image → Deploy gelesen.'
    }
});

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

AREA_MODULES.delivery = {
    tabs: [['pipeline', 'lPipeline'], ['chain', 'lChain'], ['findings', 'aFindings']],
    items: function (p) {
        var out = [];
        p.workflows.forEach(function (w) {
            out.push({ key: 'workflow/' + w.file, kind: 'workflow', label: w.name, sub: w.file, rows: [[t('lWorkflow'), w.file], [t('lTriggers'), w.triggers.join(', ')]], witnesses: [w.witness] });
        });
        p.jobs.forEach(function (j) {
            out.push({ key: 'job/' + j.id, kind: 'job', label: j.name, sub: j.workflow,
                rows: [[t('lWorkflow'), j.workflow], [t('lNeeds'), j.needs.join(', ')], [t('lEnv'), j.environment], [t('lIf'), j.condition], [t('lUses'), j.uses.join(', ')]], witnesses: [j.witness] });
        });
        p.chain.forEach(function (c, i) {
            out.push({ key: 'chain/' + i, kind: t('lKind')[c.kind] || c.kind, label: c.name, sub: c.environment || '', rows: [[t('lEnv'), c.environment], [t('lJob'), c.job]], witnesses: [c.witness] });
        });
        return out;
    },
    meta: function (p) { return t('lMeta')(num(p.workflows.length), num(p.jobs.length), num(p.environments.length)); },
    render: function (p, view, main) {
        if (view === 'chain') {
            if (!p.chain.length) { main.appendChild(el('div', { class: 'box' }, t('lNoChain'))); return; }
            var ol = el('ol', { class: 'chain' });
            p.chain.forEach(function (c, i) {
                var b = el('button', { type: 'button', class: 'chainstep' + (current.item === 'chain/' + i ? ' on' : '') });
                add(b, stChip(t('lKind')[c.kind] || c.kind, c.kind === 'deploy' ? 'warn' : 'cyan'), el('span', { class: 'mono' }, c.name), c.environment ? el('span', { class: 'muted' }, '→ ' + c.environment) : null, confirmChip(c.witness.confirm));
                b.addEventListener('click', function () { avPick('delivery', 'chain/' + i); });
                ol.appendChild(add(el('li'), b));
            });
            main.appendChild(ol);
            return;
        }
        var depth = jobDepths(p.jobs);
        p.workflows.forEach(function (w) {
            var jobs = p.jobs.filter(function (j) { return j.workflow === w.file; });
            var box = el('section', { class: 'card' });
            var name = el('button', { type: 'button', class: 'tname mono' }, w.name);
            name.addEventListener('click', function () { avPick('delivery', 'workflow/' + w.file); });
            add(box, add(el('div', { class: 'between' }), name, el('span', { class: 'mono muted' }, w.file + ' · ' + w.triggers.join(', '))));
            var max = 0;
            jobs.forEach(function (j) { max = Math.max(max, depth[j.id] || 0); });
            var stages = el('div', { class: 'stages' });
            for (var s = 0; s <= max; s++) {
                var col = add(el('div', { class: 'stage-col' }), el('span', { class: 'cap' }, t('lStage')(s)));
                jobs.filter(function (j) { return (depth[j.id] || 0) === s; }).forEach(function (j) {
                    var b = el('button', { type: 'button', class: 'job' + (current.item === 'job/' + j.id ? ' on' : '') });
                    add(b, add(el('span', { class: 'between' }), el('b', { class: 'mono' }, j.name), confirmChip(j.witness.confirm)),
                        j.needs.length ? el('span', { class: 'mono muted' }, t('lNeeds') + ': ' + j.needs.join(', ')) : null,
                        j.environment ? el('span', { class: 'mono muted' }, t('lEnv') + ': ' + j.environment) : null,
                        j.condition ? el('span', { class: 'mono muted' }, 'if: ' + j.condition) : null);
                    b.addEventListener('click', function () { avPick('delivery', 'job/' + j.id); });
                    col.appendChild(b);
                });
                stages.appendChild(col);
            }
            box.appendChild(stages);
            main.appendChild(box);
        });
    }
};
