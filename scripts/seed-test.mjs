/**
 * TEST SEED — a believable fellowship to exercise the handover against.
 *
 * *** THIS MUST NEVER RUN AGAINST PRODUCTION. *** See the guards in assertNotProduction()
 * below; they are the most important code in this file.
 *
 * It creates generations, ~110 members, and enough leadership for the handover wizard to
 * have something real to do. It is the counterpart to db/seed/default.sql, which is
 * bootstrap structure and DOES run in production. Two different things:
 *
 *     default.sql    offices and units          production + development
 *     seed-test.mjs  people filling them        development ONLY
 *
 * Usage:
 *   node scripts/seed-test.mjs                      # pick an environment, then confirm
 *   node scripts/seed-test.mjs --env local
 *   node scripts/seed-test.mjs --reset
 *   node scripts/seed-test.mjs --password 'Passw0rd!'
 *
 * Flags:
 *   --env NAME   choose the environment without the prompt (e.g. `local`)
 *   --reset      delete every previously seeded member first, then re-seed
 *   --reset-only delete and stop
 *   --password   give every seeded LEADER this password so you can log in as them.
 *                Without it they get a NULL hash and go through set-password-on-first-
 *                login, which is what really happens when someone is appointed.
 *   --yes        skip the interactive confirmation (for scripted runs)
 *
 * EVERY seeded profile's email ends in `@rcffuta.test`. That is not cosmetic: it is the
 * only handle `--reset` uses, and `.test` is an RFC 2606 reserved TLD, so none of these
 * addresses can resolve or receive mail even by accident.
 *
 * Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and (for --password) SESSION_SECRET
 * from .env.local, the same way scripts/bootstrap-admin.mjs does.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import {
    c, heading, section, table, kv, ok, warn, info, step, blank, progress,
    chooseEnvironment, confirm, flagValue, hasFlag, die,
} from "./lib/cli.mjs";

const scrypt = promisify(_scrypt);
const KEYLEN = 64;
const TEST_DOMAIN = "@rcffuta.test";

async function hashPassword(password) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("SESSION_SECRET is required for --password (must match the app).");
    const salt = randomBytes(16);
    const derived = await scrypt(`${password}${secret}`, salt, KEYLEN);
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

// ---------------------------------------------------------------------------
// THE GUARDS
// ---------------------------------------------------------------------------

/**
 * The last line of defence, after the environment picker has already refused to offer
 * production at all.
 *
 * A database with real administrative history is not a scratch database. The audit log
 * is the best signal available: it only gains rows when a System Admin edits someone's
 * record or downloads a backup, neither of which happens on a fresh dev database.
 */
async function assertScratchDatabase(db) {
    const { count, error } = await db
        .from("admin_audit_log")
        .select("id", { count: "exact", head: true });

    if (error) {
        // Migration 0010 may not be applied on a brand-new scratch project. That is
        // itself evidence it is not production, so this is not fatal - but say so.
        warn(`Could not read admin_audit_log (${error.message})`);
        info(c.grey("  Treating this as a fresh database."));
        return;
    }
    if ((count ?? 0) > 0) {
        throw new Error(
            `This database has ${count} row(s) of administrative history in admin_audit_log,\n` +
            "  so it is not a scratch copy. Clear that table first if you are certain.",
        );
    }
    ok("No administrative history - this is a scratch database.");
}

