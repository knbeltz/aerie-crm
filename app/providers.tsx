"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { convex } from "@/lib/convex";

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk
      client={convex}
      useAuth={useAuth as unknown as Parameters<typeof ConvexProviderWithClerk>[0]["useAuth"]}
    >
      {children}
    </ConvexProviderWithClerk>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexClerkProvider>{children}</ConvexClerkProvider>
    </ClerkProvider>
  );
}
