import { NextResponse, type NextRequest } from "next/server";

import { normalizeKnownPairId, pairCanonicalUrl } from "@/lib/pairSeo";

export function middleware(request: NextRequest) {
  const pairId = normalizeKnownPairId(request.nextUrl.searchParams.get("pair"));
  if (pairId === null) {
    return NextResponse.next();
  }

  return NextResponse.redirect(pairCanonicalUrl(pairId), 308);
}

export const config = {
  matcher: ["/", "/trend"]
};
