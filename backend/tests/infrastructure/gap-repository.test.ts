import { beforeEach, describe, expect, it } from "vitest";
import { MAX_GAP_ATTEMPTS, type GapObservation } from "../../src/domain/gap";
import { PostgresGapRepository } from "../../src/infrastructure/repositories/gap-repository";
import { PostgresUniversityRepository } from "../../src/infrastructure/repositories/university-repository";
import { universityInfo } from "../support/builders";
import { createTestDb } from "../support/test-db";

const t0 = new Date("2026-09-30T10:00:00Z");
const day = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(t0.getTime() + days * day);

const credits: GapObservation = { kind: "missing_field", field: "creditHours", detail: "no credit hours" };
const tuition: GapObservation = { kind: "missing_field", field: "tuition", detail: "no tuition" };

describe("gap repository", () => {
  let gaps: PostgresGapRepository;
  let uni: number;

  beforeEach(async () => {
    const db = await createTestDb();
    gaps = new PostgresGapRepository(db);
    uni = (await new PostgresUniversityRepository(db).sync([universityInfo()]))[0]!.id;
  });

  it("opens a gap the first time it is seen", async () => {
    await gaps.syncForMajor(uni, "10", "Film", [credits], t0);
    const list = await gaps.listUnresolved({ universityId: uni });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      majorExternalId: "10",
      majorName: "Film",
      kind: "missing_field",
      field: "creditHours",
      status: "open",
      attempts: 1,
    });
  });

  it("bumps attempts instead of duplicating, and gives up after too many", async () => {
    for (let i = 0; i < MAX_GAP_ATTEMPTS - 1; i++) {
      await gaps.syncForMajor(uni, "10", "Film", [credits], at(i));
    }
    let [gap] = await gaps.listUnresolved();
    expect(gap).toMatchObject({ status: "open", attempts: MAX_GAP_ATTEMPTS - 1 });
    expect(await gaps.repairTargets(uni)).toEqual(["10"]);

    await gaps.syncForMajor(uni, "10", "Film", [credits], at(10));
    [gap] = await gaps.listUnresolved();
    expect(gap).toMatchObject({ status: "gave_up", attempts: MAX_GAP_ATTEMPTS });
    expect(await gaps.repairTargets(uni)).toEqual([]);
    expect(await gaps.counts(uni)).toEqual({ open: 0, gaveUp: 1 });
  });

  it("resolves gaps that were not seen again for that major", async () => {
    await gaps.syncForMajor(uni, "10", "Film", [credits, tuition], t0);
    await gaps.syncForMajor(uni, "10", "Film", [tuition], at(1));

    const open = await gaps.listUnresolved({ universityId: uni });
    expect(open.map((g) => g.field)).toEqual(["tuition"]);
    expect(await gaps.counts(uni)).toEqual({ open: 1, gaveUp: 0 });
  });

  it("clears everything when the major comes back clean", async () => {
    await gaps.syncForMajor(uni, "10", "Film", [credits], t0);
    await gaps.syncForMajor(uni, "10", "Film", [], at(1));
    expect(await gaps.listUnresolved()).toEqual([]);
  });

  it("keeps gaps of different majors apart", async () => {
    await gaps.syncForMajor(uni, "10", "Film", [credits], t0);
    await gaps.syncForMajor(uni, "11", "Music", [credits], t0);
    await gaps.syncForMajor(uni, "10", "Film", [], at(1));

    const left = await gaps.listUnresolved();
    expect(left.map((g) => g.majorExternalId)).toEqual(["11"]);
  });

  it("opens a gap again after it was resolved", async () => {
    await gaps.syncForMajor(uni, "10", "Film", [credits], t0);
    await gaps.syncForMajor(uni, "10", "Film", [], at(1));
    await gaps.syncForMajor(uni, "10", "Film", [credits], at(2));

    const [gap] = await gaps.listUnresolved();
    expect(gap).toMatchObject({ status: "open", attempts: 1 });
  });

  it("tracks university wide gaps and only resolves the kinds it is told about", async () => {
    const drop: GapObservation = { kind: "count_drop", field: null, detail: "found 10, was 36" };
    await gaps.syncForUniversity(uni, ["count_drop", "discovery_failed"], [drop], t0);
    await gaps.syncForMajor(uni, "10", "Film", [credits], t0);

    // a clean discovery resolves the count drop but leaves the major gap alone
    await gaps.syncForUniversity(uni, ["count_drop", "discovery_failed"], [], at(1));
    const left = await gaps.listUnresolved();
    expect(left.map((g) => g.kind)).toEqual(["missing_field"]);
  });

  it("reports the highest attempt counter among gaps still being retried", async () => {
    expect(await gaps.maxOpenAttempts(uni)).toBe(0);
    await gaps.syncForMajor(uni, "10", "Film", [credits], t0);
    await gaps.syncForMajor(uni, "10", "Film", [credits], at(1));
    await gaps.syncForMajor(uni, "11", "Music", [credits], t0);
    expect(await gaps.maxOpenAttempts(uni)).toBe(2);
  });
});
