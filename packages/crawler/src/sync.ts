import { Prisma, prisma, type Source, type StoryType } from "@truyen/db";
import { slugify, toSearchText } from "@truyen/shared";
import { getAdapter } from "./adapters";
import { HttpError } from "./http";
import type { ChapterRef, StoryDetail, StoryRef } from "./types";

const CHUNK = 2000;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

// ---------- Ghi CrawlRun ----------

/** Chạy một job crawl và ghi lại kết quả vào bảng CrawlRun (hiển thị trong admin). */
export async function withCrawlRun<T extends object>(
  job: string,
  meta: { sourceId?: number; target?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const run = await prisma.crawlRun.create({
    data: { job, sourceId: meta.sourceId, target: meta.target },
  });
  try {
    const result = await fn();
    await prisma.crawlRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", stats: result as Prisma.InputJsonObject, finishedAt: new Date() },
    });
    return result;
  } catch (error) {
    await prisma.crawlRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

// ---------- Danh sách bỏ qua ----------

/** Truyện bị nguồn chặn (403) hoặc đã xoá (404) được bỏ qua trong khoảng này */
const SKIP_DAYS = 7;

/** Bỏ những path đang trong danh sách bỏ qua. */
export async function withoutSkipped(sourceId: number, paths: string[]) {
  if (!paths.length) return paths;
  const skipped = await prisma.crawlSkip.findMany({
    where: { sourceId, path: { in: paths }, until: { gt: new Date() } },
    select: { path: true },
  });
  const set = new Set(skipped.map((s) => s.path));
  return paths.filter((p) => !set.has(p));
}

/**
 * Đồng bộ một truyện và ghi CrawlRun. Nguồn chặn (403, vd Cloudflare challenge) hoặc truyện
 * đã bị xoá (404) thì đưa vào danh sách bỏ qua — thử lại vô ích, không vượt chặn.
 */
export async function syncTracked(source: Source, path: string) {
  try {
    return await withCrawlRun("syncStory", { sourceId: source.id, target: path }, () => syncStory(source, path));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await prisma.storySource.updateMany({ where: { sourceId: source.id, path }, data: { lastError: reason } });
    if (error instanceof HttpError && (error.status === 403 || error.status === 404)) {
      const until = new Date(Date.now() + SKIP_DAYS * 24 * 3600 * 1000);
      await prisma.crawlSkip.upsert({
        where: { sourceId_path: { sourceId: source.id, path } },
        create: { sourceId: source.id, path, reason, until },
        update: { reason, until },
      });
    }
    throw error;
  }
}

// ---------- Truyện + danh sách chương ----------

export interface SyncStoryResult {
  storyId: number;
  created: boolean;
  newChapters: number;
  totalChapters: number;
}

/** Tải thông tin + danh sách chương của một truyện trên nguồn rồi ghi vào DB. */
export async function syncStory(source: Source, path: string): Promise<SyncStoryResult> {
  const adapter = getAdapter(source);
  const detail = await adapter.getStory(path);
  const chapters = await adapter.getChapterList(path);
  return saveStory(source, detail, chapters);
}

async function uniqueSlug(title: string, type: StoryType): Promise<string> {
  const base = slugify(title) || "truyen";
  // Truyện chữ và bản truyện tranh chuyển thể thường trùng tên.
  const candidates = [base, `${base}-${type === "COMIC" ? "truyen-tranh" : "truyen-chu"}`];
  for (let i = 2; candidates.length < 50; i++) candidates.push(`${base}-${i}`);

  const taken = new Set(
    (await prisma.story.findMany({ where: { slug: { in: candidates } }, select: { slug: true } })).map(
      (s) => s.slug,
    ),
  );
  const free = candidates.find((c) => !taken.has(c));
  if (!free) throw new Error(`Không tìm được slug trống cho "${title}"`);
  return free;
}

async function resolveStory(source: Source, detail: StoryDetail) {
  const link = await prisma.storySource.findUnique({
    where: { sourceId_path: { sourceId: source.id, path: detail.path } },
  });
  if (link) return { storyId: link.storyId, linkId: link.id, created: false };

  const matchKey = toSearchText(detail.title);
  // Cùng một truyện đã có từ nguồn khác → gắn thêm nguồn dự phòng.
  const existing = await prisma.story.findFirst({
    where: { matchKey, type: source.type },
    select: { id: true },
  });

  let storyId = existing?.id;
  let created = false;
  if (!storyId) {
    for (let attempt = 0; ; attempt++) {
      try {
        const story = await prisma.story.create({
          data: {
            slug: await uniqueSlug(detail.title, source.type),
            title: detail.title,
            type: source.type,
            matchKey,
          },
        });
        storyId = story.id;
        created = true;
        break;
      } catch (e) {
        // Hai job cùng tạo slug một lúc — thử lại với slug khác.
        if (!isUniqueViolation(e) || attempt >= 2) throw e;
      }
    }
  }

  const newLink = await prisma.storySource.upsert({
    where: { sourceId_path: { sourceId: source.id, path: detail.path } },
    create: { storyId, sourceId: source.id, path: detail.path, priority: source.priority },
    update: {},
  });
  return { storyId, linkId: newLink.id, created };
}

/** Nguồn có priority cao nhất của truyện được quyền ghi đè thông tin; nguồn khác chỉ điền chỗ trống. */
async function isPrimaryLink(storyId: number, linkId: number) {
  const links = await prisma.storySource.findMany({
    where: { storyId },
    select: { id: true, source: { select: { priority: true } } },
  });
  links.sort((a, b) => b.source.priority - a.source.priority || a.id - b.id);
  return links[0]?.id === linkId;
}

export async function saveStory(
  source: Source,
  detail: StoryDetail,
  chapterRefs: ChapterRef[],
): Promise<SyncStoryResult> {
  const { storyId, linkId, created } = await resolveStory(source, detail);
  const primary = created || (await isPrimaryLink(storyId, linkId));
  const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });

  const author = detail.author
    ? await prisma.author.upsert({
        where: { slug: slugify(detail.author) },
        create: { name: detail.author, slug: slugify(detail.author) },
        update: {},
      })
    : undefined;

  await prisma.story.update({
    where: { id: storyId },
    data: primary
      ? {
          title: detail.title,
          altTitles: detail.altTitles,
          status: detail.status,
          description: detail.description ?? story.description,
          coverUrl: detail.coverUrl ?? story.coverUrl,
          authorId: author?.id ?? story.authorId,
          searchText: toSearchText(detail.title, ...detail.altTitles, detail.author),
        }
      : {
          description: story.description ?? detail.description,
          coverUrl: story.coverUrl ?? detail.coverUrl,
          authorId: story.authorId ?? author?.id,
          altTitles: [...new Set([...story.altTitles, ...detail.altTitles])],
        },
  });

  if (primary && detail.genres.length) {
    const genres = await Promise.all(
      detail.genres.map((name) =>
        prisma.genre.upsert({
          where: { slug: slugify(name) },
          create: { name, slug: slugify(name) },
          update: {},
        }),
      ),
    );
    await prisma.$transaction([
      prisma.storyGenre.deleteMany({ where: { storyId } }),
      prisma.storyGenre.createMany({
        data: [...new Set(genres.map((g) => g.id))].map((genreId) => ({ storyId, genreId })),
      }),
    ]);
  }

  const available = chapterRefs.filter((c) => !c.unavailable);
  const { newChapters, totalChapters } = await saveChapters(storyId, linkId, available);
  // Tính cả chương chưa đọc được: số này so với trang "mới cập nhật" để biết truyện có chương mới không.
  const latestNumber = chapterRefs.reduce((max, c) => Math.max(max, c.number), 0) || null;

  await prisma.$transaction([
    prisma.storySource.update({
      where: { id: linkId },
      data: {
        chapterCount: available.length,
        latestChapterNumber: latestNumber,
        lastSyncedAt: new Date(),
        lastError: null,
      },
    }),
    prisma.story.update({
      where: { id: storyId },
      data: {
        chapterCount: totalChapters,
        ...(newChapters > 0 && { latestChapterAt: new Date() }),
      },
    }),
  ]);

  return { storyId, created, newChapters, totalChapters };
}

