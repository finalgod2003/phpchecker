# PHP Checker

A free PHP version checking website for **phpchecker.org**, adapted from
[openai/php2shell-checker](https://github.com/openai/php2shell-checker).

## Features

- Public website checks using `Server` and `X-Powered-By` headers.
- `HEAD` first; `GET` only on HTTP 405/501. No redirects or exploit probes.
- Browser-local manual version checks with the upstream classification rules.
- Three outcomes: meets threshold, potentially vulnerable, or unknown.
- Response-header evidence, copy JSON, and downloadable JSON reports.
- Responsive light interface, accessible controls, reduced-motion support.
- Three linked guides, FAQ, privacy/terms, canonical URLs, sitemap, and structured data.

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

Local URL: http://127.0.0.1:8787

```sh
npm test
npm run build
```

## Deploy through GitHub → Cloudflare Workers Builds

1. Push this repository to GitHub on branch `main`.
2. Open Cloudflare **Workers & Pages → Create application → Import a repository**.
3. Select the GitHub repository. Worker name: `phpchecker`.
4. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
5. Root directory: `/`. Production branch: `main`.
6. Deploy. Future pushes to `main` automatically build and deploy.
7. The current deployment uses proxied apex DNS records and the exact Worker
   route `phpchecker.org/*`, maintained in the Cloudflare dashboard. This
   preserves the imported DNS records. See [DEPLOYMENT.md](DEPLOYMENT.md) for
   the verified deployment state and remaining activation steps.
8. If the domain still uses Spaceship nameservers, add its zone to Cloudflare
   on the Free plan and set the exact Cloudflare-assigned nameservers in
   Spaceship. Preserve existing mail/verification DNS records if present.

No API keys, databases, or paid third-party APIs are required. `wrangler.jsonc`
defines static assets and a Cloudflare Rate Limiting binding (about 20 URL
checks/minute/IP/location). Cloudflare platform limits still apply; no paid
plan is required by the application.

## Behavior and scope

The upstream patch rules dated **2026-10-21** use minimum fixed versions
**8.2.35, 8.3.36, 8.4.27, and 8.5.12**. Older branches listed by upstream are
flagged regardless of patch suffix. Unknown branches and prereleases are not
classified as patched. These are not live latest-version or full-security checks.

URL checks have a 10-second combined deadline, reject private/reserved DNS
answers, IP literals, nonstandard ports, credentials, and fragments. Only the
two relevant response headers are returned. The app does not persist URLs,
reports, cookies, or check history. Cloudflare can process infrastructure metadata.

Header strings cannot confirm the installed build or vendor backports. The
web runtime can differ from the CLI. Do not use a green result as proof of security.

## Upstream and license

Upstream commit: `ffcd3fc82e5b404f2a04a95b2805ca7639d530fa`.
The unchanged CLI is in `vendor/phpcheck.cjs`; the adapted classification is
in `public/checker.js`. See [NOTICE](NOTICE) and [LICENSE](LICENSE).

Independent project; no affiliation with or endorsement by OpenAI or PHP.
