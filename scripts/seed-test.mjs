/**
 * TEST SEED — a believable fellowship to exercise the handover against.
 *
 * *** THIS MUST NEVER RUN AGAINST PRODUCTION. *** See the guards in assertNotProduction()
 * below; they are the most important code in this file.
 *
 * It creates generations and 110 members -- people, and nothing they do. No offices are
 * filled: an appointment is a decision somebody made, and inventing them makes the
 * cabinet screen useless as a record of who actually leads. It is the counterpart to
 * db/seed/default.sql, which is bootstrap structure and DOES run in production:
 *
 *     default.sql    offices and units          production + development
 *     seed-test.mjs  people filling them        development ONLY
 *
 * Usage:
 *   node scripts/seed-test.mjs                      # pick an environment, then confirm
 *   node scripts/seed-test.mjs --env local
 *   node scripts/seed-test.mjs --reset
 *   node scripts/seed-test.mjs --env local --dry-run
 *
 * Flags:
 *   --env NAME   choose the environment without the prompt (e.g. `local`)
 *   --reset      delete every previously seeded member first, then re-seed
 *   --reset-only delete and stop
 *   --yes        skip the interactive confirmation (for scripted runs)
 *   --dry-run    generate the roster and print a sample; write nothing
 *
 * EVERY seeded profile's email ends in `@rcffuta.test`. That is not cosmetic: it is the
 * only handle `--reset` uses, and `.test` is an RFC 2606 reserved TLD, so none of these
 * addresses can resolve or receive mail even by accident.
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local, the same way
 * scripts/bootstrap-admin.mjs does.
 */
import { createClient } from "@supabase/supabase-js";
import {
    c, heading, section, table, kv, ok, warn, info, blank,
    chooseEnvironment, confirm, flagValue, hasFlag, die,
} from "./lib/cli.mjs";

const TEST_DOMAIN = "@rcffuta.test";

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
// The people — Nigerian, and internally consistent
// ---------------------------------------------------------------------------
/**
 * A member is generated from an ORIGIN, not from a row of independent dice.
 *
 * Rolling every field separately is what makes fake data look fake: it produces
 * "Chinedu Adeyemi from Sokoto studying Computer Science in the School of Agriculture",
 * and once you have seen one of those you stop trusting any screen the data is on.
 * Origin is therefore picked FIRST, and the given name, middle name, surname and home
 * town all come from it, so a name and a home state agree the way they do in real life.
 *
 * The weights are roughly what a fellowship in Akure looks like — Yoruba-majority,
 * a large Igbo contingent, a steady South-South presence, and a Middle-Belt minority.
 * They are a plausible shape, not a census.
 *
 * All four sets are CHRISTIAN given names, because this is a Christian fellowship's
 * roster. Northern representation is Middle-Belt (Tiv, Berom, Idoma) rather than
 * Hausa-Fulani Muslim names, which would be a strange thing to find on an RCF list.
 */
