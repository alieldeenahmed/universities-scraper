import type { CSSProperties } from "react";

export type MarkerShape = "dot" | "square" | "diamond" | "ring";

interface Props {
  shape: MarkerShape;
  /** any css colour. Leave out to inherit the text colour. */
  color?: string;
}

/** A small coloured shape. The shape says the same thing as the colour, for people who can't tell the colours apart. */
export function Marker({ shape, color }: Props) {
  const style: CSSProperties | undefined = color ? { color } : undefined;
  return <span className={`marker ${shape}`} style={style} aria-hidden="true" />;
}
