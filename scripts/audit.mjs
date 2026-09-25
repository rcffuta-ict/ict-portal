/**
 * The system's audit trail, from the terminal. System Admin only.
 *
 * Every trail the portal keeps, merged into ONE timeline so you can trace how
 * something happened: who signed in, who appointed or removed whom, who added a member
 * to a unit, which level links were used, what a handover did, who submitted or
 * corrected results, and every failed verification on the public pages.
 *
 * Read-only, apart from two lines of accountability: your sign-in (login_events) and
 * the fact that you viewed the trail, with your filters (admin_audit_log,
 * "audit.cli"). Whoever watches the watchers can see that too.
 *
 * Usage:
 *   pnpm audit:log                               # the last 24 hours
 *   pnpm audit:log -- --since 7d                 # 30m, 12h, 7d, or a date (2026-09-01)
 *   pnpm audit:log -- --since 2026-09-01 --until 2026-09-08
 *   pnpm audit:log -- --actor "ada"              # done BY someone (name or email)
 *   pnpm audit:log -- --subject "ada"            # done TO someone
 *   pnpm audit:log -- --search "choir"           # anywhere in the line
 *   pnpm audit:log -- --source login,session     # only some trails (see --help)
 *   pnpm audit:log -- --action fail              # actions containing "fail"
 *   pnpm audit:log -- --summary                  # counts, busiest people, failures by IP
 *   pnpm audit:log -- --follow                   # keep watching, like tail -f
 *   pnpm audit:log -- --csv trail.csv            # export what matched
 *   pnpm audit:log -- --env production           # skip the environment picker
 *
 * The output holds personal data (emails, IP addresses, results). Treat an export the
 * way you treat a backup.
 */
import { register } from "node:module";
import { writeFileSync } from "node:fs";

register("./lib/alias-hook.mjs", import.meta.url);

const {
    c, heading, section, kv, ok, warn, info, blank, table,
    chooseEnvironment, flagValue, hasFlag, die,
} = await import("./lib/cli.mjs");
const { authenticate, requireSysAdmin } = await import("./lib/sysadmin-auth.mjs");

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const SOURCES = {
    admin: "Admin actions: access changes, login resets, member edits, backups",
    login: "Sign-ins, failed sign-ins, sign-outs, revoked sessions",
    session: "Sessions started (device and IP)",
    office: "Appointments made and ended",
    membership: "Members added to, removed from or moved between units",
    transfer: "Unit transfer requests and decisions",
    link: "Level and update links: generated, revoked, used, copied",
    handover: "Handover proceedings",
    results: "Results submitted and corrected, rounds opened and closed",
    verify: "Identity checks on public pages (results, Lo!), passed and failed",
    event: "Event registrations",
    profile: "Profiles created",
};

if (hasFlag("help")) {
    heading("Audit trail", "every trail the system keeps, in one timeline");
    info("Sources (--source a,b):");
    for (const [key, text] of Object.entries(SOURCES)) info(`  ${c.bold(key.padEnd(11))} ${text}`);
    blank();
    info("See the top of scripts/audit.mjs for every flag.");
    blank();
    process.exit(0);
}

/** "30m", "12h", "7d" back from now, or an ISO date. */
function parseWhen(value, fallback) {
    if (!value) return fallback;
    const rel = /^(\d+)\s*([mhd])$/i.exec(value.trim());
    if (rel) {
        const ms = { m: 60_000, h: 3_600_000, d: 86_400_000 }[rel[2].toLowerCase()];
        return new Date(Date.now() - Number(rel[1]) * ms);
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) die(new Error(`"${value}" isn't a time. Use 30m, 12h, 7d or a date like 2026-09-01.`));
    return d;
}

