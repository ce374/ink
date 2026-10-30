// Shared data types for the ink productivity app

export const FILE_EXTENSION = ".nt";

export type NodeType = "FOLDER" | "FILE";

export type CellType = "text" | "image" | "link" | "audio" | "record" | "list";

export interface Column {
  id: string;
  width: number;
  name?: string; // header label
}

export interface Row {
  id: string;
  height: number;
}

export interface TextCellData {
  value: string;
}

export interface ImageCellData {
  mediaId: string;
}

export interface LinkCellData {
  url: string;
  title?: string;
}

export interface AudioCellData {
  mediaId: string;
  name?: string;
}

export interface RecordCellData {
  recordId: string;
}

export interface ListCellData {
  recordIds: string[]; // records shown inline inside the cell
}

export interface Cell {
  type: CellType;
  data:
    | TextCellData
    | ImageCellData
    | LinkCellData
    | AudioCellData
    | RecordCellData
    | ListCellData;
}

export type FieldKind =
  | "text"
  | "richtext"
  | "image"
  | "audio"
  | "link"
  | "file"
  | "number"
  | "date";

export interface RecordField {
  id: string;
  label: string;
  kind: FieldKind;
  value: string; // for media/link/file, value holds mediaId or url; for text/richtext holds content
}

export interface RecordData {
  id: string;
  type: string; // custom type name, e.g. "Album", "Song"
  title: string;
  fields: RecordField[];
}

export interface SheetContent {
  columns: Column[];
  rows: Row[];
  cells: Record<string, Cell>; // key `${rowId}:${colId}`
  records: Record<string, RecordData>; // recordId -> record
  nextRecordId: number;
}

export function emptySheet(): SheetContent {
  return {
    columns: [
      { id: "c1", width: 120 },
      { id: "c2", width: 120 },
      { id: "c3", width: 120 },
      { id: "c4", width: 120 },
    ],
    rows: Array.from({ length: 24 }, (_, i) => ({
      id: `r${i + 1}`,
      height: 30,
    })),
    cells: {},
    records: {},
    nextRecordId: 1,
  };
}

export function genId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// Audio MIME types supported
export const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "flac",
  "opus",
  "ogg",
  "aac",
  "webm",
];

export function isAudioExt(ext: string): boolean {
  return AUDIO_EXTENSIONS.includes(ext.toLowerCase());
}

export const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
];

export function isImageExt(ext: string): boolean {
  return IMAGE_EXTENSIONS.includes(ext.toLowerCase());
}

export function getExt(filename: string): string {
  const m = filename.match(/\.([^./\\]+)$/);
  return m ? m[1].toLowerCase() : "";
}
