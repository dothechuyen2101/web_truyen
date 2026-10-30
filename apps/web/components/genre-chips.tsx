import Link from "next/link";
import { Tags } from "lucide-react";

export function GenreChips({ genres }: { genres: { name: string; slug: string }[] }) {
  if (!genres.length) return null;
  return (
    <div className="relative">
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/the-loai"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          <Tags className="size-4" /> Thể loại
        </Link>
        {genres.map((g) => (
          <Link
            key={g.slug}
            href={`/the-loai/${g.slug}`}
            className="shrink-0 rounded-full border bg-card px-3.5 py-1.5 text-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary hover:shadow-sm"
          >
            {g.name}
          </Link>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
