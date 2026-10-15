# APPLICATION ASSESSMENT REPORT

**Project:** SPC Fund Request (`new-fund-req`)  
**Workspace path:** `/Users/alimushtaq/gdr funds/new-fund-req`  
**Report type:** Consolidated technical & functional assessment  
**Scope:** Source-code review only (no runtime / production-log verification)  
**Code modified for this report:** None  
**Date of underlying review:** October 2026  

### Classification legend used throughout

| Tag | Meaning |
|-----|---------|
| **CONFIRMED ISSUE** | Directly verified in source code |
| **POTENTIAL RISK** | Code suggests a possible issue; needs runtime/infra verification |
| **RECOMMENDATION** | Improvement / best practice; not an existing defect |
| **NOT VERIFIED** | Insufficient evidence in the repository |

---

## 1. Executive Summary

This application is a **Next.js 15 App Router monolith** used for multi-company fund operations: fund requests with multi-step approvals, payment/receipt vouchers (وصولات), cheques, EX booking forms, daily-cash reporting (print + Excel), disbursement tracking, and permissions administration.

**Overall score: 49 / 100.**

The product is **feature-rich and operationally useful**, with substantial domain logic under `lib/` and many money-related APIs that *do* check authentication + Mongo permission groups. However, the assessment found **multiple Critical, confirmed security defects**:

1. Session is an **unsigned `userId` cookie** (raw Mongo ObjectId) — forgeable if an ID is known.
2. Several **mutating / sensitive API routes have no authentication at all**, including permissions CRUD, S3 signed URL generation, request cancellation, and voucher sequence increment.
3. There is **no Next.js middleware**, **zero automated tests**, and **no error monitoring** (console-only logging).

**Verdict for sharing with another technical reviewer:** Treat this as a **working internal/operational system with serious security debt**. It should **not** be considered production-safe until Phase 1 Critical items are closed. Do not equate “missing best practice” (e.g. no Sentry) with a Critical vulnerability; Critical ratings below are reserved for confirmed exploitable or integrity-breaking defects.

---

## 2. Application Overview and Architecture

### 2.1 What the application does

Arabic/RTL-oriented fund operations for Ghadeer / Badur and related companies:

1. Create a company fund request → multi-step approval (`Workflow`) → Approved  
2. Create/link a **Voucher** (صرف/قبض) → track disbursement  
3. Parallel tracks: **EX** booking forms, **cheques**, reports, permissions admin  

Root `/` redirects to `/login` (`app/page.js`).  
Product metadata / layout: `app/layout.js`.

### 2.2 Architectural style

| Layer | Pattern |
|-------|---------|
| Frontend | Next.js App Router pages + large client components; Framer Motion; Tailwind |
| Backend | Next.js Route Handlers under `app/api/**/route.js` (~62 handlers) |
| Data | MongoDB via Mongoose (~24 model files); some routes use raw `db.collection()` |
| Auth | Custom cookie session (`userId`); bcrypt password verify |
| AuthZ | Permission groups in `Permissions` model; constants in `lib/permission.js` |
| Files | AWS S3 (presign / multipart / signed GET) |
| Email | nodemailer (`lib/mailer.js`, workflow email helpers) |
| Deploy | AWS Amplify (`amplify.yml`) + `output: "standalone"` in `next.config.mjs` |

**Absent (verified by search):** `middleware.js` / `middleware.ts`, NextAuth/Auth.js, Redis/queues, GraphQL, Sentry/APM, automated test runner scripts.

### 2.3 High-level request flow

```
Browser → AuthGate (client) → Page UI (permission-gated)
                ↓
         Cookie userId
                ↓
    API route (per-route auth — inconsistent)
                ↓
    MongoDB (Permissions groups + domain collections)
                ↓
    Optional: S3 / SMTP / ExcelJS / HTML print
```

---

## 3. Main Modules and Business Functions

| Module | UI entry points | Primary APIs / libs |
|--------|-----------------|---------------------|
| Auth & users | `/login`, `/register` | `app/api/login`, `logout`, `auth/me`, `users`, `user-permissions` |
| Home hub | `/home` | Permission-gated cards; notification polling |
| Fund requests | `/requests/[company]`, `/new`, `/[id]` | `app/api/requests/*`, `models/Request.js` (dynamic `requests_{company}`) |
| Workflow | `/workflow`, `/workflow/[id]` | `app/api/workflow/*`, `lib/email/workflowEmail.js` |
| Vouchers | `/vouchers`, `/vouchers/view`, `/vouchers/reports` | `app/api/vouchers/*`, `lib/voucher/*` |
| Receipts / disbursement | `/receipts/disbursement` | `app/api/receipts/disbursement-report`, `lib/receipts/*` |
| Cheques | `/cheques/**` | `app/api/cheques/*`, `lib/cheques/*` |
| EX forms | `/ex/**` | `app/api/ex/*`, `lib/exForms/registry.js` |
| Reports | `/reports`, `/reports/ex` | `app/api/reports`, `app/api/reports/ex` |
| Admin | `/admin/*`, `/permissions` | `app/api/admin/*`, `app/api/permissions/*` |
| Files | Client upload helpers | `app/api/upload/*`, `app/api/files/*`, `app/api/download` |

EX form registry keys (verified via `lib/exForms/registry.js`): replace booking transfer, waiver reservation, cancel booking unit, unit transfer, attachment-only (+ payment-plan related flows).

---

## 4. Technology Stack

| Area | Technology (from `package.json` / code) |
|------|----------------------------------------|
| Framework | Next.js **15.5.2**, React **19.1.0**, App Router |
| Language | JavaScript (JSX); no TypeScript app layer |
| Styling | Tailwind CSS 4, Framer Motion, react-icons |
| Database | MongoDB + **mongoose ^8.19.0** (`lib/mongodb.js`) |
| Auth | bcryptjs; httpOnly cookie `userId` |
| Object storage | AWS SDK S3 + presigner (`lib/s3/*`) |
| Email | nodemailer |
| Excel / PDF | exceljs, xlsx, jspdf, pdf-lib, html2canvas, html-to-image |
| Deploy | AWS Amplify (`amplify.yml`), Next `standalone` |
| Env vars referenced | `MONGODB_URI`, `S3_*`, `SMTP_*`, `MAIL_FROM`, `EX_BASE_DOMAIN`, `NODE_ENV`, plus script-only URIs |

---

## 5. Overall Assessment

