export interface GuideSection {
  heading: string;
  paragraphs: string[];
  /** Rendered as a bulleted list after the paragraphs. */
  list?: string[];
  /** Prose after the list, for when the list is an aside rather than the conclusion. */
  after?: string[];
}

export interface Guide {
  /** Route path, leading slash, no trailing slash. */
  path: string;
  /** Browser and search result title. */
  title: string;
  /** The single h1, which may differ from the title tag. */
  h1: string;
  description: string;
  /** ISO date, used for Article structured data and the sitemap. */
  datePublished: string;
  /** Standfirst paragraphs, before the first subheading. */
  intro: string[];
  sections: GuideSection[];
}

/**
 * Three guides, each earning its own page.
 *
 * Deliberately not one page per keyword variant. Near-duplicate pages built to catch minor phrasing
 * differences are what doorway-page and unhelpful-content signals exist to catch, and they would
 * also make the site worse to read. Each of these answers a different question.
 */
export const GUIDES: Guide[] = [
  {
    path: '/kindle-epub-cover-not-showing',
    title: 'Kindle EPUB cover not showing: why it happens and how to fix it',
    h1: 'Your EPUB cover is not showing on Kindle',
    description:
      'A Kindle shows a grey placeholder instead of your cover because it reads the older EPUB 2 cover declaration, which most converters never write. Here is the mechanism and the fix.',
    datePublished: '2026-08-19',
    intro: [
      'You converted a PDF, sent the EPUB to your Kindle, and the library shows a grey rectangle with a filename across it. Open the book and the cover page is there. Close it and the thumbnail is still grey.',
      'This is almost never a corrupted file, and it is almost never Amazon being slow to refresh. It is a specific, boring metadata problem, and once you know what it is you can check for it in about a minute.',
    ],
    sections: [
      {
        heading: 'An EPUB declares its cover twice',
        paragraphs: [
          'Inside every EPUB is a package file, usually called content.opf, which lists every file in the book and describes what each one is. A cover image has to be pointed at from that package file, otherwise a reader has no way to know which of the images is the cover.',
          'There are two ways to do the pointing, from two different versions of the standard. EPUB 3, the current one, marks the image in the manifest with a properties attribute set to cover-image. EPUB 2, the older one, adds a separate meta element named cover whose content attribute holds the id of that image.',
          'Both are valid. Neither replaced the other in practice. And crucially, different reading systems look for different ones.',
        ],
      },
      {
        heading: 'Kindle reads the old one',
        paragraphs: [
          'Amazon reads the EPUB 2 meta element. If your file has only the EPUB 3 declaration, Kindle finds no cover and falls back to generating a placeholder from the filename.',
          'This is why the problem is so confusing to diagnose. The file is not broken. It will pass an EPUB validator. The image is present, at full quality, correctly listed in the manifest, and it renders when you open the book, because the first page of the book is a real page containing the image. The only thing missing is a single line of metadata telling Kindle which image is the cover.',
          'Most converters write one declaration, not both. If a tool was built against the EPUB 3 specification, writing the modern attribute and stopping is the reasonable thing to have done.',
        ],
      },
      {
        heading: 'How to check your file',
        paragraphs: [
          'An EPUB is a zip archive, so you can inspect it without any special software. Copy the file, change the extension from .epub to .zip, and unzip it. Find content.opf, usually inside an OEBPS or EPUB folder, and open it in a text editor.',
          'Search for the word cover. You are looking for two things:',
        ],
        list: [
          'A manifest item for your image with properties="cover-image" on it. This is the EPUB 3 declaration.',
          'A meta element in the metadata block, name="cover", whose content value matches the id of that manifest item. This is the EPUB 2 declaration Kindle needs.',
          'The meta element must not be namespaced. A dc:cover or opf:cover will not be read.',
        ],
      },
      {
        heading: 'Fixing it',
        paragraphs: [
          'If you are comfortable editing the package file, add the missing meta element inside the metadata block, with its content attribute set to the id of your cover image, then rezip the archive. The mimetype file has to be stored uncompressed and first in the archive, which is the part people usually get wrong when rezipping by hand.',
          'Calibre can also repair this. Open the book in its editor, then use the Tools menu to set the cover, which rewrites both declarations.',
          'Or convert the PDF with a tool that writes both declarations in the first place. That is what this site does, and it then reopens the finished file to confirm the cover is present, decodable and large enough before the download is offered. If a cover problem would break the book, the download is blocked and the reason is shown, because a file that fails silently on your device is worse than no file.',
        ],
      },
      {
        heading: 'Two other things that cause a grey thumbnail',
        paragraphs: [
          'If both declarations are present and you still see a placeholder, check the image size. Amazon flags covers under 1000 pixels on the long edge as low resolution, and very small images can be rejected outright. The recommended size is 1600 by 2560 pixels.',
          'Also check that the cover page is the first item in the spine, which is the reading order. Some devices take the first page of the book as the thumbnail regardless of the metadata, so a cover that sits second will not be used even when it is declared correctly.',
        ],
      },
    ],
  },
  {
    path: '/send-epub-to-kindle',
    title: 'How to send an EPUB to your Kindle: every method that works',
    h1: 'Getting an EPUB onto your Kindle',
    description:
      'Amazon accepts EPUB directly and no longer takes MOBI. Here are the four ways to get a converted book onto a Kindle, and which one to use when.',
    datePublished: '2026-08-19',
    intro: [
      'Amazon accepts EPUB files directly now. It converts them to its own internal format on their side, which means you no longer need to produce a MOBI, and in fact you cannot: Amazon stopped accepting MOBI for personal documents in 2022.',
      'There are four routes onto the device. They differ in effort, in whether the book syncs across your devices, and in whether Amazon keeps a copy.',
    ],
    sections: [
      {
        heading: 'The web uploader',
        paragraphs: [
          'The simplest method, and the one to use if you are doing this once. Open the Send to Kindle page in a browser, sign in with the account your Kindle is registered to, and drop the EPUB in. Pick the destination device and it arrives in a minute or two.',
          'The address is your own Amazon domain followed by /sendtokindle, so which one you want depends on the marketplace your account belongs to:',
        ],
        list: [
          'India: amazon.in/sendtokindle',
          'United States: amazon.com/sendtokindle',
          'United Kingdom: amazon.co.uk/sendtokindle',
          'Germany: amazon.de/sendtokindle, and the same pattern for every other marketplace.',
        ],
        after: [
          'If the page loads but the device list is empty, you are almost certainly signed in to a different marketplace from the one your Kindle is registered to. Accounts are per-marketplace, and the uploader only shows devices belonging to the account you are signed in as.',
          'The book goes into your Kindle library and syncs across devices, including reading position and highlights. Amazon stores a copy in your account, which is a convenience or a privacy consideration depending on what you are reading.',
        ],
      },
      {
        heading: 'Email to your device address',
        paragraphs: [
          'Every Kindle has an email address ending in kindle.com. You can find it under Manage Your Content and Devices, in the Preferences or Devices section of your Amazon account.',
          'Two rules trip people up. The sending address has to be on your Approved Personal Document Email List, in the same settings area, or Amazon silently discards the message. And attachments have a size limit, so a large illustrated book may bounce.',
          'The subject line does not need to say anything, though writing Convert in it used to force a format conversion. That is no longer needed for EPUB.',
        ],
      },
      {
        heading: 'The desktop and mobile apps',
        paragraphs: [
          'Send to Kindle exists as a desktop application for Windows and macOS, and on phones you can share a file to the Kindle app. Both are worth installing if you sideload regularly, because they add a right-click or share-sheet route and remove the sign-in step.',
          'On a Mac you can also drag files onto the Send to Kindle app icon.',
        ],
      },
      {
        heading: 'USB, and when to prefer it',
        paragraphs: [
          'Connect the Kindle by cable, and it mounts as a drive. Copy the EPUB into the documents folder, eject, and it appears on the device.',
          'This is the one method where the file never touches Amazon. Nothing is uploaded, nothing is stored in your account, and nothing syncs. If you converted a document precisely because you did not want it leaving your machine, sending it to Amazon afterwards rather defeats the exercise, and USB is the consistent choice.',
          'The tradeoff is real though: no cross-device sync, no cloud backup, and the book is gone if you reset the device.',
        ],
      },
      {
        heading: 'If the book arrives looking wrong',
        paragraphs: [
          'A book that arrives with no cover thumbnail has a metadata problem rather than a transfer problem, and it is worth reading about the cover declaration separately.',
          'A book with no working table of contents was converted from a PDF with no real heading structure to read. Nothing on the Kindle side can recover chapter boundaries that were never marked.',
          'A book where every paragraph runs together, or where words are split oddly, came out of a PDF whose text layer is positioned glyph by glyph. That is a conversion quality problem, and the fix is at the conversion step, not the transfer step.',
        ],
      },
    ],
  },
  {
    path: '/pdf-vs-epub',
    title: 'PDF vs EPUB: which one to read on, and what conversion costs you',
    h1: 'PDF vs EPUB',
    description:
      'A PDF has fixed pages, an EPUB reflows. That single difference decides which is better for reading on a small screen, and what you give up by converting.',
    datePublished: '2026-08-19',
    intro: [
      'A PDF is a description of pages. An EPUB is a description of text. Almost every practical difference between them follows from that, including why a PDF is miserable on a six inch screen and why converting one is not lossless.',
    ],
    sections: [
      {
        heading: 'Fixed layout against reflowable text',
        paragraphs: [
          'A PDF fixes the position of every character on a page of a specific size. That is the point of the format: a page designed for A4 looks identical on any screen, on any printer, forever. To achieve it, the file stores coordinates rather than sentences.',
          'An EPUB stores the text and its structure, and lets the reading device decide where lines break. That is why font size, margins, line spacing and typeface are yours to change in an EPUB and not in a PDF.',
          'On a large screen the difference barely matters. On a phone or an e-reader, a fixed A4 page has to be either shrunk until the text is too small to read, or shown at readable size with panning. Neither is reading.',
        ],
      },
      {
        heading: 'What you gain by converting',
        paragraphs: [
          'Reflowing is the main thing, but several features on an e-reader only work on real text:',
        ],
        list: [
          'Adjustable font size, typeface, margins and line spacing.',
          'Dictionary lookup and translation by tapping a word.',
          'Highlights and notes that survive a font size change, because they attach to text rather than to a screen position.',
          'Search across the book that returns text rather than page images.',
          'Text to speech, and the accessibility features that depend on a readable text layer.',
          'A table of contents the device menu can jump through.',
        ],
      },
      {
        heading: 'What conversion costs you',
        paragraphs: [
          'Converting is a genuine loss of information, and it is worth being clear about what goes:',
        ],
        list: [
          'Exact layout. Multi-column pages, sidebars, pull quotes and anything positioned relative to a page edge become a single flowing column.',
          'Page numbers. An EPUB has no fixed pages, so a citation to page 74 no longer has a target. This matters for anything you need to reference academically.',
          'Complex tables. A wide table that fit a landscape page rarely survives a narrow reflowed column intact.',
          'Equations and diagrams that were drawn as vector page content rather than embedded as images.',
          'Typography that was set by hand: kerning, deliberate line breaks in poetry, and hyphenation decisions.',
        ],
      },
      {
        heading: 'So which should you convert',
        paragraphs: [
          'Convert text-led documents: reports, long articles, roadmaps, novels, non-fiction without heavy figures, anything you intend to read straight through on a small screen.',
          'Keep the PDF for reference material, anything with a layout that carries meaning, textbooks with figures and equations, sheet music, and anything you will cite by page number.',
          'For a scanned document, neither format helps until the pages have been run through optical character recognition, because there is no text to reflow. A scan is a stack of images that happens to be shaped like a book.',
        ],
      },
      {
        heading: 'A note on quality',
        paragraphs: [
          'Not all conversions are equal, and the difference is in how the tool reads the PDF. Text in a PDF is often positioned glyph by glyph with no notion of words, lines or paragraphs. A conversion that takes those glyphs literally produces text with words run together, lines broken mid-sentence, and no paragraph structure at all.',
          'Doing better means reconstructing lines from glyph positions, inferring word boundaries from spacing, joining lines into paragraphs, detecting headings from font size and weight, and dropping running headers and footers that repeat on every page. That reconstruction is the actual work of a PDF to EPUB converter, and it is where they differ most.',
        ],
      },
    ],
  },
];
