import type { LucideIcon } from "lucide-react";
import { Banknote, CreditCard, Wallet, Truck, Smartphone } from "lucide-react";
import tabbyLogo from "@/assets/tabby-logo.webp";
import tamaraLogo from "@/assets/tamara-logo.webp";
import applePayLogo from "@/assets/pay-applepay.png";
import visaLogo from "@/assets/pay-visa.webp";
import mastercardLogo from "@/assets/pay-mastercard.png";
import madaLogo from "@/assets/pay-mada.png";
import stcPayLogo from "@/assets/pay-stcpay.png";

export type PaymentMethod = "tabby" | "tamara" | "mayfatoorah" | "cod" | "mada" | "stcpay";

export const paymentMethods: {
  id: PaymentMethod;
  name: string;
  desc: string;
  icon: LucideIcon;
  logo?: string;
  brands?: { name: string; logo?: string; icon?: LucideIcon }[];
  badge?: string;
}[] = [
  {
    id: "mayfatoorah",
    name: "ماي فاتورة",
    desc: "فيزا، ماستر كارد، وApple Pay",
    icon: Banknote,
    badge: "الأكثر استخداماً",
    brands: [
      { name: "Visa", logo: visaLogo },
      { name: "Mastercard", logo: mastercardLogo },
      { name: "Apple Pay", logo: applePayLogo },
    ],
  },
];


export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "review"
  | "completed"
  | "cancelled";

export const statusLabels: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: "بانتظار التأكيد", color: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed: { label: "تم التأكيد", color: "bg-sky-100 text-sky-700 border-sky-200" },
  in_progress: { label: "قيد التنفيذ", color: "bg-blue-100 text-blue-700 border-blue-200" },
  review: { label: "قيد المراجعة", color: "bg-purple-100 text-purple-700 border-purple-200" },
  completed: { label: "مكتمل", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled: { label: "ملغي", color: "bg-rose-100 text-rose-700 border-rose-200" },
};

export const statusFlow: OrderStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "review",
  "completed",
];

export type CartItem = {
  id: string; // unique line id
  serviceSlug: string;
  serviceTitle: string;
  planName: string;
  price: number;
  qty: number;
};

export type Order = {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  payment: PaymentMethod;
  paid: boolean;
  paymentStatus?: "unpaid" | "paid" | "refunded";
  invoice?: { id: string; number: string; status: string; total: number } | null;
  items: CartItem[];
  subtotal: number;
  vat: number;
  total: number;
  notes?: string;
  redeemed?: boolean; // whether service was claimed at the center
  redeemedAt?: string;
  vendorName?: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  branchMapsUrl?: string;
  timeline: { status: OrderStatus; at: string; note?: string }[];
};

export type TicketMessage = {
  id: string;
  from: "client" | "support";
  author: string;
  text: string;
  at: string;
};

export type Ticket = {
  id: string;
  number: string;
  subject: string;
  orderId?: string;
  status: "open" | "answered" | "closed";
  priority: "low" | "normal" | "high";
  createdAt: string;
  messages: TicketMessage[];
};

export const mockUser = {
  name: "أحمد العبدالله",
  email: "ahmed@example.com",
  phone: "+966 55 123 4567",
  city: "الرياض",
  joinedAt: "2025-08-12",
  avatar: "أ",
};

