import { db } from "@/lib/db";
import { ensureWorkspaceDir, writeMedia } from "@/lib/storage";
import type {
  SheetContent,
  Cell,
  RecordData,
  RecordField,
  FieldKind,
} from "@/lib/types";

// Seed an example workspace from the iTunes Search API + LRCLIB lyrics.
//
// Architecture: the discography is a real spreadsheet.
//   - Workspace = the Artist (name + profile image)
//   - Discography.nt sheet: one row per album
//       columns: Cover | Album | Year | Genre | Songs | iTunes
//   - Each album row holds its data IN CELLS (cover image, title text,
//     year text, genre text, iTunes link). The Songs cell is a record
//     card connected to that row, whose children are the album's songs.
//   - Each Song child record holds No. / Title / Duration / Lyrics / Credits / links.

interface ItunesAlbum {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  releaseDate: string;
  trackCount: number;
  primaryGenreName: string;
  collectionViewUrl?: string;
}

interface ItunesTrack {
  trackName: string;
  trackNumber: number;
  trackTimeMillis?: number;
  trackViewUrl?: string;
}

interface LrcResult {
  trackName?: string;
  artistName?: string;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InkSeed/1.0; +https://ink.app/bot)",
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchBuffer(url: string, timeoutMs = 15000): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InkSeed/1.0; +https://ink.app/bot)",
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

function hiResArtwork(url: string): string {
  return url.replace(/\/\d+x\d+bb\.(jpg|png)/, "/200x200bb.$1");
}

function getExtFromUrl(url: string): string {
  const m = url.match(/\.([a-z]{3,4})(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "jpg";
}

function mimeForExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] || "application/octet-stream";
}

let fieldCounter = 0;
function field(
  label: string,
  kind: FieldKind,
  value: string
): RecordField {
  fieldCounter++;
  return {
    id: `sf_${Date.now().toString(36)}_${fieldCounter}`,
    label,
    kind,
    value,
  };
}

function fmtDuration(ms?: number): string {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function fmtYear(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return String(d.getFullYear());
}

export async function seedExampleWorkspace(
  artistQuery = "Daft Punk",
  opts: { albumLimit?: number; trackLimit?: number } = {}
): Promise<{ workspaceId: string; artistName: string; albums: number; songs: number }> {
  const albumLimit = opts.albumLimit ?? 5;
  const trackLimit = opts.trackLimit ?? 10;

  // 1) iTunes album search
  const term = encodeURIComponent(artistQuery);
  const albumSearch = await fetchJson<{ results: ItunesAlbum[] }>(
    `https://itunes.apple.com/search?term=${term}&entity=album&limit=${albumLimit}&attribute=artistTerm`
  );
  const albums = (albumSearch?.results ?? []).filter(
    (a) => a.collectionName && a.artworkUrl100
  );

  const artistName = albums[0]?.artistName || artistQuery;
  const genre = albums[0]?.primaryGenreName || "";

  // 2) Create workspace (the workspace IS the artist)
  const ws = await db.workspace.create({
    data: { name: artistName, profileMediaId: null },
  });
  const workspaceId = ws.id;
  await ensureWorkspaceDir(workspaceId);

  let profileMediaId: string | null = null;
  let songCounter = 0;

  // 3) Artist profile image (workspace profile) = first album artwork hi-res
  if (albums[0]?.artworkUrl100) {
    const url = hiResArtwork(albums[0].artworkUrl100).replace(
      /200x200bb/,
      "600x600bb"
    );
    const buf = await fetchBuffer(url);
    if (buf) {
      const ext = getExtFromUrl(url) || "jpg";
      const mid = `m_seed_${Date.now().toString(36)}_prof`;
      await writeMedia(workspaceId, mid, ext, buf);
      await db.mediaAsset.create({
        data: {
          id: mid,
          workspaceId,
          filename: `${artistName}-profile.${ext}`,
          mimeType: mimeForExt(ext),
          size: buf.length,
          ext,
        },
      });
      profileMediaId = mid;
    }
  }

  // Sheet structure: rows = albums, columns = Cover/Album/Year/Genre/Songs/iTunes
  const columns = [
    { id: "c1", width: 84, name: "Cover" },
    { id: "c2", width: 150, name: "Album" },
    { id: "c3", width: 54, name: "Year" },
    { id: "c4", width: 96, name: "Genre" },
    { id: "c5", width: 180, name: "Songs" },
    { id: "c6", width: 120, name: "iTunes" },
  ];

  const rows: { id: string; height: number }[] = [];
  const cells: Record<string, Cell> = {};
  const recordsMap: Record<string, RecordData> = {};
  let recCounter = 0;
  let albumsAdded = 0;

  for (const al of albums) {
    if (albumsAdded >= albumLimit) break;
    const rowId = `r${albumsAdded + 1}`;
    rows.push({ id: rowId, height: 180 });

    // --- Cover cell (c1): download album art as a media asset, put image in cell ---
    if (al.artworkUrl100) {
      const url = hiResArtwork(al.artworkUrl100);
      const buf = await fetchBuffer(url);
      if (buf) {
        const ext = getExtFromUrl(url) || "jpg";
        const mid = `m_seed_${Date.now().toString(36)}_al${albumsAdded}`;
        await writeMedia(workspaceId, mid, ext, buf);
        await db.mediaAsset.create({
          data: {
            id: mid,
            workspaceId,
            filename: `${al.collectionName}.${ext}`.replace(/[^\w.-]+/g, "_"),
            mimeType: mimeForExt(ext),
            size: buf.length,
            ext,
          },
        });
        cells[`${rowId}:c1`] = {
          type: "image",
          data: { mediaId: mid },
        };
      }
    }

    // --- Album title cell (c2): text ---
    cells[`${rowId}:c2`] = {
      type: "text",
      data: { value: al.collectionName },
    };

    // --- Year cell (c3): text ---
    const yr = fmtYear(al.releaseDate);
    if (yr) {
      cells[`${rowId}:c3`] = { type: "text", data: { value: yr } };
    }

    // --- Genre cell (c4): text ---
    if (genre) {
      cells[`${rowId}:c4`] = { type: "text", data: { value: genre } };
    }

    // --- Songs cell (c5): a list cell — the album's songs live INSIDE this cell ---
    const songIds: string[] = [];
    cells[`${rowId}:c5`] = {
      type: "list",
      data: { recordIds: songIds }, // filled below; object identity is shared
    };

    // --- iTunes cell (c6): link with live preview ---
    if (al.collectionViewUrl) {
      cells[`${rowId}:c6`] = {
        type: "link",
        data: { url: al.collectionViewUrl },
      };
    }

    // fetch tracks for this album
    const lookup = await fetchJson<{ results: ItunesTrack[] }>(
      `https://itunes.apple.com/lookup?id=${al.collectionId}&entity=song&limit=${trackLimit}`
    );
    const tracks = (lookup?.results ?? []).filter(
      (t) => t.trackName && typeof t.trackNumber === "number"
    );

    // fetch lyrics in parallel (cap concurrency)
    const lyricsResults: (LrcResult | null)[] = [];
    const concurrency = 4;
    for (let i = 0; i < tracks.length; i += concurrency) {
      const batch = tracks.slice(i, i + concurrency);
      const res = await Promise.all(
        batch.map((t) =>
          fetchJson<LrcResult[]>(
            `https://lrclib.net/api/search?artist_name=${encodeURIComponent(
              artistName
            )}&track_name=${encodeURIComponent(t.trackName)}`
          ).then((r) => (r && r.length ? r[0] : null))
        )
      );
      lyricsResults.push(...res);
    }

    // build song records — each is a flat record living inside the Songs cell
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const lrc = lyricsResults[i];
      const songRecord: RecordData = {
        id: `rec_${++recCounter}`,
        type: "Song",
        title: t.trackName,
        fields: [],
      };
      recordsMap[songRecord.id] = songRecord;
      songIds.push(songRecord.id);
      songRecord.fields.push(field("No.", "number", String(t.trackNumber)));
      if (t.trackTimeMillis)
        songRecord.fields.push(
          field("Duration", "text", fmtDuration(t.trackTimeMillis))
        );
      const lyrics = lrc?.plainLyrics || lrc?.syncedLyrics || "";
      const cleanLyrics = lyrics.replace(/\[(\d+:\d+\.\d+)\]/g, "");
      songRecord.fields.push(
        field("Lyrics", "richtext", cleanLyrics.trim() || "(lyrics unavailable)")
      );
      songRecord.fields.push(
        field(
          "Credits",
          "richtext",
          `Artist: ${artistName}\nLyrics source: LRCLIB (https://lrclib.net)`
        )
      );
      if (t.trackViewUrl)
        songRecord.fields.push(field("iTunes", "link", t.trackViewUrl));
      songRecord.fields.push(
        field(
          "LRCLIB",
          "link",
          `https://lrclib.net/api/search?artist_name=${encodeURIComponent(
            artistName
          )}&track_name=${encodeURIComponent(t.trackName)}`
        )
      );
      songCounter++;
    }

    albumsAdded++;
  }

  // pad with empty rows so the grid feels like a real spreadsheet
  const padCount = Math.max(0, 18 - rows.length);
  for (let i = 0; i < padCount; i++) {
    rows.push({ id: `r${rows.length + 1}`, height: 28 });
  }

  const sheet: SheetContent = {
    columns,
    rows,
    cells,
    records: recordsMap,
    nextRecordId: recCounter + 1,
  };

  // 4) Create file node with content
  await db.node.create({
    data: {
      workspaceId,
      parentId: null,
      name: "Discography.nt",
      type: "FILE",
      content: JSON.stringify(sheet),
    },
  });

  // 5) set profile image on the workspace
  if (profileMediaId) {
    await db.workspace.update({
      where: { id: workspaceId },
      data: { profileMediaId: profileMediaId },
    });
  }

  return {
    workspaceId,
    artistName,
    albums: albumsAdded,
    songs: songCounter,
  };
}
