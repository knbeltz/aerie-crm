"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  ClipboardList,
  FileText,
  Plus,
  Search,
  Settings,
  Trash2,
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SchemaBuilder, FieldDraft } from "@/components/tables/SchemaBuilder";
import { EntryForm } from "@/components/tables/EntryForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

type Field = {
  _id: Id<"fields">;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
};

type Entry = {
  _id: Id<"entries">;
  data: Record<string, unknown>;
  createdByName: string;
  updatedAt: number;
};

type PipelineStatus = { stageName: string; stageColor: string } | null;

// ─── Cell renderer (mirrors EntryRow logic) ───────────────────────────────────

function CellValue({ value, type }: { value: unknown; type: string }) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-midnight/30">—</span>;
  }
  if (type === "boolean") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
          value ? "bg-emerald-100 text-emerald-700" : "bg-active text-midnight/50"
        )}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (type === "url" && typeof value === "string") {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-crimson hover:underline truncate max-w-[180px] block"
        onClick={(e) => e.stopPropagation()}
      >
        {value.replace(/^https?:\/\//, "")}
      </a>
    );
  }
  if (type === "email" && typeof value === "string") {
    return (
      <a
        href={`mailto:${value}`}
        className="text-crimson hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    );
  }
  if (type === "multiselect" && Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {(value as string[]).map((v) => (
          <span
            key={v}
            className="bg-active text-midnight text-xs px-1.5 py-0.5 rounded"
          >
            {v}
          </span>
        ))}
      </div>
    );
  }
  return (
    <span className="truncate max-w-[200px] block" title={String(value)}>
      {String(value)}
    </span>
  );
}

// ─── EVSF entry row with pipeline status column ───────────────────────────────

