# AI-First Language Principles

This project is not just building a language for human developers. It is building a language that should be easy for AI agents to generate, edit, validate, and optimize.

That changes the design priorities.

## Primary Goals

1. Speed
2. Ease of authoring
3. Determinism for agents
4. Strong validation
5. Low-friction full-stack workflows

## What “AI-First” Means

### 0. Words should map directly to behavior

The language should read like simple English commands where the words do what they say.

Why:
- this reduces the translation burden for both humans and AI
- it makes the language easier to learn from examples
- it aligns syntax with intent instead of historical programming jargon

Rule:
- prefer command phrases like `increase size by 10px` over abstract API names
- prefer domain words like `text`, `color`, `move`, `show`, `hide`, `click`
- avoid names that only make sense if someone already knows another language

### 1. Canonical syntax

The language should have one obvious way to express a concept.

Why:
- agents perform better when syntax is consistent
- fewer equivalent spellings reduce ambiguity
- normalization becomes cheaper

Rule:
- avoid synonyms like `set`, `change`, `update` all meaning the same thing
- prefer one canonical keyword sequence per operation

### 2. Low ambiguity

The language should not depend on loose natural language.

Why:
- vague “English-like” syntax is easier for demos and worse for compilers
- AI models need strict patterns to avoid hallucinated forms

Rule:
- simple words are good
- free-form grammar is bad
- “English-like” should mean short command phrases, not unconstrained prose

### 3. Stable references

Agents need durable handles for editing.

Why:
- re-numbering UI nodes or actions causes cascading edits
- stable IDs are easier for refactors, diffs, and tool automation

Rule:
- named IDs are preferred over positional numbering
- later we can support optional auto-generated IDs, but canonical output should use stable names

### 4. Patch-friendly structure

Source should be easy to modify in small localized edits.

Why:
- AI agents often work incrementally
- localized edits reduce unintended breakage

Rule:
- blocks should be structurally simple
- one declaration per line
- predictable ordering rules

### 5. Deterministic formatting

Formatting should converge to one normal form.

Why:
- agents produce cleaner diffs when formatting is predictable
- semantic review becomes easier

Rule:
- build a formatter early
- define canonical block ordering and field ordering

### 6. Built-in validation

The compiler should catch agent mistakes early.

Why:
- AI-generated code will often be syntactically close but semantically wrong
- stronger diagnostics reduce repair loops

Rule:
- IDs, references, effects, and types should all be validated
- errors should include exact source spans and actionable messages

### 7. Capability-explicit design

Nothing important should be ambient.

Why:
- agents need safe boundaries around network, storage, file, time, and secrets
- explicit capabilities improve both security and reasoning

Rule:
- no hidden globals for sensitive operations
- server/client boundaries must be declared

### 8. Token efficiency

The language should compress intent well.

Why:
- AI systems pay for context and output tokens
- shorter canonical forms reduce cost and improve throughput

Rule:
- keep syntax compact
- avoid boilerplate wrappers when the compiler can infer structure safely

### 9. Mechanical transformability

The language should be easy to refactor by tools.

Why:
- AI agents need to rename, reorder, extract, and inline safely

Rule:
- AST-preserving transforms should be straightforward
- avoid semantic meaning hidden in whitespace or declaration order unless explicitly designed

### 10. Observable semantics

Agents need to understand what a program will do.

Why:
- debugging generated programs requires introspection
- performance work requires visible intermediate forms

Rule:
- expose AST, IR, bytecode, diagnostics, and runtime traces through tooling

## AI-First Consequences For Language Design

### Syntax

- use plain action words that match user intent
- use strict grammar
- use stable IDs
- avoid magic overloading
- prefer explicit state and event blocks over hidden runtime conventions
- prefer low-jargon property names where possible

Example direction:

- `increase size by 10px`
- `set text to "Ready"`
- `move login before pricing`
- `when click start { show panel checkout }`

### Compiler

- parser must recover gracefully and report precise locations
- semantic checks must catch unresolved references and invalid effects
- compiler should emit inspectable IR for agents

### Runtime

- runtime costs should be predictable
- UI updates should be structural and observable
- side effects should be visible in the program model

### Tooling

- formatter is mandatory
- language server is mandatory
- machine-readable diagnostics are mandatory
- benchmark and trace tools should be first-class

## Non-Goals

- not trying to be “natural language programming”
- not trying to support every legacy web pattern
- not optimizing for hand-written cleverness
- not importing technical jargon just because older languages used it

## Short Version

The best AI language is not the loosest one. It is the most predictable one.
The best easy language is not random English. It is simple English-shaped commands with strict meaning.