const opts = {
    since: parseWhen(flagValue("since"), new Date(Date.now() - 86_400_000)),
    until: parseWhen(flagValue("until"), null),
    sources: flagValue("source") ? flagValue("source").split(",").map((s) => s.trim()) : Object.keys(SOURCES),
    actor: flagValue("actor")?.toLowerCase() ?? null,
    subject: flagValue("subject")?.toLowerCase() ?? null,
    search: flagValue("search")?.toLowerCase() ?? null,
    action: flagValue("action")?.toLowerCase() ?? null,
    limit: Number(flagValue("limit") ?? 300),
    summary: hasFlag("summary"),
    follow: hasFlag("follow"),
    csv: flagValue("csv"),
};
for (const s of opts.sources) {
    if (!SOURCES[s]) die(new Error(`Unknown source "${s}". Run with --help to see them.`));
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Rows needed per source, at most. A day of a busy fellowship is far below this. */
const CAP = 20_000;
const PAGE = 1000; // PostgREST returns at most 1000 rows per request

let db;

/** Every row of `table` whose `column` falls in the window, newest first, paged. */
async function readWindow(table, columns, column, since, until) {
    const rows = [];
    for (let from = 0; from < CAP; from += PAGE) {
        let q = db.from(table).select(columns).gte(column, since.toISOString());
        if (until) q = q.lte(column, until.toISOString());
        const { data, error } = await q.order(column, { ascending: false }).range(from, from + PAGE - 1);
        if (error) {
            // A table a migration hasn't created yet is a gap in the trail, not a crash.
            warnings.add(`${table}: ${error.message}`);
            return rows;
        }
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) return rows;
    }
    warnings.add(`${table}: more than ${CAP} rows in this window; narrow it with --since/--until.`);
    return rows;
}

/** A whole small table, paged. For the lookups that turn ids into names. */
async function readAll(table, columns) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.from(table).select(columns).order("id").range(from, from + PAGE - 1);
        if (error) {
            warnings.add(`${table}: ${error.message}`);
            return rows;
        }
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) return rows;
    }
}

const warnings = new Set();
const lookups = { people: new Map(), units: new Map(), offices: new Map(), tenures: new Map(), events: new Map() };

async function loadLookups() {
    const [people, units, offices, tenures, events] = await Promise.all([
        readAll("profiles", "id, first_name, last_name, email"),
        readAll("units", "id, name"),
        readAll("leadership_positions", "id, title"),
        readAll("tenures", "id, session"),
        readAll("events", "id, title"),
    ]);
    for (const p of people) {
        lookups.people.set(p.id, { name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "(no name)", email: p.email });
    }
    for (const u of units) lookups.units.set(u.id, u.name);
    for (const o of offices) lookups.offices.set(o.id, o.title);
    for (const t of tenures) lookups.tenures.set(t.id, t.session);
    for (const e of events) lookups.events.set(e.id, e.title);
}

const person = (id) => (id ? lookups.people.get(id)?.name ?? `(removed ${String(id).slice(0, 8)})` : null);
const semester = (n) => (n === 1 ? "first semester" : n === 2 ? "second semester" : `semester ${n}`);
const short = (text) => (text ? String(text).slice(0, 8) : "");

/**
 * One source → events of one shape:
 *   { at, source, actor, action, subject, detail, ip, failed }
 * `failed` marks what deserves a second look (failed sign-ins, failed checks).
 */
