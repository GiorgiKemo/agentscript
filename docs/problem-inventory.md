# Problem Inventory

This is **not** a claim that we know every bug in JavaScript, browsers, or web development. That is not realistic. This is the prioritized inventory of structural problems we should explicitly design against if we want a serious alternative for full-stack web developers.

## P0: Language Semantics We Should Not Repeat

### 1. Implicit coercion

Problem:
JavaScript silently converts values across types through rules that are easy to trigger and hard to predict.

Impact:
This creates runtime surprises, weakens static analysis, and makes optimization less reliable.

Design response:
- no implicit coercion between strings, numbers, booleans, collections, or null-like values
- explicit conversion syntax only

### 2. Multiple null-like states

Problem:
`null`, `undefined`, missing keys, array holes, and `NaN` all behave differently.

Impact:
Developers spend time defending against absence instead of modeling it clearly.

Design response:
- one canonical optional type
- no array holes
- explicit result and option types

### 3. Prototype inheritance and `this`

Problem:
Prototype chains, dynamic `this`, method rebinding, and context loss are historical language traps.

Impact:
Code is harder to reason about and harder for tools to optimize safely.

Design response:
- no prototype inheritance
- no ambient `this`
- value types and explicit objects only

### 4. Mutable-by-default state

Problem:
Most JS objects are mutable and shared aliasing is common.

Impact:
This causes accidental coupling, race conditions, and fragile UI state.

Design response:
- immutable by default
- explicit mutable cells where needed
- ownership-oriented state transitions

### 5. Floating-point-only arithmetic

Problem:
Standard JS numbers are binary floating-point, which is wrong for many business and UI calculations.

Impact:
Precision bugs leak into finance, layout math, and data handling.

Design response:
- separate integer, decimal, and float types
- no silent numeric widening

### 6. Historical syntax hazards

Problem:
Hoisting, legacy declarations, and automatic semicolon insertion complicate reasoning.

Impact:
The parser accepts code that humans do not intend.

Design response:
- strict grammar
- no hoisting
- no optional separators that change meaning

### 7. Exception-heavy error model

Problem:
JavaScript mixes exceptions, rejected promises, callback errors, and process-level failures.

Impact:
Error flow is fragmented and easy to mishandle.

Design response:
- structured `result` values for recoverable failures
- typed effects for I/O
- panics reserved for unrecoverable runtime failures

## P0: Runtime and Engine Problems To Avoid

### 8. JIT unpredictability

Problem:
Performance in JS engines depends on hidden classes, inline caches, speculative optimization, and deoptimization.

Impact:
Identical-looking code can perform very differently as data shapes change.

Design response:
- stable value layouts
- ahead-of-time analyzable IR
- predictable runtime costs

### 9. Stop-the-world GC sensitivity

Problem:
Garbage collection pauses and allocation-heavy patterns can stall UI responsiveness.

Impact:
Apps feel inconsistent under load.

Design response:
- compact value representations
- controlled allocation strategy
- object pools or arena-style regions where appropriate

### 10. Single-threaded UI pressure

Problem:
The browser main thread is overloaded with input, layout, paint, script, and timers.

Impact:
A language can be efficient but still feel slow if it forces work onto the main thread.

Design response:
- incremental scheduling model
- worker-friendly computation model
- renderer that minimizes main-thread churn

### 11. DOM as a large mutable graph

Problem:
DOM mutation is convenient but expensive and semantically loose.

Impact:
Frameworks compensate with diffing, memoization, hydration logic, and large runtimes.

Design response:
- explicit UI tree IR
- stable node identity
- deterministic patching instead of ad hoc mutation

### 12. Layout and style invalidation costs

Problem:
Small DOM or CSS changes can trigger expensive reflow and repaint cascades.

Impact:
Performance debugging becomes platform-specific and difficult.

Design response:
- renderer designed around batched updates
- layout-conscious primitives
- measurable invalidation boundaries

## P1: Web Platform Problems We Need a Strategy For

### 13. CSS cascade leakage

Problem:
Global selectors and inheritance cause accidental style coupling.

Impact:
Large apps become difficult to refactor safely.

