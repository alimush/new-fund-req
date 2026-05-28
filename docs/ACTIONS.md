# دليل حركات النظام — Fund Request (SPC)

مرجع سريع لكل **صفحة**، **API**، **صلاحية**، و**ملف منطق** مهم.  
حدّث هذا الملف عند إضافة route أو وحدة جديدة.

---

## هيكل المشروع

| المجلد | الدور |
|--------|--------|
| `app/` | صفحات Next.js + Route Handlers (`app/api/...`) |
| `components/` | واجهات (طلبات، وصولات، EX، صكوك…) |
| `lib/` | منطق مشترك (صلاحيات، وصولات، تقارير، بريد) |
| `models/` | مخططات MongoDB (Mongoose) |
| `context/` | `PermissionContext`, `UserContext` |

**نقطة الدخول للمستخدم:** `/home`  
**الصلاحيات المركزية:** `lib/permission.js`  
**قوالب الوصولات:** `lib/voucher/companies.js`  
**رئيسي / فرعي للصرف:** `lib/voucher/resolveVoucherCompanyKey.js`

---

## تدفقات العمل الرئيسية

### 1) طلب صرف أموال (شركات الغدير / بدور / …)

```
إنشاء طلب → موافقات (workflow.steps) → معتمد (Approved)
    → إنشاء وصل صرف (Voucher) → ربط بالطلب
    → يظهر في تقرير تتبع الصرف (/receipts/disbursement)
```

| الخطوة | صفحة | API | Collection |
|--------|------|-----|------------|
| إنشاء | `CreateRequestModal` على `/requests/[company]` | `POST /api/requests?company=` | `requests_{company}` |
| عرض/تعديل | `/requests/[company]/[id]` | `GET/PUT /api/requests/[id]` | نفسه |
| موافقة/رفض | `RequestDetails` + `CommentModal` | `PUT /api/requests/[id]` (action في body) | نفسه |
| إلغاء | — | `PUT /api/requests/cancel` | نفسه |
| رفع مرفق | تبويب Attachment | `POST /api/upload/presign` ثم PUT إلى S3 | `attachments[]` على الطلب |
| وصل صرف | زر من `RequestDetails` | `GET/POST /api/vouchers` | `vouchers` |
| حذف وصل | `/vouchers/view` | `DELETE /api/vouchers/view` | `vouchers` |
| تقرير صرف | `/receipts/disbursement` | `GET /api/receipts/disbursement-report` | aggregate على الطلبات |

**ملاحظة تقرير الصرف:** يُعتبر الطلب «مصروف» فقط إذا وُجد وصل فعلي في `vouchers` (الوصل المحذوف لا يظهر كمصروف).

### 2) وصولات مستقلة (بدون طلب)

| الخطوة | صفحة | API |
|--------|------|-----|
| اختيار شركة وطباعة | `/vouchers` | `POST /api/vouchers`, `POST /api/vouchers/next` |
| عرض وصل | `/vouchers/view?id=` | `GET /api/vouchers/view` |
| تقارير وصولات | `/vouchers/reports` | `GET /api/vouchers/reports` |

### 3) تخويل الصرف

| الخطوة | API / ملف |
|--------|-----------|
| تخويل مستخدم على آخر خطوة | `PUT /api/requests/[id]` — `delegate_voucher` |
| صلاحية عرض تقرير التخويل | `VOUCHER_DELEGATE` + `RECEIPTS` |
| منطق التقرير | `buildDelegatedDisbursementPipeline` في `lib/receipts/disbursementReportPipelines.js` |

### 4) طلبات الحجز (EX)

| الخطوة | صفحة | API |
|--------|------|-----|
| الرئيسية | `/ex/ex-home` | — |
| نماذج ديناميكية | `/ex/[pageKey]`, `/ex/[pageKey]/[id]` | `GET/POST /api/ex/[pageKey]`, `GET/PUT .../[id]` |
| workflow EX | `/ex/workflow` | `GET/POST/PUT/DELETE /api/ex/workflow` |
| خطط دفع | `/ex/payment-plan` | `GET/POST /api/ex/payment-plans` |
| تقارير EX | `/reports/ex` | `GET /api/reports/ex` |

