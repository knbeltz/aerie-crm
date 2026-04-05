"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Plus, Search, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntryRow } from "@/components/tables/EntryRow";
import { EntryForm } from "@/components/tables/EntryForm";
import { SchemaBuilder, FieldDraft } from "@/components/tables/SchemaBuilder";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function TablePage() {
  const params = useParams();
  const folderId = params.folderId as Id<"folders">;
  const tableId = params.tableId as Id<"tables">;

  const [searchText, setSearchText] = useState("");
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [editEntryId, setEditEntryId] = useState<Id<"entries"> | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>([]);
  const [savingSchema, setSavingSchema] = useState(false);

  const table = useQuery(api.tables.getTable, { tableId });
  const folder = useQuery(api.folders.getFolder, { folderId });
  const fields = useQuery(api.fields.getTableFields, { tableId });
  const allEntries = useQuery(api.entries.getTableEntries, { tableId });
  const searchResults = useQuery(
    api.entries.searchEntries,
    searchText.trim() ? { tableId, searchText } : "skip"
  );

  const createField = useMutation(api.fields.createField);
  const deleteField = useMutation(api.fields.deleteField);

  const entries = searchText.trim() ? searchResults ?? [] : allEntries ?? [];

  const canEdit =
    folder?.role === "owner" || folder?.role === "editor";

  const editEntry = allEntries?.find((e) => e._id === editEntryId);

  const handleSaveSchema = async () => {
    if (!fields) return;
    setSavingSchema(true);
    try {
      // Delete removed fields (fields in current but not in drafts)
      const draftIds = new Set(fieldDrafts.map((d) => d.id));
      const fieldsToDelete = fields.filter((f) => !draftIds.has(f._id));
      for (const f of fieldsToDelete) {
        await deleteField({ fieldId: f._id });
      }

      // Add new fields (drafts without a matching existing field)
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
    } catch (err) {
      toast.error("Failed to save schema");
    } finally {
      setSavingSchema(false);
    }
  };

  if (table === undefined || fields === undefined) {
    return (
      <div className="animate-fade-in">
        <div className="h-8 w-48 bg-surface-2 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-64 bg-surface-2 rounded animate-pulse mb-8" />
        <div className="h-64 bg-surface-2 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="text-center py-16">
        <p className="text-midnight/50">Table not found.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-manrope font-extrabold text-2xl text-midnight mb-1">
            {table.name}
          </h1>
          {table.description && (
            <p className="text-sm text-midnight/50">{table.description}</p>
          )}
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
          placeholder="Search entries..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-surface-2 rounded-2xl text-center">
          <p className="font-manrope font-semibold text-midnight mb-1">
            No schema defined
          </p>
          <p className="text-sm text-midnight/40 mb-5 max-w-xs">
            Define fields in your table schema before adding entries.
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-midnight/50 uppercase tracking-wide">
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
                      {searchText
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
          <div className="px-4 py-2.5 bg-active/30 flex items-center justify-between">
            <span className="text-xs text-midnight/40">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
              {searchText && ` matching "${searchText}"`}
            </span>
          </div>
        </div>
      )}

      {/* Add Entry Dialog */}
      <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add entry</DialogTitle>
          </DialogHeader>
          <EntryForm
            tableId={tableId}
            fields={fields}
            onSuccess={() => setAddEntryOpen(false)}
            onCancel={() => setAddEntryOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog
        open={editEntryId !== null}
        onOpenChange={(open) => {
          if (!open) setEditEntryId(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
          </DialogHeader>
          {editEntry && (
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

      {/* Schema Builder Dialog */}
      <Dialog open={schemaOpen} onOpenChange={setSchemaOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Table schema</DialogTitle>
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
              {savingSchema ? "Saving..." : "Save schema"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
