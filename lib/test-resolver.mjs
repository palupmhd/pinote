// Hook resolusi modul KHUSUS untuk `npm test`.
//
// Source memakai import tanpa ekstensi ("./dates", "@/lib/types") karena itu
// yang wajar untuk bundler Next. Runner tes Node berjalan sebagai ESM murni,
// yang mewajibkan ekstensi eksplisit. Hook ini menjembatani keduanya supaya
// kode aplikasi tak perlu diubah hanya demi bisa diuji.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url)); // .../lib
const PROJECT = dirname(ROOT);

export function resolve(specifier, context, nextResolve) {
  // Alias "@/..." → root proyek (samakan dengan paths di tsconfig).
  if (specifier.startsWith("@/")) {
    const abs = resolvePath(PROJECT, specifier.slice(2));
    for (const cand of [abs, `${abs}.ts`, `${abs}.tsx`, `${abs}/index.ts`]) {
      if (existsSync(cand)) return nextResolve(pathToFileURL(cand).href, context);
    }
  }
  // Relatif tanpa ekstensi → coba .ts / .tsx.
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const base = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : PROJECT;
    const abs = resolvePath(base, specifier);
    for (const cand of [`${abs}.ts`, `${abs}.tsx`, `${abs}/index.ts`]) {
      if (existsSync(cand)) return nextResolve(pathToFileURL(cand).href, context);
    }
  }
  return nextResolve(specifier, context);
}
