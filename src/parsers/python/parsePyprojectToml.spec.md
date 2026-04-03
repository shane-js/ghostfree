# parsePyprojectToml — Version Range Specification

> Primary source (PEP 621): https://peps.python.org/pep-0621/#dependencies-optional-dependencies
> Primary source (Poetry): https://python-poetry.org/docs/dependency-specification/
> PEP 440 specifiers: https://peps.python.org/pep-0440/#version-specifiers

`pyproject.toml` is parsed for two sections:
1. **PEP 621** `[project].dependencies` — uses PEP 440 specifiers (same as `requirements.txt`)
2. **Poetry** `[tool.poetry.dependencies]` — uses Poetry's `^`, `~`, `>=` syntax

## Version Range Handling — PEP 621 `[project].dependencies`

Uses the same PEP 440 regex as `parseRequirementsTxt`. See [parseRequirementsTxt.spec.md](parseRequirementsTxt.spec.md) for the full table.

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `httpx==0.24.0` | `0.24.0` | `vrc-exact` | `vrhp-passthrough` | Exact pin |
| `pydantic>=2.0.0` | `2.0.0` | `vrc-inclusive-minimum` | `vrhp-extract-lower` | Minimum version |
| `requests[security]~=2.28.0` | `2.28.0` | `vrc-compatible-release` | `vrhp-extract-lower` | Compatible release with extras |

## Version Range Handling — Poetry `[tool.poetry.dependencies]`

Poetry dependencies can be strings or inline tables with a `version` key.

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `"0.22.0"` | `0.22.0` | `vrc-exact` | `vrhp-passthrough` | Bare exact version — passed through verbatim |
| `{ version = "0.22.0" }` | `0.22.0` | `vrc-exact` | `vrhp-passthrough` | Table form exact version — extracted from `version` key |
| `"^2.28.0"` | `2.28.0` | `vrc-caret` | `vrhp-extract-lower` | Caret range — lower bound extracted |
| `"~2.28.0"` | `2.28.0` | `vrc-tilde` | `vrhp-extract-lower` | Tilde range — lower bound extracted |
| `">=2.28,<3.0"` | `2.28` | `vrc-compound` | `vrhp-extract-lower` | Compound range — lower bound extracted, stops at comma |
| `"^1.0.0-beta"` | `1.0.0-beta` | `vrc-caret` + `vrc-prerelease` | `vrhp-extract-lower` | Caret with prerelease — lower bound extracted, prerelease preserved |
| `"!=2.28.0"` | *(omitted)* | `vrc-exclusion` | `vrhp-skip` | Exclusion-only — no lower bound |
| `"<3.0"` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only — no lower bound |
