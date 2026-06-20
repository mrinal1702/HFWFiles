import { redirect } from "next/navigation";

export default function BrazilHaitiRedirect() {
  redirect("/match-scores?match=brazil-haiti");
}
