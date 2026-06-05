export const adminStats = {
  revenue: 284520,
  revenueGrowth: 12.5,
  ordersCount: 3842,
  monthlyTarget: 365000,
  remaining: 80480,
  totalServices: 12,
  activeServices: 9,
  totalBookings: 184,
  pending: 21,
  inProgress: 38,
  completed: 112,
  totalClients: 96,
  vipClients: 14,
  growthRate: 23.1,
  avgOrder: 1420,
};

export const monthlyRevenue = [
  { m: "ينا", v: 18 }, { m: "فبر", v: 26 }, { m: "مار", v: 32 }, { m: "أبر", v: 41 },
  { m: "ماي", v: 38 }, { m: "يون", v: 49 }, { m: "يول", v: 56 }, { m: "أغس", v: 64 },
  { m: "سبت", v: 72 }, { m: "أكت", v: 81 }, { m: "نوف", v: 88 }, { m: "ديس", v: 95 },
];

export const salesByCategory = [
  { name: "تصميم مواقع", value: 38, color: "#00AEC6" },
  { name: "هويات بصرية", value: 22, color: "#3a7fbe" },
  { name: "تطبيقات موبايل", value: 18, color: "#5fa1d9" },
  { name: "سوشيال ميديا", value: 14, color: "#9bc4e8" },
  { name: "أخرى", value: 8, color: "#cbe0f0" },
];

export type AdminService = {
  id: string; sku: string; slug: string; titleAr: string; titleEn: string; category: string;
  price: number; bookings: number; status: "active" | "draft" | "archived";
};

export const adminServices: AdminService[] = [];

export type AdminBooking = {
  id: string; number: string; client: string; email: string; service: string;
  total: number; payment: string;
  status: "pending" | "confirmed" | "in_progress" | "review" | "completed" | "cancelled";
  date: string;
  source?: "direct" | "partner";
  phone?: string; city?: string;
  address?: string;
  notes?: string;
  subtotal?: number;
  vat?: number;
  couponDiscount?: number;
  paymentId?: string | null;
  paymentStatus?: "unpaid" | "paid" | "refunded";
  meters?: number;
  items?: { title: string; qty: number; price: number }[];
};

export const adminBookings: AdminBooking[] = [];

export const bookingStatusMap: Record<AdminBooking["status"], { label: string; tone: "amber" | "primary" | "violet" | "emerald" | "rose" }> = {
  pending: { label: "بانتظار التأكيد", tone: "amber" },
  confirmed: { label: "مؤكد", tone: "primary" },
  in_progress: { label: "قيد التنفيذ", tone: "primary" },
  review: { label: "قيد المراجعة", tone: "violet" },
  completed: { label: "مكتمل", tone: "emerald" },
  cancelled: { label: "ملغي", tone: "rose" },
};

export const paymentMethods: { value: string; labelAr: string; labelEn: string; aliases?: string[] }[] = [
  { value: "cod", labelAr: "الدفع عند الاستلام", labelEn: "Cash on delivery", aliases: ["cash", "كاش"] },
  { value: "myfatoorah", labelAr: "ماي فاتورة", labelEn: "MyFatoorah", aliases: ["mayfatoorah", "my_fatoorah", "ماي فاتورة"] },
];

export type AdminInvoice = {
  id: string; number: string; orderNumber: string; client: string; email: string;
  phone?: string; city?: string; payment?: string;
  amount: number; status: "paid" | "pending" | "void"; issued: string;
};

export const adminInvoices: AdminInvoice[] = [];

export type AdminClient = {
  id: string; name: string; email: string; phone: string; orders: number;
  totalSpent: number; segment: "vip" | "regular" | "new"; joinedAt: string;
  region?: string; city?: string; language?: string; address?: string; notes?: string;
  role?: string; status?: string; authProvider?: string; avatar?: string; updatedAt?: string;
};

export const adminClients: AdminClient[] = [];

export type AdminPortfolio = {
  id: string; titleAr: string; titleEn: string; category: string; image: string; visible: boolean; link: string;
  cover?: string; description?: string; tech?: string[]; client?: string; year?: string;
};

export const adminPortfolio: AdminPortfolio[] = [];

export const portfolioCategories = [
  "سكني", "مطاعم وكافيهات", "مكاتب إدارية", "محلات تجارية", "فنادق وضيافة", "مشاريع تجارية",
];

export type AdminUser = {
  id: string; name: string; email: string; phone: string;
  role: "owner" | "admin" | "manager" | "support" | "partner" | "client";
  active: boolean; joinedAt: string;
  city?: string;
};

export const adminUsers: AdminUser[] = [];

import React from "react";
import sarLogo from "@/assets/sar.png";

export const fmtSARNumber = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n);

export const fmtSAR = (n: number): React.ReactNode =>
  React.createElement(
    "span",
    { className: "inline-flex items-center gap-1", dir: "ltr" },
    React.createElement("span", { "data-ltr-number": true }, fmtSARNumber(n)),
    React.createElement("img", {
      src: sarLogo,
      alt: "SAR",
      className: "inline-block h-[0.85em] w-auto align-[-0.05em] opacity-90",
      draggable: false,
    })
  );