"use client";

import { create } from "zustand";
import { api, WorkspaceDTO, NodeDTO } from "@/lib/api";
import {
  SheetContent,
  Cell,
  RecordData,
  RecordField,
  FieldKind,
  genId,
  emptySheet,
} from "@/lib/types";

export type View = "home" | "workspace" | "file";

export interface Crumb {
  id: string | null; // null = workspace root
  name: string;
}

const HISTORY_LIMIT = 100;

interface AppState {
  view: View;
  booting: boolean;

  // workspaces
  workspaces: WorkspaceDTO[];
  loadingWorkspaces: boolean;

  // workspace browser
  workspace: WorkspaceDTO | null;
  breadcrumb: Crumb[];
  children: NodeDTO[];
  loadingChildren: boolean;

  // file / sheet
  file: NodeDTO | null;
  sheet: SheetContent | null;
  saving: boolean;
  dirty: boolean;
  selRow: string | null;
  selCol: string | null;
  editing: { row: string; col: string } | null;

  // history
  undoStack: SheetContent[];
  redoStack: SheetContent[];

  // record panel
  openRecordId: string | null;
  recordOpen: boolean;
  recordSheetDirty: number;

  // actions
  boot: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  openWorkspace: (ws: WorkspaceDTO) => Promise<void>;
  goHome: () => void;
  navigateFolder: (crumb: Crumb) => Promise<void>;
  openNode: (node: NodeDTO) => Promise<void>;
  refreshChildren: () => Promise<void>;
  createNode: (type: "FOLDER" | "FILE", name: string) => Promise<void>;
  renameNode: (id: string, name: string) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;

  // sheet ops
  setSheet: (s: SheetContent) => void;
  loadSheet: (s: SheetContent) => void; // load without history (open file)
  commitSheet: () => Promise<void>;
  mutate: (builder: (s: SheetContent) => void) => void;
  undo: () => void;
  redo: () => void;
  setCell: (row: string, col: string, cell: Cell) => void;
  clearCell: (row: string, col: string) => void;
  selectCell: (row: string, col: string) => void;
  startEdit: (row: string, col: string) => void;
  stopEdit: () => void;

  addRow: () => void;
  addCol: () => void;
  removeRow: (id: string) => void;
  removeCol: (id: string) => void;
  setColWidth: (id: string, w: number) => void;
  setRowHeight: (id: string, h: number) => void;
  setColName: (id: string, name: string) => void;

