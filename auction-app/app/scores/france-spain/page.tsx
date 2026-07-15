import { redirect } from "next/navigation";

export default function FranceSpainRedirect() {
  redirect("/match-scores?match=france-spain");
}
