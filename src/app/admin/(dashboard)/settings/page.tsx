import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";

export default function SettingsIndexPage() {
  redirect(adminPath("/settings/general"));
}
