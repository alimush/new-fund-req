import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sizeOf from "image-size";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  PageBorderZOrder,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, "..", "docs");
const outPath = join(docsDir, "دليل-طلب-التمويل.docx");

const COLORS = {
  indigo: "4F46E5",
  blue: "2563EB",
  slate: "334155",
  muted: "64748B",
  heading: "0F172A",
  headerBg: "EFF6FF",
  noteBg: "F8FAFC",
  captionBg: "EEF2FF",
  pending: "B45309",
  approved: "166534",
  rejected: "B91C1C",
  cancelled: "475569",
};

const TABLE_WIDTH = 9360;
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" };

function loadImage(relPath, maxWidth = 560) {
  const filePath = join(docsDir, relPath);
  const data = readFileSync(filePath);
  const { width, height, type } = sizeOf(data);
  const w = Math.min(maxWidth, width);
  const h = Math.round((height / width) * w);
  return {
    data,
    transformation: { width: w, height: h },
    type: type === "png" ? "png" : "jpg",
  };
}

const logoImg = loadImage("spc-logo.jpg", 80);
const logoCover = loadImage("spc-logo.jpg", 110);

const PAGE = {
  margin: { top: 900, right: 900, bottom: 900, left: 900 },
  borders: {
    pageBorders: {
      display: PageBorderDisplay.ALL_PAGES,
      offsetFrom: PageBorderOffsetFrom.TEXT,
      zOrder: PageBorderZOrder.FRONT,
      top: { style: BorderStyle.SINGLE, size: 8, color: "818CF8", space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "818CF8", space: 4 },
      left: { style: BorderStyle.SINGLE, size: 8, color: "818CF8", space: 4 },
      right: { style: BorderStyle.SINGLE, size: 8, color: "818CF8", space: 4 },
    },
  },
};

function tr(text, opts = {}) {
  return new TextRun({
    text,
    font: "Tahoma",
    size: opts.size ?? 22,
    bold: opts.bold,
    color: opts.color,
    italics: opts.italics,
  });
}

function para(children, opts = {}) {
  const runs = Array.isArray(children) ? children : [tr(children, opts)];
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 100 },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    children: runs,
  });
}

function cellPara(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 40, after: 40 },
    children: [tr(text, opts)],
  });
}

function pb() {
  return new Paragraph({ children: [new PageBreak()] });
}

function gap(after = 60) {
  return para(" ", { after });
}

function divider() {
  return para(" ", {
    after: 140,
    shading: "C7D2FE",
  });
}

function pageFooter(label) {
  return [
    gap(40),
    para("─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─", {
      center: true,
      size: 14,
      color: "C7D2FE",
      after: 60,
    }),
    para(label, { center: true, size: 16, color: COLORS.muted, after: 0 }),
  ];
}

function endSlide(children, label) {
  return [...children, ...pageFooter(label), pb()];
}

function coverPage() {
  return endSlide(
    [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [
          new ImageRun({
            data: logoCover.data,
            transformation: logoCover.transformation,
            type: logoCover.type,
          }),
        ],
      }),
      para("دليل الاستخدام", { center: true, size: 20, color: COLORS.indigo, after: 80 }),
      para("طلب التمويل", { center: true, bold: true, size: 56, color: COLORS.heading, after: 120 }),
      para(
        "شرح مبسّط لآلية تقديم طلبات الصرف، الموافقات، والمتابعة داخل نظام إدارة طلبات التمويل",
        { center: true, size: 24, color: COLORS.muted, after: 200 }
      ),
      para("FUND REQUEST", { center: true, bold: true, size: 18, color: COLORS.indigo, after: 0 }),
    ],
    "الصفحة ١ — الغلاف"
  );
}

function slideHeader(pageLabel) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new ImageRun({
          data: logoImg.data,
          transformation: logoImg.transformation,
          type: logoImg.type,
        }),
      ],
    }),
    para([tr("FUND REQUEST", { bold: true, size: 16, color: COLORS.indigo }), tr("   |   ", { color: "CBD5E1" }), tr(pageLabel, { size: 16, color: COLORS.muted })], {
      center: true,
      after: 120,
    }),
    divider(),
  ];
}

function sectionTitle(icon, title) {
  return para([tr(`${icon}  `, { size: 24 }), tr(title, { bold: true, size: 26, color: COLORS.heading })], {
    after: 120,
  });
}

function subTitle(text) {
  return para(text, { bold: true, size: 22, color: COLORS.blue, before: 80, after: 80 });
}

