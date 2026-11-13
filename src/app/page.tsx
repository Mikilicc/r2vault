import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/auth";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasValidSession())) {
    redirect("/login");
  }

  return <Dashboard />;
}
