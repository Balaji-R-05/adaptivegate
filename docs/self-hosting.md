# Self-hosting, fully locally — no Supabase Cloud account needed

AdaptiveGate normally points at a Supabase Cloud project for Auth and Postgres. This stack lets you
run the equivalent locally in Docker instead — a friend can clone the repo, fill in `.env`, and run
everything on their own machine with nothing talking to the internet at runtime.

It works because the app only uses Supabase for Auth — nothing else. Three extra Docker services
(`db`, `auth`, `gateway`) stand in for Supabase Cloud, and nothing else about the app changes. The
dashboard doesn't even need a different build: it fetches its Supabase URL/key from the server at
runtime instead of having them baked in, so the same dashboard image works for any Supabase
project, cloud or self-hosted.

| Service   | Image             | Role                                                             |
| --------- | ----------------- | ----------------------------------------------------------------- |
| `db`      | `supabase/postgres`| Postgres + pgvector, with the `auth` schema GoTrue needs already set up |
| `auth`    | `supabase/gotrue`  | Email/password + GitHub-OAuth-capable auth server                |
| `gateway` | `nginx:alpine`     | Rewrites `/auth/v1/*` → `auth:9999/*`, matching what supabase-js expects |

These three are tagged `profiles: ['selfhosted']` in `compose.yml`, so they're entirely opt-in — a
plain `docker compose up` (the Supabase Cloud path) never starts them.

## Quick setup

The fastest path, using prebuilt images from GHCR instead of building from source — needs only
Docker, nothing else on your host (no Node, no pnpm):

```bash
git clone https://github.com/Balaji-R-05/adaptivegate.git
cd adaptivegate
./setup.sh           # macOS/Linux/WSL
# or: .\setup.ps1     # Windows PowerShell
```

This generates secrets, starts the Supabase stack, sets up the database, starts the app, and opens
`http://localhost:5173` for you. Sign up with any email/password. See `setup.sh`/`setup.ps1` for
exactly what each step does, or the manual walkthrough below to troubleshoot any individual step.

## Manual setup (what the script automates)

Building from source instead of pulling prebuilt images — useful for development, or if you'd
rather run through each step yourself.

1. **Generate a JWT secret and Postgres password**, and fill them into `.env` (copy `.env.example`
   first if you haven't):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # → JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"   # → POSTGRES_PASSWORD
   ```
   Also set `SITE_URL=http://localhost:5173` (or wherever the dashboard will run).

2. **Start the local Supabase stack:**
   ```bash
   docker compose --profile selfhosted up -d db auth gateway
   ```
   Wait for all three to report healthy (`docker compose ps`).

3. **Generate the anon/service-role keys** from your `JWT_SECRET`:
   ```bash
   pnpm install
   pnpm --filter @adaptivegate/server run generate-supabase-keys -- <your JWT_SECRET>
   ```
   Paste the two printed lines (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) into `.env`.

4. **Point `SUPABASE_URL`/`DATABASE_URL` at the local stack**, in `.env`:
   ```bash
   SUPABASE_URL=http://localhost:8000
   DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres
   ```
   (Running `server`/`dashboard` themselves as Docker services, instead of `pnpm dev`? Use
   `SUPABASE_URL=http://gateway:8000` and `DATABASE_URL=...@db:5432/postgres` instead - and also
   set `SUPABASE_PUBLIC_URL=http://localhost:8000`, since the browser can't reach `gateway` by
   that name. See `apps/server/src/api/config.ts`.)

5. **Apply the schema:**
   ```bash
   pnpm db:migrate
   ```
   This must run after step 2 (GoTrue needs to have created `auth.users`/`auth.uid()` first — the
   migrations rely on both already existing).

6. **Run the app** (either `pnpm dev`, or `docker compose up -d server dashboard`), open
   `http://localhost:5173`, and sign up with email/password (no GitHub OAuth App needed). Email
   confirmation is skipped for local deployments (`GOTRUE_MAILER_AUTOCONFIRM=true` — there's no SMTP
   server here, and requiring one would reintroduce a cloud dependency).

## Updating

`compose.selfhosted.yml` always points at the `:latest` images, so a new release doesn't need any
file edited - just pull the new images, apply any new migrations, and restart:

```bash
./update.sh           # macOS/Linux/WSL
# or: .\update.ps1     # Windows PowerShell
```

This is safe to re-run anytime; it never touches `.env` or regenerates secrets. If you built from
source instead of using the quick-setup images, update manually: `git pull`, rebuild the images,
then run `pnpm db:migrate` before restarting `server`/`dashboard`.

## Notes

- **The server's Docker image runs the TypeScript source via `tsx`**, not the compiled `dist/`
  output with plain `node` — other packages in this monorepo point straight at their own `.ts`
  files, which plain `node` can't run. Don't change `apps/server/Dockerfile`'s `CMD` or `pnpm start`
  back to `node dist/index.js`; it builds fine but crashes on startup.
- **GitHub OAuth still works if you want it**, on top of email/password: register a GitHub OAuth
  App, point its callback at your `gateway` URL, then set `GOTRUE_EXTERNAL_GITHUB_ENABLED=true`
  plus the app's client id/secret on the `auth` service in `compose.yml`.
- **Keep the `db` and `auth` image tags matched** in `compose.yml` — they're built to work
  together, and mismatched versions can fail with errors like `type "auth.factor_type" does not
  exist`. If you ever need to bump them, check Supabase's own self-host `docker-compose.yml`
  (`supabase/supabase` on GitHub) for the current matching pair.
- **`scripts/zz-selfhosted-db-init.sh` sets a password** for the `supabase_auth_admin` database
  role, which GoTrue needs to run its migrations but which ships with no password by default. It's
  named `zz-` so it runs after the image's own setup scripts, which create that role in the first
  place.
- **`nginx.conf` adds CORS headers** that GoTrue doesn't send on its own, so the dashboard's
  browser requests don't fail before reaching it. It only adds them to `OPTIONS` requests — GoTrue's
  normal responses already include their own CORS header, and adding a second one would break things.
- **Switching back to Supabase Cloud later** is just pointing the same env vars at a cloud project
  again — nothing else in the app changes.
