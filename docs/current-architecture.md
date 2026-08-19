# Prizren Smart City — Current Architecture Audit (Phase 0)

**Purpose:** Ground-truth inventory of what already exists in the repository, written *before* any Master Spec implementation work begins. This document reflects the **actual code on disk** as of 2026-08-18, not the aspirational plan in `docs/architecture.md` (which was written on 2026-08-08, before Phases 1–12.5 of the *original* build were implemented). No application code was modified to produce this document.

> Note: There is a pre-existing `docs/architecture.md` from an earlier planning pass. It is now partially stale (e.g. it lists `department_staff`/`department_admin` role names in prose but the actual enum matches; it predates Institution model, 2FA, OAuth, votes/comments, notifications, audit log, and the routing service — all of which are already built). This new document supersedes it as the source of truth for "what exists today."

---

## 1. Current Architecture — Summary

The platform is **already a working, fairly mature MVP**, not a greenfield project. It implements a meaningful slice of the Master Spec end-to-end:

```
Citizen (apps/web, Next.js 14)
   │  POST /reports (multipart: photo + description + lat/lng)
   ▼
apps/api (NestJS, TypeScript, single global module graph — no /api/v1 prefix yet)
   │
   ├─ AuthModule            JWT access + httpOnly refresh cookie, bcrypt, TOTP 2FA,
   │                        Google/Apple/Facebook OAuth, email verification, lockout
   ├─ ReportsModule         Create/list/nearby/assign/status/vote/comment/AI-accept
   ├─ RoutingModule         RoutingService.routeByCategory() — category → dept/institution
   ├─ AiModule              Claude (Anthropic) vision classification, Zod-validated
   ├─ CategoriesModule      Flat category list (DB-driven, no admin CRUD UI yet)
   ├─ DepartmentsModule     Flat department list (DB-driven, no admin CRUD UI yet)
   ├─ InstitutionsModule    External org registry (read-only list endpoint)
   ├─ UploadsModule         Cloudinary photo upload + magic-byte validation
   ├─ NotificationsModule   In-app notifications + emits on status-changed event
   ├─ MailModule            Resend / SMTP / dev-log fallback, Albanian templates
   ├─ AnalyticsModule       Summary, by-category, by-department, over-time, SLA buckets
   ├─ TransparencyModule    Public aggregate stats (no PII) for the public transparency page
   ├─ AuditModule           Generic AuditLog write/read service + admin list endpoint
   ├─ AdminModule           Currently just a role-gated ping endpoint (no CRUD screens)
   └─ UsersModule           Profile, staff list, role assignment (SUPER_ADMIN)
   │
   ▼
PostgreSQL 16 + PostGIS (Docker) via Prisma ORM
   - Report.location geography(Point,4326), ST_DWithin nearby + duplicate-radius queries
```

**Frontend:** Next.js 14 App Router, i18n via `next-intl` (Albanian + English present, `sq`/`en`), Tailwind, Radix UI primitives, Mapbox GL for the reports map, Leaflet for the report-location picker, Recharts for admin charts.

**Monorepo:** npm workspaces — `apps/api`, `apps/web`, `packages/shared-types` (hand-written shared DTO/enum types, not Prisma-generated, imported by both apps as `@prizren/shared-types`).

---

## 2. Existing Relevant Files (by concern)

