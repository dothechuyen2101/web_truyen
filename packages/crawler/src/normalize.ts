import sanitizeHtml from "sanitize-html";

/**
 * "c.h.ế.t" -> "chết". Nguồn chèn dấu chấm giữa các chữ cái để né bộ lọc từ nhạy cảm.
 * Chỉ gộp chuỗi từ 3 chữ cái trở lên để không phá các viết tắt như "v.v".
 */
export function joinDottedWords(input: string): string {
  return input.replace(/(?<![\p{L}\p{M}.])\p{L}(?:\.\p{L}){2,}(?![\p{L}\p{M}])/gu, (m) =>
    m.replace(/\./g, ""),
  );
}

/** Làm sạch HTML nội dung chương/mô tả: chỉ giữ thẻ định dạng cơ bản, bỏ đoạn rỗng, gộp chữ bị chèn dấu chấm. */
export function cleanContentHtml(html: string): string {
  const sanitized = sanitizeHtml(html.normalize("NFC"), {
    allowedTags: ["p", "br", "em", "strong", "i", "b", "u", "hr"],
    allowedAttributes: {},
  });
  return joinDottedWords(sanitized)
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/g, "")
    .replace(/(?:<br\s*\/?>\s*){3,}/g, "<br /><br />")
    .trim();
}

/** Nội dung ngăn đoạn bằng <br> → mỗi đoạn một <p> (kể cả khi cả khối nằm trong một <p> có <br><br>). */
export function brToParagraphs(html: string): string {
  if (/<p[\s>]/i.test(html)) return html.replace(/(?:<br\s*\/?>\s*){2,}/gi, "</p><p>");
  return html
    .split(/(?:<br\s*\/?>\s*)+/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<p>${s}</p>`)
    .join("");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Ghép các dòng văn bản thành các đoạn <p>. */
export function linesToHtml(lines: string[]): string {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${escapeHtml(joinDottedWords(l.normalize("NFC")))}</p>`)
    .join("");
}

/** "Tháng Tư Ôn Hòa - Mộng Tiêu Nhị" -> "Tháng Tư Ôn Hòa" khi tiêu đề kèm tên tác giả ở cuối. */
export function stripAuthorSuffix(title: string, author?: string): string {
  if (!author) return title;
  const suffix = new RegExp(`\\s*[-–—]\\s*${author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const stripped = title.replace(suffix, "").trim();
  return stripped || title;
}
