import {
  getCurrentSession,
  invalidateSession,
  deleteSessionTokenCookie,
} from "@/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  return (
    <form action={logout}>
      <button>Sign out</button>
    </form>
  );
}

async function logout(_formData: FormData) {
  "use server";
  const { session } = await getCurrentSession();
  if (!session) {
    return;
  }

  await invalidateSession(session.id);
  await deleteSessionTokenCookie();
  return redirect("/login");
}
