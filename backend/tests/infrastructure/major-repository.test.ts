import { beforeEach, describe, expect, it } from "vitest";
import type { PgliteDatabase } from "../../src/infrastructure/db/pglite-database";
import { PostgresMajorRepository } from "../../src/infrastructure/repositories/major-repository";
import { PostgresUniversityRepository } from "../../src/infrastructure/repositories/university-repository";
import { scrapedMajor, universityInfo } from "../support/builders";
import { createTestDb } from "../support/test-db";

const t0 = new Date("2026-09-30T10:00:00Z");
const t1 = new Date("2026-10-01T10:00:00Z");

describe("university + major repositories", () => {
  let db: PgliteDatabase;
  let majors: PostgresMajorRepository;
  let universityId: number;

  beforeEach(async () => {
    db = await createTestDb();
    majors = new PostgresMajorRepository(db);
    const unis = await new PostgresUniversityRepository(db).sync([universityInfo()]);
    universityId = unis[0]!.id;
  });

  it("syncs universities by slug without duplicating them", async () => {
    const repo = new PostgresUniversityRepository(db);
    await repo.sync([universityInfo({ name: "Renamed", schedule: { everyHours: 12 } })]);
    const all = await repo.list();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ slug: "test-uni", name: "Renamed", schedule: { everyHours: 12 } });
  });

  it("creates a major with its faculty and department", async () => {
    const outcome = await majors.save(universityId, scrapedMajor(), t0);
    expect(outcome).toBe("created");

    const [major] = await majors.list({ universityId });
    expect(major).toMatchObject({
      externalId: "100",
      name: "Computer Science",
      faculty: "School of Sciences and Engineering",
      department: "Department of Computer Science and Engineering",
      creditHours: 130,
      status: "active",
    });
    expect(major?.admissionRequirements?.sections[0]?.title).toBe("General requirements");
    expect(major?.tuition?.rates[0]?.amountPerCreditHour).toBe(700);
  });

  it("reports unchanged when only the source version moved", async () => {
    await majors.save(universityId, scrapedMajor(), t0);
    const outcome = await majors.save(universityId, scrapedMajor({ sourceVersion: "v2" }), t1);
    expect(outcome).toBe("unchanged");

    const [major] = await majors.list({ universityId });
    expect(major?.sourceVersion).toBe("v2");
    expect(major?.lastSeenAt).toEqual(t1);
    expect(major?.lastChangedAt).toEqual(t0);
  });

  it("reports updated and bumps lastChangedAt when content changes", async () => {
    await majors.save(universityId, scrapedMajor(), t0);
    const outcome = await majors.save(universityId, scrapedMajor({ creditHours: 132 }), t1);
    expect(outcome).toBe("updated");

    const [major] = await majors.list({ universityId });
    expect(major?.creditHours).toBe(132);
    expect(major?.lastChangedAt).toEqual(t1);
    expect(major?.firstSeenAt).toEqual(t0);
  });

  it("keeps one row per external id", async () => {
    await majors.save(universityId, scrapedMajor(), t0);
    await majors.save(universityId, scrapedMajor(), t1);
    expect(await majors.list({ universityId })).toHaveLength(1);
  });

  it("marks majors missing, and brings them back when they reappear", async () => {
    await majors.save(universityId, scrapedMajor({ externalId: "1", name: "A" }), t0);
    await majors.save(universityId, scrapedMajor({ externalId: "2", name: "B" }), t0);

    const changed = await majors.markMissingExcept(universityId, ["1"], t1);
    expect(changed).toBe(1);
    expect(await majors.count(universityId, "active")).toBe(1);
    expect(await majors.count(universityId, "missing")).toBe(1);

    const outcome = await majors.save(universityId, scrapedMajor({ externalId: "2", name: "B" }), t1);
    expect(outcome).toBe("updated");
    expect(await majors.count(universityId, "active")).toBe(2);
  });

  it("returns source versions of active majors only", async () => {
    await majors.save(universityId, scrapedMajor({ externalId: "1", sourceVersion: "a" }), t0);
    await majors.save(universityId, scrapedMajor({ externalId: "2", sourceVersion: "b" }), t0);
    await majors.markMissingExcept(universityId, ["1"], t1);

    const versions = await majors.sourceVersions(universityId);
    expect([...versions.entries()]).toEqual([["1", "a"]]);
  });

  it("filters by faculty, degree type and free text", async () => {
    await majors.save(universityId, scrapedMajor({ externalId: "1", name: "Computer Science" }), t0);
    await majors.save(
      universityId,
      scrapedMajor({
        externalId: "2",
        name: "Film",
        degreeType: "Bachelor of Arts",
        faculty: "School of Humanities and Social Sciences",
        department: "Department of the Arts",
        description: "Learn to make movies and tell stories with a camera and a crew.",
      }),
      t0,
    );

    expect(await majors.list({ universityId, faculty: "School of Humanities and Social Sciences" })).toHaveLength(1);
    expect(await majors.list({ universityId, degreeType: "Bachelor of Science" })).toHaveLength(1);
    const found = await majors.list({ universityId, search: "movies" });
    expect(found.map((m) => m.name)).toEqual(["Film"]);
    expect(await majors.list({ universityId, search: "arts" })).toHaveLength(1);
  });

  it("builds facets from active majors", async () => {
    await majors.save(universityId, scrapedMajor({ externalId: "1" }), t0);
    await majors.save(
      universityId,
      scrapedMajor({
        externalId: "2",
        name: "Physics",
        department: "Department of Physics",
      }),
      t0,
    );
    const facets = await majors.facets(universityId);
    expect(facets.faculties).toEqual([
      {
        name: "School of Sciences and Engineering",
        departments: ["Department of Computer Science and Engineering", "Department of Physics"],
      },
    ]);
    expect(facets.degreeTypes).toEqual(["Bachelor of Science"]);
  });

  it("handles a major with no faculty or department", async () => {
    await majors.save(universityId, scrapedMajor({ faculty: null, department: null }), t0);
    const [major] = await majors.list({ universityId });
    expect(major?.faculty).toBeNull();
    expect(major?.department).toBeNull();
    expect((await majors.facets(universityId)).faculties).toEqual([]);
  });
});
