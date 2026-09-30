import { z } from "zod";

// Mirrors what the backend sends (backend/src/presentation/http/dto.ts).
// Every response is checked against these, so a backend change fails loudly here
// instead of rendering "undefined" somewhere in the ui.

const date = z.iso.datetime().transform((value) => new Date(value));

export const crawlStatsSchema = z.object({
  discovered: z.number(),
  scraped: z.number(),
  skipped: z.number(),
  failed: z.number(),
  created: z.number(),
  updated: z.number(),
  unchanged: z.number(),
  markedMissing: z.number(),
});

export const crawlRunSchema = z.object({
  id: z.number(),
  universityId: z.number(),
  mode: z.enum(["full", "incremental", "repair"]),
  trigger: z.enum(["schedule", "manual", "repair", "startup"]),
  status: z.enum(["pending", "running", "completed", "completed_with_issues", "failed", "expired"]),
  requestedAt: date,
  startedAt: date.nullable(),
  finishedAt: date.nullable(),
  progress: z.object({ done: z.number(), total: z.number() }),
  stats: crawlStatsSchema,
  failure: z.object({ stage: z.string(), message: z.string() }).nullable(),
});

export const gapSchema = z.object({
  id: z.number(),
  universityId: z.number(),
  majorExternalId: z.string().nullable(),
  majorName: z.string().nullable(),
  kind: z.enum(["missing_field", "suspect_value", "scrape_failed", "count_drop", "discovery_failed"]),
  field: z.string().nullable(),
  detail: z.string(),
  status: z.enum(["open", "gave_up"]),
  attempts: z.number(),
  firstSeenAt: date,
  lastSeenAt: date,
});

const tuitionTotal = z.object({ label: z.string(), amount: z.number() });

export const majorSummarySchema = z.object({
  id: z.number(),
  universityId: z.number(),
  name: z.string(),
  degreeType: z.string().nullable(),
  faculty: z.string().nullable(),
  department: z.string().nullable(),
  creditHours: z.number().nullable(),
  tuitionCurrency: z.string().nullable(),
  tuitionTotals: z.array(tuitionTotal),
  descriptionExcerpt: z.string().nullable(),
  hasAdmissionRequirements: z.boolean(),
  sourceUrl: z.string(),
  status: z.enum(["active", "missing"]),
  lastSeenAt: date,
  lastChangedAt: date,
});

export const majorDetailSchema = majorSummarySchema.extend({
  description: z.string().nullable(),
  admissionRequirements: z
    .object({
      sections: z.array(z.object({ title: z.string(), body: z.string() })),
      sourceUrls: z.array(z.string()),
    })
    .nullable(),
  tuition: z
    .object({
      currency: z.string(),
      rates: z.array(z.object({ label: z.string(), amountPerCreditHour: z.number() })),
      estimatedTotals: z.array(tuitionTotal),
      sourceUrl: z.string(),
    })
    .nullable(),
  firstSeenAt: date,
});

export const universitySchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  country: z.string(),
  website: z.string(),
  scheduleEveryHours: z.number(),
  activeMajors: z.number(),
  missingMajors: z.number(),
  activeRun: crawlRunSchema.nullable(),
  lastFinishedRun: crawlRunSchema.nullable(),
  lastSuccessfulRun: crawlRunSchema.nullable(),
  gaps: z.object({ open: z.number(), gaveUp: z.number() }),
  health: z.object({
    status: z.enum(["never_crawled", "healthy", "degraded", "failing"]),
    reasons: z.array(z.string()),
  }),
  nextDueAt: date.nullable(),
  due: z.boolean(),
});

export const facetsSchema = z.object({
  faculties: z.array(z.object({ name: z.string(), departments: z.array(z.string()) })),
  degreeTypes: z.array(z.string()),
});

export const startedCrawlSchema = z.object({ created: z.boolean(), run: crawlRunSchema });

export const startedAllSchema = z.object({
  runs: z.array(z.object({ universityId: z.number(), created: z.boolean(), run: crawlRunSchema })),
});

export const errorBodySchema = z.object({ error: z.string() });
