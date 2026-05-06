/**
 * Centralized configuration for all companies and their voucher templates.
 */

import { PERMISSIONS } from "@/lib/permission";

export const TEMPLATE_SWITCH_DATE = new Date("2026-04-18T13:40:06.558+03:00");

/** ✅ الإحداثيات الافتراضية للقوالب الجديدة */
export const POS_NEW = {
  date: { top: 12.8, left: 16.6 },
  amountFixed: { top: 17.7, left: 12.0 },
  currencyUSDBox: { top: 17.8, left: 76.3 },
  currencyIQDBox: { top: 17.8, left: 86.7 },
  amountWords: { top: 33.9, left: -6, width: 75.0 },
  description: { top: 42.5, left: 14.0, width: 74.2, height: 15.0 },
};

export const EXTRA_NEW = {
  bank: { top: 54.9, left: -24, width: 54.2, height: 6.0 },
  fxRate: { top: 17.7, left: 46.5, width: 30.0, height: 6.0 },
  chequeNo: { top: 54.9, left: 45.8, width: 10.0, height: 6.0 },
  nationalId: { top: 26.9, left: 38.9, width: 30.0, height: 6.0 },
  phone: { top: 30.3, left: 44.5, width: 30.0, height: 3 },
  sanadNo: { top: 70, left: 14.8, width: 30.0, height: 6.0 },
  receivedBy: { top: 23.4, left: 14.8, width: 54.2, height: 6.0 },
  notes: { top: 63.7, left: 16.0, width: 72.2, height: 8.0 },
  cb1: { top: 55, left: 78.0 },
  cb2: { top: 55, left: 65.2 },
};

/** ✅ الإحداثيات للقوالب القديمة */
export const POS_OLD = {
  date: { top: 19.2, left: 74.8 },
  amountFixed: { top: 13.6, left: 9.0 },
  currencyUSDBox: { top: 8.0, left: 22.3 },
  currencyIQDBox: { top: 8.0, left: 13.0 },
  amountWords: { top: 37.6, left: -2.0, width: 75.0 },
  description: { top: 53.5, left: 10, width: 80, height: 15.0 },
};

export const EXTRA_OLD = {
  bank: { top: 70, left: -20, width: 54.2, height: 6.0 },
  fxRate: { top: 20, left: 12.0, width: 30.0, height: 6.0 },
  receivedBy: { top: 29.2, left: 18.8, width: 54.2, height: 6.0 },
  beneficiary: { top: 85.8, left: -20, width: 54.2, height: 6.0 },
  notes: { top: 84.0, left: 50.0, width: 40.2, height: 8.0 },
  cb1: { top: 71.7, left: 81.2 },
  cb2: { top: 71.7, left: 70.3 },
};