const ORIGINS = [
    {
        key: "Yoruba",
        weight: 45,
        male: ["Oluwaseun", "Babatunde", "Adewale", "Segun", "Olumide", "Ayodeji",
            "Damilare", "Temitope", "Oluwatobi", "Bamidele", "Gbenga", "Adeolu",
            "Oluwafemi", "Ifeoluwa", "Boluwatife", "Akintunde"],
        female: ["Oluwatosin", "Folake", "Bukola", "Omolara", "Yetunde", "Adebola",
            "Oluwadamilola", "Titilayo", "Morenike", "Oluwaseyi", "Temiloluwa",
            "Abimbola", "Funmilayo", "Adenike", "Similoluwa", "Iyanuoluwa"],
        middle: ["Ayomide", "Olamide", "Toluwani", "Adebisi", "Omotola", "Oluwadara",
            "Opeyemi", "Babajide", "Foluke", "Olusola"],
        surnames: ["Adeyemi", "Ogunleye", "Adebayo", "Balogun", "Afolabi", "Akinyemi",
            "Oladipo", "Olawale", "Ajayi", "Adekunle", "Oyelaran", "Ogundipe",
            "Ilesanmi", "Fadairo", "Olatunji", "Akinbode"],
        homes: [["Akure", "Ondo"], ["Ondo City", "Ondo"], ["Owo", "Ondo"],
            ["Ikare-Akoko", "Ondo"], ["Ibadan", "Oyo"], ["Osogbo", "Osun"],
            ["Ilesa", "Osun"], ["Ado-Ekiti", "Ekiti"], ["Abeokuta", "Ogun"],
            ["Ikorodu", "Lagos"], ["Ikeja", "Lagos"], ["Ijebu-Ode", "Ogun"]],
    },
    {
        key: "Igbo",
        weight: 30,
        male: ["Chinedu", "Emeka", "Ifeanyi", "Uchechukwu", "Nnamdi", "Chukwuemeka",
            "Obinna", "Kelechi", "Chidiebere", "Okechukwu", "Somtochukwu", "Ekene",
            "Ikechukwu", "Chibuzor", "Chukwudi", "Nnaemeka"],
        female: ["Chiamaka", "Ngozi", "Adaeze", "Chinwe", "Ifeoma", "Chidinma",
            "Nkechi", "Amarachi", "Chizoba", "Uchenna", "Onyinye", "Ogechi",
            "Nneka", "Chinaza", "Adaobi", "Munachi"],
        middle: ["Chidera", "Tochukwu", "Ogochukwu", "Ebubechukwu", "Munachimso",
            "Kamsiyochukwu", "Nwakaego", "Chimdalu", "Obiageli", "Ikenna"],
        surnames: ["Okafor", "Nwachukwu", "Eze", "Okonkwo", "Chukwu", "Nwosu",
            "Onyeka", "Udechukwu", "Nnaji", "Ezeh", "Obi", "Anyanwu",
            "Ugochukwu", "Okoro", "Madu", "Iheanacho"],
        homes: [["Onitsha", "Anambra"], ["Awka", "Anambra"], ["Nnewi", "Anambra"],
            ["Owerri", "Imo"], ["Orlu", "Imo"], ["Umuahia", "Abia"], ["Aba", "Abia"],
            ["Enugu", "Enugu"], ["Nsukka", "Enugu"], ["Abakaliki", "Ebonyi"]],
    },
    {
        key: "South-South",
        weight: 15,
        male: ["Osaretin", "Efe", "Eseosa", "Oghenero", "Ovie", "Osasu", "Tejiri",
            "Uyi", "Oghenekaro", "Osazee"],
        female: ["Esosa", "Ivie", "Efemena", "Oghenetega", "Omonose", "Ejiro",
            "Itohan", "Oyiza", "Enaire", "Osarugue"],
        middle: ["Oghenekevwe", "Eseoghene", "Osaretin", "Ohiole", "Erhuvwu",
            "Omoyemi", "Iserhienrhien"],
        surnames: ["Idahosa", "Osagie", "Omoruyi", "Ogbeide", "Igbinedion", "Erhabor",
            "Akpobome", "Ovwigho", "Okpako", "Eweka"],
        homes: [["Benin City", "Edo"], ["Auchi", "Edo"], ["Ekpoma", "Edo"],
            ["Warri", "Delta"], ["Asaba", "Delta"], ["Ughelli", "Delta"],
            ["Sapele", "Delta"], ["Yenagoa", "Bayelsa"], ["Port Harcourt", "Rivers"],
            ["Uyo", "Akwa Ibom"], ["Calabar", "Cross River"]],
    },
    {
        key: "Middle Belt",
        weight: 10,
        male: ["Terhemen", "Aondoaseer", "Sesugh", "Iorwuese", "Gyang", "Davou",
            "Dachung", "Ochigbo", "Msughter", "Bem"],
        female: ["Doosuur", "Ngodoo", "Mngohol", "Nguher", "Rahila", "Ladi",
            "Kwaghdoo", "Mfe", "Talatu", "Hembadoon"],
        middle: ["Terkula", "Aondona", "Nguemo", "Dooshima", "Choji", "Pamdak",
            "Ojochenemi"],
        surnames: ["Tarkaa", "Iorliam", "Gyang", "Pam", "Dung", "Adakole",
            "Ochigbo", "Akaa", "Ityavkase", "Bitrus"],
        homes: [["Makurdi", "Benue"], ["Gboko", "Benue"], ["Otukpo", "Benue"],
            ["Jos", "Plateau"], ["Bukuru", "Plateau"], ["Lafia", "Nasarawa"],
            ["Lokoja", "Kogi"], ["Ilorin", "Kwara"]],
    },
];

const ORIGIN_TOTAL_WEIGHT = ORIGINS.reduce((sum, o) => sum + o.weight, 0);

/**
 * English Christian names, used as a FIRST name for some members and a middle name for
 * others — which is how most Nigerian Christian students are actually registered.
 */
