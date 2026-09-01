# Prompt: Build an “Exceptions” (Payment Plan) Workflow System

Copy everything below the line into another AI to recreate a system equivalent to this product’s **Exceptions** module.

---

## Role

You are a senior full-stack engineer. Build a complete **Exceptions / Payment Plan workflow system** for a real-estate booking operations product (Arabic RTL UI). The system must match the architecture, data model, permissions, UX flows, and business rules described below **exactly**.

Stack assumptions (match these unless told otherwise):

- **Next.js App Router** (Node.js runtime for APIs)
- **MongoDB + Mongoose**
- **Cookie auth** (`userId`)
- **Permission groups** (users belong to groups that hold permission strings + company keys)
- **AWS S3** for attachments (store permanent public object URLs / keys; re-sign only when opening if needed)
- **Email** notifications for workflow create / approve / reject
- **Arabic RTL** UI with Framer Motion for list/detail polish
- Client-side **A4 template overlay**: PNG background + absolutely positioned editable fields; export pages as PNG and upload to S3 on create

Do **not** integrate this module with fund-request vouchers or cash-box reports. It is a **separate EX booking submodule**.

---

## Product summary (what “Exceptions” is)

| Concept | Value |
|--------|--------|
| Arabic product name | الاستثناءات |
| Internal `pageKey` | `"exceptions"` |
| URL list path | `/ex/payment-plan` |
| URL detail path | `/ex/payment-plan/[id]?key=exceptions&company={companyKey}` |
| Mongo model | `PaymentPlan` |
| Purpose | Sales/booking **exception** documented as a **payment schedule** (customer, unit, installment rows, discount) with multi-step approval |
| Enabled company (default) | `Badur-Baghdad` (بدور بغداد) |
| Request code pattern | `EXCEPTIONS-0001`, `EXCEPTIONS-0002`, … |

This form is one card among other EX booking forms (replace booking, waiver, cancel, unit transfer, attachment-only). Exceptions is special because:

1. It is flagged `isPaymentPlan: true`
2. It uses the shared Payment Plan A4 generator + layout editor
3. It is **not** registered like generic EX form pages; it uses dedicated PaymentPlan APIs

---

## High-level user journey

```
EX Home (/ex/ex-home)
  → Company page (/ex/ex-home/Badur-Baghdad)
      → Card “الاستثناءات” (requires EX + EX_EXCEPTIONS)
          → List (/ex/payment-plan?company=Badur-Baghdad)
              ├─ Create (requires EX_Create_Request)
              │     A4 form → render pages → upload PNG to S3 → POST create
              ├─ Tabs: “My requests” / “Pending my approval”
              └─ Detail (/ex/payment-plan/[id]?key=exceptions&company=...)
                    ├─ Preview / Print A4
                    ├─ Workflow timeline
                    └─ Approve / Reject  OR  Operation submit (+ required attachment)

Admin:
  /ex/workflow                 → configure ExWorkflow for pageKey=exceptions
  /ex/payment-plan/layout      → drag/position A4 fields
  /reports/ex                  → include Exceptions in EX reports
```

---

## Permissions model

Use string permission constants (group-based):

| Permission | Purpose |
|------------|---------|
| `EX` | Module gate for Payment Plan **APIs** (list/create/detail actions). Required on server. |
| `EX_EXCEPTIONS` | Shows the Exceptions card on the company EX home. |
| `EX_Create_Request` | Allows **Create** button + access to A4 layout editor. |
| `EX_WORKFLOW` | Create/edit workflow templates (`ExWorkflow`) including `pageKey=exceptions`. |
| `EX_REPORTS` / `VIEW_REPORTS` / `VIEW_ALL_REPORTS` | Include payment plans in EX reports. |
| `OPERATION` | Special actor on a workflow step: must use `operation_submit` with an uploaded attachment (not plain approve). |

Company access:

- Permission groups also store **company keys** (e.g. `Badur-Baghdad`).
- Legacy: if group companies contain only `"EX"`, treat as access to default booking company `Badur-Baghdad`.
- APIs must assert: user may access company **and** `pageKey "exceptions"` is allowed for that company.

Recommended permission matrix for a complete demo:

- Creator: `EX`, `EX_EXCEPTIONS`, `EX_Create_Request`, company `Badur-Baghdad`
- Approver: `EX`, `EX_EXCEPTIONS`, company `Badur-Baghdad` (+ assigned on workflow step)
- Operation clerk: same + `OPERATION`
- Workflow admin: `EX_WORKFLOW`
- Reports: `EX_REPORTS` or `VIEW_REPORTS`

---

