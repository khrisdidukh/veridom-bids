import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadBid } from "../server/lib/bids.js";

export default defineAction({
  description:
    "Read the raw text of one contractor quote so you can extract its header and positions. Quotes are often German (Austria): 'exkl. USt' = net, 'bauseits' = done by the owner, i.e. NOT included, 'pauschal'/'psch' = lump sum, 'Stk' = pcs, 'lfm' = m.",
  schema: z.object({ bidId: z.string().describe("Quote id") }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ bidId }) => {
    const { bid } = await loadBid(bidId);
    return { id: bid.id, contractorName: bid.contractorName, fileName: bid.fileName, status: bid.status, text: bid.sourceText ?? "" };
  },
});
