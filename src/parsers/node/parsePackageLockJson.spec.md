# parsePackageLockJson — Version Range Specification

> Primary source: https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json

`package-lock.json` contains resolved exact versions for all installed packages (direct and transitive). No range interpretation is needed. Supports both v1 (`dependencies` map) and v2/v3 (`packages` map) formats.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `4.18.2` | `4.18.2` | `vrc-lockfile-pin` | `vrhp-lockfile` | Lock file exact pin — passed through verbatim |
| `1.0.0-beta.1` | `1.0.0-beta.1` | `vrc-lockfile-pin` + `vrc-prerelease` | `vrhp-lockfile` | Lock file prerelease pin — passed through verbatim |
