import { proxyApiRequest } from "@/lib/api-proxy";

// Same-origin proxy for browser calls: /api/* on the web origin is forwarded
// to the API. The base URL is read per request, so it is runtime configuration.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handleApiRequest = (request: Request) => proxyApiRequest(request);

export {
  handleApiRequest as DELETE,
  handleApiRequest as GET,
  handleApiRequest as HEAD,
  handleApiRequest as OPTIONS,
  handleApiRequest as PATCH,
  handleApiRequest as POST,
  handleApiRequest as PUT,
};
