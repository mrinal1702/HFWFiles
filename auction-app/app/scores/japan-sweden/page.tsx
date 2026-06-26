import { redirect } from "next/navigation";

export default function JapanSwedenRedirect() {
  redirect("/match-scores?match=japan-sweden");
}
