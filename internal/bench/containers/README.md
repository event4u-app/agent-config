# Benchmark containers

Two images for running ab-v2 trials in isolation (`bench_ab_v2_run --isolation container`):

| Image | Holds |
|---|---|
| `bench-base` | Node 22 (pinned by digest), the Claude Code CLI at a pinned version, `git`, `php-cli`, a non-root user with an empty home |
| `bench-ac` | `bench-base` plus agent-config, installed from a tarball of the tree under test with `agent-config init --yes --no-ui --offline --tools=claude-code` |

Arms that load the package run in `bench-ac`; every other arm runs in `bench-base`. All arms get the same CLI arguments.

## Build the images

```bash
./scripts-run src/scripts/bench_ab_images                      # default CLI pin
./scripts-run src/scripts/bench_ab_images --cli-version 2.1.316
```

The script packs the current tree, builds both images and writes `images.json` (gitignored). That file records the image ids, the CLI version, the package version, and the commit plus whether the tree was dirty. The runner reads the ids from this file, never a tag. The installed file list is at `/opt/bench/install-manifest.txt` inside `bench-ac`.

## Create the token once

The runs authenticate with your Claude subscription through a long-lived token, never your local profile. Your profile would bring your plugins, hooks and `CLAUDE.md` into the run. On macOS the login lives in the Keychain, so it cannot be copied anyway.

```bash
claude setup-token                                   # opens the browser, prints the token
mkdir -p ~/.event4u/agent-config/secrets
pbpaste > ~/.event4u/agent-config/secrets/claude-oauth-token
chmod 600 ~/.event4u/agent-config/secrets/claude-oauth-token
```

**Several accounts.** Put one token file per account in `~/.event4u/agent-config/secrets/claude-oauth-tokens/<name>`, each with mode 0600. A sweep runs on **one** account: the one named with `--account <name>`, otherwise the first. It never switches accounts on its own. When an account hits its usage limit, the brake stops the sweep and prints the other accounts that have a token. Resume with the same command plus `--account <name>`. The checkpoint carries over, and the report names the account it ran on, never the token.

You can also set `CLAUDE_CODE_OAUTH_TOKEN` in the environment. The runner:

- refuses a token file other users can read,
- passes the token into the container by name only,
- drops `ANTHROPIC_API_KEY`, which would otherwise take precedence over the subscription without saying so,
- redacts the token from every transcript.

## Run a sweep

```bash
./scripts-run src/scripts/bench_ab_v2_run --isolation container \
  --arms vanilla,package --tasks trapE-scope-01,trapE-scope-02 \
  --seeds 12 --model claude-haiku-4-5 --budget 1 --max-usd 15
```

Each trial runs in a fresh `docker run --rm` with the clone mounted at `/work`. The runner checks every trial before it counts:

- **Load check:** the `system/init` event must show package skills in `bench-ac` and none in `bench-base`. A mismatch marks the trial errored with a `load_mismatch:` reason, so it drops out of the statistics.
- **Usage-limit stop:** three runs in a row that did no work end the sweep, for example when the subscription's usage limit is reached. Resume later with the checkpoint.

Reports are written to `internal/bench/reports/ab-v2/` in the **primary** checkout, also when the runner runs in a worktree.

`--mode selftest --isolation container` runs the whole pipeline without network, token or images.

## Artifact sweeps

`--corpus artifact` does not run in a container: each arm gets a temp HOME and a workspace outside the repository. The `package` arm packs the checkout once per sweep and installs it into that HOME with the public installer, the same command `Dockerfile.ac` runs; a `package` run without installed skills, or a control run with any, is recorded as `load_mismatch` and never reaches the host. Each run's session transcript is kept beside the report in `<report>-transcripts/`.

The PHP tasks (`art-login-plain-01`, `art-login-framework-01`, `art-php-endpoint-01`) need `php` for grading. On a host without it:

```bash
docker pull php:8.3-cli
BENCH_PHP_BIN="$PWD/internal/bench/containers/php-in-docker.sh" \
  ./scripts-run src/scripts/bench_ab_v2_run --corpus artifact --tasks art-login-plain-01 ...
```

`BENCH_PHP_BIN=… ./scripts-run src/scripts/bench_artifact_selftest --task <id>` checks the grader first, at no cost.