function body(text, opts = {}) {
  return para(text, {
    size: opts.size ?? 22,
    color: opts.color ?? COLORS.slate,
    after: opts.after ?? 100,
    bold: opts.bold,
  });
}

function noteBox(text) {
  return para(text, { size: 20, color: COLORS.muted, shading: COLORS.noteBg, after: 100 });
}

function bullets(items) {
  return items.map((item) => para(`•  ${item}`, { size: 21, after: 70 }));
}

function numbered(items) {
  return items.map((item, i) => para(`${i + 1}.  ${item}`, { size: 21, after: 70 }));
}

function captionBlock(items) {
  return [
    para("وصف الصورة", { bold: true, size: 20, color: COLORS.heading, shading: COLORS.captionBg, after: 0 }),
    ...items.map((item) =>
      para(`•  ${item}`, { size: 19, color: COLORS.slate, shading: COLORS.captionBg, after: 50 })
    ),
    gap(80),
  ];
}

function imgPara(relPath, maxWidth = 520) {
  const img = loadImage(relPath, maxWidth);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 100 },
    children: [
      new ImageRun({
        data: img.data,
        transformation: img.transformation,
        type: img.type,
      }),
    ],
  });
}

function columnWidths(count) {
  if (count === 2) return [2600, 6760];
  if (count === 4) return [1800, 2520, 2520, 2520];
  return Array(count).fill(Math.floor(TABLE_WIDTH / count));
}

function makeCell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.widthPct ?? 50, type: WidthType.PERCENTAGE },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top: CELL_BORDER,
      bottom: CELL_BORDER,
      left: CELL_BORDER,
      right: CELL_BORDER,
    },
    children: [cellPara(text, { size: opts.size ?? 19, bold: opts.bold, color: opts.color })],
  });
}

function dataTable(headers, rows) {
  const cols = headers.length;
  const widths = columnWidths(cols);

  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: headers.map((h, i) =>
          makeCell(h, {
            bold: true,
            color: COLORS.blue,
            fill: COLORS.headerBg,
            widthPct: Math.round((widths[i] / TABLE_WIDTH) * 100),
          })
        ),
      }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((cell, i) => {
            const [text, color] = Array.isArray(cell) ? cell : [String(cell), undefined];
            return makeCell(text, {
              color,
              fill: ri % 2 ? "F8FAFC" : "FFFFFF",
              widthPct: Math.round((widths[i] / TABLE_WIDTH) * 100),
            });
          }),
        })
      ),
    ],
  });
}

function flowStepsTable() {
  const steps = [
    ["①", "إنشاء الطلب", "EFF6FF", COLORS.blue],
    ["②", "الموافقات", "F5F3FF", "7C3AED"],
    ["③", "الاعتماد", "ECFDF5", COLORS.approved],
    ["④", "الصرف", "FFF7ED", "EA580C"],
  ];
  const w = Math.floor(TABLE_WIDTH / 4);

  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [w, w, w, w],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: steps.map(([num, label, bg]) =>
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { fill: bg, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 80, right: 80 },
            borders: {
              top: CELL_BORDER,
              bottom: CELL_BORDER,
              left: CELL_BORDER,
              right: CELL_BORDER,
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [tr(num, { bold: true, size: 18, color: COLORS.indigo })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [tr(label, { bold: true, size: 20, color: COLORS.heading })],
              }),
            ],
          })
        ),
      }),
    ],
  });
}

function shotSlide(icon, title, imagePath, captionItems, label) {
  return endSlide(
    [
      ...slideHeader(label),
      sectionTitle(icon, title),
      imgPara(imagePath, 500),
      ...captionBlock(captionItems),
    ],
    label
  );
}

