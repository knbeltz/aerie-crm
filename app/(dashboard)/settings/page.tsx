"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { user, isLoading } = useCurrentUser();

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="font-manrope font-extrabold text-2xl text-midnight mb-1">
        Settings
      </h1>
      <p className="text-sm text-midnight/50 mb-8">
        Manage your account preferences.
      </p>

      <section className="bg-surface-2 rounded-xl p-6 mb-6">
        <h2 className="font-manrope font-bold text-base text-midnight mb-4">
          Profile
        </h2>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <div className="h-4 w-48 bg-active rounded animate-pulse" />
            <div className="h-4 w-64 bg-active rounded animate-pulse" />
          </div>
        ) : user ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-midnight rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-surface text-lg font-manrope font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-midnight">{user.name}</p>
              <p className="text-sm text-midnight/50">{user.email}</p>
              <Badge variant="secondary" className="mt-1.5 text-xs">
                Member since{" "}
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </Badge>
            </div>
          </div>
        ) : (
          <p className="text-sm text-midnight/40">No user data found.</p>
        )}
      </section>

      <section className="bg-surface-2 rounded-xl p-6">
        <h2 className="font-manrope font-bold text-base text-midnight mb-2">
          About Aerie
        </h2>
        <p className="text-sm text-midnight/50 leading-relaxed">
          Aerie is the deal flow OS for Eagle Venture Seed Fund. Built for speed, collaboration,
          and signal over noise. Version 0.1.0.
        </p>
      </section>
    </div>
  );
}