const READERS = {
    async admin(since, until) {
        const rows = await readWindow("admin_audit_log",
            "created_at, actor_profile_id, actor_name, target_profile_id, target_name, action, field, old_value, new_value",
            "created_at", since, until);
        return rows.map((r) => ({
            at: r.created_at,
            actor: r.actor_name ?? person(r.actor_profile_id),
            action: r.action,
            subject: r.target_name ?? person(r.target_profile_id),
            detail: r.field
                ? `${r.field}: ${r.old_value ?? "∅"} → ${r.new_value ?? "∅"}`
                : r.new_value ?? "",
        }));
    },

    async login(since, until) {
        const rows = await readWindow("login_events", "created_at, profile_id, email, event, ip, user_agent", "created_at", since, until);
        return rows.map((r) => ({
            at: r.created_at,
            actor: r.email ?? person(r.profile_id),
            action: {
                login_success: "sign-in",
                login_fail: "sign-in FAILED",
                logout: "sign-out",
                session_revoked: "session revoked",
            }[r.event] ?? r.event,
            subject: null,
            detail: r.user_agent ?? "",
            ip: r.ip,
            failed: r.event === "login_fail",
        }));
    },

    async session(since, until) {
        const rows = await readWindow("auth_sessions", "created_at, profile_id, ip, user_agent, expires_at, revoked_at, revoked_reason",
            "created_at", since, until);
        return rows.map((r) => ({
            at: r.created_at,
            actor: person(r.profile_id),
            action: "session started",
            subject: null,
            detail: [r.user_agent, r.revoked_at ? `revoked (${r.revoked_reason ?? "no reason"})` : null].filter(Boolean).join(" · "),
            ip: r.ip,
        }));
    },

    async office(since, until) {
        const columns = "created_at, ended_at, ended_by, profile_id, position_id, tenure_id, is_lead";
        const [made, ended] = await Promise.all([
            readWindow("leadership", columns, "created_at", since, until),
            readWindow("leadership", columns, "ended_at", since, until),
        ]);
        const office = (r) => `${lookups.offices.get(r.position_id) ?? "office"}${r.is_lead === false ? " (assistant)" : ""}, ${lookups.tenures.get(r.tenure_id) ?? "?"}`;
        return [
            // Nobody is recorded as the appointer; the admin trail usually is.
            ...made.map((r) => ({ at: r.created_at, actor: null, action: "appointed", subject: person(r.profile_id), detail: office(r) })),
            ...ended.map((r) => ({ at: r.ended_at, actor: person(r.ended_by), action: "appointment ended", subject: person(r.profile_id), detail: office(r) })),
        ];
    },

    async membership(since, until) {
        const rows = await readWindow("membership_events", "created_at, profile_id, unit_id, tenure_id, action, actor_id, actor_name",
            "created_at", since, until);
        return rows.map((r) => ({
            at: r.created_at,
            actor: r.actor_name ?? person(r.actor_id),
            action: `member ${r.action.replace(/_/g, " ")}`,
            subject: person(r.profile_id),
            detail: `${lookups.units.get(r.unit_id) ?? "unit"}, ${lookups.tenures.get(r.tenure_id) ?? "?"}`,
        }));
    },

    async transfer(since, until) {
        const columns = "requested_at, decided_at, profile_id, from_unit_id, to_unit_id, requested_by, decided_by, status, decline_reason";
        const [asked, decided] = await Promise.all([
            readWindow("unit_transfer_requests", columns, "requested_at", since, until),
            readWindow("unit_transfer_requests", columns, "decided_at", since, until),
        ]);
        const move = (r) => `${lookups.units.get(r.from_unit_id) ?? "no unit"} → ${lookups.units.get(r.to_unit_id) ?? "?"}`;
        return [
            ...asked.map((r) => ({ at: r.requested_at, actor: person(r.requested_by), action: "transfer requested", subject: person(r.profile_id), detail: move(r) })),
            ...decided.map((r) => ({
                at: r.decided_at, actor: person(r.decided_by), action: `transfer ${r.status}`, subject: person(r.profile_id),
                detail: move(r) + (r.decline_reason ? ` · "${r.decline_reason}"` : ""),
            })),
        ];
    },

    async link(since, until) {
        const rows = await readWindow("invite_events", "created_at, invite_id, action, profile_id, actor_name, actor_email",
            "created_at", since, until);
        return rows.map((r) => ({
            at: r.created_at,
            actor: r.actor_name ?? r.actor_email,
            action: `link ${r.action}`,
            subject: person(r.profile_id),
            detail: `link ${short(r.invite_id)}`,
        }));
    },

    async handover(since, until) {
        const rows = await readWindow("handover_events", "created_at, intent_id, action, detail, actor_name", "created_at", since, until);
        return rows.map((r) => ({
            at: r.created_at,
            actor: r.actor_name,
            action: `handover ${r.action.replace(/_/g, " ")}`,
            subject: null,
            detail: `${r.detail ?? ""} [${short(r.intent_id)}]`,
            failed: r.action === "failed",
        }));
    },

    async results(since, until) {
        const recordColumns = "submitted_at, updated_at, updated_by, profile_id, session, semester, gpa, cgpa, source";
        const roundColumns = "created_at, closed_at, created_by, session, semester";
        const [submitted, corrected, opened, closed] = await Promise.all([
            readWindow("academic_records", recordColumns, "submitted_at", since, until),
            readWindow("academic_records", recordColumns, "updated_at", since, until),
            readWindow("academic_rounds", roundColumns, "created_at", since, until),
            readWindow("academic_rounds", roundColumns, "closed_at", since, until),
        ]);
        const grade = (r) => `${r.session} ${semester(r.semester)} · GPA ${r.gpa} · CGPA ${r.cgpa}`;
        return [
            ...submitted.map((r) => ({
                at: r.submitted_at, actor: r.source === "coordinator" ? person(r.updated_by) : person(r.profile_id),
                action: r.source === "coordinator" ? "results entered" : "results submitted", subject: person(r.profile_id), detail: grade(r),
            })),
            // An update more than a minute after submission is a correction, not the save itself.
            ...corrected
                .filter((r) => new Date(r.updated_at) - new Date(r.submitted_at) > 60_000)
                .map((r) => ({ at: r.updated_at, actor: person(r.updated_by), action: "results corrected", subject: person(r.profile_id), detail: grade(r) })),
            ...opened.map((r) => ({ at: r.created_at, actor: person(r.created_by), action: "round opened", subject: null, detail: `${r.session} ${semester(r.semester)}` })),
            ...closed.map((r) => ({ at: r.closed_at, actor: null, action: "round closed", subject: null, detail: `${r.session} ${semester(r.semester)}` })),
        ];
    },

    async verify(since, until) {
        const columns = "created_at, client_hash, identifier, succeeded";
        const [results, lo] = await Promise.all([
            readWindow("academic_submit_attempts", columns, "created_at", since, until),
            readWindow("lo_member_verify_attempts", columns, "created_at", since, until),
        ]);
        const shape = (where) => (r) => ({
            at: r.created_at,
            actor: r.identifier ?? "(unknown)",
            action: `${where} check ${r.succeeded ? "passed" : "FAILED"}`,
            subject: null,
            // The client is a hash, never an IP: it groups attempts from one device.
            detail: `device ${short(r.client_hash)}`,
            ip: `#${short(r.client_hash)}`,
            failed: !r.succeeded,
        });
        return [...results.map(shape("results")), ...lo.map(shape("Lo!"))];
    },

    async event(since, until) {
        const rows = await readWindow("event_registrations", "created_at, event_id, first_name, last_name, email", "created_at", since, until);
        return rows.map((r) => ({
            at: r.created_at,
            actor: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
            action: "registered for event",
            subject: null,
            detail: `${lookups.events.get(r.event_id) ?? "event"}${r.email ? ` · ${r.email}` : ""}`,
        }));
    },

    async profile(since, until) {
        const rows = await readWindow("profiles", "created_at, id, email", "created_at", since, until);
        return rows.map((r) => ({ at: r.created_at, actor: null, action: "profile created", subject: person(r.id), detail: r.email ?? "" }));
    },
};

