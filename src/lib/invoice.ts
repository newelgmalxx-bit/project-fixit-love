import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import type { Order } from "@/data/account";
import { paymentName } from "@/data/account";
import type { InvoiceData } from "@/components/invoice/InvoiceDocument";

/**
 * Render any DOM node into a single-page A4 PDF.
 * Uses html-to-image (SVG foreignObject) to preserve Arabic text shaping
 * — html2canvas breaks Arabic ligatures by drawing glyphs without joining.
 */
async function renderElementToPdf(node: HTMLElement): Promise<jsPDF> {
  const rect = node.getBoundingClientRect();
  const width = Math.max(node.scrollWidth, Math.ceil(rect.width));
  const height = Math.max(node.scrollHeight, Math.ceil(rect.height));
  const imgData = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
    width,
    height,
    style: {
      transform: "none",
      margin: "0",
    },
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load rendered invoice image"));
    img.src = imgData;
  });
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = img.width / img.height;
  let w = pageW;
  let h = pageW / ratio;
  if (h > pageH) {
    h = pageH;
    w = pageH * ratio;
  }
  const x = (pageW - w) / 2;
  pdf.addImage(imgData, "PNG", x, 0, w, h);
  return pdf;
}

export async function downloadElementAsPdf(node: HTMLElement, fileName: string) {
  const pdf = await renderElementToPdf(node);
  pdf.save(fileName);
}

export async function elementToPdfBlob(node: HTMLElement): Promise<Blob> {
  const pdf = await renderElementToPdf(node);
  return pdf.output("blob");
}

/** Build invoice data from a customer Order. */
export function orderToInvoiceData(order: Order, clientName: string): InvoiceData {
  return {
    number: order.number,
    date: order.createdAt,
    clientName,
    paymentMethod: paymentName(order.payment),
    paymentStatus: order.paid ? "paid" : (order.paymentStatus ?? "unpaid"),
    items: order.items.map((it) => ({
      title: `${it.serviceTitle}${it.planName ? " — " + it.planName : ""}`,
      qty: it.qty,
      price: it.price,
    })),
    subtotal: order.subtotal,
    vat: order.vat,
    total: order.total,
    branchName: order.branchName,
    branchAddress: order.branchAddress,
    branchPhone: order.branchPhone,
  };
}

/**
 * Convenience helper used by older call sites: render an off-screen
 * InvoiceDocument with the given data, snapshot to PDF, then clean up.
 */
export async function downloadInvoice(order: Order, clientName: string) {
  const { renderInvoiceToPdf } = await import("./renderInvoice");
  await renderInvoiceToPdf(orderToInvoiceData(order, clientName));
}