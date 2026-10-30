import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { prisma } from "@truyen/db";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AdminHeader, AdminSkeleton, Badge, Panel, Table, inputClass, td } from "@/components/admin/ui";
import { TimeAgo } from "@/components/time-ago";
import { requireAdmin } from "@/lib/admin";
import { formatNumber, STATUS_LABEL, TYPE_LABEL } from "@/lib/format";
import { deleteStory, mergeIntoStory, resyncStory, setStoryHidden, splitStorySource } from "../../actions";

async function StoryAdmin({ params }: Pick<PageProps<"/admin/truyen/[id]">, "params">) {
  const { id: rawId } = await params;
  await requireAdmin(`/admin/truyen/${rawId}`);
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const story = await prisma.story.findUnique({
    where: { id },
    include: {
      author: true,
      sources: { include: { source: true }, orderBy: { priority: "desc" } },
      _count: { select: { follows: true, comments: true, chapters: true } },
    },
  });
  if (!story) notFound();
  const contents = await prisma.chapterContent.count({ where: { chapter: { storyId: id } } });

  return (
    <>
      <AdminHeader
        title={story.title}
        description={`#${story.id} · ${TYPE_LABEL[story.type]} · ${STATUS_LABEL[story.status]}`}
        actions={
          <Link href={`/truyen/${story.slug}`} target="_blank" className="flex items-center gap-1 text-sm text-primary hover:underline">
            Xem trên site <ExternalLink className="size-3.5" />
          </Link>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {story.hidden ? <Badge color="amber">Đang ẩn</Badge> : <Badge color="green">Hiển thị</Badge>}
        <Badge>{formatNumber(story._count.chapters)} chương</Badge>
        <Badge>{formatNumber(contents)} chương đã có nội dung</Badge>
        <Badge>{formatNumber(story.viewCount)} lượt xem</Badge>
        <Badge>{formatNumber(story._count.follows)} theo dõi</Badge>
        <Badge>{formatNumber(story._count.comments)} bình luận</Badge>
        {story.author && <Badge>Tác giả: {story.author.name}</Badge>}
      </div>

      <h2 className="mb-3 font-semibold">Nguồn ({story.sources.length})</h2>
      <Table head={["Nguồn", "Đường dẫn", "Chương", "Đồng bộ", "Lỗi", ""]}>
        {story.sources.map((l) => (
          <tr key={l.id}>
            <td className={td}>{l.source.name}</td>
            <td className={`${td} max-w-xs`}>
              <a
                href={new URL(l.path, l.source.baseUrl).toString()}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 truncate text-primary hover:underline"
              >
                {l.path} <ExternalLink className="size-3 shrink-0" />
              </a>
            </td>
            <td className={`${td} tabular-nums`}>{formatNumber(l.chapterCount)}</td>
            <td className={td}>{l.lastSyncedAt ? <TimeAgo date={l.lastSyncedAt} /> : "—"}</td>
            <td className={`${td} max-w-[14rem] truncate text-destructive`}>{l.lastError ?? ""}</td>
            <td className={td}>
              {story.sources.length > 1 && (
                <ActionForm action={splitStorySource} inline confirm="Tách nguồn này thành truyện riêng?">
                  <input type="hidden" name="id" value={story.id} />
                  <input type="hidden" name="storySourceId" value={l.id} />
                  <SubmitButton variant="ghost">Tách</SubmitButton>
                </ActionForm>
              )}
            </td>
          </tr>
        ))}
      </Table>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Thao tác">
          <div className="flex flex-wrap gap-3">
            <ActionForm action={setStoryHidden} inline>
              <input type="hidden" name="id" value={story.id} />
              <input type="hidden" name="hidden" value={story.hidden ? "0" : "1"} />
              <SubmitButton>{story.hidden ? "Hiện truyện" : "Ẩn truyện"}</SubmitButton>
            </ActionForm>
            <ActionForm action={resyncStory} inline>
              <input type="hidden" name="id" value={story.id} />
              <SubmitButton>Đồng bộ lại từ nguồn</SubmitButton>
            </ActionForm>
          </div>
        </Panel>
        <Panel title="Gộp truyện trùng" description="Chuyển nguồn, chương, theo dõi, bình luận của truyện khác vào truyện này rồi xoá truyện kia.">
          <ActionForm action={mergeIntoStory} inline confirm="Gộp truyện kia vào truyện này? Không thể hoàn tác.">
            <input type="hidden" name="id" value={story.id} />
            <input name="from" required placeholder="ID, slug hoặc URL truyện cần gộp" className={`${inputClass} w-72`} />
            <SubmitButton variant="default">Gộp vào đây</SubmitButton>
          </ActionForm>
        </Panel>
      </div>

      <Panel title="Vùng nguy hiểm" className="mt-6 border-destructive/30">
        <ActionForm action={deleteStory} inline confirm={`Xoá vĩnh viễn “${story.title}” cùng toàn bộ chương và bình luận?`}>
          <input type="hidden" name="id" value={story.id} />
          <SubmitButton variant="destructive">Xoá truyện</SubmitButton>
          <span className="text-xs text-muted-foreground">Truyện có thể được crawl lại nếu nguồn còn — dùng “Ẩn” để gỡ hẳn.</span>
        </ActionForm>
      </Panel>
    </>
  );
}

export default function AdminStoryPage(props: PageProps<"/admin/truyen/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <StoryAdmin params={props.params} />
    </Suspense>
  );
}