### 5) نظام الصكوك

| الخطوة | صفحة | API | صلاحية |
|--------|------|-----|--------|
| قائمة قوالب | `/cheques` | — | `CHEQUES` |
| إصدار صك | `/cheques/[templateKey]` | `POST /api/cheques` | `CHEQUES` |
| تقارير | `/cheques/reports` | `GET /api/cheques/reports` | `CHEQUES` |
| عرض | `/cheques/view?id=` | `GET /api/cheques/[id]` | `CHEQUES` |
| ترتيب الحقول | `ChequeLayoutPanel` | `GET/POST /api/cheques/layout` | `CHEQUES_EDITOR` |

### 6) إدارة النظام

| الوظيفة | صفحة | API | صلاحية |
|---------|------|-----|--------|
| مجموعات صلاحيات | `/permissions`, `/permissions/[id]` | `/api/permissions` | `MANAGE_PERMISSIONS` |
| قوالب موافقة طلبات | `/workflow`, `/workflow/[id]` | `/api/workflow` | `MANAGE_PERMISSIONS` |
| ربط وصل بطلب | `/admin/voucher-links` | `/api/admin/voucher-links` | إدارة |
| وورك فلو طلبات | `/admin/requests-workflow` | `/api/admin/requests-workflow` | إدارة |
| مستخدمين | `/register` | `/api/users`, `/api/register` | `MANAGE_PERMISSIONS` |

---

## منطق وصل رئيسي / فرعي

ملف: `lib/voucher/resolveVoucherCompanyKey.js`

| صلاحية اليوزر | طلبات `Ghadeer-Karbala` | طلبات `Al-Ghadeer` |
|---------------|------------------------|---------------------|
| رئيسي فقط | `Ghadeer-Karbala` | `Al-Ghadeer` |
| فرعي فقط | `Ghadeer-Karbala-Sub` أو `Ghadeer-Investments` | `Ghadeer-Najaf-Sub` |
| رئيسي + فرعي | **رئيسي** يغلب | **رئيسي** يغلب |

- `VOUCHERS_GHADEER_INVESTMENTS` = **فرعي** (قالب `Ghadeer-Investments`)
- `VOUCHERS_GHADEER_KARBALA` = **رئيسي**
- `VOUCHERS_GHADEER_KARBALA_SUB` = **فرعي**

---

## جدول API كامل

### مصادقة وجلسة

| Method | Path | الوظيفة |
|--------|------|---------|
| POST | `/api/login` | تسجيل دخول + cookie `userId` |
| POST | `/api/logout` | تسجيل خروج |
| GET | `/api/auth/me` | بيانات المستخدم الحالي |
| GET | `/api/user-permissions` | صلاحيات + شركات + user |
| GET | `/api/userid` | معرف اليوزر من الكوكي |

### الطلبات (Requests)

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/requests?company=` | قائمة طلبات شركة (+ فلاتر، pending approval…) |
| POST | `/api/requests?company=` | إنشاء طلب |
| PUT | `/api/requests` | تحديث جماعي (حسب الاستخدام) |
| DELETE | `/api/requests` | حذف |
| GET | `/api/requests/[id]?company=` | تفاصيل طلب + URLs مرفقات |
| PUT | `/api/requests/[id]?company=` | تعديل / موافقة / رفض / تخويل صرف |
| PUT | `/api/requests/cancel` | إلغاء طلب |

**Collections:** `requests_al-ghadeer`, `requests_badur-baghdad`, … (حسب `getModelForCompany`)

### الموافقات — قوالب Workflow (إدارة)

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/workflow` | قائمة قوالب الموافقة |
| POST | `/api/workflow` | إنشاء قالب |
| PUT | `/api/workflow` | تعديل قالب |
| DELETE | `/api/workflow` | حذف قالب |
| POST | `/api/workflow/notify` | إشعار بريد لخطوة |
| POST | `/api/workflow/workflow_attach` | مرفق خطوة موافقة |
| PUT | `/api/workflow/workflow_attach` | تحديث مرفق |

