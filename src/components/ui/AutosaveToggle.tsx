"use client";

/**
 * Autosave switch (PRD §27a).
 *
 * A real checkbox next to the One Page toggle, styled by the same
 * `.header-toggle` rule so the two read as one group. The label is the
 * clickable target and the input carries the accessible name.
 */
export function AutosaveToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="header-toggle" htmlFor="autosave-toggle">
      <input
        id="autosave-toggle"
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>Autosave</span>
    </label>
  );
}
