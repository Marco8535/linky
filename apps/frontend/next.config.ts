import type { NextConfig } from 'next';

type RemotePattern = NonNullable<
  NonNullable<NextConfig['images']>['remotePatterns']
>[number];

const remotePatterns: RemotePattern[] = [
  {
    protocol: 'https',
    hostname: 'cdn.dev.glow.as',
    port: '',
  },
  {
    protocol: 'https',
    hostname: 'cdn.glow.as',
    port: '',
  },
  {
    protocol: 'https',
    hostname: 'cdn.dev.lin.ky',
    port: '',
  },
  {
    protocol: 'https',
    hostname: 'cdn.lin.ky',
    port: '',
  },
];

// Self-hosted deployments serve uploads from their own bucket/CDN.
if (process.env.CDN_URL) {
  try {
    const cdnUrl = new URL(process.env.CDN_URL);
    remotePatterns.push({
      protocol: cdnUrl.protocol.replace(':', '') as 'http' | 'https',
      hostname: cdnUrl.hostname,
      port: cdnUrl.port,
    });
  } catch {
    // Invalid CDN_URL, skip adding to remote patterns
  }
}

// The marketing site is lin.ky's own; a self-hosted deployment has none, and
// without this guard `/` would rewrite to the string "undefined/i".
const marketingRewrites = process.env.NEXT_PUBLIC_MARKETING_URL
  ? [
      {
        source: '/',
        destination: `${process.env.NEXT_PUBLIC_MARKETING_URL}/i`,
      },
      {
        source: '/sitemap.xml',
        destination: `${process.env.NEXT_PUBLIC_MARKETING_URL}/i/sitemap.xml`,
      },
      {
        source: '/llms.txt',
        destination: `${process.env.NEXT_PUBLIC_MARKETING_URL}/i/llms.txt`,
      },
      {
        source: '/i/:path*',
        destination: `${process.env.NEXT_PUBLIC_MARKETING_URL}/i/:path*`,
      },
    ]
  : [];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['@trylinky/ui', '@trylinky/common', '@trylinky/seo'],
  // Full Cache Components / PPR: the public page shell prerenders, cached
  // data ('use cache' in page-actions) serves from cache, and only dynamic
  // Suspense-wrapped subtrees render per request.
  cacheComponents: true,
  rewrites: async () => marketingRewrites,
  redirects: async () => [
    {
      source: '/pricing',
      destination: '/i/pricing',
      permanent: true,
    },
    {
      source: '/i/learn/what-is-glow',
      destination: '/i/learn/what-is-linky',
      permanent: true,
    },
    {
      source: '/i/learn/is-glow-free',
      destination: '/i/learn/is-linky-free',
      permanent: true,
    },
  ],
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  },
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  images: {
    remotePatterns,
  },
};

// Sentry is optional for self-hosted deployments: without a token the wrapper
// fails the build rather than skipping the upload.
let exportedConfig: NextConfig = nextConfig;

if (process.env.SENTRY_AUTH_TOKEN) {
  const { withSentryConfig } = require('@sentry/nextjs');
  exportedConfig = withSentryConfig(nextConfig, {
    org: 'hyperdusk',
    project: 'glow',
    silent: false,
    sourcemaps: {
      deleteSourcemapsAfterUpload: true,
    },
  });
}

export default exportedConfig;