const CHRISTIAN_MALE = ["Emmanuel", "Samuel", "Daniel", "David", "Joshua", "Israel",
    "Timothy", "Gideon", "Elijah", "Isaac", "Paul", "Stephen", "Caleb", "Nathaniel"];
const CHRISTIAN_FEMALE = ["Blessing", "Favour", "Precious", "Grace", "Mercy", "Peace",
    "Joy", "Deborah", "Esther", "Rachel", "Victoria", "Gloria", "Praise", "Testimony"];

/**
 * FUTA's programmes, each with its school and its LENGTH.
 *
 * The length is the part that matters. FUTA's engineering, environmental and
 * agricultural degrees run five years and the rest run four, so a member in 500 Level
 * reading Computer Science is not a stylistic wrinkle — it is a student in a year their
 * programme does not have. `programmeFor()` filters on it, which means the finalists
 * are drawn only from five-year programmes and every other level draws from everything.
 *
 * Codes are the matric-number prefix, so the matric number agrees with the department
 * instead of being an unrelated random string.
 */
const PROGRAMMES = [
    { school: "SOC", dept: "Computer Science", code: "CSC", years: 4 },
    { school: "SOC", dept: "Cyber Security", code: "CYS", years: 4 },
    { school: "SOC", dept: "Information Technology", code: "IFT", years: 4 },
    { school: "SOC", dept: "Software Engineering", code: "SEN", years: 4 },
    { school: "SEET", dept: "Civil Engineering", code: "CVE", years: 5 },
    { school: "SEET", dept: "Mechanical Engineering", code: "MEE", years: 5 },
    { school: "SEET", dept: "Electrical & Electronics Engineering", code: "EEE", years: 5 },
    { school: "SEET", dept: "Computer Engineering", code: "CPE", years: 5 },
    { school: "SEET", dept: "Metallurgical & Materials Engineering", code: "MME", years: 5 },
    { school: "SEET", dept: "Agricultural & Environmental Engineering", code: "AGE", years: 5 },
    { school: "SEET", dept: "Industrial & Production Engineering", code: "IPE", years: 5 },
    { school: "SOS", dept: "Biochemistry", code: "BCH", years: 4 },
    { school: "SOS", dept: "Microbiology", code: "MCB", years: 4 },
    { school: "SOS", dept: "Chemistry", code: "CHM", years: 4 },
    { school: "SOS", dept: "Physics Electronics", code: "PHY", years: 4 },
    { school: "SOS", dept: "Mathematics", code: "MTS", years: 4 },
    { school: "SOS", dept: "Statistics", code: "STA", years: 4 },
    { school: "SOS", dept: "Biology", code: "BIO", years: 4 },
    { school: "SET", dept: "Architecture", code: "ARC", years: 5 },
    { school: "SET", dept: "Building Technology", code: "BDG", years: 5 },
    { school: "SET", dept: "Quantity Surveying", code: "QSV", years: 5 },
    { school: "SET", dept: "Estate Management", code: "ESM", years: 5 },
    { school: "SET", dept: "Urban & Regional Planning", code: "URP", years: 5 },
    { school: "SET", dept: "Industrial Design", code: "IDD", years: 4 },
    { school: "SEMS", dept: "Applied Geology", code: "AGY", years: 4 },
    { school: "SEMS", dept: "Applied Geophysics", code: "AGP", years: 4 },
    { school: "SEMS", dept: "Marine Science & Technology", code: "MST", years: 4 },
    { school: "SEMS", dept: "Meteorology & Climate Science", code: "MET", years: 4 },
    { school: "SEMS", dept: "Remote Sensing & GIS", code: "RSG", years: 4 },
    { school: "SAAT", dept: "Crop Soil & Pest Management", code: "CSP", years: 5 },
    { school: "SAAT", dept: "Food Science & Technology", code: "FST", years: 5 },
    { school: "SAAT", dept: "Animal Production & Health", code: "APH", years: 5 },
    { school: "SAAT", dept: "Fisheries & Aquaculture", code: "FAT", years: 5 },
    { school: "SAAT", dept: "Forestry & Wood Technology", code: "FWT", years: 5 },
    { school: "SMAT", dept: "Project Management Technology", code: "PMT", years: 4 },
    { school: "SMAT", dept: "Transport Management Technology", code: "TMT", years: 4 },
    { school: "SMAT", dept: "Entrepreneurship Management Technology", code: "EMT", years: 4 },
];

/**
 * Where FUTA students actually live — the areas along the Akure–Ilara road that ring
 * the campus gates, not a random Nigerian street. A leader scanning the members list
 * should recognise every one of these.
 */
