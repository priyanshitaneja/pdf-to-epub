import { COMPARISON } from '../content/home.ts';
import { Section } from './Section.tsx';

/**
 * Against the general shape of an upload-based converter, not any named product, and hedged where
 * the practice varies. Naming competitors would date badly and invites an argument about a specific
 * product's current behaviour rather than the structural difference, which is the first row.
 */
export function Comparison({ index }: { index: number }) {
  return (
    <Section id="comparison" heading="Compared with upload-based converters" index={index}>
      {/* Wide content scrolls in its own container so the page body never scrolls sideways. */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-line border-b">
              <th scope="col" className="text-ink-muted py-2.5 pr-4 font-normal">
                &nbsp;
              </th>
              <th scope="col" className="text-ink py-2.5 pr-4 font-normal">
                This converter
              </th>
              <th scope="col" className="text-ink-muted py-2.5 font-normal">
                Typical upload-based converter
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.aspect} className="border-line border-b align-top last:border-0">
                <th scope="row" className="text-ink-soft py-3 pr-4 font-normal">
                  {row.aspect}
                </th>
                <td className="text-ink py-3 pr-4">{row.here}</td>
                <td className="text-ink-muted py-3">{row.elsewhere}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
