"use client";

import { ownerWhatsAppUrl } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

export default function WhatsAppFloatingButton() {
  return (
    <a
      href={ownerWhatsAppUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 flex items-center justify-center w-14 h-14 rounded-full bg-whatsapp shadow-2xl transition-transform hover:scale-110 active:scale-95"
    >
      <MessageCircle size={28} fill="white" color="white" />
    </a>
  );
}
