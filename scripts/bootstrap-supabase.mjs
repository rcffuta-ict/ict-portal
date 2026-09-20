/**
 * Bring a fresh Supabase project up to the portal's schema, and put both projects
 * under CI control — one command, from a machine that can reach the dashboard.
 *
 * THE SITUATION THIS EXISTS FOR
 *   Production and staging used to live in two different Supabase accounts, and every
 *   migration was pasted into the SQL editor by hand. Consolidating onto one account
 *   means a brand-new, EMPTY staging project that needs the whole schema, while
 *   production already has it and must not be touched.
 *
 *   Those are two different problems and the script treats them differently:
 *
 *     SOURCE (production)  already correct. Gets ONE write: a row in the CLI's ledger
 *                          saying the baseline is already applied. Nothing else.
 *                          No DDL, no data, nothing dropped.
 *     TARGET (new staging) empty. Gets the baseline applied for real, then optionally
 *                          the bootstrap seed.
 *
 * WHY A BASELINE INSTEAD OF REPLAYING db/migrations/0001-0013
 *   That series cannot build a database from zero and never could. 0001 opens with
 *   `ALTER TABLE public.profiles` and nothing in the set ever creates `profiles` —
 *   nor events, units, tenures, leadership, class_sets, or the question tables. They
 *   came from a dump that predates 0001 and was never committed. So the baseline is a
 *   real pg_dump of production, which by definition already contains 0001-0013
 *   correctly applied. See db/migrations/README.md.
 *
 * WHAT COMES OUT
 *   supabase/migrations/<timestamp>_0000_baseline.sql — the portal's schema, with the
 *   other four applications sharing this database filtered out, plus a backfill of
 *   public.schema_migrations so the new project can answer "which migrations ran".
 *
 * Usage:
 *   node scripts/bootstrap-supabase.mjs              # dry run: dump, filter, report
 *   node scripts/bootstrap-supabase.mjs --apply      # also write to both projects
 *   node scripts/bootstrap-supabase.mjs --apply --include-foreign
 *   node scripts/bootstrap-supabase.mjs --source izofyqiaazidryoejsot --target abc123
 *
 * Dry run by default, like scripts/restore-backup.mjs. It still dumps and filters, so
 * you can read the baseline before anything is written anywhere.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
    ROOT, c, heading, section, table, kv, ok, warn, fail, info, step, blank,
    ask, confirm, select, flagValue, hasFlag, die,
} from "./lib/cli.mjs";
import { PORTAL_TABLES, FOREIGN, ALL_FOREIGN, UNCLASSIFIED, isForeignName } from "./lib/tables.mjs";

const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SEED_FILE = join(ROOT, "db", "seed", "default.sql");

/**
 * The baseline is deliberately stamped in the past.
 *
 * Migrations apply in lexical order of this prefix. Dating the baseline 2026-01-01
 * guarantees every migration written from now on sorts after it, no matter when this
 * script is run or how clocks differ between machines.
 */
const BASELINE_VERSION = "20260101000000";
const BASELINE_NAME = `${BASELINE_VERSION}_0000_baseline.sql`;

// ---------------------------------------------------------------------------
// Shelling out to the Supabase CLI
// ---------------------------------------------------------------------------

/** Run the CLI and hand its output back. Throws with the CLI's own stderr on failure. */
function supabase(args, { capture = true } = {}) {
    try {
        return execFileSync("supabase", args, {
            cwd: ROOT,
            encoding: "utf8",
            stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
        });
    } catch (e) {
        const detail = (e.stderr || e.stdout || e.message || "").toString().trim();
        throw new Error(`supabase ${args.join(" ")}\n${detail}`);
    }
}

/**
 * Link to a project, letting the CLI prompt for the database password itself.
 *
 * Deliberately NOT read from a flag or an env var: the database password is the one
 * credential that is not already in a .env file here, and routing it through this
 * script's argv would put it in the shell history of whoever runs the handover.
 */
function link(ref) {
    step(`Linking to ${c.bold(ref)} — the CLI will ask for that project's database password.`);
    supabase(["link", "--project-ref", ref], { capture: false });
}

// ---------------------------------------------------------------------------
// Filtering the dump down to the portal
// ---------------------------------------------------------------------------

/**
 * pg_dump emits every object behind a header comment:
 *
 *     --
 *     -- Name: rw_products; Type: TABLE; Schema: public; Owner: postgres
 *     --
 *
 *     CREATE TABLE public.rw_products (...);
 *
 * That header is why the dump is taken with --keep-comments: it turns an opaque wall
 * of SQL into labelled blocks that can be kept or dropped individually.
 */
