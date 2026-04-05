"use client";

import { AlertTriangle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

interface DuplicateEntry {
  _id: string;
  data: Record<string, unknown>;
  createdByName: string;
  createdAt: number;
}

interface DuplicateWarningProps {
  duplicates: DuplicateEntry[];
  onDismiss: () => void;
  onProceed: () => void;
}

export function DuplicateWarning({ duplicates, onDismiss, onProceed }: DuplicateWarningProps) {
  return (
    <div className="bg-amber-50 rounded-xl p-4 border-l-4 border-amber-400">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-amber-900 mb-1">
            Possible duplicate detected
          </h4>
          <p className="text-xs text-amber-700 mb-3">
            {duplicates.length === 1
              ? "An entry with matching data already exists in this table:"
              : `${duplicates.length} entries with matching data already exist in this table:`}
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {duplicates.map((entry) => {
              const name = entry.data.name as string | undefined;
              const email = entry.data.email as string | undefined;
              return (
                <div
                  key={entry._id}
                  className="bg-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800"
                >
                  <span className="font-medium">
                    {name ?? email ?? "Unnamed entry"}
                  </span>
                  {email && name && (
                    <span className="text-amber-600 ml-1">— {email}</span>
                  )}
                  <span className="text-amber-500 ml-2">
                    Added by {entry.createdByName},{" "}
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onDismiss}
              className="text-xs"
            >
              Go back
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onProceed}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              Add anyway
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-amber-400 hover:text-amber-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
