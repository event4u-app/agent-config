/**
 * Dependency names from package manifests, each with the line it was read on.
 */
import type { Witness } from '../lane_fact.js';
import type { SdkRow } from './sdk_table.js';
import { SourceText } from './text.js';

export interface Dependency {
    ecosystem: SdkRow['ecosystem'];
    name: string;
    witness: Witness;
}

function at(src: SourceText, needle: string): Witness {
    const i = src.text.indexOf(needle);
    return i < 0 ? src.witnessAtLine(1) : src.witness(i);
}

export function readManifest(rel: string, text: string): Dependency[] {
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    const src = new SourceText(rel, text);
    const out: Dependency[] = [];
    if (base === 'composer.json' || base === 'package.json') {
        const ecosystem = base === 'composer.json' ? 'composer' : 'npm';
        let json: Record<string, unknown>;
        try {
            json = JSON.parse(text) as Record<string, unknown>;
        } catch {
            return out;
        }
        const sections = ecosystem === 'composer' ? ['require', 'require-dev'] : ['dependencies', 'devDependencies', 'optionalDependencies'];
        for (const s of sections) {
            const deps = json[s];
            if (!deps || typeof deps !== 'object') continue;
            for (const name of Object.keys(deps)) out.push({ ecosystem, name, witness: at(src, `"${name}"`) });
        }
        return out;
    }
    if (/^requirements.*\.txt$/.test(base)) {
        src.lines.forEach((line, i) => {
            const m = /^\s*([A-Za-z0-9][\w.-]*)/.exec(line);
            if (m && !line.trim().startsWith('#') && !line.trim().startsWith('-')) {
                out.push({ ecosystem: 'pypi', name: (m[1] as string).toLowerCase().replace(/-/g, '_'), witness: src.witnessAtLine(i + 1) });
            }
        });
        return out;
    }
    if (base === 'pyproject.toml') {
        let section = '';
        src.lines.forEach((line, i) => {
            const sec = /^\s*\[([^\]]+)\]/.exec(line);
            if (sec) {
                section = sec[1] as string;
                return;
            }
            const quoted = /^\s*["']([A-Za-z0-9][\w.-]*)/.exec(line);
            const keyed = /^\s*([A-Za-z0-9][\w.-]*)\s*=/.exec(line);
            const name =
                quoted && (section === 'project' || section.startsWith('project.optional')) ? quoted[1] : keyed && section.includes('dependencies') ? keyed[1] : null;
            if (name && name !== 'python') out.push({ ecosystem: 'pypi', name: name.toLowerCase().replace(/-/g, '_'), witness: src.witnessAtLine(i + 1) });
        });
        return out;
    }
    if (base === 'go.mod') {
        src.lines.forEach((line, i) => {
            const m = /^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]{2,}\/[^\s]+)\s+v\d/.exec(line);
            if (m) out.push({ ecosystem: 'go', name: m[1] as string, witness: src.witnessAtLine(i + 1) });
        });
        return out;
    }
    return out;
}

export const MANIFEST_FILE = /(?:^|\/)(?:composer\.json|package\.json|requirements[\w.-]*\.txt|pyproject\.toml|go\.mod)$/;
