"use client";

import type { SaveStatus } from "@/hooks/useResumeState";
import type { ResumeState, ResumeTemplate } from "@/types/resume";
import { AutosaveToggle } from "@/components/ui/AutosaveToggle";
import { ExportButton } from "@/components/ui/ExportButton";
import { OnePageToggle } from "@/components/ui/OnePageToggle";
import { ResetButton } from "@/components/ui/ResetButton";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import { TemplateSwitcher } from "@/components/ui/TemplateSwitcher";

export type HeaderProps = {
  state: Pick<ResumeState, "template" | "onePage" | "markdown">;
  status: SaveStatus;
  autosave: boolean;
  exportError: string | null;
  onTemplateChange: (template: ResumeTemplate) => void;
  onOnePageChange: (onePage: boolean) => void;
  onAutosaveChange: (autosave: boolean) => void;
  onExport: (error: string | null) => void;
  onReset: () => void;
};

/** Application chrome (PRD §21). Everything here is `no-print`. */
export function Header({
  state,
  status,
  autosave,
  exportError,
  onTemplateChange,
  onOnePageChange,
  onAutosaveChange,
  onExport,
  onReset,
}: HeaderProps) {
  return (
    <header className="app-header no-print">
      <div className="app-header__brand">
        <span className="app-header__wordmark">Resumark</span>
        <span className="app-header__tagline">Markdown → A4 resume</span>
      </div>

      <div className="app-header__controls">
        <TemplateSwitcher value={state.template} onChange={onTemplateChange} />
        <OnePageToggle value={state.onePage} onChange={onOnePageChange} />
        <AutosaveToggle value={autosave} onChange={onAutosaveChange} />
        <SaveIndicator status={status} autosave={autosave} />
        <ResetButton onReset={onReset} />
        <ExportButton markdown={state.markdown} onResult={onExport} />
      </div>

      {exportError ? (
        <p className="header-alert" role="alert">
          {exportError}
        </p>
      ) : null}

      {/*
       * Stated in full rather than left to a tooltip, because autosave off means
       * a reload destroys the session (PRD §27a) and a `title` is invisible to
       * keyboard users, to touch users and to anyone who simply looks away.
       */}
      {!autosave ? (
        <p className="header-alert header-alert--warn">
          Autosave is off — nothing is being saved to this browser, so reloading
          or closing the tab will discard your changes. Copy your Markdown out or
          turn Autosave back on. Export PDF still works.
        </p>
      ) : null}
    </header>
  );
}
