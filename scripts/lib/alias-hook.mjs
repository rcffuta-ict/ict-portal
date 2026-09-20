/**
 * Resolve the `@/...` path alias for Node.
 *
 * tsconfig maps `@/*` to `src/*`, which Next understands and plain Node does not. With
 * this hook (plus type stripping, which Node 22.18+ does natively) a script can import
 * the portal's own TypeScript modules directly.
 *
 * That matters for scripts/backup.mjs: it calls the SAME `buildBackup()` the portal's
 * download button calls, so a CLI bundle and a UI bundle can never drift apart in
 * format, table list or redactions. The alternative was reimplementing all of it in
 * .mjs and hoping the two copies stayed in step.
 */
import { existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src");

/**
 * TypeScript imports are written without an extension, which Node's ESM resolver
 * refuses. Try the ones this project actually uses, in the order tsc would.
 */
const EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs", ".js"];

function withExtension(path) {
    if (extname(path) && existsSync(path)) return path;
    for (const ext of EXTENSIONS) {
        if (existsSync(path + ext)) return path + ext;
    }
    for (const ext of EXTENSIONS) {
        const index = join(path, "index" + ext);
        if (existsSync(index)) return index;
    }
    return path;
}

export async function resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
        return next(pathToFileURL(withExtension(join(SRC, specifier.slice(2)))).href, context);
    }
    return next(specifier, context);
}
