# Security Policy

## Scope

This policy covers the security of **modelverifier.ai** — the AI Model & System Assurance Control Matrix, a static single-page application hosted on Cloudflare Pages. It encompasses the deployed application, the build pipeline, the integration JSON served at `/integration/model-controls-full.json`, and the GitHub repository at [github.com/CyberDefenseOperations/modelverifier-ai](https://github.com/CyberDefenseOperations/modelverifier-ai).

---

## Reporting a Vulnerability

Send security reports to **security@apeiris.io**.

Include:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (a script, screenshot, or recorded session is helpful)
- The URL, file, or component affected
- Your name or handle (optional — anonymous reports are accepted)

**Do not open a public GitHub issue for security vulnerabilities.**

### Response timeline

| Milestone | Target |
|---|---|
| Acknowledgement | 5 business days |
| Triage and severity assessment | 10 business days |
| Resolution or published advisory | 90 days from initial report |

We will keep you informed of progress throughout. If a vulnerability requires coordinated disclosure with a third party (e.g., Cloudflare), we will notify you before any public advisory is published.

---

## Supported Versions

Only the current production deployment at `https://modelverifier.ai` is supported. There are no versioned releases to patch; all fixes are deployed directly to the live site.

---

## Security Design

modelverifier.ai is a **zero-runtime-dependency static application**. There is no server-side code, no database, no user accounts, and no telemetry. The attack surface is intentionally minimal.

### Transport security

All traffic is served over HTTPS with HTTP Strict Transport Security enforced via Cloudflare Pages `_headers`:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

The `preload` directive signals eligibility for inclusion in browser HSTS preload lists.

### HTTP security headers

Every response includes the following headers:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Permissions-Policy` | camera, microphone, geolocation, payment, and USB access all denied |
| `frame-ancestors` (CSP) | `'none'` |

### Content Security Policy

```
default-src 'none';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self';
img-src data:;
font-src 'none';
frame-ancestors 'none';
base-uri 'none';
form-action 'none';
object-src 'none';
worker-src 'none';
```

The `default-src 'none'` baseline blocks all resource types not explicitly permitted. External scripts, frames, fonts, forms, workers, plugins, and cross-origin connections are all prohibited. The `connect-src 'self'` directive restricts `fetch()` to the same origin, ensuring the control matrix JSON cannot be redirected to an external host.

### Input validation

The application validates all externally-supplied data before use:

- **URL hash fragments** — assessment state decoded from a share link is validated key-by-key against the control ID pattern (`/^[A-Z]{2}-\d{2}$/`) and a strict maturity enum before being written to the UI or localStorage. Invalid entries are silently dropped.
- **File imports** — only `.json` files of 512 KB or less are accepted. Each key is validated against the control ID pattern; each value against the maturity enum. Malformed imports are rejected with a user-visible error.
- **Integration JSON** — fetched from the same origin (`/integration/model-controls-full.json`). The response is parsed as JSON only; no `eval` or dynamic script execution is used anywhere in the application.

### Build pipeline

- The build script uses Node.js built-ins only — no third-party npm packages with network access.
- GitHub Actions workflows reference secrets via environment variables, never via direct expression interpolation in shell steps, mitigating script injection via attacker-controlled event payloads.
- Integer inputs in workflow steps are validated before use in shell commands.

### CORS and cross-origin resource policy

Global security headers set `Cross-Origin-Resource-Policy: same-origin` on all paths. The `/integration/*` path explicitly overrides this to `Cross-Origin-Resource-Policy: cross-origin` and adds `Access-Control-Allow-Origin: *`, enabling any tool to consume the control matrix JSON. All other paths remain same-origin. The integration endpoint serves only a static JSON knowledge corpus with no user data.

---

## Data Privacy

**No data is transmitted off your device.**

| Data type | Where it lives | Transmitted to any server? |
|---|---|---|
| Self-assessment ratings | Browser `localStorage` | No |
| Shared assessment links | URL hash fragment (`#`) in your browser | No — hash fragments are never sent in HTTP requests |
| Control matrix content | Fetched once from same-origin JSON | Read-only; no personal data involved |

There are no analytics scripts, no tracking pixels, no cookies, no user accounts, and no server-side logs of assessment activity. The application has no knowledge of what you assess or how you rate any control.

---

## Known Limitations and Accepted Risks

The following limitations are known and accepted by design. Reports that document only these issues will be noted but are unlikely to result in changes.

**`unsafe-inline` in Content Security Policy**
The application is a single HTML file with inline `<script>` and `<style>` blocks. Strict nonce-based or hash-based CSP would require build-time injection of nonces on every deploy. This is a planned improvement; the current `unsafe-inline` posture is a deliberate trade-off for build simplicity. Mitigating controls: `default-src 'none'`, `connect-src 'self'`, and `frame-ancestors 'none'` limit the practical exploitability of any XSS.

**No subresource integrity on same-origin JSON fetch**
The `/integration/model-controls-full.json` file is fetched at runtime without a Subresource Integrity hash. Because the fetch is same-origin and the CSP prohibits external connections, the risk is limited to a compromise of the Cloudflare Pages deployment itself — which would already allow arbitrary content injection.

**localStorage is not encrypted**
Assessment ratings stored in `localStorage` are accessible to any script running on `modelverifier.ai`. The CSP prevents external or injected scripts from running, but device-level access (e.g., a shared browser profile, physical device access) is outside the application's threat model. Users with sensitive assessment data should treat their browser profile with the same care as any other local credential store.

**URL hash share links expose assessment state to browser history**
Share links encode the full assessment state as a base64 URL hash fragment. This fragment is stored in browser history and may appear in browser autofill or sync features. Users who do not want assessment state persisted in history should clear browser history after sharing or use a private browsing session.

**No authentication or authorization**
The control matrix corpus is a public knowledge resource. There is no access control, and none is intended. This is not a limitation — it is the design.

---

## Out of Scope

The following will not be accepted as valid vulnerability reports:

- Phishing attacks, social engineering, or attacks requiring physical device access
- Issues in third-party services not controlled by this project (e.g., Cloudflare infrastructure vulnerabilities — report those to Cloudflare directly)
- Self-XSS (attacks that require the victim to paste malicious code into their own browser console)
- Missing security headers that are already present (verify against a live response before reporting)
- Rate limiting or denial-of-service against a static CDN edge (Cloudflare DDoS protection is out of scope for this policy)
- Vulnerabilities in browsers that are end-of-life or unsupported
- Reports generated solely by automated scanners without manual verification of exploitability

---

## Acknowledgements

We appreciate responsible disclosure. Researchers who report valid, previously unknown vulnerabilities will be acknowledged by name (or handle) in the release notes or advisory, at their preference.
