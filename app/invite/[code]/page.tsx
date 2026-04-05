"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

type JoinState = "idle" | "joining" | "success" | "error" | "already_member";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const { isLoaded, isSignedIn } = useUser();
  const joinFolder = useMutation(api.folders.joinByInviteCode);

  const [state, setState] = useState<JoinState>("idle");
  const [folderId, setFolderId] = useState<Id<"folders"> | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || state !== "idle") return;

    setState("joining");
    joinFolder({ inviteCode: code })
      .then((id) => {
        setFolderId(id);
        setState("success");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        if (msg === "Already a member") {
          setState("already_member");
        } else {
          setErrorMsg(msg);
          setState("error");
        }
      });
  }, [isLoaded, isSignedIn, state, code, joinFolder]);

  useEffect(() => {
    if ((state === "success" || state === "already_member") && folderId) {
      const timer = setTimeout(() => {
        router.push(`/folders/${folderId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
    // For already_member without knowing folderId, redirect to dashboard
    if (state === "already_member" && !folderId) {
      router.push("/dashboard");
    }
  }, [state, folderId, router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-8 h-8 bg-midnight rounded-lg flex items-center justify-center">
            <span className="text-surface text-xs font-manrope font-bold">A</span>
          </div>
          <span className="font-manrope font-extrabold text-xl text-midnight tracking-tight">
            Aerie
          </span>
        </div>

        {!isLoaded && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-midnight/30 animate-spin" />
            <p className="text-sm text-midnight/50">Loading...</p>
          </div>
        )}

        {isLoaded && !isSignedIn && (
          <div className="bg-surface-2 rounded-2xl p-8">
            <h1 className="font-manrope font-bold text-xl text-midnight mb-2">
              You&apos;ve been invited
            </h1>
            <p className="text-sm text-midnight/50 mb-6">
              Sign in to Aerie to accept this invite and join the workspace.
            </p>
            <SignInButton
              mode="modal"
              forceRedirectUrl={`/invite/${code}`}
            >
              <button className="w-full px-5 py-2.5 bg-midnight text-surface text-sm font-semibold rounded-xl hover:bg-deep transition-colors">
                Sign in to continue
              </button>
            </SignInButton>
          </div>
        )}

        {isLoaded && isSignedIn && state === "joining" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-midnight/30 animate-spin" />
            <p className="text-sm text-midnight/50">Joining workspace...</p>
          </div>
        )}

        {isLoaded && isSignedIn && (state === "success" || state === "already_member") && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-midnight rounded-xl flex items-center justify-center mb-2">
              <span className="text-surface text-xl">✓</span>
            </div>
            <h1 className="font-manrope font-bold text-xl text-midnight">
              {state === "success" ? "You're in!" : "Already a member"}
            </h1>
            <p className="text-sm text-midnight/50">Redirecting to your workspace...</p>
            <Loader2 className="w-4 h-4 text-midnight/30 animate-spin mt-1" />
          </div>
        )}

        {isLoaded && isSignedIn && state === "error" && (
          <div className="bg-surface-2 rounded-2xl p-8">
            <div className="w-12 h-12 bg-crimson/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-crimson text-xl">✕</span>
            </div>
            <h1 className="font-manrope font-bold text-xl text-midnight mb-2">
              Invalid invite
            </h1>
            <p className="text-sm text-midnight/50 mb-6">
              {errorMsg || "This invite link is invalid or has expired."}
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full px-5 py-2.5 bg-midnight text-surface text-sm font-semibold rounded-xl hover:bg-deep transition-colors"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
