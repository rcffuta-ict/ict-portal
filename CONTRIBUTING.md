# Contributing

Thank you for looking after the portal. This page is how work gets from an idea to
production. Read [AGENTS.md](./AGENTS.md) too: it is the full spec for this repo, and it
applies to people and AI agents alike.

## Before you start

- Access to the repo, Vercel and both Supabase projects comes from the ICT Coordinator.
  Never share a service-role key or a `.env` file in a chat or an issue.
- Install with **pnpm only** (`pnpm install`). Never commit an npm or yarn lockfile.
- Copy `.env.example` to `.env.local` and point it at the **staging** database. Never
  develop against production.
- Outside production the portal only accepts `@rcffuta.test` email addresses, so no
  real member's address ends up in a test database.

## Branches and how a change ships

| Branch | What a push does |
| --- | --- |
| `dev/<short-name>` | Nothing is deployed. CI rebuilds the whole database from zero to check your migrations. |
| `stage` | Applies migrations to the **staging** database; Vercel deploys a preview. |
| `main` | Applies migrations to **production** (after an approval) and Vercel deploys the live site. |

1. Branch from `stage`: `git checkout -b dev/transfer-notes`.
2. Make the change, then run the checks below.
3. Open a pull request into `stage`. Try it on staging.
4. When staging is right, open a pull request from `stage` into `main`.

Never push straight to `main`.

## Checks before every pull request

```bash
pnpm build    # the real correctness check: most App Router mistakes only show here
pnpm lint     # judge by the files you touched; older files have an indentation backlog
```

There is no test runner. Try the change yourself on a phone-sized screen, and on a slow
connection (browser dev tools → Network → "Slow 4G").

## Database changes

- Create a migration only with `supabase migration new <name>`. A hand-made file with
  the wrong name is silently skipped, and the deploy still reports success.
- **Never edit or rename a migration once it has run anywhere**, staging included.
  Write a new one instead.
- Make migrations safe to re-run (`IF NOT EXISTS`, `DROP ... IF EXISTS`).
- Enable and force RLS on every new table, with no policies. Only the service-role
  client reads the database.
- Four other applications share the database (`rw_*`, `fyb_*`, `elib_*`, the games).
  Never touch their tables. Run `pnpm db:inventory` before and after.
- Before merging to `main`, take a full backup from the portal: **Settings → System
  insurance**. The free plan has no automatic backups.

Full runbook: [docs/DATABASE-CICD.md](./docs/DATABASE-CICD.md).

## Code style

- **4-space indentation**, enforced by ESLint.
- Server actions go in the route's own `actions.ts`, UI in its `components/` folder.
  Move a component to `src/components/` only when a second route needs it.
- Forms use react-hook-form + zod, with errors next to the field and a submit button
  that disables while saving.
- Every request needs a visible loading state and a visible error state.
- Use the hand-rolled components in `src/components/ui/`. Don't add a UI kit.
- Import with `@/…`, not long `../../` chains.

## Security rules

- Never import `src/lib/db.ts` into a client component. It bypasses every access rule.
- `src/proxy.ts` is not an access check. Check permissions in the server action itself.
- Never commit secrets. See [SECURITY.md](./SECURITY.md) to report a problem.

## Commit messages

Use the conventional prefixes the release script groups by: `feat:`, `fix:`, `perf:`,
`refactor:`, `docs:`, `chore:`. Add `!` for a change that can't be undone
(`feat(db)!: drop tenures.name`).

## Releases

The version says whether a deploy touches the database: PATCH is code only, MINOR adds a
migration, MAJOR can't be undone.

```bash
node scripts/release.mjs                   # dry run: proposed version and changelog
node scripts/release.mjs --commit          # write CHANGELOG.md and bump package.json
node scripts/release.mjs --major --commit  # MAJOR is never guessed; you pass it
```

Commit the release on `stage`, merge to `main`, then tag the merge:
`git tag -a v1.2.0 -m "v1.2.0" && git push origin v1.2.0`.

## Handing over

When your time in the ICT unit ends, follow [docs/HANDBOOK.md](./docs/HANDBOOK.md): pass
on every account, rotate the secrets you held, and make sure your successor can sign in
before you leave.
