import { redirect } from "next/navigation";

export default function SwitzerlandCanadaRedirect() {
  redirect("/match-scores?match=switzerland-canada");
}
