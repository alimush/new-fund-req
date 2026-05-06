export const runtime = "nodejs";

export async function GET() {
  return new Response("This endpoint is disabled for security reasons.", { status: 403 });
}
