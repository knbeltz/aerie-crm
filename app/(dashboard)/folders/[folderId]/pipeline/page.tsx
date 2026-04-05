"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Kanban,
  Plus,
  MoreHorizontal,
  Search,
  Check,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNowStrict, isPast, format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = {
  _id: Id<"pipelineStages">;
  name: string;
  color?: string;
  isTerminal: boolean;
  terminalType?: "closed" | "rejected" | "cancelled";
  isDefault?: boolean;
  order: number;
};

type Deal = {
  _id: Id<"deals">;
  title: string;
  company?: string;
  stageId: Id<"pipelineStages">;
  priority: "low" | "medium" | "high" | "urgent";
  stageDeadlineAt?: number;
  assignedTo: Id<"users">[];
  createdAt: number;
};

type Priority = Deal["priority"];

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<Priority, string> = {
  urgent: "bg-red-100 text-red-700",
  high:   "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low:    "bg-active text-midnight/50",
};

const STAGE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeadlineChip({ deadline }: { deadline: number }) {
  const overdue = isPast(deadline);
  const soon = !overdue && deadline - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5",
        overdue ? "bg-red-100 text-red-600" :
        soon    ? "bg-orange-100 text-orange-600" :
                  "bg-active text-midnight/50"
      )}
    >
      {overdue ? <AlertTriangle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
      {overdue
        ? "Overdue"
        : formatDistanceToNowStrict(deadline, { addSuffix: false })}
    </span>
  );
}

// Pure card content — rendered both in-column and in DragOverlay
function DealCard({
  deal,
  isDragging = false,
}: {
  deal: Deal;
  isDragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-surface rounded-xl p-3 border border-active/70 select-none",
        "transition-shadow",
        isDragging
          ? "shadow-2xl rotate-1 border-crimson/20"
          : "shadow-sm hover:shadow-md"
      )}
    >
      {/* Priority + deadline */}
      <div className="flex items-center justify-between gap-1 mb-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center text-[10px] font-semibold rounded-full px-1.5 py-0.5 capitalize",
            PRIORITY_STYLES[deal.priority]
          )}
        >
          {deal.priority}
        </span>
        {deal.stageDeadlineAt && <DeadlineChip deadline={deal.stageDeadlineAt} />}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-midnight leading-snug line-clamp-2 mb-0.5">
        {deal.title}
      </p>

      {/* Company */}
      {deal.company && (
        <p className="text-xs text-midnight/45 truncate">{deal.company}</p>
      )}
    </div>
  );
}

// Draggable wrapper around DealCard
function DraggableDealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal._id,
    data: { deal },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0 : 1 }}
      className="cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <DealCard deal={deal} />
    </div>
  );
}

// Inline editable stage name
function StageNameEditor({
  stage,
  canManage,
  onRename,
  onDelete,
  onAddDeal,
}: {
  stage: Stage;
  canManage: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddDeal: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stage.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== stage.name) onRename(trimmed);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(stage.name);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 mb-3 min-w-0">
      {/* Color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: stage.color ?? "#6366f1" }}
      />

      {/* Name (or inline editor) */}
      {editing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelEdit();
            }}
            onBlur={commitRename}
            className="flex-1 min-w-0 text-sm font-semibold text-midnight bg-active rounded-lg px-2 py-0.5 outline-none"
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
            className="text-midnight/50 hover:text-midnight"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
            className="text-midnight/50 hover:text-midnight"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p
          className="text-sm font-semibold text-midnight truncate flex-1 min-w-0"
          title={stage.name}
        >
          {stage.name}
        </p>
      )}

      {/* Deal count */}
      {!editing && (
        <span className="text-xs text-midnight/40 flex-shrink-0 ml-1" />
      )}

      {/* Actions (only owner/admin) */}
      {canManage && !editing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-midnight/30 hover:text-midnight hover:bg-active transition-colors">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[130px]">
            <DropdownMenuItem onClick={() => { setDraft(stage.name); setEditing(true); }}>
              <Pencil className="w-3.5 h-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddDeal}>
              <Plus className="w-3.5 h-3.5 mr-2" />
              Add deal
            </DropdownMenuItem>
            {!stage.isTerminal && !stage.isDefault && stage.name !== "Sourcing" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete stage
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// A droppable stage column
function StageColumn({
  stage,
  deals,
  canManage,
  onAddDeal,
  onRename,
  onDelete,
}: {
  stage: Stage;
  deals: Deal[];
  canManage: boolean;
  onAddDeal: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage._id });

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <StageNameEditor
        stage={stage}
        canManage={canManage}
        onRename={onRename}
        onDelete={onDelete}
        onAddDeal={onAddDeal}
      />

      {/* Deal count badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-midnight/40">
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
        </span>
        {stage.isTerminal && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-midnight/25 bg-active rounded-full px-1.5 py-0.5">
            terminal
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-[120px] rounded-xl p-2 transition-colors duration-150 flex-1",
          isOver
            ? "bg-crimson/5 ring-1 ring-crimson/25"
            : stage.isTerminal
            ? "bg-active/30"
            : "bg-active/20"
        )}
      >
        {deals.map((deal) => (
          <DraggableDealCard key={deal._id} deal={deal} />
        ))}

        {/* Empty state hint for drop target */}
        {deals.length === 0 && !isOver && (
          <p className="text-xs text-midnight/25 text-center py-4">
            Drop here
          </p>
        )}
      </div>

      {/* Add deal footer */}
      <button
        onClick={onAddDeal}
        className="mt-2 flex items-center gap-1.5 text-xs font-medium text-midnight/40 hover:text-midnight/70 hover:bg-active rounded-lg px-2 py-1.5 transition-colors w-full"
      >
        <Plus className="w-3.5 h-3.5" />
        Add deal
      </button>
    </div>
  );
}

