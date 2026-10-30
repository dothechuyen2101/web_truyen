export type StoryType = "NOVEL" | "COMIC";
export type StoryStatus = "ONGOING" | "COMPLETED" | "UNKNOWN";

/** Mọi `path` là đường dẫn tương đối với baseUrl của nguồn, vd "/truyen-tranh/gay-go-cap-99". */
export interface StoryRef {
  path: string;
  title: string;
  coverUrl?: string;
  /** Số chương mới nhất hiển thị ở trang danh sách — dùng để biết truyện có chương mới không */
  latestChapter?: number;
}

export interface StoryListPage {
  items: StoryRef[];
  hasNext: boolean;
}

export interface StoryDetail {
  path: string;
  title: string;
  altTitles: string[];
  author?: string;
  genres: string[];
  status: StoryStatus;
  coverUrl?: string;
  /** HTML đã làm sạch, chỉ gồm các đoạn <p> */
  description?: string;
}

export interface ChapterRef {
  path: string;
  number: number;
  title?: string;
}

export type ChapterContent = { kind: "text"; html: string } | { kind: "images"; urls: string[] };

export interface SourceAdapter {
  readonly key: string;
  readonly type: StoryType;
  readonly baseUrl: string;
  /** Host ảnh được phép đi qua proxy ảnh (so khớp chính xác hoặc theo tên miền con) */
  readonly imageHosts: string[];

  /** Trang danh sách "mới cập nhật". Duyệt tới trang cuối cũng chính là backfill toàn bộ nguồn. */
  listLatest(page: number): Promise<StoryListPage>;
  getStory(path: string): Promise<StoryDetail>;
  /** Danh sách chương, sắp xếp tăng dần theo số chương */
  getChapterList(storyPath: string): Promise<ChapterRef[]>;
  getChapterContent(chapterPath: string): Promise<ChapterContent>;
  /** Header cần gửi khi tải ảnh của nguồn (vd Referer để qua chặn hotlink) */
  imageHeaders(imageUrl: string): Record<string, string>;
}