const SCHOOL_AREAS = [
    "South Gate", "North Gate", "West Gate", "Obakekere", "Apatapiti",
    "Aule Road", "Ijoka Road", "Shagari Village", "Oba-Ile", "Futa Road",
    "Ilara-Mokin Road", "Alagbaka Extension",
];

/**
 * Real Nigerian mobile prefixes. `080` plus eight random digits, which is what this
 * generated before, produces 0800 and 0804 numbers that no network has ever issued.
 */
const PHONE_PREFIXES = [
    "0803", "0806", "0703", "0706", "0813", "0816", "0810", "0814", "0903", "0906",
    "0805", "0807", "0811", "0815", "0705", "0905", "0915",
    "0802", "0808", "0812", "0701", "0708", "0902", "0901", "0904", "0907",
    "0809", "0817", "0818", "0908", "0909",
];

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

/** Uniform pick from a list. Length is read, never assumed. */
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/** An integer in [min, max]. */
const pickInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

/** Pick an origin by weight, so the mix looks like Akure rather than like a uniform draw. */
function pickOrigin(rng) {
    let roll = rng() * ORIGIN_TOTAL_WEIGHT;
    for (const origin of ORIGINS) {
        roll -= origin.weight;
        if (roll < 0) return origin;
    }
    return ORIGINS[0];
}

/**
 * A programme the member could actually be in at this standing.
 *
 * `standing` is 1 for 100 Level through 5 for 500 Level; null means the member has no
 * generation yet, so nothing is ruled out.
 */
function programmeFor(rng, standing) {
    const eligible = standing == null
        ? PROGRAMMES
        : PROGRAMMES.filter((p) => p.years >= standing);
    return pick(rng, eligible);
}

/** A Nigerian mobile number: a real prefix plus seven digits. */
function phoneNumber(rng) {
    return pick(rng, PHONE_PREFIXES) + String(pickInt(rng, 1000000, 9999999));
}

/**
 * A date of birth consistent with when they entered FUTA.
 *
 * Nigerian undergraduates start at 16-21, so the birth year is derived from the entry
 * year rather than drawn on its own -- otherwise the roster ends up with 100 Level
 * students born in 1994, which is the sort of detail that makes a demo fall apart the
 * moment somebody sorts by age.
 */
