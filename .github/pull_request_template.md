## What this changes

<!-- One or two sentences: what a member or leader will notice. -->

## Why

<!-- The problem it solves, or the request it answers. -->

## Checks

- [ ] `pnpm build` passes
- [ ] `pnpm lint` adds no new findings in the files I touched
- [ ] Tried on a phone-sized screen and a slow connection (if it changes a screen)
- [ ] Every new request shows a loading state and an error state

## Database

- [ ] No migration in this PR
- [ ] Migration made with `supabase migration new`, safe to re-run, RLS forced on new tables
- [ ] No migration that already ran anywhere was edited
- [ ] Merging to `main`: a full backup was taken (**Settings → System insurance**)

## Security

<!-- Anything touching sign-in, roles, cookies, src/lib/db.ts, src/proxy.ts or a public
page? Say what, and how it stays safe. Write "None" if nothing. -->
