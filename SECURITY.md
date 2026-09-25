# Security

The portal holds personal data of the fellowship's members: names, phone numbers,
addresses, dates of birth and academic results. Please treat any weakness in it as
urgent.

## Reporting a problem

**Don't open a public issue, and don't post it in a group chat.**

1. Use GitHub's private reporting: the repo's **Security** tab → **Report a
   vulnerability**. Only maintainers can see it.
2. Or tell the **ICT Coordinator** directly, in person or in a private message.

Say what you found, how to reproduce it, and what it exposes. Don't access more member
data than you need to show the problem, and don't change or delete anything.

You should hear back within a week. Once it's fixed, we'll tell you.

## What counts

- Someone reading or changing data they shouldn't: another member's record, results,
  or anything behind a module they have no access to.
- Signing in as someone else, or keeping access after being removed from office.
- A secret reaching the browser: the service-role key, `SESSION_SECRET`, or the
  database URL with a password.
- Anything that breaks one of the four other applications sharing the database.

## If a secret leaks

Rotate it straight away. Don't wait to find out whether it was used.

| Secret | Where to rotate it | Also do |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API | Update Vercel and every `.env` file |
| `SESSION_SECRET` | Generate a new one with `openssl rand -hex 32`, then update Vercel and every `.env` file | Every existing password stops working. Reset each leader's login (**Tenure → Cabinet → Reset login**) so they choose a new one at next sign-in |
| Database password | Supabase → Project settings → Database | Update the GitHub Actions secret |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access tokens | Update the GitHub Actions secret |

Then look for anything unusual: run `pnpm audit:log -- --since 7d --summary` (System
Admin), and check the Supabase project's logs.

## How the portal is protected

The details are in [AGENTS.md](./AGENTS.md#auth--authorization--read-this-before-touching-any-auth-code).
In short:

- Sessions are random tokens, stored hashed, in an `httpOnly` cookie.
- Every table has row-level security forced on with no policies. Only the server's
  service-role client can read the database, and every server action checks the
  caller's role first.
- Public pages (registration, results submission, Lo!, events) confirm who someone is
  against the member roster and are rate-limited. They never show a member's existing
  data to an unconfirmed visitor.
