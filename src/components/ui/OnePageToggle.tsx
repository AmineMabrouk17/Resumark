"use client";

/**
 * One Page toggle (PRD §12). A real checkbox: keyboard operable, announced by
 * assistive technology, and the label is the clickable target.
 */
export function OnePageToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="header-toggle" htmlFor="one-page-toggle">
      <input
        id="one-page-toggle"
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>One Page</span>
    </label>
  );
}
