# Security Policy

## Supported versions

The latest **0.x** minor release receives security fixes.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/RRigueira/react-native-device-integrity/security/advisories/new).

Do **not** open a public issue for security reports.

Acknowledgement is expected within **7 days** (best-effort; single maintainer).

## Scope

### In scope

- Fail-open bugs — any path that returns `'clean'` when a check errored or could not run
- Crashes / DoS triggered via the public API
- Privacy leaks
- Anything causing App Store / Play Store rejection due to this library's code
- Supply-chain issues in the published npm package

### Out of scope

A specific bypass of client-side detection by an attacker with control of the device is a [documented limitation](README.md#limitations--threat-model), unless it reveals a fail-open logic bug.

Please still open a regular issue or PR to improve detection coverage.
