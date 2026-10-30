# Triển khai

Có 2 cách triển khai. Cả hai dùng chung CSDL **Supabase** và **không cần Redis**:

- **A. Vercel + Supabase + cron-job.org**: miễn phí hoàn toàn, khuyên dùng khi mới bắt đầu.
- **B. VPS + Docker Compose**: tự quản lý, không bị giới hạn hạn mức.

Việc crawl chạy theo **đợt** (hàm `runCrawlTick`). Mỗi đợt quét trang "mới cập nhật" của các nguồn, đồng bộ truyện mới hoặc có chương mới, chạy tiếp backfill nếu đang bật, rồi nhận diện ảnh quảng cáo. Trên Vercel, đợt crawl được gọi qua `/api/cron/crawl`; trên VPS, worker gọi nó theo vòng lặp.

## Chuẩn bị Supabase (cả 2 cách)

1. Tạo project. Nếu người đọc chủ yếu ở Việt Nam, chọn vùng gần (Singapore, Seoul).
2. Vào **Project Settings → Database → Connection pooling** và lấy 2 chuỗi kết nối:
   - Cổng **6543** (chế độ transaction) cho ứng dụng, đặt vào `DATABASE_URL`.
   - Cổng **5432** (chế độ session) cho migrate, đặt vào `DIRECT_URL`.

   Kết nối trực tiếp `db.<ref>.supabase.co` chỉ có IPv6, nhiều máy không dùng được, nên hãy dùng pooler. Mật khẩu có ký tự đặc biệt phải mã hoá URL, vd `@` → `%40`. Thêm `?sslmode=require&uselibpqcompat=true` vào cuối mỗi chuỗi.
3. Trên máy của bạn, điền 2 biến trên vào `.env` rồi tạo bảng và nạp danh sách nguồn:

   ```bash
   pnpm install
   pnpm db:deploy     # tạo bảng + bật Row Level Security
   pnpm db:seed       # thêm 4 nguồn crawl
   ```

---

## A. Vercel (miễn phí)

### 1. Tạo project

1. Đẩy code lên GitHub, rồi trên Vercel chọn **Add New → Project** và import repo.
2. Vercel tự nhận ra 2 thành phần (web Next.js và container từ `Dockerfile`). Chọn **Import single project** ở dòng **web (Next.js)**, không dùng preset *Services*.
3. Kiểm tra lại các thiết lập:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Next.js. Giữ nguyên lệnh build/install mặc định.
4. Mở mục **Environment Variables** và thêm các biến sau:

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | Pooler Supabase, cổng 6543 |
| `DIRECT_URL` | Pooler Supabase, cổng 5432 |
| `IMAGE_PROXY_SECRET` | Chuỗi ngẫu nhiên, tạo bằng `openssl rand -base64 32`. Không đổi sau khi đã chạy. |
| `BETTER_AUTH_SECRET` | Chuỗi ngẫu nhiên. Đổi giá trị này sẽ đăng xuất mọi người. |
| `CRON_SECRET` | Chuỗi ngẫu nhiên, dùng để bảo vệ endpoint cron |
| `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL` | `https://<tên-project>.vercel.app`, hoặc tên miền riêng. Để trống (hoặc lỡ để localhost) thì tự dùng tên miền production của Vercel. |
| `NEXT_PUBLIC_SITE_NAME` | Tên site, vd `Kho Truyện` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`. Để Vercel dùng đúng pnpm 12 ghi trong `package.json`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Tuỳ chọn |
| `GOOGLE_SITE_VERIFICATION` | Tuỳ chọn: mã xác minh Google Search Console (phương thức "Thẻ HTML") |

5. Bấm **Deploy**. Lúc build, Next.js đọc CSDL để prerender trang chủ và sitemap, nên phải chạy `pnpm db:deploy` (phần Chuẩn bị Supabase) trước.
6. Vào **Quản trị → Nguồn crawl**, tắt **NetTruyen** và **TruyenQQ**: hai nguồn này chặn IP máy chủ Vercel (403), truyện tranh sẽ lấy từ MangaDex.

Nếu sau này đổi tên miền, nhớ sửa `NEXT_PUBLIC_SITE_URL` và `BETTER_AUTH_URL` rồi **Redeploy**. Các biến `NEXT_PUBLIC_*` được nhúng vào lúc build, nên đổi xong phải build lại mới có hiệu lực.

### 2. Lịch crawl

- **Vercel Cron**: `apps/web/vercel.json` đã cấu hình chạy 1 lần mỗi ngày lúc 3 giờ sáng giờ Việt Nam (gói Hobby chỉ cho tối đa 1 lần/ngày). Vercel tự gửi kèm `CRON_SECRET`.
- **cron-job.org** (miễn phí) để chạy dày hơn. Tạo một cronjob như sau:
  - URL: `https://<tên-miền>/api/cron/crawl?secret=<CRON_SECRET>`
  - Phương thức GET, chạy **30 phút một lần**.

  Endpoint trả lời ngay (202) rồi chạy nền, nên cron-job.org không phải chờ.

