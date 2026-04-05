"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DuplicateWarning } from "./DuplicateWarning";
import { toast } from "sonner";

interface Field {
  _id: Id<"fields">;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface EntryFormProps {
  tableId: Id<"tables">;
  fields: Field[];
  initialData?: Record<string, unknown>;
  entryId?: Id<"entries">;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EntryForm({
  tableId,
  fields,
  initialData,
  entryId,
  onSuccess,
  onCancel,
}: EntryFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(
    initialData ?? {}
  );
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{
    _id: string;
    data: Record<string, unknown>;
    createdByName: string;
    createdAt: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const emailField = fields.find((f) => f.type === "email");
  const nameField = fields.find((f) => f.name.toLowerCase() === "name");

  const duplicateCheck = useQuery(api.entries.checkDuplicate, {
    tableId,
    emailValue: emailField ? (formData[emailField.name] as string) : undefined,
    nameValue: nameField ? (formData[nameField.name] as string) : undefined,
    excludeEntryId: entryId,
  });

  const createEntry = useMutation(api.entries.createEntry);
  const updateEntry = useMutation(api.entries.updateEntry);

  const setValue = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    // Check duplicates on create
    if (!entryId && duplicateCheck && duplicateCheck.length > 0) {
      setDuplicates(duplicateCheck);
      setShowDuplicateWarning(true);
      setPendingSubmit(true);
      return;
    }

    await submitForm();
  };

  const submitForm = async () => {
    setIsLoading(true);
    try {
      if (entryId) {
        await updateEntry({ entryId, data: formData });
        toast.success("Entry updated");
      } else {
        await createEntry({ tableId, data: formData });
        toast.success("Entry added");
      }
      onSuccess();
    } catch (err) {
      toast.error("Failed to save entry");
    } finally {
      setIsLoading(false);
      setShowDuplicateWarning(false);
      setPendingSubmit(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {showDuplicateWarning && (
        <DuplicateWarning
          duplicates={duplicates}
          onDismiss={() => {
            setShowDuplicateWarning(false);
            setPendingSubmit(false);
          }}
          onProceed={submitForm}
        />
      )}

      {fields.map((field) => (
        <div key={field._id} className="flex flex-col gap-1.5">
          <Label>
            {field.name}
            {field.required && (
              <span className="text-crimson ml-0.5">*</span>
            )}
          </Label>

          {field.type === "text" && (
            <Input
              value={(formData[field.name] as string) ?? ""}
              onChange={(e) => setValue(field.name, e.target.value)}
              required={field.required}
            />
          )}

          {field.type === "email" && (
            <Input
              type="email"
              value={(formData[field.name] as string) ?? ""}
              onChange={(e) => setValue(field.name, e.target.value)}
              required={field.required}
            />
          )}

          {field.type === "url" && (
            <Input
              type="url"
              value={(formData[field.name] as string) ?? ""}
              onChange={(e) => setValue(field.name, e.target.value)}
              required={field.required}
            />
          )}

          {field.type === "number" && (
            <Input
              type="number"
              value={(formData[field.name] as string) ?? ""}
              onChange={(e) => setValue(field.name, e.target.value ? Number(e.target.value) : "")}
              required={field.required}
            />
          )}

          {field.type === "date" && (
            <Input
              type="date"
              value={(formData[field.name] as string) ?? ""}
              onChange={(e) => setValue(field.name, e.target.value)}
              required={field.required}
            />
          )}

          {field.type === "boolean" && (
            <div className="flex items-center gap-2">
              <Switch
                checked={(formData[field.name] as boolean) ?? false}
                onCheckedChange={(val) => setValue(field.name, val)}
              />
              <span className="text-sm text-midnight/60">
                {(formData[field.name] as boolean) ? "Yes" : "No"}
              </span>
            </div>
          )}

          {field.type === "select" && field.options && (
            <Select
              value={(formData[field.name] as string) ?? ""}
              onValueChange={(val) => setValue(field.name, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an option..." />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === "multiselect" && field.options && (
            <div className="flex flex-wrap gap-2 p-3 bg-surface-2 rounded-lg">
              {field.options.map((opt) => {
                const selected = ((formData[field.name] as string[]) ?? []).includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) => {
                        const current = (formData[field.name] as string[]) ?? [];
                        setValue(
                          field.name,
                          checked
                            ? [...current, opt]
                            : current.filter((v) => v !== opt)
                        );
                      }}
                    />
                    <span className="text-sm text-midnight">{opt}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {fields.length === 0 && (
        <p className="text-sm text-midnight/40 text-center py-4">
          No fields defined. Add fields to the table schema first.
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || showDuplicateWarning}
          className="flex-1"
        >
          {isLoading ? "Saving..." : entryId ? "Update entry" : "Add entry"}
        </Button>
      </div>
    </form>
  );
}
