import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { connectDb } from "../src/shared/db/connect";
import { syncAllIndexes } from "../src/shared/db/indexes";

async function main() {
  await connectDb();
  const results = await syncAllIndexes();
  const total = results.reduce((sum, row) => sum + row.indexes.length, 0);
  console.log(`Synced ${results.length} collections, ${total} indexes`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
