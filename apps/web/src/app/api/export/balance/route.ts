import { exportBalanceJson } from "@/actions/balance";

export async function GET() {
  const json = await exportBalanceJson();
  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="balance_v2.json"',
    },
  });
}
