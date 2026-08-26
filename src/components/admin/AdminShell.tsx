"use client";

import React, { useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import { ToastProvider } from "./ui/Toast";

interface AdminShellProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  children: React.ReactNode;
}

export default function AdminShell({ user, children }: AdminShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Responsive sidebar auto-collapse logic matching Spec 00 (5.4)
  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      if (width >= 1024 && width < 1280) {
        setIsCollapsed(true); // Auto-collapse to icon rail on 1024–1279px
      } else if (width >= 1280) {
        setIsCollapsed(false); // Full sidebar on >= 1280px
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)] font-sans antialiased">
        {/* Desktop & Tablet Sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
          />
        </div>

        {/* Mobile Overlay Drawer on <1024px */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-[var(--sidebar-width)] h-full bg-[var(--gray-900)]">
              <AdminSidebar
                isCollapsed={false}
                onToggleCollapse={() => setIsMobileDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader
            user={user}
            onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
          />

          <main className="flex-1 p-4 lg:p-6 w-full box-border overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
