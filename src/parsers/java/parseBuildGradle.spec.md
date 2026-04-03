# parseBuildGradle — Version Range Specification

> Primary source: https://docs.gradle.org/current/userguide/single_versions.html

Gradle `build.gradle` and `build.gradle.kts` dependency declarations use Maven-compatible version notation. Both Groovy single-quote and Kotlin double-quote syntax are supported.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `2.15.2` | `2.15.2` | `vrc-exact` | `vrhp-passthrough` | Bare exact version — passed through verbatim |
| `32.1.2-jre` | `32.1.2-jre` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Classifier tag preserved intact |
| `1.0.0-SNAPSHOT` | `1.0.0-SNAPSHOT` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | SNAPSHOT prerelease preserved intact |
| `1.0.0-beta` | `1.0.0-beta` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Prerelease tag preserved intact |
| `[1.0,2.0)` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` | Inclusive lower, exclusive upper — lower bound extracted |
| `[1.0,2.0]` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` | Inclusive lower, inclusive upper — lower bound extracted |
| `(4.1.3,)` | *(omitted)* | `vrc-exclusive-range` | `vrhp-skip` | Exclusive lower bound — true minimum unknown |
| `(1.0,2.0)` | *(omitted)* | `vrc-exclusive-range` | `vrhp-skip` | Exclusive lower, exclusive upper — true minimum unknown |
| `[,1.0]` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only — no lower bound |
