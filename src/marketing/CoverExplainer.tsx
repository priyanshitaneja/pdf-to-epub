import { Section } from './Section.tsx';

/**
 * The mechanism, spelled out.
 *
 * This is the section the whole site is built around. It is the honest answer to the question
 * people are actually searching, it is the one thing this converter does that the large upload
 * based services do not, and a specific mechanism is what gets quoted when something summarises
 * the page. Vague differentiators do not survive summarisation.
 */
export function CoverExplainer({ index }: { index: number }) {
  return (
    <Section id="why-covers-break" heading="Why Kindle shows a grey placeholder" index={index}>
      <p>
        An EPUB can declare its cover twice. The modern EPUB 3 way marks the image in the manifest
        with a <code className="font-mono text-sm">properties="cover-image"</code> attribute. The
        older EPUB 2 way adds a{' '}
        <code className="font-mono text-sm">&lt;meta name="cover" /&gt;</code> element pointing at
        that image by id.
      </p>
      <p>
        Kindle reads the older one. A converter that writes only the EPUB 3 declaration produces a
        file that is technically correct, passes validation, contains your cover image at full
        quality, and still shows up in your library as a grey rectangle with a filename on it. The
        image is in there. Nothing is looking for it.
      </p>
      <p>
        This converter writes both declarations, puts the cover first in the reading order, adds the
        legacy guide reference that older devices use, and then reopens the finished file to confirm
        the image is present, decodable, and large enough. If any of that fails, the download is
        blocked and you are told which part broke, rather than finding out when the book lands on
        your device.
      </p>
    </Section>
  );
}
