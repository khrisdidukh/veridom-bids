import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import {
  createSharesTable,
  ownableColumns,
} from "@agent-native/core/db/schema";

// A renovation job that collects competing contractor quotes.
export const bidProjects = pgTable("bid_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  description: text("description"),
  currency: text("currency").notNull().default("EUR"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  ...ownableColumns(),
});
export const bidProjectShares = createSharesTable("bid_project_shares");

// The owner's own scope: what the finished job must contain. Every quote is
// compared against these rows, not against each other's wording.
export const scopeItems = pgTable("scope_items", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  trade: text("trade").notNull(),
  title: text("title").notNull(),
  unit: text("unit").notNull(),
  quantity: doublePrecision("quantity").notNull(),
  required: boolean("required").notNull().default(true),
  benchmarkMin: doublePrecision("benchmark_min"),
  benchmarkMax: doublePrecision("benchmark_max"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

// One contractor quote (Angebot / Kostenvoranschlag).
export const bids = pgTable("bids", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  contractorName: text("contractor_name").notNull(),
  contractorEmail: text("contractor_email"),
  quoteRef: text("quote_ref"),
  quoteDate: text("quote_date"),
  validUntil: text("valid_until"),
  quotedNet: doublePrecision("quoted_net"),
  vatRate: doublePrecision("vat_rate"),
  paymentTerms: text("payment_terms"),
  warrantyMonths: integer("warranty_months"),
  startDate: text("start_date"),
  durationDays: integer("duration_days"),
  fileName: text("file_name"),
  sourceText: text("source_text"),
  status: text("status", { enum: ["received", "extracted", "reviewed"] })
    .notNull()
    .default("received"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

// A position from a quote, mapped to a scope item when it covers one.
export const bidLines = pgTable("bid_lines", {
  id: text("id").primaryKey(),
  bidId: text("bid_id").notNull(),
  projectId: text("project_id").notNull(),
  scopeItemId: text("scope_item_id"),
  position: text("position"),
  description: text("description").notNull(),
  quantity: doublePrecision("quantity"),
  unit: text("unit"),
  unitPrice: doublePrecision("unit_price"),
  total: doublePrecision("total"),
  coverage: text("coverage", {
    enum: ["included", "excluded", "optional", "unclear"],
  })
    .notNull()
    .default("included"),
  note: text("note"),
  // What this line added to the quoted total when it was read, so owner edits
  // show up as a change against the paper total.
  originalContribution: doublePrecision("original_contribution"),
  editedBy: text("edited_by", { enum: ["agent", "user"] })
    .notNull()
    .default("agent"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const bidFlags = pgTable("bid_flags", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  bidId: text("bid_id").notNull(),
  scopeItemId: text("scope_item_id"),
  kind: text("kind", {
    enum: [
      "missing",
      "excluded",
      "price_high",
      "price_low",
      "quantity",
      "terms",
      "other",
    ],
  }).notNull(),
  severity: text("severity", { enum: ["high", "medium", "low"] })
    .notNull()
    .default("medium"),
  message: text("message").notNull(),
  impact: doublePrecision("impact"),
  source: text("source", { enum: ["check", "agent", "user"] })
    .notNull()
    .default("check"),
  status: text("status", { enum: ["open", "resolved", "dismissed"] })
    .notNull()
    .default("open"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const bidQuestions = pgTable("bid_questions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  bidId: text("bid_id").notNull(),
  flagId: text("flag_id"),
  text: text("text").notNull(),
  status: text("status", { enum: ["draft", "approved"] })
    .notNull()
    .default("draft"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});
