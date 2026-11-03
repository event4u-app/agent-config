import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { isVerificationAttempt, mightBeVerification } from '../../src/scripts/_lib/verification_command.js';
import {
    KNOWN_RUNNERS,
    resolve_toolchain,
} from '../../src/agent-src/templates/scripts/work_engine/stack/runner.js';

/**
 * Resolver ↔ gate parity.
 *
 * `resolve_toolchain` tells an agent which command runs a project's tests, and
 * the turn-end gate decides whether a command counted as verification. When the
 * two disagree, an agent that runs exactly the prescribed command is refused —
 * measured at 81788b6e63 for `dotnet test`, `rspec`, `bundle exec rspec`,
 * `./gradlew test`, `mvn test` and `npx playwright test`.
 *
 * The commands are read from the resolver itself, one fixture per emitting
 * branch, so a new runner row fails here until the gate learns it. The label
 * coverage check keeps the fixture table from silently missing a runner.
 */

type Files = Record<string, string>;

const FIXTURES: ReadonlyArray<{ name: string; files: Files }> = [
    { name: 'pest', files: { 'composer.json': JSON.stringify({ 'require-dev': { 'pestphp/pest': '^3' } }) } },
    { name: 'artisan', files: { 'composer.json': '{}', artisan: '' } },
    { name: 'phpunit', files: { 'composer.json': JSON.stringify({ 'require-dev': { 'phpunit/phpunit': '^11' } }) } },
    { name: 'vitest', files: { 'package.json': JSON.stringify({ devDependencies: { vitest: '^3' } }) } },
    { name: 'jest', files: { 'package.json': JSON.stringify({ devDependencies: { jest: '^29' } }) } },
    { name: 'playwright', files: { 'package.json': JSON.stringify({ devDependencies: { '@playwright/test': '^1' } }) } },
    { name: 'cypress', files: { 'package.json': JSON.stringify({ devDependencies: { cypress: '^13' } }) } },
    { name: 'pytest', files: { 'pyproject.toml': '[tool.pytest.ini_options]\n' } },
    { name: 'go', files: { 'go.mod': 'module x\n' } },
    { name: 'cargo', files: { 'Cargo.toml': '[package]\nname = "x"\n' } },
    { name: 'rspec-bundled', files: { Gemfile: "gem 'rspec'\n" } },
    { name: 'rspec-bare', files: { '.rspec': '' } },
    { name: 'maven', files: { 'pom.xml': '<project/>' } },
    { name: 'maven-wrapper', files: { 'pom.xml': '<project/>', mvnw: '' } },
    { name: 'gradle', files: { 'build.gradle': '' } },
    { name: 'gradle-wrapper', files: { 'build.gradle': '', gradlew: '' } },
    { name: 'dotnet', files: { 'App.Tests.csproj': '<Project/>' } },
];

const tmpDirs: string[] = [];

afterEach(() => {
    while (tmpDirs.length > 0) fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
});

function emitted(files: Files): Array<{ runner: string; command: string }> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-parity-'));
    tmpDirs.push(root);
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, name), body);
    return resolve_toolchain(root, { include_e2e: true }).runners.map((r) => ({
        runner: r.runner,
        command: r.command,
    }));
}

describe('every runner command the resolver emits counts as a verification attempt', () => {
    it.each(FIXTURES)('$name', ({ files }) => {
        const rows = emitted(files);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            expect(isVerificationAttempt(row.command), row.command).toBe(true);
            // The recorder's wider net must reach it too, or the run is never classified.
            expect(mightBeVerification(row.command), row.command).toBe(true);
        }
    });

    it('the fixtures cover every runner label the resolver knows', () => {
        const seen = new Set(FIXTURES.flatMap(({ files }) => emitted(files).map((r) => r.runner)));
        expect([...KNOWN_RUNNERS].filter((label) => !seen.has(label))).toEqual([]);
    });
});

describe('the same toolchains still refuse a step that runs no tests', () => {
    it.each([
        'dotnet build',
        'dotnet restore',
        'mvn compile',
        './mvnw package',
        'gradle assemble',
        './gradlew build',
        'bundle install',
        'bundle exec rake db:migrate',
        'npx playwright install',
        'npx cypress open',
    ])('%s', (command) => {
        expect(isVerificationAttempt(command)).toBe(false);
    });
});
