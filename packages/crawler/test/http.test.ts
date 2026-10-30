import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpClient, HttpError } from "../src/http";

let server: Server;
let base = "";
const hits = new Map<string, number[]>();

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? "/";
    hits.set(path, [...(hits.get(path) ?? []), Date.now()]);
    const count = hits.get(path)!.length;
    if (path === "/busy" && count === 1) {
      res.writeHead(503, { "Retry-After": "1" }).end();
    } else if (path === "/missing") {
      res.writeHead(404).end();
    } else {
      res.writeHead(200, { "Content-Type": "text/plain" }).end(`ok ${count}`);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("HttpClient", () => {
  it("nguồn báo 503 kèm Retry-After → chờ đúng thời gian rồi thử lại", async () => {
    const http = new HttpClient({ minIntervalMs: 0, retries: 2 });
    expect(await http.getText(`${base}/busy`)).toBe("ok 2");
    const [first, second] = hits.get("/busy")!;
    expect(second! - first!).toBeGreaterThanOrEqual(950);
  });

  it("404 là lỗi cố định, không thử lại", async () => {
    const http = new HttpClient({ minIntervalMs: 0, retries: 3 });
    await expect(http.getText(`${base}/missing`)).rejects.toBeInstanceOf(HttpError);
    expect(hits.get("/missing")).toHaveLength(1);
  });

  it("giãn cách request tới cùng một host", async () => {
    const http = new HttpClient({ minIntervalMs: 150 });
    await Promise.all([http.getText(`${base}/a`), http.getText(`${base}/b`), http.getText(`${base}/c`)]);
    const times = ["/a", "/b", "/c"].map((p) => hits.get(p)![0]!).sort((x, y) => x - y);
    expect(times[2]! - times[0]!).toBeGreaterThanOrEqual(280);
  });
});
