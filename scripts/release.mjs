/**
 * Cut a release: decide the version, write the CHANGELOG, bump package.json.
 *
 * THE VERSIONING RULE — the database decides the number
 *   PATCH   code only. Nothing under db/migrations/ changed.
 *   MINOR   a new migration exists. The database moved.
 *   MAJOR   the release is not safely reversible — dropped columns or tables, or a
 *           migration needing a manual data step.
 *
 * The point is that you can read a version and know whether deploying it requires
 * touching the database. 1.4.2 -> 1.4.3 is a code deploy. 1.4.3 -> 1.5.0 means somebody
 * must run SQL. On a project with one deployment and no consumers, that is worth more
 * than semver's usual API-compatibility promise.
 *
 * MAJOR is never inferred — dropping something is a decision, so it is passed in.
 *
 * Usage:
 *   node scripts/release.mjs                   # dry run: print the proposed release
 *   node scripts/release.mjs --commit          # write CHANGELOG.md + package.json
 *   node scripts/release.mjs --major --commit  # force MAJOR (irreversible migration)
 *   node scripts/release.mjs --commit --tag    # also create the git tag
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = join(ROOT, "package.json");
const CHANGELOG = join(ROOT, "CHANGELOG.md");

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

/** The most recent v* tag, or null on a repo that has never been tagged. */
function lastTag() {
    try {
        return git("describe", "--tags", "--abbrev=0", "--match", "v*");
    } catch {
        return null;
    }
}

/** Commits since `from` (or all of them), as {hash, subject}. */
function commitsSince(from) {
    const range = from ? from + "..HEAD" : "HEAD";
    const out = git("log", range, "--no-merges", "--pretty=format:%h %s");
    if (!out) return [];
    return out.split("\n").map((line) => {
        const space = line.indexOf(" ");
        return { hash: line.slice(0, space), subject: line.slice(space + 1) };
    });
}

/**
 * Migration files ADDED since `from`. This is what decides MINOR.
 *
 * Only `supabase/migrations/` counts. `db/migrations/` is the archived 0001-0013
 * series and is never applied again -- see db/migrations/README.md. A file added
 * there would be documentation, not a database change, and must not bump MINOR.
 *
 * The `.sql` filter matters: this directory also holds a README, and a docs edit
 * is a PATCH.
 */
function migrationsSince(from) {
    const range = from ? from + "..HEAD" : "HEAD";
    const out = git("diff", "--name-only", "--diff-filter=A", range, "--", "supabase/migrations/");
    return out ? out.split("\n").filter((f) => f.endsWith(".sql")) : [];
}

/** Conventional-commit grouping. This repo already uses these prefixes consistently. */
const SECTIONS = [
    ["feat", "Added"],
    ["fix", "Fixed"],
    ["perf", "Performance"],
    ["refactor", "Changed"],
    ["docs", "Documentation"],
    ["chore", "Housekeeping"],
];

function groupCommits(commits) {
    const groups = new Map(SECTIONS.map(([, label]) => [label, []]));
    const other = [];

    for (const c of commits) {
        const m = /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/.exec(c.subject);
        const label = m && SECTIONS.find(([prefix]) => prefix === m[1])?.[1];
        if (label) groups.get(label).push({ ...c, subject: m[2] });
        else other.push(c);
    }
    if (other.length) groups.set("Other", other);

    return [...groups].filter(([, items]) => items.length > 0);
}

function bump(current, level) {
    const [major, minor, patch] = current.split(".").map((n) => parseInt(n, 10));
    if (level === "major") return (major + 1) + ".0.0";
    if (level === "minor") return major + "." + (minor + 1) + ".0";
    return major + "." + minor + "." + (patch + 1);
}

function main() {
    const commit = process.argv.includes("--commit");
    const forceMajor = process.argv.includes("--major");
    const tag = process.argv.includes("--tag");

    const pkg = JSON.parse(readFileSync(PKG, "utf8"));
    const from = lastTag();
    const commits = commitsSince(from);
    const migrations = migrationsSince(from);

    if (commits.length === 0) {
        console.log("No commits since " + (from ?? "the beginning") + ". Nothing to release.");
        return;
    }

    const level = forceMajor ? "major" : migrations.length > 0 ? "minor" : "patch";
    const next = bump(pkg.version, level);
    const date = new Date().toISOString().slice(0, 10);

    const why = forceMajor
        ? "MAJOR — passed --major: this release is not safely reversible."
        : migrations.length > 0
            ? "MINOR — " + migrations.length + " new migration(s); the database moves."
            : "PATCH — no migrations; this is a code-only deploy.";

    const L = [];
    L.push("## " + next + " — " + date);
    L.push("");
    if (migrations.length > 0) {
        L.push("### Database");
        L.push("");
        L.push("**This release moves the database.** CI applies it on merge -- staging on a");
        L.push("push to `stage`, production on a push to `main`. The Free plan has no");
        L.push("automatic backups, so take a full system backup first (Settings -> System");
        L.push("insurance). Migrations in this release:");
        L.push("");
        for (const f of migrations.sort()) L.push("- `" + f + "`");
        L.push("");
    } else {
        L.push("_Code only — no migrations. Deploying this does not touch the database._");
        L.push("");
    }

    for (const [label, items] of groupCommits(commits)) {
        L.push("### " + label);
        L.push("");
        for (const c of items) L.push("- " + c.subject + " (" + c.hash + ")");
        L.push("");
    }

    const entry = L.join("\n");

    console.log("\n" + why);
    console.log("Version: " + pkg.version + " -> " + next);
    console.log("Commits since " + (from ?? "the beginning") + ": " + commits.length + "\n");
    console.log("-".repeat(70));
    console.log(entry);
    console.log("-".repeat(70));

    if (!commit) {
        console.log("\nDry run. Re-run with --commit to write CHANGELOG.md and package.json.\n");
        return;
    }

    const header = [
        "# Changelog",
        "",
        "Versioning follows this project's own rule, which is about the DATABASE:",
        "",
        "- **PATCH** — code only. No migration; deploying does not touch the database.",
        "- **MINOR** — a new migration exists. SQL must be applied.",
        "- **MAJOR** — not safely reversible: dropped columns or tables, or a manual step.",
        "",
        "Generated by `node scripts/release.mjs`.",
        "",
    ].join("\n");

    const existing = existsSync(CHANGELOG)
        ? readFileSync(CHANGELOG, "utf8").replace(/^#[\s\S]*?\n(?=## )/, "")
        : "";

    writeFileSync(CHANGELOG, header + "\n" + entry + "\n" + existing);
    pkg.version = next;
    writeFileSync(PKG, JSON.stringify(pkg, null, 4) + "\n");

    console.log("\nWrote CHANGELOG.md and set package.json version to " + next + ".");

    if (tag) {
        git("tag", "-a", "v" + next, "-m", "v" + next);
        console.log("Tagged v" + next + ". Push it yourself when you are ready.");
    } else {
        console.log("Not tagged. Add --tag, or: git tag -a v" + next + " -m \"v" + next + "\"");
    }
    console.log("");
}

main();
