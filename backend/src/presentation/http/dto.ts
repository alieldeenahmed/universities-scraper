import type { UniversityOverview } from "../../application/catalog-queries";
import type { CrawlRun } from "../../domain/crawl";
import type { Gap } from "../../domain/gap";
import type { Major } from "../../domain/major";

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

const EXCERPT_LENGTH = 240;

function excerpt(text: string | null): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= EXCERPT_LENGTH) return flat;
  return `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}

export function toMajorSummary(major: Major) {
  return {
    id: major.id,
    universityId: major.universityId,
    name: major.name,
    degreeType: major.degreeType,
    faculty: major.faculty,
    department: major.department,
    creditHours: major.creditHours,
    tuitionCurrency: major.tuition?.currency ?? null,
    tuitionTotals: major.tuition?.estimatedTotals ?? [],
    descriptionExcerpt: excerpt(major.description),
    hasAdmissionRequirements: (major.admissionRequirements?.sections.length ?? 0) > 0,
    sourceUrl: major.sourceUrl,
    status: major.status,
    lastSeenAt: iso(major.lastSeenAt),
    lastChangedAt: iso(major.lastChangedAt),
  };
}

export function toMajorDetail(major: Major) {
  return {
    ...toMajorSummary(major),
    description: major.description,
    admissionRequirements: major.admissionRequirements,
    tuition: major.tuition,
    firstSeenAt: iso(major.firstSeenAt),
  };
}

export function toCrawlRun(run: CrawlRun) {
  return {
    id: run.id,
    universityId: run.universityId,
    mode: run.mode,
    trigger: run.trigger,
    status: run.status,
    requestedAt: iso(run.requestedAt),
    startedAt: iso(run.startedAt),
    finishedAt: iso(run.finishedAt),
    progress: { done: run.progressDone, total: run.progressTotal },
    stats: run.stats,
    failure: run.failure,
  };
}

export function toGap(gap: Gap) {
  return {
    id: gap.id,
    universityId: gap.universityId,
    majorExternalId: gap.majorExternalId,
    majorName: gap.majorName,
    kind: gap.kind,
    field: gap.field,
    detail: gap.detail,
    status: gap.status,
    attempts: gap.attempts,
    firstSeenAt: iso(gap.firstSeenAt),
    lastSeenAt: iso(gap.lastSeenAt),
  };
}

export function toUniversityOverview(overview: UniversityOverview) {
  const { university } = overview;
  const run = (r: CrawlRun | null) => (r ? toCrawlRun(r) : null);
  return {
    id: university.id,
    slug: university.slug,
    name: university.name,
    country: university.country,
    website: university.website,
    scheduleEveryHours: university.schedule.everyHours,
    activeMajors: overview.activeMajors,
    missingMajors: overview.missingMajors,
    activeRun: run(overview.activeRun),
    lastFinishedRun: run(overview.lastFinishedRun),
    lastSuccessfulRun: run(overview.lastSuccessfulRun),
    gaps: overview.gaps,
    health: overview.health,
    nextDueAt: iso(overview.nextDueAt),
    due: overview.due,
  };
}
