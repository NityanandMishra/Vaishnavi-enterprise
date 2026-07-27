"use client";

import { usePathname } from "next/navigation";
import { Bell, Settings, HelpCircle } from "lucide-react";

interface AdminHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export default function AdminHeader({ user }: AdminHeaderProps) {
  const pathname = usePathname();

  // Get Breadcrumbs & Title based on the path
  const getHeaderDetails = () => {
    if (pathname === "/admin") {
      return { breadcrumb: "Overview", title: "Dashboard" };
    }
    if (pathname.startsWith("/admin/products")) {
      if (pathname.includes("/new")) {
        return { breadcrumb: "Catalog / Products / New", title: "Add New Product" };
      }
      if (pathname.includes("/edit")) {
        return { breadcrumb: "Catalog / Products / Edit", title: "Edit Product" };
      }
      return { breadcrumb: "Catalog / Products", title: "Products Catalog" };
    }
    if (pathname.startsWith("/admin/images")) {
      return { breadcrumb: "Media Library", title: "Images" };
    }
    if (pathname.startsWith("/admin/brands")) {
      return { breadcrumb: "Catalog / Brands", title: "Brands" };
    }
    if (pathname.startsWith("/admin/categories")) {
      return { breadcrumb: "Catalog / Categories & Subcategories", title: "Categories & Subcategories" };
    }
    if (pathname.startsWith("/admin/orders")) {
      if (pathname.match(/\/orders\/[^\/]+/)) {
        return { breadcrumb: "Sales / Orders / Details", title: "Order Details" };
      }
      return { breadcrumb: "Sales / Orders", title: "Orders Management" };
    }
    if (pathname.startsWith("/admin/leads")) {
      if (pathname.match(/\/leads\/[^\/]+/)) {
        return { breadcrumb: "Customer Leads / Details", title: "Lead Details" };
      }
      return { breadcrumb: "Customer Leads", title: "Inquiries & Leads" };
    }
    return { breadcrumb: "Admin Portal", title: "Vaishnavi Enterprises" };
  };

  const { breadcrumb, title } = getHeaderDetails();
  const userName = user?.name ?? "Admin User";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AU";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-8 py-[18px] flex items-center justify-between flex-wrap gap-16 flex-shrink-0">
      {/* Breadcrumb and Title */}
      <div>
        <p className="m-0 text-[11px] font-bold tracking-[0.08em] text-[#94A3B8] uppercase mb-[4px]">
          {breadcrumb}
        </p>
        <h2 className="m-0 text-2xl font-semibold tracking-[-0.01em] text-[#0F172A] font-sans">
          {title}
        </h2>
      </div>

      {/* Profile & Icons */}
      <div className="flex items-center gap-5 ml-auto">
        <div className="flex items-center gap-1 text-[#475569]">
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors relative" title="Notifications">
            <Bell size={20} />
            <span className="absolute top-[6px] right-[6px] w-2.5 h-2.5 bg-[#EA580C] rounded-full border-2 border-white"></span>
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Settings">
            <Settings size={20} />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Help">
            <HelpCircle size={20} />
          </button>
        </div>

        {/* Divider */}
        <div className="w-[1px] h-8 bg-[#E2E8F0]"></div>

        {/* User Info */}
        <div className="flex items-center gap-[10px]">
          <div className="text-right hidden sm:block">
            <p className="m-0 text-[14px] font-bold text-[#0F172A]">
              {userName}
            </p>
            <p className="m-0 text-[12px] text-[#64748B]">
              Administrator
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center font-bold text-[13px] flex-shrink-0">
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}