Design response:
- scoped styling model
- deterministic style precedence
- tokens and themes as first-class language features

### 14. Hydration complexity

Problem:
Modern web stacks often render on the server, then replay client logic to attach interactivity.

Impact:
This creates double work, mismatch bugs, and large JS payloads.

Design response:
- explicit server and client boundaries
- resumable or patch-based hydration strategy
- capability-driven client code generation

### 15. Async fragmentation

Problem:
Web apps coordinate fetches, streaming, user events, workers, timers, and storage through loosely related APIs.

Impact:
The developer model is inconsistent and failure handling is brittle.

Design response:
- unified task model
- cancellation built in
- deadlines, retries, and structured concurrency

### 16. Capability-free global environment

Problem:
Most web APIs are ambient globals.

Impact:
Security and testability both suffer.

Design response:
- capabilities passed explicitly
- no implicit access to network, file, storage, or time

### 17. Serialization boundaries

Problem:
JSON, DOM events, URL params, form data, and storage all serialize values differently.

Impact:
Data bugs appear at edges between systems.

Design response:
- one typed data model
- schema-aware codecs
- versioned binary and textual wire formats

## P1: Tooling and Ecosystem Problems

### 18. Bundler and transpiler dependency

Problem:
Modern web development often depends on a large toolchain stack before app logic even runs.

Impact:
Cold start, debugging, and upgrades all get harder.

Design response:
- compiler owns the pipeline
- minimal external build steps
- reproducible outputs

### 19. Dependency and supply-chain risk

Problem:
JavaScript ecosystems often pull many transitive dependencies for small features.

Impact:
Security and reliability degrade.

Design response:
- batteries-included standard library
- small dependency surface
- signed packages and lockfile verification later

### 20. Weak diagnostics

Problem:
Errors are often surfaced late and source maps can obscure the real cause.

Impact:
Developer productivity drops.

Design response:
- compiler phases with precise diagnostics
- source spans everywhere
- deterministic reproduction steps

### 21. Node/browser/server divergence

Problem:
Full-stack JS is one language with many incompatible runtimes and edge cases.

Impact:
Code sharing is harder than the marketing suggests.

Design response:
- one core language
- explicit target capabilities
- per-target adapters rather than magical shared globals

## P2: Product and Platform Risks

### 22. “Best on earth” trap

Problem:
Trying to beat every language in every benchmark from day one leads to bad architecture and fake claims.

Impact:
Projects optimize for hype instead of correctness.

Design response:
- pick measurable goals
- benchmark against explicit workloads
- improve by profile, not ego

### 23. General-purpose scope creep

Problem:
A language for all use cases is much harder than a language optimized for full-stack web applications.

Impact:
The design becomes incoherent.

Design response:
- start web-first
- define non-goals early
- add domains only after the core model is proven

### 24. Ecosystem bootstrap problem

Problem:
A language is not useful without tooling, libraries, debugging, package management, and deployment support.

Impact:
Even a good core language can fail in practice.

Design response:
- treat tooling as a core feature, not a later add-on
- build tests, formatter, LSP, docs, and package story in parallel

### 25. Human-first syntax that is bad for agents

Problem:
Many languages assume the author is a human typing manually, not an agent generating structured code under context and token limits.

Impact:
AI-generated code becomes verbose, inconsistent, and harder to validate automatically.

Design response:
- canonical syntax only
- stable IDs
- patch-friendly structure
- agent-readable diagnostics

### 26. Hidden semantics and magic conventions

Problem:
Frameworks often encode meaning in file names, directory layout, naming conventions, or runtime conventions.

Impact:
Agents can reproduce the syntax but miss the invisible rules.

Design response:
- make important semantics explicit in source
- reduce convention-only behavior
- expose compiler IR and capability boundaries

## What This Means For Our Build Order

Before adding major new syntax, we need:

1. a formal grammar
2. an AST and semantic IR
3. deterministic diagnostics
4. a benchmark suite
5. a test harness
6. a clear runtime boundary for browser, server, and workers
7. an AI-first design charter so syntax stays deterministic and easy for agents

Without those, we will build features faster than we can verify them.
