import StorefrontHeader from "@/components/store/StorefrontHeader";
import StorefrontFooter from "@/components/store/StorefrontFooter";
import StorefrontMobileBottomNav from "@/components/store/StorefrontMobileBottomNav";
import WhatsAppFloatingButton from "@/components/store/WhatsAppFloatingButton";
import { getNavCategories } from "@/lib/nav";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Fetched here rather than in the header, which is a client component.
  const categories = await getNavCategories();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--fg)]">
      <StorefrontHeader categories={categories} />
      <main className="flex-1 gap-nav">
        {children}
      </main>
      <StorefrontFooter />
      <StorefrontMobileBottomNav />
      <WhatsAppFloatingButton />
    </div>
  );
}
