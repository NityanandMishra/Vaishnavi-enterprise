import React from "react";
import { getFormMetadata } from "../actions";
import ProductForm from "@/components/admin/products/ProductForm";

export const metadata = {
  title: "New Product | Vaishnavi Enterprises Admin",
};

export default async function NewProductPage() {
  const meta = await getFormMetadata();

  return (
    <ProductForm
      categories={meta.categories as any}
      brands={meta.brands as any}
      isEditMode={false}
    />
  );
}
