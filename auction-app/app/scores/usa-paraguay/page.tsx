import { redirect } from "next/navigation";

export default function UsaParaguayRedirect() {
  redirect("/scores?match=usa-paraguay");
}
