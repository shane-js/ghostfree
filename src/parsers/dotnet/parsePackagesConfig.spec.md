# parsePackagesConfig — Version Range Specification

> Primary source: https://learn.microsoft.com/en-us/nuget/reference/packages-config

`packages.config` uses exact pinned versions in the `version` attribute. Version range constraints are expressed in the separate `allowedVersions` attribute, which GhostFree does not read.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `13.0.3` | `13.0.3` | `vrc-exact` | `vrhp-passthrough` | Exact pinned version — passed through verbatim |
| `1.0.0-beta` | `1.0.0-beta` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease tag preserved intact |