export const mockOrders: Order[] = [
  {
    id: "ord_1031",
    number: "SD-1031",
    createdAt: "2026-05-20",
    status: "confirmed",
    payment: "mayfatoorah",
    paid: true,
    redeemed: false,
    vendorName: "مركز لمسة جمال",
    items: [
      { id: "i1", serviceSlug: "haircut", serviceTitle: "قص وتصفيف الشعر", planName: "Pro", price: 180, qty: 1 },
    ],
    subtotal: 180,
    vat: 27,
    total: 207,
    timeline: [
      { status: "pending", at: "2026-05-20 09:10" },
      { status: "confirmed", at: "2026-05-20 09:45", note: "تم تأكيد الحجز من المركز" },
    ],
  },
  {
    id: "ord_1030",
    number: "SD-1030",
    createdAt: "2026-05-18",
    status: "pending",
    payment: "cod",
    paid: false,
    redeemed: false,
    vendorName: "مركز روز سبا",
    items: [
      { id: "i1", serviceSlug: "massage", serviceTitle: "جلسة مساج استرخائي", planName: "60 دقيقة", price: 320, qty: 1 },
    ],
    subtotal: 320,
    vat: 48,
    total: 368,
    timeline: [
      { status: "pending", at: "2026-05-18 14:00", note: "بانتظار سداد الحجز" },
    ],
  },
  {
    id: "ord_1024",
    number: "SD-1024",
    createdAt: "2026-04-22",
    status: "in_progress",
    payment: "tabby",
    paid: true,
    redeemed: false,
    vendorName: "صالون قصة الأناقة",
    items: [
      { id: "i1", serviceSlug: "hair-color", serviceTitle: "صبغة وعلاج شعر", planName: "Pro", price: 450, qty: 1 },
      { id: "i2", serviceSlug: "manicure", serviceTitle: "مانيكير وبديكير", planName: "Basic", price: 150, qty: 1 },
    ],
    subtotal: 600,
    vat: 90,
    total: 690,
    notes: "موعد الحجز يوم الخميس الساعة 6 مساءً.",
    timeline: [
      { status: "pending", at: "2026-04-22 10:14", note: "تم استلام الطلب" },
      { status: "confirmed", at: "2026-04-22 13:02", note: "تم التأكيد بعد سداد الدفعة الأولى" },
      { status: "in_progress", at: "2026-04-23 09:30", note: "العميل في المركز" },
    ],
  },
  {
    id: "ord_1018",
    number: "SD-1018",
    createdAt: "2026-03-08",
    status: "completed",
    payment: "mayfatoorah",
    paid: true,
    redeemed: true,
    redeemedAt: "2026-03-15 17:40",
    vendorName: "مركز جلوري للتجميل",
    items: [
      { id: "i1", serviceSlug: "facial", serviceTitle: "تنظيف بشرة عميق", planName: "Pro", price: 380, qty: 1 },
    ],
    subtotal: 380,
    vat: 57,
    total: 437,
    timeline: [
      { status: "pending", at: "2026-03-08 11:00" },
      { status: "confirmed", at: "2026-03-08 12:15" },
      { status: "in_progress", at: "2026-03-09 09:00" },
      { status: "review", at: "2026-03-15 17:40" },
      { status: "completed", at: "2026-03-18 14:22", note: "تم استلام الخدمة من المركز" },
    ],
  },
  {
    id: "ord_1009",
    number: "SD-1009",
    createdAt: "2026-02-01",
    status: "cancelled",
    payment: "cod",
    paid: false,
    redeemed: false,
    vendorName: "مركز نسائم سبا",
    items: [
      { id: "i1", serviceSlug: "hair-removal", serviceTitle: "إزالة شعر بالليزر", planName: "Basic", price: 500, qty: 1 },
    ],
    subtotal: 500,
    vat: 75,
    total: 575,
    timeline: [
      { status: "pending", at: "2026-02-01 09:10" },
      { status: "cancelled", at: "2026-02-02 10:00", note: "تم الإلغاء بناء على طلب العميل" },
    ],
  },
];

export const mockTickets: Ticket[] = [
  {
    id: "tk_201",
    number: "TK-201",
    subject: "تعديل بسيط على الصفحة الرئيسية",
    orderId: "ord_1024",
    status: "answered",
    priority: "normal",
    createdAt: "2026-04-25",
    messages: [
      { id: "m1", from: "client", author: "أحمد", text: "السلام عليكم، أحتاج تغيير الصورة الرئيسية في الهيرو سيكشن.", at: "2026-04-25 14:00" },
      { id: "m2", from: "support", author: "فريق خصومات", text: "وعليكم السلام، تم استلام طلبك وسيتم تنفيذه خلال 24 ساعة. هل لديك صورة مقترحة؟", at: "2026-04-25 14:35" },
    ],
  },
  {
    id: "tk_198",
    number: "TK-198",
    subject: "استفسار عن الفاتورة الضريبية",
    status: "closed",
    priority: "low",
    createdAt: "2026-03-20",
    messages: [
      { id: "m1", from: "client", author: "أحمد", text: "هل يمكن إصدار فاتورة ضريبية باسم الشركة؟", at: "2026-03-20 10:00" },
      { id: "m2", from: "support", author: "فريق خصومات", text: "بالتأكيد، تفضل بإرسال السجل التجاري والرقم الضريبي.", at: "2026-03-20 11:15" },
      { id: "m3", from: "client", author: "أحمد", text: "تم الإرسال على الإيميل، شكراً لكم.", at: "2026-03-20 12:00" },
    ],
  },
];

export const formatCurrency = (n: number, lang: "ar" | "en" = "ar") => {
  const locale = lang === "en" ? "en-US" : "ar-SA";
  const suffix = lang === "en" ? " SAR" : " ر.س";
  return new Intl.NumberFormat(locale, { style: "decimal", maximumFractionDigits: 0 }).format(n) + suffix;
};

export const paymentName = (p: PaymentMethod, lang: "ar" | "en" = "ar") => {
  const en: Record<PaymentMethod, string> = {
    tabby: "Tabby",
    tamara: "Tamara",
    mayfatoorah: "MyFatoorah",
    cod: "Cash on delivery",
    mada: "Mada",
    stcpay: "STC Pay",
  };
  if (lang === "en") return en[p] ?? p;
  return paymentMethods.find((m) => m.id === p)?.name ?? p;
};

export const paymentIcon = (p: PaymentMethod): LucideIcon =>
  paymentMethods.find((m) => m.id === p)?.icon ?? Smartphone;