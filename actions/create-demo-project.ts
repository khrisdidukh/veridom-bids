import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { requireUser } from "../server/lib/bids.js";

// Illustrative net ranges for a Vienna bathroom, for the demo only. Owners
// replace them with their own figures; nothing here is market data.
const DEMO_SCOPE = [
  ["Demolition", "Remove old tiles, bathtub, WC and basin", "lump sum", 1, 900, 1500],
  ["Demolition", "Debris removal and disposal", "lump sum", 1, 350, 600],
  ["Tiling", "Waterproofing of floor and shower walls", "m²", 9, 45, 75],
  ["Tiling", "Floor levelling screed", "m²", 7.5, 35, 60],
  ["Tiling", "Wall tiling, laying", "m²", 22, 60, 90],
  ["Tiling", "Floor tiling, laying", "m²", 7.5, 60, 90],
  ["Tiling", "Tiles material 60×60, incl. 10 % waste", "m²", 32, 35, 60],
  ["Plumbing", "Floor-level shower with linear drain", "pcs", 1, 450, 750],
  ["Plumbing", "Wall-hung WC incl. installation frame", "pcs", 1, 700, 1100],
  ["Plumbing", "Washbasin with tap, installed", "pcs", 1, 450, 800],
  ["Electrical", "2 sockets, ceiling light, extractor fan", "lump sum", 1, 700, 1200],
  ["Finishing", "Silicone joints and final cleaning", "lump sum", 1, 250, 450],
] as const;

export default defineAction({
  description:
    "Create the demo project 'Bathroom renovation, Vienna 1030' with a 12-item scope and illustrative benchmark ranges, ready for three quotes. Use when the user wants to try the app.",
  schema: z.object({}),
  link: ({ result }) => ({
    url: buildDeepLink({ view: "bids", to: `/bids/${encodeURIComponent(result.id)}`, params: { projectId: result.id } }),
    label: "Open demo project",
  }),
  run: async (_args, ctx) => {
    const ownerEmail = requireUser(ctx);
    const orgId = ctx?.orgId ?? null;
    const id = crypto.randomUUID();
    await getDb().transaction(async (tx) => {
      await tx.insert(schema.bidProjects).values({
        id,
        name: "Bathroom renovation, Vienna 1030",
        location: "Vienna, Austria",
        description:
          "7.5 m² bathroom in a 1960s flat: replace bathtub with a floor-level shower, wall-hung WC, new tiles, new electrics. Benchmarks are illustrative.",
        ownerEmail,
        orgId,
        visibility: orgId ? "org" : "private",
      });
      await tx.insert(schema.scopeItems).values(
        DEMO_SCOPE.map(([trade, title, unit, quantity, min, max], i) => ({
          id: crypto.randomUUID(),
          projectId: id,
          trade,
          title,
          unit,
          quantity,
          required: true,
          benchmarkMin: min,
          benchmarkMax: max,
          sortOrder: (i + 1) * 10,
          ownerEmail,
          orgId,
        })),
      );
    });
    return { id, name: "Bathroom renovation, Vienna 1030", scopeItems: DEMO_SCOPE.length };
  },
});
