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
 *   node scripts/seed-test.mjs --i-understand-this-is-not-production
 *   node scripts/seed-test.mjs --i-understand-this-is-not-production --reset
 *   node scripts/seed-test.mjs --i-understand-this-is-not-production --password 'Passw0rd!'
 *
 * Flags:
 *   --reset      delete every previously seeded member first, then re-seed
 *   --reset-only delete and stop
 *   --password   give every seeded LEADER this password so you can log in as them.
 *                Without it they get a NULL hash and go through set-password-on-first-
 *                login, which is what really happens when someone is appointed.
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
import { readFileSync } from "node:fs";

const scrypt = promisify(_scrypt);
const KEYLEN = 64;
const TEST_DOMAIN = "@rcffuta.test";

// --- minimal .env.local loader (no dependency), mirroring bootstrap-admin.mjs ---
function loadEnv() {
    try {
        const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
        for (const line of raw.split("\n")) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (!m) continue;
            let val = m[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!(m[1] in process.env)) process.env[m[1]] = val;
        }
    } catch {
        /* fall back to real env */
    }
}

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
 * Refuse to touch anything that might be production.
 *
 * Three independent checks, because any one of them can be wrong. The explicit flag
 * stops an absent-minded run; PRODUCTION_SUPABASE_URL stops the classic mistake of a
 * stale .env.local pointing somewhere real; and the data check stops the case where
 * both of those were configured carelessly but the database plainly has a history.
 */
async function assertNotProduction(db, url) {
    if (!process.argv.includes("--i-understand-this-is-not-production")) {
        throw new Error(
            "Refusing to run without --i-understand-this-is-not-production.\n" +
            "This script writes ~110 fake members. Read the header before using it.",
        );
    }

    const prod = process.env.PRODUCTION_SUPABASE_URL?.trim();
    if (prod && url.trim().replace(/\/+$/, "") === prod.replace(/\/+$/, "")) {
        throw new Error(
            `REFUSING: SUPABASE_URL matches PRODUCTION_SUPABASE_URL (${prod}).\n` +
            "This is the production database. Nothing was written.",
        );
    }
    if (!prod) {
        console.warn(
            "  ! PRODUCTION_SUPABASE_URL is not set, so the URL check was skipped.\n" +
            "    Set it in .env.local to make this guard real.",
        );
    }

    // A database with real administrative history is not a scratch database. The audit
    // log is the best signal available: it only gets rows when a System Admin edits
    // someone's record or downloads a backup, neither of which happens on a fresh dev DB.
    const { count, error } = await db
        .from("admin_audit_log")
        .select("id", { count: "exact", head: true });

    if (error) {
        // Migration 0010 may not be applied on a brand-new scratch project. That is
        // itself evidence it is not production, so this is not fatal — but say so.
        console.warn(`  ! Could not read admin_audit_log (${error.message}) — treating as a fresh database.`);
        return;
    }
    if ((count ?? 0) > 0) {
        throw new Error(
            `REFUSING: admin_audit_log already has ${count} row(s), so this database has real\n` +
            "administrative history. If it genuinely is a scratch copy, clear that table first.",
        );
    }
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
        console.log("  Reset: nothing to remove.");
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
        if (delErr) console.warn(`  ! ${table}: ${delErr.message}`);
    }

    const { error: profErr } = await db.from("profiles").delete().in("id", ids);
    if (profErr) throw new Error(`Could not delete seeded profiles: ${profErr.message}`);

    console.log(`  Reset: removed ${ids.length} seeded member(s).`);
    return ids.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    loadEnv();

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    const db = createClient(url, key);

    console.log(`\nTarget: ${url}`);
    await assertNotProduction(db, url);
    console.log("  Guards passed — this is not production.\n");

    if (process.argv.includes("--reset") || process.argv.includes("--reset-only")) {
        await resetSeed(db);
        if (process.argv.includes("--reset-only")) {
            console.log("\nDone (reset only).\n");
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
    console.log(`Active tenure: ${tenure.name} (${tenure.session})`);

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
            console.log(`  ${g.level.padEnd(10)} ${g.entryYear}  reusing "${existing.family_name}"`);
        } else {
            const { data: created, error } = await db
                .from("class_sets")
                .insert({ entry_year: g.entryYear, family_name: g.familyName, is_foundation: false })
                .select("id")
                .single();
            if (error) throw new Error(`class_sets ${g.entryYear}: ${error.message}`);
            classSetIds[g.level] = created.id;
            console.log(`  ${g.level.padEnd(10)} ${g.entryYear}  created "${g.familyName}"`);
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

    console.log(`\nMembers: ${inserted.length} (${generations.length} × 20 placed, 10 unplaced)`);
    console.log(`  with photos: ${members.filter((m) => m.avatar_url).length}`);

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
        const passwordHash = process.argv.includes("--password")
            ? await hashPassword(process.argv[process.argv.indexOf("--password") + 1])
            : null;

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

        console.log(`\nLeadership: ${rows.length} appointments, ${logins.length} logins provisioned`);
        console.log(
            passwordHash
                ? "  Password set — you can log in as any of them."
                : "  No password set: each goes through set-password-on-first-login (pass --password to change).",
        );
        for (const pos of positions) console.log(`    ${pos.title}`);
    }

    console.log(`\nDone. Remove it all with:  node scripts/seed-test.mjs --i-understand-this-is-not-production --reset-only\n`);
}

main().catch((e) => {
    console.error(`\n${e.message}\n`);
    process.exit(1);
});
