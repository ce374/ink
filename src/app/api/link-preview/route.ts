import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const maxDuration = 30;

// Fetch link preview metadata (og:title, og:image, title)
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InkPreview/1.0; +https://ink.app/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("xml")) {
      // not html, return basic info
      return NextResponse.json({
        url: target.toString(),
        title: target.hostname,
        image: null,
        description: ct,
        finalUrl: res.url,
      });
    }
    const html = await res.text();
    const meta = extractMeta(html);
    return NextResponse.json({
      url: target.toString(),
      finalUrl: res.url,
      title: meta.title || target.hostname,
      description: meta.description || "",
      image: meta.image || null,
    });
  } catch (e) {
    return NextResponse.json({
      url: target.toString(),
      title: target.hostname,
      image: null,
      description: "",
      error: String(e),
    });
  }
}

function extractMeta(html: string): {
  title: string;
  description: string;
  image: string | null;
} {
  const get = (re: RegExp): string | null => {
    const m = html.match(re);
    return m ? decode(m[1]) : null;
  };
  const decode = (s: string): string =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  const ogTitle =
    get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ||
    get(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i);
  const titleTag = get(/<title[^>]*>([^<]*)<\/title>/i);
  const ogDesc =
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ||
    get(
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i
    );
  const desc =
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    get(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const ogImage =
    get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i) ||
    get(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i);
  return {
    title: ogTitle || titleTag || "",
    description: ogDesc || desc || "",
    image: ogImage || null,
  };
}
