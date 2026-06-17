import { redirect } from "next/navigation";

export default function FranceSenegalRedirect() {
  redirect("/match-scores?match=france-senegal");
}