  // records
  openRecord: (recordId: string) => void;
  closeRecord: () => void;
  getRecord: (recordId: string) => RecordData | null;
  updateRecord: (recordId: string, updater: (r: RecordData) => RecordData) => void;
  createRecord: (type?: string, title?: string) => string;
  deleteRecord: (recordId: string) => void;
  setCellRecord: (row: string, col: string, recordId: string) => void;
  // list cells (records inside a cell)
  setCellList: (row: string, col: string, recordIds: string[]) => void;
  addRecordToListCell: (row: string, col: string, recordId: string) => void;
  removeRecordFromListCell: (row: string, col: string, recordId: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useApp = create<AppState>((set, get) => ({
  view: "home",
  booting: true,
  workspaces: [],
  loadingWorkspaces: false,
  workspace: null,
  breadcrumb: [],
  children: [],
  loadingChildren: false,
  file: null,
  sheet: null,
  saving: false,
  dirty: false,
  selRow: null,
  selCol: null,
  editing: null,
  undoStack: [],
  redoStack: [],
  openRecordId: null,
  recordOpen: false,
  recordSheetDirty: 0,

  async boot() {
    await get().refreshWorkspaces();
    set({ booting: false });
  },

  async refreshWorkspaces() {
    set({ loadingWorkspaces: true });
    try {
      const ws = await api.listWorkspaces();
      set({ workspaces: ws });
    } finally {
      set({ loadingWorkspaces: false });
    }
  },

  goHome() {
    set({
      view: "home",
      workspace: null,
      breadcrumb: [],
      children: [],
      file: null,
      sheet: null,
      undoStack: [],
      redoStack: [],
      recordOpen: false,
      openRecordId: null,
    });
  },

  async openWorkspace(ws) {
    set({
      view: "workspace",
      workspace: ws,
      breadcrumb: [{ id: null, name: ws.name }],
    });
    await get().refreshChildren();
  },

  async navigateFolder(crumb) {
    const bc = get().breadcrumb;
    const idx = bc.findIndex((c) => c.id === crumb.id && c.name === crumb.name);
    const newBc = idx >= 0 ? bc.slice(0, idx + 1) : [...bc, crumb];
    set({ breadcrumb: newBc, view: "workspace", file: null, sheet: null });
    await get().refreshChildren();
  },

  async refreshChildren() {
    const ws = get().workspace;
    if (!ws) return;
    set({ loadingChildren: true });
    try {
      const bc = get().breadcrumb;
      const parent = bc.length ? bc[bc.length - 1].id : null;
      let children: NodeDTO[] = [];
      if (!parent) {
        const r = await fetch(`/api/workspaces/${ws.id}`).then((x) => x.json());
        children = r.rootNodes as NodeDTO[];
      } else {
        const r = await api.getNode(parent);
        children = r.children ?? [];
      }
      children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "FOLDER" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      set({ children });
    } finally {
      set({ loadingChildren: false });
    }
  },

  async createNode(type, name) {
    const ws = get().workspace;
    if (!ws) return;
    const bc = get().breadcrumb;
    const parent = bc.length ? bc[bc.length - 1].id : null;
    await api.createNode({ workspaceId: ws.id, parentId: parent, type, name });
    await get().refreshChildren();
  },

  async renameNode(id, name) {
    await api.updateNode(id, { name });
    await get().refreshChildren();
  },

  async deleteNode(id) {
    await api.deleteNode(id);
    await get().refreshChildren();
  },

  async openNode(node) {
    if (node.type === "FOLDER") {
      const bc = get().breadcrumb;
      set({
        view: "workspace",
        breadcrumb: [...bc, { id: node.id, name: node.name }],
      });
      await get().refreshChildren();
    } else {
      set({ view: "file", file: node, selRow: null, selCol: null, editing: null });
      const r = await api.getNode(node.id);
      get().loadSheet(r.content ?? emptySheet());
    }
  },

  setSheet(s) {
    get().mutate((draft) => {
      Object.assign(draft, s);
    });
  },

  loadSheet(s) {
    set({ sheet: s, dirty: false, undoStack: [], redoStack: [] });
  },

  async commitSheet() {
    const { file, sheet } = get();
    if (!file || !sheet) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    set({ saving: true });
    try {
      await api.updateNode(file.id, { content: sheet });
      set({ dirty: false, saving: false });
    } catch (e) {
      set({ saving: false });
      throw e;
    }
  },

  // history-aware mutation: snapshots current sheet to undoStack, applies builder to a clone
  mutate(builder) {
    const cur = get().sheet;
    if (!cur) return;
    const next = structuredClone(cur);
    builder(next);
    const undoStack = [...get().undoStack, cur];
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    set({ sheet: next, undoStack, redoStack: [], dirty: true });
    scheduleSave(get);
  },

  undo() {
    const { sheet, undoStack } = get();
    if (!sheet || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);
    const redoStack = [...get().redoStack, sheet];
    set({
      sheet: prev,
      undoStack: newUndo,
      redoStack,
      dirty: true,
      editing: null,
    });
    scheduleSave(get);
  },

  redo() {
    const { sheet, redoStack } = get();
    if (!sheet || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);
    const undoStack = [...get().undoStack, sheet];
    set({
      sheet: next,
      redoStack: newRedo,
      undoStack,
      dirty: true,
      editing: null,
    });
    scheduleSave(get);
  },

  setCell(row, col, cell) {
    get().mutate((s) => {
      s.cells[`${row}:${col}`] = cell;
    });
  },

  clearCell(row, col) {
    get().mutate((s) => {
      delete s.cells[`${row}:${col}`];
    });
  },

  selectCell(row, col) {
    set({ selRow: row, selCol: col, editing: null });
  },

  startEdit(row, col) {
    set({ editing: { row, col }, selRow: row, selCol: col });
  },

  stopEdit() {
    set({ editing: null });
  },

  addRow() {
    get().mutate((s) => {
      const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      s.rows.push({ id, height: 30 });
    });
  },

  addCol() {
    get().mutate((s) => {
      const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      s.columns.push({ id, width: 120 });
    });
  },

  removeRow(id) {
    get().mutate((s) => {
      s.rows = s.rows.filter((r) => r.id !== id);
      for (const k of Object.keys(s.cells)) {
        if (k.startsWith(id + ":")) delete s.cells[k];
      }
    });
  },

  removeCol(id) {
    get().mutate((s) => {
      s.columns = s.columns.filter((c) => c.id !== id);
      for (const k of Object.keys(s.cells)) {
        if (k.endsWith(":" + id)) delete s.cells[k];
      }
    });
  },

  setColWidth(id, w) {
    get().mutate((s) => {
      for (const c of s.columns) {
        if (c.id === id) {
          c.width = Math.max(32, Math.min(900, Math.round(w)));
          break;
        }
      }
    });
  },

  setRowHeight(id, h) {
    get().mutate((s) => {
      for (const r of s.rows) {
        if (r.id === id) {
          r.height = Math.max(18, Math.min(500, Math.round(h)));
          break;
        }
      }
    });
  },

  setColName(id, name) {
    get().mutate((s) => {
      for (const c of s.columns) {
        if (c.id === id) {
          c.name = name;
          break;
        }
      }
    });
  },

  // records
  openRecord(recordId) {
    set({ recordOpen: true, openRecordId: recordId });
  },
  closeRecord() {
    set({ recordOpen: false, openRecordId: null });
  },

  getRecord(recordId) {
    const sheet = get().sheet;
    if (!sheet) return null;
    return sheet.records[recordId] ?? null;
  },

  updateRecord(recordId, updater) {
    get().mutate((s) => {
      const cur = s.records[recordId];
      if (!cur) return;
      s.records[recordId] = updater(cur);
    });
    set({ recordSheetDirty: get().recordSheetDirty + 1 });
  },

  createRecord(type = "Record", title = "Untitled") {
    const sheet = get().sheet;
    if (!sheet) return "";
    const id = `rec_${sheet.nextRecordId}`;
    get().mutate((s) => {
      s.records[id] = {
        id,
        type,
        title,
        fields: [],
      };
      s.nextRecordId = s.nextRecordId + 1;
    });
    return id;
  },

  deleteRecord(recordId) {
    get().mutate((s) => {
      delete s.records[recordId];
      // also remove from any list cells referencing it
      for (const key of Object.keys(s.cells)) {
        const c = s.cells[key];
        if (c.type === "list") {
          const ids = (c.data as { recordIds: string[] }).recordIds;
          if (ids.includes(recordId)) {
            (c.data as { recordIds: string[] }).recordIds = ids.filter(
              (r) => r !== recordId
            );
          }
        }
      }
    });
  },

  setCellRecord(row, col, recordId) {
    get().setCell(row, col, {
      type: "record",
      data: { recordId },
    });
  },

  // list cells — records living inline inside a cell
  setCellList(row, col, recordIds) {
    get().setCell(row, col, {
      type: "list",
      data: { recordIds },
    });
  },
  addRecordToListCell(row, col, recordId) {
    get().mutate((s) => {
      const key = `${row}:${col}`;
      const cur = s.cells[key];
      let ids: string[];
      if (cur && cur.type === "list") {
        ids = (cur.data as { recordIds: string[] }).recordIds;
      } else {
        ids = [];
      }
      if (!ids.includes(recordId)) ids.push(recordId);
      s.cells[key] = { type: "list", data: { recordIds: ids } };
    });
  },
  removeRecordFromListCell(row, col, recordId) {
    get().mutate((s) => {
      const key = `${row}:${col}`;
      const cur = s.cells[key];
      if (!cur || cur.type !== "list") return;
      const ids = (cur.data as { recordIds: string[] }).recordIds;
      (cur.data as { recordIds: string[] }).recordIds = ids.filter(
        (r) => r !== recordId
      );
    });
  },
}));

function scheduleSave(get: () => AppState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void get().commitSheet();
  }, 900);
}

export function makeField(label: string, kind: FieldKind): RecordField {
  return { id: genId("f"), label, kind, value: "" };
}

export { genId, emptySheet };
