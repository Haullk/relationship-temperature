import { NextResponse, type NextRequest } from "next/server";

import { normalizeKnownPairId, pairCanonicalPath } from "@/lib/pairSeo";

export function middleware(request: NextRequest) {
  const pairId = normalizeKnownPairId(request.nextUrl.searchParams.get("pair"));
  if (pairId === null) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = pairCanonicalPath(pairId);
  url.searchParams.delete("pair");
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/", "/trend"]
};
