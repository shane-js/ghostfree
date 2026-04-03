# parseCargoToml — Version Range Specification

> Primary source: https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html

Cargo `Cargo.toml` supports semver-compatible range syntax for dependency versions. Dependencies can be specified as strings or inline tables with a `version` key.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `"1.0.188"` | `1.0.188` | `vrc-exact` | `vrhp-passthrough` | Bare version (implicit `^`) — passed through verbatim |
| `{ version = "1.32.0" }` | `1.32.0` | `vrc-exact` | `vrhp-passthrough` | Table form exact version — extracted from `version` key |
| `"1.0.0-beta"` | `1.0.0-beta` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease tag preserved intact |
| `"^1.0.100"` | `1.0.100` | `vrc-caret` | `vrhp-extract-lower` | Caret range — lower bound extracted |
| `"~1.0.0"` | `1.0.0` | `vrc-tilde` | `vrhp-extract-lower` | Tilde range — lower bound extracted |
| `">=0.5, <1.0"` | `0.5` | `vrc-compound` | `vrhp-extract-lower` | Compound range — lower bound extracted, stops at comma |
| `">=0.5"` | `0.5` | `vrc-inclusive-minimum` | `vrhp-extract-lower` | Minimum version — lower bound extracted |
| `">0.5"` | `0.5` | `vrc-exclusive-minimum` | `vrhp-extract-lower` | Exclusive minimum — stated version extracted as lower bound |
| `"=1.0.0"` | `1.0.0` | `vrc-exact` | `vrhp-extract-lower` | Explicit exact — prefix stripped |
| `"*"` | *(omitted)* | `vrc-wildcard` | `vrhp-skip` | Wildcard — unresolvable |
| `"<1.0"` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only — no lower bound |
| `{ workspace = true }` | *(omitted)* | `vrc-workspace-ref` | — | Workspace dependency — no local version, skipped |
