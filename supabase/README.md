# Registration backend

The registration form at `/register` writes to a single Postgres table,
`public.registrations`, hosted on Supabase.

`schema.sql` is plain PostgreSQL — it runs unchanged through `psql` or through
the Supabase SQL editor. Pick either.

## Option A — psql

Get the connection string from Supabase: **Project Settings → Database →
Connection string → URI**. It looks like:

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Then run the schema against it:

```bash
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
```

Put the URI in the `SUPABASE_DB_URL` environment variable rather than typing it
inline — it contains your database password and would otherwise land in your
shell history.

This connection string is **not** the same as `VITE_SUPABASE_URL`, and it must
never be committed or shipped to the browser.

## Option B — Supabase SQL editor

Project → SQL Editor → New query → paste the contents of `schema.sql` → Run.

## After running it

Verify the table and its policy exist:

```bash
psql "$SUPABASE_DB_URL" -c "\d public.registrations"
```

```bash
psql "$SUPABASE_DB_URL" -c "select policyname, cmd, roles from pg_policies where tablename = 'registrations';"
```

You should see exactly one policy: `anon can register`, for `INSERT`.

## Frontend config

Add these to `.env` (local) and to your Vercel environment variables, then
redeploy — Vite inlines them at build time, so an existing deployment will not
pick them up until it is rebuilt:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Both come from **Project Settings → API**. The anon key is publishable and is
meant to be visible in the browser; Row Level Security is what protects the
data. Never put the `service_role` key in a `VITE_` variable — it bypasses RLS
entirely and would be readable by anyone who views the page source.

## Reading the registrations

Anonymous visitors can insert but **cannot** select, so the roster is not
readable with the public key. Read it from the Supabase dashboard's Table
Editor, or:

```bash
psql "$SUPABASE_DB_URL" -c "select created_at, full_name, phone, email, admission_number, branch from public.registrations order by created_at desc;"
```

Export to CSV:

```bash
psql "$SUPABASE_DB_URL" --csv -c "select * from public.registrations order by created_at" > registrations.csv
```
