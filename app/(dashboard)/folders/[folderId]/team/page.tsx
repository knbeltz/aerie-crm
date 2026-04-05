"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Users, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Role = "owner" | "admin" | "editor" | "viewer";

const ROLE_BADGE: Record<Role, string> = {
  owner:  "bg-midnight text-surface",
  admin:  "bg-crimson/10 text-crimson font-semibold",
  editor: "bg-deep/10 text-deep",
  viewer: "bg-active text-midnight/50",
};

// Roles that a caller can assign to someone else
function assignableRoles(callerRole: Role, targetRole: Role): Role[] {
  if (targetRole === "owner") return []; // owner badge is read-only
  if (callerRole === "owner") return ["admin", "editor", "viewer"];
  if (callerRole === "admin" && targetRole !== "admin") return ["editor", "viewer"];
  return [];
}

function canRemove(callerRole: Role, targetRole: Role, isSelf: boolean): boolean {
  if (isSelf) return false;
  if (targetRole === "owner") return false;
  if (callerRole === "owner") return true;
  if (callerRole === "admin" && (targetRole === "editor" || targetRole === "viewer")) return true;
  return false;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0].slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-midnight/10 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-midnight uppercase">{initials}</span>
    </div>
  );
}

export default function TeamPage() {
  const params = useParams();
  const folderId = params.folderId as Id<"folders">;

  const members = useQuery(api.members.getFolderMembers, { folderId });

  const updateRole = useMutation(api.members.updateMemberRole);
  const removeMemberMutation = useMutation(api.members.removeMember);

  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const callerRole = members?.[0]?.callerRole as Role | undefined;

  async function handleRoleChange(targetUserId: Id<"users">, newRole: Role) {
    setChangingRole(targetUserId);
    try {
      await updateRole({ folderId, targetUserId, newRole: newRole as "admin" | "editor" | "viewer" });
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update role");
    } finally {
      setChangingRole(null);
    }
  }

  async function handleRemove(targetUserId: Id<"users">, name: string) {
    setRemoving(targetUserId);
    try {
      await removeMemberMutation({ folderId, targetUserId });
      toast.success(`${name} removed from folder`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to remove member");
    } finally {
      setRemoving(null);
    }
  }

  const isLoading = members === undefined;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-midnight/40" />
          <h1 className="font-manrope font-extrabold text-2xl text-midnight">
            Team
          </h1>
        </div>
        <p className="text-sm text-midnight/50">
          Manage folder members and their roles.
        </p>
      </div>

      <div className="bg-surface-2 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto] items-center px-5 py-2.5 border-b border-active/60">
          <p className="text-xs font-semibold text-midnight/40 uppercase tracking-wider">
            Member
          </p>
          <p className="text-xs font-semibold text-midnight/40 uppercase tracking-wider w-36 text-center">
            Role
          </p>
          <div className="w-9" />
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto] items-center px-5 py-4 border-b border-active/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-active animate-pulse flex-shrink-0" />
                  <div>
                    <div className="h-3.5 w-28 bg-active rounded animate-pulse mb-1.5" />
                    <div className="h-3 w-36 bg-active/60 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-5 w-14 bg-active rounded-full animate-pulse mx-auto" />
                <div className="w-9" />
              </div>
            ))}
          </>
        )}

        {/* Member rows */}
        {!isLoading &&
          members
            .slice()
            .sort((a, b) => {
              const order: Record<Role, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 };
              return (order[a!.role as Role] ?? 4) - (order[b!.role as Role] ?? 4);
            })
            .map((member) => {
              if (!member) return null;
              const memberRole = member.role as Role;
              const rolesAvailable = callerRole
                ? assignableRoles(callerRole, memberRole)
                : [];
              const showRemove = callerRole
                ? canRemove(callerRole, memberRole, false) // isSelf handled below
                : false;

              // Prevent self-removal (compare callerRole — if this member is the caller)
              // We don't have callerId directly, but owner role is unique per folder,
              // so we check if caller is owner and this is owner row.
              // Simpler: always show remove unless it's the only owner row.
              const isOwnerRow = memberRole === "owner";

              return (
                <div
                  key={member.userId}
                  className="grid grid-cols-[1fr_auto_auto] items-center px-5 py-3.5 border-b border-active/30 last:border-0"
                >
                  {/* Identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    {member.imageUrl ? (
                      <img
                        src={member.imageUrl}
                        alt={member.name}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <Initials name={member.name} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-midnight truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-midnight/40 truncate">{member.email}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="w-36 flex justify-center">
                    {rolesAvailable.length > 0 ? (
                      <Select
                        value={memberRole}
                        onValueChange={(v) =>
                          handleRoleChange(member.userId, v as Role)
                        }
                        disabled={changingRole === member.userId}
                      >
                        <SelectTrigger className="h-7 text-xs w-28 bg-transparent border-0 border-b border-active/60 focus:border-crimson rounded-none px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {rolesAvailable.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs capitalize">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE[memberRole]}`}
                      >
                        {memberRole}
                      </span>
                    )}
                  </div>

                  {/* Remove */}
                  <div className="w-9 flex justify-center">
                    {showRemove && !isOwnerRow ? (
                      <button
                        onClick={() => handleRemove(member.userId, member.name)}
                        disabled={removing === member.userId}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-midnight/30 hover:text-crimson hover:bg-crimson/5 transition-colors disabled:opacity-40"
                        title={`Remove ${member.name}`}
                      >
                        {removing === member.userId ? (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-crimson/30 border-t-crimson animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              );
            })}

        {/* Empty state */}
        {!isLoading && members.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-midnight/30">No members found</p>
          </div>
        )}
      </div>

      <p className="text-xs text-midnight/30 mt-3 text-center">
        Invite new members via the folder invite link on the overview page.
      </p>
    </div>
  );
}
