import type { NextConfig } from 'next';

// Build remote patterns for images, including custom CDN if configured
const remotePatterns: NextConfig['images'] extends { remotePatterns?: infer R } ? R : never = [
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

// Marketing rewrites only if NEXT_PUBLIC_MARKETING_URL is set
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
        source: '/i/:path*',
        destination: `${process.env.NEXT_PUBLIC_MARKETING_URL}/i/:path*`,
      },
    ]
  : [];

const nextConfig: NextConfig = {
  transpilePackages: ['@trylinky/ui', '@trylinky/common'],
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

// Only wrap with Sentry if auth token is available
let exportedConfig: NextConfig;

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
} else {
  exportedConfig = nextConfig;
}

export default exportedConfig;
