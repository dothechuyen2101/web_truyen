"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Heart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rateStory, toggleFollow } from "@/lib/actions";
import { useSession } from "@/lib/auth-client";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { loginHref } from "./user-menu";

interface Props {
  storyId: number;
  followCount: number;
  rating: number | null;
  ratingCount: number;
}

/** Nút theo dõi + chấm sao. Trạng thái riêng của người dùng tải ở trình duyệt vì trang truyện được cache. */
export function StoryInteractions({ storyId, followCount, rating, ratingCount }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [following, setFollowing] = useState(false);
  const [follows, setFollows] = useState(followCount);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [avg, setAvg] = useState(rating);
  const [count, setCount] = useState(ratingCount);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** userId mà trạng thái theo dõi/chấm điểm đã được tải xong */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const userId = session?.user.id;
  // Đã đăng nhập nhưng chưa biết trạng thái thật → khoá nút để không bấm nhầm thành bỏ theo dõi.
  const stateLoading = !!userId && loadedFor !== userId;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch(`/api/me/stories/${storyId}`)
      .then((r) => r.json())
      .then((d: { following: boolean; rating: number | null }) => {
        if (cancelled) return;
        setFollowing(d.following);
        setMyRating(d.rating);
        setLoadedFor(userId);
      })
      .catch(() => !cancelled && setLoadedFor(userId));
    return () => {
      cancelled = true;
    };
  }, [storyId, userId]);

  const requireLogin = () => {
    if (userId) return false;
    router.push(loginHref());
    return true;
  };

  function onFollow() {
    if (requireLogin()) return;
    // Cập nhật lạc quan, hoàn tác nếu server báo lỗi.
    const next = !following;
    setFollowing(next);
    setFollows((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const res = await toggleFollow(storyId);
      if (!res.ok) {
        setFollowing(!next);
        setFollows((n) => n + (next ? -1 : 1));
        setMessage(res.error);
      }
    });
  }

  function onRate(score: number) {
    if (requireLogin()) return;
    const previous = myRating;
    setMyRating(score);
    startTransition(async () => {
      const res = await rateStory(storyId, score);
      if (res.ok) {
        setAvg(res.rating);
        setCount(res.count);
        setMessage("Cảm ơn bạn đã đánh giá!");
      } else {
        setMyRating(previous);
        setMessage(res.error);
      }
    });
  }

  const shown = hover ?? myRating ?? Math.round(avg ?? 0);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <Button
        variant="outline"
        size="lg"
        onClick={onFollow}
        disabled={pending || stateLoading}
        aria-pressed={following}
        className={cn(
          "rounded-full bg-background/60 backdrop-blur transition-all",
          following && "border-rose-500/40 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400",
        )}
      >
        <Heart className={cn("transition-transform", following && "scale-110 fill-current")} />
        {following ? "Đang theo dõi" : "Theo dõi"}
        <span className="text-muted-foreground tabular-nums">· {formatNumber(follows)}</span>
      </Button>

      <div className="flex items-center gap-2">
        <div className="flex" onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="Chấm điểm truyện">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={myRating === s}
              aria-label={`${s} sao`}
              disabled={pending || stateLoading}
              onMouseEnter={() => setHover(s)}
              onClick={() => onRate(s)}
              className="p-0.5 transition-transform hover:scale-125"
            >
              <Star
                className={cn(
                  "size-5 transition-colors",
                  s <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {avg !== null && count > 0 ? (
            <>
              <span className="font-semibold text-foreground">{avg.toFixed(1)}</span> ({formatNumber(count)} đánh giá)
            </>
          ) : (
            "Chưa có đánh giá"
          )}
        </span>
      </div>
      {message && (
        <p className="w-full animate-in text-sm text-muted-foreground fade-in" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
