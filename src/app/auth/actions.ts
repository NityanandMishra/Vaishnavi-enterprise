"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function registerCustomer(_prev: unknown, formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const { name, email, phone, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { id: true },
  });
  if (existing) {
    return { ok: false as const, error: "An account with these details already exists." };
  }

  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 10),
      role: "CUSTOMER",
    },
  });

  return { ok: true as const };
}
