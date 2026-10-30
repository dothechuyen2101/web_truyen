# Triển khai lên VPS

Hướng dẫn chạy Kho Truyện trên một VPS bằng Docker Compose, đặt Cloudflare phía trước làm CDN.

## 1. Chuẩn bị

- VPS Linux (Ubuntu 24.04 hoặc tương đương), tối thiểu **2 vCPU / 4 GB RAM / 40 GB SSD**.
- Docker Engine kèm plugin Compose (`docker compose version`).
- Một tên miền, DNS trỏ về IP của VPS.
- Tường lửa chỉ mở cổng 22, 80, 443.

## 2. Cấu hình

```bash
git clone <repo> /srv/web_truyen && cd /srv/web_truyen
cp .env.production.example .env
chmod 600 .env
```

Mở `.env` và điền:

| Biến | Ghi chú |
|---|---|
| `POSTGRES_PASSWORD` | Mật khẩu dài ngẫu nhiên. Nhớ đổi cả trong `DATABASE_URL` và `BUILD_DATABASE_URL`. |
| `IMAGE_PROXY_SECRET`, `BETTER_AUTH_SECRET` | Tạo bằng `openssl rand -base64 32`. Không đổi sau khi đã chạy: đổi `IMAGE_PROXY_SECRET` làm hỏng link ảnh đã cache, đổi `BETTER_AUTH_SECRET` đăng xuất mọi người. |
| `SITE_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL` | Tên miền của bạn, dùng `https://` cho 2 biến URL. |
| `GOOGLE_CLIENT_ID/SECRET` | Tuỳ chọn. Redirect URI là `https://<domain>/api/auth/callback/google`. |

## 3. Khởi chạy lần đầu

```bash
# Postgres phải chạy trước: lúc build, Next.js cần đọc dữ liệu để prerender trang chủ và sitemap
docker compose -f docker-compose.prod.yml up -d postgres redis

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:deploy   # tạo bảng
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:seed     # thêm các nguồn crawl

# --profile caddy: Caddy tự lấy chứng chỉ HTTPS cho SITE_DOMAIN
docker compose -f docker-compose.prod.yml --profile caddy up -d
```

Tạo tài khoản quản trị: đăng ký trên site rồi chạy

```bash
docker compose -f docker-compose.prod.yml run --rm worker pnpm make-admin you@example.com
```

Worker bắt đầu quét các nguồn ngay khi khởi động. Muốn nạp toàn bộ kho truyện của một nguồn, vào **Quản trị → Nguồn crawl → Backfill toàn bộ**. Việc này chạy chậm theo giới hạn tốc độ, có thể mất vài ngày.

> Không dùng Caddy (ví dụ đã có Nginx hoặc dùng Cloudflare Tunnel)? Bỏ `--profile caddy`. Web lắng nghe ở `127.0.0.1:3000`.

## 4. Cloudflare

1. Bật proxy (biểu tượng đám mây cam) cho bản ghi DNS. Đặt **SSL/TLS → Full (strict)**.
   Caddy lấy chứng chỉ qua HTTP-01. Nếu bật *Always Use HTTPS*, hãy loại trừ `/.well-known/acme-challenge/*`, hoặc để DNS-only trong lần lấy chứng chỉ đầu tiên.
2. **Cache Rules:**
   - `URI Path starts with /api/img` → *Eligible for cache*, Edge TTL *Use cache-control header*. Ảnh trả `immutable` 1 năm, đây là phần tiết kiệm băng thông nhiều nhất.
   - `/_next/static/*` được Cloudflare cache sẵn.
   - (Tuỳ chọn) Cache HTML: *Eligible for cache* cho mọi đường dẫn **trừ** `/admin*`, `/api/*`, `/dang-nhap`, `/dang-ky`, `/tu-truyen`, và tôn trọng `s-maxage` của server. Làm được vì phần riêng của từng người (theo dõi, bình luận, lịch sử) đều tải ở trình duyệt.
3. **Rate limiting** (Security → WAF): giới hạn `/api/auth/*` và `/api/img*` theo IP để chống lạm dụng.

Web đọc IP thật của người dùng từ header `CF-Connecting-IP` để đếm lượt xem và giới hạn tần suất.

## 5. Cập nhật phiên bản

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm worker pnpm db:deploy
docker compose -f docker-compose.prod.yml --profile caddy up -d
```

## 6. Sao lưu

```bash
./scripts/backup-db.sh                      # tạo backups/truyen-<thời gian>.sql.gz, giữ 7 ngày
crontab -e                                  # chạy tự động 3 giờ sáng mỗi ngày:
# 0 3 * * * cd /srv/web_truyen && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

Nên chép thư mục `backups/` sang nơi khác (S3, R2, máy khác).

Khôi phục:

```bash
gunzip -c backups/truyen-XXXX.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

Redis chỉ chứa hàng đợi, session và bộ đếm lượt xem chưa ghi xuống DB. Mất Redis thì người dùng phải đăng nhập lại, ngoài ra không mất dữ liệu quan trọng.

## 7. Theo dõi

- `https://<domain>/api/health`: trả 200 khi Postgres và Redis đều ổn. Gắn vào UptimeRobot hoặc Better Stack.
- **Quản trị → Tổng quan**: số job lỗi trong 24 giờ, hàng đợi, tình trạng từng nguồn.
- Log: `docker compose -f docker-compose.prod.yml logs -f worker web`

## 8. Sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Nguồn đổi tên miền, crawl lỗi hàng loạt | **Quản trị → Nguồn crawl**, sửa Domain rồi Lưu. |
| Nguồn trả 403 cho một số truyện (Cloudflare challenge) | Hệ thống tự bỏ qua truyện đó 7 ngày. Không vượt chặn; nguồn dự phòng có truyện đó thì sẽ được dùng. |
| Nguồn trả 429/503 | HTTP client tự tạm dừng host đó (theo `Retry-After`). Nếu kéo dài, tăng "Giãn cách (ms)" của nguồn. |
| `docker compose build` lỗi kết nối DB | Postgres chưa chạy hoặc `BUILD_DATABASE_URL` sai (phải là `127.0.0.1:5432`). |
| Build hoặc chạy trong mạng có proxy/antivirus giải mã TLS (lỗi `certificate not trusted`, `SELF_SIGNED_CERT_IN_CHAIN`) | Build: `docker build --secret id=extra_ca,src=ca.pem …`. Chạy: mount chứng chỉ vào container và đặt `NODE_EXTRA_CA_CERTS`. Trên VPS thường không gặp. |

## 9. Mở rộng

- **Nhiều instance web:** session và giới hạn tần suất đã nằm ở Redis nên chạy song song được. Cache `use cache` của Next nằm trong bộ nhớ từng instance; khi cần chia sẻ, cấu hình [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) dùng Redis.
- **Crawl nhanh hơn:** tăng `concurrency` trong `apps/worker/src/index.ts`, hoặc chạy thêm container worker (BullMQ tự chia job). Giới hạn tốc độ tính theo từng process, nên khi chạy nhiều worker hãy tăng "Giãn cách" của nguồn tương ứng.
- **Postgres:** khi kho lớn (hàng triệu chương), chuyển sang Postgres managed hoặc máy riêng, nhớ bật sao lưu định kỳ.

## 10. Bảo mật

- Xoá các tài khoản thử nghiệm và đặt mật khẩu mạnh cho admin.
- Không commit `.env`. Giữ quyền `600` cho file này.
- Postgres chỉ mở ở `127.0.0.1`, Redis không mở ra ngoài.
- Theo dõi **Quản trị → Yêu cầu gỡ** và xử lý yêu cầu bản quyền kịp thời.
