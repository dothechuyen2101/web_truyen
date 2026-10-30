"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { Loader2, MessageCircle, Reply, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteComment, postComment } from "@/lib/actions";
import { useSession } from "@/lib/auth-client";
import type { CommentDto } from "@/lib/comments";
import { formatChapterNumber } from "@/lib/format";
import { TimeAgo } from "./time-ago";
import { UserAvatar } from "./user-avatar";
import { loginHref } from "./user-menu";

type Reply = CommentDto["replies"][number];

function CommentForm({
  onSubmit,
  placeholder,
  autoFocus,
  onCancel,
}: {
  onSubmit: (content: string) => Promise<string | null>;
  placeholder: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const err = await onSubmit(content);
      setError(err);
      if (!err) setContent("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        maxLength={2000}
        rows={3}
        autoFocus={autoFocus}
        className="resize-none rounded-xl bg-background"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>
            Huỷ
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending || content.trim().length < 2} className="rounded-full bg-brand">
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Gửi
        </Button>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  canDelete,
  onDelete,
  onReply,
}: {
  comment: CommentDto | Reply;
  canDelete: boolean;
  onDelete: () => void;
  onReply?: () => void;
}) {
  return (
    <div className="flex animate-in gap-3 duration-300 fade-in slide-in-from-bottom-1">
      <UserAvatar name={comment.user.name} image={comment.user.image} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-sm bg-muted/70 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-semibold">{comment.user.name}</span>
            {comment.user.role === "admin" && (
              <span className="rounded bg-brand px-1.5 text-[10px] font-semibold text-white uppercase">Admin</span>
            )}
            {comment.chapterNumber !== null && (
              <span className="text-xs text-muted-foreground">· Chương {formatChapterNumber(comment.chapterNumber)}</span>
            )}
          </div>
          <p className="mt-1 text-sm break-words whitespace-pre-line">{comment.content}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-2 text-xs text-muted-foreground">
          <TimeAgo date={comment.createdAt} />
          {onReply && (
            <button onClick={onReply} className="flex items-center gap-1 font-medium hover:text-primary">
              <Reply className="size-3.5" /> Trả lời
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} className="flex items-center gap-1 font-medium hover:text-destructive">
              <Trash2 className="size-3.5" /> Xoá
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bình luận của truyện hoặc của một chương (chapterId). Tải ở trình duyệt để trang vẫn được cache. */
export function CommentSection({ storyId, chapterId }: { storyId: number; chapterId?: number }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [comments, setComments] = useState<CommentDto[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useCallback(
    (c?: number | null) => {
      const params = new URLSearchParams();
      if (chapterId) params.set("chapterId", String(chapterId));
      if (c) params.set("cursor", String(c));
      return fetch(`/api/stories/${storyId}/comments?${params}`).then(
        (r) => r.json() as Promise<{ comments: CommentDto[]; nextCursor: number | null }>,
      );
    },
    [storyId, chapterId],
  );

  const reload = useCallback(async () => {
    const data = await query();
    setComments(data.comments);
    setCursor(data.nextCursor);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    query()
      .then((data) => {
        if (cancelled) return;
        setComments(data.comments);
        setCursor(data.nextCursor);
      })
      .catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const data = await query(cursor);
    setComments((prev) => [...(prev ?? []), ...data.comments]);
    setCursor(data.nextCursor);
    setLoadingMore(false);
  }

  async function submit(content: string, parentId?: number) {
    const res = await postComment({ storyId, chapterId, parentId, content });
    if (!res.ok) return res.error;
    // Chỉ đóng form trả lời vừa gửi — không đóng form người dùng mở trong lúc đang gửi bình luận khác.
    if (parentId) setReplyTo((current) => (current === parentId ? null : current));
    await reload();
    return null;
  }

  async function remove(id: number) {
    if (!confirm("Xoá bình luận này?")) return;
    const res = await deleteComment(id);
    if (res.ok) await reload();
  }

  const user = session?.user;
  const canDelete = (c: { user: { id: string } }) => !!user && (user.id === c.user.id || user.role === "admin");

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <MessageCircle className="size-5 text-primary" /> Bình luận
      </h2>
      {user ? (
        <div className="flex gap-3">
          <UserAvatar name={user.name} image={user.image} className="size-9 shrink-0" />
          <div className="flex-1">
            <CommentForm onSubmit={(c) => submit(c)} placeholder="Chia sẻ cảm nghĩ của bạn về truyện…" />
          </div>
        </div>
      ) : (
        <button
          onClick={() => router.push(loginHref())}
          className="w-full rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
        >
          Đăng nhập để bình luận
        </button>
      )}

      <div className="mt-6 space-y-5">
        {comments === null &&
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton size-9 rounded-full" />
              <div className="skeleton h-16 flex-1 rounded-2xl" />
            </div>
          ))}
        {comments?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
        )}
        {comments?.map((c) => (
          <div key={c.id} className="space-y-3">
            <CommentItem
              comment={c}
              canDelete={canDelete(c)}
              onDelete={() => remove(c.id)}
              onReply={() => (user ? setReplyTo(replyTo === c.id ? null : c.id) : router.push(loginHref()))}
            />
            {(c.replies.length > 0 || replyTo === c.id) && (
              <div className="ml-12 space-y-3 border-l-2 border-border pl-4">
                {c.replies.map((r) => (
                  <CommentItem key={r.id} comment={r} canDelete={canDelete(r)} onDelete={() => remove(r.id)} />
                ))}
                {replyTo === c.id && (
                  <CommentForm
                    autoFocus
                    onSubmit={(content) => submit(content, c.id)}
                    onCancel={() => setReplyTo(null)}
                    placeholder={`Trả lời ${c.user.name}…`}
                  />
                )}
              </div>
            )}
          </div>
        ))}
        {cursor && (
          <div className="text-center">
            <Button variant="outline" className="rounded-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore && <Loader2 className="animate-spin" />} Xem thêm bình luận
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
