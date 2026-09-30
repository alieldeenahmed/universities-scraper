import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../../application/ports";
import { makeDetail, makeMajor, makeUniversity } from "../../test-support/builders";
import { FakeGateway } from "../../test-support/fake-gateway";
import { renderApp } from "../../test-support/render";

function rowNames(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]!.textContent ?? "");
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
        faculty: "School of Humanities and Social Sciences",
        department: "Department of the Arts",
        creditHours: 120,
        tuitionTotals: [{ label: "Egyptian students", amount: 84000 }],
      }),
      makeMajor({
        id: 3,
        name: "Music (B.A.)",
        degreeType: "Bachelor of Arts",
        faculty: "School of Humanities and Social Sciences",
        department: "Department of the Arts",
        creditHours: 120,
      }),
    ];
    gateway.details.set(2, makeDetail({ id: 2, name: "Film (B.A.)", faculty: "School of Humanities and Social Sciences" }));
  });

  it("lists the majors with credits and estimated tuition", async () => {
    renderApp(gateway);

    expect(await screen.findByText("3 majors")).toBeInTheDocument();
    expect(rowNames()).toEqual(["Computer Science (B.S.)", "Film (B.A.)", "Music (B.A.)"]);

    const film = screen.getByText("Film (B.A.)").closest("tr")!;
    expect(within(film).getByText("120")).toBeInTheDocument();
    expect(within(film).getByText("$84,000")).toBeInTheDocument();
  });

  it("searches after typing pauses", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await screen.findByText("3 majors");

    await user.type(screen.getByLabelText("Search majors"), "film");

    await screen.findByText("1 major");
    expect(rowNames()).toEqual(["Film (B.A.)"]);
    expect(gateway.majorQueries.at(-1)).toMatchObject({ search: "film" });
    // it didn't fire a request for every keystroke
    expect(gateway.majorQueries.filter((q) => q.search)).toHaveLength(1);
  });

  it("narrows the department options to the chosen faculty", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await screen.findByText("3 majors");

    const department = screen.getByLabelText("Department");
    expect(within(department).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All departments",
      "Department of Computer Science and Engineering",
      "Department of the Arts",
    ]);

    await user.selectOptions(screen.getByLabelText("Faculty"), "School of Humanities and Social Sciences");
    await screen.findByText("2 majors");
    expect(within(department).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All departments",
      "Department of the Arts",
    ]);
  });

  it("clears the filters", async () => {
    const user = userEvent.setup();
    renderApp(gateway, "/?faculty=School+of+Humanities+and+Social+Sciences");
    await screen.findByText("2 majors");

    await user.click(screen.getByRole("button", { name: "Clear" }));
    await screen.findByText("3 majors");
  });

  it("sorts by a column and flips the direction on a second click", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await screen.findByText("3 majors");

    await user.click(screen.getByRole("button", { name: /Credits/ }));
    expect(rowNames()).toEqual(["Film (B.A.)", "Music (B.A.)", "Computer Science (B.S.)"]);

    await user.click(screen.getByRole("button", { name: /Credits/ }));
    expect(rowNames()[0]).toBe("Computer Science (B.S.)");
    expect(screen.getByRole("columnheader", { name: /Credits/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("opens a major's details and closes them with escape", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await screen.findByText("3 majors");

    await user.click(screen.getByText("Film (B.A.)"));

    const dialog = await screen.findByRole("dialog", { name: "Film (B.A.)" });
    expect(within(dialog).getByText("A modern education in computer science and engineering.")).toBeInTheDocument();
    expect(within(dialog).getByText("Declaration of the Computer Science Major")).toBeInTheDocument();
    expect(within(dialog).getByText("General admission requirements")).toBeInTheDocument();
    expect(within(dialog).getAllByText("$91,000").length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("link", { name: /tuition-and-financial-assistance/ })).toHaveAttribute(
      "href",
      "https://www.aucegypt.edu/admissions/tuition-and-financial-assistance",
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens straight to a major from the url", async () => {
    renderApp(gateway, "/?major=2");
    expect(await screen.findByRole("dialog", { name: "Film (B.A.)" })).toBeInTheDocument();
  });

  it("shows a message inside the drawer when the major can't be loaded", async () => {
    renderApp(gateway, "/?major=404");
    expect(await screen.findByText("major 404 not found")).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    renderApp(gateway);
    await screen.findByText("3 majors");

    await user.type(screen.getByLabelText("Search majors"), "astrophysics");
    expect(await screen.findByText("No majors match these filters")).toBeInTheDocument();
  });

  it("points at the crawls page when nothing was crawled yet", async () => {
    gateway.majors = [];
    gateway.universities = [makeUniversity({ activeMajors: 0, lastSuccessfulRun: null, lastFinishedRun: null })];
    renderApp(gateway);

    expect(await screen.findByText("Nothing has been crawled yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crawls page" })).toHaveAttribute("href", "/crawls");
  });

  it("shows the error and recovers on retry", async () => {
    const user = userEvent.setup();
    gateway.failWith = new ApiError("Could not reach the server. Is it running?");
    renderApp(gateway);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server");

    gateway.failWith = null;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("3 majors");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets you pick a university when there are several", async () => {
    const user = userEvent.setup();
    gateway.universities = [makeUniversity(), makeUniversity({ id: 2, slug: "guc", name: "German University in Cairo" })];
    renderApp(gateway);
    await screen.findByText("3 majors");

    await user.selectOptions(screen.getByLabelText("University"), "German University in Cairo");
    await waitFor(() => expect(gateway.majorQueries.at(-1)?.universityId).toBe(2));
  });
});
