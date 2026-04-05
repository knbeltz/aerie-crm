"use client";

import { useState } from "react";
import { MoreHorizontal, Edit2, Trash2, Bell } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReminderDialog } from "@/components/reminders/ReminderDialog";

interface Field {
  _id: Id<"fields">;
  name: string;
  type: string;
}

interface EntryRowProps {
  entry: {
    _id: Id<"entries">;
    data: Record<string, unknown>;
    createdByName: string;
    updatedAt: number;
  };
  fields: Field[];
  onEdit: () => void;
  canEdit: boolean;
}

export function EntryRow({ entry, fields, onEdit, canEdit }: EntryRowProps) {
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const deleteEntry = useMutation(api.entries.deleteEntry);

  const handleDelete = async () => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    try {
      await deleteEntry({ entryId: entry._id });
      toast.success("Entry deleted");
    } catch {
      toast.error("Failed to delete entry");
    }
  };

  const renderValue = (field: Field): React.ReactNode => {
    const val = entry.data[field.name];
    if (val === null || val === undefined || val === "") {
      return <span className="text-midnight/25">—</span>;
    }
    if (field.type === "boolean") {
      return (
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
            val ? "bg-emerald-100 text-emerald-700" : "bg-active text-midnight/50"
          }`}
        >
          {val ? "Yes" : "No"}
        </span>
      );
    }
    if (field.type === "url") {
      return (
        <a
          href={val as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-crimson underline text-xs truncate max-w-[140px] block"
          onClick={(e) => e.stopPropagation()}
        >
          {(val as string).replace(/^https?:\/\//, "")}
        </a>
      );
    }
    if (field.type === "email") {
      return (
        <a
          href={`mailto:${val as string}`}
          className="text-crimson text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {val as string}
        </a>
      );
    }
    if (Array.isArray(val)) {
      return (
        <div className="flex flex-wrap gap-1">
          {(val as string[]).map((v) => (
            <span
              key={v}
              className="bg-active text-midnight/70 text-xs px-1.5 py-0.5 rounded-md"
            >
              {v}
            </span>
          ))}
        </div>
      );
    }
    return (
      <span className="text-xs text-midnight truncate block max-w-[160px]">
        {String(val)}
      </span>
    );
  };

  return (
    <>
      <tr className="group hover:bg-surface-2/70 transition-colors">
        {fields.map((field) => (
          <td key={field._id} className="px-4 py-3 align-middle">
            {renderValue(field)}
          </td>
        ))}
        <td className="px-4 py-3 align-middle">
          <span className="text-xs text-midnight/40">{entry.createdByName}</span>
        </td>
        <td className="px-4 py-3 align-middle text-right">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-midnight/30 hover:text-midnight hover:bg-active transition-all opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="w-3.5 h-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowReminderDialog(true)}>
                  <Bell className="w-3.5 h-3.5 mr-2" />
                  Set reminder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </td>
      </tr>

      <ReminderDialog
        entryId={entry._id}
        open={showReminderDialog}
        onOpenChange={setShowReminderDialog}
      />
    </>
  );
}
