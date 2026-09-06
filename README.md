# Tellyrate

Anonymous reviews of the hospitals and health facilities where healthcare students do
their clinical training.

Students find out what a rotation is actually like before they start one; the site holds
no email, no real name, and no school for anyone who writes a review. An account is a
username and a password. That is the entire identity surface, and it is deliberate — a
student who describes a department's problems should not be traceable back to a rotation
list.

---

## What it does

- **Browse without an account.** Every facility, review and comment is public and
  crawlable. Reading never asks for anything.
- **Post with a username and a password.** Writing a review, commenting, or voting needs
  an account. Creating one asks for two fields.
- **Sort by what matters.** Most reviewed, highest rated, newest, or by name — and filter
  by city, facility kind and minimum rating. All of it lives in the URL, so any view is
  shareable and crawlable.
- **Facilities come from OpenStreetMap.** Around two thousand real hospitals, clinics,
  health centres, laboratories and pharmacies across 44 Saudi cities, so most students
  find their placement already listed. If it is missing, they add it — after a
  search-first step that makes duplicates hard.
- **Saudi Arabia only, on purpose.** A review site is worth nothing until a given
  hospital has several reviews; spreading across countries would leave every one of them
  with a single review. The schema keeps a country column so this can widen later.

### "Highest rated" is not a naive average

A facility with one five-star review must not outrank one with forty averaging 4.6. The
rating sort uses a Bayesian average that shrinks small samples toward the site-wide mean:

```
score = (C · m + Σ ratings) / (C + n)        C = 8,  m = site mean rating
```

One 5★ review scores **3.93**. Forty reviews averaging 4.6 score **4.47**. The order comes
out right, and it stays right as the site grows because `m` is recomputed from real data.

Review helpfulness uses a Wilson lower bound instead, because likes and dislikes really
are binomial: 20 likes with no dislikes (0.839) correctly beats 600 likes against 400
(0.569), which both raw ratio and net-score get wrong.

---

## Running it locally

Requires **Node 20.19+** (24 recommended) and **Docker**.

```bash
npm install
cp .env.example .env      # the defaults already match the docker-compose database
npm run db:up             # starts Postgres 17 on port 5433
npm run db:migrate        # creates the schema
npm run db:seed           # demo users, reviews and votes
npm run dev
```

Then open http://localhost:3000.

To pull in real facilities from OpenStreetMap:

```bash
npm run import:facilities -- --country SA        # one country
npm run import:facilities -- --city Riyadh       # one city
npm run import:facilities -- --limit 5 --dry-run # look before you leap
```

The importer is idempotent — facilities are keyed on their OpenStreetMap identity, so a
second run updates rather than duplicates.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm test` | Unit tests for the ranking, crypto and network modules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Start / stop the local Postgres container |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:studio` | Prisma Studio |
| `npm run import:facilities` | Import facilities from OpenStreetMap |

---

## Deploying

The site runs on Vercel's free tier with a free Neon database. Two settings
below are not optional — the defaults would make the site slow for exactly the
people it is for.

### 1. The database — Neon, in Frankfurt