async function saveChapters(storyId: number, linkId: number, refs: ChapterRef[]) {
  const existing = await prisma.chapter.findMany({
    where: { storyId },
    select: { id: true, number: true },
  });
  const known = new Set(existing.map((c) => c.number));
  const fresh = refs.filter((r) => !known.has(r.number));

  for (const part of chunks(fresh)) {
    await prisma.chapter.createMany({
      data: part.map((r) => ({ storyId, number: r.number, title: r.title })),
      skipDuplicates: true,
    });
  }

  const idByNumber = new Map(
    (
      await prisma.chapter.findMany({ where: { storyId }, select: { id: true, number: true } })
    ).map((c) => [c.number, c.id]),
  );
  for (const part of chunks(refs)) {
    await prisma.chapterSource.createMany({
      data: part.flatMap((r) => {
        const chapterId = idByNumber.get(r.number);
        return chapterId ? [{ chapterId, storySourceId: linkId, path: r.path, credit: r.credit }] : [];
      }),
      skipDuplicates: true,
    });
  }

  return { newChapters: fresh.length, totalChapters: idByNumber.size };
}

// ---------- Phát hiện truyện mới ----------

export interface DiscoverResult {
  pages: number;
  checked: number;
  /** Path các truyện mới hoặc có chương mới, cần syncStory */
  toSync: string[];
}

