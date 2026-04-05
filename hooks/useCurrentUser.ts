"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useCurrentUser() {
  const user = useQuery(api.users.getCurrentUser);
  const isLoading = user === undefined;

  return {
    user: user ?? null,
    isLoading,
  };
}
