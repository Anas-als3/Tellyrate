# Hospirate

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
  by city, country, facility kind and minimum rating. All of it lives in the URL, so any
  view is shareable and crawlable.
- **Facilities come from OpenStreetMap.** Roughly a thousand real hospitals and clinics
  are imported per country, so most students find their placement already listed. If it
  is missing, they add it — after a search-first step that makes duplicates hard.

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

### Vercel

1. Push the repository and import it at [vercel.com/new](https://vercel.com/new).
2. Create a Postgres database — [Neon](https://neon.tech) has a usable free tier — and
   take **both** connection strings.
3. Set the environment variables below in the project settings.
4. Deploy. `postinstall` runs `prisma generate`, so no custom build command is needed.
5. Apply migrations once against the direct URL:

   ```bash
   DATABASE_URL="<direct-url>" npx prisma migrate deploy
   ```

`DATABASE_URL` must be the **pooled** connection string. Serverless functions open a
connection per invocation, and an unpooled Postgres will run out of them under any real
traffic. Migrations need the **direct** one, because a pooler cannot run DDL.

### Docker

```bash
docker build --build-arg BUILD_STANDALONE=1 -t hospirate .
docker run -p 3000:3000 --env-file .env hospirate
```

The image uses Next's standalone output and runs as a non-root user.

### Environment variables

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Pooled, in production. |
| `DIRECT_URL` | production | Unpooled connection, used only by `prisma migrate`. |
| `IP_HASH_SECRET` | production | 32+ random bytes, base64. Keys the daily-rotating salt that pseudonymises addresses for rate limiting. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `NEXT_PUBLIC_SITE_URL` | yes | Public origin, for canonical URLs and the sitemap. |
| `TRUSTED_PROXY_HOPS` | no | Proxies in front of the app. Default 1 (Vercel, or a single nginx). Raise it if you add a CDN. |

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
