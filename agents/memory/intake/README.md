# Memory intake

Append-only JSONL signal drop (`signals-YYYY-MM.jsonl`) written by `agent-config memory:signal` and read by `agent-config memory:learn` (the learning sidecar). Promotion into curated memory stays human via `/memory:propose`.

**This directory's skeleton is tracked; its contents are not.** `.gitkeep` and this README are committed so the write path exists on a fresh clone. The signal drops themselves are local scratch: gitignored here, ignored wholesale in a consumer install (`src/config/gitignore-block.txt`), and refused at commit time by `check_knowledge_sharing`, which stages nothing from this directory but those two files.

The `merge=union` attribute on `*.jsonl` (`.gitattributes`) is kept for the append-only shape rather than for this repository, where nothing is tracked for it to merge.

<!-- Earlier wording here read "Local + tracked", meaning the directory, and was
     read as meaning the signal files. It is spelled out because that reading
     cost a commit attempt the gate had to refuse. -->
