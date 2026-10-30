import { prisma } from "../src/index";

// Cấp quyền admin cho một tài khoản đã đăng ký: pnpm make-admin <email>
const email = process.argv[2];
if (!email) {
  console.error("Cách dùng: pnpm make-admin <email>");
  process.exit(1);
}

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`Không tìm thấy tài khoản ${email} — hãy đăng ký trên web trước.`);
  process.exitCode = 1;
} else {
  await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
  console.log(`✔ ${email} đã là admin`);
}
await prisma.$disconnect();
