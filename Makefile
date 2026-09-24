# Fachada canónica (repo-standard P1). El stack real es pnpm.
# Uso: make lint | make test | make smoke | make validate
.PHONY: lint test smoke build validate

lint:
	pnpm run lint
	pnpm run typecheck

test:
	pnpm test

build:
	pnpm run build

smoke: build
	pnpm run smoke

validate: lint test smoke
