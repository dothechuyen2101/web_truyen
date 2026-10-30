import { Queue, type DefaultJobOptions } from "bullmq";

/** Tên các hàng đợi — worker và web dùng chung. */
export const QUEUE = {
  /** discover-all (theo lịch), discover (một nguồn, kể cả backfill), cleanup */
  discovery: "discovery",
  /** Đồng bộ một truyện: thông tin + danh sách chương */
  sync: "sync",
  /** Tải trước nội dung chương (job "content") và nhận diện ảnh quảng cáo của nguồn (job "detect-ads") */
  content: "content",
} as const;

export interface DiscoveryJob {
  sourceId?: number;
  fromPage?: number;
  pages?: number;
  /** Backfill: quét lần lượt tới trang cuối, mỗi job một đoạn trang */
  backfill?: boolean;
}

export interface SyncJob {
  sourceId: number;
  path: string;
}

export interface ContentJob {
  chapterId: number;
}

export const redisConnection = () => ({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });

// Lịch sử chạy đã ghi trong CrawlRun nên không giữ job cũ trong Redis
// (giữ lại sẽ chặn việc thêm lại job cùng jobId).
const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: true,
};

let queues:
  | { discovery: Queue<DiscoveryJob>; sync: Queue<SyncJob>; content: Queue<ContentJob> }
  | undefined;

export function getQueues() {
  queues ??= {
    discovery: new Queue<DiscoveryJob>(QUEUE.discovery, { connection: redisConnection(), defaultJobOptions }),
    sync: new Queue<SyncJob>(QUEUE.sync, { connection: redisConnection(), defaultJobOptions }),
    content: new Queue<ContentJob>(QUEUE.content, {
      connection: redisConnection(),
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    }),
  };
  return queues;
}

export async function closeQueues() {
  if (!queues) return;
  await Promise.all(Object.values(queues).map((q) => q.close()));
  queues = undefined;
}

/** Ưu tiên của BullMQ: số nhỏ chạy trước. */
export const PRIORITY = { manual: 1, normal: 5, backfill: 10 } as const;

export const enqueue = {
  discovery(data: DiscoveryJob) {
    const jobId = data.backfill
      ? `backfill-${data.sourceId}-${data.fromPage ?? 1}`
      : `discover-${data.sourceId}`;
    return getQueues().discovery.add("discover", data, { jobId });
  },
  sync(data: SyncJob, priority: number = PRIORITY.normal) {
    return getQueues().sync.add("sync", data, {
      jobId: `sync-${data.sourceId}-${data.path}`.replaceAll(":", "_"),
      priority,
    });
  },
  content(chapterId: number) {
    return getQueues().content.add("content", { chapterId }, { jobId: `content-${chapterId}` });
  },
  ads(chapterId: number, priority: number = PRIORITY.normal) {
    return getQueues().content.add("detect-ads", { chapterId }, { jobId: `ads-${chapterId}`, priority });
  },
};
