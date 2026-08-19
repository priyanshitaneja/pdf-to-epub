import { AUTHOR_NAME, REPO_URL, SITE_NAME, SITE_URL, absoluteUrl } from '../content/site.ts';
import { FAQ } from '../content/faq.ts';
import { FEATURES, HOME_DESCRIPTION, HOW_IT_WORKS } from '../content/home.ts';

/** Loose JSON-LD node type. The shape is the schema's business, not TypeScript's. */
export type JsonLd = Record<string, unknown>;

const PERSON: JsonLd = {
  '@type': 'Person',
  name: AUTHOR_NAME,
  url: REPO_URL,
};

/**
 * The tool itself.
 *
 * `WebApplication` rather than `SoftwareApplication` because it runs in a browser with nothing to
 * install. There is deliberately no `aggregateRating`: no real reviews exist, and inventing them
 * is both a structured-data policy violation and grounds for a manual action.
 */
export function webApplicationLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#app`,
    name: SITE_NAME,
    url: SITE_URL,
    description: HOME_DESCRIPTION,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript and a modern browser',
    isAccessibleForFree: true,
    /* Price zero with no `priceValidUntil`, which is how "free, permanently" is expressed. */
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    featureList: FEATURES,
    author: PERSON,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
}

export function webSiteLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: HOME_DESCRIPTION,
    inLanguage: 'en',
    author: PERSON,
  };
}

/**
 * FAQ answers, verbatim from the same source the page renders.
 *
 * Google deprecated FAQ rich results in May 2026, so this produces no visual search feature. It
 * stays because `FAQPage` is still a valid type and is still read when a question is answered from
 * the page rather than shown as a link. Worth the bytes, not worth expecting a rich result from.
 */
export function faqPageLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** Same standing as FAQPage: HowTo rich results were retired in 2023, the type is still parsed. */
export function howToLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to convert a PDF to EPUB for Kindle',
    description: HOME_DESCRIPTION,
    totalTime: 'PT1M',
    /* An explicit zero cost, since "is this going to ask me for a card" is the actual question. */
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
    step: HOW_IT_WORKS.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
      url: `${SITE_URL}/#step-${i + 1}`,
    })),
  };
}

export function articleLd(input: {
  path: string;
  title: string;
  description: string;
  datePublished: string;
}): JsonLd {
  const url = absoluteUrl(input.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: input.title,
    description: input.description,
    url,
    datePublished: input.datePublished,
    dateModified: input.datePublished,
    author: PERSON,
    publisher: PERSON,
    inLanguage: 'en',
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
}

export function breadcrumbLd(trail: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Serialise for embedding in a script tag.
 *
 * `<` is escaped so a value containing `</script>` cannot terminate the block early. This is the
 * one genuine injection risk in a JSON-LD payload.
 */
export function renderJsonLd(blocks: JsonLd[]): string {
  return blocks
    .map((block) => {
      const json = JSON.stringify(block, null, 2).replace(/</g, '\\u003c');
      return `    <script type="application/ld+json">\n${json}\n    </script>`;
    })
    .join('\n');
}