Create a project at [neon.tech](https://neon.tech) and **choose the Frankfurt
region** (`eu-central-1`). Neon has no Gulf region; Frankfurt is ~89 ms from
Riyadh and every other option is worse.

Copy both connection strings from the dashboard:

- the **pooled** one, whose host contains `-pooler` — this is `DATABASE_URL`
- the **direct** one — this is `DIRECT_URL`

Both are needed. Serverless functions open a connection per invocation and
will exhaust an unpooled Postgres; migrations do the opposite, because a
transaction pooler cannot run DDL.

### 2. The app — Vercel, in Frankfurt

Import the repository at [vercel.com/new](https://vercel.com/new). No build
settings to change: `postinstall` already runs `prisma generate`.

**Set the function region to Frankfurt (`fra1`)** — `vercel.json` pins it, but
confirm it under Settings → Functions. The default is Washington DC, which
puts the app an ocean away from its database and turns a ~140 ms page into a
~500 ms one. Colocating the app with the database matters far more here than
putting the app near the reader, because each page makes several round trips
to Postgres and only one to the browser.

Set these environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the Neon **pooled** string, with `?sslmode=require` |
| `DIRECT_URL` | the Neon **direct** string |
| `IP_HASH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |

### 3. Create the schema

Once, from your machine — never at request time:

```bash
DIRECT_URL="<neon-direct-string>" npx prisma migrate deploy
```

### 4. Load the facilities

**This cannot run on Vercel.** A full import is 44 cities against a rate-limited
public API and takes 10–50 minutes; every serverless platform caps an
invocation well below that. Run it from your own machine against the
production database:

```bash
DATABASE_URL="<neon-direct-string>" npm run import:facilities -- --country SA
```

Start with `--limit 3 --dry-run` to see what it would do. Re-running is safe —
facilities are keyed on their OpenStreetMap identity, so a second pass updates
rather than duplicates. Repeat it every few months to pick up new facilities.

Do **not** run `npm run db:seed` against production; it inserts demo reviews.

### 5. Nightly maintenance

`.github/workflows/nightly.yml` prunes expired sessions and spent rate-limit
windows, recomputes the site-wide mean rating and rescores every facility
against it. Add `DIRECT_URL` as a GitHub Actions secret and it runs itself.

Without it, sessions accumulate forever and the Bayesian scores drift away
from a mean that is no longer current.

### What the free tier actually costs you

Vercel's Hobby plan forbids commercial use — that includes ads, affiliate
links and **donation buttons**. Tellyrate carries none, so it qualifies; adding
any of them later means moving to Pro at $20/month.

Neon's free tier allows 100 compute-hours a month with a five-minute idle
suspend. A site that is quiet overnight fits comfortably; one busy enough that
the database never idles will not. Do **not** point an uptime monitor at
`/api/health` every minute — it keeps the compute awake and burns the entire
allowance on nothing.

### Self-hosting instead

One server running both the app and Postgres is cheaper at scale and removes
every cliff above — around $7/month on a small VPS, with app-to-database
latency of essentially zero.

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com -t tellyrate .
docker run -p 3000:3000 --env-file .env tellyrate
```

The image uses Next's standalone output, runs as a non-root user, and carries
a health check. `docker-compose.yml` in this repo starts Postgres for local
development and is a reasonable base for a production compose file. Set
`TRUSTED_PROXY_HOPS` to the number of proxies in front of the app — 1 behind a
single nginx, 2 behind Cloudflare *and* nginx — or the rate limiter will
throttle everyone into one bucket.

### Staging and production

Two environments, each with its own database and its own server. Staging exists so a
migration or a risky change is proven somewhere real before it touches student reviews
that cannot be regenerated.

**The database: one Neon project, two branches.** Neon branches are copy-on-write, so a
staging branch costs almost nothing on top of production — it holds the same schema
without duplicating storage.

1. In Neon: **Branches → New branch**, from `main`, named `staging`.
2. Leave **scale-to-zero enabled on staging only**. Nobody is waiting on a cold start
   there, and an idle branch costs cents rather than the ~$19 that keeping production
   always-warm costs.
3. Copy the staging branch's pooled and direct connection strings.

**The server: one Vercel project, two environments.** Vercel already separates
Production from Preview, so no second project is needed.

1. Create a long-lived `staging` branch in git. Every push to it deploys automatically
   to a stable URL — `tellyrate-git-staging-<your-account>.vercel.app`.
2. In **Settings → Environment Variables**, add the staging values scoped to
   **Preview** only, and the live values scoped to **Production** only:

   | Variable | Production | Preview (staging) |
   | --- | --- | --- |
   | `DATABASE_URL` | Neon `main`, pooled | Neon `staging`, pooled |
   | `DIRECT_URL` | Neon `main`, direct | Neon `staging`, direct |
   | `IP_HASH_SECRET` | one secret | **a different secret** |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` | the staging URL |

   Use a different `IP_HASH_SECRET` per environment. Sharing it would let rate-limit
   buckets collide across two databases that are meant to know nothing about each other.

Scoping to Preview covers pull-request deployments too, which is what you want: a PR
should be exercised against staging data, never against production.

**How a change reaches production**

```bash
git switch -c staging          # once
git push -u origin staging     # deploys to the staging URL

# apply the migration to staging first, and try it there
DIRECT_URL="<staging direct>" npx prisma migrate deploy

# only then to production
DIRECT_URL="<production direct>" npx prisma migrate deploy
git switch main && git merge staging && git push
```

Seed demo content on staging freely — `npm run db:seed` is safe there and makes the site
worth looking at. Never run it against production.

**What the code does differently off production.** `APP_ENV` (derived from `VERCEL_ENV`)
drives two guards: `robots.ts` refuses every crawler and publishes no sitemap, so a
staging copy can never compete with the real site in search results or show test reviews
to a student who found them on Google; and a banner marks every page, so nobody moderates
a real report on the wrong environment.

### Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Pooled, in production. |
| `DIRECT_URL` | production | Unpooled connection, used only by `prisma migrate`. |
| `IP_HASH_SECRET` | production | 32+ random bytes, base64. Keys the daily-rotating salt that pseudonymises addresses for rate limiting. |
| `NEXT_PUBLIC_SITE_URL` | yes | Public origin, for canonical URLs and the sitemap. |
| `TRUSTED_PROXY_HOPS` | no | Proxies in front of the app. Default 1, which is correct on Vercel. |
| `APP_ENV` | no | `production` / `staging` / `development`. Derived from `VERCEL_ENV` on Vercel; set it by hand when self-hosting a staging box. Anything but `production` blocks crawlers and shows a banner. |

---

## How privacy is enforced, not just promised

The claim is only worth as much as the code behind it, so:

- **Accounts hold a username and a scrypt hash.** No email column exists. There is no
  password reset, because there is nothing to reset against — signup issues a one-time
  recovery code, and only its hash is stored.
- **Sessions store a SHA-256 of the token, never the token.** A dump of the sessions table
  cannot be replayed as a login.
- **IP addresses are never written down.** Rate limiting uses an HMAC of the address keyed
  by a salt that changes at midnight UTC, so a bucket cannot be linked across days into a
  history of anyone's activity. IPv6 collapses to its /64 so a rotating SLAAC suffix
  cannot mint unlimited buckets.
- **The Content Security Policy forbids every third-party origin.** No analytics, no font
  CDN, no map tiles, no embeds. The fonts are self-hosted for exactly this reason: an
  external font request would hand every visitor's IP to someone else.
- **`Referrer-Policy: no-referrer`,** so which facility page someone was reading never
  leaks to anywhere they click through to.
- **Rotation dates coarsen on quiet facilities.** An exact month plus a small department
  identifies one person, so below five reviews the date blurs to a range.

The honest limit, stated on the privacy page too: reviews are public, and a detailed
enough story can identify its author. The site can protect metadata; it cannot protect
someone from what they choose to write.

---

## Architecture

```
src/
  app/           Next.js App Router — (public), (auth), (account) route groups
  components/    Shared UI: stars, graduated bars, cards, forms
  lib/
    db.ts        Prisma client singleton (pg driver adapter)
    crypto.ts    scrypt password hashing, session tokens, recovery codes
    session.ts   Cookie sessions, hashed server-side
    net.ts       Address normalisation and redirect validation
    ratelimit.ts Privacy-preserving throttling
    ranking.ts   Bayesian average, Wilson lower bound
    aggregates.ts Transactional recomputation of denormalised counters
    queries.ts   Read paths for lists, detail pages and facets
    osm.ts       OpenStreetMap lookup, shared by the importer and the app
prisma/          Schema, migrations, seed
scripts/         OpenStreetMap bulk importer
data/cities.json 102 cities with bounding boxes, resolved from OpenStreetMap
tests/           Unit tests
```

Facility aggregates (`reviewCount`, `ratingSum`, `bayesScore`, per-axis averages) are
denormalised and recomputed inside the same transaction as the review that changed them.
Sorting a directory by rating cannot afford an aggregate-per-row at query time, and a
counter that can drift is worse than no counter.

---

## Data and licensing

Facility data comes from **OpenStreetMap** and is licensed under the
[Open Database License](https://www.openstreetmap.org/copyright). The attribution appears
in the site footer, which is a licence obligation rather than a courtesy.

Reviews belong to the people who wrote them.
