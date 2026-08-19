import { MAX_FILE_MB } from './site.ts';

export interface FaqItem {
  q: string;
  /** Plain text. Rendered as a paragraph and reused verbatim in FAQPage structured data. */
  a: string;
}

/**
 * Answers a person actually needs, ordered by how often they are the reason someone arrived.
 *
 * Two rules for anything added here. Every answer has to be true of the shipped build, because an
 * answer engine will quote it back to someone as fact. And no answer promises OCR or image
 * extraction, neither of which exists yet.
 */
export const FAQ: FaqItem[] = [
  {
    q: 'Is it really free?',
    a: 'Yes, and permanently. There are no ads, no accounts, no upload limits behind a paywall, no watermark on the result, and no payment step when you download. There is no paid tier to upsell you to, because there is no server to pay for.',
  },
  {
    q: 'Does my PDF get uploaded anywhere?',
    a: 'No. The conversion runs inside your browser tab, on your own machine. There is no server, no API and no storage bucket. Your file never leaves your device, so there is nothing for anyone to leak, sell or subpoena.',
  },
  {
    q: 'Why does my Kindle show a grey placeholder instead of my cover?',
    a: 'Kindle finds a cover through an older EPUB 2 declaration, a meta element named cover in the package file. Most converters write only the newer EPUB 3 declaration, so the image sits inside the file, correctly listed, and Kindle never looks at it. This converter writes both, then reopens the finished file to confirm the cover is really there.',
  },
  {
    q: 'Can I use my own cover image?',
    a: `Yes. You can upload a JPEG, PNG or WebP and it becomes the cover, replacing the page rendered from the PDF. Amazon recommends 1600 by 2560 pixels. Smaller images still work, and anything unusually proportioned is flagged rather than cropped, because cropping someone else's artwork is not a decision a converter should make.`,
  },
  {
    q: 'Can I change the title, author and filename?',
    a: 'Yes, all three, before you download. The title and author are what your Kindle library displays, and PDFs routinely carry titles like "Microsoft Word - final_v3.docx", so they are a first-class panel rather than an advanced option. The download filename is editable in place too.',
  },
  {
    q: 'How big a file can I convert?',
    a: `Up to ${MAX_FILE_MB} MB. The limit exists because the whole document is held in memory in your browser rather than streamed through a server.`,
  },
  {
    q: 'Does it work on scanned PDFs?',
    a: 'Not yet. The converter reads the text layer that a PDF carries, so a scan with no text layer produces an empty book. If you can select and copy text in your PDF reader, it will convert. If you cannot, it needs OCR first, which this tool does not do.',
  },
  {
    q: 'Do images and figures come across?',
    a: 'Not yet. The current version converts text, headings, chapter structure and the cover. Embedded figures are not extracted, so an illustrated textbook is not a good fit today. A text-led book, report or roadmap is.',
  },
  {
    q: 'How do I get the EPUB onto my Kindle?',
    a: `Use Send to Kindle, either Amazon's Send to Kindle page, the desktop app, or by emailing the file to your device address. Amazon accepts EPUB directly now and converts it on their side. You can also copy the file over USB.`,
  },
  {
    q: 'Why convert at all, instead of emailing the PDF to my Kindle?',
    a: 'A PDF has a fixed page size, so a Kindle either shows a whole shrunken page or makes you pan around one. EPUB reflows, which means your font size, margins and line spacing work, along with highlights and dictionary lookups. That is the actual difference.',
  },
  {
    q: 'Are chapters and the table of contents preserved?',
    a: 'Yes, where the PDF has real heading structure to read. Headings are detected from font size and weight, then used to split the book into chapters and build both a navigation document and the older NCX index, so the Kindle menu jumps to chapters rather than page numbers.',
  },
  {
    q: 'How do I know the EPUB is not broken?',
    a: 'Every file is reopened and checked before you download it, against roughly forty structural checks covering the cover declarations, the spine, the navigation document and the metadata. If a problem would break the book on a Kindle, the download is blocked and the reason is shown rather than handing you a file that fails silently.',
  },
];
