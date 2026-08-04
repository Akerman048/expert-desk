# МайБуд

Платформа управління будівельними проєктами та технічною документацією.

МайБуд — Next.js application для організаційної роботи з проєктами, документами, версіями, погодженнями, зауваженнями, архівом, сповіщеннями й role-scoped client portal.

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/Akerman048/maibud.git
cd maibud
pnpm install
```

Copy `.env.example`, configure local values, then run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The package and technical slug are `maibud`; the user-facing Ukrainian product name is `МайБуд`.

## Testing

```bash
pnpm run test
pnpm run test:watch
pnpm run test:coverage
pnpm run lint
pnpm run build
```

Unit tests exercise deterministic business rules and do not connect to Neon or S3. CI uses placeholder environment values and does not run migrations or seed scripts.

## Production deployment

Production uses Node.js 22, pnpm 11, a pooled TLS-verified PostgreSQL connection, private S3 storage, secure Auth.js cookies, same-origin application APIs, and explicit security headers. `.env.example` is the environment contract: required, conditional credential, tuning, public build-time, and optional observability variables are documented there.

The repository includes a multi-stage non-root `Dockerfile`, an optional `.env.production` Docker Compose setup, standalone Next.js output, liveness/readiness endpoints, and a CI pipeline that validates Prisma before typecheck, tests, coverage, lint, and build. Build/start do not run migrations or seed scripts and do not call S3 or Resend.

Provider-specific setup for Render, Vercel, Neon, AWS S3/CORS, Resend, GitHub Actions, release ordering, and rollback is in [docs/deployment.md](docs/deployment.md). Review that checklist before introducing production secrets or enabling the email worker.

## Observability and production operations

`GET /api/health` is a process liveness probe and never touches PostgreSQL. `GET /api/ready` is a readiness probe that runs only `SELECT 1`, has a four-second timeout, and returns a controlled `503` response when the database is unavailable. Both endpoints disable caching and reject `HEAD`, `POST`, and `PUT` with `405`.

API handlers emit one-line JSON logs with a request ID, stable route template, method, status, duration and sanitized error data. A valid incoming `x-request-id` is preserved; missing or unsafe values are replaced with a UUID, and the final ID is returned in the response header. The sanitizer recursively redacts credentials, auth/session values, raw tokens, S3 keys/URLs and business-sensitive payload fields. Production error logs omit stacks.

Metrics use a low-cardinality abstraction for HTTP request counts/duration, database readiness failures, processed email jobs and upload-completion failures. It is a no-op by default; set `METRICS_LOG_ENABLED=true` to emit metric records through the structured logger. Route labels are templates and never contain ids, emails, filenames or query strings. A later Prometheus or OpenTelemetry sink can implement the same abstraction without changing endpoint code.

Sentry is optional. With empty `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` the SDK is disabled and sends nothing. Configure server and public DSNs plus environment/release variables to enable it. `sendDefaultPii` remains disabled, sensitive event fields are sanitized, and routine health/readiness or explicitly expected errors are dropped. Source maps are disabled unless `SENTRY_AUTH_TOKEN` is present; production upload additionally requires `SENTRY_ORG` and `SENTRY_PROJECT`. Do not expose `SENTRY_AUTH_TOKEN` as a public variable.

For production PostgreSQL, use a certificate-verifying connection string such as `?sslmode=verify-full` and verify the provider CA/hostname policy. Do not weaken TLS validation merely to silence certificate errors.

The `pg` concurrent-query warning was traced to `Promise.all` calls on a Prisma interactive transaction, which owns one checked-out `pg Client`. Transaction work and notification fan-out now run sequentially on that client; ordinary independent Prisma queries still use the adapter-managed pool, and the development Prisma singleton remains unchanged.

Deployment and incident procedures, including rollback, log fields and the rate-limit review, are documented in [docs/operations.md](docs/operations.md).

## Resetting a development test user

The reset command is intentionally disabled unless the environment is not
production and the explicit safety switch is enabled. Always inspect a dry run
first:

```bash
ALLOW_DEV_DATABASE_RESET=true pnpm run dev:reset-user -- user@example.com --dry-run
ALLOW_DEV_DATABASE_RESET=true pnpm run dev:reset-user -- user@example.com
```

The command normalizes the email and prints its deletion plan before making any
changes. Account, project/organization membership, user-owned notification,
invitation, and safe reference cleanup runs in one serializable transaction.
It never deletes shared projects or documents. An onboarding organization is
removed only when the target was its sole HEAD member and it has no projects or
remaining invitations. The reset refuses to continue when deleting the User
could cascade into documents or violate shared authored-content relations.

## Organization invitations

HEAD creates an invitation and assigns its organization role; invitees cannot choose a role themselves. Invitation links contain a one-time raw token, while the `Invitation` row stores only its SHA-256 hash. The raw link is queued through the existing short-lived invitation email job during create/resend, and the generated URL is still shown to HEAD as a manual-delivery fallback.

After deploying the organization-membership migration, backfill existing project members without deleting or changing existing data:

```bash
pnpm exec tsx scripts/backfill-organization-members.ts
```

Run the backfill explicitly against the intended environment. It is never executed by CI or migrations. The summary reports users without project or organization evidence instead of guessing their organization; assign those users manually after review. Because Auth.js uses JWT sessions, users should sign in again after an organization role change so the dashboard redirect uses the updated global compatibility role. An existing user cannot accept an invitation with a conflicting role while they retain active memberships in another organization, because the current dashboard still relies on one global compatibility role.

## Comment threads

Document remarks are stored as discussion threads. An EXPERT creates a thread for a document or a specific document version; EXPERT and DESIGNER project members can reply. A DESIGNER marks an OPEN or RETURNED thread as completed (`RESOLVED`), and an EXPERT can return it for further work (`RETURNED`). Messages use soft delete and retain their database content for auditability.

The legacy `Comment` table remains available during the transition. After deploying the additive comment-thread migration, migrate legacy rows explicitly with:

```bash
pnpm exec tsx scripts/backfill-comment-threads.ts
```

The backfill uses `legacyCommentId` as an idempotency marker, does not modify or delete legacy comments, and is never run by migrations or CI. Comment-thread Server Actions create internal notifications in the same database transaction as each thread event.

## Notifications

Internal notifications are stored in PostgreSQL and are always queried by their owner `userId`. Read state is represented by `readAt`; list pages use server-side filtering and pagination, while DashboardLayout performs one count query for the Sidebar unread badge. Document submission, version upload, review, client publication, comment-thread activity, project membership, invitation acceptance, and project archival create notifications in the same transaction as the business change when possible.

Notification targets are generated from trusted entity ids and role-aware internal routes. Arbitrary external URLs are rejected. Polling, WebSocket, and external realtime services are intentionally not part of this module.

## Archive and restore

HEAD and ARCHIVIST can archive and restore projects and eligible documents after their database membership is verified. Projects retain `previousStatus` and restore to that status (or `OPEN` as a safe fallback). Documents can be archived only from `APPROVED` or `REJECTED`; `previousStatus` restores that exact state.

Archiving removes client publication immediately. Archived projects and documents are read-only for uploads, review, publication, comments, project edits, and project-membership changes. Restore never republishes content automatically. Active queries exclude archived records, while archive pages use separate access-aware server queries with search, actor/date/status filters, sorting, and pagination.

Archive and restore actions write audit entries and create deduplicated internal notifications. Supported notifications enqueue email jobs through the transactional outbox; actions never contact the email provider directly.

## Email delivery

Email delivery uses a transactional outbox. A business transaction creates the internal `Notification` and its eligible `EmailJob` together; it never calls Resend. The job moves through `PENDING`/`FAILED` → `PROCESSING` → `SENT`, or becomes `CANCELLED` after five attempts. Retries use delays of 1 minute, 5 minutes, 15 minutes, and 1 hour. Stale processing locks are released after 15 minutes, and atomic claims prevent two workers from sending the same job.

Required environment variables:

```bash
APP_URL=http://localhost:3000
RESEND_API_KEY=re_placeholder
EMAIL_FROM="МайБуд <notifications@example.com>"
EMAIL_JOB_SECRET=replace-with-at-least-32-random-characters
```

Trigger a bounded worker batch with `POST /api/internal/email-jobs/process` and `Authorization: Bearer $EMAIL_JOB_SECRET`, or process one local batch explicitly:

```bash
pnpm exec tsx scripts/process-email-jobs.ts
```

The worker is never started by migrations, seed, build, or CI. Resend is initialized lazily only while processing jobs. Users control global, document, comment, and membership email categories from their role-specific settings page. Unsupported/noisy events such as document unpublish remain internal-only. Invitation link rotation has a 60-second cooldown, invalidates the previous token, and cancels any older pending invitation email job. Successfully sent and terminally failed jobs replace payload data with sanitized metadata so one-time invitation links are not retained.

The optional HEAD email-job observability page is intentionally deferred; inspect operational metrics through database tooling without exposing payloads or invitation URLs in the application UI.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to optimize IBM Plex Sans with Latin and Cyrillic subsets.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
## Search, filters and pagination

Основні списки проєктів, документів, comment threads, notifications, учасників і архіву використовують URL як єдине джерело стану (`search`, `page`, `pageSize`, filters, `sortBy`, `sortDirection`). Значення нормалізуються на сервері; допустимі розміри сторінки — 10, 20 і 50, default — 20. Запит сторінки за межами `totalPages` послідовно повертає порожній список, не змінюючи requested page у metadata.

Фільтрація, пошук, сортування, `count`, `skip` і `take` виконуються PostgreSQL через Prisma. Списки не завантажують повні набори для client-side filtering; latest document version і latest visible thread message вибираються bounded relation selects, без N+1. Поля сортування проходять через явні allowlists, тому raw URL keys не передаються в Prisma.

Scopes застосовуються в кожному list query: HEAD/ARCHIVIST — лише активна membership їхньої organization, EXPERT/DESIGNER/CLIENT — лише відповідна ProjectMember membership. CLIENT додатково не бачить archive/internal document data; notifications завжди обмежені власником (`Notification.userId`). Для типових scope/filter/order комбінацій додана additive migration `add_search_filter_indexes`. Архів повторно використовує shared query parsing і pagination metadata/UI без зміни archive workflow.

Project-detail document/comment tabs залишаються bounded detail queries (comment lists мають safety cap 100). Окремі URL pagination controls для цих вкладок — follow-up, щоб не розширювати routing refactor цієї зміни; глобальні document і comment lists уже повністю server-side paginated.

## Dashboard statistics and activity

Dashboard кожної ролі показує KPI у власному server-side scope. HEAD використовує одночасно активне `OrganizationMember` і чинну HEAD project-membership policy; ARCHIVIST обмежений активною organization membership; EXPERT, DESIGNER і CLIENT — відповідним `ProjectMember`. Неактивний користувач або неоднозначна organization membership не отримує dashboard data. CLIENT бачить лише активні призначені проєкти, опубліковані погоджені документи та власні непрочитані сповіщення; internal AuditLog, comments, review і archive statistics ізольовані.

Current-state cards позначені «Зараз»: активні/архівовані проєкти, поточні document statuses, відкриті threads, публікації, memberships і unread notifications. Period cards використовують `reviewedAt`, `publishedAt`, `archivedAt` або `DocumentVersion.createdAt` та пояснюють вибраний інтервал. URL-параметр `range=7d|30d|90d|all` є джерелом стану; invalid значення нормалізується до `30d`, а зміна періоду зберігає інші query params.

Internal activity feed використовує bounded AuditLog query (default 20, maximum 50), compact relation selects і trusted role-specific links, побудовані з entity ids. Він ніколи не використовує збережений arbitrary URL і повністю відсутній для CLIENT. Statistics виконуються через Prisma `count`/relation filters; повні набори не завантажуються й per-item queries не виконуються. Для feed та period counts додано additive indexes. Chart dependency навмисно не додавався.

## Rename and infrastructure checklist

Code branding does not rename or migrate external infrastructure automatically. Complete these steps only after code review, commit and push.

### GitHub repository

Rename the repository display/name to `maibud` in GitHub, then update the local remote:

```bash
git remote -v
git remote set-url origin https://github.com/Akerman048/maibud.git
git remote -v
```

### Local folder

Close the development server, IDE terminals and processes that use the repository before renaming the local directory:

```bash
cd ..
mv expert-desk maibud
cd maibud
```

### Vercel and application URLs

- Rename the Vercel project display name manually and verify the intended `maibud.vercel.app` production URL.
- Update `APP_URL`, Auth.js trusted/callback URLs, OAuth callback settings, deployment secrets and any allowed-origin/CORS configuration.
- Verify Resend CTA links use the new `APP_URL`.
- Keep the previous domain until login, callbacks, invitation links and redirects have been verified.

### Neon

- The Neon project display name may be changed manually to `Maibud`.
- The database name may remain `neondb`; a new database is not required for branding.
- Do not commit or copy the connection string into documentation.

### Email and Resend

- Configure a verified production sender separately; examples intentionally use `МайБуд <notifications@example.com>`.
- Update the Resend sender/domain only after DNS verification. Do not start the email worker as part of the rename.

### S3 and CORS

- The current bucket may keep its legacy name. Merely changing `AWS_S3_BUCKET` points the application at a different bucket.
- To adopt a `maibud-*` bucket, create and configure it manually, copy and verify all objects, update bucket CORS/allowed origins, then update the deployment secret.
- Existing `DocumentVersion.objectKey` values must not be rewritten. Do not delete the previous bucket until downloads, previews and uploads have been verified against the new one.

CI/CD test