"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Barcode,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { INDIAN_STATES, getStateCodeByName } from "@/lib/tax/indian-states";
import { resolveShippingRate } from "@/lib/orders/shipping-resolver";

interface ProductVariantOption {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  availableStock: number;
  productId: string;
  productTitle: string;
}

interface OrderItemRow {
  productId: string;
  variantId?: string | null;
  productTitle: string;
  variantTitle?: string | null;
  sku: string;
  quantity: number;
  listPrice: number;
  unitPrice: number;
  lineDiscount: number;
  availableStock: number;
}

export default function ManualOrderCreationPage() {
  const router = useRouter();

  // Section 1: Customer State
  const [customerMode, setCustomerMode] = useState<"NEW" | "EXISTING">("NEW");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerUserId, setCustomerUserId] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [existingCustomers, setExistingCustomers] = useState<any[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<any>(null);

  // Section 2: Items State
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductVariantOption[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Section 3: Delivery & Payment State
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [sameAsShipping, setSameAsShipping] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [paymentStatus, setPaymentStatus] = useState("PENDING");
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [transactionRef, setTransactionRef] = useState("");
  const [shippingCharge, setShippingCharge] = useState<number>(49);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [customerNote, setCustomerNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search products / variants
  useEffect(() => {
    if (!productSearch || productSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const res = await fetch(`/api/admin/products?search=${encodeURIComponent(productSearch.trim())}&limit=8`);
        const data = await res.json();
        if (data.products) {
          const flatVariants: ProductVariantOption[] = [];
          for (const p of data.products) {
            if (p.variants && p.variants.length > 0) {
              for (const v of p.variants) {
                const onHand = v.inventories?.[0]?.onHand ?? v.stock ?? 0;
                const reserved = v.inventories?.[0]?.reserved ?? 0;
                flatVariants.push({
                  id: v.id,
                  title: v.title,
                  sku: v.sku,
                  price: v.price ?? p.basePrice,
                  availableStock: Math.max(0, onHand - reserved),
                  productId: p.id,
                  productTitle: p.title,
                });
              }
            } else {
              flatVariants.push({
                id: "",
                title: "Default",
                sku: `SKU-${p.id.slice(0, 6)}`,
                price: p.basePrice,
                availableStock: 99,
                productId: p.id,
                productTitle: p.title,
              });
            }
          }
          setSearchResults(flatVariants);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  // Check pincode on change to calculate shipping
  const handlePincodeChange = (code: string) => {
    setPincode(code);
    if (code.length === 6) {
      const res = resolveShippingRate(code, state);
      if (res.serviceable) {
        setShippingCharge(res.rate);
      }
    }
  };

  const handleStateChange = (newState: string) => {
    setState(newState);
    if (pincode.length === 6) {
      const res = resolveShippingRate(pincode, newState);
      if (res.serviceable) {
        setShippingCharge(res.rate);
      }
    }
  };

  // Add item row
  const handleAddItem = (variant: ProductVariantOption) => {
    if (variant.availableStock <= 0) return;

    const existingIdx = items.findIndex(
      (i) => i.productId === variant.productId && i.variantId === (variant.id || null)
    );

    if (existingIdx >= 0) {
      const updated = [...items];
      const newQty = updated[existingIdx].quantity + 1;
      if (newQty > variant.availableStock) {
        alert(`Only ${variant.availableStock} available in stock.`);
        return;
      }
      updated[existingIdx].quantity = newQty;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: variant.productId,
          variantId: variant.id || null,
          productTitle: variant.productTitle,
          variantTitle: variant.title !== "Default" ? variant.title : null,
          sku: variant.sku || `SKU-${variant.productId.slice(0, 6)}`,
          quantity: 1,
          listPrice: variant.price,
          unitPrice: variant.price,
          lineDiscount: 0,
          availableStock: variant.availableStock,
        },
      ]);
    }

    setProductSearch("");
    setSearchResults([]);
  };

  const handleUpdateItem = (index: number, field: keyof OrderItemRow, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Live Calculations
  const sellerStateCode = "27"; // Maharashtra
  const deliveryStateCode = getStateCodeByName(state) || "27";
  const isInterState = deliveryStateCode !== sellerStateCode;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalLineDiscounts = items.reduce((sum, item) => sum + item.lineDiscount, 0);
  const taxableValue = Math.max(0, subtotal - totalLineDiscounts - orderDiscount);

  // Standard GST 18% estimation for live display (exact snapshot is calculated by GST engine on server)
  const estimatedGstRate = 18;
  const estimatedTax = Math.round((taxableValue * estimatedGstRate) / 100 * 100) / 100;
  const grandTotal = Math.round((taxableValue + estimatedTax + shippingCharge) * 100) / 100;

  const handleSubmitOrder = async () => {
    setError(null);

    if (!customerName || !customerPhone) {
      setError("Customer name and phone number are required.");
      return;
    }

    if (!/^\d{10}$/.test(customerPhone.trim())) {
      setError("Enter a 10-digit mobile number.");
      return;
    }

    if (items.length === 0) {
      setError("Add at least one product to the order.");
      return;
    }

    if (!addressLine1 || !pincode || !city || !state) {
      setError("Complete the shipping address fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer: {
          userId: customerUserId,
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail.trim() || null,
        },
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineDiscount: i.lineDiscount,
        })),
        shippingAddress: {
          fullName: customerName,
          phone: customerPhone,
          addressLine1,
          addressLine2,
          landmark,
          pincode: pincode.trim(),
          city,
          state,
        },
        billingAddress: sameAsShipping
          ? null
          : {
              fullName: customerName,
              phone: customerPhone,
              addressLine1,
              addressLine2,
              landmark,
              pincode: pincode.trim(),
              city,
              state,
            },
        paymentMethod,
        paymentStatus,
        shippingCharge,
        orderDiscount,
        customerNote,
        amountReceived: paymentStatus === "PAID" ? grandTotal : amountReceived,
        transactionRef,
        actor: "Admin",
        source: "MANUAL",
      };

      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      router.push(`/admin/orders/${data.order.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to place manual order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/orders"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Orders
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-900">New Order</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Create Manual Order</h1>
          <p className="text-xs text-slate-500">
            For phone negotiations, walk-in counter sales, and offline invoices.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Sections (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1: CUSTOMER */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                1. Customer Details
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerMode("NEW")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    customerMode === "NEW"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  New customer
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone (10 digits) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="rajesh@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: ITEMS */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3 mb-4">
              2. Order Items
            </h2>

            {/* Product & SKU Search Field */}
            <div className="relative mb-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search product name or scan SKU with barcode reader..."
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-slate-800 focus:outline-hidden"
                />
                {searchingProducts && (
                  <Loader2 size={16} className="animate-spin absolute right-3 top-3 text-slate-400" />
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((variant, idx) => {
                    const isOos = variant.availableStock <= 0;
                    return (
                      <div
                        key={`${variant.productId}-${variant.id || idx}`}
                        onClick={() => !isOos && handleAddItem(variant)}
                        className={`p-3 flex items-center justify-between transition-colors ${
                          isOos
                            ? "bg-slate-50/60 opacity-60 cursor-not-allowed"
                            : "hover:bg-slate-50 cursor-pointer"
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs text-slate-900">
                            {variant.productTitle}
                            {variant.title && (
                              <span className="text-slate-500 font-normal"> · {variant.title}</span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                            {variant.sku || "NO-SKU"} ·{" "}
                            {isOos ? (
                              <span className="text-rose-600 font-semibold">Out of stock</span>
                            ) : (
                              <span className="text-emerald-700 font-medium">
                                {variant.availableStock} available
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {formatINR(variant.price)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Items Table */}
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                No items added yet. Search a product or scan a SKU above.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {items.map((item, idx) => {
                  const isPriceOverridden = item.unitPrice !== item.listPrice;
                  const itemTotal = item.unitPrice * item.quantity - item.lineDiscount;

                  return (
                    <div key={idx} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
                      <div className="flex-1 min-w-[180px]">
                        <div className="font-semibold text-xs text-slate-900">
                          {item.productTitle}
                          {item.variantTitle && (
                            <span className="text-slate-500 font-normal"> · {item.variantTitle}</span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          {item.sku} · {item.availableStock} in stock
                        </div>
                      </div>

                      {/* Pricing, Quantity, and Deviations */}
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit Price</label>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              className={`w-20 rounded border px-2 py-1 text-xs font-mono font-bold ${
                                isPriceOverridden
                                  ? "border-amber-400 bg-amber-50 text-amber-900"
                                  : "border-slate-300 text-slate-900"
                              }`}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Qty</label>
                          <input
                            type="number"
                            min="1"
                            max={item.availableStock}
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(idx, "quantity", parseInt(e.target.value, 10) || 1)
                            }
                            className="w-14 rounded border border-slate-300 px-2 py-1 text-xs font-mono text-center text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Disc (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={item.lineDiscount}
                            onChange={(e) =>
                              handleUpdateItem(idx, "lineDiscount", parseFloat(e.target.value) || 0)
                            }
                            className="w-16 rounded border border-slate-300 px-2 py-1 text-xs font-mono text-slate-900"
                          />
                        </div>

                        <div className="text-right min-w-[70px]">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Total</label>
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {formatINR(itemTotal)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: DELIVERY & PAYMENT */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">
              3. Delivery & Payment
            </h2>

            {/* Address Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address line 1 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Flat, Building, Street"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Address line 2</label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Area / Colony"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Landmark</label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Near hospital, metro, etc."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pincode <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    placeholder="6 digits"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono focus:border-slate-800 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* State Tax Indicator */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700 flex items-center justify-between">
                <span>
                  Delivery State: <strong>{state}</strong> (Code {deliveryStateCode})
                </span>
                <span className="font-medium text-slate-900">
                  {isInterState ? "⚠️ Inter-state · IGST applies" : "Intra-state · CGST + SGST applies"}
                </span>
              </div>
            </div>

            {/* Payment Options */}
            <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                >
                  <option value="COD">Cash on Delivery (COD)</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="NETBANKING">Netbanking</option>
                  <option value="WALLET">Wallet</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CASH">Counter Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-800 focus:outline-hidden"
                >
                  <option value="PENDING">Pending (Payment uncollected)</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Paid (Full payment received)</option>
                </select>
              </div>

              {(paymentStatus === "PAID" || paymentStatus === "PARTIALLY_PAID") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount Received (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono focus:border-slate-800 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Transaction Ref / UTR
                    </label>
                    <input
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="e.g. UPI_129384729"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-mono focus:border-slate-800 focus:outline-hidden"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Live Summary Panel (1 Col) */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3 mb-3">
              Order Summary
            </h3>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600 font-sans">
                <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items):</span>
                <span className="font-mono font-medium text-slate-900">{formatINR(subtotal)}</span>
              </div>

              {totalLineDiscounts > 0 && (
                <div className="flex justify-between text-emerald-700 font-sans">
                  <span>Line discounts:</span>
                  <span className="font-mono">− {formatINR(totalLineDiscounts)}</span>
                </div>
              )}

              {/* Order discount input */}
              <div className="flex items-center justify-between font-sans pt-1">
                <span className="text-slate-600">Order discount:</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">− ₹</span>
                  <input
                    type="number"
                    min="0"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                    className="w-20 rounded border border-slate-300 px-2 py-0.5 text-right font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between text-slate-600 font-sans border-t border-slate-100 pt-2">
                <span>Taxable Value:</span>
                <span className="font-mono font-semibold text-slate-900">{formatINR(taxableValue)}</span>
              </div>

              <div className="flex justify-between text-slate-600 font-sans">
                <span>
                  {isInterState ? "IGST @ 18% (inter-state):" : "CGST + SGST (intra-state):"}
                </span>
                <span className="font-mono font-medium text-slate-900">{formatINR(estimatedTax)}</span>
              </div>

              {/* Shipping charge input */}
              <div className="flex items-center justify-between font-sans pt-1">
                <span className="text-slate-600">Shipping:</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={shippingCharge}
                    onChange={(e) => setShippingCharge(parseFloat(e.target.value) || 0)}
                    className="w-20 rounded border border-slate-300 px-2 py-0.5 text-right font-mono text-xs"
                  />
                </div>
              </div>

              <div className="border-t-2 border-slate-900 pt-3 flex justify-between text-base font-bold text-slate-900">
                <span className="font-sans">Total:</span>
                <span>{formatINR(grandTotal)}</span>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={submitting || items.length === 0}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>Place Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
