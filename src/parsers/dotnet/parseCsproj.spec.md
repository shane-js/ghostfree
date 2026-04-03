# parseCsproj — Version Range Specification

> Primary source: https://learn.microsoft.com/en-us/nuget/concepts/package-versioning#version-ranges

NuGet `PackageReference` in `*.csproj` files supports both exact versions and range notation.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `13.0.3` | `13.0.3` | `vrc-exact` | `vrhp-passthrough` | Bare exact version — passed through verbatim |
| `1.0.0-beta` | `1.0.0-beta` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease tag preserved intact |
| `1.0.0-rc.1` | `1.0.0-rc.1` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease with dot-separated identifier preserved |
| `[1.0,2.0)` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` | Inclusive lower, exclusive upper — lower bound extracted |
| `[1.0,2.0]` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` | Inclusive lower, inclusive upper — lower bound extracted |
| `[2.0,2.0]` | `2.0` | `vrc-inclusive-range` | `vrhp-extract-lower` | Exact version via interval — lower bound extracted |
| `6.*` | `6.0` | `vrc-wildcard` | `vrhp-extract-lower` | Wildcard — minimum of the 6.x series |
| `6.0.*` | `6.0.0` | `vrc-wildcard` | `vrhp-extract-lower` | Wildcard — minimum of the 6.0.x series |
| `(4.1.3,)` | *(omitted)* | `vrc-exclusive-range` | `vrhp-skip` | Exclusive lower bound — true minimum unknown |
| `(1.0,2.0)` | *(omitted)* | `vrc-exclusive-range` | `vrhp-skip` | Exclusive lower, exclusive upper — true minimum unknown |
| `(,1.0]` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only (exclusive lower) — no lower bound |
| `[,1.0]` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only (inclusive) — lower is empty, skipped |
| `(,1.0)` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only (exclusive both) — no lower bound |