// ─── Add Deal Dialog ──────────────────────────────────────────────────────────

function AddDealDialog({
  folderId,
  stageId,
  stages,
  onClose,
}: {
  folderId: Id<"folders">;
  stageId: Id<"pipelineStages">;
  stages: Stage[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const createDeal = useMutation(api.deals.createDeal);
  const stage = stages.find((s) => s._id === stageId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createDeal({
        folderId,
        title: title.trim(),
        company: company.trim() || undefined,
        stageId,
        priority,
        stageDeadlineAt: deadline ? new Date(deadline).getTime() : undefined,
      });
      toast.success("Deal added");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add deal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Deal</DialogTitle>
          {stage && (
            <DialogDescription>
              Adding to{" "}
              <span
                className="font-semibold"
                style={{ color: stage.color ?? "#6366f1" }}
              >
                {stage.name}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-title">Deal title *</Label>
            <Input
              id="deal-title"
              placeholder="e.g. Acme Series A"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-company">Company</Label>
            <Input
              id="deal-company"
              placeholder="e.g. Acme Inc."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deal-deadline">Deadline</Label>
              <Input
                id="deal-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || saving}>
              {saving ? "Adding…" : "Add Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Stage Inline Form ────────────────────────────────────────────────────

function AddStageInline({
  usedColors,
  onAdd,
  onCancel,
}: {
  usedColors: string[];
  onAdd: (name: string, color: string) => void;
  onCancel: () => void;
}) {
  const nextColor =
    STAGE_COLORS.find((c) => !usedColors.includes(c)) ?? STAGE_COLORS[0];

  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && name.trim()) onAdd(name.trim(), nextColor);
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="flex-shrink-0 w-64">
      <div className="bg-surface-2 rounded-xl p-3 border border-active">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: nextColor }}
          />
          <p className="text-xs text-midnight/50 font-medium">New stage</p>
        </div>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Stage name…"
          className="w-full text-sm text-midnight bg-active rounded-lg px-2.5 py-1.5 outline-none placeholder:text-midnight/30 mb-2"
        />
        <div className="flex gap-2">
          <button
            onClick={() => name.trim() && onAdd(name.trim(), nextColor)}
            disabled={!name.trim()}
            className="flex-1 text-xs font-semibold bg-midnight text-surface rounded-lg py-1.5 disabled:opacity-40 hover:bg-deep transition-colors"
          >
            Add
          </button>
          <button
            onClick={onCancel}
            className="flex-1 text-xs font-semibold bg-active text-midnight rounded-lg py-1.5 hover:bg-active/70 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const params = useParams();
  const folderId = params.folderId as Id<"folders">;

  const stages = useQuery(api.pipeline.getPipelineStages, { folderId });
  const dealsFromDb = useQuery(api.deals.getFolderDeals, { folderId });
  const myRole = useQuery(api.members.getMyRole, { folderId });

  const moveDealMutation  = useMutation(api.deals.moveDeal);
  const createDealMutation = useMutation(api.deals.createDeal);
  const createStageMutation = useMutation(api.pipeline.createPipelineStage);
  const renameStageMutation = useMutation(api.pipeline.renameStage);
  const deleteStageMutation = useMutation(api.pipeline.deleteStage);

  const [search, setSearch] = useState("");
  const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addDealFor, setAddDealFor] = useState<Id<"pipelineStages"> | null>(null);
  const [addingStage, setAddingStage] = useState(false);

  const canManage = myRole === "owner" || myRole === "admin";
  const isLoading = stages === undefined || dealsFromDb === undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Apply search filter
  const filteredDeals = useMemo(() => {
    if (!dealsFromDb) return [];
    if (!search.trim()) return dealsFromDb as Deal[];
    const q = search.toLowerCase();
    return (dealsFromDb as Deal[]).filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.company?.toLowerCase().includes(q) ?? false)
    );
  }, [dealsFromDb, search]);

  // Apply optimistic stage overrides
  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const stage of stages ?? []) {
      map[stage._id as string] = [];
    }
    for (const deal of filteredDeals) {
      const effectiveStage = stageOverrides[deal._id as string] ?? (deal.stageId as string);
      if (map[effectiveStage]) {
        map[effectiveStage].push(deal);
      }
    }
    return map;
  }, [stages, filteredDeals, stageOverrides]);

  const activeDeal = activeId
    ? (dealsFromDb as Deal[])?.find((d) => (d._id as string) === activeId)
    : null;

  // ─── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const dealId = active.id as string;
    const newStageId = over.id as string;
    const deal = (dealsFromDb as Deal[])?.find((d) => (d._id as string) === dealId);
    if (!deal) return;

    const currentStageId = stageOverrides[dealId] ?? (deal.stageId as string);
    if (currentStageId === newStageId) return;

    // Optimistic move
    setStageOverrides((prev) => ({ ...prev, [dealId]: newStageId }));

    try {
      await moveDealMutation({
        dealId: dealId as Id<"deals">,
        stageId: newStageId as Id<"pipelineStages">,
      });
      setStageOverrides((prev) => {
        const next = { ...prev };
        delete next[dealId];
        return next;
      });
    } catch (err: unknown) {
      setStageOverrides((prev) => {
        const next = { ...prev };
        delete next[dealId];
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Failed to move deal");
    }
  }

  // ─── Stage handlers ─────────────────────────────────────────────────────────

  async function handleRenameStage(stageId: Id<"pipelineStages">, name: string) {
    try {
      await renameStageMutation({ stageId, folderId, name });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to rename stage");
    }
  }

  async function handleDeleteStage(stageId: Id<"pipelineStages">, name: string) {
    if (!confirm(`Delete stage "${name}"? Deals in this stage will be moved to Sourcing.`)) return;
    try {
      await deleteStageMutation({ stageId, folderId });
      toast.success(`Stage "${name}" deleted`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete stage");
    }
  }

  async function handleAddStage(name: string, color: string) {
    setAddingStage(false);
    try {
      await createStageMutation({ folderId, name, color });
      toast.success(`Stage "${name}" added`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add stage");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Kanban className="w-5 h-5 text-midnight/40" />
            <h1 className="font-manrope font-extrabold text-2xl text-midnight">
              Pipeline
            </h1>
          </div>
          <p className="text-sm text-midnight/50">
            Track deals across customizable pipeline stages.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-midnight/35 pointer-events-none" />
          <input
            type="text"
            placeholder="Search deals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 pr-3 text-sm rounded-xl bg-surface-2 text-midnight placeholder:text-midnight/35 border border-active/60 focus:outline-none focus:border-crimson/50 transition-colors w-52"
          />
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-64">
              <div className="h-4 w-24 bg-active rounded animate-pulse mb-3" />
              <div className="bg-active/20 rounded-xl p-2 min-h-[120px]" />
            </div>
          ))}
        </div>
      )}

      {/* Board */}
      {!isLoading && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-6 items-start">
            {(stages as Stage[]).map((stage) => (
              <StageColumn
                key={stage._id as string}
                stage={stage}
                deals={dealsByStage[stage._id as string] ?? []}
                canManage={canManage}
                onAddDeal={() => setAddDealFor(stage._id)}
                onRename={(name) => handleRenameStage(stage._id, name)}
                onDelete={() => handleDeleteStage(stage._id, stage.name)}
              />
            ))}

            {/* Add stage */}
            {canManage && (
              addingStage ? (
                <AddStageInline
                  usedColors={(stages as Stage[]).map((s) => s.color ?? "")}
                  onAdd={handleAddStage}
                  onCancel={() => setAddingStage(false)}
                />
              ) : (
                <button
                  onClick={() => setAddingStage(true)}
                  className="flex-shrink-0 flex items-center gap-2 h-9 px-3 text-sm font-medium text-midnight/40 hover:text-midnight/70 hover:bg-active rounded-xl transition-colors border border-dashed border-active"
                >
                  <Plus className="w-4 h-4" />
                  Add stage
                </button>
              )
            )}
          </div>

          {/* Drag overlay — follows cursor */}
          <DragOverlay dropAnimation={null}>
            {activeDeal && (
              <div className="w-60 cursor-grabbing">
                <DealCard deal={activeDeal} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add deal dialog */}
      {addDealFor && stages && (
        <AddDealDialog
          folderId={folderId}
          stageId={addDealFor}
          stages={stages as Stage[]}
          onClose={() => setAddDealFor(null)}
        />
      )}
    </div>
  );
}