| Dimension | Judgment |
|-----------|----------|
| Functional completeness | **Strong** for multi-company funds, vouchers, cheques, EX, reporting |
| Security posture | **Weak** — Critical open endpoints + unsigned session |
| Engineering maturity | **Low–moderate** — mega-files, no tests, console logging only |
| Domain modeling | **Moderate–good** — shared utils for voucher doc types / zero-net; permission catalog exists |
| Consistency (screen / print / Excel) | **Mixed** — shared utils help; opening balances and empty-company filters diverge |
| Production readiness | **Not ready** until Phase 1 Critical security closed |

**Overall score: 49/100** (see Section scoring methodology below).

---

## 6. Code Quality Findings

### CQ-01 — Mega / god components  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE (maintainability)  
- **Description:** Several UI files own entire features (thousands of lines), mixing data fetching, permissions, rendering, and export/print orchestration.  
- **Why it matters:** Hard to review, test, and change safely; regressions likely.  
- **Actual risk:** Slower delivery, higher bug rate on reports/vouchers.  
- **Evidence:** Approximate line counts from review:  
  - `app/vouchers/reports/page.jsx` (~2943)  
  - `components/RequestDetails.jsx` (~1984)  
  - `app/vouchers/view/page.jsx` (~1759)  
  - `components/VoucherCanvasDialog.jsx` (~1745)  
  - `lib/voucher/buildDailyCashReportExcel.js` (~2026)  
- **Recommended solution:** Split into route shell + hooks + presentational components; extract export/print orchestration.

### CQ-02 — Duplicate patterns across modules  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Repeated auth cookie reading styles, permission flattening, Arabic amount-in-words, and suggest-dropdown/hook triples.  
- **Evidence:**  
  - Auth: `cookies().get("userId")` vs `lib/auth/getUserIdFromRequest.js`  
  - Amount words: `lib/voucher/utils.js` vs local copy in `components/ex/ReplaceBookingTransferGenerator.jsx`  
  - Suggest: `useVoucherPersonSuggest` / `useVoucherChequeSuggest` / `useVoucherDescSuggest` + matching dropdowns  
- **Recommended solution:** Shared `requireUser` / `requirePermission` helpers; one amount-words module; shared suggest primitive.

### CQ-03 — Dead / unused code  
- **Severity:** Low  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Stub and unused guards reduce clarity.  
- **Evidence:** `lib/currentUser.js` returns `null`; `components/IdleLogoutGuard.jsx` exists but was not imported into the app layout/providers during review.  
- **Recommended solution:** Remove stubs or wire IdleLogoutGuard into `app/layout.js`.

### CQ-04 — Inconsistent API error shapes  
- **Severity:** Low  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Mix of `{ success, error }`, `{ error }`, and responses without HTTP status.  
- **Evidence:** e.g. `app/api/vouchers/next/route.js` uses `{ error }`; `app/api/requests/cancel/route.js` often omits status codes.  
- **Recommended solution:** Standardize envelope + status codes via shared helper.

### CQ-05 — Dual voucher persistence paths  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Create uses Mongoose `Voucher` model; view/edit/delete/reports often use raw `vouchers` collection. Schema validation applies inconsistently.  
- **Evidence:** `app/api/vouchers/route.js` (Mongoose create) vs `app/api/vouchers/view/route.js` (raw collection).  
- **Recommended solution:** Single data-access layer for vouchers.

---

## 7. Architecture Findings

### AR-01 — No global middleware / edge auth  
- **Severity:** High (amplifies other defects; not itself a CVE)  
- **Classification:** CONFIRMED ISSUE  
- **Description:** No `middleware.js`. Security depends entirely on each route handler + client `AuthGate`.  
- **Evidence:** No middleware file in repo; `components/AuthGate.jsx` is client-only and still renders children before redirect.  
- **Why it matters:** Easy to ship a new unprotected API; pages are not server-gated.  
- **Recommended solution:** Add middleware or shared `requireUser` on every route; prefer server-side page protection for sensitive areas.

### AR-02 — Client-heavy authorization UX  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE  
- **Description:** `PermissionContext` polls `/api/user-permissions` every 5s; UI hides buttons based on permissions. Many APIs re-check (good), but some do not (see Security).  
- **Evidence:** `context/PermissionContext.js`.  
- **Recommended solution:** Keep server checks as source of truth; reduce poll frequency; never rely on UI hiding alone.

### AR-03 — Per-company Request collections  
- **Severity:** Low (design choice)  
- **Classification:** RECOMMENDATION / design note  
- **Description:** `getModelForCompany` maps to `requests_{companyKey}` collections. Scales horizontally per company but complicates cross-company queries and admin tooling.  
- **Evidence:** `models/Request.js`.  
- **Recommended solution:** Document the pattern; ensure admin transfer/reconcile tools always resolve the correct collection.

### AR-04 — Secrets surface in `next.config.mjs`  
- **Severity:** Medium  
- **Classification:** POTENTIAL RISK  
- **Description:** `next.config.mjs` `env: { MONGODB_URI, S3_*, SMTP_* }` injects secrets into Next’s env wiring. Depending on Next/build behavior this can widen exposure.  
- **Evidence:** `next.config.mjs` lines defining `env` block.  
- **Actual risk:** Misconfiguration / accidental client exposure (needs build-output verification).  
- **Recommended solution:** Remove `env` block; use server-only `process.env` in Route Handlers.

### AR-05 — No background job framework  
- **Severity:** Low  
- **Classification:** RECOMMENDATION  
- **Description:** No cron/queue workers in-repo. Maintenance via scripts and on-demand admin APIs. Client polling substitutes for push.  
- **Evidence:** No node-cron/Bull/Agenda; polling in home/EX/requests; scripts under `scripts/`.  
- **Recommended solution:** Acceptable for current scale; introduce jobs only if reconciles/backfills need scheduling.

---

## 8. Security Findings

### SEC-01 — Unsigned `userId` cookie (forgeable session)  
- **Severity:** Critical  
- **Classification:** CONFIRMED ISSUE  
- **Description:** After password verify, login sets cookie `userId` to the Mongo `_id` string with httpOnly/sameSite/lax/secure-in-prod, but **no signature**. Any party who can set that cookie to a known ObjectId is that user.  
- **Why it matters:** Undermines all permission checks that trust the cookie.  
- **Actual risk:** Account takeover given known/leaked ObjectIds (often present in API JSON).  
- **Evidence:** `app/api/login/route.js` (`res.cookies.set("userId", userId, …)`); `lib/auth/getUserIdFromRequest.js` reads cookie only.  
- **Recommended solution:** Signed sealed session (e.g. iron-session / JWT with server secret) or server-side session store; rotate on login; shorter maxAge than 1 year.

