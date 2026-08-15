import StorefrontHeader from "@/components/store/StorefrontHeader";
import StorefrontFooter from "@/components/store/StorefrontFooter";
import StorefrontMobileBottomNav from "@/components/store/StorefrontMobileBottomNav";
import WhatsAppFloatingButton from "@/components/store/WhatsAppFloatingButton";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-alt">
      <StorefrontHeader />
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <StorefrontFooter />
      <StorefrontMobileBottomNav />
      <WhatsAppFloatingButton />
    </div>
  );
}
