# @org/ui — agent notes

<!--
  FIXTURE, and deliberately a BAD one. This file is the negative control for
  road-to-repo-playbooks 1.3: it restates a playbook step verbatim instead of pointing at
  the playbook. Two copies disagree the first time one is edited, and a reader then has no
  way to tell which one the repository actually follows.

  The GOOD shape is the pointer line at the bottom, which must NOT be flagged — naming the
  playbook is exactly the behaviour the contract wants.
-->

## How to add a component

1. **Run the repository's own generator** — `turbo gen component`

The generator writes the component, its test, and the barrel export.

## Pointer — the shape this file should have used

- [Run the repository's own generator — `turbo gen component`](../../agents/settings/contexts/add-ui-component.md)

  That link label is the step's own text, ON PURPOSE. It is the hardest case for the
  detector: a pointer whose label quotes the step it points at. Flagging it would forbid the
  clearest possible pointer, so the pointer carve-out must win here — and a fixture whose
  link label were merely *"add a component"* could not tell the two behaviours apart.
