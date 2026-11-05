PYTHON ?= .venv/bin/python
NPM ?= npm

.PHONY: install validate test check build dev-api dev-web migrate sync-content add-entry schemas
install:
	python3 -m venv .venv
	$(PYTHON) -m pip install -e 'apps/api[dev]'
	$(NPM) ci
	mkdir -p work

validate:
	$(PYTHON) -m app.content validate

schemas:
	$(PYTHON) -m app.content schemas

test:
	$(PYTHON) -m pytest apps/api/tests
	$(NPM) run test --workspace apps/web

check: validate
	$(PYTHON) -m ruff check --config apps/api/pyproject.toml apps/api scripts
	$(PYTHON) -m ruff format --config apps/api/pyproject.toml --check apps/api scripts
	$(NPM) run typecheck --workspace apps/web
	$(NPM) run lint --workspace apps/web
	$(NPM) run format:check --workspace apps/web

build:
	$(NPM) run build --workspace apps/web

dev-api:
	$(PYTHON) -m uvicorn app.main:app --reload

dev-web:
	$(NPM) run dev --workspace apps/web

migrate:
	mkdir -p work
	$(PYTHON) -m alembic -c apps/api/alembic.ini upgrade head

sync-content: validate
	$(PYTHON) -m app.content sync

add-entry:
	$(PYTHON) scripts/add_entry.py --collection '$(COLLECTION)' --date '$(DATE)' $(if $(PAYLOAD),--payload-file '$(PAYLOAD)')
