export const dynamic = 'force-dynamic';
import { getUsers } from "@/lib/db";
import { UserTable } from "./table";

export default async function AdminUsersPage() {
  const users = await getUsers();
  const activeCount = users.filter((u) => u.status === "active").length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-[12px] text-stone-400 uppercase tracking-wider">
            总用户
          </p>
          <p className="text-2xl font-semibold text-stone-800 tabular-nums mt-0.5">
            {users.length}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-stone-400 uppercase tracking-wider">
            活跃
          </p>
          <p className="text-2xl font-semibold text-stone-800 tabular-nums mt-0.5">
            {activeCount}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-stone-400 uppercase tracking-wider">
            总积分
          </p>
          <p className="text-2xl font-semibold text-stone-800 tabular-nums mt-0.5">
            {(users.reduce((s, u) => s + (u.pointsUsed || 0), 0)).toLocaleString()}
          </p>
        </div>
      </div>

      <UserTable users={users} />
    </div>
  );
}
