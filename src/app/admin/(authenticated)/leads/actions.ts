"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getLeads() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, leads };
  } catch (error: any) {
    console.error("Error fetching leads:", error);
    return { success: false, error: error.message || "Failed to fetch leads" };
  }
}

export async function getLeadDetails(id: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            title: true,
            basePrice: true,
            isAvailable: true,
            images: {
              where: {
                isMain: true,
              },
              include: {
                image: true,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    return { success: true, lead };
  } catch (error: any) {
    console.error(`Error fetching details for lead ${id}:`, error);
    return { success: false, error: error.message || "Failed to fetch lead details" };
  }
}

export async function updateLeadStatus(id: string, status: string) {
  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${id}`);
    return { success: true, lead };
  } catch (error: any) {
    console.error(`Error updating status for lead ${id}:`, error);
    return { success: false, error: error.message || "Failed to update lead status" };
  }
}

export async function updateLeadNotes(
  id: string,
  data: {
    ownerNotes?: string | null;
    followupDate?: string | null; // ISO Date string from client
  }
) {
  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ownerNotes: data.ownerNotes || null,
        followupDate: data.followupDate ? new Date(data.followupDate) : null,
      },
    });

    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${id}`);
    return { success: true, lead };
  } catch (error: any) {
    console.error(`Error updating notes for lead ${id}:`, error);
    return { success: false, error: error.message || "Failed to update lead notes" };
  }
}
