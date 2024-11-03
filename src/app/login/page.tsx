import Link from "next/link";

export default async function Page() {
  return (
    <>
      <h1 className="text-4xl">Sign in</h1>
      <Link href="/api/auth/github">Sign in with GitHub</Link>
    </>
  );
}