function buildContent() {
  const blocks = [coverPage()];

  blocks.push(
    ...endSlide(
      [
        ...slideHeader("الصفحة ٢ — المقدمة"),
        sectionTitle("📋", "ما هو طلب التمويل؟"),
        body(
          "طلب التمويل هو مستند إلكتروني يُقدَّم لطلب صرف مبلغ مالي لغرض محدد (مشتريات، مصاريف تشغيل، رواتب، مشاريع…). يمر الطلب بخطوات موافقة محددة مسبقاً قبل اعتماده."
        ),
        body("لكل طلب رمز فريد (Request Code) يُستخدم للبحث والمتابعة والأرشفة.", { bold: true }),
        gap(100),
        sectionTitle("📝", "ماذا يحتوي الطلب؟"),
        dataTable(
          ["الحقل", "الوصف"],
          [
            ["نوع الطلب", "تصنيف الطلب حسب إعداد الشركة"],
            ["القسم", "القسم مقدّم الطلب"],
            ["العملة", "دينار عراقي أو دولار"],
            ["الوصف والملاحظات", "شرح سبب الطلب وأي تفاصيل إضافية"],
            ["جدول البنود", "التفاصيل، الكمية، سعر الوحدة، والمجموع"],
            ["المجموع الكلي", "يُحسب تلقائياً من البنود"],
            ["المرفقات", "فواتير، عقود، كشوف (صور أو PDF)"],
          ]
        ),
        gap(60),
        noteBox("في بعض الشركات قد يظهر أيضاً: اسم المشروع أو نوع المصروف (حسب إعداد الشركة)."),
      ],
      "الصفحة ٢ — المقدمة"
    )
  );

  blocks.push(
    ...shotSlide(
      "🏠",
      "لوحة التحكم (الداشبورد)",
      "assets/dashboard-screenshot.jpg",
      [
        "الشريط العلوي: شعار SPC، اسم النظام Fund Request، وحساب المستخدم.",
        "بطاقة الملخص: اسم المستخدم، عدد الشركات المتاحة، والطلبات بانتظار الموافقة.",
        "الأدوات والتقارير: للانتقال إلى تقارير الطلبات ومتابعة حالتها.",
        "شبكة الشركات: اختر الشركة (١–٦) واضغط على بطاقتها لفتح طلباتها.",
      ],
      "الصفحة ٣ — لوحة التحكم"
    )
  );

  blocks.push(
    ...shotSlide(
      "📄",
      "داشبورد الطلبات (Requests)",
      "assets/requests-screenshot.jpg",
      [
        "العنوان وإنشاء طلب: اسم الشركة وزر «إنشاء طلب» لإضافة طلب تمويل جديد.",
        "بطاقات الملخص: مجموع طلباتي، طلباتي قيد الانتظار، وطلباتي الموافق عليها.",
        "البحث: للبحث بالكود أو الوصف أو نوع الطلب.",
        "طلباتي: الطلبات التي أنشأها المستخدم مع فلتر حسب الحالة.",
        "قيد الانتظار للموافقة: الطلبات التي تحتاج موافقة المستخدم الحالي.",
      ],
      "الصفحة ٤ — داشبورد الطلبات"
    )
  );

  blocks.push(
    ...endSlide(
      [
        ...slideHeader("الصفحة ٥ — المراحل"),
        sectionTitle("🔄", "مراحل الطلب"),
        flowStepsTable(),
        gap(100),
        subTitle("① إنشاء الطلب"),
        body("يُفتح طلب جديد، تُملأ البيانات وتُرفع المرفقات، ثم يُحفظ فيصبح قيد الانتظار."),
        noteBox(
          "عند الإنشاء يُرسل بريد إلكتروني تلقائي إلى موظفي الخطوة الأولى في سير العمل لإعلامهم بوجود طلب جديد بانتظار موافقتهم."
        ),
        subTitle("② الموافقات"),
        body("يمر الطلب بخطوات محددة (مثل: مدير القسم → المالية → الإدارة). كل معتمد يراجع ويوافق أو يرفض مع تعليق."),
        subTitle("③ الاعتماد"),
        body("بعد اكتمال الموافقات تصبح الحالة موافق والطلب جاهز للصرف."),
        subTitle("④ الصرف"),
        body("يُصدر وصل صرف ويُربط بالطلب."),
      ],
      "الصفحة ٥ — المراحل"
    )
  );

  blocks.push(
    ...endSlide(
      [
        ...slideHeader("الصفحة ٦ — الحالات"),
        sectionTitle("🏷️", "حالات الطلب"),
        dataTable(
          ["الحالة", "المعنى"],
          [
            [["قيد الانتظار", COLORS.pending], "الطلب لم يكتمل اعتماده بعد"],
            [["موافق", COLORS.approved], "اكتملت الموافقات — جاهز للصرف"],
            [["مرفوض", COLORS.rejected], "رُفض في إحدى الخطوات — لا يُنفَّذ"],
            [["ملغي", COLORS.cancelled], "أُلغي الطلب"],
          ]
        ),
      ],
      "الصفحة ٦ — الحالات"
    )
  );

  blocks.push(
    ...shotSlide(
      "🔄",
      "سير العمل",
      "assets/workflow-screenshot.jpg",
      [
        "شريط التقدم: يوضح الخطوة الحالية من إجمالي خطوات الموافقة (مثال: الخطوة 2 من 5).",
        "الخطوات المكتملة: تظهر بعلامة «موافق» مع اسم المعتمد وتاريخ الإجراء.",
        "الخطوة الحالية: تظهر «قيد الانتظار» مع أسماء الموظفين المطلوب موافقتهم.",
        "الخطوات القادمة: تبقى بانتظار دورها حتى يُكمل الطلب الخطوات السابقة.",
      ],
      "الصفحة ٧ — سير العمل"
    )
  );

  blocks.push(
    ...endSlide(
      [
        ...slideHeader("الصفحة ٨ — الموافقات"),
        sectionTitle("✅", "سير العمل والموافقات"),
        body("كل طلب مربوط بـ سير عمل (Workflow) يحدد من يوافق في كل خطوة وترتيب الخطوات."),
        ...bullets([
          "لا يمكن تخطي خطوة — الترتيب إلزامي",
          "الرفض في أي خطوة يوقف الطلب أو يُعاد للخطوة السابقة",
          "يمكن إضافة تعليق مع الموافقة أو الرفض",
          "يمكن رفع مرفق (اتاج) أثناء خطوة الموافقة",
          "سجل الموافقات محفوظ ومرئي في صفحة الطلب",
        ]),
        gap(80),
        dataTable(
          ["العنصر", "الوصف"],
          [
            ["في صفحة الطلب", "بيانات + بنود + مرفقات"],
            ["مسار الموافقات", "من وافق ومن ينتظر"],
            ["الإجراءات", "موافقة / رفض / تعليق"],
          ]
        ),
      ],
      "الصفحة ٨ — الموافقات"
    )
  );

  blocks.push(
    ...endSlide(
      [
        ...slideHeader("الصفحة ٩ — البريد"),
        sectionTitle("📧", "إشعارات البريد الإلكتروني"),
        body("يرسل النظام رسائل بريد تلقائياً عند تحرك الطلب في سير العمل (حسب البريد المسجّل لكل مستخدم):"),
        ...bullets([
          "عند الموافقة (إذا لم تكن الخطوة الأخيرة): بريد للخطوة التالية + بريد لمقدّم الطلب.",
          "عند الرفض (إذا لم تكن الخطوة الأولى): بريد للخطوة السابقة + بريد لمقدّم الطلب.",
        ]),
        noteBox("لا يُرسل بريد عند الموافقة في الخطوة الأخيرة، ولا عند الرفض في الخطوة الأولى."),
        imgPara("assets/email-notification-screenshot.jpg", 360),
        noteBox(
          "مثال لرسالة بريد تُرسل تلقائياً عند الموافقة — تتضمن الشركة، الانتقال بين الخطوات، ملاحظة المعتمد، وزر «عرض التفاصيل»."
        ),
      ],
      "الصفحة ٩ — البريد"
    )
  );

  blocks.push(
    ...endSlide(
      [
        ...slideHeader("الصفحة ١٠ — المرفقات"),
        sectionTitle("📎", "المرفقات"),
        dataTable(
          ["النوع", "متى يُرفع"],
          [
            ["مرفقات الطلب", "عند الإنشاء أو التعديل (فواتير، مستندات داعمة)"],
            ["اتاج خطوة الموافقة", "أثناء الموافقة من المعتمد"],
          ]
        ),
        body("الصيغ المدعومة: صور (JPG, PNG…) وملفات PDF — تُفتح من صفحة الطلب."),
        gap(100),
        sectionTitle("⬇️", "تحميل PDF الطلب"),
        body("من صفحة تفاصيل الطلب، عند الضغط على زر PDF تظهر خيارات:"),
        dataTable(
          ["الخيار", "المحتوى"],
          [
            ["تحميل PDF الطلب فقط", "بيانات الطلب + جدول البنود + الموافقات"],
            ["تحميل PDF الطلب والمرفقات", "الطلب مع دمج المرفقات واتاجات الموافقة"],
          ]
        ),
        gap(100),
        sectionTitle("📊", "التقارير والمتابعة"),
        body("صفحة تقارير الطلبات (من لوحة التحكم) تتيح البحث المتقدّم وتصدير Excel."),
      ],
      "الصفحة ١٠ — المرفقات"
    )
  );

  blocks.push(
    ...endSlide(
      [
        ...slideHeader("الصفحة ١١ — التقارير"),
        sectionTitle("📊", "تقارير الطلبات"),
        body("صفحة التقارير تعرض مؤشرات سريعة، فلاتر بحث متقدمة، وجدول نتائج:"),
        gap(60),
        dataTable(
          ["المؤشر", "القيمة"],
          [
            ["المجموع", "48"],
            ["مقبول", "12"],
            ["قيد الانتظار", "22"],
            ["مرفوض", "8"],
          ]
        ),
        gap(80),
        dataTable(
          ["الشركة", "كود الطلب", "الحالة", "المبلغ"],
          [
            ["شركة ١", "REQ-2401", ["قيد الانتظار", COLORS.pending], "3,500,000"],
            ["شركة ٢", "REQ-2398", ["قيد الانتظار", COLORS.pending], "1,200,000"],
            ["شركة ١", "REQ-2385", ["موافق", COLORS.approved], "8,750,000"],
            ["شركة ٣", "REQ-2372", ["مرفوض", COLORS.rejected], "450,000"],
          ]
        ),
        gap(100),
        sectionTitle("⏳", "تقرير قيد الانتظار (Pending)"),
        body("لاستخراج تقرير بالطلبات التي لم تكتمل موافقتها بعد:"),
        ...numbered([
          "اختر من فلتر الحالة → قيد الانتظار",
          "حدّد الشركة أو الفترة الزمنية إن لزم",
          "اضغط بحث",
        ]),
        subTitle("ماذا يعرض هذا التقرير؟"),
        ...bullets([
          "كل الطلبات بحالة «قيد الانتظار» ضمن صلاحياتك",
          "عمود قيد الانتظار عند يبيّن اسم الموظف المكلّف بالموافقة في الخطوة الحالية",
          "يمكن الجمع مع فلتر الشركة أو مقدم الطلب أو العملة",
        ]),
      ],
      "الصفحة ١١ — التقارير"
    )
  );

  blocks.push(
    ...endSlide(
      [
        ...slideHeader("الصفحة ١٢ — الختام"),
        sectionTitle("🔀", "تقرير حالة الخطوة (Stage Status)"),
        body("عمود قيد الانتظار عند هو مفتاح متابعة مرحلة سير العمل لكل طلب:"),
        ...bullets([
          "يظهر فقط للطلبات قيد الانتظار — الطلبات المعتمدة أو المرفوضة تظهر «—»",
          "القيمة = اسم المعتمد في الخطوة الحالية من سير العمل",
          "إذا كانت الخطوة مكلّفة لأكثر من شخص يظهر أسماؤهم مفصولة بفاصلة",
        ]),
        dataTable(
          ["الهدف", "الإجراء"],
          [
            ["معرفة أين علق طلب معيّن", "ابحث بكود الطلب → راجع عمود قيد الانتظار عند"],
            ["قائمة كل ما عند خطوة معيّنة", "الحالة = قيد الانتظار + قيد الانتظار عند = الموظف المطلوب"],
            ["متابعة تأخير الموافقات", "فلتر بالتاريخ + الحالة قيد الانتظار"],
          ]
        ),
        gap(100),
        sectionTitle("✅", "تقرير المعتمد (Approved)"),
        body("لاستخراج تقرير بالطلبات التي اكتملت موافقاتها:"),
        ...numbered([
          "اختر من فلتر الحالة → موافق",
          "حدّد الشركة والفترة (مثلاً: شهر محاسبي)",
          "اضغط بحث ثم Excel للتصدير",
        ]),
        subTitle("ماذا يعرض هذا التقرير؟"),
        ...bullets([
          "الطلبات الجاهزة للصرف — اكتمل سير الموافقات عليها",
          "عمود قيد الانتظار عند يكون فارغاً (—)",
          "ملف Excel يحتوي: الشركة، الكود، النوع، مقدم الطلب، الحالة، المبلغ، التاريخ",
        ]),
        gap(100),
        sectionTitle("💡", "مثال عملي"),
        body("الموقف: قسم يحتاج 5,000,000 د.ع لشراء مواد."),
        dataTable(
          ["#", "الإجراء"],
          [
            ["١", "فتح لوحة التحكم واختيار شركة ١ وإنشاء طلب جديد"],
            ["٢", "إدخال البنود والمبلغ ورفع الفاتورة"],
            ["٣", "موافقة مدير القسم"],
            ["٤", "موافقة المدير المالي"],
            ["٥", "الموافقة النهائية — الطلب يصبح معتمداً"],
            ["٦", "إصدار وصل صرف وربطه بالطلب"],
            ["٧", "استخراج تقرير للمراجعة الشهرية"],
          ]
        ),
      ],
      "الصفحة ١٢ — الختام"
    )
  );

  return blocks;
}

async function main() {
  const doc = new Document({
    sections: [
      {
        properties: { rightToLeft: true, page: PAGE },
        children: buildContent(),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(outPath, buffer);
  console.log(`✅ Word: ${outPath}`);
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
