import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Root route: send signed-in users to the dashboard, everyone else to sign-in.
// The marketing landing page has been removed — the app is internal.
export default async function RootPage() {
  const { userId } = await auth();
  redirect(userId ? "/dashboard" : "/sign-in");
}
