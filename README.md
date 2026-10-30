# Kho Truyện

Web đọc truyện chữ và truyện tranh. Nội dung được lấy từ nhiều nguồn: truyenfull và wetruyen (truyện chữ), MangaDex (truyện tranh, qua API chính thức), ManhuaVN (manhua), nettruyen và TruyenQQ (truyện tranh). Triển khai production: xem [DEPLOY.md](DEPLOY.md).

> nettruyen và TruyenQQ chặn IP máy chủ (Cloudflare trả 403 cho Vercel), nên khi chạy trên Vercel hai nguồn này được tắt và truyện tranh lấy từ MangaDex. Không vượt chặn.

## Cấu trúc

```
apps/web        Next.js 16 (App Router, Cache Components): giao diện, API, proxy ảnh, trang quản trị /admin
apps/worker     Vòng lặp chạy đợt crawl định kỳ, dùng khi triển khai trên VPS (trên Vercel thay bằng cron)
packages/db       Prisma schema + client (PostgreSQL trên Supabase)
packages/crawler  Adapter từng nguồn, HTTP client có giới hạn tốc độ, logic đồng bộ DB, đợt crawl (tick)
packages/shared   Hàm dùng chung (bỏ dấu, slug, …)
```

## Chạy local

Yêu cầu: Node 22+, pnpm (`corepack enable pnpm`), một project Supabase. Không cần Redis.

```bash
cp .env.example .env    # điền DATABASE_URL, DIRECT_URL (pooler Supabase), các secret
pnpm install
pnpm db:deploy          # tạo bảng trên Supabase
pnpm db:seed            # thêm các nguồn crawl
pnpm dev                # web (http://localhost:3000) + worker
```

Muốn dùng Postgres cục bộ thay Supabase: `pnpm db:up` (cần Docker) rồi trỏ `DATABASE_URL` vào đó.

Khi sửa `schema.prisma`, tạo migration mới bằng `pnpm db:migrate`. Lệnh này cần CSDL cho phép tạo shadow database; nếu Supabase từ chối, chạy nó trên Postgres cục bộ rồi `pnpm db:deploy` lên Supabase. Bảng mới phải bật RLS (xem DEPLOY.md, mục Bảo mật).

Worker chạy một đợt crawl 15 phút một lần (đợt đầu chạy ngay khi khởi động). Chạy một đợt bằng tay: `pnpm crawl tick --budget 120`.

## Tài khoản

- Đăng nhập dùng [Better Auth](https://better-auth.com): email/mật khẩu, thêm Google nếu điền `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`. Session và bộ đếm giới hạn tần suất lưu trong CSDL.
- Cấp quyền admin cho một tài khoản đã đăng ký: `pnpm make-admin <email>`.

## Crawl thủ công

```bash
pnpm crawl story https://truyenfull.live/<slug>/            # đồng bộ một truyện
pnpm crawl story https://nettruyen.gg/truyen-tranh/<slug>
pnpm crawl chapter <url chương>                             # lấy nội dung một chương
pnpm crawl latest nettruyen --pages 2 --sync                # quét trang mới cập nhật
pnpm crawl tick --budget 120                                # chạy một đợt crawl đầy đủ
pnpm crawl preview <url>                                    # chỉ parse, không ghi DB
```

## Cách hoạt động

- **Thông tin truyện và danh sách chương** được crawl theo từng đợt có giới hạn thời gian (`runCrawlTick`). Trên Vercel, đợt crawl được gọi qua `/api/cron/crawl` (Vercel Cron + cron-job.org); trên VPS, worker gọi nó theo vòng lặp. Khoá trong bảng `CrawlLock` bảo đảm mỗi lúc chỉ có một đợt chạy.
- **Nội dung chương** chỉ lấy khi có người đọc lần đầu, rồi lưu lại. Sau khi trả trang, server tải trước 2 chương kế tiếp và đồng bộ lại truyện nếu đã cũ hơn 6 giờ.
- **Ảnh** đi qua `/api/img`. URL ảnh có chữ ký HMAC và host phải nằm trong whitelist. Proxy gắn `Referer` của nguồn để vượt chặn hotlink, và trả `Cache-Control: immutable` để CDN cache lại.
- **Một truyện có thể có nhiều nguồn** (`StorySource`). Khi nguồn ưu tiên lỗi, hệ thống tự chuyển sang nguồn khác.
- **Truyện bị nguồn chặn** (403, ví dụ Cloudflare challenge) hoặc đã bị xoá (404) được bỏ qua trong 7 ngày, không thử lại. Nguồn trả 429/503 thì HTTP client tạm dừng cả host đó.
- **Truyện trùng giữa các nguồn** được ghép tự động theo tiêu đề. Admin có thể gộp hoặc tách thủ công ở trang chi tiết truyện.
- **Ảnh quảng cáo nguồn chèn vào chương truyện tranh** được nhận diện bằng dHash, so với các mẫu admin đã đánh dấu, rồi ẩn đi. Tính năng thay bằng quảng cáo của site đang tắt (`HOUSE_ADS_ENABLED` trong `apps/web/lib/site.ts`).
- **MangaDex**: điều kiện dùng API là ghi công MangaDex và nhóm dịch (hiện ở trình đọc, trang truyện, footer), gỡ truyện khi nhóm dịch yêu cầu, và **không chạy quảng cáo/dịch vụ thu phí** trên site. Ảnh lấy từ máy chủ gốc `uploads.mangadex.org` (chất lượng data-saver) qua proxy, User-Agent thật, giãn cách 250ms (giới hạn ~5 request/giây). Chỉ lấy truyện loại an toàn/gợi cảm. Backfill (Quản trị → Nguồn crawl) duyệt toàn bộ kho tiếng Việt, manhua/manhwa trước.
- **ManhuaVN** (manhuavn2.com): phần lớn chương mới chỉ có trên app của nguồn, web thường chỉ mở vài chương đầu. Adapter dò ranh giới chương mở (vài request mỗi truyện) và chỉ đưa lên chương đọc được; chương khoá vẫn tính vào số chương mới nhất (`ChapterRef.unavailable`) để không đồng bộ lại liên tục. Không đọc `/ajax/`, `/api/` (robots.txt cấm).

## Người đọc

- **Thông báo chương mới** (Web Push): người đăng nhập bật ở Tủ truyện hoặc ngay dưới nút Theo dõi. Mỗi đợt crawl gửi thông báo cho người theo dõi các truyện có chương mới (`packages/crawler/src/notify.ts`). Cần khoá VAPID; iPhone phải "Thêm vào Màn hình chính" trước.
- **PWA**: `app/manifest.ts` + `public/sw.js` (service worker chỉ xử lý thông báo, không cache nội dung).
- **SEO**: `/sitemap-index.xml` gồm sitemap trang truyện và từng chương; tiêu đề/mô tả theo cách người đọc tìm ("tên truyện chap N"), breadcrumb và JSON-LD (`lib/seo.tsx`).

## Thêm nguồn mới

1. Tạo adapter trong `packages/crawler/src/adapters/` theo interface `SourceAdapter`. Tách hàm parse thuần để test được.
2. Lưu HTML mẫu vào `packages/crawler/test/fixtures/<nguồn>/` và viết test.
3. Đăng ký adapter trong `packages/crawler/src/adapters/index.ts`.
4. Thêm bản ghi `Source` (qua seed hoặc admin).

## Kiểm tra

```bash
pnpm test        # test parser trên HTML mẫu
pnpm typecheck
pnpm lint
```
