import Script from 'next/script';

// A public GTM container ID always starts with 'GTM-'. Anything else is
// treated as unset — we never interpolate an unvalidated value into a
// script URL.
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;

function getGtmId(): string | null {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  return gtmId && GTM_ID_PATTERN.test(gtmId) ? gtmId : null;
}

// Google Tag Manager loader, gated entirely on NEXT_PUBLIC_GTM_ID. This
// deployment serves multiple brands, each with its own container, so the ID
// is never hardcoded — when the env var is unset (or malformed) this
// component renders nothing and there is zero behaviour change.
export function GoogleTagManagerScript() {
  const gtmId = getGtmId();

  if (!gtmId) {
    return null;
  }

  return (
    <Script
      id="gtm-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
      }}
    />
  );
}

// GTM's recommended <noscript> fallback, rendered right after <body>. Same
// gating as the script above: a no-op when the env var is unset.
export function GoogleTagManagerNoScript() {
  const gtmId = getGtmId();

  if (!gtmId) {
    return null;
  }

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
