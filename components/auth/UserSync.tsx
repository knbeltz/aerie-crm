"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Syncs the authenticated Clerk user into the Convex `users` table.
 * Must be rendered inside both ClerkProvider and ConvexProvider.
 * Safe to render on every page load — uses upsert logic server-side.
 */
export function UserSync() {
  const { user, isLoaded } = useUser();
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const primaryEmail = user.primaryEmailAddress?.emailAddress;
    if (!primaryEmail) return;

    createOrUpdateUser({
      clerkId: user.id,
      email: primaryEmail,
      name: user.fullName ?? user.username ?? primaryEmail,
      imageUrl: user.imageUrl ?? undefined,
    }).catch(console.error);
  }, [isLoaded, user, createOrUpdateUser]);

  return null;
}
