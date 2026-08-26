import { redirect } from "next/navigation";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const callbackUrl = searchParams.callbackUrl || "/admin";
  const errorQuery = searchParams.error ? `&error=${searchParams.error}` : "";
  redirect(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}${errorQuery}`);
}
