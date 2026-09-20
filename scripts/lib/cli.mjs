/**
 * Shared CLI toolkit for the scripts in this directory.
 *
 * Three jobs, all of them about not making a costly mistake at a terminal:
 *
 *   1. ENVIRONMENT SELECTION. This repo has .env.local, .env.development and
 *      .env.production side by side. A script that silently reads whichever one it
 *      finds first is one careless afternoon away from seeding fake members into the
 *      real fellowship. So scripts ASK, show what each file points at, and make you
 *      type the project ref before they will touch production.
 *
 *   2. LEGIBLE OUTPUT. Headings, tables, counts and step markers, so the shape of what
 *      happened is visible without reading every line.
 *
 *   3. HONEST DEGRADATION. Colour is dropped when output is not a TTY or NO_COLOR is
 *      set; prompts refuse rather than hang when there is no terminal to answer them.
 *
 * No dependencies — node: builtins only.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface, emitKeypressEvents } from "node:readline";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ESC = "\u001b";

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const sgr = (n) => `${ESC}[${n}m`;
const wrap = (open, close) => (s) => (useColour ? `${sgr(open)}${s}${sgr(close)}` : String(s));

export const c = {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    blue: wrap(34, 39),
    magenta: wrap(35, 39),
    cyan: wrap(36, 39),
    grey: wrap(90, 39),
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Visible width, ignoring ANSI escapes, so padding lines up when colour is on. */
const width = (s) => String(s).replace(new RegExp(`${ESC}\\[\\d+m`, "g"), "").length;
const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - width(s)));

export function heading(title, subtitle) {
    const inner = Math.max(width(title), subtitle ? width(subtitle) : 0) + 2;
    const line = "-".repeat(inner);
    console.log("");
    console.log(c.cyan("+" + line + "+"));
    console.log(c.cyan("| ") + c.bold(title) + pad("", inner - width(title) - 1) + c.cyan("|"));
    if (subtitle) {
        console.log(c.cyan("| ") + c.grey(subtitle) + pad("", inner - width(subtitle) - 1) + c.cyan("|"));
    }
    console.log(c.cyan("+" + line + "+"));
}

export function section(title) {
    console.log("");
    console.log(c.bold(title));
    console.log(c.grey("-".repeat(width(title))));
}

export const info = (msg) => console.log(`  ${msg}`);
export const ok = (msg) => console.log(`  ${c.green("OK")}  ${msg}`);
export const warn = (msg) => console.log(`  ${c.yellow("!")}   ${msg}`);
export const fail = (msg) => console.log(`  ${c.red("X")}   ${msg}`);
export const step = (msg) => console.log(`  ${c.blue(">")}   ${msg}`);
export const blank = () => console.log("");

/** key: value, aligned. */
export function kv(pairs, indent = "  ") {
    const w = Math.max(...pairs.map(([k]) => width(k)));
    for (const [k, v] of pairs) console.log(`${indent}${c.grey(pad(k, w))}  ${v}`);
}

/**
 * A simple aligned table.
 * @param columns [{ key, label, align }]
 */
export function table(rows, columns, indent = "  ") {
    if (rows.length === 0) {
        console.log(`${indent}${c.grey("(nothing)")}`);
        return;
    }
    const widths = columns.map((col) =>
        Math.max(width(col.label), ...rows.map((r) => width(r[col.key] ?? ""))));

    console.log(indent + columns
        .map((col, i) => c.grey(col.align === "right"
            ? pad("", widths[i] - width(col.label)) + col.label
            : pad(col.label, widths[i])))
        .join("  "));
    console.log(indent + c.grey(widths.map((w) => "-".repeat(w)).join("  ")));

    for (const row of rows) {
        console.log(indent + columns.map((col, i) => {
            const cell = String(row[col.key] ?? "");
            return col.align === "right"
                ? pad("", widths[i] - width(cell)) + cell
                : pad(cell, widths[i]);
        }).join("  "));
    }
}

/** A progress bar for a long loop, rewritten in place. Silent when not a TTY. */
export function progress(done, total, label = "") {
    if (!process.stdout.isTTY) return;
    const bars = 24;
    const filled = Math.round((done / total) * bars);
    const bar = c.cyan("#".repeat(filled)) + c.grey(".".repeat(bars - filled));
    process.stdout.write(`\r  ${bar} ${String(done).padStart(3)}/${total}  ${c.grey(label.slice(0, 36))}   `);
    if (done >= total) process.stdout.write("\n");
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function assertInteractive(what) {
    if (!process.stdin.isTTY) {
        throw new Error(
            `${what} needs an interactive terminal. Re-run without piping, or pass the `
            + "option explicitly on the command line (see --help).",
        );
    }
}

/** Free-text question. */
export async function ask(question, { default: fallback = "" } = {}) {
    assertInteractive("This prompt");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const suffix = fallback ? c.grey(` (${fallback})`) : "";
        const answer = await new Promise((res) => rl.question(`  ${question}${suffix}: `, res));
        return answer.trim() || fallback;
    } finally {
        rl.close();
    }
}

