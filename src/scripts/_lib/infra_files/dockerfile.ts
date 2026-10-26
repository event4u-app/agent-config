/**
 * Dockerfile reader: base image per stage and EXPOSE lines, each with its line.
 * Image references are returned as written; a consumer decides what to do with
 * `$ARG` references and `scratch`.
 */

export interface DockerStage {
    /** 0-based stage index */
    index: number;
    image: string;
    /** `AS name`, if any */
    alias: string | null;
    platform: string | null;
    line: number;
}

export interface DockerExpose {
    port: string;
    protocol: 'tcp' | 'udp';
    /** the stage the EXPOSE belongs to */
    stage: number;
    line: number;
}

export interface DockerfileModel {
    stages: DockerStage[];
    exposes: DockerExpose[];
}

export function parseDockerfile(text: string): DockerfileModel {
    const stages: DockerStage[] = [];
    const exposes: DockerExpose[] = [];
    text.split('\n').forEach((raw, i) => {
        const from = /^\s*FROM\s+(?:--platform=(\S+)\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(raw);
        if (from) {
            stages.push({ index: stages.length, image: from[2]!, alias: from[3] ?? null, platform: from[1] ?? null, line: i + 1 });
            return;
        }
        const expose = /^\s*EXPOSE\s+(.+)$/i.exec(raw.replace(/\s#.*$/, ''));
        if (expose) {
            for (const tok of expose[1]!.trim().split(/\s+/)) {
                const m = /^(\$?\{?[\w-]+\}?)(?:\/(tcp|udp))?$/i.exec(tok);
                if (m) exposes.push({ port: m[1]!, protocol: (m[2]?.toLowerCase() as 'tcp' | 'udp') ?? 'tcp', stage: Math.max(0, stages.length - 1), line: i + 1 });
            }
        }
    });
    return { stages, exposes };
}
