import { MAX_FILE_MB } from './site.ts';

/** The one-sentence description reused in meta description, Open Graph and structured data. */
export const HOME_DESCRIPTION =
  'Convert PDF to EPUB in your browser, with a cover your Kindle will actually display. Nothing is uploaded, nothing is stored, and there is no payment at any point.';

export const HERO_TAGLINE =
  'Kindle finds a cover through a declaration most converters forget to write, so the book arrives as a grey placeholder. This one writes it, then checks the file before handing it over.';

export interface HowToStep {
  name: string;
  text: string;
}

/** Three steps, because that is genuinely how many there are. Reused as HowTo structured data. */
export const HOW_IT_WORKS: HowToStep[] = [
  {
    name: 'Drop in your PDF',
    text: `Choose a file up to ${MAX_FILE_MB} MB. It is read inside the browser tab, so nothing is uploaded and there is no queue to wait in.`,
  },
  {
    name: 'Check the cover and the details',
    text: 'A cover is taken from the first page of the PDF, or you can upload your own image. The title, author and language are what your Kindle library will show, so they are editable before you commit.',
  },
  {
    name: 'Download the EPUB',
    text: 'The finished file is reopened and checked before the download appears. Then send it to your Kindle with Send to Kindle, or copy it across over USB.',
  },
];

/**
 * The pricing section, written as a list of things that do not happen.
 *
 * Negative claims are specific and checkable, which makes them quotable. "Free" on its own is what
 * every converter with a paid tier also says, so it carries no information.
 */
export const COSTS: string[] = [
  'Free forever, not free for a trial period.',
  'No ads, anywhere on the page.',
  'No account, no email address, no sign-up.',
  'No payment step when you download, or at any other point.',
  'No watermark on the file you get back.',
  'No paid tier, because there is no server bill to cover.',
];

export interface ComparisonRow {
  aspect: string;
  here: string;
  elsewhere: string;
}

/**
 * Against the general shape of an upload-based converter rather than any named product, and hedged
 * where the practice varies. The honest axis is the first row; everything else follows from it.
 */
export const COMPARISON: ComparisonRow[] = [
  {
    aspect: 'Where your file goes',
    here: 'Stays in the browser tab, on your machine',
    elsewhere: 'Uploaded to a server you do not control',
  },
  {
    aspect: 'Cover on a Kindle',
    here: 'Both the EPUB 2 and EPUB 3 declarations are written, then verified',
    elsewhere: 'Often EPUB 3 only, so Kindle shows a grey placeholder',
  },
  {
    aspect: 'Your own cover image',
    here: 'Upload a JPEG, PNG or WebP',
    elsewhere: 'Usually not offered',
  },
  {
    aspect: 'Output checked before you get it',
    here: 'Around forty structural checks, and the download is blocked if the book would break',
    elsewhere: 'Typically returned unchecked',
  },
  {
    aspect: 'Cost',
    here: 'Free, with nothing held back',
    elsewhere: 'Commonly a free tier with size or daily limits, then a subscription',
  },
  {
    aspect: 'File retention',
    here: 'Nothing is stored, because nothing was sent',
    elsewhere: 'Held on their servers, usually deleted on a timer',
  },
];

/** Short capability statements for structured data. Present tense, no marketing adjectives. */
export const FEATURES: string[] = [
  'Converts PDF to reflowable EPUB entirely in the browser',
  'Writes both the EPUB 2 and EPUB 3 cover declarations, so Kindle shows the cover',
  'Upload your own cover image, or use a page rendered from the PDF',
  'Detects chapters from heading structure',
  'Builds both a navigation document and an NCX index',
  'Editable title, author, language and download filename',
  'Validates the finished EPUB and blocks a download that would break',
  `Handles files up to ${MAX_FILE_MB} MB`,
  'No upload, no account, and no payment',
];