### SEC-02 — Unauthenticated permissions CRUD  
- **Severity:** Critical  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Duplicate permissions API under dynamic `[userId]` route performs GET/POST/PUT/DELETE on permission groups with **zero** auth checks.  
- **Why it matters:** Attacker can create a group with `MANAGE_PERMISSIONS` and attach any users → full admin takeover.  
- **Evidence:** `app/api/permissions/[userId]/route.js` — `GET`/`POST` (and further methods) call `connectDB` and mutate `Permissions` with no cookie check. Contrast with protected `app/api/permissions/route.js`.  
- **Recommended solution:** Delete this route or require the same `MANAGE_PERMISSIONS` gate as the main permissions API; add auth tests.

### SEC-03 — Unauthenticated S3 signed download (`refresh-url`)  
- **Severity:** Critical  
- **Classification:** CONFIRMED ISSUE  
- **Description:** `POST` accepts `{ key }` and returns a signed GetObject URL with no authentication.  
- **Why it matters:** Anyone who learns or guesses an S3 key can download the object.  
- **Evidence:** `app/api/files/refresh-url/route.js`.  
- **Recommended solution:** Require authenticated session + authorize that the user may access that key (via owning request/voucher/attachment record).

### SEC-04 — Unauthenticated request cancel  
- **Severity:** Critical  
- **Classification:** CONFIRMED ISSUE  
- **Description:** `PUT` with `{ id, company }` sets request `status = "Cancelled"` without cookie or permission.  
- **Evidence:** `app/api/requests/cancel/route.js`.  
- **Recommended solution:** Require user + company permission + valid status transition rules.

### SEC-05 — Unauthenticated voucher sequence increment  
- **Severity:** Critical  
- **Classification:** CONFIRMED ISSUE  
- **Description:** `POST /api/vouchers/next` increments `VoucherCounter` with no auth.  
- **Why it matters:** Sequence gaps, DoS, number theft / operational confusion.  
- **Evidence:** `app/api/vouchers/next/route.js`.  
- **Recommended solution:** Auth + company permission, or remove endpoint if unused by UI (create path already `$inc`s in `POST /api/vouchers`).

### SEC-06 — Logout cookie clear may not match login attributes  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Login may set `domain: ".spc-it.com.iq"` and `secure: true` in production; logout clears `userId` without `domain` or `secure`.  
- **Why it matters:** Browser may keep the domain-scoped cookie → “logout” ineffective.  
- **Evidence:** `app/api/login/route.js` vs `app/api/logout/route.js`.  
- **Recommended solution:** Clear cookie with the same `path`, `domain`, and `secure` attributes used when setting it.

### SEC-07 — Authenticated S3 IDOR on download helpers  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Logged-in users can request signed URLs / redirects for arbitrary keys without object-level ACL.  
- **Evidence:** `app/api/files/download-url/route.js`, `app/api/download/route.js` (also open-redirect risk when falling back to arbitrary `url` query).  
- **Recommended solution:** Authorize key against document ownership / company permissions; disallow arbitrary redirect URLs.

### SEC-08 — Upload endpoints: auth without authorization  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Presign/multipart require cookie presence but not a specific permission; client influences prefix; weak path sanitization (no `..` rejection noted).  
- **Evidence:** `app/api/upload/presign/route.js`, `app/api/upload/multipart/route.js`, `lib/s3/s3Env.js`.  
- **Recommended solution:** Permission gate; allowlisted prefixes; content-type allowlist; strip `..`; shorter URL TTL.

### SEC-09 — `workflow/notify` lacks cookie auth pattern  
- **Severity:** High (as open mail surface) / status depends on whether `Request` resolves  
- **Classification:** CONFIRMED ISSUE (no auth in handler); runtime mail success **POTENTIAL**  
- **Evidence:** `app/api/workflow/notify/route.js` — no cookie check observed.  
- **Recommended solution:** Require auth + permission; rate-limit; never accept arbitrary recipients without server-side lookup.

### SEC-10 — CSRF tokens absent  
- **Severity:** Medium  
- **Classification:** POTENTIAL RISK / partial mitigation present  
- **Description:** No CSRF tokens or Origin checks. Cookie uses `sameSite: "lax"`, which mitigates many cross-site POSTs in modern browsers but is not a full CSRF strategy.  
- **Evidence:** Login cookie options; no CSRF middleware/tokens found.  
- **Recommended solution:** Keep SameSite; add Origin checks for state-changing routes; prefer non-simple methods.

### SEC-11 — Hardcoded secrets in source  
- **Severity:** N/A as vulnerability  
- **Classification:** NOT VERIFIED as present — **none found** in JS/JSX for AWS keys / Mongo URIs / JWT secrets. Credentials come from `process.env`.  
- **Note:** This is a positive finding, not a defect.

### SEC-12 — Public S3 bucket assumption  
- **Severity:** Medium  
- **Classification:** POTENTIAL RISK  
- **Description:** Code builds/publicly assumes GET URLs in places (`buildPublicS3Url` pattern noted in review). Actual bucket policy is **NOT VERIFIED**.  
- **Recommended solution:** Confirm bucket is private; serve only via short-lived signed URLs.

---

## 9. Authentication and Authorization Findings

### AA-01 — Session design (see SEC-01)  
Critical confirmed.

### AA-02 — Long-lived sessions (1 year)  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE (policy weakness)  
- **Evidence:** `maxAge: 60 * 60 * 24 * 365` in `app/api/login/route.js`.  
- **Recommended solution:** Shorter session + refresh; idle timeout (mount `IdleLogoutGuard`).

### AA-03 — Disabled-user enforcement incomplete  
- **Severity:** Medium  
- **Classification:** POTENTIAL RISK  
- **Description:** Review noted `isActive`-style checks primarily around user-permissions loading; most APIs trust cookie alone. Exact `User` schema field coverage should be re-checked when implementing fixes.  
- **Recommended solution:** Central `requireActiveUser` on every protected route.

### AA-04 — AuthGate is client-only  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE  
- **Evidence:** `components/AuthGate.jsx`.  
- **Recommended solution:** Server-side redirects / middleware for authenticated sections.

### AA-05 — Dual user identity contexts  
- **Severity:** Low  
- **Classification:** RECOMMENDATION  
- **Evidence:** `context/UserContext.jsx` + `context/PermissionContext.js` both hold user-ish state.  
- **Recommended solution:** Single source of truth.

