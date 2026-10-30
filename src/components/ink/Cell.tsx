"use client";

import React, { memo, useState } from "react";
import { useApp } from "@/store/app";
import { api } from "@/lib/api";
import type {
  TextCellData,
  ImageCellData,
  LinkCellData,
  AudioCellData,
  RecordCellData,
  ListCellData,
} from "@/lib/types";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { AudioPlayer } from "./AudioPlayer";
import { Layers, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  row: string;
  col: string;
}

function CellViewImpl({ row, col }: Props) {
  const cell = useApp((s) => s.sheet?.cells[`${row}:${col}`] ?? null);
  const selRow = useApp((s) => s.selRow);
  const selCol = useApp((s) => s.selCol);
  const editing = useApp((s) => s.editing);
  const selectCell = useApp((s) => s.selectCell);
  const startEdit = useApp((s) => s.startEdit);
  const setCell = useApp((s) => s.setCell);
  const clearCell = useApp((s) => s.clearCell);
  const openRecord = useApp((s) => s.openRecord);
  const getRecord = useApp((s) => s.getRecord);
  const createRecord = useApp((s) => s.createRecord);
  const addRecordToListCell = useApp((s) => s.addRecordToListCell);
  const removeRecordFromListCell = useApp((s) => s.removeRecordFromListCell);
  const workspace = useApp((s) => s.workspace);

  const selected = selRow === row && selCol === col;
  const isEditing = editing?.row === row && editing?.col === col;

  function handleDouble() {
    if (!cell) {
      startEdit(row, col);
      return;
    }
    switch (cell.type) {
      case "text":
        startEdit(row, col);
        break;
      case "image":
        pickImage();
        break;
      case "audio":
        pickAudio();
        break;
      case "link":
        promptLink();
        break;
      case "record": {
        const d = cell.data as RecordCellData;
        if (d.recordId) openRecord(d.recordId);
        break;
      }
      case "list": {
        // double-tap a list cell to add a new record inside it
        addRecordToThisList();
        break;
      }
    }
  }

  function addRecordToThisList() {
    const id = createRecord("Record", "Untitled");
    addRecordToListCell(row, col, id);
    openRecord(id);
  }

  async function pickImage() {
    if (!workspace) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const asset = await api.uploadMedia(workspace.id, f);
        setCell(row, col, { type: "image", data: { mediaId: asset.id } as ImageCellData });
      } catch (e) {
        toast.error(String(e));
      }
    };
    input.click();
  }

  async function pickAudio() {
    if (!workspace) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,.mp3,.wav,.m4a,.flac,.opus,.ogg,.aac,.webm";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const asset = await api.uploadMedia(workspace.id, f);
        setCell(row, col, {
          type: "audio",
          data: { mediaId: asset.id, name: f.name } as AudioCellData,
        });
      } catch (e) {
        toast.error(String(e));
      }
    };
    input.click();
  }

  function promptLink() {
    const cur = cell?.type === "link" ? (cell.data as LinkCellData).url : "";
    const url = window.prompt("Link URL", cur);
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      clearCell(row, col);
      return;
    }
    let final = trimmed;
    if (!/^https?:\/\//i.test(final)) final = "https://" + final;
    setCell(row, col, { type: "link", data: { url: final } as LinkCellData });
  }

  const content = renderContent();

  function renderContent() {
    if (!cell) return <span className="cell-empty">&nbsp;</span>;
    switch (cell.type) {
      case "text": {
        const d = cell.data as TextCellData;
        return <span className="cell-preview-text">{d.value || ""}</span>;
      }
      case "image": {
        const d = cell.data as ImageCellData;
        return (
          <div className="cell-image-wrap">
            <img className="cell-image" src={api.mediaUrl(d.mediaId)} alt="" loading="lazy" />
          </div>
        );
      }
      case "link": {
        const d = cell.data as LinkCellData;
        return <LinkPreviewCard url={d.url} compact />;
      }
      case "audio": {
        const d = cell.data as AudioCellData;
        return <AudioPlayer mediaId={d.mediaId} name={d.name} mini />;
      }
      case "record": {
        const d = cell.data as RecordCellData;
        const rec = getRecord(d.recordId);
        return (
          <span
            className="cell-tag record"
            onClick={(e) => {
              e.stopPropagation();
              openRecord(d.recordId);
            }}
          >
            <Layers size={10} />
            <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {rec ? `${rec.type}: ${rec.title}` : "Record"}
            </span>
          </span>
        );
      }
      case "list": {
        const d = cell.data as ListCellData;
        const ids = d.recordIds || [];
        return (
          <div className="cell-list" onClick={(e) => e.stopPropagation()}>
            {ids.length === 0 && (
              <div className="cell-list-empty">empty · double-tap to add</div>
            )}
            {ids.map((rid) => {
              const r = getRecord(rid);
              return (
                <div className="cell-list-item" key={rid}>
                  <button
                    className="cell-list-tag"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRecord(rid);
                    }}
                  >
                    <Layers size={10} />
                    <span className="cell-list-title">
                      {r ? r.title || "Untitled" : "Record"}
                    </span>
                    {r && (
                      <span className="cell-list-meta">{r.fields.length}f</span>
                    )}
                  </button>
                  <button
                    className="cell-list-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecordFromListCell(row, col, rid);
                    }}
                    aria-label="Remove from cell"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
            <button
              className="cell-list-add"
              onClick={(e) => {
                e.stopPropagation();
                addRecordToThisList();
              }}
            >
              <Plus size={10} /> add
            </button>
          </div>
        );
      }
    }
  }

  return (
    <td
      className={"cell" + (selected ? " selected" : "") + (isEditing ? " editing" : "")}
      onClick={() => selectCell(row, col)}
      onDoubleClick={handleDouble}
    >
      {isEditing && cell?.type === "text" ? (
        <CellEditor row={row} col={col} initial={(cell.data as TextCellData).value} />
      ) : isEditing && !cell ? (
        <CellEditor row={row} col={col} initial="" />
      ) : (
        <div className="cell-content">{content}</div>
      )}
    </td>
  );
}

function CellEditor({
  row,
  col,
  initial,
}: {
  row: string;
  col: string;
  initial: string;
}) {
  const setCell = useApp((s) => s.setCell);
  const stopEdit = useApp((s) => s.stopEdit);
  const selectCell = useApp((s) => s.selectCell);
  const [val, setVal] = useState(initial);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, []);

  function commit() {
    setCell(row, col, { type: "text", data: { value: val } as TextCellData });
    stopEdit();
    selectCell(row, col);
  }

  return (
    <textarea
      ref={ref}
      className="cell-edit-input ta"
      value={val}
      onChange={(e) => {
        setVal(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          stopEdit();
          selectCell(row, col);
        }
      }}
    />
  );
}

export const CellView = memo(CellViewImpl);

