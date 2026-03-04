// /lib/exForms/forms/replaceBookingTransfer.js

export const replaceBookingTransfer = {
    key: "replace-booking-transfer",
    title: "Replace Booking Transfer",
  
    /**
     * ✅ مصدر التمبلت:
     * - templateImg: مسار ثابت داخل /public
     * - templateUrl: (اختياري) إذا عندك رابط خارجي (S3 مثلا)
     * - templateId: (اختياري) إذا تحب تجيبها من DB حسب ID
     *
     * بالكومبوننت راح نستخدم:
     * const TEMPLATE_IMG = formConfig.templateUrl || formConfig.templateImg;
     */
    template: {
      img: "/replace-booking-transfer-a4.jpg", // ✅ الصورة تجي من هنا
      url: "",        // اختياري
      id: "",         // اختياري
    },
  
    // POS
    pos: {
      salesEmp: { top: 60, left: -11, width: 30, height: 3.8, dir: "rtl", align: "right", fontSize: 16 },
      dateDMY:  { top: 8.5, left: 62, width: 20, height: 3.8, dir: "rtl", align: "right", fontSize: 16 },
  
      oldUnitNo:     { top: 31.7, left: 19, width: 20, height: 3.8, dir: "rtl", align: "center", fontSize: 20 },
      customerName:  { top: 34.6, left: 51, width: 35, height: 3.8, dir: "rtl", align: "right",  fontSize: 16 },
  
      // ✅ يبدي من اليسار دائما
      amountNumber:  { top: 37.5, left: 69.6, width: 22, height: 3.8, dir: "ltr", align: "left", fontSize: 16, pinLeft: true },
  
      amountWords:   { top: 37.8, left: 40, width: 28, height: 3.8, dir: "rtl", align: "right", fontSize: 14 },
      newUnitNo:     { top: 40.2, left: 10, width: 20, height: 3.8, dir: "rtl", align: "center", fontSize: 16 },
    },
  
    fields: [
      { name: "salesEmp", label: "موظف المبيعات", type: "text", readOnly: true },
      { name: "dateDMY", label: "التاريخ", type: "dateDMY" },
      { name: "oldUnitNo", label: "رقم الوحدة القديمة", type: "text" },
      { name: "customerName", label: "اسم الزبون", type: "text" },
      { name: "amountNumber", label: "المبلغ رقماً", type: "moneyIQD" },
      { name: "amountWords", label: "المبلغ كتابة", type: "arabicWordsIQD", readOnly: true },
      { name: "newUnitNo", label: "رقم الوحدة الجديدة", type: "text" },
    ],
  };

  