---

## 10. Permissions and Access-Control Findings

### PAC-01 — Permission model (positive baseline)  
- **Classification:** Well-implemented area (see §21)  
- **Evidence:** `lib/permission.js` (`PERMISSIONS`, labels); `models/Permissions.js` groups with `permissions[]` + `users[]`; many voucher/cheque/receipt routes flatten groups and check keys.

### PAC-02 — Excel export company filtering (recent improvement)  
- **Classification:** CONFIRMED ISSUE previously; **mitigated in current code** for Excel  
- **Evidence:** `app/api/vouchers/reports/export/route.js` builds `allowedCompanyKeys` and passes into `buildDailyCashReportWorkbook` / `listExportCompanyKeys`.  
- **Note:** Still special-cases username `mohaemn.ali` for sub-fund exclusion — see TD-02.

### PAC-03 — Print empty companies ignore allow-list  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Description:** When `includeEmpty` is true, print package builders iterate `COMPANIES` without intersecting user-allowed company keys (unlike Excel export).  
- **Why it matters:** User can generate empty daily forms for companies they cannot access.  
- **Evidence:** `lib/voucher/dailyCashPrint.js` (`listDailyCashPrintCompanies` / `buildDailyCashPrintPackages` with `includeEmpty`); UI enables `includeEmpty: true` from `app/vouchers/reports/page.jsx`.  
- **Recommended solution:** Pass `allowedCompanyKeys` into print builders (parity with Excel).

### PAC-04 — Suggest endpoints cross-company scoping  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE  
- **Description:** `person-suggest` / `desc-suggest` require a general voucher/receipts-style permission but do not prove the caller may access the optional `companyKey`; omitting companyKey scans broadly.  
- **Evidence:** `app/api/vouchers/person-suggest/route.js`, `app/api/vouchers/desc-suggest/route.js`.  
- **Recommended solution:** Restrict query to caller’s allowed company keys always.

### PAC-05 — Cheques are permission-global, not ownership-scoped  
- **Severity:** Medium (may be intentional)  
- **Classification:** CONFIRMED ISSUE / product decision  
- **Evidence:** `lib/cheques/chequeAuth.js`; `app/api/cheques/[id]/route.js`.  
- **Recommended solution:** Document as intentional shared pool, or add ownership/company scoping if required.

### PAC-06 — Open permissions/[userId] (see SEC-02)  
Critical confirmed — breaks the entire PAC model.

### PAC-07 — `company-actions` company list IDOR  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE (from review sampling)  
- **Evidence:** `app/api/company-actions/route.js` — authenticated user can pass company lists without full membership proof.  
- **Recommended solution:** Intersect requested companies with allowed set.

---

## 11. Database and Data-Integrity Findings

### DB-01 — Voucher indexes (baseline good)  
- **Classification:** Positive / CONFIRMED  
- **Evidence:** `models/Voucher.js` — indexes on `companyKey`, `mode`, `seq`, unique `{ companyKey, mode, seq }`, `requestId`, `chequeId`, etc.

### DB-02 — Missing unique constraint on request linkage  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE (schema gap enabling race)  
- **Description:** Create path check-then-insert via `findVoucherForRequest` without unique `{ requestId, mode }`. Concurrent creates can duplicate.  
- **Evidence:** `models/Voucher.js` (no such unique); `app/api/vouchers/route.js` POST flow; `lib/voucher/findVoucherForRequest.js`.  
- **Recommended solution:** Unique partial index on `{ requestId, mode }` where requestId exists; wrap create in transaction.

### DB-03 — Non-transactional counter then create  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Description:** `$inc` then `Voucher.create`; create failure leaves permanent sequence gap.  
- **Evidence:** `app/api/vouchers/route.js` POST.  
- **Recommended solution:** Transaction or allocate seq inside the same transactional unit as insert; handle duplicate-key retries.

### DB-04 — Report queries use computed effective date  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE (performance/integrity of filtering)  
- **Evidence:** `app/api/vouchers/reports/route.js` uses `$addFields` for `_effDate` — not a stored indexed field.  
- **Recommended solution:** Persist `effectiveDate` on write; index `{ companyKey, effectiveDate }`.

### DB-05 — Dual mongoose vs raw access drift  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE  
- **Evidence:** See CQ-05. Raw updates can set fields absent from schema (`attachments`, `updatedBy`, legacy amount fields).  
- **Recommended solution:** Expand schema + single DAL.

### DB-06 — Live Atlas indexes beyond schema  
- **Classification:** NOT VERIFIED  
- **Recommended solution:** Export `getIndexes()` from production for vouchers/requests collections.

### DB-07 — Delete clears request using voucher company collection  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Description:** On voucher delete, request clear uses `getModelForCompany(companyKey)` where `companyKey` is the voucher fund, not necessarily `requestCompanyKey`.  
- **Evidence:** `app/api/vouchers/view/route.js` DELETE path (review citation ~552–553).  
- **Recommended solution:** Resolve request model via `requestCompanyKey` when present.

---

## 12. Business Logic Findings

### BL-01 — Request-modal voucher edit path broken  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Description:** `VoucherModal` save uses `PUT /api/vouchers`, but `app/api/vouchers/route.js` exports only `GET` and `POST`.  
- **Evidence:** `components/VoucherModal.jsx` (`saveEditedVoucher`); `app/api/vouchers/route.js` export list.  
- **Note:** Partially masked because fields may lock after create (`isLockedAfterCreate`), but the route is still wrong.  
- **Recommended solution:** Implement PUT with same auth as view, or point modal to `PUT /api/vouchers/view`.

### BL-02 — Concurrent duplicate vouchers per request  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE (race)  
- **Evidence:** Check-then-act without unique index (DB-02).  
- **Recommended solution:** Unique index + handle duplicate key as “already exists”.

### BL-03 — Edit after disbursement not locked  
- **Severity:** Medium  
- **Classification:** RECOMMENDATION / soft gap  
- **Description:** View PUT allows rewriting voucher fields with company permission; no hard “posted/locked” state observed.  
- **Evidence:** `app/api/vouchers/view/route.js` PUT.  
- **Recommended solution:** If business requires immutability after print/disbursement, add status locks + audit log.

### BL-04 — Zero-net / cheque settlement rules shared  
- **Classification:** Positive  
- **Evidence:** `lib/voucher/utils.js` (`isZeroNetVoucher`, `getVoucherDocType`) used by Excel and print.

