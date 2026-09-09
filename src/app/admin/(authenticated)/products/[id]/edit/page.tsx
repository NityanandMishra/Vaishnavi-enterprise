import React from "react";
import { notFound } from "next/navigation";
import { getProductDetails, getFormMetadata } from "../../actions";
import ProductForm from "@/components/admin/products/ProductForm";

interface EditProductPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const [productRes, metaRes] = await Promise.all([
    getProductDetails(id),
    getFormMetadata(),
  ]);

  if (!productRes.success || !productRes.product) {
    notFound();
  }

  return (
    <ProductForm
      initialProduct={productRes.product}
      categories={metaRes.categories as any}
      brands={metaRes.brands as any}
      isEditMode={true}
    />
  );
}