export const COMPANIES = [
  {
    key: "Al-Ghadeer",
    name: "شركة الغدير",
    logo: "/الغدير.png",
    permission: PERMISSIONS.VOUCHERS_AL_GHADEER,
    paymentImgJpg: "/assets/vouchers/ghadeer_payment.jpg",
    receiptImgJpg: "/assets/vouchers/ghadeer_receipt.jpg",
    paymentImgPng: "/assets/vouchers/ghadeer_payment.png",
    receiptImgPng: "/assets/vouchers/ghadeer_receipt.png",
    paymentImg: "/assets/vouchers/ghadeer_payment.png",
    receiptImg: "/assets/vouchers/ghadeer_receipt.png",
  },
  {
    key: "Badur-Baghdad",
    name: "شركة بدور بغداد",
    logo: "/بدور_بغداد.png",
    permission: PERMISSIONS.VOUCHERS_BADUR_BAGHDAD,
    paymentImgJpg: "/assets/vouchers/badur_baghdad_payment.jpg",
    receiptImgJpg: "/assets/vouchers/badur_baghdad_receipt.jpg",
    paymentImgPng: "/assets/vouchers/badur_baghdad_payment.png",
    receiptImgPng: "/assets/vouchers/badur_baghdad_receipt.png",
    paymentImg: "/assets/vouchers/badur_baghdad_payment.png",
    receiptImg: "/assets/vouchers/badur_baghdad_receipt.png",
  },
  {
    key: "Tiba-Al-najaf",
    name: "طيبة النجف",
    logo: "/طيبة_النجف.png",
    permission: PERMISSIONS.VOUCHERS_TIBA_AL_NAJAF,
    paymentImgPng: "/assets/vouchers/tiba_najaf_payment.png",
    receiptImgPng: "/assets/vouchers/tiba_najaf_receipt.png",
    paymentImg: "/assets/vouchers/tiba_najaf_payment.png",
    receiptImg: "/assets/vouchers/tiba_najaf_receipt.png",
  },
  {
    key: "Ghadeer-Karbala",
    name: "غدير كربلاء",
    logo: "/غدير_كربلاء.png",
    permission: PERMISSIONS.VOUCHERS_GHADEER_KARBALA,
    paymentImgPng: "/assets/vouchers/ghadeer_karbala_payment.png",
    receiptImgPng: "/assets/vouchers/ghadeer_karbala_receipt.png",
    paymentImg: "/assets/vouchers/ghadeer_karbala_payment.png",
    receiptImg: "/assets/vouchers/ghadeer_karbala_receipt.png",
  },
  {
    key: "Badur-Al-Najaf",
    name: "بدور النجف",
    logo: "/بدور_النجف.png",
    permission: PERMISSIONS.VOUCHERS_BADUR_AL_NAJAF,
    paymentImgPng: "/assets/vouchers/badur_najaf_payment.png",
    receiptImgPng: "/assets/vouchers/badur_najaf_receipt.png",
    paymentImg: "/assets/vouchers/badur_najaf_payment.png",
    receiptImg: "/assets/vouchers/badur_najaf_receipt.png",
  },
  {
    key: "Ghadeer-Investments",
    name: "الغدير - صندوق فرعي - كربلاء",
    logo: "/الغدير.png",
    permission: PERMISSIONS.VOUCHERS_GHADEER_INVESTMENTS,
    paymentImgPng: "/assets/vouchers/ghadeer_investments_payment.png",
    receiptImgPng: "/assets/vouchers/ghadeer_investments_receipt.png",
    paymentImg: "/assets/vouchers/ghadeer_investments_payment.png",
    receiptImg: "/assets/vouchers/ghadeer_investments_receipt.png",
  },
  {
    key: "Ghadeer-Karbala-Sub",
    name: "غدير كربلاء - الصندوق الفرعي",
    logo: "/غدير_كربلاء.png",
    permission: PERMISSIONS.VOUCHERS_GHADEER_KARBALA_SUB,
    paymentImgPng: "/assets/vouchers/ghadeer_karbala_sub_payment.png",
    receiptImgPng: "/assets/vouchers/ghadeer_karbala_sub_receipt.png",
    paymentImg: "/assets/vouchers/ghadeer_karbala_sub_payment.png",
    receiptImg: "/assets/vouchers/ghadeer_karbala_sub_receipt.png",
  },
  {
    key: "Ghadeer-Najaf-Sub",
    name: "الغدير الفرعي - النجف",
    logo: "/الغدير.png",
    permission: PERMISSIONS.VOUCHERS_GHADEER_NAJAF_SUB,
    paymentImgPng: "/assets/vouchers/ghadeer_najaf_sub_payment.png",
    receiptImgPng: "/assets/vouchers/ghadeer_najaf_sub_receipt.png",
    paymentImg: "/assets/vouchers/ghadeer_najaf_sub_payment.png",
    receiptImg: "/assets/vouchers/ghadeer_najaf_sub_receipt.png",
  },
  {
    key: "010",
    name: "010 (Test)",
    logo: "/12.png",
    permission: PERMISSIONS.TEST,
    paymentImgJpg: "/assets/vouchers/ghadeer_payment.jpg",
    receiptImgJpg: "/assets/vouchers/ghadeer_receipt.jpg",
    paymentImgPng: "/assets/vouchers/ghadeer_payment.png",
    receiptImgPng: "/assets/vouchers/ghadeer_receipt.png",
    paymentImg: "/assets/vouchers/ghadeer_payment.png",
    receiptImg: "/assets/vouchers/ghadeer_receipt.png",
  },
];
