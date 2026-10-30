"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Link as LinkIcon } from "lucide-react";

interface Preview {
  title: string;
  description?: string;
  image: string | null;
  finalUrl?: string;
  host: string;
}

const cache = new Map<string, Preview>();

export function LinkPreviewCard({
  url,
  compact,
  onChangeTitle,
}: {
  url: string;
  compact?: boolean;
  onChangeTitle?: (t: string) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(url);
    if (cached) {
      setPreview(cached);
      return;
    }
    setLoading(true);
    api
      .linkPreview(url)
      .then((r) => {
        if (cancelled) return;
        const host = (() => {
          try {
            return new URL(r.finalUrl || r.url).hostname.replace(/^www\./, "");
          } catch {
            return url;
          }
        })();
        const p: Preview = {
          title: r.title || host,
          description: r.description,
          image: r.image,
          finalUrl: r.finalUrl,
          host,
        };
        cache.set(url, p);
        setPreview(p);
        if (onChangeTitle && p.title) onChangeTitle(p.title);
      })
      .catch(() => {
        if (cancelled) return;
        const host = (() => {
          try {
            return new URL(url).hostname.replace(/^www\./, "");
          } catch {
            return url;
          }
        })();
        setPreview({ title: host, host, image: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (compact) {
    return (
      <a
        className="cell-tag link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%" }}
      >
        <LinkIcon size={10} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {loading ? url : preview?.title || url}
        </span>
      </a>
    );
  }

  return (
    <a
      className="link-card"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {preview?.image ? (
        <img className="lc-thumb" src={preview.image} alt="" />
      ) : (
        <div
          className="lc-thumb"
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <LinkIcon size={14} />
        </div>
      )}
      <div className="lc-body">
        <div className="lc-title">{loading ? "Loading…" : preview?.title || url}</div>
        {preview?.description && <div className="lc-desc">{preview.description}</div>}
        <div className="lc-host">{preview?.host || url}</div>
      </div>
    </a>
  );
}
