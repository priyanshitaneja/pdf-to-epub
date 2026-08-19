/**
 * The mount point for the interactive converter.
 *
 * The skeleton inside is not a loading state for its own sake. It is what a crawler that does not
 * run JavaScript reads in place of the widget, so it describes the control rather than drawing a
 * grey box. React replaces the children wholesale on mount, so nothing here needs to match what
 * renders afterwards.
 */
export function ConverterSlot() {
  return (
    <div id="converter-root">
      <div className="border-line text-ink-muted flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-14 text-center">
        <p className="text-sm">Drop a PDF here, or click to browse.</p>
        <p className="text-xs">
          Converted in this tab. Your file is never uploaded. Requires JavaScript.
        </p>
      </div>
    </div>
  );
}
