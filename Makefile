.DEFAULT_GOAL := help
SHELL := /usr/bin/env bash

.PHONY: help install install-cc install-skill verify doctor test scan lint check-docs ci

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n",$$1,$$2}'

install: ## Install launchers to ~/bin (mirrors backends/bin)
	./backends/install.sh

install-cc: ## Install launchers and put pinned claude-code into each env
	./backends/install.sh --install-claude-code

verify: ## Launcher self-test + cc-models doctor
	./backends/verify.sh && cc-models doctor

doctor: ## Environment recon + workflow recommendation (run on any machine)
	bash orchestration/fanout/fanout doctor

install-skill: ## Install as a Claude Code skill (~/.claude/skills/fanout, backs up first if present)
	bash scripts/install-skill.sh

test: ## Run cn-plugin tests (node)
	npm test

scan: ## Secret-leak scan (local gate)
	bash scripts/scan-secrets.sh

lint: ## Script syntax (bash -n) + shellcheck
	bash scripts/check-shell.sh

check-docs: ## Docs-drift gate (README subcommands/counts == actual code)
	bash scripts/check-docs.sh

ci: scan lint check-docs test ## Full local CI (scan + lint + check-docs + test)
