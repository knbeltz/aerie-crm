"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FieldType =
  | "text"
  | "email"
  | "url"
  | "boolean"
  | "date"
  | "select"
  | "multiselect"
  | "number";

export interface FieldDraft {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options: string[];
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multiselect", label: "Multi-select" },
];

interface SchemaBuilderProps {
  fields: FieldDraft[];
  onChange: (fields: FieldDraft[]) => void;
}

export function SchemaBuilder({ fields, onChange }: SchemaBuilderProps) {
  const addField = () => {
    onChange([
      ...fields,
      {
        id: crypto.randomUUID(),
        name: "",
        type: "text",
        required: false,
        options: [],
      },
    ]);
  };

  const updateField = (id: string, updates: Partial<FieldDraft>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && (
        <div className="text-center py-6 text-sm text-midnight/40">
          No fields yet. Add your first field below.
        </div>
      )}

      {fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          onUpdate={(updates) => updateField(field.id, updates)}
          onRemove={() => removeField(field.id)}
        />
      ))}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addField}
        className="w-full"
      >
        <Plus className="w-4 h-4" />
        Add field
      </Button>
    </div>
  );
}

interface FieldRowProps {
  field: FieldDraft;
  onUpdate: (updates: Partial<FieldDraft>) => void;
  onRemove: () => void;
}

function FieldRow({ field, onUpdate, onRemove }: FieldRowProps) {
  const [newOption, setNewOption] = useState("");
  const showOptions = field.type === "select" || field.type === "multiselect";

  const addOption = () => {
    if (!newOption.trim()) return;
    onUpdate({ options: [...field.options, newOption.trim()] });
    setNewOption("");
  };

  const removeOption = (index: number) => {
    onUpdate({ options: field.options.filter((_, i) => i !== index) });
  };

  return (
    <div className="bg-surface-2 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="text-midnight/20 cursor-grab">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <Input
            placeholder="Field name"
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div className="w-36">
          <Select
            value={field.type}
            onValueChange={(val) => onUpdate({ type: val as FieldType })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Switch
            id={`required-${field.id}`}
            checked={field.required}
            onCheckedChange={(checked) => onUpdate({ required: checked })}
          />
          <Label htmlFor={`required-${field.id}`} className="text-xs cursor-pointer">
            Req.
          </Label>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-midnight/30 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {showOptions && (
        <div className="ml-7 flex flex-col gap-2">
          <Label className="text-xs">Options</Label>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {field.options.map((opt, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 bg-active px-2 py-0.5 rounded-md text-xs"
              >
                {opt}
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="text-midnight/40 hover:text-midnight transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add option..."
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
              className="h-7 text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addOption}
              className="h-7 text-xs"
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
