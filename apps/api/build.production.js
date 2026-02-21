import { build } from 'esbuild';

await build({
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  write: true,
  entryPoints: [`./src/index.ts`],
  inject: ['./cjs-shim.ts'],
  sourcemap: true,
  // No @dotenv-run/esbuild plugin — process.env.X references are
  // preserved so they resolve at runtime from the container environment.
  plugins: [],
  // Mark native addons as external so they load from node_modules at runtime
  external: ['sharp', '@prisma/client', '*.node'],
});
