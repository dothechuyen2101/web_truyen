import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@truyen/db";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AdminHeader, AdminSkeleton, Badge, Empty } from "@/components/admin/ui";
import { Pagination } from "@/components/pagination";
import { TimeAgo } from "@/components/time-ago";
import { UserAvatar } from "@/components/user-avatar";
import { requireAdmin } from "@/lib/admin";
import { chapterHref, formatChapterNumber } from "@/lib/format";
import { setCommentHidden, setUserBanned } from "../actions";

const PAGE_SIZE = 30;

async function Comments({ searchParams }: Pick<PageProps<"/admin/binh-luan">, "searchParams">) {
  await requireAdmin("/admin/binh-luan");
  const sp = await searchParams;
  const hiddenOnly = sp.hidden === "1";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = hiddenOnly ? { hidden: true } : {};

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, image: true, email: true, banned: true } },
        story: { select: { slug: true, title: true } },
        chapter: { select: { number: true } },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  return (
    <>
      <AdminHeader
        title="Bình luận"
        description="Ẩn bình luận vi phạm hoặc khoá tài khoản spam."
        actions={
          <div className="flex gap-1 rounded-full border p-1 text-sm">
            <Link href="/admin/binh-luan" className={`rounded-full px-3 py-1 ${!hiddenOnly ? "bg-brand text-white" : ""}`}>
              Tất cả
            </Link>
            <Link href="/admin/binh-luan?hidden=1" className={`rounded-full px-3 py-1 ${hiddenOnly ? "bg-brand text-white" : ""}`}>
              Đã ẩn
            </Link>
          </div>
        }
      />
      {comments.length ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className={`flex gap-3 rounded-2xl border bg-card p-4 ${c.hidden ? "opacity-60" : ""}`}>
              <UserAvatar name={c.user.name} image={c.user.image} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold">{c.user.name}</span>
                  <span className="text-xs text-muted-foreground">{c.user.email}</span>
                  {c.user.banned && <Badge color="red">Đã khoá</Badge>}
                  {c.hidden && <Badge color="amber">Đã ẩn</Badge>}
                  <span className="text-xs text-muted-foreground">
                    · <TimeAgo date={c.createdAt} /> ·{" "}
                    <Link
                      href={c.chapter ? chapterHref(c.story.slug, c.chapter.number) : `/truyen/${c.story.slug}`}
                      className="text-primary hover:underline"
                      target="_blank"
                    >
                      {c.story.title}
                      {c.chapter && ` – Chương ${formatChapterNumber(c.chapter.number)}`}
                    </Link>
                  </span>
                </div>
                <p className="mt-1.5 text-sm break-words whitespace-pre-line">{c.content}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionForm action={setCommentHidden} inline>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="hidden" value={c.hidden ? "0" : "1"} />
                    <SubmitButton variant="ghost">{c.hidden ? "Hiện lại" : "Ẩn"}</SubmitButton>
                  </ActionForm>
                  {!c.user.banned && (
                    <ActionForm action={setUserBanned} inline confirm={`Khoá tài khoản ${c.user.name}?`}>
                      <input type="hidden" name="userId" value={c.user.id} />
                      <input type="hidden" name="banned" value="1" />
                      <input type="hidden" name="reason" value="Bình luận vi phạm" />
                      <SubmitButton variant="ghost" className="text-destructive">
                        Khoá người dùng
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Không có bình luận nào.</Empty>
      )}
      <Pagination
        page={page}
        pageCount={Math.ceil(total / PAGE_SIZE)}
        href={(p) => `/admin/binh-luan?${new URLSearchParams({ ...(hiddenOnly && { hidden: "1" }), ...(p > 1 && { page: String(p) }) })}`}
      />
    </>
  );
}

export default function AdminCommentsPage(props: PageProps<"/admin/binh-luan">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Comments searchParams={props.searchParams} />
    </Suspense>
  );
}
