/**
 * Terraform environments from the conventional layouts — an env directory, an
 * env-named var file beside a root module, and a local module instantiated from
 * an env directory — so the Runtime environment comparison has columns to fill.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { LaneOutput } from '../../src/scripts/code_graph/lanes/lane_fact.js';
import { readRuntime } from '../../src/scripts/code_graph/lanes/runtime/index.js';
import { produceAreas } from '../../src/scripts/code_graph/map_area_payloads.js';

const dirs: string[] = [];
afterAll(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

function plant(files: Record<string, string>): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tf-envs-')));
    dirs.push(dir);
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
    }
    return dir;
}

const envRoot = (env: string): string =>
    `module "vpc" {\n  source = "../../modules/vpc"\n  name   = "${env}"\n}\n\nmodule "remote" {\n  source = "terraform-aws-modules/s3-bucket/aws"\n}\n\nresource "aws_s3_bucket" "media" {\n  bucket = "acme-${env}-media"\n}\n`;

const LAYOUT: Record<string, string> = {
    'infra/modules/vpc/main.tf': 'resource "aws_vpc" "this" {\n  cidr_block = "10.0.0.0/16"\n}\n\nmodule "subnets" {\n  source = "../subnets"\n}\n',
    'infra/modules/subnets/main.tf': 'resource "aws_subnet" "a" {\n  cidr_block = "10.0.1.0/24"\n}\n',
    'infra/modules/unused/main.tf': 'resource "aws_sns_topic" "orphan" {\n  name = "x"\n}\n',
    'infra/envs/dev/main.tf': envRoot('dev'),
    'infra/envs/prod/main.tf': envRoot('prod'),
    'infra/envs/main.tf': 'resource "aws_iam_role" "shared" {\n  name = "shared"\n}\n',
    'environments/staging/main.tf': 'resource "aws_sqs_queue" "jobs" {\n  name = "jobs"\n}\n',
    'env/qa/main.tf': 'resource "aws_sqs_queue" "jobs" {\n  name = "jobs"\n}\n',
    'stack/main.tf': 'resource "aws_lambda_function" "api" {\n  function_name = "api"\n}\n',
    'stack/dev.tfvars': 'size = "s"\n',
    'stack/terraform.prod.tfvars': 'size = "l"\n',
    'stack/common.auto.tfvars': 'region = "eu"\n',
    'stack/terraform.tfvars': 'region = "eu"\n',
    'lone/main.tf': 'resource "aws_kms_key" "k" {\n  description = "k"\n}\n',
};

const envsOf = (out: LaneOutput, address: string): string[][] =>
    out.facts.filter((f) => f.kind === 'resource' && f.attrs['address'] === address).map((f) => (f.attrs['environments'] as string[] | undefined) ?? []);

describe('Terraform environments in the runtime lane', () => {
    const out = readRuntime(plant(LAYOUT), { codeEnv: false });

    it('an env directory names the environment of what it declares', () => {
        expect(envsOf(out, 'aws_s3_bucket.media')).toEqual([['dev'], ['prod']]);
        expect(envsOf(out, 'aws_sqs_queue.jobs').sort()).toEqual([['qa'], ['staging']]);
    });

    it('a local module instantiated from env directories carries every caller environment, transitively', () => {
        expect(envsOf(out, 'aws_vpc.this')).toEqual([['dev', 'prod']]);
        expect(envsOf(out, 'aws_subnet.a')).toEqual([['dev', 'prod']]);
    });

    it('env-named var files beside a root module name its environments; auto and default var files do not', () => {
        expect(envsOf(out, 'aws_lambda_function.api')).toEqual([['dev', 'prod']]);
    });

    it('no convention, no environment: a module nobody calls, a file directly under envs/, a lone root', () => {
        expect(envsOf(out, 'aws_sns_topic.orphan')).toEqual([[]]);
        expect(envsOf(out, 'aws_iam_role.shared')).toEqual([[]]);
        expect(envsOf(out, 'aws_kms_key.k')).toEqual([[]]);
    });
});

describe('Terraform environments in the runtime payload', () => {
    it('the same module instantiated from envs/dev and envs/prod puts its resources in both columns', async () => {
        const dir = plant(LAYOUT);
        const { graph } = await buildFromRepo(dir, null, { lanes: true });
        const runtime = produceAreas(dir, graph, { hunks: [] }).areas.runtime!;
        expect(runtime.environments).toEqual(['dev', 'prod', 'qa', 'staging']);
        const byName = (n: string) => runtime.resources.filter((r) => r.name === n);
        expect(byName('aws_vpc.this').map((r) => r.environments)).toEqual([['dev', 'prod']]);
        expect(byName('aws_s3_bucket.media').flatMap((r) => r.environments).sort()).toEqual(['dev', 'prod']);
        expect(byName('aws_kms_key.k').map((r) => r.environments)).toEqual([[]]);
    }, 60_000);
});
