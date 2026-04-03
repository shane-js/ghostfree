# parsePipfileLock — Version Range Specification

> Primary source: https://pipenv.pypa.io/en/latest/pipfile.html#pipfile-lock

`Pipfile.lock` contains resolved exact versions for all installed packages. The `==` prefix on version strings is stripped by the parser. No range interpretation is needed.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `==2.28.2` | `2.28.2` | `vrc-lockfile-pin` | `vrhp-lockfile` | Lock file exact pin — `==` prefix stripped |
| `==1.0.0-beta` | `1.0.0-beta` | `vrc-lockfile-pin` + `vrc-prerelease` | `vrhp-lockfile` | Lock file prerelease pin — `==` prefix stripped |
