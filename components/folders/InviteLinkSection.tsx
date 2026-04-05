"use client";

import { useState } from "react";
import { Copy, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGenerateInviteCode } from "@/hooks/useFolders";
import { Id } from "@/convex/_generated/dataModel";

interface InviteLinkSectionProps {
  folderId: Id<"folders">;
  inviteCode: string;
  isOwner: boolean;
}

export function InviteLinkSection({ folderId, inviteCode, isOwner }: InviteLinkSectionProps) {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const generateNewCode = useGenerateInviteCode();

  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/invite/${inviteCode}`
    : `https://aerie.app/invite/${inviteCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await generateNewCode(folderId);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="bg-surface-2 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-manrope font-semibold text-sm text-midnight">
            Invite link
          </h3>
          <p className="text-xs text-midnight/50 mt-0.5">
            Share this link to invite people as editors
          </p>
        </div>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="text-midnight/50 hover:text-midnight"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 bg-active rounded-lg px-3 py-2">
        <code className="text-xs text-midnight/70 flex-1 truncate font-mono">
          {inviteLink}
        </code>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 text-midnight/50 hover:text-midnight transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-xs text-midnight/35 mt-2">
        Invite code: <span className="font-mono font-medium text-midnight/60">{inviteCode}</span>
      </p>
    </div>
  );
}
