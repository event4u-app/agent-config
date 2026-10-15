<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-15, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# What may a content handle replace?

You are deciding one design question for a roadmap in a repository that ships
rules, skills and hooks for AI coding agents. Answer on the evidence below. Do
not summarise the evidence back. Name the option you choose, the strongest
argument against it, and anything the options miss.

## Background

The roadmap plans to let a large tool result reach the model shorter than the
host produced it, without losing anything: the full output is kept locally
under a handle, and the model receives a summary plus the handle. Its first
selection step (2026-10-15) found that the summary it planned — exit code,
every failure line, a head, a tail, a handle — has nothing to apply to:

- On this machine's transcripts (83,031 results), the large model-visible
  results are **file-content reads**: text `Read` (p95 42,029 bytes, no exit
  code), and Bash commands such as `sed -n`, `cat` and `git diff`. 2,599 Bash
  results above 8,192 bytes carry 36.7 % of Bash bytes; 13 of them carry a
  failure line.
- Results that carry failure lines are small (a test runner's p95 is 2,256
  bytes).

The owner chose to redesign the roadmap around a **content profile** for
file-content results, beside the existing execution profile. Which content
classes are in scope is already pre-registered and is not the question here.

## Constraints that hold whatever you choose

- One dispatcher stage is the only writer of any rewrite of a tool result. It
  has modes `observe` (detects and counts, never changes what the model sees),
  `protect` and `strict`. A local store may receive only a privacy-filtered
  view of a result, and that view exists only from `protect` upward.
- No store is built before the code that calls it exists.
- A model never writes the summary; it is deterministic.
- Arming is for the maintainer's own workspace only; consumers get no default.
- An existing advisory hook already notices a full `Read` of a file that was
  fully read earlier in the same session with an unchanged sha256, and says so
  in one line; it changes nothing.
- The host's own `Read` already truncates very long files and supports
  line-offset ranges.

## The question

When a content result is above the size threshold, what may the stage deliver
in its place?

- **(a) Shorten first reads.** Any selected content result above the threshold
  is delivered as path, range, digest, a structural outline (for example
  headings or top-level symbols with line numbers) and the handle. The model
  reads the parts it needs by a ranged read.
- **(b) Shorten only what is already in context.** A first read is always
  delivered whole. Only a result whose content the model has already received
  this session — same path, same digest, by `Read` or by a content-class Bash
  command — is delivered as a reference to the earlier result plus the handle.
  The store exists so that a reference stays recoverable after the earlier
  result has been compacted away.
- **(c) Head plus outline.** A first read above the threshold is delivered as
  its first N bytes verbatim, an outline of the remainder, and the handle.

Sub-question, whichever option you choose: should the handle retrieve the
bytes that were stored when the result was delivered, or re-read the file from
disk by path and range (which may have changed since)?