function EvsfEntryRow({
  entry,
  fields,
  pipelineStatus,
  canEdit,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  fields: Field[];
  pipelineStatus: PipelineStatus;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="hover:bg-active/20 transition-colors">
      {fields.map((field) => (
        <td
          key={field._id}
          className="px-4 py-3 text-sm text-midnight whitespace-nowrap"
        >
          <CellValue value={entry.data[field.name]} type={field.type} />
        </td>
      ))}

      {/* Added by */}
      <td className="px-4 py-3 text-xs text-midnight/40 whitespace-nowrap">
        {entry.createdByName ?? "—"}
      </td>

      {/* Pipeline status */}
      <td className="px-4 py-3 whitespace-nowrap">
        {pipelineStatus ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-midnight">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: pipelineStatus.stageColor }}
            />
            {pipelineStatus.stageName}
          </span>
        ) : (
          <span className="text-xs text-midnight/30">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-10">
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg text-midnight/30 hover:text-midnight hover:bg-active transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
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
  );
}

// ─── Add EVSF Application dialog (uses createEvsfEntry mutation) ──────────────

function AddApplicationDialog({
  folderId,
  tableId,
  fields,
  onClose,
}: {
  folderId: Id<"folders">;
  tableId: Id<"tables">;
  fields: Field[];
  onClose: () => void;
}) {
  const createEvsfEntry = useMutation(api.evsf.createEvsfEntry);

  // We wrap EntryForm's submit so we can intercept it and call our own mutation.
  // EntryForm handles validation, required fields, and duplicates internally.
  // We pass a custom onSuccess callback — but EntryForm calls createEntry directly.
  //
  // Since we need to use createEvsfEntry instead of createEntry, we build a
  // minimal form here that mirrors EntryForm's field rendering but submits
  // via our EVSF mutation.
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  function setValue(name: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = formData[field.name];
        if (val === undefined || val === null || val === "") {
          toast.error(`"${field.name}" is required`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      await createEvsfEntry({ folderId, tableId, data: formData });
      toast.success("Application added — deal created in Pipeline");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add application");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>
            A deal will be automatically created in the Pipeline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fields.map((field) => (
            <FieldInput
              key={field._id}
              field={field}
              value={formData[field.name]}
              onChange={(val) => setValue(field.name, val)}
            />
          ))}
          {fields.length === 0 && (
            <p className="text-sm text-midnight/40 text-center py-4">
              No fields defined. Add fields to the schema first.
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Adding…" : "Add application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Minimal field input renderer for AddApplicationDialog.
// Uses native HTML elements styled with Tailwind to avoid import complexity.
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-midnight">
        {field.name}
        {field.required && <span className="text-crimson ml-0.5">*</span>}
      </label>

      {(field.type === "text" || field.type === "number") && (
        <input
          type={field.type === "number" ? "number" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) =>
            onChange(
              field.type === "number"
                ? e.target.value
                  ? Number(e.target.value)
                  : ""
                : e.target.value
            )
          }
          required={field.required}
          className="h-9 w-full rounded-xl bg-surface-2 px-3 text-sm text-midnight border-b-2 border-transparent focus:border-crimson focus:bg-active focus:outline-none transition-all"
        />
      )}

      {field.type === "email" && (
        <input
          type="email"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="h-9 w-full rounded-xl bg-surface-2 px-3 text-sm text-midnight border-b-2 border-transparent focus:border-crimson focus:bg-active focus:outline-none transition-all"
        />
      )}

      {field.type === "url" && (
        <input
          type="url"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="h-9 w-full rounded-xl bg-surface-2 px-3 text-sm text-midnight border-b-2 border-transparent focus:border-crimson focus:bg-active focus:outline-none transition-all"
        />
      )}

      {field.type === "date" && (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-xl bg-surface-2 px-3 text-sm text-midnight border-b-2 border-transparent focus:border-crimson focus:bg-active focus:outline-none transition-all"
        />
      )}

      {field.type === "boolean" && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(value as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 accent-[#B80046]"
          />
          <span className="text-sm text-midnight/60">
            {(value as boolean) ? "Yes" : "No"}
          </span>
        </div>
      )}

      {field.type === "select" && field.options && (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-xl bg-surface-2 px-3 text-sm text-midnight border-b-2 border-transparent focus:border-crimson focus:bg-active focus:outline-none transition-all"
        >
          <option value="">Select…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === "multiselect" && field.options && (
        <div className="flex flex-wrap gap-2 p-3 bg-surface-2 rounded-lg">
          {field.options.map((opt) => {
            const selected = ((value as string[]) ?? []).includes(opt);
            return (
              <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current = (value as string[]) ?? [];
                    onChange(
                      e.target.checked
                        ? [...current, opt]
                        : current.filter((v) => v !== opt)
                    );
                  }}
                  className="w-3.5 h-3.5 accent-[#B80046]"
                />
                <span className="text-sm text-midnight">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="h-7 w-56 bg-surface-2 rounded-lg animate-pulse mb-2" />
      <div className="h-4 w-64 bg-surface-2 rounded animate-pulse mb-8" />
      <div className="h-48 bg-surface-2 rounded-xl animate-pulse" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EVSFApplicationsPage() {
  const params = useParams();
  const folderId = params.folderId as Id<"folders">;

  // ─── Queries ────────────────────────────────────────────────────────────────
  const myRole = useQuery(api.members.getMyRole, { folderId });
  const outreachTable = useQuery(api.tables.getOutreachTable, { folderId });
  const evsfTable = useQuery(api.tables.getEvsfTable, { folderId });

  const tableId = evsfTable?._id ?? null;

  const fields = useQuery(
    api.fields.getTableFields,
    tableId ? { tableId } : "skip"
  );
  const allEntries = useQuery(
    api.entries.getTableEntries,
    tableId ? { tableId } : "skip"
  );

  // For pipeline status column
  const deals = useQuery(
    api.deals.getFolderDeals,
    tableId ? { folderId } : "skip"
  );
  const stages = useQuery(
    api.pipeline.getPipelineStages,
    tableId ? { folderId } : "skip"
  );

  // ─── Local state ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [addAppOpen, setAddAppOpen] = useState(false);
  const [editEntryId, setEditEntryId] = useState<Id<"entries"> | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>([]);
  const [savingSchema, setSavingSchema] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // ─── Search ─────────────────────────────────────────────────────────────────
  const searchResults = useQuery(
    api.entries.searchEntries,
    tableId && search.trim() ? { tableId, searchText: search } : "skip"
  );
  const entries = (search.trim()
    ? (searchResults ?? [])
    : (allEntries ?? [])) as Entry[];

  // ─── Pipeline status map ─────────────────────────────────────────────────────
  const entryDealMap = useMemo(() => {
    const stageMap = new Map(
      (stages ?? []).map((s) => [s._id as string, s])
    );
    const map = new Map<string, PipelineStatus>();
    for (const deal of deals ?? []) {
      if ((deal as any).sourceEntryId) {
        const stage = stageMap.get((deal as any).stageId as string);
        if (stage) {
          map.set((deal as any).sourceEntryId as string, {
            stageName: stage.name,
            stageColor: (stage.color as string | undefined) ?? "#6366f1",
          });
        }
      }
    }
    return map;
  }, [deals, stages]);

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const initEvsfTable = useMutation(api.tables.initEvsfTable);
  const deleteEntryMutation = useMutation(api.entries.deleteEntry);
  const createField = useMutation(api.fields.createField);
  const deleteField = useMutation(api.fields.deleteField);

  const canManage = myRole === "owner" || myRole === "admin";
  const canEdit = myRole === "owner" || myRole === "admin" || myRole === "editor";

  // ─── Handlers ───────────────────────────────────────────────────────────────
  async function handleInit(clone: boolean) {
    setInitializing(true);
    try {
      await initEvsfTable({
        folderId,
        cloneFromTableId: clone && outreachTable ? outreachTable._id : undefined,
      });
      toast.success(
        clone
          ? "EVSF Applications initialized from Outreach Schema"
          : "EVSF Applications initialized"
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to initialize");
    } finally {
      setInitializing(false);
    }
  }

  async function handleDeleteEntry(entryId: Id<"entries">) {
    if (!confirm("Delete this application? The linked deal will remain in the pipeline.")) return;
    try {
      await deleteEntryMutation({ entryId });
      toast.success("Application deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleSaveSchema() {
    if (!fields || !tableId) return;
    setSavingSchema(true);
    try {
      const draftIds = new Set(fieldDrafts.map((d) => d.id));
      const toDelete = fields.filter((f) => !draftIds.has(f._id));
      for (const f of toDelete) await deleteField({ fieldId: f._id });

      const existingIds = new Set(fields.map((f) => f._id));
      const newDrafts = fieldDrafts.filter((d) => !existingIds.has(d.id as Id<"fields">));
      for (const draft of newDrafts) {
        if (!draft.name.trim()) continue;
        await createField({
          tableId,
          name: draft.name.trim(),
          type: draft.type,
          required: draft.required,
          options: draft.options.length > 0 ? draft.options : undefined,
        });
      }

      toast.success("Schema saved");
      setSchemaOpen(false);
    } catch {
      toast.error("Failed to save schema");
    } finally {
      setSavingSchema(false);
    }
  }

  // ─── Render states ───────────────────────────────────────────────────────────

  // Loading
  if (
    myRole === undefined ||
    outreachTable === undefined ||
    evsfTable === undefined
  ) {
    return <PageSkeleton />;
  }

  // Gate: no outreach schema
  if (outreachTable === null) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-midnight/40" />
            <h1 className="font-manrope font-extrabold text-2xl text-midnight">
              EVSF Applications
            </h1>
          </div>
          <p className="text-sm text-midnight/50">
            Applications submitted to the Eagle Venture Seed Fund.
          </p>
        </div>
        <div className="bg-surface-2 rounded-xl p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-active rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-5 h-5 text-midnight/40" />
          </div>
          <p className="font-manrope font-semibold text-midnight mb-1">
            Set up Outreach Schema first
          </p>
          <p className="text-sm text-midnight/50 max-w-sm mb-5">
            EVSF Applications starts as a copy of your Outreach Schema. Create
            the Outreach Schema before initializing this section.
          </p>
          <Button asChild variant="secondary">
            <Link href={`/folders/${folderId}/outreach-schema`}>
              <FileText className="w-3.5 h-3.5" />
              Go to Outreach Schema
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Init: outreach exists but EVSF table not yet created
  if (evsfTable === null) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-midnight/40" />
            <h1 className="font-manrope font-extrabold text-2xl text-midnight">
              EVSF Applications
            </h1>
          </div>
          <p className="text-sm text-midnight/50">
            Applications submitted to the Eagle Venture Seed Fund.
          </p>
        </div>
        <div className="bg-surface-2 rounded-xl p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-active rounded-xl flex items-center justify-center mb-4">
            <ClipboardList className="w-5 h-5 text-midnight/40" />
          </div>
          <p className="font-manrope font-semibold text-midnight mb-2">
            Initialize EVSF Applications
          </p>
          <p className="text-sm text-midnight/50 max-w-sm mb-6">
            Start with a copy of your Outreach Schema fields, or create a fresh
            structure. Entries added here automatically appear as deals in the
            Pipeline.
          </p>
          {canManage ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => handleInit(true)}
                disabled={initializing}
              >
                {initializing ? "Initializing…" : "Clone Outreach Schema"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleInit(false)}
                disabled={initializing}
              >
                Start Fresh
              </Button>
            </div>
          ) : (
            <p className="text-xs text-midnight/40">
              An owner or admin must initialize EVSF Applications.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Editor: EVSF table exists
  const editEntry = allEntries?.find((e) => e._id === editEntryId) as Entry | undefined;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-midnight/40" />
            <h1 className="font-manrope font-extrabold text-2xl text-midnight">
              EVSF Applications
            </h1>
          </div>
          <p className="text-sm text-midnight/50">
            Each application automatically creates a deal in the Pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFieldDrafts(
                  (fields ?? []).map((f) => ({
                    id: f._id,
                    name: f.name,
                    type: f.type as FieldDraft["type"],
                    required: f.required,
                    options: f.options ?? [],
                  }))
                );
                setSchemaOpen(true);
              }}
            >
              <Settings className="w-3.5 h-3.5" />
              Schema
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setAddAppOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add application
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-midnight/30" />
        <Input
          placeholder="Search applications…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {fields === undefined ? (
        <div className="h-48 bg-surface-2 rounded-xl animate-pulse" />
      ) : fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-surface-2 rounded-2xl text-center">
          <p className="font-manrope font-semibold text-midnight mb-1">
            No fields defined
          </p>
          <p className="text-sm text-midnight/40 mb-5 max-w-xs">
            Open the Schema builder to add fields before adding applications.
          </p>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => { setFieldDrafts([]); setSchemaOpen(true); }}
            >
              <Settings className="w-3.5 h-3.5" />
              Build schema
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden bg-surface-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-active/50">
                  {fields.map((field) => (
                    <th
                      key={field._id}
                      className="px-4 py-3 text-left text-xs font-semibold text-midnight/50 uppercase tracking-wide whitespace-nowrap"
                    >
                      {field.name}
                      {field.required && (
                        <span className="text-crimson ml-0.5">*</span>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-midnight/50 uppercase tracking-wide whitespace-nowrap">
                    Added by
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-midnight/50 uppercase tracking-wide whitespace-nowrap">
                    Pipeline
                  </th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-active/30">
                {entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={fields.length + 3}
                      className="px-4 py-12 text-center text-sm text-midnight/40"
                    >
                      {search
                        ? "No applications match your search."
                        : "No applications yet. Add the first one."}
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <EvsfEntryRow
                      key={entry._id}
                      entry={entry}
                      fields={fields as Field[]}
                      pipelineStatus={
                        entryDealMap.get(entry._id as string) ?? null
                      }
                      canEdit={canEdit}
                      onEdit={() => setEditEntryId(entry._id)}
                      onDelete={() => handleDeleteEntry(entry._id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-active/30">
            <span className="text-xs text-midnight/40">
              {entries.length}{" "}
              {entries.length === 1 ? "application" : "applications"}
              {search && ` matching "${search}"`}
            </span>
          </div>
        </div>
      )}

      {/* Add Application dialog */}
      {addAppOpen && tableId && fields && (
        <AddApplicationDialog
          folderId={folderId}
          tableId={tableId}
          fields={fields as Field[]}
          onClose={() => setAddAppOpen(false)}
        />
      )}

      {/* Edit Application dialog (standard entry update — no deal re-link) */}
      <Dialog
        open={editEntryId !== null}
        onOpenChange={(open) => { if (!open) setEditEntryId(null); }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit application</DialogTitle>
            <DialogDescription>
              Editing does not change the linked pipeline deal.
            </DialogDescription>
          </DialogHeader>
          {editEntry && tableId && fields && (
            <EntryForm
              tableId={tableId}
              fields={fields as Field[]}
              initialData={editEntry.data}
              entryId={editEntryId!}
              onSuccess={() => setEditEntryId(null)}
              onCancel={() => setEditEntryId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Schema Builder dialog */}
      <Dialog open={schemaOpen} onOpenChange={setSchemaOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>EVSF Applications schema</DialogTitle>
          </DialogHeader>
          <SchemaBuilder fields={fieldDrafts} onChange={setFieldDrafts} />
          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              onClick={() => setSchemaOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSchema}
              disabled={savingSchema}
              className="flex-1"
            >
              {savingSchema ? "Saving…" : "Save schema"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
