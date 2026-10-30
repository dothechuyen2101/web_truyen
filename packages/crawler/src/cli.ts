import { parseArgs } from "node:util";
import { prisma, type Source } from "@truyen/db";
import { getAdapter } from "./adapters";
import { toPath } from "./html";
import { discoverLatest, fetchChapterContent, syncStory, withCrawlRun } from "./sync";

const HELP = `Cách dùng: pnpm crawl <lệnh> [tham số]

  story <url>                 Đồng bộ một truyện (thông tin + danh sách chương) vào DB
  chapter <url>               Lấy nội dung một chương đã có trong DB và lưu lại
  latest <source> [--pages N] [--sync]
                              Quét trang "mới cập nhật"; --sync để đồng bộ luôn các truyện tìm được
  preview <url>               Chỉ parse và in kết quả, không ghi DB (truyện hoặc chương)

  --source <key>              Chỉ định nguồn khi domain trong URL khác baseUrl trong DB`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    pages: { type: "string", default: "1" },
    sync: { type: "boolean", default: false },
    source: { type: "string" },
  },
});
const [command, arg] = positionals;

async function findSource(urlOrKey: string): Promise<Source> {
  const sources = await prisma.source.findMany();
  const key = values.source ?? urlOrKey;
  const byKey = sources.find((s) => s.key === key);
  if (byKey) return byKey;

  const host = new URL(urlOrKey).hostname.replace(/^www\./, "");
  const byHost = sources.find((s) => new URL(s.baseUrl).hostname.replace(/^www\./, "") === host);
  if (!byHost) throw new Error(`Không tìm thấy nguồn cho ${host}. Dùng --source <key>.`);
  return byHost;
}

async function main() {
  if (!command || !arg) {
    console.log(HELP);
    return;
  }

  if (command === "story") {
    const source = await findSource(arg);
    const path = toPath(arg, source.baseUrl);
    const result = await withCrawlRun("syncStory", { sourceId: source.id, target: path }, () =>
      syncStory(source, path),
    );
    const story = await prisma.story.findUniqueOrThrow({ where: { id: result.storyId } });
    console.log(`✔ ${story.title} (/truyen/${story.slug})`, result);
    return;
  }

  if (command === "chapter") {
    const source = await findSource(arg);
    const path = toPath(arg, source.baseUrl);
    const cs = await prisma.chapterSource.findFirst({
      where: { path, storySource: { sourceId: source.id } },
    });
    if (!cs) throw new Error("Chương chưa có trong DB — chạy `pnpm crawl story <url truyện>` trước.");
    const content = await fetchChapterContent(cs.chapterId);
    const images = Array.isArray(content.images) ? content.images.length : 0;
    console.log(`✔ Đã lưu chương #${cs.chapterId}:`, content.text ? `${content.text.length} ký tự` : `${images} ảnh`);
    return;
  }

  if (command === "latest") {
    const source = await findSource(arg);
    const result = await withCrawlRun("discovery", { sourceId: source.id }, () =>
      discoverLatest(source, { pages: Number(values.pages) }),
    );
    console.log(`Đã quét ${result.checked} truyện, ${result.toSync.length} cần đồng bộ`);
    if (!values.sync) return;
    for (const path of result.toSync) {
      try {
        const r = await withCrawlRun("syncStory", { sourceId: source.id, target: path }, () =>
          syncStory(source, path),
        );
        console.log(`  ✔ ${path}`, r);
      } catch (error) {
        console.error(`  ✘ ${path}:`, error instanceof Error ? error.message : error);
      }
    }
    return;
  }

  if (command === "preview") {
    const source = await findSource(arg);
    const adapter = getAdapter(source);
    const path = toPath(arg, source.baseUrl);
    if (/chuong-[\d.]+\/?$/.test(path)) {
      const content = await adapter.getChapterContent(path);
      console.log(content.kind === "text" ? content.html.slice(0, 1500) : content.urls);
    } else {
      const story = await adapter.getStory(path);
      const chapters = await adapter.getChapterList(path);
      console.log(story);
      console.log(`${chapters.length} chương:`, chapters.slice(0, 3), "…", chapters.slice(-2));
    }
    return;
  }

  console.log(HELP);
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("✘", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
