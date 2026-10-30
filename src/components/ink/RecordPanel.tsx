"use client";

import { useApp, makeField } from "@/store/app";
import { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Type,
  AlignLeft,
  Image as ImageIcon,
  Music,
  Link as LinkIcon,
  FileText,
  Hash,
  Calendar,
  Layers,
  Pencil,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  FieldKind,
  RecordField,
} from "@/lib/types";
import { Modal } from "./Modal";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { AudioPlayer } from "./AudioPlayer";

const KIND_META: Record<FieldKind, { label: string; icon: any }> = {
  text: { label: "Text", icon: Type },
  richtext: { label: "Rich text", icon: AlignLeft },
  image: { label: "Image", icon: ImageIcon },
  audio: { label: "Audio", icon: Music },
  link: { label: "Link", icon: LinkIcon },
  file: { label: "File", icon: FileText },
  number: { label: "Number", icon: Hash },
  date: { label: "Date", icon: Calendar },
};

export function RecordPanel() {
  const openRecordId = useApp((s) => s.openRecordId);
  const sheet = useApp((s) => s.sheet);
  const dirty = useApp((s) => s.recordSheetDirty);
  const closeRecord = useApp((s) => s.closeRecord);
  const updateRecord = useApp((s) => s.updateRecord);
  const deleteRecord = useApp((s) => s.deleteRecord);
  const workspace = useApp((s) => s.workspace);

  const [addFieldOpen, setAddFieldOpen] = useState(false);

  void dirty;

  const rec = openRecordId ? sheet?.records[openRecordId] : null;

  if (!rec) {
    return null;
  }

  function setTitle(v: string) {
    updateRecord(rec!.id, (r) => {
      r.title = v;
      return r;
    });
  }
  function setType(v: string) {
    updateRecord(rec!.id, (r) => {
      r.type = v || "Record";
      return r;
    });
  }
  function addField(label: string, kind: FieldKind) {
    updateRecord(rec!.id, (r) => {
      r.fields.push(makeField(label || "Field", kind));
      return r;
    });
    setAddFieldOpen(false);
  }
  function updateField(fieldId: string, updater: (f: RecordField) => RecordField) {
    updateRecord(rec!.id, (r) => {
      r.fields = r.fields.map((f) => (f.id === fieldId ? updater(f) : f));
      return r;
    });
  }
  function removeField(fieldId: string) {
    updateRecord(rec!.id, (r) => {
      r.fields = r.fields.filter((f) => f.id !== fieldId);
      return r;
    });
  }

  async function pickMediaForField(fieldId: string, kind: "image" | "audio" | "file") {
    if (!workspace) return;
    const input = document.createElement("input");
    input.type = "file";
    if (kind === "image") input.accept = "image/*";
    else if (kind === "audio")
      input.accept = "audio/*,.mp3,.wav,.m4a,.flac,.opus,.ogg,.aac,.webm";
    else input.accept = "*/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const asset = await api.uploadMedia(workspace.id, f);
        updateField(fieldId, (fld) => {
          fld.value = asset.id;
          return fld;
        });
      } catch (e) {
        toast.error(String(e));
      }
    };
    input.click();
  }

  return (
    <div className="modal-overlay" onClick={closeRecord}>
      <div
        className="sheet-panel"
        style={{ maxWidth: 680 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <div className="ph-title">{rec.type}: {rec.title}</div>
          <button className="iconbtn" onClick={closeRecord} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="panel-body">
          <div className="rec-header">
            <div className="rec-type-row">
              <input
                className="rec-type-input"
                value={rec.type}
                onChange={(e) => setType(e.target.value)}
                placeholder="TYPE"
              />
            </div>
            <input
              className="rec-title-input"
              value={rec.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
            />
          </div>

          {/* Fields */}
          <div className="rec-section-title">
            <Layers size={11} /> Fields
          </div>
          {rec.fields.length === 0 && (
            <div className="tiny muted" style={{ marginBottom: 8 }}>
              No fields yet.
            </div>
          )}
          {rec.fields.map((f) => (
            <div className="field-row" key={f.id}>
              <div className="fr-label">
                {(() => {
                  const M = KIND_META[f.kind];
                  const Icon = M.icon;
                  return <Icon size={11} />;
                })()}
                <input
                  className="input"
                  style={{ height: 22, fontSize: 11, padding: "0 5px", fontWeight: 600 }}
                  value={f.label}
                  onChange={(e) =>
                    updateField(f.id, (fld) => {
                      fld.label = e.target.value;
                      return fld;
                    })
                  }
                />
              </div>
              <div className="fr-value">
                <FieldValueEditor
                  field={f}
                  onChange={(updater) => updateField(f.id, updater)}
                  onPickMedia={(kind) => pickMediaForField(f.id, kind)}
                  workspaceId={workspace?.id}
                />
              </div>
              <div className="fr-tools">
                <button
                  className="iconbtn"
                  style={{ width: 20, height: 20 }}
                  onClick={() => removeField(f.id)}
                  aria-label="Remove field"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          <div className="field-add">
            <button className="btn sm" onClick={() => setAddFieldOpen(true)}>
              <Plus size={12} /> Add field
            </button>
          </div>
        </div>

        <div className="panel-foot">
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm("Delete this record?")) {
                deleteRecord(rec.id);
                closeRecord();
              }
            }}
          >
            <Trash2 size={13} /> Delete record
          </button>
          <button className="btn btn-primary" onClick={closeRecord}>
            Done
          </button>
        </div>
      </div>

      <AddFieldModal
        open={addFieldOpen}
        onClose={() => setAddFieldOpen(false)}
        onAdd={addField}
      />
    </div>
  );
}

function FieldValueEditor({
  field,
  onChange,
  onPickMedia,
  workspaceId,
}: {
  field: RecordField;
  onChange: (updater: (f: RecordField) => RecordField) => void;
  onPickMedia: (kind: "image" | "audio" | "file") => void;
  workspaceId?: string;
}) {
  const k = field.kind;
  if (k === "text") {
    return (
      <input
        className="input"
        value={field.value}
        onChange={(e) =>
          onChange((f) => {
            f.value = e.target.value;
            return f;
          })
        }
        placeholder="Text"
      />
    );
  }
  if (k === "richtext") {
    return (
      <textarea
        className="textarea"
        style={{ minHeight: 80 }}
        value={field.value}
        onChange={(e) =>
          onChange((f) => {
            f.value = e.target.value;
            return f;
          })
        }
        placeholder="Rich text…"
      />
    );
  }
  if (k === "number") {
    return (
      <input
        className="input"
        type="number"
        value={field.value}
        onChange={(e) =>
          onChange((f) => {
            f.value = e.target.value;
            return f;
          })
        }
        placeholder="0"
      />
    );
  }
  if (k === "date") {
    return (
      <input
        className="input"
        type="date"
        value={field.value}
        onChange={(e) =>
          onChange((f) => {
            f.value = e.target.value;
            return f;
          })
        }
      />
    );
  }
  if (k === "link") {
    return (
      <div className="col" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 4 }}>
          <input
            className="input"
            value={field.value}
            onChange={(e) =>
              onChange((f) => {
                f.value = e.target.value;
                return f;
              })
            }
            placeholder="https://"
          />
          <button className="btn sm btn-ghost" onClick={() => onPickMedia("file")} title="Attach file">
            <Pencil size={12} />
          </button>
        </div>
        {field.value && /^https?:\/\//i.test(field.value) && (
          <LinkPreviewCard url={field.value} />
        )}
      </div>
    );
  }
  // media fields
  if (k === "image") {
    return (
      <div className="col" style={{ gap: 6 }}>
        {field.value && (
          <div className="media-tile" style={{ maxWidth: 220 }}>
            <img src={api.mediaUrl(field.value)} alt="" />
            <div className="mt-overlay">
              <a
                className="iconbtn"
                style={{ width: 20, height: 20, background: "rgba(255,255,255,0.85)" }}
                href={api.mediaDownloadUrl(field.value)}
                download
                onClick={(e) => e.stopPropagation()}
              >
                <FileText size={11} />
              </a>
            </div>
          </div>
        )}
        <div className="row" style={{ gap: 4 }}>
          <button className="btn sm" onClick={() => onPickMedia("image")}>
            <ImageIcon size={12} /> {field.value ? "Replace" : "Upload image"}
          </button>
          {field.value && (
            <button
              className="btn sm btn-ghost"
              onClick={() => onChange((f) => {
                f.value = "";
                return f;
              })}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );
  }
  if (k === "audio") {
    return (
      <div className="col" style={{ gap: 6 }}>
        {field.value && <AudioPlayer mediaId={field.value} name="Audio" />}
        <div className="row" style={{ gap: 4 }}>
          <button className="btn sm" onClick={() => onPickMedia("audio")}>
            <Music size={12} /> {field.value ? "Replace" : "Upload audio"}
          </button>
          {field.value && (
            <button
              className="btn sm btn-ghost"
              onClick={() => onChange((f) => {
                f.value = "";
                return f;
              })}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );
  }
  // file
  return (
    <div className="col" style={{ gap: 6 }}>
      {field.value && (
        <a
          className="btn sm btn-ghost"
          href={api.mediaDownloadUrl(field.value)}
          download
          onClick={(e) => e.stopPropagation()}
          style={{ justifyContent: "flex-start" }}
        >
          <FileText size={12} /> Download attachment
        </a>
      )}
      <button className="btn sm" onClick={() => onPickMedia("file")}>
        <FileText size={12} /> {field.value ? "Replace file" : "Attach file"}
      </button>
    </div>
  );
}

function AddFieldModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (label: string, kind: FieldKind) => void;
}) {
  const [kind, setKind] = useState<FieldKind>("text");
  const [label, setLabel] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add field"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onAdd(label, kind)}
          >
            Add
          </button>
        </>
      }
    >
      <div className="field">
        <div className="label">Label</div>
        <input
          className="input"
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Cover, Producer, Year"
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd(label, kind);
          }}
        />
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <div className="label">Type</div>
        <div className="kind-grid">
          {(Object.keys(KIND_META) as FieldKind[]).map((k) => {
            const M = KIND_META[k];
            const Icon = M.icon;
            return (
              <button
                key={k}
                className={"kind-opt" + (kind === k ? " active" : "")}
                style={
                  kind === k
                    ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" }
                    : undefined
                }
                onClick={() => setKind(k)}
              >
                <Icon size={13} /> {M.label}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
