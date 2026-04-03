# parsePackageJson — Version Range Specification

> Primary source: https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies
> Semver ranges: https://github.com/npm/node-semver#ranges

npm `package.json` uses semver range syntax for `dependencies` and `devDependencies`.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `1.4.0` | `1.4.0` | `vrc-exact` | `vrhp-passthrough` | Bare exact version — passed through verbatim |
| `1.0.0-beta.1` | `1.0.0-beta.1` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease tag preserved intact |
| `^1.2.3` | `1.2.3` | `vrc-caret` | `vrhp-extract-lower` | Caret range — lower bound extracted |
| `^1.0.0-rc.2` | `1.0.0-rc.2` | `vrc-caret` + `vrc-prerelease` | `vrhp-extract-lower` | Caret with prerelease — lower bound extracted, prerelease preserved |
| `~4.17.0` | `4.17.0` | `vrc-tilde` | `vrhp-extract-lower` | Tilde range — lower bound extracted |
| `>=1.0.0 <2.0.0` | `1.0.0` | `vrc-compound` | `vrhp-extract-lower` | Compound range — lower bound (>=) extracted |
| `>=1.2.0` | `1.2.0` | `vrc-inclusive-minimum` | `vrhp-extract-lower` | Minimum version — lower bound extracted |
| `>1.0.0` | `1.0.0` | `vrc-exclusive-minimum` | `vrhp-extract-lower` | Exclusive minimum — stated version extracted as lower bound |
| `=4.0.0` | `4.0.0` | `vrc-exact` | `vrhp-extract-lower` | Explicit exact — prefix stripped |
| `*` | *(omitted)* | `vrc-wildcard` | `vrhp-skip` | Wildcard — unresolvable |
| `latest` | *(omitted)* | `vrc-tag` | `vrhp-skip` | Tag — unresolvable |
| `<2.0.0` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only — no lower bound |
| `workspace:*` | *(omitted)* | `vrc-workspace-ref` | `vrhp-skip` | Workspace protocol — unresolvable |
| `workspace:^1.0.0` | *(omitted)* | `vrc-workspace-ref` | `vrhp-skip` | Workspace protocol with range — unresolvable (starts with `w` after strip) |
