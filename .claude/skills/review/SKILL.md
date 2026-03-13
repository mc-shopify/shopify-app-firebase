---
name: review
description: Review code against meowapps coding style rules. Use when user wants code review or style feedback.
---

Review the specified file(s) against these coding style rules. Report violations only — do not fix.

## Rules

1. **Declarative config over imperative setup** — chainable builder APIs, config reads as declaration
2. **Functions derive paths internally** — receive config, derive paths inside, never pass derived paths as params
3. **Standalone functions** — each produces complete, usable output, no external follow-up required
4. **Function name = what it actually does** — if it does more, rename or split
5. **Merge functions that always go together** — if two always pair and one's output only feeds the other, merge
6. **API accepts batch input** — accept arrays instead of being called in loops
7. **Don't pass params just for logging** — log what you already have
8. **No unnecessary clean/destroy** — write only if missing, don't auto-delete output dirs
9. **State lives with output** — registry inside dist/, rm dist/ = clean slate
10. **File organization follows call flow** — entry → orchestrator → workers → utilities, top-down
11. **Comments: "what" before, "why" inside** — 1-2 lines before declaration, inside only for non-obvious logic
12. **Consistent style for same patterns** — same operation → same pattern everywhere

## Conventions

- Section markers: `// --- name ---`
- Exports at top, implementation below
- Single-letter config: `c` for config, `r` for route, `h` for handler, `m` for module
- Import order: external packages → node built-ins → local
- Error handling: try-finally for cleanup, throw on GraphQL errors, silent catch only for optional file reads
- Async: Promise.all for parallel, async/await throughout, no callbacks
- Conditionals: optional chaining + nullish coalescing, ternary for simple, guard clauses for early returns
- Object.freeze for enums
- Functional React only, hooks, no class components
- Inline styles preferred over CSS files
- Template literals for interpolation, array join for multi-line code generation

## Output format

For each violation found:
1. File path and line number
2. Which rule is violated
3. What's wrong
4. What it should look like

If no violations found, say so.

$ARGUMENTS
