import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dropdown } from "./dropdown";

const OPTIONS = [
  { value: "", label: "All departments" },
  { value: "arts", label: "Department of the Arts" },
  { value: "cs", label: "Department of Computer Science" },
];

function Harness({ onChange = () => {} }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <>
      <Dropdown
        label="Department"
        value={value}
        options={OPTIONS}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
      <button type="button">outside</button>
    </>
  );
}

const trigger = () => screen.getByRole("combobox", { name: "Department" });

describe("Dropdown", () => {
  it("shows the current choice and keeps the list closed", () => {
    render(<Harness />);
    expect(trigger()).toHaveTextContent("All departments");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens the list below the button, in the same container", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());

    const list = screen.getByRole("listbox", { name: "Department" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    // the list is a child of the dropdown, which the stylesheet pins to the bottom edge of the button
    expect(trigger().parentElement).toContainElement(list);
    expect(list).toHaveClass("dropdown-panel");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "All departments" })).toHaveAttribute("aria-selected", "true");
  });

  it("selects with a click and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Department of the Arts" }));

    expect(onChange).toHaveBeenCalledWith("arts");
    expect(trigger()).toHaveTextContent("Department of the Arts");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("works from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    trigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(trigger()).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-2"));
    await user.keyboard("{ArrowDown}"); // already on the last one
    expect(trigger()).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-2"));

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("cs");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("jumps with Home and End and picks with space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    trigger().focus();
    await user.keyboard("{Enter}{End}");
    expect(trigger()).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-2"));
    await user.keyboard("{Home} ");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("starts on the current choice when it is opened again", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Department of Computer Science" }));

    await user.click(trigger());
    expect(trigger()).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-2"));
    expect(screen.getByRole("option", { name: "Department of Computer Science" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("closes on escape without changing anything", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveFocus();
  });

  it("closes when you click somewhere else", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes when the button is clicked again", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(trigger());
    await user.click(trigger());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("falls back to the first option when the value isn't in the list", () => {
    render(<Dropdown label="Department" value="gone" options={OPTIONS} onChange={() => {}} />);
    expect(trigger()).toHaveTextContent("All departments");
  });
});
