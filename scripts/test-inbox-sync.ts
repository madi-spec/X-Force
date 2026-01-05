import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { performInitialSync } from "../src/lib/inbox/inboxService";

async function test() {
  const userId = "11111111-1111-1111-1111-111111111009";
  console.log("Starting inbox sync for user:", userId);

  try {
    const result = await performInitialSync(userId);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
