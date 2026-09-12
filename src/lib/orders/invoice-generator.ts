import { prisma } from "@/lib/db";

/**
 * Returns Indian Financial Year string (e.g. "26-27" or "2026-27").
 * Indian FY starts 1 April and ends 31 March.
 */
export function getCurrentFinancialYear(date: Date = new Date()): { full: string; short: string } {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 3 = Apr

  let startYear: number;
  let endYear: number;

  if (month >= 3) {
    // April (3) onwards belongs to current year - next year
    startYear = year;
    endYear = year + 1;
  } else {
    // Jan - March belongs to previous year - current year
    startYear = year - 1;
    endYear = year;
  }

  const shortStart = String(startYear).slice(-2);
  const shortEnd = String(endYear).slice(-2);

  return {
    full: `${startYear}-${shortEnd}`,
    short: `${shortStart}-${shortEnd}`,
  };
}

/**
 * Converts a positive number to Indian Rupee words.
 * e.g. 1950.76 -> "Rupees One Thousand Nine Hundred Fifty and Seventy-Six Paise Only"
 */
export function numberToIndianWords(amount: number): string {
  if (amount === 0) return "Rupees Zero Only";

  const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const twoDigits = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tensMultiple = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(num: number): string {
    if (num < 10) return singleDigits[num];
    if (num >= 10 && num < 20) return twoDigits[num - 10];
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return `${tensMultiple[tens]}${ones > 0 ? " " + singleDigits[ones] : ""}`;
  }

  function convertGroup(num: number): string {
    let result = "";
    if (num >= 100) {
      const hundreds = Math.floor(num / 100);
      result += `${singleDigits[hundreds]} Hundred `;
      num = num % 100;
    }
    if (num > 0) {
      result += convertTwoDigits(num);
    }
    return result.trim();
  }

  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let words = "";

  // Crores (>= 1,00,00,000)
  const crores = Math.floor(rupees / 10000000);
  let rem = rupees % 10000000;

  // Lakhs (>= 1,00,000)
  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;

  // Thousands (>= 1,000)
  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;

  // Hundreds and units
  const hundreds = rem;

  if (crores > 0) {
    words += `${convertTwoDigits(crores)} Crore `;
  }
  if (lakhs > 0) {
    words += `${convertTwoDigits(lakhs)} Lakh `;
  }
  if (thousands > 0) {
    words += `${convertTwoDigits(thousands)} Thousand `;
  }
  if (hundreds > 0) {
    words += `${convertGroup(hundreds)} `;
  }

  words = words.trim();
  if (words.length === 0) words = "Zero";

  let finalStr = `Rupees ${words}`;
  if (paise > 0) {
    finalStr += ` and ${convertTwoDigits(paise)} Paise`;
  }
  finalStr += " Only";

  return finalStr;
}

export interface InvoiceLineItem {
  id: string;
  productName: string;
  variantTitle?: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxableValue: number;
  hsnCode: string;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  lineTotal: number;
}

export interface InvoiceDataPayload {
  invoiceNumber: string;
  financialYear: string;
  sequenceNumber: number;
  date: string;
  orderNumber: string;
  seller: {
    name: string;
    tradeName?: string;
    address: string;
    city: string;
    state: string;
    stateCode: string;
    pincode: string;
    gstin: string;
    email: string;
    phone: string;
  };
  buyer: {
    name: string;
    phone: string;
    email?: string | null;
    shippingAddress: any;
    deliveryStateCode: string;
    deliveryState: string;
    gstin?: string | null;
  };
  items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  shipping: number;
  total: number;
  totalInWords: string;
  isInterState: boolean;
}

/**
 * ORD-11 / FR-18 / FR-19 / FR-20:
 * Generates an immutable, gapless sequential GST tax invoice for an order.
 * If invoice already exists for the order, returns existing record.
 */
