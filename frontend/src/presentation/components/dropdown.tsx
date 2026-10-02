import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { IconCheck, IconChevronDown } from "./icons";

export interface DropdownOption {
  value: string;
  label: string;
}

interface Props {
  /** what the control is for, read out by screen readers ("Department") */
  label: string;
  /** the selected option's value. An empty string is the "all" option. */
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}

/**
 * A select that always opens downwards and looks like the rest of the app.
 * The native select picks its own direction and can't be styled, so this is a
 * listbox: the button shows the choice, the list sits right below it.
 */
export function Dropdown({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const id = useId();

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  function openList() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  // clicking anywhere else closes it
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // keep the highlighted option in view when moving with the keyboard
  useEffect(() => {
    if (open) optionRefs.current[active]?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = options.length - 1;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const listId = `${id}-list`;

  return (
    <div className={`dropdown${open ? " open" : ""}`} ref={root}>
      <button
        type="button"
        className="dropdown-trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="dropdown-value">{selected?.label}</span>
        <IconChevronDown className="dropdown-chevron" size={16} />
      </button>

      {open && (
        <ul className="dropdown-panel" id={listId} role="listbox" aria-label={label}>
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                role="option"
                aria-selected={isSelected}
                className={`dropdown-option${index === active ? " active" : ""}${isSelected ? " selected" : ""}`}
                // mousedown instead of click, so the list closes before the button loses focus
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
                onMouseMove={() => setActive(index)}
              >
                <span>{option.label}</span>
                {isSelected && <IconCheck className="dropdown-check" size={16} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
