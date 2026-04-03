# parsePomXml — Version Range Specification

> Primary source: https://maven.apache.org/pom.html#dependency-version-requirement-specification

Maven `pom.xml` supports exact versions and interval notation for dependency versions.

## Version Range Handling

| Input | Queried Version | VRC | VRHP | Description |
|---|---|---|---|---|
| `6.0.11` | `6.0.11` | `vrc-exact` | `vrhp-passthrough` | Bare exact version — passed through verbatim |
| `1.0.0-SNAPSHOT` | `1.0.0-SNAPSHOT` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | SNAPSHOT prerelease preserved intact |
| `32.1.2-jre` | `32.1.2-jre` | `vrc-exact` + `vrc-prerelease` | `vrhp-passthrough` | Classifier tag preserved intact |
| `[1.0,2.0)` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` | Inclusive lower, exclusive upper — lower bound extracted |
| `[1.0,2.0]` | `1.0` | `vrc-inclusive-range` | `vrhp-extract-lower` | Inclusive lower, inclusive upper — lower bound extracted |
| `[2.0,2.0]` | `2.0` | `vrc-inclusive-range` | `vrhp-extract-lower` | Exact version via interval — lower bound extracted |
| `(4.1.3,)` | *(omitted)* | `vrc-exclusive-range` | `vrhp-skip` | Exclusive lower bound — true minimum unknown |
| `(1.0,2.0)` | *(omitted)* | `vrc-exclusive-range` | `vrhp-skip` | Exclusive lower, exclusive upper — true minimum unknown |
| `[,1.0]` | *(omitted)* | `vrc-upper-bound-only` | `vrhp-skip` | Upper-bound-only — no lower bound |
| `${spring.version}` | *(omitted)* | `vrc-property-placeholder` | `vrhp-skip` | Property placeholder — unresolvable without parent POM |
