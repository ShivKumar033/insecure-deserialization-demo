# Insecure Deserialization Demo (Code-Level Vulnerability Notes)

This project is an intentionally vulnerable Node.js/Express demo designed to show how insecure trust boundaries in session handling and object merging can affect authorization and command execution logic.

## Vulnerabilities Present in the Code

### 1) Insecure session serialization (unsigned client-side trust)
- Session data is created with Base64-encoded JSON in `serialize()` and parsed in `deserialize()`.
- The session cookie is not cryptographically signed or encrypted.
- Application logic directly trusts deserialized fields like `username` and `role`.

Why this is vulnerable:
- Base64 is only an encoding format, not a security control.
- Any authorization decision based on unsigned client-provided values is unsafe.

---

### 2) Broken access control via role trust
- The `/dashboard` and `/admin` routes use `data.role` from the cookie for authorization checks.
- No server-side verification ties role claims to a trusted backend session store.

Why this is vulnerable:
- Access control decisions rely on untrusted data instead of server-owned state.

---

### 3) Prototype pollution sink in deep merge logic
- `deepMerge(target, source)` recursively merges user-controlled objects.
- `/api/profile/update` calls `deepMerge(userSettings[data.username], req.body)` on request input.
- The merge function has no key filtering (for keys such as `__proto__`, `constructor`, `prototype`).

Why this is vulnerable:
- Unrestricted deep merge on user input can mutate object prototypes or inject unexpected properties, influencing later logic.

---

### 4) Polluted state influences authorization paths
- `/admin` reads `settings = userSettings[data.username] || {}` and allows admin view when `settings.isAdmin` is true.
- `/debug` enables command execution behavior when `settings.execMode` is set.

Why this is vulnerable:
- Security-critical decisions depend on mutable, user-influenced settings.
- If settings are tainted, authorization and security toggles can be bypassed.

---

### 5) Command execution on request-derived input
- `runCommand()` executes input using `child_process.exec(input, ...)`.
- `/admin` supports command behavior when role has `cmd:` prefix.
- `/debug` executes `req.query.cmd` when debug mode is enabled.

Why this is vulnerable:
- `exec()` on request-influenced strings introduces command injection / remote command execution risk.
- There is no allowlist, sanitization, or strict command policy.

---

## Scope of This Demo
This repository is intentionally insecure for learning and testing. It demonstrates how multiple weak trust decisions combine into high-risk behavior.