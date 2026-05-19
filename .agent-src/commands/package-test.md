---
name: package-test
tier: 2
skills: [composer, npm, python-packages, go-modules, cargo-packages]
description: /package-test
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Package-internal — only the event4u/agent-config repo runs this."
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# package-test

Test a local package in the current project by linking it via Composer or npm.

## Instructions

### 1. Detect or ask for package manager

Check the project root for a package manifest. Supported (try in this order, take the first match — the project can have several):

| Manifest                                                          | Ecosystem        | Link mechanism                                           |
|-------------------------------------------------------------------|------------------|----------------------------------------------------------|
| `composer.json`                                                   | PHP / Composer   | `repositories[].type: path` + `composer require @dev`    |
| `package.json`                                                    | JS / TS / Node   | `npm link` / `pnpm link` / `yarn link` / `file:../path`  |
| `pyproject.toml`, `setup.py`, or `setup.cfg`                      | Python           | `pip install -e <path>` / `uv pip install -e <path>` / `poetry add --editable <path>` |
| `go.mod`                                                          | Go               | `go mod edit -replace example.com/pkg=<path>`            |
| `Cargo.toml`                                                      | Rust             | `cargo add --path <path>` or `[patch.crates-io]` block   |
| `Gemfile`                                                         | Ruby             | `bundle config local.<gem> <path>`                       |

- **Multiple manifests exist** → ask:

```
Which package manager?

1. Composer (PHP)
2. npm / pnpm / yarn (JavaScript / TypeScript)
3. Python (pip / poetry / uv)
4. Go modules
5. Cargo (Rust)
6. Bundler (Ruby)
```

- **Only one exists** → use that one automatically, confirm:

```
Detected: {manager}. Proceeding.
```

- **Neither exists** → abort:

```
❌  No supported package manifest (composer.json / package.json / pyproject.toml / setup.py / go.mod / Cargo.toml / Gemfile) found in project root. Cannot link a local package.
```

### 2. Ask for the local package path

```
Where is the local package located?

Provide the absolute or relative path to the package directory.
Example: ../my-package or /Users/me/projects/my-package
```

Validate:
- Path exists and is a directory
- The directory contains a manifest matching the ecosystem chosen in the detection step (`composer.json`, `package.json`, `pyproject.toml` / `setup.py`, `go.mod`, `Cargo.toml`, or `Gemfile`)
- If the directory has multiple manifests, ask the user which one to link (rare but possible — e.g. a Composer package that also ships a JS bundle)

If invalid, show error and ask again.

### 3. Read the package name

- **Composer:** Read `name` from the package's `composer.json` (e.g. `vendor/package`)
- **npm / pnpm / yarn:** Read `name` from the package's `package.json` (e.g. `@scope/package`)
- **Python:** Read `[project].name` from `pyproject.toml`, or `setup(name=...)` from `setup.py`
- **Go:** Read `module` from `go.mod` (e.g. `example.com/vendor/package`)
- **Rust:** Read `[package].name` from `Cargo.toml`
- **Ruby:** Read the gem name from the `*.gemspec` file in the package directory

Confirm:

```
📦 Found package: {package-name}
   Path: {resolved-absolute-path}

1. Link it
2. Different package — let me re-enter
3. Cancel
```

### 4. Link the package

#### Composer

Add or update `repositories` array in the **project's** `composer.json`:

```json
{
    "type": "path",
    "url": "{absolute-path-to-package}",
    "options": {
        "symlink": true
    }
}
```

Then run:

```bash
composer require {package-name}:@dev
```

If the package is already required, run instead:

```bash
composer update {package-name}
```

#### npm

Run:

```bash
npm link {absolute-path-to-package}
```

Or for workspaces, add to `package.json`:

```json
"overrides": {
    "{package-name}": "file:{relative-or-absolute-path}"
}
```

Then: `npm install`

#### Python

Editable install (preferred):

```bash
pip install -e {package-path}
# or, if the project uses uv:
uv pip install -e {package-path}
# or, if the project uses poetry:
cd {project-root} && poetry add --editable {package-path}
```

Re-sync after upstream changes:

```bash
pip install -e {package-path} --force-reinstall --no-deps
```

#### Go

Edit `go.mod` in the **project** root to add a `replace` directive:

```
replace example.com/vendor/package => ../my-package
```

Then run `go mod tidy` so the lockfile picks up the local path. Remove the `replace` line before publishing.

#### Rust / Cargo

Add as a path dependency in the **project's** `Cargo.toml`:

```toml
[dependencies]
vendor_package = { path = "../my-package" }
```

Or, to override a published crate without rewriting the dependency line, use `[patch.crates-io]`:

```toml
[patch.crates-io]
vendor_package = { path = "../my-package" }
```

Run `cargo build` to re-resolve.

#### Ruby / Bundler

```bash
bundle config local.{gem-name} {package-path}
bundle install
```

Remove with `bundle config --delete local.{gem-name}`.

### 5. Verify

- **Composer:** Check that `vendor/{package-name}` is a symlink → the local path
- **npm / pnpm / yarn:** Check that `node_modules/{package-name}` is a symlink → the local path
- **Python:** `pip show {package-name}` → `Location` should point inside `{package-path}` (editable installs show the source dir, not site-packages)
- **Go:** `go list -m {module-path}` → resolved path should match the `replace` target
- **Rust:** `cargo metadata --format-version 1 | jq '.packages[] | select(.name=="{package-name}") | .manifest_path'` → should point inside `{package-path}`
- **Ruby:** `bundle config get local.{gem-name}` → should return the linked path

Report result:

```
✅  {package-name} linked successfully.
   vendor/{package-name} → {local-path}

To remove: run /package-reset
```

### 6. Remind about .gitignore

If the `repositories` entry (Composer) or `overrides` (npm) was added:

```
⚠️  Local package link added to {file}. Don't commit this change to the repository.
```

## Error Handling

- If `composer require` or `npm link` fails, show the error output and suggest:

```
1. Retry
2. Show me the full error
3. Cancel — I'll fix manually
```

## Notes

- Composer path repositories with `symlink: true` create a symlink in `vendor/` pointing to the local directory. Changes in the local package are immediately reflected.
- npm link creates a symlink in `node_modules/`.
- Multiple local packages can be linked simultaneously. Each `/package-test` invocation adds one.
- The `/package-reset` command reverses these changes.