async function collect(since, until) {
    const batches = await Promise.all(
        opts.sources.map(async (source) => (await READERS[source](since, until)).map((e) => ({ source, ...e }))),
    );
    return batches.flat()
        .filter((e) => e.at)
        .filter(matches)
        .sort((a, b) => new Date(a.at) - new Date(b.at));
}

function matches(e) {
    const has = (value, needle) => String(value ?? "").toLowerCase().includes(needle);
    if (opts.actor && !has(e.actor, opts.actor)) return false;
    if (opts.subject && !has(e.subject, opts.subject)) return false;
    if (opts.action && !has(e.action, opts.action)) return false;
    if (opts.search && ![e.actor, e.action, e.subject, e.detail, e.ip].some((v) => has(v, opts.search))) return false;
    return true;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const fit = (text, width) => {
    const s = String(text ?? "—");
    return s.length > width ? s.slice(0, width - 1) + "…" : s.padEnd(width);
};

function printEvent(e) {
    const line = [
        c.grey(clock.format(new Date(e.at))),
        c.blue(fit(e.source, 10)),
        fit(e.actor, 24),
        (e.failed ? c.red : c.bold)(fit(e.action, 22)),
        fit(e.subject, 22),
        c.grey(`${e.detail ?? ""}${e.ip && !String(e.ip).startsWith("#") ? ` · ${e.ip}` : ""}`),
    ].join("  ");
    console.log("  " + line);
}

function printSummary(events) {
    const count = (key) => {
        const m = new Map();
        for (const e of events) {
            const k = key(e);
            if (k) m.set(k, (m.get(k) ?? 0) + 1);
        }
        return [...m].sort((a, b) => b[1] - a[1]);
    };

    section("By source and action");
    table(count((e) => `${e.source}|${e.action}`).map(([k, n]) => {
        const [source, action] = k.split("|");
        return { source, action, n: String(n) };
    }), [{ key: "source", label: "SOURCE" }, { key: "action", label: "ACTION" }, { key: "n", label: "COUNT" }]);

    section("Most active people");
    table(count((e) => e.actor).slice(0, 10).map(([who, n]) => ({ who, n: String(n) })),
        [{ key: "who", label: "WHO" }, { key: "n", label: "EVENTS" }]);

    const failures = events.filter((e) => e.failed);
    section(`Failures (${failures.length})`);
    if (!failures.length) info(c.grey("None."));
    else {
        info("By who they claimed to be:");
        table(count((e) => (e.failed ? e.actor : null)).slice(0, 10).map(([who, n]) => ({ who, n: String(n) })),
            [{ key: "who", label: "EMAIL / IDENTIFIER" }, { key: "n", label: "FAILED" }]);
        blank();
        info("By where they came from (IP, or #device for public checks):");
        table(count((e) => (e.failed ? e.ip : null)).slice(0, 10).map(([from, n]) => ({ from, n: String(n) })),
            [{ key: "from", label: "FROM" }, { key: "n", label: "FAILED" }]);
        blank();
        info(c.grey("Many failures for one email: someone guessing a password. Many from one IP or device: someone probing."));
    }
}

function writeCsv(path, events) {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["time", "source", "actor", "action", "subject", "detail", "ip"].join(",")];
    for (const e of events) lines.push([e.at, e.source, e.actor, e.action, e.subject, e.detail, e.ip].map(cell).join(","));
    writeFileSync(path, lines.join("\n") + "\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    heading("Audit trail", "every trail the system keeps, in one timeline");
    const env = await chooseEnvironment({ purpose: "audit", envFlag: flagValue("env") });

    ({ db } = await import("@/lib/db"));
    const { verifyPassword } = await import("@/lib/auth/password");

    const recordAttempt = async (event, ctx) => {
        try {
            await db.from("login_events").insert({
                profile_id: ctx.profileId ?? null, email: ctx.email ?? null, event, ip: null,
                user_agent: "cli:scripts/audit.mjs",
            });
        } catch { /* best effort */ }
    };

    section("Sign in");
    const me = await authenticate(db, verifyPassword, recordAttempt);
    const { tenure, positionTitle } = await requireSysAdmin(db, me, "reading the audit trail");
    const myName = `${me.first_name} ${me.last_name}`.trim();
    ok(`${c.bold(myName)} — ${positionTitle}, ${tenure.session}`);

    const filters = [
        `since ${opts.since.toISOString()}`,
        opts.until && `until ${opts.until.toISOString()}`,
        opts.sources.length !== Object.keys(SOURCES).length && `sources ${opts.sources.join(",")}`,
        opts.actor && `actor "${opts.actor}"`,
        opts.subject && `subject "${opts.subject}"`,
        opts.search && `search "${opts.search}"`,
        opts.action && `action "${opts.action}"`,
    ].filter(Boolean).join("; ");

    // Viewing the trail is itself on the trail.
    try {
        await db.from("admin_audit_log").insert({
            actor_profile_id: me.id, actor_name: myName, action: "audit.cli", field: "filters", new_value: filters,
        });
    } catch { /* best effort */ }

    await loadLookups();
    const events = await collect(opts.since, opts.until);

    section("Trail");
    kv([
        ["Project", env.ref ?? env.file],
        ["Window", `${clock.format(opts.since)} → ${opts.until ? clock.format(opts.until) : "now"} (Lagos time)`],
        ["Filters", filters],
        ["Matched", String(events.length)],
    ]);
    blank();

    const shown = events.slice(-opts.limit);
    if (events.length > shown.length) {
        info(c.yellow(`Showing the latest ${shown.length} of ${events.length}. Use --limit, a narrower window, or --csv for all.`));
        blank();
    }
    if (!shown.length) info(c.grey("Nothing happened in this window with these filters."));
    for (const e of shown) printEvent(e);

    if (opts.summary) printSummary(events);

    if (opts.csv) {
        writeCsv(opts.csv, events);
        blank();
        ok(`Wrote ${events.length} event(s) to ${c.bold(opts.csv)}. It holds personal data: keep it private and delete it when done.`);
    }

    for (const w of warnings) warn(c.grey(w));

    if (!opts.follow) {
        blank();
        return;
    }

    blank();
    info(c.grey("Watching for new events every 10 seconds. Ctrl-C to stop."));
    let last = events.length ? new Date(events[events.length - 1].at) : new Date();
    const seen = new Set(events.map((e) => `${e.at}|${e.source}|${e.action}|${e.actor}|${e.subject}`));
    for (let tick = 1; ; tick++) {
        await new Promise((r) => setTimeout(r, 10_000));
        // Names change rarely; refreshing them every minute is plenty.
        if (tick % 6 === 0) await loadLookups();
        const fresh = await collect(new Date(last.getTime() - 1000), null);
        for (const e of fresh) {
            const key = `${e.at}|${e.source}|${e.action}|${e.actor}|${e.subject}`;
            if (seen.has(key)) continue;
            seen.add(key);
            printEvent(e);
            if (new Date(e.at) > last) last = new Date(e.at);
        }
    }
}

main().catch(die);
