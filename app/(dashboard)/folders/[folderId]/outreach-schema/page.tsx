"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FileText, Plus, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SchemaBuilder, FieldDraft } from "@/components/tables/SchemaBuilder";
import { EntryForm } from "@/components/tables/EntryForm";
import { EntryRow } from "@/components/tables/EntryRow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="h-7 w-48 bg-surface-2 rounded-lg animate-pulse mb-2" />
      <div className="h-4 w-64 bg-surface-2 rounded animate-pulse mb-8" />
      <div className="h-64 bg-surface-2 rounded-xl animate-pulse" />
    </div>
  );
}

// ─── Empty state (no table yet) ───────────────────────────────────────────────

function EmptyState({
  canManage,
  onCreateClick,
  creating,
}: {
  canManage: boolean;
  onCreateClick: () => void;
  creating: boolean;
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-midnight/40" />
          <h1 className="font-manrope font-extrabold text-2xl text-midnight">
            Outreach Schema
          </h1>
        </div>
        <p className="text-sm text-midnight/50">
          Define the data structure for tracking outreach contacts.
        </p>
      </div>

      <div className="bg-surface-2 rounded-xl p-10 flex flex-col items-center text-center">
        <div className="w-12 h-12 bg-active rounded-xl flex items-center justify-center mb-4">
          <FileText className="w-5 h-5 text-midnight/40" />
        </div>
        <p className="font-manrope font-semibold text-midnight mb-1">
          No outreach schema yet
        </p>
        <p className="text-sm text-midnight/50 max-w-sm mb-5">
          Create an outreach schema to define how you track founders, investors,
          and contacts in this folder. Comes pre-loaded with sensible defaults.
        </p>
        {canManage ? (
          <Button onClick={onCreateClick} disabled={creating}>
            {creating ? "Creating…" : "Create Outreach Schema"}
          </Button>
        ) : (
          <p className="text-xs text-midnight/40">
            An owner or admin must create the Outreach Schema.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OutreachSchemaPage() {
  const params = useParams();
  const folderId = params.folderId as Id<"folders">;

  // ─── Queries ────────────────────────────────────────────────────────────────
  const myRole = useQuery(api.members.getMyRole, { folderId });
  const outreachTable = useQuery(api.tables.getOutreachTable, { folderId });

  const tableId = outreachTable?._id ?? null;

  const fields = useQuery(
    api.fields.getTableFields,
    tableId ? { tableId } : "skip"
  );
  const allEntries = useQuery(
    api.entries.getTableEntries,
    tableId ? { tableId } : "skip"
  );

  // ─── Local state ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [editEntryId, setEditEntryId] = useState<Id<"entries"> | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>([]);
  const [savingSchema, setSavingSchema] = useState(false);
  const [creating, setCreating] = useState(false);

  // ─── Search ─────────────────────────────────────────────────────────────────
  const searchResults = useQuery(
    api.entries.searchEntries,
    tableId && search.trim() ? { tableId, searchText: search } : "skip"
  );
  const entries = search.trim() ? (searchResults ?? []) : (allEntries ?? []);

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const initOutreachTable = useMutation(api.tables.initOutreachTable);
  const createField = useMutation(api.fields.createField);
  const deleteField = useMutation(api.fields.deleteField);

  // ─── Derived permissions ────────────────────────────────────────────────────
  const canManage = myRole === "owner" || myRole === "admin";
  const canEdit = myRole === "owner" || myRole === "admin" || myRole === "editor";

  // ─── Handlers ───────────────────────────────────────────────────────────────
  async function handleCreate() {
    setCreating(true);
    try {
      await initOutreachTable({ folderId });
      toast.success("Outreach Schema created");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create schema");
    } finally {
      setCreating(false);
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

  // Loading: either role or table query still pending
  if (myRole === undefined || outreachTable === undefined) return <PageSkeleton />;

  // Empty: no table exists yet
  if (outreachTable === null) {
    return (
      <EmptyState
        canManage={canManage}
        onCreateClick={handleCreate}
        creating={creating}
      />
    );
  }

  // Editor: table exists — wait for fields/entries
  const editEntry = allEntries?.find((e) => e._id === editEntryId);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-midnight/40" />
            <h1 className="font-manrope font-extrabold text-2xl text-midnight">
              Outreach Schema
            </h1>
          </div>
          <p className="text-sm text-midnight/50">
            Track founders, investors, and contacts for this folder.
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
            <Button size="sm" onClick={() => setAddEntryOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add entry
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-midnight/30" />
        <Input
          placeholder="Search entries…"
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
            Open the Schema builder to add fields before adding entries.
          </p>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setFieldDrafts([]);
                setSchemaOpen(true);
              }}
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
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-active/30">
                {entries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={fields.length + 2}
                      className="px-4 py-12 text-center text-sm text-midnight/40"
                    >
                      {search
                        ? "No entries match your search."
                        : "No entries yet. Add the first one."}
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <EntryRow
                      key={entry._id}
                      entry={{
                        _id: entry._id,
                        data: entry.data as Record<string, unknown>,
                        createdByName: entry.createdByName as string,
                        updatedAt: entry.updatedAt,
                      }}
                      fields={fields}
                      onEdit={() => setEditEntryId(entry._id)}
                      canEdit={canEdit}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-active/30">
            <span className="text-xs text-midnight/40">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
              {search && ` matching "${search}"`}
            </span>
          </div>
        </div>
      )}

      {/* Add Entry dialog */}
      <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add entry</DialogTitle>
          </DialogHeader>
          {tableId && fields && (
            <EntryForm
              tableId={tableId}
              fields={fields}
              onSuccess={() => setAddEntryOpen(false)}
              onCancel={() => setAddEntryOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Entry dialog */}
      <Dialog
        open={editEntryId !== null}
        onOpenChange={(open) => { if (!open) setEditEntryId(null); }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
          </DialogHeader>
          {editEntry && tableId && fields && (
            <EntryForm
              tableId={tableId}
              fields={fields}
              initialData={editEntry.data as Record<string, unknown>}
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
            <DialogTitle>Outreach schema</DialogTitle>
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