## Catalog configuration (company → forms)

Define a booking companies catalog:

```js
DEFAULT_EX_BOOKING_COMPANY = "Badur-Baghdad"

EX_BOOKING_COMPANIES = [
  {
    key: "Badur-Baghdad",
    name: "بدور بغداد",
    logo: "/بدور_بغداد.png",
    formKeys: [
      "replace-booking-transfer",
      "waiver-reservation",
      "cancel-booking-unit",
      "unit-transfer",
      "exceptions",          // ← Exceptions
      "attachment-only",
    ],
  },
]

EX_BOOKING_FORMS_CATALOG entry for exceptions:
{
  key: "exceptions",
  name: "الاستثناءات",
  desc: "نماذج وخطط الدفع الخاصة بالاستثناءات والمتابعة.",
  permission: "EX_EXCEPTIONS",
  listPath: "payment-plan",
  isPaymentPlan: true,
}
```

Rule: a form card appears only if:

1. Company allows that `formKeys` entry
2. User has `EX`
3. User has that form’s specific permission (`EX_EXCEPTIONS`)

---

## Data models (Mongoose)

### 1) `PaymentPlan` (main document)

```text
createdBy: String                 // username snapshot
createdById: ObjectId → User

// Header fields (Arabic A4 form)
salesEmp: String                  // sales employee name
customer: String                  // customer name
unitNo: String                    // residential unit number
dateDMY: String                   // date as DD/MM/YYYY (or similar display string)
discount: String                  // discount text/amount
signature: String                 // optional / often unused in create UI

rows: [{
  payType: String,                // installment / payment name
  amount: String,                 // money as formatted string
  payDateYMD: String,             // YYYY-MM-DD
  payPercent: String,             // percentage string
}]

pageKey: String = "exceptions"
exCompanyKey: String = "Badur-Baghdad" (indexed)

workflow: {
  key: String,                    // usually "exceptions"
  name: String,                   // template name snapshot
  steps: [{
    users: [ObjectId → User],
    status: "Pending" | "Approved" | "Rejected" | "Cancelled",
    actedBy: ObjectId → User | null,
    actedAt: Date | null,
    comment: String,
    tag: String,                  // convenience: first attachment URL or marker
    tagAttachments: [{
      key, name, type, size, url, uploadedAt
    }]
  }]
}

status: "Pending" | "Approved" | "Rejected"   // document-level
currentStep: Number                           // 0..n-1 while open; -1 when closed

attachments: [{ key, name, type, size, url }] // request-level A4 PNG pages from create
requestCode: String                           // sparse unique, e.g. EXCEPTIONS-0001

timestamps: createdAt, updatedAt
```

### 2) `ExWorkflow` (template, reusable across EX forms)

```text
name: String (required)
pageKey: String (required)        // "exceptions"
code: String                      // optional discriminator; unique with pageKey
steps: [{ users: [ObjectId] }]
finalApproveEmails: [String]      // notified on final approve/reject

unique index: (pageKey, code)
```

On PaymentPlan **create**, copy template steps into an embedded workflow with all steps `Pending`, empty comments/attachments.

### 3) `PaymentPlanLayout` (A4 field positions)

```text
templateKey: String unique = "payment-plan-a4"
fields: [{
  key, top, left, width, height, fontSize, fontWeight, textAlign
}]
tableRowHeight: Number
updatedBy: ObjectId
```

Merge saved layout with default template positions at render time.

### 4) Request code counter

- Key pattern: `EX_REQ_{COMPANY}_{PAGEKEY}` (e.g. `EX_REQ_BADUR-BAGHDAD_EXCEPTIONS`)
- Output: `EXCEPTIONS-####` zero-padded
- On duplicate key collision for `requestCode`, retry generation (up to ~5 attempts)

---

## A4 template & create UX

### Template assets

- Background image: `/payment-plan-a4.jpg` (A4 portrait aspect `210/297`)
- Default max rows per page: **15**
- Default table row height (~2.75% of page height)
- Field keys include at least:
  - Header: `salesEmp`, `date`, `customer`, `unitNo`, `discount` (if used)
  - Table anchors/columns: `tableStartTop`, `colPayName`, `colDate`, `colAmount`, `colPercent`
- Positions are **percentages** relative to the page box (RTL-friendly)

### Create flow (client)

1. User opens create modal/generator on `/ex/payment-plan`
2. Fills header + installment rows (money formatting helpers)
3. Client renders one or more A4 pages onto canvas / HTML overlay
4. Export each page as PNG
5. Upload to S3 (presigned PUT or multipart for large files)
6. `POST /api/ex/payment-plans?company=Badur-Baghdad` with:
   - header fields
   - `rows`
   - `attachments` (S3 keys + metadata)
   - `pageKey: "exceptions"`