/**
 * Ask for something that must not be echoed, or land in a scrollback buffer.
 *
 * readline has no native masking, so the documented approach is to override the
 * interface's own write method: let the prompt through, swallow everything after it.
 * Nothing is echoed at all rather than showing asterisks — asterisks leak the length.
 */
export async function askSecret(question) {
    assertInteractive("This prompt");
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (str) => {
        if (!muted) process.stdout.write(str);
    };
    try {
        const answer = await new Promise((res) => {
            rl.question(`  ${question}: `, res);
            muted = true;
        });
        process.stdout.write("\n");
        return answer;
    } finally {
        rl.close();
    }
}

/** Yes/no. Defaults to NO — a destructive script should need a deliberate "y". */
export async function confirm(question, { default: fallback = false } = {}) {
    const hint = fallback ? "Y/n" : "y/N";
    const answer = await ask(`${question} ${c.grey(`[${hint}]`)}`, { default: fallback ? "y" : "n" });
    return /^y(es)?$/i.test(answer.trim());
}

/**
 * Arrow-key menu, with number keys as a fallback.
 * @param choices [{ label, value, hint, danger }]
 */
export async function select(question, choices) {
    assertInteractive("This menu");

    return new Promise((resolve) => {
        let index = 0;

        const render = (first) => {
            // Redraw in place: jump back over the question plus one line per choice.
            if (!first) process.stdout.write(`${ESC}[${choices.length + 1}A`);
            process.stdout.write(`  ${c.bold(question)}${ESC}[K\n`);
            choices.forEach((ch, i) => {
                const active = i === index;
                const marker = active ? c.cyan(">") : " ";
                let label = ch.danger ? c.red(ch.label) : ch.label;
                if (active) label = c.bold(label);
                const hint = ch.hint ? "  " + c.grey(ch.hint) : "";
                process.stdout.write(`  ${marker} ${c.grey(`${i + 1}.`)} ${label}${hint}${ESC}[K\n`);
            });
        };

        emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        render(true);

        const cleanup = () => {
            process.stdin.removeListener("keypress", onKey);
            process.stdin.setRawMode(false);
            process.stdin.pause();
        };

        const onKey = (str, key) => {
            if (key.name === "up" || key.name === "k") {
                index = (index - 1 + choices.length) % choices.length;
                render(false);
            } else if (key.name === "down" || key.name === "j") {
                index = (index + 1) % choices.length;
                render(false);
            } else if (/^[1-9]$/.test(str ?? "") && Number(str) <= choices.length) {
                index = Number(str) - 1;
                render(false);
            } else if (key.name === "return") {
                cleanup();
                resolve(choices[index].value);
            } else if (key.ctrl && key.name === "c") {
                cleanup();
                process.stdout.write("\n");
                process.exit(130);
            }
        };

        process.stdin.on("keypress", onKey);
    });
}

// ---------------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------------

/** Parse a dotenv file into a plain object. No interpolation, no dependencies. */
export function parseEnvFile(path) {
    const out = {};
    let raw;
    try {
        raw = readFileSync(path, "utf8");
    } catch {
        return out;
    }
    for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        out[m[1]] = val;
    }
    return out;
}