### BL-05 — `normalizeMode` default mismatch print vs Excel  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Missing/legacy `mode` defaults to **payment** in print helper and **receipt** in Excel helper.  
- **Evidence:** `lib/voucher/dailyCashPrint.js` vs `lib/voucher/buildDailyCashReportExcel.js` `normalizeMode`.  
- **Recommended solution:** Single shared normalizer; fail closed on unknown mode.

### BL-06 — Non–Al-Ghadeer EUR remapped to IQD columns  
- **Severity:** Low–Medium  
- **Classification:** CONFIRMED ISSUE (product behavior — confirm with business)  
- **Evidence:** Print `mapVoucherPrintRow` and Excel `writeDataRow` remap EUR to IQD for non–Al-Ghadeer.  
- **Recommended solution:** Document; or keep EUR separately if required.

---

## 13. API and Backend Findings

### API-01 — Critical open routes (SEC-02..05)  
See Security section.

### API-02 — Stronger routes exist (positive contrast)  
Examples that **do** check cookie + permissions (confirmed pattern):  
- `app/api/vouchers/route.js`  
- `app/api/vouchers/view/route.js`  
- `app/api/vouchers/reports/route.js`  
- `app/api/vouchers/reports/export/route.js`  
- `app/api/receipts/disbursement-report/route.js`  
- Cheque routes via `lib/cheques/chequeAuth.js`  

### API-03 — Maintenance endpoints  
- **Classification:** Mixed  
- **Evidence:** `app/api/test`, `migrate`, `smtp-test` reported as returning 403 when disabled (good). Keep them disabled in production Amplify env.  
- **Admin reconcile / cheque-backfill:** require confirming auth gates before exposing publicly (**spot-check recommended** — treat unreviewed admin routes as **POTENTIAL RISK** until individually audited).

### API-04 — Email failures often swallowed  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE (reliability)  
- **Description:** Workflow/EX approve paths may log mail errors but still return success.  
- **Evidence:** Pattern noted in EX/workflow email send sites (`lib/email/*`).  
- **Recommended solution:** Surface mail failure to UI/ops; retry queue optional.

---

## 14. Frontend / UI / UX Findings

### UI-01 — Arabic-first operational UX (positive)  
Empty states, toasts, glass cards, voucher canvas, cheque editors — generally strong for daily operators.

### UI-02 — RTL inconsistency  
- **Severity:** Low–Medium  
- **Classification:** CONFIRMED ISSUE  
- **Evidence:** Root `app/layout.js` uses `lang="en"`; many modules set `dir="rtl"` locally (cheques, EX, parts of vouchers/requests).  
- **Recommended solution:** App-level RTL strategy for Arabic locales.

### UI-03 — Loading / empty patterns duplicated  
- **Severity:** Low  
- **Classification:** RECOMMENDATION  
- **Evidence:** `PageLoader` exists but many pages use ad-hoc “جاري التحميل…” strings.  
- **Recommended solution:** Shared EmptyState + PageLoader.

### UI-04 — Idle logout unused  
- **Severity:** Low  
- **Classification:** CONFIRMED ISSUE  
- **Evidence:** `IdleLogoutGuard.jsx` not wired into layout.  
- **Recommended solution:** Mount beside AuthGate.

### UI-05 — Permission gate blank flash  
- **Severity:** Low  
- **Classification:** POTENTIAL RISK / UX  
- **Description:** Client `return null` / redirect can flash blank content.  
- **Recommended solution:** Server redirects or skeleton while permissions load.

---

## 15. Reporting, Excel, and Printing Findings

### REP-01 — Excel permission filtering  
- **Classification:** CONFIRMED (current code enforces allow-list)  
- **Evidence:** `app/api/vouchers/reports/export/route.js` + `listExportCompanyKeys` in `lib/voucher/buildDailyCashReportExcel.js`.  
- **Note:** Previously missing; now present. Keep regression tests.

### REP-02 — Excel empty sheets for allowed companies  
- **Classification:** Intentional behavior (CONFIRMED)  
- **Evidence:** Builder creates a sheet per allowed key even with zero vouchers; empty-form gated by `MANAGE_PERMISSIONS`.

### REP-03 — Opening balances: print vs Excel inconsistency  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Description:** Print modal collects previous IQD/USD/(EUR) balances and includes them in totals; Excel workbook paints previous balances as **0** unless manually edited in the file.  
- **Evidence:** `app/vouchers/reports/page.jsx` print modal → `dailyCashPrint` `prevBalances`; Excel `paintFormSheet` / `fillSheet` defaults.  
- **Why it matters:** Same “daily cash” product yields different totals.  
- **Recommended solution:** Pass opening balances into Excel builder from the same UI.

### REP-04 — Print empty companies without permission filter  
- **Severity:** High  
- **Classification:** CONFIRMED ISSUE  
- **Evidence:** See PAC-03 / `lib/voucher/dailyCashPrint.js`.

### REP-05 — Print font preferences  
- **Classification:** Positive / CONFIRMED implemented  
- **Evidence:** `models/VoucherDailyPrintPrefs.js`; `app/api/vouchers/reports/print-prefs/route.js`; UI in reports page; CSS in `dailyCashPrint.js` (`tableBodyFontCss`, fixed page geometry).  
- **Behavior:** Global font size + bold; form size fixed; save does not auto-print.

### REP-06 — Client load-all-for-export  
- **Severity:** High (performance)  
- **Classification:** CONFIRMED ISSUE  
- **Description:** `fetchAllForExport` pages through API at pageSize 200 into browser memory, then POSTs the full array for Excel/print.  
- **Evidence:** `app/vouchers/reports/page.jsx`.  
- **Recommended solution:** Server-side export from filters; stream or chunk; avoid round-tripping all rows through the client.

### REP-07 — In-memory Excel + logos  
- **Severity:** Medium  
- **Classification:** CONFIRMED ISSUE (scalability)  
- **Evidence:** `buildDailyCashReportExcel.js` — ExcelJS workbook, `readFileSync` logos, `ensureCapacity` row splicing.  
- **Recommended solution:** Cap companies per export; optimize image embedding; consider worker for large jobs.

### REP-08 — Hardcoded username exclusion  
- **Severity:** Low  
- **Classification:** CONFIRMED ISSUE (policy smell)  
- **Evidence:** `excludeSubFunds` when username `mohaemn.ali` in export route.  
- **Recommended solution:** Permission flag instead of username.