Mỗi đợt mặc định chạy 120 giây (biến `CRAWL_TICK_SECONDS`). Kết quả từng đợt xem ở **Quản trị → Tổng quan → Đợt crawl gần nhất**.

### 3. Tài khoản quản trị

Đăng ký trên site, rồi trên máy của bạn (`.env` trỏ vào Supabase) chạy:

```bash
pnpm make-admin you@example.com
```

### 4. Hạn mức gói Hobby và lưu ý

- Mỗi tháng: **4 giờ CPU, 360 GB-giờ RAM, 1 triệu lượt gọi function, khoảng 100 GB băng thông**. Vượt hạn mức thì tính năng đó bị khoá 30 ngày.
  Với 30 phút một đợt × 120 giây, việc crawl dùng khoảng 1/4 hạn mức RAM.
- **Proxy ảnh truyện tranh** (`/api/img`) tốn hạn mức nhất. Vercel CDN cache ảnh 1 năm (header `s-maxage`). Khi lượng đọc lớn, chuyển proxy ảnh sang Cloudflare Worker hoặc lên gói Pro.
- Function chạy ở **Seoul (`icn1`)**, cạnh Supabase, cấu hình trong `vercel.json`. Đổi vùng Supabase thì đổi vùng ở đây cho khớp.
- **Gói Hobby chỉ dành cho mục đích phi thương mại.** Điều kiện dùng API MangaDex cũng cấm mọi quảng cáo/dịch vụ thu phí trên site (nhận donate thì được), vì vậy tính năng quảng cáo của site đang tắt.
- Vercel có thể gỡ nội dung hoặc khoá tài khoản khi nhận khiếu nại bản quyền. Hãy xử lý **Quản trị → Yêu cầu gỡ** kịp thời.

---

## B. VPS + Docker Compose

- VPS Linux, tối thiểu **2 vCPU / 4 GB RAM**, cài Docker kèm plugin Compose.
- Tốt nhất đặt VPS cùng vùng với Supabase.

```bash
git clone <repo> /srv/web_truyen && cd /srv/web_truyen
cp .env.production.example .env && chmod 600 .env       # điền giá trị thật

docker compose -f docker-compose.prod.yml build worker
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:deploy
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:seed
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml --profile caddy up -d   # Caddy tự lấy HTTPS cho SITE_DOMAIN
```

Tạo admin:

```bash
docker compose -f docker-compose.prod.yml run --rm worker pnpm make-admin you@example.com
```

- **Worker** chạy đợt crawl mỗi 15 phút (biến `CRAWL_INTERVAL_MINUTES`).
- **Tự chạy Postgres thay cho Supabase:** dùng phần "Postgres chạy trên VPS" trong `.env.production.example` và thêm `--profile local-db` vào mọi lệnh.
- **Cloudflare đứng trước VPS:**
  - Bật proxy, đặt SSL **Full (strict)**.
  - Cache rule cho `/api/img*` (tôn trọng header của server).
  - Rate limit cho `/api/auth/*` và `/api/img*`.

