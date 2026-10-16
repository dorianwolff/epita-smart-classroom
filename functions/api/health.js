import { prepareDatabase } from "../lib/database.js";
import { apiResponse } from "../lib/response.js";

export async function onRequestGet(context) {
  const prepared = await prepareDatabase(context, { rateLimit: false });
  if (prepared.error) return prepared.error;
  await prepared.database.prepare("SELECT id FROM audits WHERE owner_id = ? LIMIT 1").bind(prepared.owner).first();
  return apiResponse({ status: "ok", persistence: "d1", authenticated: true });
}
