# parseGoSum — Version Range Specification

> Primary source: https://go.dev/ref/mod#go-sum-files

`go.sum` contains cryptographic hashes of resolved module versions. All versions are exact pins. The leading `v` prefix is stripped by the parser. Duplicate entries (including `/go.mod` checksum lines) are deduplicated to one entry per module+version.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `v1.9.1` | `1.9.1` | `vrc-lockfile-pin` | `vrhp-lockfile` | Lock file exact pin — `v` prefix stripped |
| `v1.0.0-rc.1` | `1.0.0-rc.1` | `vrc-lockfile-pin` + `vrc-prerelease` | `vrhp-lockfile` | Prerelease tag preserved, `v` prefix stripped |
| `v1.0.0+build.123` | `1.0.0+build.123` | `vrc-lockfile-pin` + `vrc-build-metadata` | `vrhp-lockfile` | Build metadata preserved, `v` prefix stripped |