### Layout editor

- Route: `/ex/payment-plan/layout`
- Drag fields on canvas; save via `/api/ex/payment-plan-layout`
- Title in UI can say “ترتيب قالب الاستثناءات”

---

## API contracts

All routes: `runtime = "nodejs"`, auth via cookie `userId`.

### `GET /api/ex/payment-plans?company=`

- Requires `EX`
- Assert company access + `exceptions` pageKey allowed
- Return plans for company sorted `createdAt desc`
- Populate `createdById` lightly
- Rebuild public attachment URLs from S3 key

### `POST /api/ex/payment-plans?company=`

- Requires `EX`
- Reject empty payload (`EMPTY_PAYLOAD`) if customer, unitNo, rows, and attachments are all empty
- Build workflow from `ExWorkflow` where `pageKey` matches (`exceptions`)
- Set `status=Pending`, `currentStep=0` if steps exist else `-1`
- Generate `requestCode`
- Copy request `attachments` onto **step 0** as `tagAttachments` (+ `tag` = first URL)
- Email step-1 assignees: “created / waiting your action”
- Deep link should point to the real detail route (prefer `/ex/payment-plan/{id}?key=exceptions&company=...`)

### `GET /api/ex/payment-plans/[id]?key=&company=`

- Auth + company match
- Ensure workflow exists (rebuild only if missing/empty — never wipe an in-progress workflow)
- Populate step users + actedBy
- Sanitize attachments by viewer role:
  - Creator always sees request attachments
  - Step attachments visible to assignees of current step / actors of past steps (implement explicit policy)

### `PUT /api/ex/payment-plans/[id]?key=&company=`

Body:

```json
{
  "action": "approve" | "reject" | "operation_submit",
  "note": "optional comment",
  "stepIndex": 0,
  "attachmentMeta": { "key": "...", "name": "...", "type": "...", "size": 0, "url": "..." }
}
```

Rules:

1. Document must belong to company.
2. `currentStep !== -1` else `Request is closed`.
3. Actor must be listed in `workflow.steps[currentStep].users`.
4. Client `stepIndex` must equal server `currentStep` else `409` (stale UI).
5. If actor has `OPERATION` and chooses `operation_submit`, **attachmentMeta.key is required**.
6. **Approve / operation_submit**:
   - Mark current step `Approved`, set `actedBy`, `actedAt`, `comment`
   - If last step: document `Approved`, `currentStep=-1`; email creator + `finalApproveEmails`
   - Else: advance `currentStep++`; prepare next step Pending; carry/merge attachments according to policy:
     - Normal approve: pass current step attachments forward to next step
     - Operation submit: attach operation file to current/next step as designed
   - Email next step users
7. **Reject**:
   - Current step `Rejected`
   - Document `Rejected`, `currentStep=-1`
   - Email creator + final emails

### Workflow admin APIs

- `/api/ex/workflow` CRUD with `EX_WORKFLOW`
- Must allow `pageKey === "exceptions"`

### Layout APIs

- `GET/POST /api/ex/payment-plan-layout`
- Allowed for `EX` or `EX_Create_Request` or report admins

### Reports

- `/api/reports/ex` includes PaymentPlan docs labeled الاستثناءات
- Filterable by form key `payment-plan` / `exceptions`

---

## List page UX requirements

Route: `/ex/payment-plan?company=...`

- Split views:
  - **طلباتي (My requests)**: `createdById === me`
  - **بانتظار موافقتي (Pending my approval)**: I am on `steps[currentStep].users` and doc still open
- Status filter on my requests: Pending / Approved / Rejected (/ Cancelled if used)
- Client search across customer, unit, requestCode, salesEmp
- Pending badge counts on EX home should include payment plans
- Status badges with clear colors
- Open detail with query `key=exceptions&company=...`

---

## Detail page UX requirements

- Show request code, status, company, creator, timestamps
- Render A4 preview from stored fields + layout (or from uploaded PNGs)
- Print support
- Workflow timeline:
  - Each step: assignees, status, actor, time, comment
  - Show step attachments when allowed
- Action panel only if I can act on current step:
  - Approvers: Approve / Reject + optional note
  - Operation users: “تم معاينة المرفق” / operation submit + mandatory file upload
- After action: refresh document; disable controls when closed

---

## Email behavior

Use HTML builder with Arabic labels (`docTypeAr: "الاستثناءات"`).

Events:

