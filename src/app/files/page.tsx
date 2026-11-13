import { redirect } from "next/navigation";
import { hasValidSession } from "@/lib/auth";
import FilesBrowser from "./files-browser";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  if (!(await hasValidSession())) {
    redirect("/login");
  }

  return <FilesBrowser />;
}
