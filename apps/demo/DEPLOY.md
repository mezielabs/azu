# Deploying the public demo

The public demo at https://demo.azuadmin.com is this app with `DEMO_MODE=true`, on Postgres, in one container on Coolify. This page covers the image, its settings, the hourly reset, and how to check it works.

With `DEMO_MODE` off (the default), none of this applies: local dev and CI run the demo as before.

## What `DEMO_MODE` turns on

- **One-click sign-in.** The login page shows **Sign in as Admin**, **Sign in as Editor**, and **Sign in as Viewer**. Each is a POST to `/demo/sign-in/:role`, with the CSRF token, that signs in a seeded account. The Editor is the demo's `staff` role.
- **A Users resource** under **Settings**, so visitors can compare the roles. The three demo accounts are locked: `UserPolicy` denies every change to them, for everyone.
- **A banner** on the login page and across the panel: "This demo resets every hour. Last reset 12 minutes ago."
- **Limits.** 60 write requests (POST, PUT, PATCH, DELETE) per minute per IP address, uploads up to 1 MB on the local `fs` disk, and `X-Robots-Tag: noindex, nofollow` on every response. These live in `config/demo.ts`.
- **`GET /health`**, for the host's health check.

The demo sends no email: it has no mail package installed, so there's nothing to turn off.

## The image

`apps/demo/Dockerfile` builds from the repository root, because the demo uses the workspace's own packages. It runs on Node 24.21:

```sh
docker build -f apps/demo/Dockerfile -t azu-demo .
```

The image contains no secrets. The build creates a throwaway `.env` with a random key so Ace can run, and removes it before the build output is copied.

In Coolify, create an **Application** from the GitHub repository with:

| Setting | Value |
| --- | --- |
| Build pack | Dockerfile |
| Base directory | `/` |
| Dockerfile location | `/apps/demo/Dockerfile` |
| Port | `3333` |
| Domain | `https://demo.azuadmin.com` |

Add a **PostgreSQL** resource (version 18) in the same project, and use its internal host for `DB_HOST`.

## Environment variables

Set these in Coolify. Don't commit them anywhere.

| Variable | Value |
| --- | --- |
| `DEMO_MODE` | `true` |
| `APP_KEY` | A new random key: run `node ace generate:key --show` locally and paste it. Changing it signs everyone out. |
| `APP_URL` | `https://demo.azuadmin.com` |
| `DB_CONNECTION` | `pg` (the image's default) |
| `DB_HOST` | The Postgres resource's internal host |
| `DB_PORT` | `5432` |
| `DB_USER` | From the Postgres resource |
| `DB_PASSWORD` | From the Postgres resource |
| `DB_DATABASE` | From the Postgres resource |
| `SESSION_DRIVER` | `cookie` (the image's default), so sessions survive a restart |

The image also sets `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3333`, `TZ=UTC`, `LOG_LEVEL=info`, and `DRIVE_DISK=fs`. Override them only if you need to.

Note: the app trusts `X-Forwarded-For` from private network addresses (Coolify's proxy), so the write limits count each visitor. Don't publish port 3333 to the internet directly.

## Uploads

Uploads go to `/app/build/storage`. Add a Coolify **persistent storage** volume there, so the seeded product images survive a redeploy. The reset empties it every hour either way.

## Reset the demo

`node ace demo:reset` empties the uploads disk, runs `migration:fresh --seed`, and records the time for the banner. It refuses to run unless `DEMO_MODE=true`.

1. After the first deploy, open the application's **Terminal** in Coolify and run:

   ```sh
   node ace demo:reset
   ```

   The working directory is `/app/build`. Until this runs, the database has no tables, so pages fail.

2. Add a **Scheduled task** to the application:

   | Setting | Value |
   | --- | --- |
   | Command | `node ace demo:reset` |
   | Frequency | `0 * * * *` (every hour, on the hour) |

Run it again after a deploy that adds a migration.

During a reset, which takes a few seconds, requests can fail while the tables are recreated. Visitors stay signed in: the seeders recreate the demo accounts with the same ids.

## Health check

`GET /health` returns 200 when the database answers, and 503 otherwise. The image's `HEALTHCHECK` calls it. In Coolify, set the health check path to `/health` on port `3333`.

## Check it works

After the first reset:

```sh
curl -sI https://demo.azuadmin.com/login | grep -i x-robots-tag
curl -s https://demo.azuadmin.com/health
```

The first prints `x-robots-tag: noindex, nofollow`. The second shows `"isHealthy":true`.

Then open https://demo.azuadmin.com/login, check the banner, and sign in as each role:

- **Admin** sees every resource, **Delete**, **Publish**, and the **Role** field on users.
- **Editor** edits products but has no **Delete** or **Publish**, and no **Role** field on users. Categories, tags, and orders are hidden.
- **Viewer** sees products, coupons, and users, with no **Edit** or **Create**.

Once the demo is live, uncomment the "Try the demo" links in `apps/docs/src/components/Landing.astro` and `apps/docs/src/content/docs/docs/index.mdx`.