Cập nhật phiên bản:

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:deploy
docker compose -f docker-compose.prod.yml --profile caddy up -d
```

---

## Sao lưu

Gói miễn phí của Supabase không có sao lưu tự động. Script dưới đây chạy `pg_dump` qua `DIRECT_URL` (cần Docker), lưu 7 ngày gần nhất:

```bash
./scripts/backup-db.sh                      # tạo backups/truyen-<thời gian>.sql.gz
# cron trên máy luôn bật, 3 giờ sáng mỗi ngày:
# 0 3 * * * cd /srv/web_truyen && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

Khôi phục (bỏ tham số `uselibpqcompat` khỏi URL, vì `psql` không hiểu tham số này):

```bash
gunzip -c backups/truyen-XXXX.sql.gz | docker run -i --rm postgres:17-alpine psql "postgresql://postgres.<ref>:<mật-khẩu>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
```

## Theo dõi

- `/api/health` trả 200 khi CSDL phản hồi. Có thể gắn vào UptimeRobot hoặc Better Stack.
- **Quản trị → Tổng quan**: đợt crawl gần nhất, số job lỗi trong 24 giờ, tình trạng từng nguồn.
- Log: trên Vercel xem ở **Logs**; trên VPS dùng `docker compose -f docker-compose.prod.yml logs -f worker web`.

## Sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Nguồn đổi tên miền, crawl lỗi hàng loạt | **Quản trị → Nguồn crawl**, sửa Domain rồi Lưu. |
| Nguồn trả 403 cho một số truyện (Cloudflare challenge) | Truyện đó tự vào danh sách bỏ qua 7 ngày. Không vượt chặn; nguồn dự phòng có truyện đó thì sẽ được dùng. |
| Nguồn trả 429/503 | HTTP client tự tạm dừng host đó. Nếu kéo dài, tăng "Giãn cách (ms)" của nguồn. |
| "Đợt crawl gần nhất" không đổi | Kiểm tra cronjob trên cron-job.org (URL, `secret`) và `CRON_SECRET` trên Vercel. Gọi thử URL bằng trình duyệt: phải trả `{"ok":true,"started":true}`. |
| Build trên Vercel lỗi kết nối CSDL | Kiểm tra `DATABASE_URL` trên Vercel và đã chạy `pnpm db:deploy` chưa. |
| Build trên Vercel lỗi do pnpm | Kiểm tra đã đặt `ENABLE_EXPERIMENTAL_COREPACK=1`. |
| Không biết nguồn có chặn server không | Gọi `/api/cron/probe?secret=<CRON_SECRET>&url=https://…` (nhiều `url` được): trả mã HTTP, header `server`/`cf-mitigated` và tiêu đề trang khi truy cập từ chính server. "Just a moment…" hay "Access denied" nghĩa là nguồn chặn. |
| `ENOTFOUND db.<ref>.supabase.co` | Máy không có IPv6. Dùng địa chỉ pooler. |
| `tenant/user … not found` | Sai cụm pooler (`aws-0` hay `aws-1`) hoặc sai vùng. Copy đúng chuỗi trong trang Connection pooling. |
| Mạng có proxy/antivirus giải mã TLS (`certificate not trusted`) | Build Docker: `docker build --secret id=extra_ca,src=ca.pem …`. |

## Bảo mật

- Xoá các tài khoản thử nghiệm và đặt mật khẩu mạnh cho admin.
- Không commit `.env`.
- Các bảng trong `public` đều bật **Row Level Security** và không có policy nào, nên REST API của Supabase không đọc được dữ liệu. Ứng dụng kết nối bằng chủ sở hữu bảng nên không bị chặn.
  Khi thêm bảng mới, nhớ thêm `ALTER TABLE … ENABLE ROW LEVEL SECURITY` vào migration. Thỉnh thoảng nên mở **Security Advisor** của Supabase để kiểm tra.
- `CRON_SECRET` phải đủ dài và ngẫu nhiên, vì endpoint cron có thể bị gọi từ bên ngoài.
