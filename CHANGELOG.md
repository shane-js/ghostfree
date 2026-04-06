# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - TBD

### Added
- `config.yml` option for minimum severity threshold setting for a source-controlable option
- Severity resolution now reports its source (tool argument / env var / config file / user selection) in the `check_cves` output

### Changed
- BREAKING: moved from `GHOSTFREE_ACCEPTED_PATH` env var to broader `GHOSTFREE_DIR` as it will also be where new `config.yml` will live.
- Severity resolution order corrected to standard convention: tool arg → `GHOSTFREE_MIN_SEVERITY` env var → `config.yml` → elicit. Previously config file incorrectly outranked the env var.

### Fixed
- Removed mention of minimum severity threshold env var (`GHOSTFREE_MIN_SEVERITY`) from prompt/tool description to greatly decrease agents from trying to access it themselves and failing which was causing it to be ignored.


