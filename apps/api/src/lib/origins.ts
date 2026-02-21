// Allow overriding trusted origins via env var for self-hosted deployments
const customOrigins = process.env.TRUSTED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];

export const trustedOrigins =
  customOrigins.length > 0
    ? customOrigins
    : process.env.NODE_ENV === 'production'
      ? [
          'https://lin.ky',
          'https://www.lin.ky',
          'https://admin.lin.ky',
          'https://glow.as',
          'https://www.glow.as',
          'https://admin.glow.as',
        ]
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3004',
        ];