// ---------------------------------------------------------------------------
// Names — Nigerian, across the major groups, as FUTA actually looks
// ---------------------------------------------------------------------------
const MALE_FIRST = [
    "Chinedu", "Oluwaseun", "Ibrahim", "Emeka", "Tunde", "Abdulrahman", "Ifeanyi", "Babatunde",
    "Uchechukwu", "Olumide", "Nnamdi", "Segun", "Yusuf", "Chukwuemeka", "Adewale", "Musa",
    "Obinna", "Ayodeji", "Kelechi", "Damilare", "Sodiq", "Chidiebere", "Gbenga", "Okechukwu",
    "Temitope", "Aliyu", "Somtochukwu", "Oluwatobi", "Ekene", "Bamidele",
];
const FEMALE_FIRST = [
    "Chiamaka", "Oluwatosin", "Aisha", "Ngozi", "Folake", "Zainab", "Adaeze", "Bukola",
    "Chinwe", "Omolara", "Ifeoma", "Yetunde", "Halima", "Chidinma", "Adebola", "Fatima",
    "Nkechi", "Oluwadamilola", "Amarachi", "Titilayo", "Rukayat", "Chizoba", "Morenike",
    "Uchenna", "Oluwaseyi", "Maryam", "Blessing", "Temiloluwa", "Onyinye", "Abimbola",
];
const SURNAMES = [
    "Okafor", "Adeyemi", "Bello", "Nwachukwu", "Ogunleye", "Musa", "Eze", "Adebayo",
    "Okonkwo", "Balogun", "Abubakar", "Chukwu", "Oyelaran", "Danjuma", "Nwosu", "Afolabi",
    "Ibrahim", "Onyeka", "Akinyemi", "Sanni", "Udechukwu", "Oladipo", "Garba", "Nnaji",
    "Olawale", "Yakubu", "Ezeh", "Ajayi", "Aminu", "Obi", "Fashola", "Anyanwu",
    "Lawal", "Ugochukwu", "Adekunle", "Suleiman",
];
const DEPARTMENTS = [
    "Computer Science", "Mechanical Engineering", "Biochemistry", "Estate Management",
    "Electrical & Electronics Engineering", "Microbiology", "Industrial Design",
    "Civil Engineering", "Applied Geophysics", "Food Science & Technology",
    "Agricultural Engineering", "Statistics", "Urban & Regional Planning",
    "Building Technology", "Physics Electronics", "Quantity Surveying",
    "Crop Soil & Pest Management", "Mathematics", "Remote Sensing & GIS",
    "Marine Science & Technology",
];
const FACULTIES = ["SEET", "SAAT", "SOS", "SEMT", "SET", "SBS"];

/** Deterministic pseudo-random so two runs produce the same fellowship. */
function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const slugifyName = (s) =>
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ---------------------------------------------------------------------------
// Generations
// ---------------------------------------------------------------------------

/**
 * The generations, derived from the ACTIVE TENURE'S SESSION rather than hardcoded.
 *
 * Level is COMPUTED (`rcf_compute_level(entry_year, is_foundation, session)`), never
 * stored. Hardcoding entry years would silently produce the wrong levels the moment the
 * session rolls over — and rolling the session over is exactly the feature this seed
 * exists to test.
 */
