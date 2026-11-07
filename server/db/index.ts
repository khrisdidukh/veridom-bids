import { createGetDb } from "@agent-native/core/db";
import { registerShareableResource } from "@agent-native/core/sharing";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

registerShareableResource({
  type: "bid-project",
  resourceTable: schema.bidProjects,
  sharesTable: schema.bidProjectShares,
  displayName: "Bid comparison",
  titleColumn: "name",
  getResourcePath: (project) => `/bids/${project.id}`,
  getDb,
});