### REP-09 — Single voucher form Excel  
- **Classification:** Positive baseline  
- **Evidence:** `GET /api/vouchers/export-form` → `lib/voucher/buildVoucherFormExcel.js` with company permission checks similar to view.

---

## 16. Performance and Scalability Findings

| ID | Severity | Classification | Finding | Evidence | Recommendation |
|----|----------|----------------|---------|----------|----------------|
| PF-01 | High | CONFIRMED | Client load-all export | `reports/page.jsx` `fetchAllForExport` | Server export |
| PF-02 | Medium | CONFIRMED | PermissionContext 5s poll | `PermissionContext.js` | Longer interval / push |
| PF-03 | Medium | CONFIRMED | Home/EX notification polling ~30s | home / ex-home pages | SSE/websockets optional |
| PF-04 | Medium | CONFIRMED | Report `$regex` + computed date | `vouchers/reports/route.js` | Stored date + indexes |
| PF-05 | Medium | CONFIRMED | Suggest scans limit 250 | person/desc suggest | Cap + company index |
| PF-06 | Low | RECOMMENDATION | No caching layer | — | Cache permissions briefly server-side |

No Redis/CDN caching layer observed. Horizontal scaling of Next is feasible (stateless), but Mongo query patterns and Excel memory dominate.

---

## 17. Error Handling and Reliability Findings

| ID | Severity | Classification | Finding | Evidence | Recommendation |
|----|----------|----------------|---------|----------|----------------|
| ER-01 | High | CONFIRMED | Open cancel/next corrupt ops data | cancel + vouchers/next | Auth lock |
| ER-02 | Medium | CONFIRMED | console-only logging | Widespread `console.error` | Structured logger + Sentry |
| ER-03 | Medium | CONFIRMED | Mail failures swallowed | workflow/EX email paths | Surface failures |
| ER-04 | Medium | CONFIRMED | Partial voucher create (seq gap) | POST vouchers | Transactions |
| ER-05 | Low | RECOMMENDATION | Inconsistent error JSON | Various routes | Shared helper |
| ER-06 | — | NOT VERIFIED | Production crash rates / uptime | Needs APM | Add monitoring |

---

## 18. Testing and Test-Coverage Findings

### TEST-01 — Zero automated tests  
- **Severity:** High (engineering risk; not a runtime vuln)  
- **Classification:** CONFIRMED ISSUE  
- **Evidence:** Glob for `*.test.*` / `*.spec.*` / `__tests__` → **0 files**; `package.json` scripts: `dev`, `build`, `start`, `lint` only; no Jest/Vitest/Playwright/Cypress dependencies for app tests.  
- **Recommended solution:** Start with API integration tests for:  
  1. Auth required on Critical routes  
  2. Permissions/[userId] rejected without MANAGE_PERMISSIONS  
  3. Excel allow-list excludes unauthorized companies  
  4. Print includeEmpty respects allow-list  
  5. Voucher create race / unique requestId  
  6. Cancel requires auth  
  7. Logout clears domain cookie  

---

## 19. Production Readiness Assessment

| Checkpoint | Status |
|------------|--------|
| Feature completeness | Strong |
| Critical security closed | **Fail** (open routes + unsigned session) |
| Auth middleware | **Fail** |
| Secrets management | Partial (env vars OK; `next.config` env risky) |
| Automated tests | **Fail** (none) |
| Monitoring / error tracking | **Fail** (console only) |
| Deploy pipeline | Present (Amplify + standalone) |
| Backups / DR | **NOT VERIFIED** from repo |
| Audit logging of sensitive actions | Weak / not systematically present |
| Idle session controls | Implemented but unused |

**Production readiness score: 38/100.**  
Safe summary for leadership: *Do not expand public exposure until Phase 1 is done.*

---

## 20. Technical Debt

| ID | Item | Classification |
|----|------|----------------|
| TD-01 | Mega UI/Excel files | CONFIRMED |
| TD-02 | Username-based special cases (`mohaemn.ali`) | CONFIRMED |
| TD-03 | Dual voucher DAL (mongoose vs raw) | CONFIRMED |
| TD-04 | Duplicate amount-words / suggest stacks | CONFIRMED |
| TD-05 | Stub `lib/currentUser.js`; unused IdleLogoutGuard | CONFIRMED |
| TD-06 | Dead EUR print/Excel column paths while `withEur: false` | CONFIRMED (dead code) |
| TD-07 | `app/api/register/route.js` reported as `"use client"` under api/ | CONFIRMED confusion / dead surface |
| TD-08 | No shared requireUser helper | CONFIRMED |
| TD-09 | Long 1-year sessions | CONFIRMED policy debt |
| TD-10 | Docs/handbook vs code drift (possible) | POTENTIAL — keep docs updated after security fixes |

---

## 21. Positive / Well-Implemented Areas

1. **Rich domain coverage** — requests, workflow, vouchers, cheques, EX, disbursement, admin tools in one system.  
2. **Permission catalog** — centralized `lib/permission.js` with Arabic labels.  
3. **Many money APIs re-check server permissions** — vouchers create/view/reports/export, receipts disbursement, cheques auth helper.  
4. **Excel export company allow-list** — `allowedCompanyKeys` intersection in export path (important recent hardening).  
5. **Shared voucher business helpers** — doc type / zero-net logic in `lib/voucher/utils.js` reused by print and Excel.  
6. **Print prefs persistence** — per-user font size/bold in Mongo; preview without auto-print; fixed form geometry.  
7. **Suggest UX for names, cheques, descriptions** — improves cashier speed (`VoucherCanvasDialog` + hooks).  
8. **MIB company separation on vouchers UI** — clearer operator navigation.  
9. **Amplify + standalone** — deployable Next output; asset tracing for Excel logos configured in `next.config.mjs`.  
10. **No hardcoded cloud credentials found in source** — env-based configuration.

---

## MASTER FINDINGS TABLE

