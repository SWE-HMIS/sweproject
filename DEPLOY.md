# Deploying HMIS to Vercel + Railway

This guide deploys the cleaned-up HMIS app to:

- **Railway** — Express API (`server/`) + managed MySQL 8
- **Vercel** — React/Vite client (`client/`)

Time budget: ~20 minutes. You'll need a GitHub account and free Railway + Vercel
accounts (no credit card required for the free tiers).

All the supporting config — `server/railway.json`, `client/vercel.json`,
`server/scripts/init-db.js`, env templates, the `0.0.0.0` bind, and the
`VITE_API_URL` plumbing — is already in this repo. You just point the hosts at it.

---

## 0. Push the repo to GitHub

Both Railway and Vercel deploy from a Git repo, so push first:

```bash
cd hmis_improved
git add .
git commit -m "Add Vercel + Railway deploy config"
git push origin main
```

---

## 1. Provision MySQL on Railway

1. Go to <https://railway.app> → **New Project** → **Provision MySQL**.
2. Wait ~30 seconds for the DB to come up.
3. Click the MySQL service → **Variables** tab → copy `MYSQL_URL` (looks like
   `mysql://root:xxxx@containers-us-west-N.railway.app:7xxx/railway`).
   Keep that tab open — you'll need this string in step 2 and step 3.

> Free tier gives you 512 MB of storage, plenty for the demo seed data.

### Load schema + seed into Railway's MySQL (run from your laptop)

The bootstrap script reads `database/schema.sql` and `database/seed.sql`
and applies them to whatever `MYSQL_URL` points at.

```bash
cd server
npm install                              # if you haven't already
MYSQL_URL='mysql://root:xxxx@containers-us-west-N.railway.app:7xxx/railway' \
  npm run db:init
```

Expected output:

```
[init-db] Applying schema.sql (… bytes)...
[init-db] schema.sql applied.
[init-db] Applying seed.sql (… bytes)...
[init-db] seed.sql applied.
[init-db] Done.
```

> For a real production deploy, set `SKIP_SEED=1` to skip the demo accounts:
> `SKIP_SEED=1 MYSQL_URL='…' npm run db:init`. You'll then need to seed real
> users out-of-band.

---

## 2. Deploy the API to Railway

In the same Railway project:

1. **+ New** → **GitHub Repo** → pick this repo.
2. After it imports, open the new service → **Settings**:
   - **Root Directory**: `server`
   - **Watch Paths**: `server/**`
   - Build / Start commands are auto-detected from `server/railway.json`
     (Nixpacks builder, `npm start`, healthcheck on `/health`).
3. **Variables** tab — add these (Railway → "+ New Variable"):

   | Variable        | Value                                                         |
   | --------------- | ------------------------------------------------------------- |
   | `MYSQL_URL`     | The Railway MySQL connection string from step 1                |
   | `JWT_SECRET`    | A long random string. Generate: `openssl rand -hex 32`         |
   | `JWT_EXPIRES_IN`| `8h`                                                          |
   | `CORS_ORIGIN`   | (leave blank for now — add the Vercel URL after step 3)        |
   | `NODE_ENV`      | `production`                                                  |

   Tip: `MYSQL_URL` can also be wired with Railway's reference syntax —
   `${{ MySQL.MYSQL_URL }}` — so it auto-updates if the DB rotates creds.

4. **Settings → Networking → Generate Domain**. Copy the URL — e.g.
   `https://hmis-api-production.up.railway.app`. Test it:

   ```bash
   curl https://hmis-api-production.up.railway.app/health
   # {"ok":true,"service":"hmis-api"}
   ```

   If you don't get that, check **Deployments → View Logs** in Railway.

---

## 3. Deploy the client to Vercel

1. Go to <https://vercel.com/new> → import the same GitHub repo.
2. **Configure Project**:
   - **Root Directory**: `client`
   - Framework, build command, and output directory are auto-detected from
     `client/vercel.json` (Vite, `npm run build`, `dist`).
3. **Environment Variables** — add ONE:

   | Variable        | Value                                                |
   | --------------- | ---------------------------------------------------- |
   | `VITE_API_URL`  | The Railway API URL from step 2 (no trailing slash)  |

   For example: `VITE_API_URL=https://hmis-api-production.up.railway.app`.

4. Click **Deploy**. After ~1 minute you'll get a URL like
   `https://hmis-improved.vercel.app`. Copy it.

---

## 4. Wire CORS back to the client

The API blocks cross-origin requests by default. Tell it which origin to trust:

1. Back in **Railway → API service → Variables**, set:

   ```
   CORS_ORIGIN=https://hmis-improved.vercel.app
   ```

   (You can pass a comma-separated list to allow multiple, e.g. preview
   deployments: `https://hmis-improved.vercel.app,https://*.vercel.app`.)

2. Railway will auto-redeploy the API with the new env var (~30 seconds).

---

## 5. Smoke test

Open your Vercel URL in a browser. You should land on the login screen.

Sign in with the seeded admin:

- Email: `admin@hmis.local`
- Password: `password`

Click around — Patients, Appointments, Billing should all load. If something
401s or hangs, open DevTools → Network tab and check what URL it's hitting.
99% of issues are one of:

- `VITE_API_URL` typo (still pointing at localhost or wrong domain)
- `CORS_ORIGIN` doesn't exactly match the Vercel URL (no trailing slash, scheme
  matters: `https://` not `http://`)
- DB schema not loaded (re-run `npm run db:init`)

---

## 6. Post-deploy hardening

Before letting real users in:

- **Replace `JWT_SECRET`** if you used a weak placeholder.
- **Drop demo users**: `DELETE FROM users WHERE email LIKE '%@hmis.local';`
  (or re-init with `SKIP_SEED=1`).
- **Rotate the MySQL password** in Railway and update `MYSQL_URL`.
- **Custom domain**: Vercel → Settings → Domains, and add it to `CORS_ORIGIN`.
- **Notifications**: the `/api/notifications/send` endpoint currently just
  writes to a `notifications` table. Wire it to a real email/SMS provider
  before relying on it.

---

## How redeploys work after this

- **API** — push to `main`. Railway watches `server/**` and redeploys.
- **Client** — push to `main`. Vercel rebuilds and re-publishes within ~1 min.
- **Schema changes** — edit `database/schema.sql` (or write a new migration),
  then re-run `MYSQL_URL=… npm run db:init` from your laptop. The included
  schema uses `CREATE TABLE IF NOT EXISTS` so it's safe to re-run for additive
  changes; for destructive changes, drop the table first.

---

## What lives where

```
hmis_improved/
├── client/
│   ├── vercel.json          ← Vercel build + SPA rewrites
│   ├── .env.example         ← VITE_API_URL doc
│   └── src/api/client.js    ← prepends VITE_API_URL in prod
├── server/
│   ├── railway.json         ← Nixpacks builder + /health probe
│   ├── scripts/init-db.js   ← `npm run db:init` — schema + seed
│   ├── src/index.js         ← binds 0.0.0.0
│   ├── src/db.js            ← reads MYSQL_URL or DB_*/MYSQL*
│   └── .env.example         ← documents prod env vars
├── database/
│   ├── schema.sql           ← single source of truth
│   └── seed.sql             ← demo data (skip in prod)
└── DEPLOY.md                ← this file
```
