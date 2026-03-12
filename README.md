# Terroir

**Your work, rooted in one place.**

Terroir is a TUI that brings order to the sprawl of modern software development — the branches, the tickets, the editors, the terminals, the context switches. It gives you a single place to see everything you're working on and jump into any context, without leaving the terminal.

## The problem

You're juggling three epics, seven stories across four repos, each with branches in various states of progress. Your Jira board is open in one tab, GitLab MRs in another, you're SSH'd into a tmux session you forgot about, and you can't remember if that feature branch was rebased.

## What Terroir does

Terroir organizes your work as **Epics → Stories → Repos → Branches**. Each branch gets a *session* — a set of tools (shell, editor, git client, AI assistant, whatever you configure) launched together and managed as a unit.

From one TUI, you can:

- **See everything at a glance** — repos, branches, git status, commit logs, dirty/clean state, ahead/behind counts
- **Jump into any context instantly** — select a story, hit Enter, and your full dev environment spins up
- **Track progress without leaving the terminal** — tasks per story, ticket status from Jira, MR and pipeline status from GitLab/GitHub
- **Discover and prune branches** — find branches matching your tickets, clean up stale ones
- **Get AI-powered task suggestions** — point it at Claude (or any LLM) and let it break down tickets into implementation tasks
- **Stay in flow** — no browser tabs, no context switching, no ceremony

## Quick start

```bash
# Clone and build (requires Go and CGO)
git clone https://github.com/ahokinson/terroir.git
cd terroir
task build        # or: go build -o bin/terroir ./cmd/terroir
task install      # symlinks to /usr/local/bin

# Launch
terroir
```

On first run, Terroir walks you through setup — pick your projects root, connect your repos, and you're off.

## Configuration

Terroir keeps its config in `~/.config/terroir/`:

- **config.yaml** — tools, integrations, preferences
- **keybindings.yaml** — remappable key bindings
- **terroir.db** — your epics, stories, and branches (powered by [Turso](https://turso.tech)'s libSQL, an open-contribution fork of SQLite)

### Default session tools

Every session launches with a configurable set of tools as tmux windows:

```yaml
default_tools:
  - name: zsh
    command: zsh
  - name: nvim
    command: nvim
  - name: lazygit
    command: lazygit
  - name: claude
    command: claude
```

### Integrations

Connect your ticket tracker and git provider for a fully unified view:

```yaml
# Jira (set JIRA_URL, JIRA_EMAIL, JIRA_TOKEN env vars)
ticket:
  provider: jira
  jql: "project = PLAT AND sprint in openSprints()"

# GitLab (set GITLAB_URL, GITLAB_TOKEN env vars)
git:
  provider: gitlab
```

## Philosophy

We're in the middle of a terminal renaissance. Tools like lazygit, neovim, and Claude Code have proven that the terminal isn't a relic — it's the most powerful interface developers have. Terroir leans into that momentum. It doesn't replace your tools. It orchestrates them.

The name comes from coffee — *terroir* is the soil, climate, and growing conditions that give a bean its character. The same variety grown in different terroir produces something completely different. Your dev environment works the same way. The right tools, in the right arrangement, in the right place, shape everything that follows.

Terroir isn't an IDE or a project manager. It's the connective tissue between the tools you already use — a home base that keeps you oriented without moving anything.

AI tools are integrated as CLI sessions — `claude`, `opencode`, `codex` — rather than via API. CLIs handle auth, context management, and features that would otherwise need to be built and maintained. They also operate under license terms that direct API access doesn't always provide.

## License

MIT