| Concern | Files |
|---|---|
| Bootstrap / global config | `apps/api/src/main.ts`, `apps/api/src/app.module.ts` |
| Prisma schema & migrations | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`, `apps/api/prisma/seed.ts` |
| Auth | `apps/api/src/auth/**` (service, controller, oauth.service, config.service, crypto, strategies/jwt.strategy, guards/{jwt-auth,optional-jwt-auth,roles,google-enabled}, decorators/{current-user,roles}, dto/*) |
| Reports (core incident pipeline) | `apps/api/src/reports/**` (service, controller, sla.ts, dto/*, spec) |
| Routing engine (nascent) | `apps/api/src/routing/routing.service.ts`, `routing.module.ts` |
| AI classification | `apps/api/src/ai/ai-classification.service.ts`, `ai-classification.schema.ts` (+ spec), `ai.module.ts` |
| Categories / Departments / Institutions | `apps/api/src/categories/**`, `apps/api/src/departments/**`, `apps/api/src/institutions/**` |
| Uploads | `apps/api/src/uploads/{cloudinary.service,image-validation,uploads.module}.ts` |
| Notifications / Mail | `apps/api/src/notifications/**`, `apps/api/src/mail/**` |
| Analytics / Transparency | `apps/api/src/analytics/**`, `apps/api/src/transparency/**` |
| Audit | `apps/api/src/audit/**` |
| Admin / Users | `apps/api/src/admin/**`, `apps/api/src/users/**` |
| Events | `apps/api/src/events/status-changed.event.ts` |
| Common/security helpers | `apps/api/src/common/{client-ip,honeypot}.ts` |
| Monitoring | `apps/api/src/monitoring/sentry.ts`, `apps/api/src/health.controller.ts` |
| Shared types | `packages/shared-types/src/index.ts` |
| Web — citizen report flow | `apps/web/app/reports/**`, `apps/web/components/report/{photo-uploader,address-search,step-indicator}.tsx`, `apps/web/components/location-picker-map.tsx` |
| Web — reports map/list | `apps/web/components/reports-map.tsx`, `apps/web/components/reports/*` |
| Web — citizen dashboard | `apps/web/components/account/account-dashboard.tsx`, `apps/web/app/account/page.tsx`, `apps/web/app/notifications/page.tsx` |
| Web — admin/department dashboard | `apps/web/app/admin/page.tsx`, `apps/web/components/admin/{department-bar-chart,reports-over-time-chart}.tsx`, `apps/web/components/category-bar-chart.tsx` |
| Web — transparency (public, no PII) | `apps/web/app/transparency/page.tsx`, `apps/web/components/transparency/transparency-view.tsx` |
| Web — auth screens | `apps/web/app/{login,register,forgot-password,reset-password,verify-email,auth}/**`, `apps/web/components/auth/**` |
| Web — API client | (referenced as `@/lib/api` — `apiFetch`, `ApiError`) |
| Env samples | `.env.example` (root, Docker/Postgres only), `apps/api/.env.example` (full API config) |
| Docker | `docker-compose.yml` (postgres+PostGIS, optional redis profile, optional full API profile), `apps/api/Dockerfile` |
| CI / tooling | `.github/**`, `.husky/**`, `eslint.config.cjs`, `.prettierrc` |
| Existing planning doc | `docs/architecture.md` (superseded by this file for "current state") |

---

## 3. Existing Models (Prisma schema, `apps/api/prisma/schema.prisma`)

| Model | Notes |
|---|---|
| `User` | email/password (bcrypt) + optional `googleId`/`appleId`/`facebookId`; `role` enum; `emailVerified`; TOTP (`totpSecretEnc` encrypted, `totpEnabled`); lockout (`failedLoginCount`, `lockedUntil`); M2M `departments` via `DepartmentStaff` |
| `RefreshToken` | hashed, rotated on use, revocable, supports "remember me" (variable expiry) |
| `AuthToken` | generic token table for `EMAIL_VERIFY` / `PASSWORD_RESET` / `TWO_FACTOR`, hashed + single-use |
| `Institution` | **this is the Master Spec's "Organization"** — `name`, `slug`, `type` (free string: MUNICIPALITY/UTILITY/EMERGENCY today), `contact`, `active`. **No `integrationType`/`integrationStatus` fields yet.** |
| `Department` | `name`, `contact`, `slaHours` (default 48), optional `institutionId` FK, M2M `staff` |
| `Category` | `name`, `departmentId` FK (1 department per category, not the Master Spec's richer `RoutingRule`), `slaHours`, `defaultPriority` |
| `Report` | **this is the Master Spec's "Incident"** — see §5 gap analysis; no `publicId` (uses raw UUID), no external-integration fields, no severity field (uses `priority` only), single `photoUrl`/`photoAfterUrl` (no attachments array) |
| `StatusHistory` | `oldStatus`/`newStatus`/`changedBy`/`changedAt` — lightweight audit trail specific to status transitions (separate from `AuditLog`) |
| `Vote` | citizen upvote, unique per `(reportId, userId)` |
| `Comment` | free-text, one author, no threading |
| `Notification` | `type` (free string), `channel` (free string, currently only `IN_APP` is queried), `read` |
| `AuditLog` | generic `action`/`entityType`/`entityId`/`metadata`(JSON)/`ipAddress` — already the Master Spec's audit log shape, just not yet wired into every mutation (see §11) |

**Enums:** `Role` (`CITIZEN`, `DEPARTMENT_STAFF`, `DEPARTMENT_ADMIN`, `SUPER_ADMIN` — no `EXTERNAL_OPERATOR`/`AUDITOR`/`MUNICIPAL_ADMIN` yet), `AuthTokenType`, `ReportStatus` (8 values, flat — no `SENT_TO_EXTERNAL`/`ACCEPTED`/`CITIZEN_CONFIRMATION`/`CANCELLED`), `Priority` (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL` — Master Spec's 5-tier severity+priority split doesn't exist; there is only one field).

**Migrations applied (chronological):** `init` → `refresh_tokens` → `report_location_postgis` → `google_oauth_fields` → `auth_institutions_status` (this is when `Institution`/`Department.institutionId` were added) → `fix_auth_token_type_enum`.

---

## 4. Existing APIs (no `/api/v1` prefix currently — routes are bare, e.g. `/reports`, `/auth/login`)

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `GET /auth/providers`, `POST /auth/register`, `POST /auth/login`, `POST /auth/2fa/{verify,setup,confirm,disable}`, `POST /auth/{forgot,reset,change}-password`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `GET/POST /auth/{google,apple,facebook}(/callback)`, `POST /auth/refresh`, `POST /auth/logout(-all)` |
| Users | `GET /users/me`, `PATCH /users/me`, `GET /users/staff`, `PATCH /users/:id/role` |
| Reports | `POST /reports`, `GET /reports`, `GET /reports/nearby`, `GET /reports/mine`, `GET /reports/mine/stats`, `GET /reports/:id`, `POST /DELETE /reports/:id/votes`, `GET/POST /reports/:id/comments`, `PATCH /reports/:id/status`, `PATCH /reports/:id/assign`, `POST /reports/:id/photo-after`, `PATCH /reports/:id/ai-classification` |
| Categories | `GET /categories` (read-only) |
| Departments | `GET /departments` (read-only) |
| Institutions | `GET /institutions` (read-only) |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| Analytics | `GET /analytics/{summary,by-category,by-department,by-status,over-time,sla}` |
| Transparency | `GET /transparency` (public, aggregate-only) |
| Audit | (controller exists: `apps/api/src/audit/audit.controller.ts` — role-gated list) |
| Admin | `GET /admin/ping` (placeholder only) |

**Response shape:** Currently **raw JSON** per endpoint (e.g. `ReportDto`, `PaginatedReports { data, meta }`), **not** the Master Spec's `{ success, data, meta, error }` envelope. Errors follow Nest's default `{ statusCode, message, error }` shape.

---

## 5. Existing Authentication & Authorization

- **JWT access token** (15 min, HS256, `JWT_ACCESS_SECRET`) + **httpOnly, `SameSite=Lax`, path-scoped refresh cookie** (rotates on every `/auth/refresh`, revocable, supports persistent "remember me" vs session cookie).
- **Guards:** `JwtAuthGuard`, `OptionalJwtAuthGuard` (populates viewer if present, doesn't 401 if absent — used for public-but-personalized endpoints like `GET /reports/:id`), `RolesGuard` + `@Roles(...)` decorator, `GoogleEnabledGuard`.
- **RBAC today:** 4 roles (`CITIZEN`, `DEPARTMENT_STAFF`, `DEPARTMENT_ADMIN`, `SUPER_ADMIN`). Enforced **in controllers/services** (not just frontend) — e.g. `ReportsService.updateStatus` re-checks `STAFF_ROLES` server-side even though the controller already has `@Roles(...)`.
- **2FA:** TOTP (otplib), encrypted secret at rest (`AUTH_ENCRYPTION_KEY`), optional org-wide `REQUIRE_ADMIN_2FA` enforcement for staff roles.
- **OAuth:** Google (fully wired), Apple (Sign in with Apple, `apple-signin-auth`), Facebook — with CSRF `state` cookie + auto-link-if-verified-email logic.
- **Security already in place:** bcrypt (12 rounds), account lockout (10 failed attempts → 15 min), dummy-compare timing mitigation, honeypot field on public forms (`rejectIfHoneypotFilled`), `@nestjs/throttler` (global 100 req/min + per-route stricter limits on auth/report-creation/voting), Prisma parameterized queries (incl. raw `$queryRaw` using tagged templates, so still parameterized), Sentry error monitoring (`@sentry/node`, opt-in via `SENTRY_DSN`), image upload validation (`assertValidImageUpload`, likely magic-byte/`file-type` based — see `image-validation.ts`).
- **Gaps vs. Master Spec §19:** no `EXTERNAL_OPERATOR`, `AUDITOR`, or dedicated `MUNICIPAL_ADMIN` role; no granular permission strings (`incident:assign`, `routing:manage`, etc.) — authorization is role-based only, not permission-based.

---

## 6. Existing Notification Infrastructure

- `NotificationsService` listens to a single internal event (`REPORT_STATUS_CHANGED_EVENT`, via `@nestjs/event-emitter`) emitted by `ReportsService.updateStatus`/`assign`, and on each change: (a) writes an `IN_APP` `Notification` row, (b) best-effort sends an email via `MailService` (wrapped in try/catch so a mail failure never fails the HTTP request).
- `MailService` provider chain: **Resend → SMTP (nodemailer) → dev console log** (auto-selected by which env vars are set). Fully Albanian-localized HTML/text templates today (verification, password reset/changed, report received, status changed with per-outcome copy for RESOLVED/ASSIGNED/REJECTED).
- **Gaps vs. Master Spec §12–13:** no push/SMS/webhook channels, no template model in the DB (templates are hard-coded TS functions, not admin-editable), no multi-language notification templates yet (architecture note in `docs/architecture.md` mentions English/Turkish/Serbian as future), no `SLA_WARNING`/`SLA_BREACHED` notification events (SLA breach detection exists in analytics as a read-side bucket, but nothing proactively fires notifications on breach).

---

## 7. Existing AI Infrastructure

- `AiClassificationService` (Claude/Anthropic vision, model configurable via `ANTHROPIC_MODEL`, default `claude-haiku-4-5-20251001`). No-ops gracefully (returns `null`) if `ANTHROPIC_API_KEY` is unset — **this is exactly the "mock/adapter until credentials exist" pattern the Master Spec wants**, already implemented for AI (not yet for institutional integrations).
- Fixed category set today: `road_damage | lighting | waste | water | public_space | other` (6 categories — **far fewer** than the Master Spec's ~36-category taxonomy). Output validated with Zod (`ai-classification.schema.ts`), mapped to DB category/department via `AI_CATEGORY_TO_DB_NAME` and to `Priority` via `AI_SEVERITY_TO_PRIORITY`.
- **Deterministic-first behavior already respected in spirit:** classification is stored as a *suggestion* (`aiClassification`/`aiConfidence`) and status flips to `IN_REVIEW` when confidence < `AI_CONFIDENCE_THRESHOLD` (0.6); it does **not** auto-apply category/department/priority until a `DEPARTMENT_ADMIN+` calls `PATCH /reports/:id/ai-classification` with `action: accept|edit`. This matches Master Spec §9's "AI suggestion, routing engine decides" principle, though currently the "routing engine decision" on AI-accept is just `resolveCategoryAndPriority()` inside `ReportsService`, not the dedicated `RoutingService`.
- Duplicate detection exists today (see §9) and is invoked in the same post-create pipeline as AI classification.

---

## 8. Existing GIS / Geolocation Functionality

- **Storage:** `Report.lat`/`lng` (source of truth for reads) **+** `Report.location` (`Unsupported("geography(Point,4326)")`, PostGIS, kept in sync via raw SQL `UPDATE ... SET location = ST_SetSRID(...)` after every insert — no reverse-geocoding abstraction; `address` is citizen-entered/free text, not derived from GPS by the backend).
- **Queries:** `GET /reports/nearby` (`ST_DWithin` + `ST_Distance` ORDER BY, capped at 200 rows) and duplicate-detection (`ST_DWithin` 100m + 48h window, same category) both use raw parameterized SQL directly in `ReportsService` — **there is no `GeoService`/provider abstraction** as the Master Spec's §10 architecture calls for (`GeoService → MockGeoProvider/OpenStreetMapProvider/...`). Geocoding today is 100% client-provided (Mapbox address-search on the web app), not a backend service.
- **Frontend:** `reports-map.tsx` (Mapbox GL, clustering via GeoJSON source, used on `/reports` and reused for the admin heatmap panel), `location-picker-map.tsx` (Leaflet — used only for pin-drop on the report-creation form), `address-search.tsx` (Mapbox geocoding autocomplete client-side).

---

## 9. Existing Dashboard Architecture

- **Citizen:** `apps/web/components/account/account-dashboard.tsx` + `/account` page (profile, 2FA, linked providers) and `/reports/mine`-backed stats via `GET /reports/mine/stats`; report detail (`report-detail-view.tsx`) shows a status timeline (built from `StatusHistory`, not a hardcoded spec-style timeline) plus votes/comments.
- **Staff/Admin (single combined dashboard today, not split by role per Master Spec §9/§21):** `apps/web/app/admin/page.tsx` — one page gated by `isStaff(role)`, with `canAssign` (`DEPARTMENT_ADMIN+`) unlocking assignment dropdowns. Shows: KPI stat cards (total/pending/resolved/avg resolution), SLA bucket cards (overdue/due-soon/on-time from `slaBucket()`), category/department/over-time charts (Recharts), a Mapbox heatmap of the currently filtered reports, and a filterable/sortable table with inline status-change and assign-to-department/staff selects. Polls every 25s (`usePolling`) when not mid-edit.
- **Public transparency:** `/transparency` — aggregate-only (`GET /transparency`), explicitly excludes PII (no `userId`, no names) per the existing privacy stance already documented in `docs/architecture.md` §3.
- **Gap vs. Master Spec §9/§21:** no per-department scoping of the dashboard (a `DEPARTMENT_STAFF` from Department A currently sees the same `/reports` list as everyone, filtered only by whatever the UI's dropdown is set to — there's no server-side "only my department" default/enforcement), no dedicated manager vs. operator vs. external-operator views, no admin CRUD screens for departments/categories/institutions/routing rules/SLA policies/notification templates (Master Spec §20) — those are all read-only list endpoints today, edited only via `prisma/seed.ts` or direct DB access.

---

## 10. Existing Storage / Uploads

- `CloudinaryService` — signed server-side upload only (API secret never reaches the frontend), graceful `ServiceUnavailableException` if unconfigured. Single image per report (`photo`) + optional `photoAfterUrl` (staff-uploaded, required before a report can move to `RESOLVED`). No attachments array, no video support, no S3/Azure/Supabase alternative providers (Master Spec §28 wants a `StorageService` abstraction — today it's Cloudinary-specific, called directly from `ReportsService`).
- `image-validation.ts` (+ spec) — presumably magic-byte/MIME sniffing (uses `file-type` package per `apps/api/package.json`), enforced on both initial photo and photo-after uploads. `MAX_IMAGE_BYTES` constant lives in `create-report.dto.ts`.

---

## 11. Cross-Cutting: What Already Matches the Master Spec vs. What's Missing

### Already aligned (reuse, don't rebuild)
- Audit log model/service shape (`AuditLog`) is essentially what §18 asks for — just needs to be called from more mutation points (routing decisions, integration events, notification sends) once those exist.
- AI-suggestion-not-auto-applied pattern (§9) is already the implemented behavior.
- Institution model is the seed of Organization registry (§4) — needs `integrationType`/`integrationStatus` fields added, not a rewrite.
- RoutingService (§8) exists as a real, separately-injectable service already called from `ReportsService.create` — it's the natural place to grow deterministic rules, it's just currently a single `routeByCategory` lookup with no priority/rule table.
- Mock-first pattern for AI (no-op gracefully without credentials) is exactly the pattern Master Spec §15/§37/§38 wants generalized to institutional integrations.
- SLA computation (`sla.ts`) is already isolated from controllers, computed from `Priority`, configurable per-category/department (`slaHours` fields exist on both) even though `computeDueAt` currently only reads a hardcoded `SLA_MS` map keyed by `Priority` rather than the `Category.slaHours`/`Department.slaHours` values already sitting in the DB — a pre-existing inconsistency worth flagging (see below).
- Duplicate detection (§23) already implemented (GPS+category+time window), though no "master incident + linked reports" grouping UI/model yet — today it's a one-way `duplicateOfId` pointer with no `DUPLICATE` count/priority-boost logic (§24 priority escalation is not implemented).

### Missing / to build per Master Spec phases
- No `RoutingRule` table (rules are implicit/hardcoded as "1 category → 1 department"), no priority-ordered rule evaluation, no emergency/zone/time-based routing.
- No `IntegrationGateway`, no organization adapters (KEDS/Water/Waste/Municipality), no mock institutional APIs, no webhooks, no retry/idempotency/dead-letter system, no `externalReferenceId`/`externalStatus`/`externalSystem` fields on `Report`.
- No `publicId` human-readable incident code (e.g. `PRZ-2026-000184`) — reports are addressed by raw UUID everywhere (URLs, emails, admin table).
- `ReportStatus` enum is missing several Master Spec states (`SENT_TO_EXTERNAL`, `ACCEPTED`, `CITIZEN_CONFIRMATION`, `CANCELLED`) and there is no formal transition-validation matrix — `updateStatus` only rejects "same status," not invalid transitions.
- No queue/async job system — AI classification and email sending happen inline inside the `POST /reports` request handler (`await`ed, not backgrounded), which conflicts with Master Spec §35/§42 ("long-running operations must not block HTTP requests"). This is a real perf/latency risk once AI/institutional calls are added.
- No `/api/v1` prefix or `{ success, data, meta, error }` envelope — would be a breaking change to both `apps/web`'s `apiFetch` client and any external consumers; needs an explicit decision (see Risks).
- No OpenAPI/Swagger docs, no `/docs/*` developer docs beyond `docs/architecture.md`.
- No granular permission system — role-based only.
- No `EXTERNAL_OPERATOR`/`AUDITOR` roles.
- Categories are a flat 9-row seed list in Albanian (Dëmtim rruge, Ndriçim, Mbeturina, Ujë/kanalizim, Hapësirë publike, Elektricitet, Zjarr/emergjencë, Siguri/polici, Tjetër) — far short of the Master Spec's ~36-value taxonomy; AI's own category set (6 values) is a *third*, disconnected taxonomy from both.

---

## 12. Reusable Components (explicit list for Phase 1+)

- `PrismaService`/`PrismaModule` — reuse as-is.
- `AuditService` — reuse and extend call sites.
- `RoutingService` — extend in place (add `RoutingRule` model + priority evaluation) rather than replace.
- `AiClassificationService` + `ai-classification.schema.ts` — reuse the Anthropic client wiring and the "graceful no-op without API key" pattern for any future adapter (institutional or provider).
- `sla.ts` (`computeDueAt`, `slaBucket`, `OPEN_REPORT_STATUSES`, `DUE_SOON_MS`) — reuse and extend to read `Category.slaHours`/`Department.slaHours` instead of (or in addition to) the hardcoded `SLA_MS` map.
- `MailService` provider-fallback pattern (Resend → SMTP → dev-log) — reuse as the template for any future `EmailAdapter`/`NotificationChannel` abstraction.
- `NotificationsService`'s event-driven pattern (`@nestjs/event-emitter`, `REPORT_STATUS_CHANGED_EVENT`) — reuse and add more event types (`REPORT_CREATED`, `SLA_BREACHED`, etc.) rather than polling.
- `CloudinaryService` — reuse behind a new `StorageService` interface (don't replace the underlying provider).
- `JwtAuthGuard`/`OptionalJwtAuthGuard`/`RolesGuard`/`@Roles`/`@CurrentUser` — reuse as-is; extend `Role` enum additively.
- `packages/shared-types` — reuse and extend (append new DTOs; avoid breaking existing exported names since both apps import from here).
- Web: `apiFetch`/`ApiError` client, `usePolling`, `PageContainer`, `StatCard`, chart components, `reports-map.tsx`/`location-picker-map.tsx` — reuse; the admin page's KPI/table/chart layout is a solid base to extend into per-department dashboards rather than rebuilding.

---

## 13. Risks

1. **Breaking-change surface for `/api/v1` + envelope format (§26).** Every existing frontend call in `apps/web` (via `apiFetch`) and any external API consumers assume today's flat JSON responses at bare paths (`/reports`, not `/api/v1/incidents`). Introducing versioning/envelope must either (a) be additive (new `/api/v1/*` routes proxying/aliasing old ones) or (b) be a coordinated, tested cutover of both apps in the same phase. Recommend deferring until explicitly requested, or doing it as an additive alias layer.
2. **Renaming `Report`→`Incident`, `Institution`→`Organization` etc.** would touch dozens of files (Prisma schema, both apps, shared-types) for a cosmetic gain. Recommend keeping current names and treating them as synonyms in documentation (`Report` *is* the Incident; `Institution` *is* the Organization) rather than renaming, to preserve backward compatibility as the spec instructs.
3. **Inline AI/email in the request path.** Adding institutional integration calls (Phase 7/8) the same way (`await`ed inside `create()`) will materially slow down `POST /reports` and risks timeouts. A queue abstraction (Master Spec §35) should be introduced no later than Phase 7, even if the "queue" is initially just an in-process `setImmediate`/event-emitter-based async job runner (matching "don't introduce unnecessary infrastructure" guidance) with a Redis/BullMQ swap-in path (Redis is already available via `docker-compose.yml --profile redis`, currently unused).
4. **Category taxonomy fragmentation.** Three independent category vocabularies exist today: DB `Category` rows (9, Albanian, seed-driven), AI's fixed union (6, English, hardcoded in `ai-classification.schema.ts`), and the Master Spec's ~36-value list. Phase 1/3/4 work must design one mapping layer instead of a fourth parallel list — likely: DB `Category.name` becomes the canonical taxonomy (extended to the Master Spec's list), and AI's output category is treated as a *hint* mapped through `AI_CATEGORY_TO_DB_NAME` (already the existing pattern) into that canonical set.
5. **SLA hours inconsistency.** `Category.slaHours`/`Department.slaHours` already exist and are seeded with real values, but `computeDueAt()` currently ignores them in favor of a hardcoded `Priority`-keyed map. Any SLA Engine work (Phase 5) must reconcile this rather than adding a third source of truth.
6. **No transition-validation matrix today.** Adding the Master Spec's full state machine (§6) on top of the existing 8-value enum risks silently breaking the two existing status-changing call sites (`updateStatus`, `assign`) if the new matrix is stricter than today's "just not equal to current" check. Needs explicit review of every existing valid transition exercised by `reports.service.spec.ts` before tightening.
7. **Routing engine currently 1:1 (category→department).** Introducing a real `RoutingRule` table with priority ordering must preserve the existing `routeByCategory()` call contract used by `ReportsService.create()`, or update that call site in the same change.
8. **No `/api/v1` versioning also means no OpenAPI docs infra yet** (no `@nestjs/swagger` dependency present) — Phase 14 documentation work will need to add this dependency, which is a new (low-risk) addition, not a conflict.

---

## 14. Conflicts With Existing Architecture

- Master Spec's proposed `Incident` field list (§5) overlaps ~80% with the existing `Report` model but adds several fields that don't exist yet (`publicId`, `subcategory`, `source`, `organizationId` as distinct from `departmentId`, `externalReferenceId`/`externalSystem`/`externalStatus`/`externalSubmittedAt`/`externalUpdatedAt`, `assignedAt`/`resolvedAt`/`closedAt` as distinct timestamps, `anonymous`, `language`, `deviceMetadata`, `isDuplicate` boolean distinct from `duplicateOfId`). These are additive Prisma migration changes — no conflict, just a growing model. Recommend adding them incrementally per phase rather than one giant migration.
- Master Spec §7's ~36 categories vs. existing 9 Albanian category rows: **not a structural conflict** (Category is already DB/config-driven per §3's requirement), just a data/seed gap — extending the seed list is sufficient, no schema change needed.
- Master Spec's role list (§19) adds `EXTERNAL_OPERATOR`, `MUNICIPAL_ADMIN`, `AUDITOR` — additive enum change, but every place that currently does `Role[]` allow-lists (e.g. `STAFF_ROLES` in `reports.service.ts`, `auth.service.ts`) must be reviewed so new roles don't accidentally gain or lose access implicitly.
- Master Spec wants permission-string RBAC (`incident:assign`, etc.) layered over roles — the codebase currently only has role checks. Introducing a permission layer is additive if implemented as "roles map to permission sets" rather than replacing the `@Roles()` guard mechanism outright.

---

## 15. Recommended Implementation Order (Phase 1 starting point)

Given the audit above, Phase 1 ("Domain Foundation") is **mostly already done** for `Incident`(`Report`)/`Category`/`Department`/`Organization`(`Institution`)/`AuditLog`, and partially done for `RoutingRule`/`SLA`. Recommend Phase 1 scope be narrowed to:

1. Extend `Institution` with `integrationType` (enum: `EMAIL`/`REST_API`/`WEBHOOK`/`SFTP`/`MANUAL`/`MOCK`) and `integrationStatus` (enum: `NOT_CONFIGURED`/`MOCK`/`TEST`/`ACTIVE`/`DISABLED`), defaulting existing rows to `MANUAL`/`NOT_CONFIGURED` (backward compatible — nullable/defaulted columns).
2. Introduce a `RoutingRule` model (category/subcategory/severity/priority/zone/emergency-flag → departmentId/institutionId, with an integer `priority` for ordering), and extend `RoutingService.routeByCategory()` into a `RoutingService.route(input)` that falls back to the current category→department lookup when no explicit rule matches (preserves the existing call site's behavior/tests).
3. Add `SlaPolicy` model (or extend `Category`/`Department` — needs a decision: Master Spec wants a standalone `SlaPolicy` table with `responseTime`/`resolutionTime`/`departmentId`/`categoryId`/`active`; current schema embeds `slaHours` directly on `Category`/`Department`). Recommend a new `SlaPolicy` table that `computeDueAt()` consults first, falling back to existing `slaHours` fields, to avoid breaking current behavior while enabling the richer model.
4. Add non-breaking `Report`/`Incident` fields needed for later phases (`publicId`, `source`, `anonymous`, `language`, `isDuplicate`) via additive migration, generate `publicId` (`PRZ-YYYY-NNNNNN`) at creation time.
5. Do **not** touch API route paths, response envelope, or rename models in Phase 1 — flagged as a separate, explicit decision (see Risks §13.1–13.2).
6. Extend `AuditLog` call sites to cover routing decisions once `RoutingRule` exists.
7. Seed data: extend `prisma/seed.ts` with additional categories/departments toward the Master Spec's §3/§7 lists (additive, no removals — avoid breaking existing reports that reference current category/department IDs).
8. Unit tests: extend `reports.service.spec.ts`/add `routing.service.spec.ts`/`sla.spec.ts` coverage for the new rule/policy fallback logic.

---

*This document was generated by inspecting the repository only. No application source files were modified.*
