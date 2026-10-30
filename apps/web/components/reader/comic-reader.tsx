"use client";

import type { SyntheticEvent } from "react";
import type { HouseAd } from "@/lib/data";

function markLoaded(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.dataset.loaded = "";
}

/** Ảnh lỗi (thường do nguồn chập chờn) được tải lại một lần trước khi bỏ cuộc. */
function retryOnce(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.retried === undefined) {
    img.dataset.retried = "";
    img.src = `${img.src}&retry=1`;
  } else {
    markLoaded(e);
  }
}

function HouseAdBanner({ ad }: { ad: HouseAd }) {
  // eslint-disable-next-line @next/next/no-img-element
  const image = <img src={ad.imageUrl} alt={ad.name} loading="lazy" className="block w-full" />;
  return (
    <div className="relative my-1">
      {ad.linkUrl ? (
        <a href={ad.linkUrl} target="_blank" rel="sponsored noopener">
          {image}
        </a>
      ) : (
        image
      )}
      <span className="absolute top-1 right-1 rounded bg-black/50 px-1.5 text-[10px] text-white">Quảng cáo</span>
    </div>
  );
}

/**
 * Trang truyện tranh cuộn dọc. Ảnh chưa tải giữ chỗ cao để lazy-load không tải dồn mọi ảnh cùng lúc.
 * Ảnh quảng cáo của nguồn (adIndexes) được thay bằng quảng cáo của site, hoặc ẩn nếu site không có quảng cáo.
 */
export function ComicReader({
  urls,
  title,
  adIndexes = [],
  houseAds = [],
  seed = 0,
}: {
  urls: string[];
  title: string;
  adIndexes?: number[];
  houseAds?: HouseAd[];
  /** Dùng để xoay vòng quảng cáo ổn định giữa server và trình duyệt */
  seed?: number;
}) {
  const ads = new Set(adIndexes);
  let adCount = 0;
  return (
    <div className="-mx-4 flex flex-col sm:mx-0">
      {urls.map((src, i) => {
        if (ads.has(i)) {
          if (!houseAds.length) return null;
          const ad = houseAds[(seed + adCount++) % houseAds.length]!;
          return <HouseAdBanner key={`ad-${i}`} ad={ad} />;
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={`${title} - trang ${i + 1}`}
            loading={i < 3 ? "eager" : "lazy"}
            decoding="async"
            className="block min-h-[60vh] w-full bg-muted data-loaded:min-h-0 data-loaded:bg-transparent"
            onLoad={markLoaded}
            onError={retryOnce}
          />
        );
      })}
    </div>
  );
}
