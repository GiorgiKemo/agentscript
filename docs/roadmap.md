# Roadmap

This roadmap is ordered by dependency, not by excitement. Each phase unlocks the next one. We should not skip earlier phases because every skipped foundation becomes expensive later.

## Phase 0: Charter and Constraints

Status: in progress

Goals:
- define the problem we are solving: full-stack web development
- define the primary audience: humans and AI agents building full-stack products together
- define non-goals: not replacing every CPU target on day one
- define success metrics for startup time, bundle size, memory, and render throughput
- define AI-first constraints: canonical syntax, stable IDs, deterministic formatting, explicit capabilities
- define the plain-language command surface so common operations read like obvious English
- define the browser boundary: DOM renderer first, custom VM second, Wasm/native later

Deliverables:
- architecture notes
- benchmark plan
- naming for language, IR, bytecode, and runtime
- AI-first design principles

Exit criteria:
- we can explain exactly what “better than JS for web developers and agents” means in measurable terms

## Phase 1: Compiler Core

Priority: highest

Goals:
- replace ad hoc parsing with a formal lexer and parser
- produce a typed AST with source spans
- standardize diagnostics
- preserve a canonical syntax that agents can generate reliably
- favor low-jargon surface syntax where words map directly to effects
- add a `check` command and test suite

Deliverables:
- lexer
- parser
- AST model
- diagnostics system
- golden tests and failure tests

Exit criteria:
- syntax and structural errors are caught deterministically with useful messages

## Phase 2: Semantic Model

Priority: highest

Goals:
- define symbol resolution, scopes, IDs, and layout/style references
- introduce a semantic IR that the parser does not know about
- validate impossible states before code generation
- normalize equivalent source forms into one canonical program shape for downstream tools

Deliverables:
- semantic analyzer
- IR types
- validation rules
- normalized layout tree and style model

Exit criteria:
- front-end compiler stages are independent from output backends

## Phase 3: Type System and Effects

Priority: high

Goals:
- add explicit value types, option/result types, and effect boundaries
- specify state, events, async tasks, and resource ownership
- forbid ambient capabilities by default
- keep the model compact enough that agents can emit it with low token overhead

Deliverables:
- type checker
- effect checker
- core standard types
- data model for client/server exchange

Exit criteria:
- interactivity can be modeled without hidden runtime magic

## Phase 4: Bytecode and VM

Priority: high

Goals:
- define stable bytecode for the semantic IR
- design a small VM or interpreter for browser and server execution
- make the runtime cost model predictable

Deliverables:
- bytecode spec
- instruction set
- verifier
- interpreter

Exit criteria:
- a compiled program can execute without falling back to the current prototype shortcuts

## Phase 5: Web Renderer

Priority: high

Goals:
- build a renderer that patches UI from semantic state transitions
- minimize DOM churn
- keep style scoping deterministic

Deliverables:
- render tree
- diff and patch system
- event binding model
- scoped style compiler

Exit criteria:
- interactive components can update without full rerender logic

## Phase 6: Server Runtime

Priority: medium

Goals:
- support routing, request handling, streaming, forms, and database boundaries
- keep server and browser semantics aligned

Deliverables:
- HTTP abstractions
- server entry format
- serialization and schema codecs
- server test harness

Exit criteria:
- one language can drive both page generation and server actions with explicit boundaries

## Phase 7: Tooling

Priority: medium

Goals:
- make the language usable by real developers
- make the language easy for agents to inspect, rewrite, and repair

Deliverables:
- formatter
- language server
- package manager or module story
- debugger hooks
- benchmark command
- machine-readable diagnostics and IR inspection commands

Exit criteria:
- editing, debugging, and upgrading are practical

## Phase 8: Performance Program

Priority: continuous

Goals:
- optimize based on workloads, not guesswork

Deliverables:
- benchmark suites against React, Vue, Svelte, Solid, and server-first stacks
- memory profiles
- cold-start profiles
- SSR and hydration comparisons

Exit criteria:
- we have real numbers for the workloads we care about

## Immediate Work Queue

### P0

1. Formalize the current prototype into a clearer compiler pipeline.
2. Add tests to prevent regressions while the language evolves.
3. Document the defect inventory and phased roadmap.
4. Lock the AI-first design rules before syntax grows.

### P1

1. Introduce a real lexer and AST.
2. Separate parsing from semantic validation.
3. Define the initial IR and event/state model.
4. Prefer stable named IDs over positional references in canonical output.
5. Design a human-English command layer that lowers into the canonical IR without adding ambiguity.

### P2

1. Add interactivity and state to the language.
2. Replace the current renderer shortcuts with a patch-based renderer.
3. Start a benchmark harness.
4. Build a formatter so AI-generated code converges to one stable form.

## Non-Negotiable Engineering Rules

1. Every new language feature needs grammar, diagnostics, tests, and benchmark impact notes.
2. Every runtime feature needs a clear capability boundary.
3. No performance claims without benchmark evidence.
4. No “temporary” semantics we expect to regret later.
5. We optimize the web use case first, not every use case at once.
6. If a syntax choice is good for demos and bad for agents, we reject it.
7. If a syntax choice is technically pure but obviously harder than plain-English phrasing, we reconsider it.
