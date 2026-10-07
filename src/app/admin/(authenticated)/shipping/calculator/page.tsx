import React, { Suspense } from "react";
import { ShippingCalculator } from "@/components/admin/shipping";

export const metadata = {
  title: "Rate Calculator | Vaishnavi Enterprises",
};

export default function AdminShippingCalculatorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-gray-500">Loading calculator...</div>}>
      <ShippingCalculator />
    </Suspense>
  );
}
