import { redirect } from "next/navigation";

export default function FranceMoroccoRedirect() {
  redirect("/match-scores?match=france-morocco");
}