/** A Supabase URL reduced to its project ref, which is what identifies a project. */
export function projectRef(url) {
    if (!url) return null;
    const m = /https?:\/\/([a-z0-9-]+)\.supabase\./i.exec(url);
    return m ? m[1] : url.replace(/^https?:\/\//, "").split("/")[0];
}

/**
 * Whether an environment looks like production.
 *
 * Two independent signals, because either alone is easy to get wrong: the file's own
 * name, and whether its URL matches a PRODUCTION_SUPABASE_URL declared anywhere.
 */
function looksLikeProduction(name, vars, productionRef) {
    if (/prod/i.test(name)) return true;
    const url = vars.SUPABASE_URL || vars.NEXT_PUBLIC_SUPABASE_URL;
    return Boolean(productionRef && projectRef(url) === productionRef);
}

/** Every .env* file in the repo root, with what it points at. */
export function discoverEnvironments() {
    const files = readdirSync(ROOT)
        .filter((f) => f.startsWith(".env") && !f.endsWith(".example"))
        .sort();

    // PRODUCTION_SUPABASE_URL may be declared in any of them; collect it first so every
    // environment can be measured against it.
    let productionRef = null;
    for (const f of files) {
        const v = parseEnvFile(join(ROOT, f));
        if (v.PRODUCTION_SUPABASE_URL) productionRef = projectRef(v.PRODUCTION_SUPABASE_URL);
    }

    return files.map((file) => {
        const vars = parseEnvFile(join(ROOT, file));
        const url = vars.SUPABASE_URL || vars.NEXT_PUBLIC_SUPABASE_URL || null;
        return {
            file,
            path: join(ROOT, file),
            vars,
            url,
            ref: projectRef(url),
            hasServiceKey: Boolean(vars.SUPABASE_SERVICE_ROLE_KEY),
            isProduction: looksLikeProduction(file, vars, productionRef),
        };
    });
}

/**
 * Choose an environment and load it into process.env.
 *
 * @param options.purpose          shown in the prompt, e.g. "read from"
 * @param options.refuseProduction hide production entirely (for the test seed)
 * @param options.envFlag          value of an --env flag, to skip the prompt
 */
export async function chooseEnvironment(options = {}) {
    const { purpose = "use", refuseProduction = false, envFlag = null } = options;
    const found = discoverEnvironments();

    if (found.length === 0) {
        throw new Error("No .env files in the project root. Copy .env.example to .env.local.");
    }

    section("Environments");
    table(
        found.map((e) => ({
            file: e.file,
            project: e.ref ?? c.grey("-"),
            key: e.hasServiceKey ? c.green("yes") : c.red("missing"),
            kind: e.isProduction ? c.red("PRODUCTION") : c.grey("development"),
        })),
        [
            { key: "file", label: "FILE" },
            { key: "project", label: "SUPABASE PROJECT" },
            { key: "key", label: "SERVICE KEY" },
            { key: "kind", label: "" },
        ],
    );

    const usable = found.filter((e) => e.url && e.hasServiceKey);
    for (const e of found.filter((e) => !e.url || !e.hasServiceKey)) {
        warn(`${e.file} unusable: ${!e.url ? "no SUPABASE_URL" : "no SUPABASE_SERVICE_ROLE_KEY"}`);
    }

    let candidates = usable;
    if (refuseProduction) {
        for (const e of candidates.filter((e) => e.isProduction)) {
            warn(`${e.file} is production and is not offered by this script.`);
        }
        candidates = candidates.filter((e) => !e.isProduction);
    }

    if (candidates.length === 0) {
        throw new Error("No usable environment. Each needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    let chosen;
    if (envFlag) {
        chosen = candidates.find((e) => e.file === envFlag || e.file === `.env.${envFlag}`);
        if (!chosen) {
            throw new Error(`--env ${envFlag} matched none of: ${candidates.map((e) => e.file).join(", ")}`);
        }
    } else if (candidates.length === 1) {
        chosen = candidates[0];
        blank();
        info(`Only one usable environment: ${c.bold(chosen.file)}`);
    } else {
        blank();
        chosen = await select(`Which environment should this ${purpose}?`, candidates.map((e) => ({
            label: e.file,
            value: e,
            hint: `${e.ref ?? "?"}${e.isProduction ? "   <- PRODUCTION" : ""}`,
            danger: e.isProduction,
        })));
    }

    // Production is never implicit: type the project ref or nothing happens.
    if (chosen.isProduction) {
        blank();
        console.log(`  ${c.red(c.bold("This is PRODUCTION."))} ${c.grey(chosen.ref ?? "")}`);
        const typed = await ask(`  Type ${c.bold(chosen.ref ?? "the project ref")} to continue`);
        if (typed !== chosen.ref) throw new Error("That did not match. Nothing was done.");
    }

    for (const [k, v] of Object.entries(chosen.vars)) process.env[k] = v;

    blank();
    ok(`Using ${c.bold(chosen.file)} ${c.grey(`-> ${chosen.ref ?? chosen.url}`)}`);
    return chosen;
}

/** Read an arg like `--env local`. */
export function flagValue(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : null;
}

export const hasFlag = (name) => process.argv.includes(`--${name}`);

/** Render a thrown error the same way everywhere, and exit non-zero. */
export function die(e) {
    blank();
    console.error(`  ${c.red("X")}   ${c.bold(e instanceof Error ? e.message : String(e))}`);
    blank();
    process.exit(1);
}
