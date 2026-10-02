import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../../application/ports";
import { makeGap, makeRun, makeUniversity } from "../../test-support/builders";
import { FakeGateway } from "../../test-support/fake-gateway";
import { renderApp } from "../../test-support/render";

describe("crawls page", () => {
  let gateway: FakeGateway;

  beforeEach(() => {
    gateway = new FakeGateway();
  });

  async function row(name = "The American University in Cairo") {
    return within(await screen.findByRole("article", { name }));
  }

  it("shows each university with its health, counts and schedule", async () => {
    renderApp(gateway, "/crawls");
    const auc = await row();

    expect(auc.getByText("Healthy")).toBeInTheDocument();
    expect(auc.getByText("3")).toBeInTheDocument();
    expect(auc.getByText("Majors")).toBeInTheDocument();
    expect(auc.getByText(/every 24 h/)).toBeInTheDocument();
    expect(auc.getByText("None")).toBeInTheDocument();
    expect(auc.getByRole("button", { name: "Crawl now" })).toBeEnabled();
  });

  it("says when a university was never crawled and is due", async () => {
    gateway.universities = [
      makeUniversity({
        activeMajors: 0,
        lastSuccessfulRun: null,
        lastFinishedRun: null,
        nextDueAt: null,
        due: true,
        health: { status: "never_crawled", reasons: ["no crawl has finished yet"] },
      }),
    ];
    renderApp(gateway, "/crawls");
    const auc = await row();

    expect(auc.getByText("Not crawled yet")).toBeInTheDocument();
    expect(auc.getByText("Never")).toBeInTheDocument();
    expect(auc.getByText(/Due now/)).toBeInTheDocument();
    // the reason is obvious from the badge, no need to repeat it
    expect(auc.queryByText(/no crawl has finished yet/)).not.toBeInTheDocument();
  });

  it("starts a full crawl on demand and tells you", async () => {
    const user = userEvent.setup();
    renderApp(gateway, "/crawls");
    const auc = await row();

    await user.click(auc.getByRole("button", { name: "Crawl now" }));

    expect(await screen.findByText("Started a crawl for The American University in Cairo.")).toBeInTheDocument();
    expect(gateway.started).toEqual([{ universityId: 1, mode: "full" }]);
  });

  it("can check for changes without a full crawl", async () => {
    const user = userEvent.setup();
    renderApp(gateway, "/crawls");
    const auc = await row();

    await user.click(auc.getByRole("button", { name: "Check for changes" }));
    await screen.findByText(/Started a crawl/);
    expect(gateway.started).toEqual([{ universityId: 1, mode: "incremental" }]);
  });

  it("crawls everything from the top button", async () => {
    const user = userEvent.setup();
    gateway.universities = [makeUniversity(), makeUniversity({ id: 2, slug: "guc", name: "German University in Cairo" })];
    renderApp(gateway, "/crawls");
    await row();

    await user.click(screen.getByRole("button", { name: "Crawl all universities" }));
    expect(await screen.findByText("Started 2 crawls.")).toBeInTheDocument();
    expect(gateway.started).toEqual([{ universityId: "all", mode: "full" }]);
  });

  it("locks the buttons while a crawl is running and shows its progress", async () => {
    gateway.universities = [
      makeUniversity({
        activeRun: makeRun({ status: "running", progress: { done: 9, total: 36 }, finishedAt: null }),
      }),
    ];
    renderApp(gateway, "/crawls");
    const auc = await row();

    expect(auc.getByRole("button", { name: "Crawling…" })).toBeDisabled();
    expect(auc.getByRole("button", { name: "Check for changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Crawl all universities" })).toBeDisabled();

    const bar = auc.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(auc.getByText("Full crawl: 9 of 36 majors (manual)")).toBeInTheDocument();
  });

  it("shows an indeterminate bar before the crawl knows how many majors there are", async () => {
    gateway.universities = [
      makeUniversity({ activeRun: makeRun({ status: "running", progress: { done: 0, total: 0 }, finishedAt: null }) }),
    ];
    renderApp(gateway, "/crawls");
    const auc = await row();

    expect(auc.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    expect(auc.getByText(/loading the source pages/)).toBeInTheDocument();
  });

  it("says a crawl is queued when the worker hasn't picked it up yet", async () => {
    gateway.universities = [makeUniversity({ activeRun: makeRun({ status: "pending", finishedAt: null, startedAt: null }) })];
    renderApp(gateway, "/crawls");
    const auc = await row();
    expect(auc.getByRole("button", { name: "Queued" })).toBeDisabled();
    expect(auc.getByText("Waiting for the worker…")).toBeInTheDocument();
  });

  it("explains a degraded university and lists the gaps to look at", async () => {
    gateway.universities = [
      makeUniversity({
        health: { status: "degraded", reasons: ["2 open gaps", "1 gap needs attention"] },
        gaps: { open: 2, gaveUp: 1 },
        missingMajors: 2,
      }),
    ];
    gateway.gaps = [
      makeGap(),
      makeGap({ id: 2, majorName: "Arabic Studies (B.A.)", field: "tuition", status: "gave_up", attempts: 5 }),
      makeGap({ id: 3, majorExternalId: null, majorName: null, kind: "discovery_failed", field: null, detail: "The program list came back empty.", status: "gave_up" }),
    ];
    renderApp(gateway, "/crawls");

    const auc = await row();
    expect(auc.getByText("Needs a look")).toBeInTheDocument();
    expect(auc.getByText("2 open gaps; 1 gap needs attention.")).toBeInTheDocument();
    expect(auc.getByText(/2 being retried, 1 needs attention/)).toBeInTheDocument();
    expect(auc.getByText(/\(2 no longer listed\)/)).toBeInTheDocument();

    expect(await screen.findByText("Film (B.A.)")).toBeInTheDocument();
    expect(screen.getByText("Missing field: credit hours")).toBeInTheDocument();
    expect(screen.getByText("Retrying")).toBeInTheDocument();
    expect(screen.getAllByText("Needs attention")).toHaveLength(2);
    // a gap that isn't about one major is about the whole university
    expect(screen.getByText("Whole university")).toBeInTheDocument();
    expect(screen.getByText("Could not list majors")).toBeInTheDocument();
  });

  it("says nothing is missing when there are no gaps", async () => {
    renderApp(gateway, "/crawls");
    expect(await screen.findByText("Nothing is missing")).toBeInTheDocument();
  });

  it("lists recent crawls with what happened", async () => {
    gateway.runs = [
      makeRun({ id: 2, trigger: "repair", mode: "repair", status: "completed_with_issues" }),
      makeRun({
        id: 1,
        status: "failed",
        failure: { stage: "blocked", message: "3 requests in a row were blocked" },
      }),
    ];
    renderApp(gateway, "/crawls");

    expect(await screen.findByText("Auto repair")).toBeInTheDocument();
    expect(screen.getByText("Completed with issues")).toBeInTheDocument();
    expect(screen.getByText("3 requests in a row were blocked")).toBeInTheDocument();
    expect(screen.getAllByText("2 min 25 s").length).toBeGreaterThan(0);
  });

  it("shows why a crawl could not be started", async () => {
    const user = userEvent.setup();
    gateway.startError = new ApiError("university 1 not found", 404);
    renderApp(gateway, "/crawls");
    const auc = await row();

    await user.click(auc.getByRole("button", { name: "Crawl now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("university 1 not found");
    // and the button is usable again
    await waitFor(() => expect(auc.getByRole("button", { name: "Crawl now" })).toBeEnabled());
  });

  it("dismisses the confirmation message", async () => {
    const user = userEvent.setup();
    renderApp(gateway, "/crawls");
    const auc = await row();
    await user.click(auc.getByRole("button", { name: "Crawl now" }));
    await screen.findByText(/Started a crawl/);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Started a crawl/)).not.toBeInTheDocument();
  });

  it("shows a connection problem with a way to retry", async () => {
    gateway.failWith = new ApiError("Could not reach the server. Is it running?");
    renderApp(gateway, "/crawls");

    expect(await screen.findByText("Could not load the universities.")).toBeInTheDocument();
    expect(screen.getAllByText(/Could not reach the server/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Try again" }).length).toBeGreaterThan(0);
  });

  it("navigates between the two pages from the sidebar", async () => {
    const user = userEvent.setup();
    renderApp(gateway, "/");
    await waitFor(() => expect(screen.getByTestId("result-count")).toHaveTextContent("1 major"));

    await user.click(screen.getByRole("link", { name: "Crawls" }));
    expect(await screen.findByRole("heading", { name: "Crawls" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crawls" })).toHaveClass("active");
  });
});
