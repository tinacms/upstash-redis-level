---
"upstash-redis-level": patch
---

Refresh dependencies to latest compatible versions.

Runtime:
- `@upstash/redis` `1.24.3` → `^1.38.0` (minor — same major, ~14 minor releases of upstream fixes/features)
- `abstract-level` `1.0.3` → `^1.0.4` (patch within the v1 line — staying on v1 to preserve compatibility with the rest of the TinaCMS Level adapter ecosystem)

DevDeps (latest minor/patch within each major):
- `@changesets/cli` `2.24.3` → `2.31.0`
- `@types/jest` `^29.5.13` → `^29.5.14`
- `@types/node` `^22.5.5` → `^22.19.19`
- `@types/tape` `^5.6.4` → `^5.8.1`
- `ts-jest` `^29.2.5` → `^29.4.9`
- `typescript` `^5.6.2` → `^5.9.3`

Pinned:
- `@tinacms/scripts` from `^1.2.1` to exact `1.2.1` — newer versions (1.3+) regress the TypeScript jest-runner transform (test files fail to parse with a babel "Unexpected token" error at TS type annotations). Worth investigating in `@tinacms/scripts` separately; pinning here prevents a yarn/pnpm install from silently picking up the broken newer release.

Deferred (breaking-change majors, separate effort):
- `jest` v30 (we're on latest v29.7.0)
- `typescript` v6
- `@types/node` v25 (staying on v22 to match Node 22 runtime target)
