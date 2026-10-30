import { Suspense } from "react";
import { prisma } from "@truyen/db";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AdminHeader, AdminSkeleton, Badge, Empty, Panel, StatCard, inputClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { formatChapterNumber, formatNumber, parseChapterParam } from "@/lib/format";
import { proxiedImage } from "@/lib/image-proxy";
import { addHouseAd, deleteFingerprint, markAdImage, rescanAds, updateHouseAd } from "../actions";

/** Số ảnh đầu/cuối chương hiển thị để đánh dấu (khớp với vùng worker kiểm tra) */
const EDGE = 3;

async function ChapterInspector({ chapterUrl }: { chapterUrl: string }) {
  const m = chapterUrl.match(/\/truyen\/([^/?#]+)\/(chuong-[\d.]+)/);
  const number = m?.[2] ? parseChapterParam(m[2]) : null;
  if (!m || number === null) return <p className="text-sm text-destructive">URL chương không hợp lệ.</p>;

  const chapter = await prisma.chapter.findFirst({
    where: { number, story: { slug: m[1] } },
    include: { content: true, story: { select: { title: true } } },
  });
  const images = Array.isArray(chapter?.content?.images) ? (chapter.content.images as string[]) : [];
  if (!chapter) return <p className="text-sm text-destructive">Không tìm thấy chương.</p>;
  if (!images.length) return <p className="text-sm text-muted-foreground">Chương chưa có nội dung ảnh — hãy mở chương trên site trước.</p>;

  const indexes = [...new Set([...Array(Math.min(EDGE, images.length)).keys(), ...[...Array(Math.min(EDGE, images.length)).keys()].map((i) => images.length - 1 - i)])].sort((a, b) => a - b);
  const detected = new Set(chapter.content?.adIndexes ?? []);

  return (
    <div>
      <p className="mb-3 text-sm">
        {chapter.story.title} – Chương {formatChapterNumber(chapter.number)} · {images.length} ảnh
        {chapter.content?.adCheckedAt ? ` · đã quét, phát hiện ${detected.size} ảnh quảng cáo` : " · chưa quét"}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {indexes.map((i) => (
          <div key={i} className={`overflow-hidden rounded-xl border ${detected.has(i) ? "border-amber-500 ring-2 ring-amber-500/40" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proxiedImage(images[i]!)} alt={`Ảnh ${i + 1}`} className="aspect-[3/4] w-full bg-muted object-cover object-top" loading="lazy" />
            <div className="space-y-1.5 p-2 text-xs">
              <p className="flex items-center justify-between">
                Ảnh {i + 1} {detected.has(i) && <Badge color="amber">Quảng cáo</Badge>}
              </p>
              <ActionForm action={markAdImage}>
                <input type="hidden" name="imageUrl" value={images[i]} />
                <input type="hidden" name="chapterId" value={chapter.id} />
                <input name="label" placeholder="Ghi chú (tuỳ chọn)" className={`${inputClass} h-8 w-full text-xs`} />
                <SubmitButton className="w-full">Là quảng cáo</SubmitButton>
              </ActionForm>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function Ads({ searchParams }: Pick<PageProps<"/admin/quang-cao">, "searchParams">) {
  await requireAdmin("/admin/quang-cao");
  const sp = await searchParams;
  const chapterUrl = typeof sp.chuong === "string" ? sp.chuong.trim() : "";

  const [houseAds, fingerprints, detectedChapters] = await Promise.all([
    prisma.houseAd.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.adFingerprint.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.chapterContent.count({ where: { NOT: { adIndexes: { isEmpty: true } } } }),
  ]);

  return (
    <>
      <AdminHeader
        title="Quảng cáo"
        description="Nhận diện ảnh quảng cáo nguồn chèn vào chương truyện tranh và thay bằng quảng cáo của site (không có quảng cáo nào đang bật thì ảnh quảng cáo của nguồn bị ẩn)."
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Quảng cáo của site" value={houseAds.filter((a) => a.enabled).length} hint={`${houseAds.length} tổng`} />
        <StatCard label="Mẫu ảnh quảng cáo nguồn" value={fingerprints.length} />
        <StatCard label="Chương có quảng cáo nguồn" value={formatNumber(detectedChapters)} />
      </div>

      <div className="space-y-6">
        <Panel title="Quảng cáo của site" description="Hiển thị thay cho ảnh quảng cáo của nguồn, xoay vòng giữa các quảng cáo đang bật.">
          <ActionForm action={addHouseAd} className="mb-4 grid gap-2 sm:grid-cols-[1fr_2fr_2fr_auto]">
            <input name="name" placeholder="Tên" required className={inputClass} />
            <input name="imageUrl" placeholder="URL ảnh (https://…)" required className={inputClass} />
            <input name="linkUrl" placeholder="Link khi bấm (tuỳ chọn)" className={inputClass} />
            <SubmitButton variant="default">Thêm</SubmitButton>
          </ActionForm>
          {houseAds.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {houseAds.map((ad) => (
                <li key={ad.id} className={`overflow-hidden rounded-xl border ${ad.enabled ? "" : "opacity-60"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ad.imageUrl} alt={ad.name} className="aspect-[2/1] w-full bg-muted object-cover" loading="lazy" />
                  <div className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ad.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{ad.linkUrl ?? "Không có link"}</p>
                    </div>
                    <ActionForm action={updateHouseAd} inline>
                      <input type="hidden" name="id" value={ad.id} />
                      <input type="hidden" name="enabled" value={ad.enabled ? "0" : "1"} />
                      <SubmitButton variant="ghost" name="op" value="toggle">
                        {ad.enabled ? "Tắt" : "Bật"}
                      </SubmitButton>
                      <SubmitButton variant="ghost" name="op" value="delete" className="text-destructive">
                        Xoá
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Chưa có quảng cáo nào — ảnh quảng cáo của nguồn sẽ bị ẩn khỏi chương.</Empty>
          )}
        </Panel>

        <Panel title="Đánh dấu ảnh quảng cáo từ một chương" description="Dán URL chương truyện tranh trên site, chọn ảnh là quảng cáo của nguồn. Các chương có ảnh giống vậy sẽ được nhận diện tự động.">
          <form className="mb-4 flex flex-wrap gap-2">
            <input name="chuong" defaultValue={chapterUrl} placeholder="https://…/truyen/ten-truyen/chuong-12" className={`${inputClass} min-w-0 flex-1`} />
            <button className="h-9 rounded-lg border px-4 text-sm hover:bg-muted">Xem ảnh</button>
          </form>
          {chapterUrl && <ChapterInspector chapterUrl={chapterUrl} />}
        </Panel>

        <Panel title={`Mẫu ảnh quảng cáo nguồn (${fingerprints.length})`}>
          {fingerprints.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {fingerprints.map((f) => (
                <li key={f.id} className="overflow-hidden rounded-xl border text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proxiedImage(f.sampleUrl)} alt="" className="aspect-[3/4] w-full bg-muted object-cover object-top" loading="lazy" />
                  <div className="space-y-1 p-2">
                    <p className="truncate">{f.label ?? <span className="font-mono text-muted-foreground">{f.hash.slice(0, 12)}…</span>}</p>
                    <ActionForm action={deleteFingerprint}>
                      <input type="hidden" name="id" value={f.id} />
                      <SubmitButton variant="ghost" className="h-7 w-full text-destructive">
                        Xoá mẫu
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Chưa có mẫu nào.</Empty>
          )}
          <ActionForm action={rescanAds} inline className="mt-4 border-t pt-4">
            <span className="text-sm text-muted-foreground">Quét lại chương truyện tranh tải trong</span>
            <input name="days" type="number" min={1} max={365} defaultValue={30} className={`${inputClass} w-20`} />
            <span className="text-sm text-muted-foreground">ngày qua</span>
            <SubmitButton>Quét lại</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}

export default function AdminAdsPage(props: PageProps<"/admin/quang-cao">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Ads searchParams={props.searchParams} />
    </Suspense>
  );
}
