# Deployment status

Updated 2026-10-23 (Asia/Taipei).

## Analytics and search engine registration

Configured and deployed on 2026-10-23 in commit `02e86ce`.

- Plausible: https://stats.blackholeenglish.com/phpchecker.org, reporting
  timezone `Asia/Taipei`. Installation verification passed and the dashboard
  received the first pageview. Script: `/js/pa-KTiTuUTMILDTKSFb6E06d.js`
  on the self-hosted statistics domain.
- GA4: account `399944048` (Fang_Zhenyu), property `560510904` (PHP Checker),
  web stream `16187851319` (PHP Checker Web), measurement ID `G-GTGG5Y7VCL`.
  Reporting timezone is Taipei (UTC+08:00). Realtime reported one active
  visitor and the `first_visit`, `page_view`, and `session_start` events.
- Both analytics scripts and the Google/Bing verification meta tags are
  included by the shared page template. Initialization is in
  `public/analytics.js`; CSP permits the required analytics hosts without
  allowing arbitrary inline scripts. Google signals and ad personalization
  are disabled in the tag configuration. Privacy policy updated accordingly.
- GSC: verified the URL-prefix property `https://phpchecker.org/` using the
  HTML meta tag. Submitted `https://phpchecker.org/sitemap.xml`; Google reports
  **Success** and **6 discovered pages**. This is sitemap discovery, not a
  confirmation that those pages are indexed.
- Bing Webmaster Tools: added and verified `https://phpchecker.org/` using
  the HTML meta tag. The same sitemap was submitted and is **Processing**,
  with no reported errors or warnings at the time of submission.
- Verification: generated pages checked for one GA4 loader, both analytics
  integrations, both verification tags, and updated privacy text. Production
  homepage loaded the scripts without browser console errors. No unrelated
  regression suite was run.

Keep the verification meta tags in future deployments to preserve ownership.

## Live application

- GitHub: https://github.com/finalgod2003/phpchecker
- Production branch: `main`
- Cloudflare Worker: `phpchecker`
- Live URL: https://phpchecker.org/
- Cloudflare fallback URL: https://phpchecker.zhenyufang162.workers.dev/
- GitHub pushes automatically run `npm run build` and `npx wrangler deploy`.
- Deployed fix commit: `1565617` (Worker-compatible DNS redirect mode).
- Reused the account's existing build credential; no credentials are stored here.

## Domain active; HTTPS and DNSSEC verified

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

The Spaceship settings and the registry's RDAP response both confirm:

```text
eric.ns.cloudflare.com
shubhi.ns.cloudflare.com
```

Cloudflare DNSSEC was enabled and its matching DS record was saved at
Spaceship. The registry also confirmed this exact public record:

```text
Key tag: 2371
Algorithm: 13 (ECDSA/SHA-256)
Digest type: 2 (SHA-256)
Digest: 5C7CE42621F0A39466175FBE0D045C4C22CC9D48913DBFE300EDC626AEEE89C3
```

Cloudflare confirms that the domain is active and reports:

```text
Success! phpchecker.org is protected with DNSSEC.
```

The free Universal SSL certificate is **Active**, covers `phpchecker.org` and
`*.phpchecker.org`, and expires on 2027-01-21 (managed renewal). HTTPS at the
apex returned HTTP 200 with the expected application on 2026-10-23, 17:11
Asia/Taipei. No DNSSEC protection was disabled during this migration.

The requested apex is live. No `www` DNS record or `www` route is configured.

## DNS records preserved

Cloudflare imported the following proxied apex A records. They were **not
deleted**; the deletion dialog was canceled. The Worker route serves the
application instead of using these origins.

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | @ | 54.149.79.189 | Proxied |
| A | @ | 34.216.117.25 | Proxied |

The application uses the saved Worker route, preserving these DNS records.
The registrar nameservers and DNSSEC DS record were migrated to Cloudflare.
No email records were changed, and the two imported A records remain intact.

## Verification completed

- 8 targeted Node tests passed: version boundaries, upstream parity, hidden
  and conflicting headers, URL restrictions, private/reserved DNS rejection,
  HEAD/GET fallback, redirect handling, API validation and rate limiting.
- Static build generated 6 pages, a 404 page, robots.txt, and sitemap.xml.
- Cloudflare initial build and the subsequent push-triggered deployment succeeded.
- Production manual checks showed the expected patched/older-version statuses.
- Production URL check for `https://www.php.net` returned HEAD/HTTP 200, with
  no advertised PHP version and the correct Unknown result.
- The same URL check succeeded through `https://phpchecker.org` using the
  page's Check PHP version button. Manual PHP 8.4.27 returned Meets threshold.
- `https://phpchecker.org/how-to-check-php-version` returned HTTP 200 with the
  expected guide title and the correct HTTPS canonical URL.
- Cloudflare domain activation, Universal SSL Active, and DNSSEC success were
  verified in the dashboard. The registry reports matching nameservers and DS.
- Report copy and JSON download worked; downloaded JSON was inspected.
- Desktop and narrow-window layout inspected. Exact 390px viewport emulation
  was not available in the in-app browser, so no exact-mobile-width claim is made.

No full repository lint or unrelated regression suite was run.
