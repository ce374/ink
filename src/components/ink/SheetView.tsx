"use client";

import { useApp } from "@/store/app";
import { CellView } from "./Cell";
import { useRef, useState, useCallback, useEffect } from "react";
import {
  Type,
  Image as ImageIcon,
  Link as LinkIcon,
  Music,
  Layers,
  List as ListIcon,
  Plus,
  Minus,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  TextCellData,
  ImageCellData,
  LinkCellData,
  AudioCellData,
} from "@/lib/types";
import { getExt, isImageExt, isAudioExt } from "@/lib/types";

function colLetter(index: number): string {
  let s = "";
  let n = index;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

type ResizeAxis = "col" | "row";

export function SheetView() {
  const sheet = useApp((s) => s.sheet);
  const file = useApp((s) => s.file);
  const selRow = useApp((s) => s.selRow);
  const selCol = useApp((s) => s.selCol);
  const workspace = useApp((s) => s.workspace);
  const setCell = useApp((s) => s.setCell);
  const clearCell = useApp((s) => s.clearCell);
  const addRow = useApp((s) => s.addRow);
  const addCol = useApp((s) => s.addCol);
  const removeRow = useApp((s) => s.removeRow);
  const removeCol = useApp((s) => s.removeCol);
  const setColWidth = useApp((s) => s.setColWidth);
  const setRowHeight = useApp((s) => s.setRowHeight);
  const setColName = useApp((s) => s.setColName);
  const createRecord = useApp((s) => s.createRecord);
  const openRecord = useApp((s) => s.openRecord);
  const setCellRecord = useApp((s) => s.setCellRecord);
  const setCellList = useApp((s) => s.setCellList);
  const addRecordToListCell = useApp((s) => s.addRecordToListCell);
  const undo = useApp((s) => s.undo);
  const redo = useApp((s) => s.redo);
  const canUndo = useApp((s) => s.undoStack.length > 0);
  const canRedo = useApp((s) => s.redoStack.length > 0);

  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const clampZoom = (z: number) =>
    Math.max(0.4, Math.min(2.5, Math.round(z * 100) / 100));
  const touchDist = (e: TouchEvent): number => {
    const a = e.touches[0];
    const b = e.touches[1];
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<Map<string, HTMLTableColElement>>(new Map());
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const guideRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    axis: ResizeAxis;
    id: string;
    start: number;
    initial: number;
    el: HTMLElement;
  } | null>(null);

  // keyboard: undo/redo shortcuts + nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((z) => clampZoom(z + 0.1));
      } else if (mod && e.key === "-") {
        e.preventDefault();
        setZoom((z) => clampZoom(z - 0.1));
      } else if (mod && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // pinch-to-zoom on the canvas (two-finger) + ctrl+wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let pinchDist = 0;
    let pinchZoom = zoom;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchDist = touchDist(e);
        pinchZoom = zoom;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist > 0) {
        e.preventDefault();
        const d = touchDist(e);
        const ratio = d / pinchDist;
        setZoom(clampZoom(pinchZoom * ratio));
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchDist = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clampZoom(z - e.deltaY * 0.002));
      }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [zoom]);

  const showGuide = (axis: ResizeAxis) => {
    const g = guideRef.current;
    if (!g) return;
    g.style.display = "block";
    g.dataset.axis = axis;
  };
  const hideGuide = () => {
    const g = guideRef.current;
    if (!g) return;
    g.style.display = "none";
  };
  const positionGuideCol = (colId: string, w: number) => {
    const g = guideRef.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    const th = canvas.querySelector(`[data-col="${colId}"]`);
    if (!th) return;
    const thRect = (th as HTMLElement).getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();
    const x = thRect.left - cRect.left + w + canvas.scrollLeft;
    g.style.left = x + "px";
    g.style.top = "0px";
    g.style.width = "1px";
    g.style.height = canvas.clientHeight + "px";
  };
  const positionGuideRow = (rowId: string, h: number) => {
    const g = guideRef.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    const th = canvas.querySelector(`[data-row="${rowId}"]`);
    if (!th) return;
    const rRect = (th as HTMLElement).getBoundingClientRect();
    const cRect = canvas.getBoundingClientRect();
    const y = rRect.top - cRect.top + h + canvas.scrollTop;
    g.style.top = y + "px";
    g.style.left = "0px";
    g.style.height = "1px";
    g.style.width = canvas.clientWidth + "px";
  };

  const startColResize = useCallback(
    (colId: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const col = sheet?.columns.find((c) => c.id === colId);
      const startW = col?.width ?? 120;
      const startX = e.clientX;
      const target = e.target as HTMLElement;
      target.setPointerCapture(e.pointerId);
      dragState.current = {
        axis: "col",
        id: colId,
        start: startX,
        initial: startW,
        el: target,
      };
      showGuide("col");
      const move = (ev: PointerEvent) => {
        const ds = dragState.current;
        if (!ds) return;
        const w = Math.max(32, Math.min(900, startW + (ev.clientX - startX)));
        // direct DOM update — no React re-render
        const colEl = colRefs.current.get(colId);
        if (colEl) colEl.style.width = w + "px";
        positionGuideCol(colId, w);
      };
      const up = (ev: PointerEvent) => {
        target.releasePointerCapture?.(ev.pointerId);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const ds = dragState.current;
        dragState.current = null;
        hideGuide();
        if (ds) {
          const w = Math.max(32, Math.min(900, startW + (ev.clientX - startX)));
          setColWidth(colId, w); // single history entry + save
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [sheet, setColWidth]
  );

  const startRowResize = useCallback(
    (rowId: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const row = sheet?.rows.find((r) => r.id === rowId);
      const startH = row?.height ?? 30;
      const startY = e.clientY;
      const target = e.target as HTMLElement;
      target.setPointerCapture(e.pointerId);
      dragState.current = {
        axis: "row",
        id: rowId,
        start: startY,
        initial: startH,
        el: target,
      };
      showGuide("row");
      const move = (ev: PointerEvent) => {
        const ds = dragState.current;
        if (!ds) return;
        const h = Math.max(18, Math.min(500, startH + (ev.clientY - startY)));
        const rowEl = rowRefs.current.get(rowId);
        if (rowEl) rowEl.style.height = h + "px";
        positionGuideRow(rowId, h);
      };
      const up = (ev: PointerEvent) => {
        target.releasePointerCapture?.(ev.pointerId);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const ds = dragState.current;
        dragState.current = null;
        hideGuide();
        if (ds) {
          const h = Math.max(18, Math.min(500, startH + (ev.clientY - startY)));
          setRowHeight(rowId, h);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [sheet, setRowHeight]
  );

  if (!sheet || !file) {
    return <div className="empty-state">No file</div>;
  }

  function applyType(type: "text" | "image" | "link" | "audio" | "record" | "list") {
    if (!selRow || !selCol) {
      toast.error("Select a cell first");
      return;
    }
    if (type === "text") {
      setCell(selRow, selCol, { type: "text", data: { value: "" } as TextCellData });
      return;
    }
    if (type === "image") {
      pickMedia("image");
      return;
    }
    if (type === "audio") {
      pickMedia("audio");
      return;
    }
    if (type === "link") {
      const cur = sheet?.cells[`${selRow}:${selCol}`];
      const url = cur?.type === "link" ? (cur.data as LinkCellData).url : "";
      const v = window.prompt("Link URL", url);
      if (v === null) return;
      const trimmed = v.trim();
      if (!trimmed) {
        clearCell(selRow, selCol);
        return;
      }
      let final = trimmed;
      if (!/^https?:\/\//i.test(final)) final = "https://" + final;
      setCell(selRow, selCol, { type: "link", data: { url: final } as LinkCellData });
      return;
    }
    if (type === "record") {
      const rid = createRecord("Record", "Untitled");
      setCellRecord(selRow, selCol, rid);
      openRecord(rid);
      return;
    }
    if (type === "list") {
      const rid = createRecord("Record", "Untitled");
      addRecordToListCell(selRow, selCol, rid);
      openRecord(rid);
      return;
    }
  }

  async function pickMedia(kind: "image" | "audio") {
    if (!workspace || !selRow || !selCol) return;
    const input = document.createElement("input");
    input.type = "file";
    if (kind === "image") input.accept = "image/*";
    else input.accept = "audio/*,.mp3,.wav,.m4a,.flac,.opus,.ogg,.aac,.webm";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const ext = getExt(f.name);
      if (kind === "image" && !isImageExt(ext) && !f.type.startsWith("image/")) {
        toast.error("Not an image");
        return;
      }
      if (kind === "audio" && !isAudioExt(ext) && !f.type.startsWith("audio/")) {
        toast.error("Unsupported audio");
        return;
      }
      try {
        const asset = await api.uploadMedia(workspace.id, f);
        if (kind === "image") {
          setCell(selRow, selCol, { type: "image", data: { mediaId: asset.id } as ImageCellData });
        } else {
          setCell(selRow, selCol, {
            type: "audio",
            data: { mediaId: asset.id, name: f.name } as AudioCellData,
          });
        }
      } catch (e) {
        toast.error(String(e));
      }
    };
    input.click();
  }

  const hasSel = !!selRow && !!selCol;

  return (
    <div className="sheet">
      <div className="sheet-toolbar">
        <div className="grp">
          <button
            className="btn xs btn-ghost"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
          >
            <Undo2 size={13} />
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 size={13} />
          </button>
        </div>
        <div className="grp">
          <button
            className={"btn xs" + (sheet.cells[`${selRow}:${selCol}`]?.type === "text" ? " btn-primary" : " btn-ghost")}
            onClick={() => applyType("text")}
            disabled={!hasSel}
          >
            Text
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => applyType("image")}
            disabled={!hasSel}
            title="Image"
          >
            <ImageIcon size={13} />
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => applyType("link")}
            disabled={!hasSel}
            title="Link"
          >
            <LinkIcon size={13} />
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => applyType("audio")}
            disabled={!hasSel}
            title="Audio"
          >
            <Music size={13} />
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => applyType("record")}
            disabled={!hasSel}
            title="Record / Card"
          >
            <Layers size={13} />
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => applyType("list")}
            disabled={!hasSel}
            title="List of records (in cell)"
          >
            <ListIcon size={13} />
          </button>
        </div>
        <div className="grp">
          <button
            className="btn xs btn-ghost"
            onClick={() => setZoom((z) => clampZoom(z - 0.1))}
            disabled={zoom <= 0.4}
            title="Zoom out (⌘−)"
          >
            <ZoomOut size={13} />
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => setZoom(1)}
            title="Reset zoom (⌘0)"
            style={{ minWidth: 38 }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => setZoom((z) => clampZoom(z + 0.1))}
            disabled={zoom >= 2.5}
            title="Zoom in (⌘+)"
          >
            <ZoomIn size={13} />
          </button>
        </div>
        <div className="grp">
          <button className="btn xs btn-ghost" onClick={addRow} title="Add row">
            <Plus size={13} /> Row
          </button>
          <button className="btn xs btn-ghost" onClick={addCol} title="Add column">
            <Plus size={13} /> Col
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => selRow && removeRow(selRow)}
            disabled={!selRow}
            title="Delete row"
          >
            <Minus size={13} />
          </button>
          <button
            className="btn xs btn-ghost"
            onClick={() => selCol && removeCol(selCol)}
            disabled={!selCol}
            title="Delete column"
          >
            <Minus size={13} />
          </button>
        </div>
        <div className="grp" style={{ borderRight: "none" }}>
          <span className="tiny muted nowrap">
            {sheet.rows.length}×{sheet.columns.length}
          </span>
        </div>
      </div>

      <div className="sheet-canvas" ref={canvasRef}>
        <table className="grid-table" style={{ zoom }}>
          <colgroup>
            <col style={{ width: 30, minWidth: 30 }} />
            {sheet.columns.map((c) => (
              <col
                key={c.id}
                ref={(el) => {
                  if (el) colRefs.current.set(c.id, el);
                }}
                style={{ width: c.width }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="corner" style={{ height: 24 }}></th>
              {sheet.columns.map((c, i) => (
                <th
                  key={c.id}
                  className="col-head"
                  data-col={c.id}
                  onClick={() => setRenamingCol(c.id === renamingCol ? null : c.id)}
                >
                  {renamingCol === c.id ? (
                    <input
                      className="col-rename-input"
                      style={{ width: Math.max(40, c.width - 8) }}
                      autoFocus
                      defaultValue={c.name || ""}
                      placeholder={colLetter(i)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        setColName(c.id, e.target.value);
                        setRenamingCol(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setColName(c.id, e.currentTarget.value);
                          setRenamingCol(null);
                        } else if (e.key === "Escape") {
                          setRenamingCol(null);
                        }
                      }}
                    />
                  ) : (
                    <span>{c.name || colLetter(i)}</span>
                  )}
                  <div
                    className="col-resize"
                    onPointerDown={(e) => startColResize(c.id, e)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r, ri) => (
              <tr
                key={r.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(r.id, el);
                }}
                style={{ height: r.height }}
              >
                <th
                  className="row-head"
                  data-row={r.id}
                  onClick={() => useApp.getState().selectCell(r.id, "")}
                >
                  {ri + 1}
                  <div
                    className="row-resize"
                    onPointerDown={(e) => startRowResize(r.id, e)}
                  />
                </th>
                {sheet.columns.map((c) => (
                  <CellView key={c.id} row={r.id} col={c.id} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="resize-guide" ref={guideRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}
