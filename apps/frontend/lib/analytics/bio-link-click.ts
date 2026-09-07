// Outbound-click tracking for public bio pages, pushed to the GTM dataLayer.
//
// This module intentionally never sends anything beyond the destination
// hostname and a coarse classification of it — no page-owner data, no
// visitor identifiers, no query strings or paths that might carry PII.

export type BioLinkKind = 'whatsapp' | 'instagram' | 'menu' | 'site' | 'other';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

// Coarse classification derived only from the destination hostname. Any
// hostname that doesn't match a known pattern falls back to 'site'; 'other'
// is reserved for links whose hostname couldn't be determined at all.
export function classifyLinkKind(hostname: string | null): BioLinkKind {
  if (!hostname) {
    return 'other';
  }

  const host = hostname.toLowerCase();

  if (host === 'wa.me' || host.endsWith('.wa.me') || host.endsWith('.whatsapp.com')) {
    return 'whatsapp';
  }

  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    return 'instagram';
  }

  if (host.includes('menu')) {
    return 'menu';
  }

  return 'site';
}

// Best-effort hostname extraction. `href` may be a relative path, a
// mailto:/tel: link, or otherwise not a valid absolute URL — none of that
// should ever throw or block the click.
function extractHostname(href: string): string | null {
  try {
    return new URL(href, window.location.href).hostname || null;
  } catch {
    return null;
  }
}

// Pushes a `bio_link_click` event to the GTM dataLayer. A no-op when GTM
// hasn't been loaded (dataLayer is undefined) or when anything about the
// destination can't be read — the click itself must never be affected.
export function trackBioLinkClick(href: string, blockType: string): void {
  try {
    if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) {
      return;
    }

    const hostname = extractHostname(href);

    window.dataLayer.push({
      event: 'bio_link_click',
      link_domain: hostname ?? '',
      link_kind: classifyLinkKind(hostname),
      block_type: blockType,
    });
  } catch {
    // Tracking must never break navigation.
  }
}
