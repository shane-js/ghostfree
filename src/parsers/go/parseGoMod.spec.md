# parseGoMod — Version Range Specification

> Primary source: https://go.dev/ref/mod#go-mod-file-require

Go modules use exact semantic versions (`v1.2.3`). The Go module system does not support range specifiers — no `^`, `~`, `>=`, or interval notation. The leading `v` prefix is stripped by the parser.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `v1.9.1` | `1.9.1` | `vrc-exact` | `vrhp-passthrough` | Exact pinned version — `v` prefix stripped |
| `v1.0.0-beta.1` | `1.0.0-beta.1` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease tag preserved, `v` prefix stripped |
| `v1.0.0+build.123` | `1.0.0+build.123` | `vrc-exact` + `vrc-build-metadata` | `vrhp-passthrough` | Build metadata preserved, `v` prefix stripped |
| `v0.0.0-20230817171753-abc123` | `0.0.0-20230817171753-abc123` | `vrc-exact` + `vrc-pseudo-version` | `vrhp-passthrough` | Go pseudo-version (timestamp-based prerelease) preserved |