/** Đọc các trang "mới cập nhật" và trả về những truyện mới hoặc có chương mới so với DB. */
/** Backfill: truyện đã đồng bộ trong khoảng này thì bỏ qua (danh sách toàn bộ không cho biết chương mới nhất) */
const BACKFILL_RESYNC_MS = 24 * 3600_000;

export async function discoverLatest(
  source: Source,
  { fromPage = 1, pages = 1, all = false }: { fromPage?: number; pages?: number; all?: boolean } = {},
): Promise<DiscoverResult> {
  const adapter = getAdapter(source);
  const list = all && adapter.listAll ? adapter.listAll.bind(adapter) : adapter.listLatest.bind(adapter);
  const refs: StoryRef[] = [];
  let page = fromPage;
  for (; page < fromPage + pages; page++) {
    const result = await list(page);
    refs.push(...result.items);
    if (!result.hasNext) {
      page++;
      break;
    }
  }

  const links = await prisma.storySource.findMany({
    where: { sourceId: source.id, path: { in: refs.map((r) => r.path) } },
    select: { path: true, latestChapterNumber: true, lastSyncedAt: true },
  });
  const linkByPath = new Map(links.map((l) => [l.path, l]));

  const toSync = refs
    .filter((r) => {
      const link = linkByPath.get(r.path);
      if (!link) return true;
      if (r.latestChapter === undefined) {
        // Backfill dở dang được làm tiếp ở đợt sau: không đồng bộ lại truyện vừa đồng bộ.
        return !(all && link.lastSyncedAt && Date.now() - link.lastSyncedAt.getTime() < BACKFILL_RESYNC_MS);
      }
      return link.latestChapterNumber == null || r.latestChapter > link.latestChapterNumber;
    })
    .map((r) => r.path);

  await prisma.source.update({
    where: { id: source.id },
    data: { lastCrawledAt: new Date(), lastError: null },
  });
  return { pages: page - fromPage, checked: refs.length, toSync: [...new Set(toSync)] };
}

// ---------- Nội dung chương ----------

/**
 * Lấy nội dung một chương từ nguồn và lưu vào ChapterContent.
 * Thử lần lượt các nguồn của chương theo priority; nguồn lỗi thì chuyển sang nguồn dự phòng.
 */
export async function fetchChapterContent(chapterId: number) {
  const chapter = await prisma.chapter.findUniqueOrThrow({
    where: { id: chapterId },
    include: { sources: { include: { storySource: { include: { source: true } } } } },
  });

  const candidates = chapter.sources
    .filter((cs) => cs.storySource.source.enabled)
    .sort(
      (a, b) =>
        b.storySource.source.priority - a.storySource.source.priority ||
        b.storySource.priority - a.storySource.priority,
    );

  let lastError: unknown = new Error("Chương không có nguồn nào đang bật");
  for (const cs of candidates) {
    const source = cs.storySource.source;
    try {
      const content = await getAdapter(source).getChapterContent(cs.path);
      const data =
        content.kind === "text"
          ? { text: content.html, images: Prisma.DbNull }
          : { text: null, images: content.urls };
      return await prisma.chapterContent.upsert({
        where: { chapterId },
        create: { chapterId, sourceId: source.id, ...data },
        update: { sourceId: source.id, fetchedAt: new Date(), ...data },
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
