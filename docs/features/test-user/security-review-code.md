# Test Account Security Review

- Mode: Code
- Date: 2026-11-06
- Scope: Test identity, login, API capabilities, sample records, sharing limits, and UI controls
- Verdict: Passed with an existing dependency finding

## Verified Controls

- Test login requires explicit `TEST_USER_ENABLED=1` configuration.
- Signed test tokens are bound to the reserved identity. Disabling access rejects
  existing account sessions, and guest tokens cannot access account endpoints.
- The API blocks creation/deletion of health records, uploads, result replacement,
  extraction retries, provider changes, and share revocation before side effects.
- Allowed metadata edits, medication edits, and shares retain owner filtering.
- Fixture initialization is atomic and repeat logins preserve existing edits.
- Concurrent sharing is limited to 20 active codes and 100 unexpired retained codes.
- PDF fixtures use a fixed filename allowlist and require the synthetic owner.
- No production dependencies, credentials, or database columns were added.

## Evidence

- All 51 backend tests pass, including 13 focused test-account tests.
- Concurrent SQLite tests cover first-login idempotence and share quota enforcement.
- Backend imports/schema, frontend typecheck/build, and patch whitespace checks pass.
- Desktop and 390px mobile browser checks pass against Vite and the built SPA served
  by FastAPI, with Google unavailable and an isolated SQLite database.
- Browser checks cover reload/logout, permitted edits, sharing, guest access,
  restricted controls, and responsive screenshots without horizontal overflow.
- The production frontend dependency audit reports no known vulnerabilities.

## Existing Dependency Finding

`pip-audit` reports `PYSEC-2026-3552` (`CVE-2026-69247`) for installed
`cryptography` 49.0.0, fixed in 50.0.0. The unchanged
[production requirements](../../../api/requirements.txt) exclude 50.0.0.
The advisory concerns PKCS#7 envelope decryption. No application-module calls to
those APIs were found. Existing credential handling uses Fernet/HKDF instead.
Dependency remediation remains separate from this feature.

## Limits

- All test visitors intentionally share persistent edits and synthetic data.
- Previously redeemed guest sessions retain their original expiry when test login
  is disabled. Share codes and guest access otherwise follow existing behavior.
- Live Postgres concurrency, Render deployment, real Google sign-in, and repository
  security-alert services were not exercised. Google verification was mocked only
  at the external-provider boundary in the owner-permission regression test.