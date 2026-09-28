# Security Policy & Cryptographic Specifications

## 1. Supported Versions

| Version | Supported |
| :--- | :--- |
| 1.0.x | :white_check_mark: Supported |
| < 1.0.0 | :x: End of Life |

---

## 2. Authentication & Cryptography Specification

1. **Password Hashing (PBKDF2)**:
   - Hash Algorithm: `SHA-512`
   - Iteration Count: `100,000`
   - Key Length: `64 bytes (512 bits)`
   - Salt Length: `16 bytes (128 bits)` cryptographically secure random bytes generated via `crypto.randomBytes(16)`.
   - Verification: `crypto.timingSafeEqual` prevents side-channel timing analysis attacks.

2. **Session Security**:
   - Session Tokens: 32 bytes of cryptographically random entropy (64-character hex strings).
   - Validation: Explicit expiration timestamp checked on every request (`expires_at > NOW()`).
   - Revocation: Instant database deletion on logout or administrative revocation via `/vcon`.

3. **Cloudflare Token Vault**:
   - Stored with database-level isolation.
   - Client-side token masking prevents shoulder surfing and screen capture exposure.
   - Real-time validity checks use direct official Cloudflare REST API endpoints (`/client/v4/user/tokens/verify`).

4. **Immutable Audit Trail**:
   - Every administrative operation (emergency abort, settings update, user creation, session revocation) produces an append-only entry in `app_audit_logs`.

5. **Cloudflare OAuth 2.0 Security & State Integrity**:
   - State Parameter: Cryptographically signed using HMAC-SHA256 with the OAuth Client Secret.
   - Nonce & Expiration: Strict 15-minute validity window with random 8-byte nonces to prevent replay, state tampering, and CSRF attacks.
   - Cross-Window Communication: `window.postMessage` dispatch and listeners enforce strict `window.location.origin` verification, blocking unauthorized cross-origin frames.
   - Reverse Proxy Protection: Explicit `trust proxy` configuration with sanitized multi-hop header parsing.

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability within this project, please send a detailed report to the security team or open a private security advisory on GitHub.

Please include:
- Description of the vulnerability.
- Proof of Concept (PoC) or reproducible steps.
- Potential impact and mitigation recommendations.
