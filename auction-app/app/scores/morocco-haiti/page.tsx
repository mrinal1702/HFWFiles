import { redirect } from "next/navigation";

export default function MoroccoHaitiRedirect() {
  redirect("/match-scores?match=morocco-haiti");
}
