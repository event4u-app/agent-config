/**
 * reach_capability_probe.ts — the capability probes `reach:doctor` runs for a
 * backend whose `--version` says nothing about whether it can do the channel's
 * job. Read-only like the doctor itself: every byte travels through pipes.
 */
import { spawnSync } from 'node:child_process';

import type { ReadinessStatus } from '../reach_doctor.js';
import { hardenedSpawnEnv } from './spawn_env.js';
import { probeTool, type ToolProbeStatus } from './tool_probe.js';

export interface CapabilityRow {
    kind: 'frame-path';
    status: ReadinessStatus;
    detail: string;
}

/**
 * A generated one-second clip pushed through the frame path `media_bundle`
 * uses: encoded, probed by ffprobe as JSON, decoded again through the same
 * split into a PNG tile, a 9×8 grayscale hash frame and a text-band probe, and
 * tiled into a JPEG sheet. An ffmpeg build can answer `-version` and still
 * lack the lavfi source, an encoder or a filter that path needs, and the bundle
 * cannot start without ffprobe; only running both tells. Everything travels
 * through pipes, so the doctor stays a program with no filesystem write.
 */
export function probeFramePath(ffmpegBin: string, ffprobeBin: string | null = resolveFfprobe()): CapabilityRow {
    const notReady = (detail: string): CapabilityRow => ({ kind: 'frame-path', status: 'not-ready', detail });
    const spawn = (bin: string, args: readonly string[], input?: Buffer, extraPipes = 0) =>
        spawnSync(bin, args, {
            env: hardenedSpawnEnv(),
            timeout: 30_000,
            maxBuffer: 16 * 1024 * 1024,
            stdio: Array.from({ length: 3 + extraPipes }, () => 'pipe' as const),
            ...(input === undefined ? {} : { input }),
        });
    const ffmpeg = (args: readonly string[], input?: Buffer, extraPipes = 0) =>
        spawn(ffmpegBin, ['-hide_banner', '-loglevel', 'error', ...args], input, extraPipes);
    const clip = ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=160x90:d=1', '-c:v', 'mpeg4', '-f', 'matroska', 'pipe:1']);
    if (clip.error !== undefined || clip.status !== 0 || clip.stdout.length === 0) {
        return notReady(`ffmpeg could not generate a 1-s probe clip (exit ${String(clip.status)})`);
    }
    if (ffprobeBin === null) return notReady('ffprobe is not on PATH — media_bundle reads every source through it');
    const probed = spawn(ffprobeBin, ['-v', 'error', '-protocol_whitelist', 'pipe', '-print_format', 'json', '-show_format', '-show_streams', '-i', 'pipe:0'], clip.stdout);
    let probedVideo = false;
    try {
        const data = JSON.parse(probed.stdout?.toString('utf8') ?? '') as { streams?: { codec_type?: string }[] };
        probedVideo = (data.streams ?? []).some((s) => s.codec_type === 'video');
    } catch {
        probedVideo = false;
    }
    if (probed.status !== 0 || !probedVideo) {
        return notReady(`ffprobe did not describe the generated clip as JSON (exit ${String(probed.status)})`);
    }
    const frame = ffmpeg(
        [
            '-protocol_whitelist', 'pipe', '-i', 'pipe:0',
            '-filter_complex', '[0:v]split=3[a][b][c];[a]scale=80:-2[t];[b]scale=9:8,format=gray[h];[c]scale=64:36,format=gray[x]',
            '-map', '[t]', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', 'pipe:1',
            '-map', '[h]', '-frames:v', '1', '-f', 'rawvideo', 'pipe:3',
            '-map', '[x]', '-frames:v', '1', '-f', 'rawvideo', 'pipe:4',
        ],
        clip.stdout,
        2,
    );
    const [, tile, , hash, band] = frame.output ?? [];
    if (frame.status !== 0 || tile?.subarray(0, 4).toString('hex') !== '89504e47' || hash?.length !== 72 || band?.length !== 64 * 36) {
        return notReady(`the generated clip did not split into a PNG tile and a 9x8 hash frame (exit ${String(frame.status)})`);
    }
    const sheet = ffmpeg(
        ['-protocol_whitelist', 'pipe', '-i', 'pipe:0', '-vf', "select='gt(scene,0)+eq(n,0)',scale=80:-2,tile=4x3", '-fps_mode', 'vfr', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'mjpeg', 'pipe:1'],
        clip.stdout,
    );
    if (sheet.status !== 0 || sheet.stdout.subarray(0, 2).toString('hex') !== 'ffd8') {
        return notReady(`the generated clip did not tile into a contact sheet (exit ${String(sheet.status)})`);
    }
    return { kind: 'frame-path', status: 'ready', detail: 'a generated 1-s clip was probed, decoded, hashed and tiled through the frame path' };
}

function resolveFfprobe(): string | null {
    const probed = probeTool({ name: 'ffprobe', bin: 'ffprobe', probe_args: ['-version'] });
    return probed.status === 'ok' ? probed.path : null;
}

export type CapabilityProbeFn = (backendId: string, probedStatus: ToolProbeStatus, resolvedPath: string | null) => CapabilityRow | null;

const CAPABILITY_PROBES: Readonly<Record<string, (bin: string) => CapabilityRow>> = {
    ffmpeg: probeFramePath,
};

export function liveCapabilityRow(backendId: string, probedStatus: ToolProbeStatus, resolvedPath: string | null): CapabilityRow | null {
    const probe = Object.hasOwn(CAPABILITY_PROBES, backendId) ? CAPABILITY_PROBES[backendId] : undefined;
    if (probe === undefined) return null;
    if (probedStatus !== 'ok' || resolvedPath === null) {
        return { kind: 'frame-path', status: 'unknown', detail: `the backend itself is ${probedStatus}, so the frame path is not exercised` };
    }
    return probe(resolvedPath);
}

