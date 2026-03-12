# Contributing to Terroir

## Setup

Requires Go with CGO enabled (for go-libsql).

```bash
task build    # builds to bin/terroir
task run      # run directly via go run
task install  # build + symlink to /usr/local/bin
```

Avoid adding dependencies. Prefer stdlib or vendoring a small snippet over pulling in a new module. If a dependency is unavoidable, run `go get` then `go mod tidy`. CGO dependencies may require system libraries.

## Design Philosophy

**Minimum necessary complexity.** Don't add features, abstractions, or configurability beyond what a change requires. Three similar lines of code are preferable to a premature abstraction. Solve the current problem.

**Self-documenting code.** If a piece of logic needs explanation, the explanation belongs in CLAUDE.md (Caveats section), not in an inline comment. Code should read clearly on its own.

**No over-engineering.** Don't add error handling, fallbacks, or validation for scenarios that can't happen in practice. Don't use feature flags or backwards-compatibility shims when you can just change the code.

**Prefer CLI tools over APIs for AI integration.** Tools like `claude`, `opencode`, and `codex` handle auth, context management, and UX that would otherwise need to be built and maintained. They also operate under license terms that direct API access doesn't always provide.

## What Belongs Where

- **New modal** → `tui/modals/` subpackage, never in tui root
- **New panel renderer** → `tui/panes/` subpackage, never in tui root
- **New domain package** → `internal/<name>/`, following factory function pattern (`New(...) (Interface, error)`)
- **Multi-step workflow with state** → its own file (e.g. `prune.go`, `drift.go`), not added to `handlers.go`
- **Simple handler** → `handlers.go` is fine until it warrants its own file

## Code Style

- Package names: short singular nouns. No `util`, `utils`, `common`, `helpers`.
- Don't prefix type names with their package name (`git.Config`, not `git.GitConfig`). Exception: types in `types/` that need disambiguation (e.g. `types.GitConfig` vs `types.TicketConfig`).
- Define interfaces at the consumer, not the implementor. Exception: shared provider interfaces in `types/`.

- Named constants in `constants.go` for any layout size, timeout, limit, or threshold — no numeric literals inline.
- Use `fmt.Fprintf` with `\n` for render output, never `Fprintln`.

## Pull Requests

- Keep changes focused. A bug fix shouldn't also refactor surrounding code.
- Don't add docstrings, comments, or type annotations to code you didn't change.
- If you're adding a new integration point (connector, runner, provider), follow the existing factory + interface pattern rather than introducing a new pattern.
