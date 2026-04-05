"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Settings, Shield, Bell, Trash2, GripVertical, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { InviteLinkSection } from "@/components/folders/InviteLinkSection";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="h-7 w-32 bg-surface-2 rounded-lg animate-pulse mb-2" />
      <div className="h-4 w-52 bg-surface-2 rounded animate-pulse mb-8" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-2 rounded-xl p-5 mb-4 animate-pulse">
          <div className="h-5 w-28 bg-active rounded mb-4" />
          <div className="space-y-3">
            <div className="h-9 bg-active rounded-lg" />
            <div className="h-9 bg-active rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 mb-4 ${
        danger ? "bg-surface-2 border border-red-200" : "bg-surface-2"
      }`}
    >
      <div className="mb-4">
        <h2
          className={`font-manrope font-semibold text-sm ${
            danger ? "text-red-600" : "text-midnight"
          }`}
        >
          {title}
        </h2>
        {description && (
          <p className="text-xs text-midnight/50 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-active/40 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <Label
          htmlFor={id}
          className="text-sm text-midnight font-medium cursor-pointer"
        >
          {label}
        </Label>
        {description && (
          <p className="text-xs text-midnight/45 mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

// ─── Stage reorder item ───────────────────────────────────────────────────────

type StageItem = {
  _id: Id<"pipelineStages">;
  name: string;
  color?: string;
  isDefault?: boolean;
  order: number;
};

function SortableStageRow({ stage }: { stage: StageItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2.5 border-b border-active/40 last:border-0"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-midnight/25 hover:text-midnight/50 transition-colors cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: stage.color ?? "#6366f1" }}
      />
      <span className="text-sm text-midnight flex-1">{stage.name}</span>
      {stage.isDefault && (
        <span className="text-[10px] text-midnight/35 font-medium uppercase tracking-wide flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" />
          default
        </span>
      )}
    </div>
  );
}

// ─── Stage Order section ──────────────────────────────────────────────────────

function StageOrderSection({ folderId }: { folderId: Id<"folders"> }) {
  const stages = useQuery(api.pipeline.getPipelineStages, { folderId });
  const reorderStages = useMutation(api.pipeline.reorderStages);

  const [localOrder, setLocalOrder] = useState<StageItem[]>([]);

  // Sync local order from server whenever stages load/change
  useEffect(() => {
    if (stages) {
      setLocalOrder(
        (stages as StageItem[]).filter((s) => !("isTerminal" in s && (s as any).isTerminal))
      );
    }
  }, [stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localOrder.findIndex((s) => s._id === active.id);
    const newIndex = localOrder.findIndex((s) => s._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localOrder, oldIndex, newIndex);
    setLocalOrder(reordered);

    try {
      await reorderStages({
        folderId,
        stageOrders: reordered.map((s, i) => ({ stageId: s._id, order: i })),
      });
    } catch {
      // Revert on failure
      if (stages) {
        setLocalOrder(
          (stages as StageItem[]).filter((s) => !(s as any).isTerminal)
        );
      }
      toast.error("Failed to save stage order");
    }
  }

  const terminalStages = (stages as StageItem[] | undefined)?.filter(
    (s) => (s as any).isTerminal
  ) ?? [];

  if (!stages) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-active rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localOrder.map((s) => s._id)}
          strategy={verticalListSortingStrategy}
        >
          {localOrder.map((stage) => (
            <SortableStageRow key={stage._id} stage={stage} />
          ))}
        </SortableContext>
      </DndContext>

      {/* Terminal stages — always last, not reorderable */}
      {terminalStages.length > 0 && (
        <div className="mt-2 pt-2">
          <p className="text-[10px] text-midnight/30 uppercase tracking-wide font-medium mb-1.5">
            Terminal (always last)
          </p>
          {terminalStages.map((stage) => (
            <div
              key={stage._id}
              className="flex items-center gap-3 py-2 opacity-40"
            >
              <div className="w-4 h-4 flex-shrink-0" /> {/* spacer for grip */}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color ?? "#6b7280" }}
              />
              <span className="text-sm text-midnight">{stage.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FolderSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.folderId as Id<"folders">;

  const folder = useQuery(api.folders.getFolder, { folderId });
  const settings = useQuery(api.folderSettings.getFolderSettings, { folderId });
  const myRole = useQuery(api.members.getMyRole, { folderId });

  const updateFolder = useMutation(api.folders.updateFolder);
  const updateSettings = useMutation(api.folderSettings.updateFolderSettings);
  const deleteFolder = useMutation(api.folders.deleteFolder);
  const ensureSettings = useMutation(api.folderSettings.ensureFolderSettings);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Auto-initialize settings for legacy folders that were created before
  // folderSettings seeding was added to createFolder.
  useEffect(() => {
    if (folder && settings === null) {
      ensureSettings({ folderId }).catch(() => {
        // Silent — the page will keep showing skeleton and retry on next render
      });
    }
  }, [folder, settings, folderId, ensureSettings]);

  useEffect(() => {
    if (folder) {
      setName(folder.name ?? "");
      setDescription(folder.description ?? "");
    }
  }, [folder]);

  const isLoading =
    folder === undefined || settings === undefined || myRole === undefined;

  // Show skeleton while loading OR while waiting for settings to be initialized
  if (isLoading || (folder !== undefined && folder !== null && settings === null)) {
    return <PageSkeleton />;
  }
  if (!folder) return null;

  const isOwner = myRole === "owner";
  const canManage = myRole === "owner" || myRole === "admin";

  const generalDirty =
    name.trim() !== (folder.name ?? "") ||
    description.trim() !== (folder.description ?? "");

  async function handleSaveGeneral() {
    if (!generalDirty) return;
    setSavingGeneral(true);
    try {
      await updateFolder({
        folderId,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      });
      toast.success("Folder updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update folder");
    } finally {
      setSavingGeneral(false);
    }
  }

  async function handleTogglePermission(
    key:
      | "whoCanCreateDeals"
      | "whoCanEditDeals"
      | "whoCanMoveDeals"
      | "whoCanInviteMembers",
    checked: boolean
  ) {
    try {
      await updateSettings({
        folderId,
        [key]: checked ? "all_members" : "admins_only",
      });
    } catch {
      toast.error("Failed to update permission");
    }
  }

  async function handleToggleNotification(
    key: "notifyOnDealCreated" | "notifyOnDealMoved" | "notifyOnMemberAdded",
    checked: boolean
  ) {
    try {
      await updateSettings({ folderId, [key]: checked });
    } catch {
      toast.error("Failed to update notification setting");
    }
  }

  async function handleDeleteFolder() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${folder.name}"? This cannot be undone. All deals, pipeline stages, schema, and members will be permanently removed.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteFolder({ folderId });
      toast.success("Folder deleted");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete folder");
      setDeleting(false);
    }
  }

  // At this point settings is guaranteed non-null (either existed or was just created)
  const s = settings!;

  return (
    <div className="animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-5 h-5 text-midnight/40" />
        <h1 className="font-manrope font-extrabold text-2xl text-midnight">
          Settings
        </h1>
      </div>
      <p className="text-sm text-midnight/50 mb-6">
        Manage folder details, permissions, and notifications.
      </p>

      {/* General */}
      <Section title="General" description="Folder name, description, and invite link.">
        <div className="space-y-3">
          <div>
            <Label
              htmlFor="folder-name"
              className="text-xs text-midnight/50 mb-1.5 block"
            >
              Folder name
            </Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Folder name"
              disabled={!canManage}
            />
          </div>
          <div>
            <Label
              htmlFor="folder-description"
              className="text-xs text-midnight/50 mb-1.5 block"
            >
              Description
            </Label>
            <Input
              id="folder-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description (optional)"
              disabled={!canManage}
            />
          </div>
          {canManage && (
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleSaveGeneral}
                disabled={!generalDirty || savingGeneral}
              >
                {savingGeneral ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5">
          <InviteLinkSection
            folderId={folderId}
            inviteCode={folder.inviteCode as string}
            isOwner={isOwner}
          />
        </div>
      </Section>

      {/* Permissions */}
      {canManage && (
        <Section
          title="Permissions"
          description="Control what members can do in this folder."
        >
          <div className="flex items-center gap-1.5 mb-3">
            <Shield className="w-3.5 h-3.5 text-midnight/40" />
            <span className="text-xs text-midnight/40">
              On = all members &nbsp;·&nbsp; Off = admins only
            </span>
          </div>
          <ToggleRow
            id="perm-create-deals"
            label="Create deals"
            description="Allow editors and viewers to create new deals"
            checked={s.whoCanCreateDeals === "all_members"}
            onCheckedChange={(checked) =>
              handleTogglePermission("whoCanCreateDeals", checked)
            }
          />
          <ToggleRow
            id="perm-edit-deals"
            label="Edit deals"
            description="Allow editors and viewers to edit deal details"
            checked={s.whoCanEditDeals === "all_members"}
            onCheckedChange={(checked) =>
              handleTogglePermission("whoCanEditDeals", checked)
            }
          />
          <ToggleRow
            id="perm-move-deals"
            label="Move deals"
            description="Allow editors and viewers to move deals between stages"
            checked={s.whoCanMoveDeals === "all_members"}
            onCheckedChange={(checked) =>
              handleTogglePermission("whoCanMoveDeals", checked)
            }
          />
          <ToggleRow
            id="perm-invite"
            label="Invite members"
            description="Allow all members to share the invite link"
            checked={s.whoCanInviteMembers === "all_members"}
            onCheckedChange={(checked) =>
              handleTogglePermission("whoCanInviteMembers", checked)
            }
          />
        </Section>
      )}

      {/* Stage Order */}
      {canManage && (
        <Section
          title="Stage Order"
          description="Drag to reorder non-terminal pipeline stages. The pipeline board reflects this order."
        >
          <StageOrderSection folderId={folderId} />
        </Section>
      )}

      {/* Notifications */}
      <Section
        title="Notifications"
        description="Choose which events create folder notifications."
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Bell className="w-3.5 h-3.5 text-midnight/40" />
          <span className="text-xs text-midnight/40">
            Applies to all members of this folder
          </span>
        </div>
        <ToggleRow
          id="notif-deal-created"
          label="Deal created"
          description="Notify when a new deal is added to the pipeline"
          checked={s.notifyOnDealCreated}
          onCheckedChange={(checked) =>
            handleToggleNotification("notifyOnDealCreated", checked)
          }
          disabled={!canManage}
        />
        <ToggleRow
          id="notif-deal-moved"
          label="Deal moved"
          description="Notify when a deal changes pipeline stage"
          checked={s.notifyOnDealMoved}
          onCheckedChange={(checked) =>
            handleToggleNotification("notifyOnDealMoved", checked)
          }
          disabled={!canManage}
        />
        <ToggleRow
          id="notif-member-added"
          label="Member joined"
          description="Notify when someone joins the folder"
          checked={s.notifyOnMemberAdded}
          onCheckedChange={(checked) =>
            handleToggleNotification("notifyOnMemberAdded", checked)
          }
          disabled={!canManage}
        />
        {!canManage && (
          <p className="text-xs text-midnight/40 mt-3">
            Only admins and owners can change notification settings.
          </p>
        )}
      </Section>

      {/* Danger Zone */}
      {isOwner && (
        <Section
          title="Danger zone"
          description="Permanent actions that cannot be undone."
          danger
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-midnight font-medium">Delete this folder</p>
              <p className="text-xs text-midnight/45 mt-0.5">
                Permanently removes all deals, stages, schema, entries, and members.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteFolder}
              disabled={deleting}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "Deleting…" : "Delete folder"}
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}
