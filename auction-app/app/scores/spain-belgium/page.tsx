import { redirect } from "next/navigation";

export default function SpainBelgiumRedirect() {
  redirect("/match-scores?match=spain-belgium");
}
