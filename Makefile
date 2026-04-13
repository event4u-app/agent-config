.PHONY: sync sync-check sync-list install-hooks

## Sync non-.md files from .augment.uncompressed/ to .augment/ + cleanup stale
sync:
	@bash scripts/compress.sh --sync

## List .md files that need compression by the agent
sync-list:
	@bash scripts/compress.sh --list

## Check if .augment/ is in sync with .augment.uncompressed/ (for CI)
sync-check:
	@bash scripts/compress.sh --check

## Install git hooks (pre-push sync check)
install-hooks:
	@bash scripts/install-hooks.sh