| Event | Recipients | Subject idea |
|-------|------------|--------------|
| Created | Step 1 users | Payment Plan Waiting Your Action \| Step 1 |
| Approved (not final) | Next step users | Waiting Your Action \| Step N |
| Final approved | Creator + finalApproveEmails | Approved |
| Rejected | Creator + finalApproveEmails | Rejected |

Include deep link, customer name, unit number, actor display name (prefer Arabic name).

Email failures must **not** roll back the DB action (log and continue).

---

## Attachment / S3 rules

- On create, store PNG pages as request `attachments`
- Mirror them onto step 0 `tagAttachments`
- Prefer storing **permanent public object URLs** (or rebuild from key), not long-lived signed URLs in Mongo
- Opening attachments may go through a download/proxy route that signs GetObject if bucket is private
- Sanitize who sees which files (request vs step tags)

---

## Business rules checklist (must implement)

1. Exceptions is an EX booking form, not a fund voucher.
2. `pageKey` defaults to `"exceptions"`.
3. Company scoping via `exCompanyKey` (legacy docs without field count as default company).
4. Empty create payload rejected.
5. Workflow copied from ExWorkflow template at create time.
6. Only current-step assignees can act.
7. Closed when `currentStep === -1`.
8. Optimistic concurrency via matching `stepIndex`.
9. Operation users must upload a file for `operation_submit`.
10. Final emails from template `finalApproveEmails`.
11. Unique sequential `requestCode`.
12. A4 layout editable without changing backend schema of payment fields.
13. Card visibility requires both module + form permission.
14. Reports include this form type.

---

## Suggested file/folder map to generate

```text
lib/exForms/exCompanies.js              # companies + catalog (include exceptions)
lib/exForms/exCompanyAccess.server.js   # assert company + pageKey
lib/exRequestCode.server.js             # EXCEPTIONS-#### counter
lib/ex/paymentPlanTemplate.js           # default A4 positions
lib/ex/paymentPlanLayoutMerge.js
lib/ex/buildPaymentPlanPos.js
lib/ex/formatMoneyInput.js
lib/ex/exAttachmentAccess.js
lib/email/exWorkflowEmail.js

models/PaymentPlan.js
models/PaymentPlanLayout.js
models/ExWorkflow.js

app/ex/ex-home/page.jsx
app/ex/ex-home/[companyKey]/page.jsx
app/ex/payment-plan/page.jsx
app/ex/payment-plan/[id]/page.jsx
app/ex/payment-plan/layout/page.jsx
app/ex/workflow/page.jsx
app/ex/workflow/[id]/page.jsx
app/reports/ex/page.jsx

app/api/ex/payment-plans/route.js
app/api/ex/payment-plans/[id]/route.js
app/api/ex/payment-plan-layout/route.js
app/api/ex/workflow/route.js
app/api/reports/ex/route.js

components/ex/payment-plan.jsx          # create generator
components/ex/PaymentPlanA4Sheets.jsx
components/ex/PaymentPlanLayoutCanvas.jsx
components/ex/PaymentPlanLayoutPanel.jsx
```

---

## Acceptance criteria (demo script)

1. Admin creates ExWorkflow for `pageKey=exceptions` with 2–3 steps and users.
2. Creator opens بدور بغداد → الاستثناءات → Create payment plan with rows + generated A4 PNGs.
3. System assigns `EXCEPTIONS-000X`, status Pending, emails step 1.
4. Step-1 user opens detail, approves → moves to step 2, email sent.
5. Operation user on a step must upload a file to submit.
6. Final approve closes request (`currentStep=-1`, status Approved), emails creator + final emails.
7. Reject closes as Rejected and emails creator.
8. Layout editor changes field positions; new creates use merged layout.
9. Reports list includes الاستثناءات and link to detail.
10. User without `EX_EXCEPTIONS` does not see the card; without `EX` APIs return 403.

---

## Explicit non-goals

- Do not link Exceptions documents to fund requests, vouchers, or daily cash Excel export.
- Do not implement other EX forms unless needed for shared shell (home/workflow/reports).
- Do not use emoji in Excel/A4 templates.
- Do not store expiring signed S3 URLs as the source of truth in Mongo.

---

## Implementation style notes

- Prefer clear Arabic UI labels with English permission keys.
- Keep APIs returning `{ success, data/error }`.
- Use lean queries + selective populate.
- Mark nested workflow paths modified before `save()`.
- Keep create email failures non-fatal.
- Support RTL list/detail pages; keep A4 template coordinates percentage-based.

Build the full vertical slice first (models → create → list → detail approve/reject → emails → layout), then polish UI.