const BLOCK_HEADER = /^--\n-- Name: (.+?); Type: (.+?); Schema: (.+?); Owner: (.*)\n--\n/gm;

function splitBlocks(sql) {
    const blocks = [];
    const headers = [...sql.matchAll(BLOCK_HEADER)];

    // Everything before the first header is pg_dump's preamble — SET statements,
    // extensions, schema creation. Always kept.
    const preamble = headers.length ? sql.slice(0, headers[0].index) : sql;

    headers.forEach((h, i) => {
        const end = i + 1 < headers.length ? headers[i + 1].index : sql.length;
        blocks.push({
            name: h[1],
            type: h[2],
            schema: h[3],
            text: sql.slice(h.index, end),
        });
    });

    return { preamble, blocks };
}

/**
 * Decide whether a block belongs to another application.
 *
 * Checks the BODY, not just the header name, because the direction of the foreign keys
 * makes that safe and thorough: all 45 references between these applications point AT
 * `public.profiles` (see scripts/prune-profiles.mjs) — no portal table references a
 * foreign one. So a block mentioning `rw_`/`fyb_`/`elib_`/game tables anywhere is a
 * foreign block, and dropping it can never orphan a portal object.
 */
function ownerOfBlock(block, { keepUnclassified }) {
    const firstToken = block.name.split(/[\s(]/)[0];
    if (isForeignName(firstToken)) return "FOREIGN";

    for (const t of ALL_FOREIGN) {
        if (new RegExp(`\\bpublic\\.${t}\\b`).test(block.text)) return "FOREIGN";
    }
    if (/\bpublic\.(rw_|fyb_|elib_|game_|trivia_|bingo_|buzzer_)\w+/.test(block.text)) return "FOREIGN";

    if (!keepUnclassified && UNCLASSIFIED.includes(firstToken)) return "UNCLASSIFIED";
    if (!keepUnclassified && UNCLASSIFIED.some((t) => new RegExp(`\\bpublic\\.${t}\\b`).test(block.text))) {
        return "UNCLASSIFIED";
    }

    return "PORTAL";
}

function filterDump(sql, { keepForeign, keepUnclassified }) {
    const { preamble, blocks } = splitBlocks(sql);
    if (!blocks.length) {
        throw new Error(
            "The dump has no `-- Name:` headers, so it cannot be filtered safely.\n" +
            "That means --keep-comments did not take effect. Re-run, or pass --include-foreign\n" +
            "to apply the dump unfiltered.",
        );
    }

    const kept = [];
    const dropped = [];

    for (const b of blocks) {
        const owner = keepForeign ? "PORTAL" : ownerOfBlock(b, { keepUnclassified });
        (owner === "PORTAL" ? kept : dropped).push({ ...b, owner });
    }

    return { preamble, kept, dropped, total: blocks.length };
}

/**
 * The safety net.
 *
 * If the filter dropped a table that a kept block still references, the baseline would
 * fail halfway through applying and leave the new project half-built. Cheaper to catch
 * it here than in a half-applied migration.
 */
function findDanglingReferences(kept, dropped) {
    const droppedTables = new Set(
        dropped.filter((b) => b.type === "TABLE" || b.type === "VIEW")
            .map((b) => b.name.split(/[\s(]/)[0]),
    );

    const problems = [];
    for (const b of kept) {
        for (const t of droppedTables) {
            if (new RegExp(`\\bpublic\\.${t}\\b`).test(b.text)) {
                problems.push({ block: `${b.type} ${b.name}`, references: t });
            }
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------
// Assertions about what the dump should contain
// ---------------------------------------------------------------------------

/**
 * Confirm the source really is at 0013's end state before it becomes the baseline
 * every future environment is built from. A dump taken from the wrong project, or one
 * where 0013 never landed, looks perfectly valid as SQL.
 */
function auditBaseline(kept) {
    const names = new Set(kept.map((b) => b.name.split(/[\s(]/)[0]));
    const leadershipPositions = kept.find(
        (b) => b.type === "TABLE" && b.name.split(/[\s(]/)[0] === "leadership_positions",
    );

    return [
        {
            check: "public.schema_migrations exists",
            pass: names.has("schema_migrations"),
            why: "the ledger 0013 created; without it the new project cannot report its own state",
        },
        {
            check: "question_flags KEPT",
            pass: names.has("question_flags"),
            why: "event_questions_with_details depends on it — 0013 tried to drop it and failed",
        },
        {
            check: "leadership_positions has no `category`",
            pass: Boolean(leadershipPositions) && !/^\s+category\s/m.test(leadershipPositions.text),
            why: "0013 dropped it; it is derived by rcf_position_kind() now",
        },
        {
            check: "leadership_positions has no `is_default`",
            pass: Boolean(leadershipPositions) && !/^\s+is_default\s/m.test(leadershipPositions.text),
            why: "0013 dropped it in favour of tier + is_protected",
        },
        {
            check: "rcf_profile_context present",
            pass: names.has("rcf_profile_context"),
            why: "the auth RPC — the portal cannot log anyone in without it",
        },
        {
            check: "every portal table present",
            pass: PORTAL_TABLES.every((t) => names.has(t)),
            why: "missing: " + PORTAL_TABLES.filter((t) => !names.has(t)).join(", "),
        },
    ];
}

// ---------------------------------------------------------------------------
// The ledger backfill appended to the baseline
// ---------------------------------------------------------------------------

/**
 * A schema dump carries no rows, so a fresh project would have an EMPTY
 * public.schema_migrations and `pnpm db:status` would report no history at all.
 * This restates the backfill from 0013 so the new project knows where it came from.
 */
function ledgerBackfill() {
    const rows = [
        ["0001", "0.1.0", "auth_rework"],
        ["0002", "0.1.0", "invites"],
        ["0003", "0.1.0", "password_on_first_login"],
        ["0004", "0.1.0", "module_access_and_slugs"],
        ["0005", "0.1.0", "tenure_phase2"],
        ["0006", "0.1.0", "privilege_tags"],
        ["0007", "0.1.0", "level_tokens"],
        ["0008", "0.1.0", "testimonies"],
        ["0009", "0.1.0", "event_datetime"],
        ["0010", "0.1.0", "admin_audit_log"],
        ["0011", "0.1.0", "frozen_catalogue_and_transfers"],
        ["0012", "0.1.0", "handover_intents"],
        ["0013", "1.0.0", "structural_cleanup"],
    ];

    const values = rows
        .map(([id, v, n]) => `    ('${id}', '${v}', '${n}', NULL, NULL, 'Folded into the baseline — applied before CI existed.')`)
        .join(",\n");

    return `
-- ============================================================================
-- Appended by scripts/bootstrap-supabase.mjs — not part of the pg_dump.
--
-- A schema dump has no rows, so public.schema_migrations would arrive empty and
-- \`pnpm db:status\` would report a database with no history. These thirteen rows are
-- the series in db/migrations/, which this baseline already contains the result of.
-- ============================================================================
INSERT INTO public.schema_migrations (id, version, name, applied_at, applied_by, notes)
VALUES
${values}
ON CONFLICT (id) DO NOTHING;
`;
}

function baselineHeader({ sourceRef, keptCount, droppedCount, keepForeign }) {
    return `-- ============================================================================
-- 0000 — BASELINE.  The schema every environment is built from.
--
-- Generated by scripts/bootstrap-supabase.mjs from project ${sourceRef}
-- on ${new Date().toISOString()}.
--
-- This is a pg_dump of production, which already contains migrations 0001-0013
-- applied. It exists because that series cannot build a database from zero: 0001
-- opens with \`ALTER TABLE public.profiles\` and nothing in the set ever creates
-- \`profiles\`. See db/migrations/README.md.
--
-- ${keepForeign
        ? "Unfiltered: the other applications sharing this database are INCLUDED."
        : `Filtered to the portal: ${keptCount} objects kept, ${droppedCount} belonging to
--   the other applications sharing this database (rw_*, fyb_*, elib_*, games) removed.
--   Those still exist in production untouched — this file is only ever APPLIED to a
--   fresh project, never to production.`}
--
-- DO NOT EDIT, and do not rename it. It has been applied; the remote ledger records
-- this timestamp, and changing it makes the CLI refuse to push.
-- ============================================================================

`;
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

async function pickProject(role, projects, preset, { danger = false } = {}) {
    if (preset) return preset;
    if (!projects.length) {
        return ask(`Project ref for ${c.bold(role)}`);
    }
    return select(`Which project is ${c.bold(role)}?`, [
        ...projects.map((p) => ({
            label: `${p.name}  ${c.grey(p.id)}`,
            value: p.id,
            hint: p.region ?? "",
            danger,
        })),
        { label: "Enter a ref by hand", value: "__manual__" },
    ]).then((v) => (v === "__manual__" ? ask(`Project ref for ${role}`) : v));
}

function listProjects() {
    try {
        const raw = supabase(["projects", "list", "--output-format", "json"]);
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        // Not fatal: the account may not be logged in yet, or the CLI output shape may
        // have moved. Falling back to typing a ref keeps the script usable either way.
        return [];
    }
}

async function main() {
    const apply = hasFlag("apply");
    const keepForeign = hasFlag("include-foreign");
    const keepUnclassified = hasFlag("keep-unclassified");

    heading(
        "Bootstrap Supabase",
        apply ? c.red("APPLY — this writes to both projects") : "Dry run — nothing will be written",
    );

    // --- Preflight ---------------------------------------------------------
    section("Preflight");
    let version;
    try {
        version = supabase(["--version"]).trim();
    } catch {
        throw new Error("The Supabase CLI is not installed or not on PATH.\n  https://supabase.com/docs/guides/cli");
    }
    ok(`Supabase CLI ${version}`);

    if (existsSync(join(MIGRATIONS_DIR, BASELINE_NAME))) {
        throw new Error(
            `supabase/migrations/${BASELINE_NAME} already exists.\n` +
            "  A baseline is generated once. If you really mean to regenerate it, delete that\n" +
            "  file first — and remember every project that has applied it will then need\n" +
            "  `supabase migration repair` to match.",
        );
    }
    ok("No baseline yet — this is a first run");

    const projects = listProjects();
    if (projects.length) ok(`${projects.length} project(s) visible in this account`);
    else warn("Could not list projects — you will be asked for refs. Run `supabase login` if that is unexpected.");

    // --- Choose the two ends ----------------------------------------------
    section("Projects");
    info("SOURCE is the one that already has the real schema — production.");
    info("TARGET is the new, EMPTY project that becomes staging/dev.");
    blank();

    const sourceRef = await pickProject("SOURCE (production — read from, never altered)", projects, flagValue("source"));
    const targetRef = await pickProject("TARGET (new, empty — will be built)", projects, flagValue("target"), { danger: true });

    if (sourceRef === targetRef) {
        throw new Error("SOURCE and TARGET are the same project. That would apply the baseline to production.");
    }

    blank();
    kv([
        ["SOURCE", `${c.cyan(sourceRef)}  ${c.grey("gets one ledger row, no DDL")}`],
        ["TARGET", `${c.yellow(targetRef)}  ${c.grey("gets the full schema")}`],
        ["Foreign apps", keepForeign ? c.yellow("included") : "filtered out"],
    ]);

    // --- Dump --------------------------------------------------------------
    section("1. Dump the production schema");
    link(sourceRef);

    const rawPath = join(ROOT, ".tmp", `baseline-raw-${Date.now()}.sql`);
    mkdirSync(join(ROOT, ".tmp"), { recursive: true });

    step("Dumping — this reads the schema only, no rows, no writes.");
    supabase(["db", "dump", "--linked", "--keep-comments", "-f", rawPath], { capture: false });

    const raw = readFileSync(rawPath, "utf8");
    ok(`Dumped ${(raw.length / 1024).toFixed(0)} KB to ${c.grey(rawPath)}`);

    // --- Filter ------------------------------------------------------------
    section("2. Filter to the portal");
    const { preamble, kept, dropped, total } = filterDump(raw, { keepForeign, keepUnclassified });

    const byOwner = new Map();
    for (const b of dropped) {
        const key = ALL_FOREIGN.includes(b.name.split(/[\s(]/)[0])
            ? Object.entries(FOREIGN).find(([, ts]) => ts.includes(b.name.split(/[\s(]/)[0]))?.[0] ?? b.owner
            : b.owner;
        byOwner.set(key, (byOwner.get(key) ?? 0) + 1);
    }

    kv([
        ["Objects in dump", String(total)],
        ["Kept (portal)", c.green(String(kept.length))],
        ["Removed", dropped.length ? c.yellow(String(dropped.length)) : "0"],
    ]);

    if (dropped.length) {
        blank();
        table(
            [...byOwner].map(([owner, count]) => ({ owner, count: String(count) })),
            [{ key: "owner", label: "NOT THE PORTAL'S" }, { key: "count", label: "OBJECTS" }],
        );
        blank();
        info(c.grey("Removed from this file only. Production keeps every one of them."));
    }

    const dangling = findDanglingReferences(kept, dropped);
    if (dangling.length) {
        blank();
        fail("Filtering would leave dangling references. Refusing to write a baseline that cannot apply:");
        table(dangling.map((d) => ({ block: d.block, references: d.references })),
            [{ key: "block", label: "KEPT OBJECT" }, { key: "references", label: "NEEDS" }]);
        blank();
        throw new Error("Re-run with --include-foreign to keep the whole schema instead.");
    }
    ok("No dangling references");

    // --- Audit -------------------------------------------------------------
    section("3. Is this really the post-0013 schema?");
    const audit = auditBaseline(kept);
    table(
        audit.map((a) => ({
            result: a.pass ? c.green("PASS") : c.red("FAIL"),
            check: a.check,
            why: c.grey(a.pass ? "" : a.why),
        })),
        [{ key: "result", label: "" }, { key: "check", label: "CHECK" }, { key: "why", label: "" }],
    );

    if (audit.some((a) => !a.pass)) {
        blank();
        throw new Error(
            "The dump is not at 0013's end state. Check you picked the right SOURCE project\n" +
            "  before letting this become the baseline every environment is built from.",
        );
    }

    // --- Write -------------------------------------------------------------
    section("4. Write the baseline");
    const baseline =
        baselineHeader({ sourceRef, keptCount: kept.length, droppedCount: dropped.length, keepForeign }) +
        preamble +
        kept.map((b) => b.text).join("") +
        ledgerBackfill();

    const outPath = join(MIGRATIONS_DIR, BASELINE_NAME);
    if (apply) {
        mkdirSync(MIGRATIONS_DIR, { recursive: true });
        writeFileSync(outPath, baseline);
        ok(`Wrote ${c.bold(`supabase/migrations/${BASELINE_NAME}`)} (${(baseline.length / 1024).toFixed(0)} KB)`);
    } else {
        const preview = join(ROOT, ".tmp", BASELINE_NAME);
        writeFileSync(preview, baseline);
        warn(`Dry run — baseline written to ${c.grey(preview)} for review, not to supabase/migrations/.`);
    }

    // --- Both ends ---------------------------------------------------------
    if (!apply) {
        section("What --apply would do next");
        info(`1. supabase link --project-ref ${sourceRef}`);
        info(`2. supabase migration repair --status applied ${BASELINE_VERSION}   ${c.grey("(one ledger row; no DDL)")}`);
        info(`3. supabase link --project-ref ${targetRef}`);
        info(`4. supabase db push                                     ${c.grey("(builds the empty project)")}`);
        info(`5. supabase db query --linked -f db/seed/default.sql   ${c.grey("(optional, you are asked)")}`);
        blank();
        ok("Read the baseline, then re-run with --apply.");
        return;
    }

    section("5. Mark the baseline applied on production");
    info("Production already has this schema. This writes ONE row to the CLI's ledger so");
    info("that the first push to main does not try to replay it against a live database.");
    blank();
    if (!(await confirm(`Repair the migration history on ${c.cyan(sourceRef)}?`, { default: true }))) {
        throw new Error("Stopped. The baseline file is written; nothing has been sent to either project.");
    }
    link(sourceRef);
    supabase(["migration", "repair", "--status", "applied", BASELINE_VERSION], { capture: false });
    ok("Production ledger updated");
    supabase(["migration", "list"], { capture: false });

    section("6. Build the new project");
    warn(`This APPLIES the schema to ${c.yellow(targetRef)}. It must be an empty project.`);
    if (!(await confirm(`Push the baseline to ${c.yellow(targetRef)}?`, { default: false }))) {
        throw new Error("Stopped before touching the target.");
    }
    link(targetRef);
    supabase(["db", "push"], { capture: false });
    ok("Target built");

    section("7. Bootstrap data");
    if (!existsSync(SEED_FILE)) {
        warn("db/seed/default.sql is missing — skipping.");
    } else if (await confirm("Apply db/seed/default.sql (units, positions, privileges) to the target?", { default: true })) {
        // Still linked to the target from step 6.
        //
        // NOT `db push --include-seed`: that reads the sql_paths in supabase/config.toml,
        // which is the path CI uses for a LOCAL reset. Naming the file explicitly means
        // this applies the same bootstrap data whatever the config says.
        supabase(["db", "query", "--linked", "-f", "db/seed/default.sql"], { capture: false });
        ok("Seed applied");
    } else {
        info("Skipped. Apply it yourself with:");
        info(c.grey("  supabase db query --linked -f db/seed/default.sql"));
    }

    section("Done");
    kv([
        ["SOURCE", `${c.cyan(sourceRef)} — ledger repaired, schema untouched`],
        ["TARGET", `${c.yellow(targetRef)} — built from the baseline`],
        ["Baseline", `supabase/migrations/${BASELINE_NAME}`],
    ]);
    blank();
    info("Next:");
    info("  1. Commit the baseline.");
    info("  2. Set the GitHub secrets in docs/DATABASE-CICD.md.");
    info("  3. Push a no-op to `stage` and watch the workflow report nothing to apply.");
}

main().catch(die);
