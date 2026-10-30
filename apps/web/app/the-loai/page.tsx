import type { Metadata } from "next";
import Link from "next/link";
import { Hash } from "lucide-react";
import { PageTransition } from "@/components/motion";
import { PageTitle } from "@/components/section";
import { getGenres } from "@/lib/data";

export const metadata: Metadata = {
  title: "Thể loại truyện",
  alternates: { canonical: "/the-loai" },
};

export default async function GenresPage() {
  const genres = await getGenres();
  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageTitle title="Thể loại" description="Chọn thể loại bạn thích để khám phá truyện mới." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {genres.map((g) => (
            <Link
              key={g.slug}
              href={`/the-loai/${g.slug}`}
              className="group reveal-on-scroll flex items-center gap-2.5 rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-primary transition-colors group-hover:bg-brand group-hover:text-white">
                <Hash className="size-3.5" />
              </span>
              <span className="truncate transition-colors group-hover:text-primary">{g.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