export async function generateOrderInvoice(orderId: string, actor: string = "System") {
  // Check if invoice already exists (immutable)
  const existing = await prisma.invoice.findUnique({
    where: { orderId },
  });
  if (existing) {
    return {
      success: true,
      invoice: existing,
      alreadyExisted: true,
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: {
          status: "ACTIVE", // Exclude cancelled lines (ORD-11 AC 4)
        },
      },
      user: true,
    },
  });

  if (!order) {
    throw new Error(`Order #${orderId} not found`);
  }

  const taxSettings = await prisma.taxSettings.findFirst();
  const sellerStateCode = taxSettings?.sellerStateCode || "27";
  const sellerGstin = taxSettings?.sellerGstin || "27AABCV1234K1Z5";

  let shippingAddr: any = {};
  try {
    shippingAddr = typeof order.shippingAddress === "string" ? JSON.parse(order.shippingAddress) : order.shippingAddress;
  } catch (e) {
    shippingAddr = {};
  }

  const deliveryStateCode = order.deliveryStateCode || "27";
  const isInterState = deliveryStateCode !== sellerStateCode;

  const fy = getCurrentFinancialYear(order.placedAt || new Date());
  const financialYearStr = fy.full;

  return await prisma.$transaction(async (tx) => {
    // Re-check in transaction to prevent race conditions
    const doubleCheck = await tx.invoice.findUnique({ where: { orderId } });
    if (doubleCheck) return { success: true, invoice: doubleCheck, alreadyExisted: true };

    // Find highest sequenceNumber in this financial year
    const lastInvoice = await tx.invoice.findFirst({
      where: { financialYear: financialYearStr },
      orderBy: { sequenceNumber: "desc" },
    });

    const nextSeq = (lastInvoice?.sequenceNumber || 0) + 1;
    const paddedSeq = String(nextSeq).padStart(4, "0");
    const invoiceNumber = `VE/${fy.short}/${paddedSeq}`;

    // Map active lines with snapshot values (FI-01)
    const invoiceLines: InvoiceLineItem[] = order.items.map((item) => {
      return {
        id: item.id,
        productName: item.productName || "Product",
        variantTitle: item.variantTitle,
        sku: item.sku || "SKU",
        quantity: item.quantity - (item.cancelledQty || 0),
        unitPrice: item.price,
        taxableValue: item.taxableValue || item.price * (item.quantity - (item.cancelledQty || 0)),
        hsnCode: item.hsnCode || "8536",
        gstRate: item.gstRate || 18,
        cgstAmount: item.cgstAmount || 0,
        sgstAmount: item.sgstAmount || 0,
        igstAmount: item.igstAmount || 0,
        cessAmount: item.cessAmount || 0,
        lineTotal: item.lineTotal || (item.price * item.quantity),
      };
    });

    const subtotal = invoiceLines.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const taxableTotal = invoiceLines.reduce((s, i) => s + i.taxableValue, 0);
    const cgstTotal = invoiceLines.reduce((s, i) => s + i.cgstAmount, 0);
    const sgstTotal = invoiceLines.reduce((s, i) => s + i.sgstAmount, 0);
    const igstTotal = invoiceLines.reduce((s, i) => s + i.igstAmount, 0);
    const cessTotal = invoiceLines.reduce((s, i) => s + i.cessAmount, 0);
    const taxTotal = cgstTotal + sgstTotal + igstTotal + cessTotal;

    const grandTotal = order.totalAmount;
    const totalInWords = numberToIndianWords(grandTotal);

    const payload: InvoiceDataPayload = {
      invoiceNumber,
      financialYear: financialYearStr,
      sequenceNumber: nextSeq,
      date: new Date().toISOString(),
      orderNumber: order.orderNumber || order.id,
      seller: {
        name: "Vaishnavi Enterprises",
        tradeName: "Vaishnavi Electricals & Hardware",
        address: "Shop No. 4, Commercial Complex, MG Road",
        city: "Mumbai",
        state: "Maharashtra",
        stateCode: sellerStateCode,
        pincode: "400001",
        gstin: sellerGstin,
        email: "sales@vaishnavienterprises.in",
        phone: "+91 98200 12345",
      },
      buyer: {
        name: order.customerName || shippingAddr.fullName || order.user?.name || "Customer",
        phone: order.customerPhone || shippingAddr.phone || order.user?.phone || "",
        email: order.customerEmail || order.user?.email,
        shippingAddress: shippingAddr,
        deliveryStateCode,
        deliveryState: shippingAddr.state || "Maharashtra",
        gstin: null,
      },
      items: invoiceLines,
      subtotal,
      discount: order.discountAmount,
      taxableValue: taxableTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      cessTotal,
      shipping: order.shippingCost,
      total: grandTotal,
      totalInWords,
      isInterState,
    };

    const invoice = await tx.invoice.create({
      data: {
        orderId,
        invoiceNumber,
        financialYear: financialYearStr,
        sequenceNumber: nextSeq,
        totalAmount: grandTotal,
        taxAmount: taxTotal,
        invoiceData: JSON.stringify(payload),
      },
    });

    // Record timeline entry (ORD-09)
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        toStatus: order.status,
        reason: "Invoice generated",
        note: `Tax invoice ${invoiceNumber} issued for ${totalInWords}`,
        createdBy: actor,
      },
    });

    return {
      success: true,
      invoice,
      alreadyExisted: false,
    };
  });
}
