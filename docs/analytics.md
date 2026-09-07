# Analytics

## Google Tag Manager

Public bio pages (`apps/frontend/app/[domain]`) can load Google Tag Manager,
controlled by a single environment variable:

- `NEXT_PUBLIC_GTM_ID` — the GTM container ID (e.g. `GTM-XXXXXXX`).

This deployment serves link-in-bio pages for multiple brands from the same
build, so the container ID is never hardcoded. It is set per environment in
Vercel, per brand/domain as needed.

**Unset is a complete no-op.** If `NEXT_PUBLIC_GTM_ID` is missing, empty, or
doesn't look like a GTM container ID (it must start with `GTM-`), no script
tag, `dataLayer`, or `noscript` fallback is rendered at all — zero behaviour
change from before GTM existed in this repo. See `apps/frontend/app/gtm.tsx`.

## Outbound click tracking

Every outbound link rendered from a public bio page block (WhatsApp,
Instagram, website, menu, etc.) goes through `CoreBlock`
(`apps/frontend/app/components/CoreBlock.tsx`), which pushes one event to
`window.dataLayer` on click:

- **Event name**: `bio_link_click`
- **Parameters** (and nothing else):
  - `link_domain` — the hostname of the destination only (e.g. `wa.me`,
    `www.instagram.com`). Never the full URL, path, or query string.
  - `link_kind` — a coarse classification derived only from the destination
    hostname: `whatsapp` | `instagram` | `menu` | `site` | `other`.
  - `block_type` — the block/integration type that rendered the link (e.g.
    `link-box`).

**No PII is ever sent.** No page-owner data, no visitor identifiers, no
cookies, no full URLs — only the destination hostname and its coarse
classification. See `apps/frontend/lib/analytics/bio-link-click.ts`.

The tracking call is guarded end to end: if `window.dataLayer` doesn't exist
(GTM unset) or the destination URL can't be parsed, nothing is pushed and the
click behaves exactly as it did before this instrumentation existed. It never
throws, blocks navigation, or calls `preventDefault`.
