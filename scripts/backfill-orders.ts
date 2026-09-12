import { prisma } from "../src/lib/db";

async function backfill() {
  console.log("Backfilling existing orders with order numbers and snapshot defaults...");
  const orders = await prisma.order.findMany({
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      user: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${orders.length} orders.`);

  let index = 1;
  for (const order of orders) {
    let orderNum = order.orderNumber;
    if (!orderNum) {
      orderNum = `VE-2026-${String(index).padStart(4, "0")}`;
    }

    let shippingObj: any = {};
    try {
      shippingObj = typeof order.shippingAddress === "string" ? JSON.parse(order.shippingAddress) : order.shippingAddress;
    } catch {
      shippingObj = {};
    }

    const customerName = order.customerName || shippingObj.fullName || order.user?.name || "Customer";
    const customerPhone = order.customerPhone || shippingObj.phone || order.user?.phone || "9800000000";
    const customerEmail = order.customerEmail || order.user?.email || null;
    const deliveryStateCode = order.deliveryStateCode || "27";

    const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const taxTotal = order.items.reduce((s, i) => s + (i.cgstAmount || 0) + (i.sgstAmount || 0) + (i.igstAmount || 0) + (i.cessAmount || 0), 0);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        orderNumber: orderNum,
        customerName,
        customerPhone,
        customerEmail,
        deliveryStateCode,
        subtotalAmount: subtotal,
        taxAmount: taxTotal,
        paidAmount: order.status === "CONFIRMED" || order.status === "PACKED" || order.status === "SHIPPED" || order.status === "DELIVERED" ? order.totalAmount : 0,
        balanceAmount: order.status === "CONFIRMED" || order.status === "PACKED" || order.status === "SHIPPED" || order.status === "DELIVERED" ? 0 : order.totalAmount,
      },
    });

    for (const item of order.items) {
      const prodName = item.productName || item.product?.title || "Item";
      const vTitle = item.variantTitle || item.variant?.title || null;
      const sku = item.sku || item.variant?.sku || `SKU-${item.id.slice(0, 6)}`;
      const lineTotal = item.lineTotal || (item.price * item.quantity);

      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          productName: prodName,
          variantTitle: vTitle,
          sku,
          lineTotal,
        },
      });
    }

    index++;
  }

  console.log("Backfill completed successfully!");
}

backfill()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
