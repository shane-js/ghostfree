# parseCargoLock — Version Range Specification

> Primary source: https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html

`Cargo.lock` contains resolved exact versions for all installed packages (direct and transitive). Each `[[package]]` entry has a `name` and `version` field. No range interpretation is needed.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `1.0.188` | `1.0.188` | `vrc-lockfile-pin` | `vrhp-lockfile` | Lock file exact pin — passed through verbatim |
| `1.0.0-beta` | `1.0.0-beta` | `vrc-lockfile-pin` + `vrc-prerelease` | `vrhp-lockfile` | Lock file prerelease pin — passed through verbatim |
