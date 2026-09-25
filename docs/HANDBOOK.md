# RCF FUTA ICT Portal — Successor's Handbook

Everything you need to run this portal from your first day to the day you hand it on.
It is written for two readers at once: **the leaders who use it** (sections 1–6 and 9)
and **the technical person who looks after it** (sections 7–10). If you are the ICT Coordinator, you
are both — read all of it once.

When this handbook and the code disagree, the code wins. Fix the handbook in the same
change. (The repo has older notes — `AUTHENTICATION.md`, `AUTH_MANUAL.md`,
`SIDEBAR_*.md`, `QA-FEATURE.md`, per-folder READMEs — that describe earlier versions.
Treat them as history.)

---

## Contents

1. [What the portal is](#1-what-the-portal-is)
2. [The ideas everything is built on](#2-the-ideas-everything-is-built-on)
3. [Who can do what](#3-who-can-do-what)
4. [The year, step by step](#4-the-year-step-by-step)
5. [Every screen, explained](#5-every-screen-explained)
6. [Backups and recovery](#6-backups-and-recovery)
7. [Running it: the technical side](#7-running-it-the-technical-side)
8. [Security rules that must not be broken](#8-security-rules-that-must-not-be-broken)
9. [Troubleshooting](#9-troubleshooting)
10. [Known gaps and loose ends](#10-known-gaps-and-loose-ends)
11. [Where to read more](#11-where-to-read-more)

---

## 1. What the portal is

A web app for the fellowship with four jobs:

- **The members' record.** Everyone in the fellowship has a profile: bio-data,
  academics, where they live, which generation they belong to, which unit they serve in,
  and every office they have held.
- **The leadership's tools.** The cabinet, units and teams, generations (levels), and
  the yearly handover from one tenure to the next.
- **Events.** Public event pages, registration with a QR ticket, and door check-in.
- **Lo!** An open Q&A and testimonies app that needs no login.

Most people who use it are students on mid-range Android phones with limited data. That
is why pages are light, lists are paged, and images are sized for phones. Keep it that way.

**Only leaders sign in.** Ordinary members never get a password. They are added to the
record through their level coordinator's registration link (see §4.4).

---

## 2. The ideas everything is built on

Learn these six ideas and the rest of the portal will make sense.

### 2.1 Tenure (the session)

A **tenure** is one leadership year, named by its **session**, e.g. `2026/2027`. Exactly
one tenure is *active* at a time, and almost everything (who holds which office, who is in
which unit) belongs to one tenure.

A tenure has **no name**. Its identity is its session plus, after the coronation retreat,
its **theme**, a **theme text** (one or more Bible references, e.g.
`Isaiah 60:1-3, Romans 8:19`), a banner, an icon and optionally a colour palette. Before
the retreat a tenure is *awaiting coronation*. That is normal, not an error.

When a palette is recorded, the whole members' dashboard repaints in the session's
colours. Public pages keep the fellowship's own brand colours.

### 2.2 Generation (class set) and level

Every member belongs to a **generation**: the set of people who entered in a given year
(`2024 Set`). Generations can be given a family name.

A member's **level** (100–500, PDS/UABS, Alumni) is **never stored**. It is computed
from the generation's entry year against the *active session*. So when a new session
opens at handover, everyone moves up a level automatically and the finalists become
Alumni. Nothing is rewritten. A generation can be given a manual **level override** when
reality differs (e.g. a set that repeated a year).

### 2.3 Units and teams

- A **unit** is where a member serves. **One unit per member per tenure**, enforced by
  the database. Being in a unit is what makes someone a **worker**.
- A **team** is open: anyone can be on any number of teams, and being on a team does not
  make you a worker.
- **Brothers' Unit** and **Sisters' Unit** are special. Membership is *by gender*, not by
  induction, so there is no roster to edit. To fix someone's membership there, fix their
  gender on their profile.
- Each unit and team has a permanent **slug** (e.g. `choir`, `ict`). The slug is what
  permissions attach to, so it never changes, even if the unit is renamed.

### 2.4 Offices (positions) and privilege tags

The fellowship's full list of offices lives in the code
(`src/config/leadership-positions.ts`). It is the same every year; only the *people*
change. Offices sit in four tiers: **President → Vice Presidents → Executives → Level
Coordinators**.

What an office may *do* is decided by its **privilege tags**, never by its title:

| Tag | Meaning |
|---|---|
| `PRESIDENT` | The President. Sees everything, **changes nothing**. |
| `SYSADMIN` | The System Admin: the **ICT Coordinator**. |
| `CENTRAL` | Church-wide read access. Held by both Vice Presidents. |
| `EXCO:<unit>` | Leads that one unit or team, e.g. `EXCO:choir`. |
| `LEVEL:<level>` | Coordinates that level's generation, e.g. `LEVEL:100`. The **500 Level Coordinator holds `LEVEL:all`**: authority over every level. |
| `ZONE` | Residential zones (module not live yet). |

Rules that trip people up:

- **One lead per office per tenure.** The database refuses a second lead. Assistants are
  unlimited, and an assistant carries the same tags as the lead, except **CENTRAL**:
  church-wide access is the lead's alone, so an assistant to a central office is not
  central.
- **Holding an office is not the same as having a login.** Each office has a
  *grants login* switch. Most honorary offices (General Secretary, Financial Secretary,
  Secretariat Keeper) have no tags and no login. The VP Admin controls the switch per
  office. The VP Admin and ICT Coordinator logins can never be switched off.
- **Ending an appointment keeps it as history.** It stops granting anything immediately,
  but it stays on the member's service record.

### 2.5 Sessions and logins

- A leader signs in with **email + password**. Their **first** sign-in asks them to choose
  the password. There is no default password and nobody ever sends one.
- A sign-in lasts **7 days**. **5 wrong passwords lock the account for 15 minutes.**
- There is no self-service "forgot password" (and no page for it). The **VP Admin or System Admin presses
  "Reset login"** on the cabinet roster (§5.3). That clears the password and ends the
  person's open sessions, and they choose a new password at their next sign-in.

### 2.6 The President is read-only, everywhere

The President can open every module and see everything, and can change **nothing**. The
server enforces this in every write action, not only by hiding buttons.

---

## 3. Who can do what

### 3.1 By office

| | President | VP Admin | VP Church Growth | System Admin (ICT Coord) | Unit Exco (lead/asst.) | Level Coordinator | Everyone else |
|---|---|---|---|---|---|---|---|
| Sign in | ✔ | ✔ | ✔ | ✔ | ✔¹ | ✔¹ | ✘ |
| **Tenure** module | view | **full** | view | **full** | ✘ | ✘ | ✘ |
| Handover | ✘ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ |
| Appoint / revoke / reset logins | ✘ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ |
| **Workforce**: every unit | view | edit | view | edit | — | — | — |
| **Workforce**: own unit | — | — | — | — | edit | — | — |
| Workforce exports (members, birthdays) | ✔ | ✔ | ✔ | ✔ | own unit | — | — |
| **Academics** module (results, rounds, departments) | view | edit | ✘ | edit | Academic Coord: edit³ | ✘ | ✘ |
| Workforce → Academics: members' results + full-record export | ✔ | ✔ | totals | ✔ | own unit⁴ | — | — |
| Submit own results (round link) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **Levels**: every generation | view | edit | view | edit | — | 500 Level only² | — |
| **Levels**: own generation + tokens | — | — | — | — | — | edit | — |
| **Oracle** (search + correct any record) | view | ✘ | ✘ | **edit** | ✘ | ✘ | ✘ |
| **Settings** (module access, full backup) | view | ✘ | ✘ | **edit** | ✘ | ✘ | ✘ |
| Create / edit events | ✘ | ✘ | ✘ | ✔ | ✘ | ✘ | ✘ |
| An event's admin console | view | ✔ | ✔ | ✔ | if their unit runs it | ✘ | ✘ |
| Moderate Lo! (answer, hide, testimonies) | ✘ | ✔ | ✘ | ✔ | ✘ | ✘ | ✘ |
| Ask on Lo!, register for events | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

¹ Only if their office's *grants login* switch is on (on by default for offices with tags).
² A Level Coordinator sees and edits only their own generation — except the 500 Level
Coordinator (`LEVEL:all`), who can edit every generation.
³ The default, `EXCO:academic`; Settings can give it to more offices.
⁴ Names and grades while the Academic Unit's "unit heads see their members' results"
switch is on (it is by default); totals only when it's off.

### 3.2 What's fixed and what's configurable

- **Tenure** access is **fixed by fellowship policy in code**
  (`POLICY_FIXED_MODULES` in `src/lib/modules.ts`): President, VPs and System Admin read;
  only the System Admin and VP Admin write. Settings shows it as locked.
- **Workforce, Levels and Zones** access is configured by the System Admin in
  **Settings → Module access**, by tag (`EXCO`), scoped tag (`EXCO:choir`) or office slug.
  The defaults: Workforce = `CENTRAL`, `EXCO` read and `EXCO` write (own unit only);
  Levels = `CENTRAL`, `LEVEL` read and `LEVEL` write (own level only);
  Academics = `EXCO:academic` read and write (the Academic Coord).
- **Who sees individual results outside Academics** (unit heads, level coordinators,
  members themselves) is **not** in Settings: the Academic Unit decides it in
  **Academics → Visibility** (§5.10).
- **Event** access is per event: the unit it is assigned to (§5.7).

---

## 4. The year, step by step

### 4.1 Before the year: the handover (VP Admin or System Admin)

**Tenure → Tenure Profile → Handing Over.** It is a six-step wizard. You can stop and
come back: an unfinished handover stays open and is resumed from the same place.

1. **Back up.** The wizard will not continue without a backup taken *during the tenure
   being closed*. It is the only undo there is.
2. **Incoming tenure.** Type the new session (e.g. `2027/2028`) and its start date.
3. **Progression.** A preview of every generation's new level. It is exact: level is
   computed, so what you see is what will happen. Here you also tick any **400 Level
   finalists** (four-year courses). Instead of moving up to 500 Level, they join the
   500 Level generation that is becoming alumni, and graduate with it.
4. **Offices.** Choose the incoming **VP Admin** and **ICT Coordinator**, so the new
   tenure is never left with nobody able to run it.
5. **Everyone else.** Two opt-out choices:
   - *Carry unit membership forward* (everyone except graduates).
   - *Revoke outgoing leaders' logins* (anyone not re-appointed in step 4).
6. **Commit.** A summary, then type the session to confirm.

**It takes effect one hour later.** Confirming only schedules the switch. For that hour
nothing changes: the current tenure stays active and the outgoing cabinet keeps its
access, so they can wrap up. The handover page shows a countdown and a **Cancel
handover** button; a cancelled handover is kept in the history, and you can start a new
one. When the hour is up the switch happens the next time anyone uses the portal
(usually within a minute), and everything is checked again first. If the active tenure
changed during the hour, or an appointee no longer exists, the handover is marked
**Did not take effect** and nothing is changed.

When it takes effect it also:

- **Empties PDS/UABS.** Last session's PDS/UABS members are unlinked from their
  generation (they are neither PDS/UABS nor 100 Level any more) and are not carried into
  units. They re-join through a level link once admitted.
- **Opens an empty 100 Level**, a generation for the new session's entry year, created
  if it doesn't exist and named after that year (`2028 Set`). Every other level fills
  itself, since everyone moves up one.
- **Renames PDS/UABS to the new session** (`2028/2029`). PDS/UABS members are aspirants,
  not yet students, so PDS/UABS always ranks below 100 Level and is listed first.
- **Closes any open Academics results round**, since a round belongs to its session.

The new tenure opens **awaiting coronation**. Every handover, finished or abandoned, is
kept in the handover history for successors to read.

### 4.2 Early in the year

1. **Appoint the cabinet.** **Tenure → Cabinet → Appoint.** Three steps: office →
   generation → member. Offices already filled are not offered. To change who holds one,
   use **Replace** on the Roster. Appointing to an office that grants a login gives the
   person access immediately; tell them to sign in with their email and choose a password.
2. **Name the generations.** **Tenure → Generations.** New sets arrive as `2026 Set`.
   Rename them with **Edit** (200 Level and above). Add a generation with
   **Add Generation**.
3. **Level coordinators issue their registration link** (§4.4) so members can register
   and update their details.
4. **Unit Excos build their rosters** in **Workforce** (§5.4).

### 4.3 The coronation retreat

After the retreat, **Tenure → Tenure Profile → Record coronation**:

- **Theme** (required).
- **Theme text.** One or more Bible references, separated by commas:
  `Isaiah 60:1-3, Romans 8:19`. Each must be a full reference (book chapter:verse);
  `John 1:1, 14` is refused rather than guessed.
- **Coronation date.** The day of the retreat, which is not the session's start date.
- **Banner** (2400×800, 3:1) and **icon** (square, 512×512). **Upload** a file or
  **Paste link**. A pasted link is *imported*: Cloudinary keeps its own copy, so the
  banner survives the original being deleted. The banner is always shown whole, so
  lettering can run edge to edge.
- **Colours** (optional). A primary and an accent colour. Each pair is checked for
  readable contrast (WCAG AA), and a failing pair is refused with the measured ratio.

**Remove coronation** clears all of it. Use it only for a coronation recorded by mistake.

### 4.4 Getting members into the record (level coordinators)

- **Levels → your generation → Tokens → Generate token.** A generation has **one** active
  token (like `RCF-7KX2P`), and it covers both new registrations and updates. Share the
  link it gives you, or just the token: members can go to **`/profile`**, type it in (capitals
  or not) and choose *I'm new* or *I'm registered*. Old `/register` links still work.
- **Generating again replaces the old token.** Every link built from the old one dies at
  once. That is how you recover from a leaked link. **Revoke** turns it off without a
  replacement.
- New members open the link, fill in three steps (Bio data, Academics, Location) and
  land in *your* generation.
- Existing members use the *update* link: they confirm themselves by the email already on
  record, then edit.
- **Activity** shows every generate, revoke and use of your tokens.

### 4.5 During the year

- **Transfers.** A member can only be in one unit. When a second Exco adds someone who is
  already placed, nothing moves: a transfer request goes to **Tenure → Transfers**, and
  the VP Admin approves or declines it.
- **Events** (§5.7): the System Admin creates them; the assigned unit runs the console.
- **Birthdays.** Each unit's **Birthdays** tab lists the month's celebrants with a
  tap-to-call number, and exports.
- **Records.** Members fix their own details through their level's update link. The
  System Admin can correct anything in the **Oracle**.
- **Results, every semester (Academic Coord).** After each semester's results are out,
  open a round in **Academics → Rounds** and share it. Every 100–500 Level member submits
  their GPA and CGPA at `/academics` with the round token. Chase the **Not submitted** list
  on the Overview, then close the round (§5.10).

### 4.6 End of the year

Back to 4.1. Take the backup first.

---

## 5. Every screen, explained

### 5.1 Overview and My Identity

- **Overview**: your dashboard: modules you can open, upcoming events.
- **My Identity**: your own profile and ID card. Edit your bio-data, academics, location
  and photo (optional; uploads go to Cloudinary). A **My results** card lists your
  semester results, if the Academic Unit has switched it on.

### 5.2 Tenure → Tenure Profile

The session hero (banner, theme, references, days running, coronation date), then the
session's figures:

- **Workforce coverage.** How many members are workers.
- **Units at a glance.** Every unit as a tile, with warnings for units that have no
  members or no Executive.
- **Cabinet.** Which offices are still vacant, tier by tier.
- **Generations.** Workers and non-workers per generation.
- **Access.** Who can sign in and who has never set a password.

Buttons (System Admin and VP Admin only): **Session** (edit dates), **Record/Edit
coronation**, **Handing Over**.

### 5.3 Tenure → Cabinet

- **Roster.** Everyone holding an office this tenure. Per row:
  - **Reset login** (offices with a login). Clears the password, unlocks the account,
    ends open sessions.
  - **Replace** (leads). Ends the appointment and opens Appoint on the same office.
  - **Revoke.** Ends the appointment. By default it stays on their service record;
    untick that only for an appointment that should never have existed.
- **Appoint.** Office → generation → member. Only vacant offices appear.
- **Roles.** Every office with its privilege tags. The VP Admin can edit tags, switch an
  office on or off, and **Create an Executive office** for a unit that has none.

Other Tenure tabs:

- **Workforce.** The units, with gender breakdowns.
- **Generations.** Add, rename (200L+), level override.
- **Transfers.** The transfer queue.
- **Hierarchy.** The office catalogue, with the per-office *grants login* switch
  (VP Admin).

### 5.4 Workforce

A grid of units (or, for an Exco, just theirs). Open one for its page:

- **Members.**
  - **Figures:** Total, Male, Female, **Executives** (members holding any Exco office this
    tenure).
  - **Finding people:** search by name and filter by level.
  - **Export CSV** downloads exactly what's shown (filtered, if a filter is on).
  - **Changing the roster:** Excos (and the VP Admin and System Admin) **add workers by
    email** (one, or paste a whole list: a spreadsheet column, a WhatsApp message or
    `Name <email>` lines all work; case doesn't matter), or remove one. Each address gets
    its own result: added, sent for transfer, already there, or no member found (those
    stay in the box to fix and resend). Adding someone already in another unit queues a
    transfer instead. At most 200 per add.
- **Leadership.** The unit's members who hold an Exco office this tenure (whichever unit
  the office belongs to), leads first. A unit's offices are managed from **Tenure**, not
  here.
- **Birthdays.** One month at a time, with today's celebrants first. **Export** the month.
- **Academics.** The unit's results for a semester (pick one): how many owe and have
  submitted, mean CGPA, class of degree, breakdowns by level, department, school and
  gender, and the trend. If the Academic Unit allows it (on by default), the unit's
  heads also see each member's GPA and CGPA, who is at risk and who hasn't submitted,
  with CSV exports, and a **Full academic record** download: every member, every
  semester, with matric number and department, for reports to the authorities.
  Otherwise, totals only.

Every add and remove is still recorded (the membership log); it just isn't a tab.

Tapping a member opens their full record. From there an Exco can copy the member's
**update link**, which belongs to the level coordinator; the Exco can share it but never
create one.

### 5.5 Levels

The generations as cards. Open one to see its members (search, stats, **Export CSV**
with a choice of columns), **Tokens** and **Activity** (coordinators only). Members
open to the full record. **Academics** shows the generation's results the same way as
Workforce → Academics; the coordinator sees names only if the Academic Unit allows it
(off by default).

### 5.6 Oracle (System Admin; President can view)

Search every member by any field (name, matric, unit, team, office, level…), choose
columns, export, and open a record to **correct it**. Every correction is written to the
audit log with who, what, old and new value.

### 5.7 Events

- **Create or edit** (System Admin, from **Events**):
  - title, link slug, date and time (always Lagos time), description, venue, and the
    **Run by** unit;
  - *active* (listed), *exclusive* (members only, sign-in required);
  - registration on/off, which fields to collect, and who may register (guests, alumni,
    students).
- **Run by.** The assigned unit's Executive and assistants get the event's console,
  alongside the System Admin and the VPs. The President can view it.
- **Registration.** Visitors register at `/events/<slug>/register` and get a **QR ticket**
  on the confirmation screen. Tell them to screenshot it.
- **Admin console** (`/events/<slug>/admin`):
  - *Overview*: registered, members, guests, checked in, levels.
  - *Attendees*: filter, then **Export CSV**.
  - *Check-in*: **Start camera** and scan tickets. A ticket works once, and only for its
    own event. No ticket? Find the person by name, phone or email and press **Check in**.
  - *Questions* from Lo! for this event.

### 5.8 Lo!

Open to everyone, with no login.

- **Q&A.** Visitors ask questions per event, and others ★ the ones they want answered.
  The VP Admin and System Admin answer, hide or group them.
- **Testimonies.** Only members may post. A visitor proves they are a member with their
  matric number (or email) plus their surname; the portal remembers that on the device.
  This is *recognition*, not a login. It unlocks testimonies and "Amen", nothing else.
  Posts wait for moderation by the VP Admin or System Admin.

### 5.9 Settings (System Admin; President can view)

- **Module access.** Who can read and write Workforce, Levels and Zones (Tenure is fixed
  by policy).
- **Insurance.** The **full system backup** (§6).

### 5.10 Academics (Academic Coord by default)

Members' semester results, collected in **rounds**. FUTA grades on a 5-point scale.
Each member reports their **GPA** (that semester) and **CGPA** (their running
standing). The class bands: First 4.50–5.00, Second Upper 3.50–4.49, Second Lower
2.40–3.49, Third 1.50–2.39, Pass 1.00–1.49, Probation below 1.00 (`src/lib/academics.ts`).
Each academic session has a **first** and a **second** semester.

- **Overview.** One semester for the whole fellowship: figures, class of degree,
  breakdowns, trend. Below that, **Submitted**, **At risk** (CGPA under 2.40, or GPA down
  0.50 or more on their last semester) and **Not submitted**, filterable by level and
  unit, each with a CSV export.
- **Rounds.** Open one per semester (with an optional due date). It gets a token like
  `ACD-7KX2P`. **Share** sends a ready-made message with the link
  (`/academics?round=ACD-7KX2P`). Only one round is open at a time. Close it when you're
  done; reopen it if needed.
- **Records.** Every member who owes results or has any, with their latest CGPA. Open
  one to see their history and add, correct or delete a semester (recorded as the
  Academic Unit's entry, and audited). Export the latest per member, or every semester.
- **Departments.** FUTA's schools and departments, as every form offers them. Figures
  first (schools, departments, members linked, members not linked, retired). The list
  opens as the schools, collapsed, each with its department and member counts. Search,
  or pick a school or a member filter ("has members", "no members yet"), and it turns
  into one sorted list of just the matches. Sort by name, code or member count, and
  switch between active, retired and all. Add, rename, change a code (members' records
  follow), or **retire** one (never delete: records point at it). Schools are renamed
  from inside their group. **Not matched** lists departments that were typed in by hand
  and match nothing. Each comes with a suggested match where there is a likely one (a
  leading code like "CSC", or shared words). Nothing is linked until you press Link.
- **Visibility.** Who else sees individual results: unit heads (on by default), level
  coordinators (off), members themselves (off). Only those who can edit Academics can
  change it. Totals are always shown.

**The submission page (`/academics`, public).** A member opens the link (or types the
token), confirms who they are with **email, surname and matric number** (the matric is
checked only when one is on file), then enters the semester's GPA and CGPA. Earlier
semesters since they joined can be filled in too (optional). Only 100–500 Level members
submit. Things that are deliberate:
- The page never shows grades already on record, only "submitted". Knowing someone's
  details is enough to reach it, so it must not reveal anything.
- A submitted earlier semester is locked. The round's own semester can be resubmitted,
  which replaces it. Mistakes beyond that are corrected in **Records**.
- Failed identity checks are logged and rate-limited (8 per 15 minutes per device).

---

## 6. Backups and recovery

The database is on Supabase's **free plan: no automatic backups and no point-in-time
recovery.** Your own backups are the only safety net.

| Backup | Who | Where | What |
|---|---|---|---|
| **Tenure backup** | VP Admin, System Admin | Handover wizard, step 1 | One tenure. Encrypted by default; the default passphrase is that tenure's **President's name**. Required before a handover. |
| **Full system insurance** | System Admin | Settings → Insurance | Every tenure, all history. Always encrypted. Take it before any database change. |
| **CLI backup** | whoever holds `.env.local`, signing in as a System Admin | `pnpm backup` (`-- --encrypt` for a `.rcfvault`) | Written to `.backups/` (git-ignored). |

**Restoring** (technical): `node scripts/restore-backup.mjs <file>` does a dry run;
`--commit` applies it; `--password "..."` unlocks a `.rcfvault`. Rows are upserted in a
safe order and a half-finished restore can simply be re-run.

Deliberately **not** in any backup: password hashes (restored leaders set a new password
at first sign-in), sessions (everyone signs in again), and registration token values
(generate new ones).

A plain backup contains every member's phone number and address. **Never share an
unencrypted file.**

---

## 7. Running it: the technical side

### 7.1 Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 (configured in
`src/app/globals.css`; there is **no** `tailwind.config`), Zustand, react-hook-form + zod,
Supabase (Postgres) through a single service-role client, Cloudinary for images. Package
manager: **pnpm only**.

`AGENTS.md` is the canonical engineering spec: conventions, folder layout, rules. Read it.

### 7.2 Local setup

```bash
pnpm install
cp .env.example .env.local     # fill it in; every variable is explained in the file
pnpm dev                       # http://localhost:3000
```

Environment variables (see `.env.example`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (secret)
- `SESSION_SECRET` (the password pepper; **must be the same everywhere a database is
  shared**, or every password stops working)
- `PRODUCTION_SUPABASE_URL` (so the scripts, and the app, can recognise production)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

`NEXT_PUBLIC_` values are fixed at build time: restart `pnpm dev`, or redeploy, after
changing them.

**Test emails outside production.** Anywhere that is not production (staging, previews,
`pnpm dev` against a dev database), registering, updating a record through a level
link, and signing up for an event only accept `@rcffuta.test` addresses. `.test` can
never receive mail, so no real member's address ends up in a test database. Production
is a Vercel production deployment **or** any run whose database is
`PRODUCTION_SUPABASE_URL`; either one lifts the rule (`src/lib/env.ts`).

**Cloudinary** (images): create an **unsigned** upload preset. The preset is public, so
restrict it: an asset folder, formats `jpg,png,webp` (no SVG), incoming transformation
`c_limit,w_2400,h_2400`. Images are served straight from Cloudinary at the size each
screen needs.

### 7.3 Environments and deployment

| Branch | What happens |
|---|---|
| `dev`, `dev/**` | CI only (lint, build, migration replay). Deploys nothing. |
| `stage` | Applies new migrations to **staging**. |
| `main` | Applies new migrations to **production**, after a required reviewer approves. |

The app itself deploys through **Vercel's** Git integration. Vercel needs the same
environment variables, set per environment.

### 7.4 The database

- Schema lives in `supabase/migrations/` and is applied **by CI**, never by hand. Create
  a migration only with `supabase migration new <name>`; a hand-named file is silently
  skipped.
- **Two seeds:**
  - **Structure** (`db/seed/default.sql`, generated by `pnpm db:gen-seed` from
    `src/config/*.ts`): units, offices, privileges, module access. Safe in production,
    re-runnable.
  - **Data** (`pnpm db:seed-staging`): a tenure, generations and a System Admin.
    **Staging only.**
- `pnpm db:reset-staging` wipes a staging or dev project back to a known state: data,
  a System Admin and 110 fake members. It never offers production, and makes you type
  the project ref.
- The staging System Admin is **Melchizedek Oracle** `<oracle@rcffuta.test>`, created
  with **no password**. Sign in with that address and choose one. **Do it immediately**
  on a deployed staging site: until you do, the first person to try that public address
  sets it.
- `pnpm db:ict-coord` is a read-only check that a working System Admin exists. It's safe
  on production.
- `pnpm db:status` checks the schema against the migration ledger; `pnpm db:inventory`
  gives row counts.
- The production database is **shared** with other apps (ReadWrite `rw_*`, Final Year
  Brethren `fyb_*`, e-library `elib_*`, games). Never touch their tables.
- **Departments** are data, not structure: `faculties` and `departments` were seeded
  once by the `academics_module` migration and are maintained from Academics. A staging
  reset keeps them. `profiles.department` (text, the course code) and
  `profiles.department_id` are kept in step by the trigger `rcf_sync_profile_department`,
  whichever app writes, so other apps reading the text keep working.

Full runbooks: `docs/DATABASE-CICD.md` (CI, migrations, staging resets) and
`docs/FRESH-START.md` (rebuilding from an empty Supabase account and a backup).

### 7.5 Changing the fellowship's structure

- **A new unit or team:** add it to `src/config/fellowship-units.ts`, run
  `pnpm db:gen-seed`, commit both. Its Executive office is created with it. (A unit made
  some other way gets its office from **Cabinet → Roles → Create an Executive office**.)
- **An office's tags:** VP Admin, in **Cabinet → Roles**. Structural changes to the fixed
  offices go in `src/config/leadership-positions.ts`.
- **Never change a slug.** Permissions are attached to it.

### 7.6 Checks before any change is done

```bash
pnpm lint     # new code must be clean; the repo still carries old lint debt
pnpm build    # the real correctness check for routes, server actions and auth
```

There is no automated test suite yet.

### 7.7 Tracing what happened: the audit trail (System Admin)

`pnpm audit:log` shows every trail the system keeps in one timeline, in Lagos time:
admin actions, sign-ins and failed sign-ins, sessions, appointments made and ended,
unit membership changes, transfers, level links, handover proceedings, results
submitted and corrected, rounds, identity checks on public pages, event registrations
and new profiles. You sign in with your portal email and password, and only the System
Admin gets in. Your viewing is itself recorded (`audit.cli`).

```bash
pnpm audit:log                                  # the last 24 hours
pnpm audit:log -- --since 7d --summary          # a week: counts, busiest people, failures
pnpm audit:log -- --subject "ada" --since 30d   # everything done TO one member
pnpm audit:log -- --actor "ada"                 # everything done BY one person
pnpm audit:log -- --source login --action fail  # failed sign-ins only
pnpm audit:log -- --follow                      # watch live, like tail -f
pnpm audit:log -- --csv trail.csv               # export (holds personal data)
pnpm audit:log -- --help                        # every source
```

To trace something: start broad with `--summary` over the right window, then narrow with
`--subject` or `--actor`. Many failed sign-ins for one email means someone is guessing a
password; many from one IP means someone is probing.

---

## 8. Security rules that must not be broken

1. **`src/lib/db.ts` is the service-role client and bypasses all database security.**
   Server-only. Never import it into a client component, and never return its results
   unfiltered to the browser.
2. **Every server action is a public endpoint.** Anything exported from a
   `'use server'` file can be called by anyone with any arguments. Check the session
   *inside* every action, and never trust an identity (id, email) sent by the caller.
3. **Authorise from privilege tags and slugs, never from titles.** Titles are editable.
   Use the context flags (`isSysAdmin`, `isVpAdmin`, `isPresident`) and the helpers in
   `src/lib/access-control.ts`, `src/lib/module-access.ts` and `src/lib/event-access.ts`.
4. **Writes go through the write gates** (`requireModuleWrite`, `requireAdminWrite`,
   `requireContextWrite`, `requireVpAdmin`, `requireSysAdmin`). They all refuse the
   President.
5. **`src/proxy.ts` is not a security boundary.** It only checks that a session cookie is
   present, to decide between redirecting and allowing. New public top-level routes must
   be added to its list.
6. **Lo! recognition is not a login.** Never accept it for anything but testimonies.
   The same goes for the `/academics` round page: it recognises a member only to take
   their results, and must never show anyone's grades.
7. **Never commit secrets.** Rotate the Supabase service key if it ever leaks.

---

## 9. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| A leader can't sign in | Their office may not grant a login (Cabinet → Hierarchy), their appointment may have ended, or they're locked out (wait 15 minutes). Otherwise **Reset login**. |
| "Forgot my password" | VP Admin or System Admin presses **Reset login** on the Cabinet roster; the leader signs in with their email and chooses a new password. |
| A module is missing from the sidebar | Their office doesn't hold a tag listed for that module in Settings → Module access (Tenure: President, VPs and System Admin only). |
| An office shows as vacant but is filled | Refresh. If it persists, check the appointment hasn't ended (Roster). |
| Nobody can open Settings, the Oracle or full backup | There is no System Admin this tenure. Run `pnpm db:ict-coord`, then appoint an ICT Coordinator. |
| "System Critical" screen | Expand **Technical Details** and note the message and reference. The most common cause is a dropped connection to the database; try again. If it repeats, give the message to whoever maintains the code. |
| Uploaded images don't appear | Check the two `NEXT_PUBLIC_CLOUDINARY_*` variables and the preset (§7.2), then restart or redeploy. |
| Banner upload is greyed out | Cloudinary isn't configured on this deployment. |
| Everything is slow | Each database round trip from Nigeria is roughly 0.3–0.9 s. Pages are written to make as few as possible; if one regresses, look for sequential `await`s that could run in parallel. |
| An Exco can't open their event's console | The event's **Run by** unit isn't set to their unit (Events → edit). |
| Staging looks wrong after experiments | `pnpm db:reset-staging` (never on production). |

---

## 10. Known gaps and loose ends

- **Zones** is parked as "coming soon". The code exists but isn't wired up.
- **Lo! stars** trust a member id sent from the browser, so someone could star on
  another's behalf. Low impact; worth fixing when Lo! is next touched.
- **Title-based ADMIN role.** The ADMIN *role* (`src/lib/auth-roles.ts`) still matches
  office titles. All writes now use slug- and tag-based checks, but some reads
  (`requireAccess("ADMIN")`) still use the role. Move them onto the context flags when
  convenient, and fix `scripts/bootstrap-admin.mjs`, which finds the VP Admin office by
  title.
- **`src/lib/access-control.ts` is marked `'use server'`**, which exposes its helper
  functions as callable endpoints. Nothing harmful is reachable today, but it should be a
  plain server-only module.
- **Lint debt.** `pnpm lint` reports thousands of old problems (mostly indentation in
  older files). New code must be clean; CI's lint step is non-blocking until the debt is
  paid.
- **No automated tests.** If you add them, use Vitest + React Testing Library.

---

## 11. Where to read more

| Document | For |
|---|---|
| `AGENTS.md` | The engineering spec: stack, conventions, folder layout, auth model, UI rules |
| `docs/DATABASE-CICD.md` | Migrations, CI/CD, staging resets, troubleshooting |
| `docs/FRESH-START.md` | Rebuilding everything from nothing and a backup |
| `docs/RESTART-HERE.md` | Where the database/CI setup work stood when it was last handed over |
| `.env.example` | Every environment variable, explained |
| Code comments | The *why* behind most decisions is written next to the code it explains |

Before you hand over in turn: update this handbook, revoke your personal access tokens
(Supabase, GitHub, Vercel, Cloudinary), and make sure your successor holds the ICT
Coordinator office in the new tenure.
