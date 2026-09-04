import { completeAuthLinkRedirect } from "@/lib/auth/auth-code-redirect";

export async function GET(request: Request) {
  return completeAuthLinkRedirect(request);
}
