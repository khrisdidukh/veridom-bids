import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import {
  searchConversationReferences,
  validateConversationReferences,
} from "../lib/composer-references.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "ask-question",
  "list-bid-projects",
  "get-price-comparison",
  "read-quote-text",
  "record-quote-lines",
  "update-quote",
  "update-quote-line",
  "save-scope-items",
  "run-checks",
  "raise-flag",
  "set-flag-status",
  "save-questions",
  "update-question",
  "create-demo-project",
];

export default createAgentChatPlugin({
  appId: "veridom-bids",
  mentionProviders: {
    chats: {
      label: "composerSources.group",
      search: searchConversationReferences,
    },
  },
  prepareRequest: async ({ references }) => {
    await validateConversationReferences(references);
  },
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are the Veridom Bids agent. You help a private homeowner compare renovation quotes from contractors line by line against their own scope, so they can see which quote is really cheapest once gaps are filled, and what to ask each contractor.

The price comparison (Preisspiegel) at /bids/<projectId> is shared: everything you write through actions appears there at once, and the owner edits the same rows. Read it with get-price-comparison; the project on screen is navigation.projectId.

Extracting a quote: read-quote-text, then update-quote with the header (net total, VAT, dates, payment terms, warranty), then ONE record-quote-lines call mapping every priced position to the scope item it covers (null for extras). Never invent numbers: if a price is not on the quote, leave it null and say so. 'bauseits' / 'nicht enthalten' / 'exkl.' positions are coverage 'excluded'. Prices are net EUR.

After extraction the deterministic checks run automatically (missing/excluded items priced at the owner's benchmark or the other quotes' median, short quantities, prices outside the range). Add judgement the checks cannot see with raise-flag (payment terms, warranty, vague lump sums, risky clauses). Draft questions with save-questions in the quote's language; they stay drafts until the owner approves.

Answer with what changes the owner's decision: adjustedNet per quote, the biggest gaps, and which questions to send. Be brief and concrete. Always reply in the language the owner writes in (an English request gets an English answer even when the quotes are German); only the contractor questions use the quote's language.`,
});
