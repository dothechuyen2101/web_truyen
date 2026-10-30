# Kho Truyện

Web đọc truyện chữ và truyện tranh. Nội dung được crawl từ nhiều nguồn: truyenfull và wetruyen (truyện chữ), nettruyen và TruyenQQ (truyện tranh). Triển khai production: xem [DEPLOY.md](DEPLOY.md).

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
- **Ảnh quảng cáo nguồn chèn vào chương truyện tranh** được nhận diện bằng dHash, so với các mẫu admin đã đánh dấu, rồi thay bằng quảng cáo của site (Quản trị → Quảng cáo).

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
