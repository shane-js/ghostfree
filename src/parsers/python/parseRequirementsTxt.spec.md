# parseRequirementsTxt — Version Range Specification

> Primary source: https://peps.python.org/pep-0440/#version-specifiers
> File format: https://pip.pypa.io/en/stable/reference/requirements-file-format/

Python `requirements.txt` uses PEP 440 version specifiers. Lines starting with `#` are comments, `-r` are include directives.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `requests==2.28.0` | `2.28.0` | `vrc-exact` | `vrhp-passthrough` | Exact pin — version extracted |
| `requests===2.0.0` | `2.0.0` | `vrc-exact` | `vrhp-passthrough` | Arbitrary equality — version extracted |
| `requests>=2.28.0` | `2.28.0` | `vrc-inclusive-minimum` | `vrhp-extract-lower` | Minimum version — lower bound extracted |
| `requests>2.0` | `2.0` | `vrc-exclusive-minimum` | `vrhp-extract-lower` | Exclusive minimum — stated version extracted as lower bound |
| `requests~=2.28` | `2.28` | `vrc-compatible-release` | `vrhp-extract-lower` | Compatible release — lower bound extracted |
| `requests>=2.28.0,<3.0` | `2.28.0` | `vrc-compound` | `vrhp-extract-lower` | Compound range — lower bound extracted, stops at comma |
| `requests[security]==2.28.0` | `2.28.0` | `vrc-exact` | `vrhp-passthrough` | Extras notation — extras stripped, version extracted |
| `requests==1.0.0-beta` | `1.0.0-beta` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease tag preserved intact |
| `requests<=3.0` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only (`<=`) — no lower bound |
| `requests<3.0` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only (`<`) — no lower bound |
| `requests!=2.0` | *(omitted)* | `vrc-exclusion` | `vrhp-skip` | Exclusion-only (`!=`) — no lower bound |