function dateOfBirth(rng, entryYear) {
    const base = entryYear ?? new Date().getFullYear();
    const year = base - pickInt(rng, 16, 21);
    const month = pickInt(rng, 1, 12);
    // 28 keeps every month valid without a calendar table.
    const day = pickInt(rng, 1, 28);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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
/**
 * The System Admin, who lives at this domain too and must survive a reset.
 *
 * `--reset` finds seeded members by their `@rcffuta.test` address, and
 * scripts/ict-coord.mjs seeds `oracle@rcffuta.test` -- the same domain, for the same
 * reason (RFC 2606, can never receive mail). So the reset used to delete the System
 * Admin along with the roster, which on a `pnpm db:reset-staging` run then handed
 * `ict-coord` to a random seeded finalist and left nobody able to sign in as an
 * administrator.
 */
const PRESERVED_EMAILS = ["oracle@rcffuta.test"];

async function resetSeed(db) {
    const { data: profiles, error } = await db
        .from("profiles")
        .select("id, email")
        .like("email", `%${TEST_DOMAIN}`);
    if (error) throw new Error(`Reset lookup failed: ${error.message}`);

    const ids = (profiles ?? [])
        .filter((p) => !PRESERVED_EMAILS.includes(String(p.email ?? "").toLowerCase()))
        .map((p) => p.id);
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
            : `write 110 fake members into ${c.bold(env.ref ?? env.file)}`;
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
    const usedEmails = new Set();
    const usedMatrics = new Set();
    const members = [];

    /**
     * One member, built from the inside out.
     *
     * Order matters here: origin decides the names and the home town, the programme
     * decides the department, school and matric prefix, and the entry year decides the
     * matric year and the date of birth. Nothing is rolled that something else has
     * already implied.
     *
     * @param classSetId  the generation, or null for a member not yet placed in one
     * @param entryYear   the generation's entry year, or null
     * @param standing    1..5 (100..500 Level), or null when unplaced
     * @param male        fixed by the caller so each generation comes out evenly split
     * @param withPhoto   whether this one carries an avatar
     */
    function makeMember({ classSetId, entryYear, standing, male, withPhoto }) {
        const origin = pickOrigin(rng);
        const christian = male ? CHRISTIAN_MALE : CHRISTIAN_FEMALE;
        const ethnic = male ? origin.male : origin.female;

        // About a third go by an English Christian first name with an ethnic middle
        // name, and the rest the other way round -- both are ordinary on a Nigerian
        // campus, and having only one shape is what would look generated.
        const englishFirst = rng() < 0.35;
        const first = englishFirst ? pick(rng, christian) : pick(rng, ethnic);
        const middle = englishFirst ? pick(rng, origin.middle) : pick(rng, christian);
        const last = pick(rng, origin.surnames);

        let email = `${slugifyName(first)}.${slugifyName(last)}${TEST_DOMAIN}`;
        let n = 2;
        while (usedEmails.has(email)) {
            email = `${slugifyName(first)}.${slugifyName(last)}${n++}${TEST_DOMAIN}`;
        }
        usedEmails.add(email);

        const programme = programmeFor(rng, standing);

        // FUTA matric numbers are <programme>/<entry year>/<serial>, so the prefix and
        // the year are both already decided; only the serial is free. Uniqueness is
        // enforced here rather than left to chance -- a duplicate matric number in a
        // members list is the kind of thing somebody eventually files a bug about.
        let matric = null;
        if (entryYear != null) {
            do {
                matric = `${programme.code}/${String(entryYear).slice(2)}/${pickInt(rng, 1000, 9999)}`;
            } while (usedMatrics.has(matric));
            usedMatrics.add(matric);
        }

        const [town, state] = pick(rng, origin.homes);

        // Next of kin is a parent: same surname, and a number that is not the member's.
        const kinIsMother = rng() < 0.55;
        const kinFirst = kinIsMother
            ? pick(rng, [...ORIGINS[0].female, ...origin.female])
            : pick(rng, [...ORIGINS[0].male, ...origin.male]);

        return {
            first_name: first,
            middle_name: middle,
            last_name: last,
            // Lowercase, because that is what profiles_gender_check accepts. This file
            // is .mjs and cannot import src/lib/gender.ts, which is the source of truth
            // for the spelling and for the parser every app write goes through -- if
            // the allowed values ever change, they change there and here.
            gender: male ? "male" : "female",
            dob: dateOfBirth(rng, entryYear),
            email,
            phone_number: phoneNumber(rng),
            department: programme.dept,
            faculty: programme.school,
            matric_number: matric,
            entry_year: entryYear,
            class_set_id: classSetId,
            school_address: `${pickInt(rng, 1, 48)}, ${pick(rng, SCHOOL_AREAS)}, Akure`,
            home_address: `${pickInt(rng, 1, 120)}, ${last} Close, ${town}, ${state} State`,
            next_of_kin_name: `${kinIsMother ? "Mrs." : "Mr."} ${kinFirst} ${last}`,
            next_of_kin_phone: phoneNumber(rng),
            parent_phone: phoneNumber(rng),
            avatar_url: withPhoto
                ? `https://randomuser.me/api/portraits/${male ? "men" : "women"}/${pickInt(rng, 1, 90)}.jpg`
                : null,
        };
    }

    /**
     * Exactly ten brothers and ten sisters per generation.
     *
     * A coin flip per member averages out to even and is almost never even in practice
     * -- one generation lands 14/6 and the gender split on the level screen reads as a
     * real imbalance that somebody then tries to explain. Fixing the counts and
     * shuffling the order removes the question.
     */
    function genderSlots(size) {
        const slots = Array.from({ length: size }, (_, i) => i < size / 2);
        for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        return slots;
    }

    const PER_GENERATION = 20;
    const UNPLACED = 10;
    // A quarter carry a photo; the rest exercise the initials fallback, which is the
    // state most real members are in.
    const PHOTO_SHARE = 0.25;

    for (const g of generations) {
        const slots = genderSlots(PER_GENERATION);
        const standing = parseInt(g.level, 10) / 100;
        for (let i = 0; i < PER_GENERATION; i++) {
            members.push(makeMember({
                classSetId: classSetIds[g.level],
                entryYear: g.entryYear,
                standing,
                male: slots[i],
                withPhoto: i < PER_GENERATION * PHOTO_SHARE,
            }));
        }
    }

    // Members with NO generation — the register/update path, where somebody exists on
    // the roster but has not been placed in a class set yet. They still have a matric
    // number in real life, so entry year is left null but everything else is filled.
    const unplacedSlots = genderSlots(UNPLACED);
    for (let i = 0; i < UNPLACED; i++) {
        members.push(makeMember({
            classSetId: null,
            entryYear: null,
            standing: null,
            male: unplacedSlots[i],
            withPhoto: i < UNPLACED * PHOTO_SHARE,
        }));
    }

    // --dry-run stops here, before anything is written. Reviewing a sample of the
    // roster is how you catch an incoherent member -- a finalist in a four-year
    // programme, a matric year that disagrees with the generation -- while it is still
    // cheap to fix, rather than after 110 rows are in a database.
    if (hasFlag("dry-run")) {
        section("Dry run — nothing will be written");
        info(`${members.length} members generated.`);
        blank();
        const byGeneration = [...generations, { level: "(unplaced)", entryYear: null }].map((g) => {
            const rows = members.filter((m) => m.entry_year === g.entryYear);
            return {
                level: g.level,
                total: String(rows.length),
                brothers: String(rows.filter((m) => m.gender === "male").length),
                sisters: String(rows.filter((m) => m.gender === "female").length),
                photos: String(rows.filter((m) => m.avatar_url).length),
            };
        });
        table(byGeneration, [
            { key: "level", label: "GENERATION" }, { key: "total", label: "TOTAL" },
            { key: "brothers", label: "BROTHERS" }, { key: "sisters", label: "SISTERS" },
            { key: "photos", label: "PHOTOS" },
        ]);
        blank();
        const emails = new Set(members.map((m) => m.email));
        const matrics = members.map((m) => m.matric_number).filter(Boolean);
        info(c.grey(`Unique emails: ${emails.size}/${members.length}  ·  `
            + `unique matric numbers: ${new Set(matrics).size}/${matrics.length}`));
        blank();
        table(
            members.filter((_, i) => i % 13 === 0).map((m) => ({
                name: `${m.first_name} ${m.last_name}`,
                g: m.gender[0],
                matric: m.matric_number ?? c.grey("—"),
                dept: m.department.length > 22 ? `${m.department.slice(0, 21)}…` : m.department,
                school: m.faculty,
                dob: m.dob,
                home: m.home_address.split(", ").slice(-2).join(", "),
            })),
            [
                { key: "name", label: "NAME" }, { key: "g", label: "S" },
                { key: "matric", label: "MATRIC" }, { key: "dept", label: "DEPARTMENT" },
                { key: "school", label: "SCHOOL" }, { key: "dob", label: "BORN" },
                { key: "home", label: "HOME" },
            ],
        );
        blank();
        ok("Nothing was written.");
        blank();
        return;
    }

    const { data: inserted, error: memberErr } = await db
        .from("profiles")
        .insert(members)
        .select("id, email, gender, class_set_id");
    if (memberErr) throw new Error(`Could not insert members: ${memberErr.message}`);

    section("Members");
    kv([
        ["Created", String(inserted.length)],
        ["Placed in a generation", `${generations.length} x ${PER_GENERATION}  (10 brothers, 10 sisters each)`],
        ["No generation yet", `${UNPLACED}  (for testing register / update)`],
        ["With a photo", String(members.filter((m) => m.avatar_url).length)],
        ["Email domain", c.grey("@rcffuta.test  (RFC 2606 reserved - can never receive mail)")],
    ]);
    blank();
    info(c.grey("Each member is built from one origin, so names, home state, department,"));
    info(c.grey("school, matric number and date of birth all agree with each other."));

    // NO APPOINTMENTS ARE SEEDED, DELIBERATELY.
    //
    // This script used to fill a cabinet -- ten offices handed to ten seeded finalists --
    // so the handover wizard's access-revocation step had names to show. That was a
    // convenience bought at the price of a lie: an appointment is a DECISION somebody
    // made, and a roster full of invented officers makes the cabinet screen unreadable
    // as a record of who actually leads the fellowship. Worse, it collided with the
    // System Admin seeded a step earlier and took the whole run down with it.
    //
    // Offices are filled by hand, through the portal, which is also the only way to
    // exercise the appointment flow as a leader really meets it.
    info(c.grey("No offices were filled -- appointments are made by hand, in the portal."));

    section("Done");
    ok(`Seeded ${c.bold(env.file)} ${c.grey(`(${env.ref})`)}`);
    info(c.grey("Remove it all again with:"));
    info(`  ${c.cyan(`node scripts/seed-test.mjs --env ${env.file.replace(".env.", "")} --reset-only`)}`);
    blank();
}

main().catch(die);
