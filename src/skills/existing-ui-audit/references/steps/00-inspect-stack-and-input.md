# 0. Inspect stack and input

1. Read `state.stack.frontend` — set by `scripts/work_engine/stack/detect.ts` (one of `blade-livewire-flux`, `react-shadcn`, `vue`, `plain`).
2. Read `state.input` — the request being processed. The audit must answer: "what already exists that is similar to this request?"
