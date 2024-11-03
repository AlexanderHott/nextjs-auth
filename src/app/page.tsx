import { getCurrentSession } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { user } = await getCurrentSession();
  if (user === null) {
    return redirect("/login");
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      hi {user.username}
      <Link href="/logout">Logout</Link>
    </main>
  );
}
