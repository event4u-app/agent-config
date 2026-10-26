/*
 * Runtime: infrastructure resources and which environment declares each,
 * services with their images, ports and networks. Declared only: nothing here
 * was observed on a running system, and an environment variable shows by name.
 */
extendStrings({
    en: {
        rResources: 'Resources', rEnvs: 'Environments', rServices: 'Services', rType: 'Type', rModule: 'Module', rEnvsCol: 'Environments', rImage: 'Image',
        rPorts: 'Ports', rNetworks: 'Networks', rEnvNames: 'Env names', rResource: 'Resource', rDeclared: 'declared', rNotDeclared: 'not declared',
        rMeta: function (r, s, e) { return r + ' resources · ' + s + ' services · ' + e + ' environments · declared, never observed'; }, rNoEnvs: 'No environment was declared.'
    },
    de: {
        rResources: 'Ressourcen', rEnvs: 'Umgebungen', rServices: 'Dienste', rType: 'Typ', rModule: 'Modul', rEnvsCol: 'Umgebungen', rImage: 'Image',
        rPorts: 'Ports', rNetworks: 'Netze', rEnvNames: 'Env-Namen', rResource: 'Ressource', rDeclared: 'deklariert', rNotDeclared: 'nicht deklariert',
        rMeta: function (r, s, e) { return r + ' Ressourcen · ' + s + ' Dienste · ' + e + ' Umgebungen · deklariert, nie beobachtet'; }, rNoEnvs: 'Es wurde keine Umgebung deklariert.'
    }
});

function portText(pt) { return (pt.published != null ? pt.published + '→' : '') + pt.target + (pt.protocol && pt.protocol !== 'tcp' ? '/' + pt.protocol : ''); }

AREA_MODULES.runtime = {
    tabs: [['resources', 'rResources'], ['environments', 'rEnvs'], ['services', 'rServices'], ['findings', 'aFindings']],
    items: function (p) {
        var out = [];
        p.resources.forEach(function (r) {
            out.push({ key: 'resource/' + r.type + '.' + r.name, kind: r.type, label: r.name, sub: r.module || '',
                rows: [[t('rType'), r.type], [t('rModule'), r.module], [t('rEnvsCol'), r.environments.join(', ')]], witnesses: [r.witness] });
        });
        p.services.forEach(function (s) {
            out.push({ key: 'service/' + s.name, kind: 'service', label: s.name, sub: s.image || '',
                rows: [[t('rImage'), s.image], [t('rPorts'), s.ports.map(portText).join(', ')], [t('rNetworks'), s.networks.join(', ')], [t('rEnvNames'), s.envNames.join(', ')], [t('rEnvs'), s.environment]],
                witnesses: [s.witness] });
        });
        return out;
    },
    meta: function (p) { return t('rMeta')(num(p.resources.length), num(p.services.length), num(p.environments.length)); },
    render: function (p, view, main) {
        if (view === 'services') {
            main.appendChild(factTable('runtime', [t('rServices'), t('rImage'), t('rPorts'), t('rNetworks'), t('colWitness')], p.services.map(function (s) {
                return { key: 'service/' + s.name, cells: [s.name, s.image || '–', s.ports.map(portText).join(', ') || '–', s.networks.join(', ') || '–', confirmChip(s.witness.confirm)] };
            })));
            return;
        }
        if (view === 'environments') {
            if (!p.environments.length) { main.appendChild(el('div', { class: 'box' }, t('rNoEnvs'))); return; }
            main.appendChild(factTable('runtime', [t('rResource')].concat(p.environments), p.resources.map(function (r) {
                return { key: 'resource/' + r.type + '.' + r.name, cells: [r.name].concat(p.environments.map(function (e) {
                    return r.environments.indexOf(e) >= 0 ? stChip(t('rDeclared'), 'ok') : stChip(t('rNotDeclared'), 'dash');
                })) };
            })));
            return;
        }
        main.appendChild(factTable('runtime', [t('rResource'), t('rType'), t('rModule'), t('rEnvsCol'), t('colWitness')], p.resources.map(function (r) {
            return { key: 'resource/' + r.type + '.' + r.name, cells: [r.name, r.type, r.module || '–', r.environments.join(', ') || '–', confirmChip(r.witness.confirm)] };
        })));
    }
};
