/*
 * Interfaces: the external services the code calls, their operations with
 * parameters and call sites, and the configuration names they are bound
 * through. A configuration value never reaches the map, only its name.
 */
extendStrings({
    en: {
        iServices: 'Services', iOperations: 'Operations', iService: 'Service', iProtocol: 'Protocol', iDirection: 'Direction', iConfig: 'Configuration names',
        iOps: 'Operations', iCallers: 'Callers', iContract: 'Contract', iParams: 'Parameters', iRequired: 'required', iOptional: 'optional', iNoContract: 'no contract in the tree',
        iMeta: function (s, o, c) { return s + ' services · ' + o + ' operations · ' + c + ' call sites'; }, iAll: 'all protocols', iDir: { outbound: 'outbound ↗', inbound: 'inbound ↙' }
    },
    de: {
        iServices: 'Dienste', iOperations: 'Operationen', iService: 'Dienst', iProtocol: 'Protokoll', iDirection: 'Richtung', iConfig: 'Konfigurationsnamen',
        iOps: 'Operationen', iCallers: 'Aufrufer', iContract: 'Vertrag', iParams: 'Parameter', iRequired: 'Pflicht', iOptional: 'optional', iNoContract: 'kein Vertrag im Baum',
        iMeta: function (s, o, c) { return s + ' Dienste · ' + o + ' Operationen · ' + c + ' Aufrufstellen'; }, iAll: 'alle Protokolle', iDir: { outbound: 'ausgehend ↗', inbound: 'eingehend ↙' }
    }
});

var ifProtocol = 'all';

AREA_MODULES.interfaces = {
    tabs: [['services', 'iServices'], ['operations', 'iOperations'], ['findings', 'aFindings']],
    items: function (p) {
        var out = [];
        p.services.forEach(function (s) {
            out.push({ key: 'service/' + s.name, kind: 'service · ' + s.protocol, label: s.name, sub: s.configNames.join(', '),
                rows: [[t('iProtocol'), s.protocol], [t('iDirection'), t('iDir')[s.direction] || s.direction], [t('iConfig'), s.configNames.join(', ')], [t('iOps'), num(s.operations.length)]],
                witnesses: [s.witness] });
            s.operations.forEach(function (o) {
                var params = o.params.map(function (x) { return x.name + (x.type ? ': ' + x.type : '') + (x.required ? '' : '?'); }).join(', ');
                out.push({ key: 'operation/' + s.name + '/' + o.name, kind: 'operation', label: s.name + ' · ' + o.name, sub: [o.method, o.path].filter(Boolean).join(' '),
                    rows: [[t('iService'), s.name], ['method', o.method], ['path', o.path], [t('iParams'), params || t('none')], [t('iContract'), o.contract ? wloc(o.contract) : t('iNoContract')], [t('iCallers'), num(o.callers.length)]],
                    witnesses: [o.witness].concat(o.contract ? [o.contract] : [], o.callers) });
            });
        });
        return out;
    },
    meta: function (p) {
        var ops = 0;
        var calls = 0;
        p.services.forEach(function (s) { ops += s.operations.length; s.operations.forEach(function (o) { calls += o.callers.length; }); });
        return t('iMeta')(num(p.services.length), num(ops), num(calls));
    },
    render: function (p, view, main) {
        var protocols = [];
        p.services.forEach(function (s) { if (protocols.indexOf(s.protocol) < 0) protocols.push(s.protocol); });
        if (protocols.indexOf(ifProtocol) < 0) ifProtocol = 'all';
        var seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('iProtocol') });
        ['all'].concat(protocols).forEach(function (pr) {
            var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(ifProtocol === pr) }, pr === 'all' ? t('iAll') : pr);
            b.addEventListener('click', function () { ifProtocol = pr; renderAreaPage('interfaces', current.item); });
            seg.appendChild(b);
        });
        main.appendChild(seg);
        var services = p.services.filter(function (s) { return ifProtocol === 'all' || s.protocol === ifProtocol; });
        if (view === 'operations') {
            var rows = [];
            services.forEach(function (s) {
                s.operations.forEach(function (o) {
                    rows.push({ key: 'operation/' + s.name + '/' + o.name, cells: [s.name + ' · ' + o.name, [o.method, o.path].filter(Boolean).join(' ') || '–', num(o.params.length),
                        num(o.callers.length), o.contract ? confirmChip(o.contract.confirm) : stChip(t('iNoContract'), 'dash')] });
                });
            });
            main.appendChild(factTable('interfaces', [t('iOperations'), 'method · path', t('iParams'), t('iCallers'), t('iContract')], rows));
            return;
        }
        main.appendChild(factTable('interfaces', [t('iService'), t('iProtocol'), t('iDirection'), t('iConfig'), t('iOps'), t('colWitness')], services.map(function (s) {
            return { key: 'service/' + s.name, cells: [s.name, stChip(s.protocol, 'cyan'), t('iDir')[s.direction] || s.direction, s.configNames.join(', ') || '–', num(s.operations.length), confirmChip(s.witness.confirm)] };
        })));
    }
};