function generationsFor(session) {
    const startYear = parseInt(String(session).slice(0, 4), 10);
    if (Number.isNaN(startYear)) throw new Error(`Active tenure has an unreadable session: "${session}"`);

    // standing = startYear - entryYear + 1, so 500 Level entered 4 years ago.
    return [
        { level: "500 Level", entryYear: startYear - 4, familyName: "Army of Light" },
        { level: "400 Level", entryYear: startYear - 3, familyName: "Pillars of Grace" },
        { level: "300 Level", entryYear: startYear - 2, familyName: "Vessels of Honour" },
        { level: "200 Level", entryYear: startYear - 1, familyName: "Salt and Light" },
        { level: "100 Level", entryYear: startYear,     familyName: "Living Stones" },
    ];
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/**
 * Delete every seeded member and everything hanging off them.
 *
 * Children first: several of these FKs are NOT ON DELETE CASCADE, so deleting profiles
 * up front would fail on a constraint and leave the seed half-removed.
 */
async function resetSeed(db) {
    const { data: profiles, error } = await db
        .from("profiles")
        .select("id")
        .like("email", `%${TEST_DOMAIN}`);
    if (error) throw new Error(`Reset lookup failed: ${error.message}`);

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) {
        info("Nothing to remove.");
        return 0;
    }

    for (const [table, column] of [
        ["auth_sessions", "profile_id"],
        ["profile_login", "profile_id"],
        ["membership_units", "profile_id"],
        ["unit_transfer_requests", "profile_id"],
        ["leadership", "profile_id"],
    ]) {
        const { error: delErr } = await db.from(table).delete().in(column, ids);
        // A table may not exist yet on a partially-migrated scratch DB; keep going.
        if (delErr) warn(`${table}: ${delErr.message}`);
    }

    const { error: profErr } = await db.from("profiles").delete().in("id", ids);
    if (profErr) throw new Error(`Could not delete seeded profiles: ${profErr.message}`);

    ok(`Removed ${ids.length} seeded member(s).`);
    return ids.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const resetOnly = hasFlag("reset-only");
    heading(
        resetOnly ? "Remove the test seed" : "Test seed",
        "development only - never production",
    );

    // The picker does not even OFFER a production environment for this script.
    const env = await chooseEnvironment({
        purpose: "seed",
        refuseProduction: true,
        envFlag: flagValue("env"),
    });
    const db = createClient(env.url, env.vars.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    section("Safety checks");
    await assertScratchDatabase(db);

    if (!hasFlag("yes")) {
        blank();
        const what = resetOnly
            ? `delete every @rcffuta.test member from ${c.bold(env.ref ?? env.file)}`
            : `write ~110 fake members into ${c.bold(env.ref ?? env.file)}`;
        if (!await confirm(`This will ${what}. Continue?`)) {
            info("Nothing was done.");
            return;
        }
    }

    if (hasFlag("reset") || resetOnly) {
        section("Reset");
        await resetSeed(db);
        if (resetOnly) {
            blank();
            ok("Done.");
            blank();
            return;
        }
    }

    // --- active tenure ---
    const { data: tenure, error: tenureErr } = await db
        .from("tenures")
        .select("id, name, session")
        .eq("is_active", true)
        .maybeSingle();
    if (tenureErr) throw new Error(`Could not read tenures: ${tenureErr.message}`);
    if (!tenure) {
        throw new Error(
            "No ACTIVE TENURE. Create one in the portal first — every generation's level is\n" +
            "computed from the active session, so there is nothing to compute against yet.",
        );
    }
    section("Active tenure");
    kv([
        ["Name", tenure.name],
        ["Session", tenure.session],
    ]);

    section("Generations");
    info(c.grey("Entry years are derived from the session above, never hardcoded -"));
    info(c.grey("level is computed, so a fixed year would go wrong on the next rollover."));
    blank();

    // --- generations ---
    const generations = generationsFor(tenure.session);
    const classSetIds = {};
    for (const g of generations) {
        const { data: existing } = await db
            .from("class_sets")
            .select("id, family_name")
            .eq("entry_year", g.entryYear)
            .maybeSingle();

        if (existing) {
            // Reuse rather than duplicate — "Army of Light" is already real data.
            classSetIds[g.level] = existing.id;
            info(`${g.level.padEnd(10)} ${g.entryYear}  ${c.grey("reusing")} ${existing.family_name}`);
        } else {
            const { data: created, error } = await db
                .from("class_sets")
                .insert({ entry_year: g.entryYear, family_name: g.familyName, is_foundation: false })
                .select("id")
                .single();
            if (error) throw new Error(`class_sets ${g.entryYear}: ${error.message}`);
            classSetIds[g.level] = created.id;
            info(`${g.level.padEnd(10)} ${g.entryYear}  ${c.green("created")} ${g.familyName}`);
        }
    }

    // --- members ---
    const rng = makeRng(20260918);
    const used = new Set();
    const members = [];

    function makeMember(classSetId, entryYear, index) {
        const male = rng() < 0.5;
        const first = (male ? MALE_FIRST : FEMALE_FIRST)[Math.floor(rng() * 30)];
        const last = SURNAMES[Math.floor(rng() * SURNAMES.length)];

        let email = `${slugifyName(first)}.${slugifyName(last)}${TEST_DOMAIN}`;
        let n = 2;
        while (used.has(email)) email = `${slugifyName(first)}.${slugifyName(last)}${n++}${TEST_DOMAIN}`;
        used.add(email);

        // 5 of every 20 carry a photo, matched to gender. The other 15 exercise the
        // initials fallback — the state most real members are actually in.
        const avatar = index < 5
            ? `https://randomuser.me/api/portraits/${male ? "men" : "women"}/${Math.floor(rng() * 90) + 1}.jpg`
            : null;

        return {
            first_name: first,
            last_name: last,
            gender: male ? "male" : "female",
            email,
            phone_number: `080${Math.floor(rng() * 90000000 + 10000000)}`,
            department: DEPARTMENTS[Math.floor(rng() * DEPARTMENTS.length)],
            faculty: FACULTIES[Math.floor(rng() * FACULTIES.length)],
            matric_number: entryYear ? `${String(entryYear).slice(2)}/${Math.floor(rng() * 90000 + 10000)}` : null,
            entry_year: entryYear,
            class_set_id: classSetId,
            avatar_url: avatar,
        };
    }

    for (const g of generations) {
        for (let i = 0; i < 20; i++) {
            members.push(makeMember(classSetIds[g.level], g.entryYear, i));
        }
    }

    // 10 with NO generation — the register/update path, where a member exists but has
    // not been placed in a class set yet.
    for (let i = 0; i < 10; i++) members.push(makeMember(null, null, i < 2 ? 0 : 99));

    const { data: inserted, error: memberErr } = await db
        .from("profiles")
        .insert(members)
        .select("id, email, gender, class_set_id");
    if (memberErr) throw new Error(`Could not insert members: ${memberErr.message}`);

    section("Members");
    kv([
        ["Created", String(inserted.length)],
        ["Placed in a generation", `${generations.length} x 20`],
        ["No generation yet", "10  (for testing register / update)"],
        ["With a photo", String(members.filter((m) => m.avatar_url).length)],
        ["Email domain", c.grey("@rcffuta.test  (RFC 2606 reserved - can never receive mail)")],
    ]);

    // --- leadership ---
    // Without real outgoing leaders the handover's access-revocation step shows an empty
    // list and proves nothing, so seed a cabinet.
    const { data: positions, error: posErr } = await db
        .from("leadership_positions")
        .select("id, slug, title")
        .in("slug", [
            "president", "vp-admin", "vp-church-growth", "ict-coord",
            "level-coord-all", "level-coord-300",
            "exco-choir", "exco-ushering", "exco-prayer", "exco-media-and-ambience",
        ]);
    if (posErr) throw new Error(`Could not read positions: ${posErr.message}`);

    if (!positions?.length) {
        console.warn(
            "\n  ! No catalogue positions found. Apply db/seed/default.sql first, then\n" +
            "    re-run with --reset to get a cabinet.",
        );
    } else {
        const finalists = inserted.filter((m) => m.class_set_id === classSetIds["500 Level"]);
        const passwordFlag = flagValue("password");
        const passwordHash = passwordFlag ? await hashPassword(passwordFlag) : null;

        const rows = [];
        const logins = [];
        positions.forEach((pos, i) => {
            const holder = finalists[i % finalists.length];
            if (!holder) return;
            rows.push({
                tenure_id: tenure.id,
                profile_id: holder.id,
                position_id: pos.id,
                class_set_id: pos.slug.startsWith("level-coord-") ? classSetIds["500 Level"] : null,
                is_lead: true,
            });
            logins.push({
                profile_id: holder.id,
                password_hash: passwordHash,
                is_active: true,
                granted_by: holder.id,
            });
        });

        const { error: leadErr } = await db.from("leadership").insert(rows);
        if (leadErr) throw new Error(`Could not seed leadership: ${leadErr.message}`);

        const { error: loginErr } = await db.from("profile_login").insert(logins);
        if (loginErr) throw new Error(`Could not provision logins: ${loginErr.message}`);

        section("Leadership");
        info(`${rows.length} appointments, ${logins.length} logins provisioned.`);
        blank();
        table(
            positions.map((p) => ({ title: p.title, slug: c.grey(p.slug) })),
            [{ key: "title", label: "OFFICE" }, { key: "slug", label: "SLUG" }],
        );
        blank();
        if (passwordHash) {
            ok("Password set - you can log in as any of them.");
        } else {
            info(c.grey("No password set: each goes through set-password-on-first-login,"));
            info(c.grey("which is what really happens on appointment. Pass --password to change."));
        }
    }

    section("Done");
    ok(`Seeded ${c.bold(env.file)} ${c.grey(`(${env.ref})`)}`);
    info(c.grey("Remove it all again with:"));
    info(`  ${c.cyan(`node scripts/seed-test.mjs --env ${env.file.replace(".env.", "")} --reset-only`)}`);
    blank();
}

main().catch(die);
