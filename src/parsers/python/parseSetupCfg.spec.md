# parseSetupCfg — Version Range Specification

> Primary source: https://setuptools.pypa.io/en/latest/userguide/declarative_config.html
> PEP 440 specifiers: https://peps.python.org/pep-0440/#version-specifiers

`setup.cfg` `[options].install_requires` uses PEP 440 version specifiers — identical to `requirements.txt` syntax. See [parseRequirementsTxt.spec.md](../python/parseRequirementsTxt.spec.md) for the full specifier table.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `requests==2.28.0` | `2.28.0` | `vrc-exact` | `vrhp-passthrough` | Exact pin |
| `requests>=2.28.0` | `2.28.0` | `vrc-inclusive-minimum` | `vrhp-extract-lower` | Minimum version |
| `requests~=2.28` | `2.28` | `vrc-compatible-release` | `vrhp-extract-lower` | Compatible release |
| `requests>=2.28.0,<3.0` | `2.28.0` | `vrc-compound` | `vrhp-extract-lower` | Compound range — lower bound extracted |
| `requests>2.0` | `2.0` | `vrc-exclusive-minimum` | `vrhp-extract-lower` | Exclusive minimum |
| `requests===2.0.0` | `2.0.0` | `vrc-exact` | `vrhp-passthrough` | Arbitrary equality |
| `requests==1.0.0-beta` | `1.0.0-beta` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease preserved |
| `requests<=3.0` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only |
| `requests<3.0` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only |
| `requests!=2.0` | *(omitted)* | `vrc-exclusion` | `vrhp-skip` | Exclusion-only |
