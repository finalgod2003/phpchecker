# Deployment status

Updated 2026-10-23 (Asia/Taipei).

## Live application

- GitHub: https://github.com/finalgod2003/phpchecker
- Production branch: `main`
- Cloudflare Worker: `phpchecker`
- Live URL: https://phpchecker.zhenyufang162.workers.dev/
- GitHub pushes automatically run `npm run build` and `npx wrangler deploy`.
- Deployed fix commit: `1565617` (Worker-compatible DNS redirect mode).
- Reused the account's existing build credential; no credentials are stored here.

## Domain activation still pending

The domain `phpchecker.org` has been added to Cloudflare on the **Free** plan.
The exact Worker route `phpchecker.org/*` is saved in the dashboard, with fail
closed behavior. It handles the application before any origin request.
Wrangler configuration omits routes, so subsequent code deployments preserve
the route managed in the dashboard.

Cloudflare assigned these nameservers:

```text
eric.ns.cloudflare.com
shubhi.ns.cloudflare.com
```

At the last check the public delegation was still:

```text
launch1.spaceship.net
launch2.spaceship.net
```

The Spaceship browser session had expired. The user was asked to sign in in
the existing browser page, without sharing a password in chat. After login:

1. Select **phpchecker.org** in Spaceship's domain list.
2. Replace the two Spaceship nameservers with the exact Cloudflare pair above.
3. Confirm the saved values, then request Cloudflare's nameserver check.
4. Wait for the zone to become Active and for the certificate to be ready.
5. Verify HTTPS at `https://phpchecker.org`, one URL check, and one guide page.

Do not report the apex domain as live before those checks pass. No `www`
DNS record or `www` route has been configured; the requested apex is prepared.

## DNS records preserved

Cloudflare imported the following proxied apex A records. They were **not
deleted**; the deletion dialog was canceled. The Worker route serves the
application instead of using these origins after Cloudflare activation.

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | @ | 54.149.79.189 | Proxied |
| A | @ | 34.216.117.25 | Proxied |

A Custom Domain binding was not created because it conflicted with these
existing records. The saved Worker route is the selected deployment method.
No existing nameservers, email records, or DNSSEC settings were changed.

## Verification completed

- 8 targeted Node tests passed: version boundaries, upstream parity, hidden
  and conflicting headers, URL restrictions, private/reserved DNS rejection,
  HEAD/GET fallback, redirect handling, API validation and rate limiting.
- Static build generated 6 pages, a 404 page, robots.txt, and sitemap.xml.
- Cloudflare initial build and the subsequent push-triggered deployment succeeded.
- Production manual checks showed the expected patched/older-version statuses.
- Production URL check for `https://www.php.net` returned HEAD/HTTP 200, with
  no advertised PHP version and the correct Unknown result.
- Report copy and JSON download worked; downloaded JSON was inspected.
- Desktop and narrow-window layout inspected. Exact 390px viewport emulation
  was not available in the in-app browser, so no exact-mobile-width claim is made.

No full repository lint or unrelated regression suite was run.
