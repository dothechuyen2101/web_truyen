import { Suspense } from "react";
import { prisma, type Prisma } from "@truyen/db";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AdminHeader, AdminSkeleton, Badge, Empty, Table, inputClass, td } from "@/components/admin/ui";
import { Pagination } from "@/components/pagination";
import { UserAvatar } from "@/components/user-avatar";
import { requireAdmin } from "@/lib/admin";
import { formatDate, formatNumber } from "@/lib/format";
import { setUserBanned, setUserRole } from "../actions";

const PAGE_SIZE = 30;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Users({ searchParams }: Pick<PageProps<"/admin/nguoi-dung">, "searchParams">) {
  const me = await requireAdmin("/admin/nguoi-dung");
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const where: Prisma.UserWhereInput = q
    ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { comments: true, follows: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <>
      <AdminHeader title="Người dùng" description={`${formatNumber(total)} tài khoản`} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Tên hoặc email…" className={`${inputClass} w-72`} />
        <button className="h-9 rounded-lg border px-4 text-sm hover:bg-muted">Tìm</button>
      </form>
      {users.length ? (
        <Table head={["Người dùng", "Vai trò", "Trạng thái", "Bình luận", "Theo dõi", "Tham gia", ""]}>
          {users.map((u) => (
            <tr key={u.id}>
              <td className={td}>
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={u.name} image={u.image} className="size-8" />
                  <div className="min-w-0">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className={td}>{u.role === "admin" ? <Badge color="blue">Admin</Badge> : <Badge>Người dùng</Badge>}</td>
              <td className={td}>{u.banned ? <Badge color="red">Đã khoá</Badge> : <Badge color="green">Hoạt động</Badge>}</td>
              <td className={`${td} tabular-nums`}>{u._count.comments}</td>
              <td className={`${td} tabular-nums`}>{u._count.follows}</td>
              <td className={`${td} whitespace-nowrap`}>{formatDate(u.createdAt)}</td>
              <td className={td}>
                {u.id !== me.id && (
                  <div className="flex gap-1">
                    <ActionForm action={setUserRole} inline>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="role" value={u.role === "admin" ? "user" : "admin"} />
                      <SubmitButton variant="ghost">{u.role === "admin" ? "Bỏ admin" : "Cấp admin"}</SubmitButton>
                    </ActionForm>
                    <ActionForm action={setUserBanned} inline confirm={u.banned ? undefined : `Khoá tài khoản ${u.name}?`}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="banned" value={u.banned ? "0" : "1"} />
                      <SubmitButton variant="ghost" className={u.banned ? undefined : "text-destructive"}>
                        {u.banned ? "Mở khoá" : "Khoá"}
                      </SubmitButton>
                    </ActionForm>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>Không tìm thấy người dùng.</Empty>
      )}
      <Pagination
        page={page}
        pageCount={Math.ceil(total / PAGE_SIZE)}
        href={(p) => `/admin/nguoi-dung?${new URLSearchParams({ ...(q && { q }), ...(p > 1 && { page: String(p) }) })}`}
      />
    </>
  );
}

export default function AdminUsersPage(props: PageProps<"/admin/nguoi-dung">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Users searchParams={props.searchParams} />
    </Suspense>
  );
}