| ID | Severity | Category | Finding | Risk | Evidence/File | Recommended Action | Class |
|----|----------|----------|---------|------|---------------|--------------------|-------|
| SEC-01 | Critical | Security/Auth | Unsigned `userId` cookie | Session forgery / account takeover | `app/api/login/route.js`, `lib/auth/getUserIdFromRequest.js` | Signed sessions or server session store | CONFIRMED |
| SEC-02 | Critical | Security | Open permissions CRUD | Full privilege escalation | `app/api/permissions/[userId]/route.js` | Auth + `MANAGE_PERMISSIONS` or delete route | CONFIRMED |
| SEC-03 | Critical | Security | Open S3 `refresh-url` | Attachment exfiltration | `app/api/files/refresh-url/route.js` | Auth + object ACL | CONFIRMED |
| SEC-04 | Critical | Security | Open request cancel | Unauthorized cancellations | `app/api/requests/cancel/route.js` | Auth + permission + status rules | CONFIRMED |
| SEC-05 | Critical | Security | Open `vouchers/next` | Seq corruption / DoS | `app/api/vouchers/next/route.js` | Auth or remove | CONFIRMED |
| SEC-06 | High | Auth | Logout cookie mismatch | Sessions survive logout | `app/api/logout/route.js` vs login | Clear with same domain/secure | CONFIRMED |
| SEC-07 | High | Security | Authenticated S3 IDOR | Cross-user file access | `files/download-url`, `download` | Authorize keys; no open redirect | CONFIRMED |
| SEC-08 | High | Security | Upload without authorization | Malware/overwrite / abuse | `upload/presign`, `multipart` | Permission + prefix allowlist | CONFIRMED |
| SEC-09 | High | Security | `workflow/notify` no auth | Mail abuse / data leak | `app/api/workflow/notify/route.js` | Require auth; rate-limit | CONFIRMED |
| SEC-10 | Medium | Security | No CSRF tokens | CSRF in edge cases | Cookie `sameSite=lax` only | Origin checks / tokens | POTENTIAL |
| SEC-12 | Medium | Security | Public S3 URL assumption | Data exposure if bucket public | S3 URL builders | Verify private bucket | POTENTIAL |
| AR-01 | High | Architecture | No middleware | Easy to miss auth on new routes | No `middleware.js` | Add middleware / requireUser | CONFIRMED |
| AR-04 | Medium | Architecture | Secrets in `next.config` env | Leak surface | `next.config.mjs` | Remove env block | POTENTIAL |
| PAC-03 | High | Permissions | Print empty ignores allow-list | Unauthorized company forms | `lib/voucher/dailyCashPrint.js` | Pass `allowedCompanyKeys` | CONFIRMED |
| PAC-04 | Medium | Permissions | Suggest cross-company | PII / description leak | `person-suggest`, `desc-suggest` | Force allowed companies | CONFIRMED |
| PAC-05 | Medium | Permissions | Cheques global by role | Any cheque id RW for CHEQUES users | `chequeAuth.js`, `cheques/[id]` | Document or scope | CONFIRMED |
| PAC-07 | Medium | Permissions | `company-actions` list IDOR | Cross-company notification data | `app/api/company-actions/route.js` | Intersect allow-list | CONFIRMED |
| DB-02 | High | Database | No unique requestId+mode | Duplicate vouchers | `models/Voucher.js` | Unique partial index | CONFIRMED |
| DB-03 | High | Database | Counter then create non-txn | Seq gaps | `app/api/vouchers/route.js` POST | Transactions / retry | CONFIRMED |
| DB-04 | Medium | Database | Computed `_effDate` | Slow/inconsistent filters | `vouchers/reports/route.js` | Persist + index | CONFIRMED |
| DB-05 | Medium | Database | Dual mongoose/raw paths | Schema drift | vouchers route vs view | Single DAL | CONFIRMED |
| DB-07 | High | Data integrity | Delete uses wrong company collection | Request left “processed” | `vouchers/view` DELETE | Use `requestCompanyKey` | CONFIRMED |
| BL-01 | High | Business logic | Missing PUT `/api/vouchers` | Broken edit path | `VoucherModal.jsx`, `vouchers/route.js` | Implement or retarget | CONFIRMED |
| BL-05 | Medium | Business logic | `normalizeMode` defaults differ | Print/Excel mismatch | dailyCashPrint vs Excel builder | Shared normalizer | CONFIRMED |
| REP-03 | High | Reporting | Excel prev balance always 0 | Wrong Excel vs print totals | Excel builder; reports UI | Pass balances to Excel | CONFIRMED |
| REP-06 | High | Performance | Client fetchAllForExport | Memory/timeouts | `reports/page.jsx` | Server-side export | CONFIRMED |
| REP-07 | Medium | Performance | In-memory Excel + logos | High RAM CPU | `buildDailyCashReportExcel.js` | Cap/optimize/worker | CONFIRMED |
| REP-08 | Low | Maintainability | Username special-case | Privilege-by-name | export route `mohaemn.ali` | Permission flag | CONFIRMED |
| CQ-01 | Medium | Code quality | Mega files | Hard maintenance | reports page, RequestDetails, etc. | Split modules | CONFIRMED |
| CQ-02 | Medium | Code quality | Duplicated helpers | Drift | amount-words, auth, suggest | Shared libs | CONFIRMED |
| CQ-03 | Low | Code quality | Dead stubs | Confusion | `currentUser.js`, IdleLogoutGuard | Remove or wire | CONFIRMED |
| UI-02 | Low | UI/UX | RTL inconsistent | Mixed layout | `layout.js` lang=en | App RTL strategy | CONFIRMED |
| UI-04 | Low | UI/UX | Idle logout unused | Long unattended sessions | `IdleLogoutGuard.jsx` | Mount in layout | CONFIRMED |
| TEST-01 | High | Testing | Zero automated tests | Regressions / unsafe refactors | no test files / scripts | Add API + auth tests | CONFIRMED |
| ER-02 | Medium | Reliability | No APM/Sentry | Blind production failures | console only | Add error tracking | RECOMMENDATION* |
| AA-02 | Medium | Auth | 1-year cookie maxAge | Stolen session longevity | login route | Shorter sessions | CONFIRMED |
| PF-02 | Medium | Performance | 5s permission poll | Unnecessary load | PermissionContext | Backoff | CONFIRMED |

\*ER-02 is a **missing best practice** (monitoring). It lowers Reliability/Production scores but is **not** classified as a Critical security vulnerability.

---

## Scoring Table (0–100)

| Area | Score | Brief rationale |
|------|------:|-----------------|
| Architecture | **58** | Domain `lib/` exists; App Router OK; no middleware; mega UI; dual DAL |
| Code Quality | **52** | Works, but duplication + 2–3k LOC files; inconsistent API shapes |
| Security | **28** | Multiple Critical open endpoints + unsigned session dominate |
| Performance | **55** | OK for moderate data; export/print path not scalable |
| Database Design | **60** | Solid voucher unique seq index; missing request uniqueness; computed dates |
| Permissions & Access Control | **48** | Good patterns on many routes; Critical open admin + print gap |
| Business Logic | **62** | Strong domain helpers; races, broken PUT, print/Excel balance mismatch |
| UI/UX | **68** | Strong Arabic operational UX; RTL/loading inconsistency |
| Testing | **15** | Zero automated tests |
| Maintainability | **45** | Hard without tests/splits; special-cases and dual paths |
| Reliability | **42** | Open mutating APIs + no monitoring + partial transactions |
| Production Readiness | **38** | Deploy exists; security/tests/monitoring fail gate |

