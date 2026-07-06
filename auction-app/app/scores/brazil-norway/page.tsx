import { redirect } from "next/navigation";

export default function BrazilNorwayRedirect() {
  redirect("/match-scores?match=brazil-norway");
}
