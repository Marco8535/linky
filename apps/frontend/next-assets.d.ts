// Next declares the modules for imported images (.svg, .png, …) inside the
// next-env.d.ts it generates on its first build. That file is gitignored, and
// `pnpm typecheck` never runs Next — so in a clean checkout, which is what CI
// gets, every asset import failed to resolve and the typecheck died on it.
//
// Declaring the reference here, in a committed file, makes the typecheck stand
// on its own. Next still generates its own next-env.d.ts; this only removes the
// dependency on it having been generated first.
/// <reference types="next/image-types/global" />