### Overall Score: **49 / 100**

**How calculated (transparent):**  
Weighted blend emphasizing Security and Production Readiness (highest operational risk), then Permissions/Reliability, then feature quality:

- Security × 0.18 → 5.0  
- Production Readiness × 0.12 → 4.6  
- Permissions × 0.10 → 4.8  
- Reliability × 0.08 → 3.4  
- Architecture × 0.08 → 4.6  
- Business Logic × 0.08 → 5.0  
- Code Quality × 0.07 → 3.6  
- Database × 0.07 → 4.2  
- Performance × 0.06 → 3.3  
- Maintainability × 0.06 → 2.7  
- Testing × 0.05 → 0.8  
- UI/UX × 0.05 → 3.4  

**Sum ≈ 45.4**, then adjusted **+3.6** for demonstrated domain completeness and recent Excel permission hardening → **≈ 49**.

Interpretation: *Useful internal product; must not be treated as hardened production until Phase 1 completes.*

---

## Prioritized Remediation Roadmap

### PHASE 1 — Critical issues  
**Priority:** P0 · **Complexity:** Medium · **Impact:** Prevents takeover / data destruction / seq corruption  

| Work item | Deps |
|-----------|------|
| Lock or delete `app/api/permissions/[userId]/route.js` | None |
| Auth + ACL on `files/refresh-url` | Session design (can do cookie check first) |
| Auth + perms on `requests/cancel` | None |
| Auth or remove `vouchers/next` | None |
| Replace unsigned cookie with signed session | Touches login/logout/getUserId |

**Expected impact:** Eliminates Critical remote abuse paths.  
**Dependencies:** Deploy + invalidate existing cookies after session format change.

---

### PHASE 2 — High-risk security and data-integrity  
**Priority:** P1 · **Complexity:** Medium–High · **Impact:** Stops IDOR, session residue, duplicate money docs  

| Work item | Deps |
|-----------|------|
| Fix logout cookie attributes | Phase 1 session design |
| Object ACL on download-url / download; kill open redirect | Phase 1 auth helper |
| Upload authorization + prefix allowlist | Phase 1 |
| Unique `{requestId, mode}` + create transaction | Schema migration |
| Fix delete to use `requestCompanyKey` | None |
| Print `allowedCompanyKeys` parity with Excel | Reuse export allow-list logic |
| Auth on `workflow/notify` | Phase 1 |

---

### PHASE 3 — Reliability and business-logic improvements  
**Priority:** P1–P2 · **Complexity:** Medium · **Impact:** Correct totals; fewer silent failures  

| Work item | Deps |
|-----------|------|
| Pass opening balances into Excel builder | UI already has print balances |
| Fix `VoucherModal` PUT path | API design |
| Unify `normalizeMode` | Shared util |
| Surface email failures | Optional queue later |
| Enforce disabled users on all APIs | Central requireUser |
| Add Sentry (or similar) + structured logs | RECOMMENDATION but high ops value |

---

### PHASE 4 — Architecture and maintainability  
**Priority:** P2 · **Complexity:** High · **Impact:** Safer future changes  

| Work item | Deps |
|-----------|------|
| Next middleware + shared `requireUser`/`requirePermission` | Phase 1–2 |
| Single voucher data-access layer | Careful migration |
| Split mega pages (reports, RequestDetails, canvas) | None |
| Remove `next.config` secrets `env` block | Verify Amplify still injects env |
| Replace username special-cases with permission flags | Product decision |

---

### PHASE 5 — Performance and scalability  
**Priority:** P2–P3 · **Complexity:** Medium–High · **Impact:** Large-day / multi-company exports  

| Work item | Deps |
|-----------|------|
| Server-side Excel export from filters | Phase 4 helpers helpful |
| Persist + index `effectiveDate` | Migration |
| Reduce permission/notification polling | UX accept longer freshness |
| Cap/optimize Excel images & row expansion | — |

---

### PHASE 6 — UX and optional improvements  
**Priority:** P3 · **Complexity:** Low–Medium · **Impact:** Operator comfort  

| Work item | Deps |
|-----------|------|
| Mount IdleLogoutGuard | Session design |
| App-wide RTL strategy | Design |
| Shared EmptyState / PageLoader | None |
| Document cheque shared-pool auth model | Product |
| Confirm S3 bucket private (infra) | AWS access — NOT VERIFIED in repo |

---

## Appendix A — Key file map (for independent reviewers)

```
app/layout.js
app/api/login/route.js
app/api/logout/route.js
app/api/permissions/route.js
app/api/permissions/[userId]/route.js          ← Critical open
app/api/files/refresh-url/route.js             ← Critical open
app/api/requests/cancel/route.js               ← Critical open
app/api/vouchers/next/route.js                 ← Critical open
app/api/vouchers/route.js
app/api/vouchers/view/route.js
app/api/vouchers/reports/route.js
app/api/vouchers/reports/export/route.js
app/api/vouchers/reports/print-prefs/route.js
app/api/vouchers/person-suggest/route.js
app/api/vouchers/desc-suggest/route.js
lib/auth/getUserIdFromRequest.js
lib/permission.js
lib/voucher/dailyCashPrint.js
lib/voucher/buildDailyCashReportExcel.js
lib/voucher/utils.js
models/Voucher.js
models/VoucherCounter.js
models/VoucherDailyPrintPrefs.js
models/Permissions.js
components/AuthGate.jsx
context/PermissionContext.js
next.config.mjs
amplify.yml
```

## Appendix B — Review limitations

The following were **NOT VERIFIED** from the repository alone:

- Production MongoDB index lists beyond Mongoose schema definitions  
- AWS S3 bucket public-access block / policies  
- Amplify runtime secret values  
- Whether open endpoints have already been abused (needs access logs)  
- Real-world load (p95 latency, export sizes in production)

Where the report says **POTENTIAL RISK**, treat as a hypothesis to validate with runtime/infra evidence—not as a proven exploit.

---

*End of report. Generated for handoff to an independent technical reviewer. No application code was modified to produce this document.*
