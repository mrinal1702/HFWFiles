import { redirect } from "next/navigation";

export default function UsaAustraliaRedirect() {
  redirect("/match-scores?match=usa-australia");
}
