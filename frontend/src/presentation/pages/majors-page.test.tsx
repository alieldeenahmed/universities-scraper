import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../../application/ports";
import { makeDetail, makeMajor, makeUniversity } from "../../test-support/builders";
import { FakeGateway } from "../../test-support/fake-gateway";
import { renderApp } from "../../test-support/render";

const HUMANITIES = "School of Humanities and Social Sciences";

function rowNames(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector(".major-title")?.textContent ?? "");
}

async function expectCount(text: string) {
  await waitFor(() => expect(screen.getByTestId("result-count")).toHaveTextContent(text));
}

describe("majors page", () => {
  let gateway: FakeGateway;

  beforeEach(() => {
    gateway = new FakeGateway();
    gateway.majors = [
      makeMajor({ id: 1, name: "Computer Science (B.S.)", creditHours: 130 }),
      makeMajor({
        id: 2,
        name: "Film (B.A.)",
        degreeType: "Bachelor of Arts",
        faculty: HUMANITIES,
        department: "Department of the Arts",
        creditHours: 120,
        tuitionTotals: [{ label: "Egyptian students", amount: 84000 }],
      }),
      makeMajor({
        id: 3,
        name: "Music (B.A.)",
        degreeType: "Bachelor of Arts",
        faculty: HUMANITIES,
        department: "Department of the Arts",
        creditHours: 120,
      }),
    ];
    gateway.details.set(2, makeDetail({ id: 2, name: "Film (B.A.)", faculty: HUMANITIES }));
  });

  it("lists the majors with credits and estimated tuition", async () => {
    renderApp(gateway);

    await expectCount("3 majors");
    expect(rowNames()).toEqual(["Computer Science (B.S.)", "Film (B.A.)", "Music (B.A.)"]);

    const film = screen.getByText("Film (B.A.)").closest("tr")!;
    expect(within(film).getByText("Department of the Arts")).toBeInTheDocument();
    expect(within(film).getByText("120")).toBeInTheDocument();
    expect(within(film).getByText("$84,000")).toBeInTheDocument();
  });

  it("names the university and when its data was refreshed", async () => {
    renderApp(gateway);
    expect(await screen.findByText(/Data refreshed/)).toBeInTheDocument();
    expect(screen.getByText(/The American University in Cairo\./)).toBeInTheDocument();
  });

  it("shows a dash instead of values a major doesn't have", async () => {
    gateway.majors = [makeMajor({ id: 1, name: "Middle East Studies (B.A.)", creditHours: null, tuitionTotals: [], tuitionCurrency: null })];
    renderApp(gateway);
    await expectCount("1 major");

    const row = screen.getByText("Middle East Studies (B.A.)").closest("tr")!;
    expect(within(row).getAllByText("—")).toHaveLength(2);
  });

  it("shows prices in E£ for a university that charges in Egyptian pounds, and $ for the rest", async () => {
    const user = userEvent.setup();
    gateway.majors = [
      makeMajor({
        id: 1,
        name: "Pound Priced (B.A.)",
        tuitionCurrency: "EGP",
        tuitionTotals: [{ label: "Egyptian students", amount: 640000 }],
      }),
      makeMajor({ id: 2, name: "Dollar Priced (B.A.)" }),
    ];
    gateway.details.set(
      1,
      makeDetail({
        id: 1,
        name: "Pound Priced (B.A.)",
        tuition: {
          currency: "EGP",
          rates: [{ label: "Egyptian students", amountPerCreditHour: 5000 }],
          estimatedTotals: [{ label: "Egyptian students", amount: 640000 }],
          sourceUrl: "https://example.edu/tuition",
        },
      }),
    );
    renderApp(gateway);
    await expectCount("2 majors");

    expect(within(screen.getByText("Pound Priced (B.A.)").closest("tr")!).getByText("E£640,000")).toBeInTheDocument();
    expect(within(screen.getByText("Dollar Priced (B.A.)").closest("tr")!).getByText("$91,000")).toBeInTheDocument();

    await user.click(screen.getByText("Pound Priced (B.A.)"));
    const dialog = await screen.findByRole("dialog", { name: "Pound Priced (B.A.)" });
    expect(within(dialog).getByText("E£5,000")).toBeInTheDocument();
    expect(within(dialog).getAllByText("E£640,000").length).toBeGreaterThan(1);
    expect(within(dialog).queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("gives every faculty its own colour", async () => {
    renderApp(gateway);
    await expectCount("3 majors");

    const stripeColors = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((row) => (row as HTMLElement).style.getPropertyValue("--c"));
    // two faculties in the data: sciences and humanities, in alphabetical order
    expect(stripeColors).toEqual(["var(--fac-2)", "var(--fac-1)", "var(--fac-1)"]);
  });

  it("searches after typing pauses", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await expectCount("3 majors");

    await user.type(screen.getByLabelText("Search majors"), "film");

    await expectCount("1 major");
    expect(rowNames()).toEqual(["Film (B.A.)"]);
    expect(gateway.majorQueries.at(-1)).toMatchObject({ search: "film" });
    // it didn't fire a request for every keystroke
    expect(gateway.majorQueries.filter((q) => q.search)).toHaveLength(1);
  });

  it("filters by faculty with the chips and toggles back to all", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await expectCount("3 majors");

    const all = screen.getByRole("button", { name: "All faculties" });
    const humanities = screen.getByRole("button", { name: HUMANITIES });
    expect(all).toHaveAttribute("aria-pressed", "true");

    await user.click(humanities);
    await expectCount("2 majors");
    expect(humanities).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");

    await user.click(humanities);
    await expectCount("3 majors");
    expect(all).toHaveAttribute("aria-pressed", "true");
  });

  it("narrows the department options to the chosen faculty", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await expectCount("3 majors");

    const department = screen.getByLabelText("Department");
    expect(within(department).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All departments",
      "Department of Computer Science and Engineering",
      "Department of the Arts",
    ]);

    await user.click(screen.getByRole("button", { name: HUMANITIES }));
    await expectCount("2 majors");
    expect(within(department).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All departments",
      "Department of the Arts",
    ]);
  });

  it("clears the filters", async () => {
    const user = userEvent.setup();
    renderApp(gateway, `/?faculty=${encodeURIComponent(HUMANITIES)}`);
    await expectCount("2 majors");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await expectCount("3 majors");
  });

  it("keeps the clear button disabled while nothing is filtered", async () => {
    renderApp(gateway);
    await expectCount("3 majors");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });

  it("sorts by a column and flips the direction on a second click", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await expectCount("3 majors");

    await user.click(screen.getByRole("button", { name: /Credits/ }));
    expect(rowNames()).toEqual(["Film (B.A.)", "Music (B.A.)", "Computer Science (B.S.)"]);

    await user.click(screen.getByRole("button", { name: /Credits/ }));
    expect(rowNames()[0]).toBe("Computer Science (B.S.)");
    expect(screen.getByRole("columnheader", { name: /Credits/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("opens a major's details and closes them with escape", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await expectCount("3 majors");

    await user.click(screen.getByText("Film (B.A.)"));

    const dialog = await screen.findByRole("dialog", { name: "Film (B.A.)" });
    expect(within(dialog).getByText("A modern education in computer science and engineering.")).toBeInTheDocument();
    expect(within(dialog).getByText("Credit hours")).toBeInTheDocument();
    expect(within(dialog).getByText("Total tuition, Egyptian students")).toBeInTheDocument();
    expect(within(dialog).getByText("Declaration of the Computer Science Major")).toBeInTheDocument();
    expect(within(dialog).getByText("General admission requirements")).toBeInTheDocument();
    expect(within(dialog).getAllByText("$91,000").length).toBeGreaterThan(1);
    expect(within(dialog).getByRole("link", { name: /tuition-and-financial-assistance/ })).toHaveAttribute(
      "href",
      "https://www.aucegypt.edu/admissions/tuition-and-financial-assistance",
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens the first admission section and leaves the others folded", async () => {
    renderApp(gateway, "/?major=2");
    const dialog = await screen.findByRole("dialog", { name: "Film (B.A.)" });

    const sections = dialog.querySelectorAll("details");
    expect(sections).toHaveLength(2);
    expect(sections[0]).toHaveAttribute("open");
    expect(sections[1]).not.toHaveAttribute("open");
  });

  it("opens straight to a major from the url", async () => {
    renderApp(gateway, "/?major=2");
    expect(await screen.findByRole("dialog", { name: "Film (B.A.)" })).toBeInTheDocument();
  });

  it("shows a message inside the drawer when the major can't be loaded", async () => {
    renderApp(gateway, "/?major=404");
    expect(await screen.findByText("major 404 not found")).toBeInTheDocument();
    expect(screen.getByText("Could not load this major.")).toBeInTheDocument();
  });

  it("says when nothing matches and offers to clear the filters", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await expectCount("3 majors");

    await user.type(screen.getByLabelText("Search majors"), "astrophysics");
    expect(await screen.findByText("No majors match these filters")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: "Clear filters" });
    await user.click(buttons[buttons.length - 1]!);
    await expectCount("3 majors");
  });

  it("points at the crawls page when nothing was crawled yet", async () => {
    gateway.majors = [];
    gateway.universities = [makeUniversity({ activeMajors: 0, lastSuccessfulRun: null, lastFinishedRun: null })];
    renderApp(gateway);

    expect(await screen.findByText("Nothing has been crawled yet")).toBeInTheDocument();
    expect(screen.getByText("Not crawled yet", { selector: ".pill" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Crawls" })).toHaveAttribute("href", "/crawls");
  });

  it("shows a loading placeholder first", async () => {
    renderApp(gateway);
    expect(screen.getByRole("status", { name: "Loading majors" })).toBeInTheDocument();
    await expectCount("3 majors");
    expect(screen.queryByRole("status", { name: "Loading majors" })).not.toBeInTheDocument();
  });

  it("shows the error and recovers on retry", async () => {
    const user = userEvent.setup();
    gateway.failWith = new ApiError("Could not reach the server. Is it running?");
    renderApp(gateway);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load majors.");
    expect(alert).toHaveTextContent("Could not reach the server");
    // there is no result to count, so no count is shown
    expect(screen.queryByTestId("result-count")).not.toBeInTheDocument();

    gateway.failWith = null;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await expectCount("3 majors");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets you pick a university when there are several", async () => {
    const user = userEvent.setup();
    gateway.universities = [makeUniversity(), makeUniversity({ id: 2, slug: "guc", name: "German University in Cairo" })];
    renderApp(gateway);
    await expectCount("3 majors");

    await user.selectOptions(screen.getByLabelText("University"), "German University in Cairo");
    await waitFor(() => expect(gateway.majorQueries.at(-1)?.universityId).toBe(2));
  });
});

describe("sidebar", () => {
  it("lists the universities with their majors count and health", async () => {
    const gateway = new FakeGateway();
    gateway.universities = [
      makeUniversity({ activeMajors: 36 }),
      makeUniversity({
        id: 2,
        slug: "b",
        name: "Sample University B",
        activeMajors: 24,
        health: { status: "degraded", reasons: ["2 open gaps"] },
      }),
    ];
    renderApp(gateway);

    const nav = await screen.findByRole("navigation", { name: "Universities" });
    const first = within(nav).getByRole("link", { name: /The American University in Cairo/ });
    const second = within(nav).getByRole("link", { name: /Sample University B/ });

    expect(first).toHaveTextContent("36");
    expect(first).toHaveAttribute("aria-current", "page");
    expect(first).toHaveAttribute("href", "/?u=1");
    expect(second).toHaveTextContent("24");
    expect(second).not.toHaveAttribute("aria-current");
    expect(second).toHaveAttribute("title", "Sample University B: Needs a look");
  });

  it("switches the majors to the university that was clicked", async () => {
    const user = userEvent.setup();
    const gateway = new FakeGateway();
    gateway.universities = [makeUniversity(), makeUniversity({ id: 2, slug: "b", name: "Sample University B" })];
    renderApp(gateway);
    await expectCount("1 major");

    const nav = await screen.findByRole("navigation", { name: "Universities" });
    await user.click(within(nav).getByRole("link", { name: /Sample University B/ }));

    await waitFor(() => expect(gateway.majorQueries.at(-1)?.universityId).toBe(2));
    expect(within(nav).getByRole("link", { name: /Sample University B/ })).toHaveAttribute("aria-current", "page");
  });

  it("shows a page for addresses that don't exist", async () => {
    renderApp(new FakeGateway(), "/nowhere");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Majors" })).toHaveAttribute("href", "/");
  });
});