**Collection:** `workflows`  
**صلاحية:** `MANAGE_PERMISSIONS`

### الوصولات (Vouchers)

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/vouchers` | جلب وصل مربوط بطلب (أو للمعاينة) |
| POST | `/api/vouchers` | إنشاء وصل + ربط طلب |
| POST | `/api/vouchers/next` | الرقم التالي |
| GET | `/api/vouchers/view` | عرض وصل بالـ id |
| PUT | `/api/vouchers/view` | تعديل وصل / مرفق |
| DELETE | `/api/vouchers/view` | **حذف وصل** |
| GET | `/api/vouchers/reports` | تقرير وصولات |

**Collection:** `vouchers`, `vouchercounters`

### تقارير وتتبع

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/reports` | تقارير الطلبات العامة |
| GET | `/api/reports/ex` | تقارير EX |
| GET | `/api/receipts/disbursement-report` | **تتبع صرف الطلبات** (`?suggest=1`, `?filterUsers=1`) |

### الصكوك (Cheques)

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/cheques` | قائمة (اختياري) |
| POST | `/api/cheques` | حفظ صك |
| GET | `/api/cheques/[id]` | عرض صك |
| GET | `/api/cheques/reports` | تقرير صكوك |
| GET | `/api/cheques/layout` | تخطيط حقول |
| POST | `/api/cheques/layout` | حفظ تخطيط |

### EX

| Method | Path | الوظيفة |
|--------|------|---------|
| GET/POST | `/api/ex/[pageKey]` | قائمة / إنشاء نموذج |
| GET/PUT | `/api/ex/[pageKey]/[id]` | تفاصيل / تعديل |
| GET/POST/PUT/DELETE | `/api/ex/workflow` | workflow حجز |
| GET/POST | `/api/ex/payment-plans` | خطط دفع |
| GET/PUT | `/api/ex/payment-plans/[id]` | تفاصيل خطة |

### صلاحيات ومستخدمين

| Method | Path | الوظيفة |
|--------|------|---------|
| GET/POST/PUT/DELETE | `/api/permissions` | مجموعات الصلاحيات |
| GET/POST/PUT/DELETE | `/api/permissions/[userId]` | تفاصيل مجموعة |
| GET/POST/PUT/DELETE | `/api/users` | مستخدمين |
| POST | `/api/register` | إنشاء مستخدم |

### إدارة

| Method | Path | الوظيفة |
|--------|------|---------|
| GET | `/api/admin/requests-workflow` | طلبات تحتاج إجراء إداري |
| GET/PUT | `/api/admin/requests-workflow/[id]` | تفاصيل / تحديث |
| POST | `/api/admin/requests-workflow/bulk` | عمليات جماعية |
| GET/POST | `/api/admin/voucher-links` | ربط وصل ↔ طلب |
| POST | `/api/admin/reconcile-vouchers` | مطابقة وصولات |

### ملفات وإشعارات

| Method | Path | الوظيفة |
|--------|------|---------|
| POST | `/api/upload/presign` | رابط رفع S3 (`prefix`: `requests/...`, `invoices/...`) |
| POST | `/api/files/refresh-url` | تجديد رابط عرض ملف |
| GET | `/api/download` | تحميل ملف |
| GET | `/api/notifications/counts` | عداد موافقة + صرف للهوم |
| GET/POST | `/api/company-actions` | نشاط الشركات / seen |
| GET | `/api/company-actions` | إشعارات حسب شركة |

### أخرى (تطوير / صيانة)

| Method | Path | الوظيفة |
|--------|------|---------|
| POST | `/api/migrate` | ترحيل بيانات |
| GET | `/api/test` | اختبار |
| GET | `/api/smtp-test` | اختبار بريد |
| GET | `/api/disable-user` | — |

---

## جدول الصفحات (UI)

| المسار | الوظيفة |
|--------|---------|
| `/login` | دخول |
| `/home` | لوحة الشركات + أدوات سريعة |
| `/requests/[company]` | قائمة طلبات |
| `/requests/[company]/[id]` | تفاصيل طلب |
| `/receipts/disbursement` | تتبع صرف الطلبات |
| `/vouchers` | إصدار وصل صرف/قبض |
| `/vouchers/view` | عرض/طباعة وصل |
| `/vouchers/reports` | تقارير وصولات |
| `/reports` | تقارير طلبات |
| `/reports/ex` | تقارير EX |
| `/cheques` | نظام الصكوك |
| `/cheques/[templateKey]` | محرر صك |
| `/cheques/reports` | تقارير صكوك |
| `/cheques/view` | عرض صك |
| `/ex/ex-home` | طلبات الحجز |
| `/ex/[pageKey]` | نماذج EX |
| `/workflow` | إدارة قوالب الموافقة |
| `/permissions` | مجموعات الصلاحيات |
| `/register` | إنشاء مستخدم |
| `/admin/voucher-links` | ربط وصولات |
| `/admin/requests-workflow` | إدارة workflow طلبات |

---

## الصلاحيات — مرجع سريع

التعريف: `lib/permission.js` — `PERMISSIONS` + `PERMISSION_LABELS`

| المفتاح | استخدام typical |
|---------|------------------|
| `RECEIPTS` | تتبع صرف + قائمة وصولات عامة |
| `VIEW_REPORTS` | تقارير طلبات |
| `VIEW_ALL_REPORTS` | تقارير مدير |
| `VOUCHER_DELEGATE` | تخويل صرف |
| `VOUCHERS_*` | وصولات حسب الشركة (رئيسي/فرعي) |
| `VOUCHERS_REPORTS_VIEW` | تقارير وصولات |
| `CHEQUES` | نظام صكوك كامل |
| `CHEQUES_EDITOR` | ترتيب حقول الصك |
| `MANAGE_PERMISSIONS` | إدارة صلاحيات + workflow |
| `EX`, `EX_*` | طلبات الحجز |

---

## ملفات منطق مهمة

| الملف | الدور |
|-------|--------|
| `lib/permission.js` | صلاحيات + `hasPermission` |
| `lib/voucher/companies.js` | شركات الوصل + صور القوالب |
| `lib/voucher/resolveVoucherCompanyKey.js` | رئيسي/فرعي |
| `lib/voucher/findVoucherForRequest.js` | بحث وصل للطلب |
| `lib/voucher/linkVoucherToRequest.js` | ربط وصل بالخطوة الأخيرة |
| `lib/voucher/requestDisbursementState.js` | حالة صرف الطلب |
| `lib/receipts/disbursementReportPipelines.js` | Mongo pipelines لتقرير الصرف |
| `lib/cheques/templates.js` | قوالب الصكوك |
| `lib/cheques/chequeAuth.js` | صلاحيات API الصكوك |
| `lib/email/workflowEmail.js` | بريد الموافقات |
| `context/PermissionContext.js` | تحميل صلاحيات اليوزر في الواجهة |
| `components/RequestDetails.jsx` | تفاصيل طلب + وصل + تخويل |
| `components/CreateRequestModal.jsx` | إنشاء/تعديل طلب |
| `components/Header.jsx` | قائمة التنقل |

---

## Collections MongoDB (أهمها)

| Collection | المحتوى |
|------------|---------|
| `users` | مستخدمين |
| `permissions` | مجموعات (users, permissions, companies) |
| `workflows` | قوالب موافقة |
| `requests_{company}` | طلبات صرف (لكل شركة) |
| `vouchers` | وصولات |
| `vouchercounters` | عداد أرقام الوصول |
| `cheques` | صكوك محفوظة |
| `chequelayouts` | تخطيط حقول الصك |
| نماذج EX | حسب `models/` (PaymentPlan, UnitTransfer, …) |

---

## كيف تستخدم هذا الملف

1. **تبحث عن حركة؟** → قسم «جدول API» أو «تدفقات العمل».
2. **تضيف feature؟** → أضف سطراً هنا + الملفات في `lib/` و `app/api/`.
3. **صلاحية جديدة؟** → `lib/permission.js` ثم `GroupDetailsClient` تلقائياً من `PERMISSIONS`.

---

*آخر تحديث: يدوي — راجع `app/api/` عند الشك.*
