import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

export function loadHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

function inlineCss($: CheerioAPI): string {
  return $("style")
    .map((_, el) => $(el).text())
    .get()
    .join("\n");
}

/**
 * Các class bị ẩn bằng CSS trong thẻ <style> của trang. Một số nguồn chèn phần tử mồi
 * (thể loại/tác giả giả) với class ngẫu nhiên rồi ẩn đi để làm sai dữ liệu crawl.
 */
export function cssHiddenClasses($: CheerioAPI): Set<string> {
  const hidden = new Set<string>();
  for (const [, selectors = "", body = ""] of inlineCss($).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/display\s*:\s*none|visibility\s*:\s*hidden/i.test(body)) continue;
    for (const selector of selectors.split(",")) {
      const cls = selector.trim().match(/^\.([\w-]+)$/);
      if (cls?.[1]) hidden.add(cls[1]);
    }
  }
  return hidden;
}

/** Nhãn gắn qua CSS `.cls h3:before{content:"Tác giả:"}` — trả về map class -> nhãn. */
export function cssBeforeLabels($: CheerioAPI): Map<string, string> {
  const labels = new Map<string, string>();
  const css = inlineCss($);
  for (const [, cls = "", label = ""] of css.matchAll(
    /\.([\w-]+)[^{},]*:before\s*\{[^}]*content\s*:\s*"([^"]*)"/g,
  )) {
    labels.set(cls, label.trim());
  }
  return labels;
}

/** Xoá các phần tử bị ẩn (bằng class trong <style> hoặc inline style) bên trong scope. */
export function stripHidden($: CheerioAPI, scope: Cheerio<AnyNode>, hiddenClasses = cssHiddenClasses($)) {
  scope.find("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) $(el).remove();
  });
  for (const cls of hiddenClasses) scope.find(`.${cls}`).remove();
  scope.find("script, style, noscript, iframe, ins").remove();
}

export function text(el: Cheerio<AnyNode>): string {
  return el.text().replace(/\s+/g, " ").trim();
}

/** Chuyển URL tuyệt đối của nguồn thành path tương đối; giữ nguyên nếu đã là path. */
export function toPath(href: string, baseUrl: string): string {
  const url = new URL(href, baseUrl);
  return url.pathname + url.search;
}

export function absoluteUrl(href: string, baseUrl: string): string {
  return new URL(href, baseUrl).toString();
}

/** Lấy số chương từ URL, vd ".../chuong-136.5" -> 136.5, ".../chuong-12.html" -> 12 */
export function chapterNumberFromPath(path: string): number | undefined {
  const m = path.match(/chuong-(\d+(?:\.\d+)?)(?:\.html?)?\/?(?:[?#].*)?$/i);
  return m?.[1] ? Number(m[1]) : undefined;
}
