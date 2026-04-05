"use client";

import { useRouter } from "next/navigation";
import { Users, Table, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface FolderCardProps {
  folder: {
    _id: string;
    name: string;
    description?: string;
    updatedAt: number;
    memberCount: number;
    tableCount: number;
    role: string;
  };
}

export function FolderCard({ folder }: FolderCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/folders/${folder._id}`)}
      className="w-full text-left bg-surface-2 rounded-xl p-5 hover:bg-active transition-all duration-150 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 bg-midnight rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-surface text-sm font-manrope font-bold">
            {folder.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <Badge variant={folder.role === "owner" ? "default" : "secondary"} className="text-xs">
          {folder.role}
        </Badge>
      </div>

      <h3 className="font-manrope font-bold text-base text-midnight mb-1 group-hover:text-deep transition-colors">
        {folder.name}
      </h3>
      {folder.description && (
        <p className="text-sm text-midnight/50 line-clamp-2 mb-4">
          {folder.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-midnight/40">
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {folder.memberCount} member{folder.memberCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <Table className="w-3.5 h-3.5" />
          {folder.tableCount} table{folder.tableCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <Clock className="w-3.5 h-3.5" />
          {formatDistanceToNow(new Date(folder.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </button>
  );
}
