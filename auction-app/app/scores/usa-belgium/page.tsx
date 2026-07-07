import { redirect } from "next/navigation";

export default function UsaBelgiumRedirect() {
  redirect("/match-scores?match=usa-belgium");
}
