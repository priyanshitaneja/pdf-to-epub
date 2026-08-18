import type { Block, ListBlock, TableBlock, TableRow } from '../../types/document.ts';
import { serializeInlines, type InlineContext } from './inline.ts';
import { attrString, voidTag, xmlText } from './xml.ts';

export interface BlockContext extends InlineContext {
  /** Anchor id to emit on a heading, so the TOC can target it. */
  headingId(anchor: string): string;
}

export function serializeBlocks(blocks: Block[], ctx: BlockContext, indent = ''): string {
  return blocks
    .map((block) => serializeBlock(block, ctx, indent))
    .filter((s) => s.length > 0)
    .join('\n');
}

function serializeBlock(block: Block, ctx: BlockContext, indent: string): string {
  switch (block.kind) {
    case 'h': {
      const tag = `h${block.level}`;
      const id = ctx.headingId(block.anchor);
      return `${indent}<${tag}${attrString({ id })}>${serializeInlines(block.inlines, ctx)}</${tag}>`;
    }

    case 'p': {
      const content = serializeInlines(block.inlines, ctx);
      if (content.trim().length === 0) return '';
      const cls = block.align && block.align !== 'left' ? `align-${block.align}` : undefined;
      return `${indent}<p${attrString({ class: cls })}>${content}</p>`;
    }

    case 'list':
      return serializeList(block, ctx, indent);

    case 'table':
      return serializeTable(block, ctx, indent);

    case 'figure': {
      const href = ctx.assetHref(block.assetId);
      if (!href) return '';
      const img = voidTag('img', { src: href, alt: block.alt });
      const caption = block.caption
        ? `\n${indent}  <figcaption>${serializeInlines(block.caption, ctx)}</figcaption>`
        : '';
      return `${indent}<figure>\n${indent}  ${img}${caption}\n${indent}</figure>`;
    }

    case 'code':
      // Code content is pre-formatted: escape it, but never re-indent it.
      return `${indent}<pre><code>${xmlText(block.text)}</code></pre>`;

    case 'pre': {
      // The table fallback. The monospace text preserves the original column alignment;
      // the optional snapshot shows what it actually looked like on the page.
      const body = `${indent}<pre class="table-fallback">${xmlText(block.text)}</pre>`;
      if (!block.snapshotAssetId) return body;
      const href = ctx.assetHref(block.snapshotAssetId);
      if (!href) return body;
      const img = voidTag('img', { src: href, alt: 'Original table as it appeared in the PDF' });
      return `${body}\n${indent}<figure class="table-snapshot">\n${indent}  ${img}\n${indent}</figure>`;
    }

    case 'quote': {
      const inner = serializeBlocks(block.blocks, ctx, `${indent}  `);
      if (inner.trim().length === 0) return '';
      return `${indent}<blockquote>\n${inner}\n${indent}</blockquote>`;
    }

    case 'rule':
      return `${indent}${voidTag('hr')}`;

    case 'pagebreak':
      // A source page boundary. Not a forced page break in the reader — that would fight
      // reflow, which is the entire point of converting. It is a semantic marker only.
      return `${indent}${voidTag('span', {
        class: 'source-page',
        id: `page-${block.sourcePage + 1}`,
        'epub:type': 'pagebreak',
        role: 'doc-pagebreak',
        'aria-label': String(block.label ?? block.sourcePage + 1),
      })}`;
  }
}

function serializeList(block: ListBlock, ctx: BlockContext, indent: string): string {
  const tag = block.ordered ? 'ol' : 'ul';
  const start = block.ordered && block.start !== undefined && block.start !== 1
    ? block.start
    : undefined;

  const items = block.items
    .map((item) => {
      const inner = serializeBlocks(item.blocks, ctx, `${indent}    `);
      if (inner.trim().length === 0) return '';
      // A single paragraph inside a list item is emitted inline, so the reader does not add
      // paragraph margins inside every bullet.
      const onlyParagraph = item.blocks.length === 1 && item.blocks[0]?.kind === 'p';
      if (onlyParagraph) {
        const stripped = inner.trim().replace(/^<p(?:\s[^>]*)?>/, '').replace(/<\/p>$/, '');
        return `${indent}  <li>${stripped}</li>`;
      }
      return `${indent}  <li>\n${inner}\n${indent}  </li>`;
    })
    .filter((s) => s.length > 0);

  if (items.length === 0) return '';
  return `${indent}<${tag}${attrString({ start })}>\n${items.join('\n')}\n${indent}</${tag}>`;
}

function serializeTable(block: TableBlock, ctx: BlockContext, indent: string): string {
  const parts: string[] = [];
  if (block.caption) {
    parts.push(`${indent}  <caption>${serializeInlines(block.caption, ctx)}</caption>`);
  }
  if (block.head.length > 0) {
    parts.push(`${indent}  <thead>`);
    for (const row of block.head) parts.push(serializeRow(row, ctx, `${indent}    `, true));
    parts.push(`${indent}  </thead>`);
  }
  if (block.body.length > 0) {
    parts.push(`${indent}  <tbody>`);
    for (const row of block.body) parts.push(serializeRow(row, ctx, `${indent}    `, false));
    parts.push(`${indent}  </tbody>`);
  }
  if (parts.length === 0) return '';
  return `${indent}<table>\n${parts.join('\n')}\n${indent}</table>`;
}

function serializeRow(
  row: TableRow,
  ctx: BlockContext,
  indent: string,
  inHead: boolean,
): string {
  const cells = row.cells.map((cell) => {
    const tag = cell.header || inHead ? 'th' : 'td';
    const inner = serializeCellContent(cell.blocks, ctx, `${indent}    `);
    return `${indent}  <${tag}${attrString({
      colspan: cell.colspan > 1 ? cell.colspan : undefined,
      rowspan: cell.rowspan > 1 ? cell.rowspan : undefined,
      scope: tag === 'th' ? (inHead ? 'col' : 'row') : undefined,
      class: cell.align && cell.align !== 'left' ? `align-${cell.align}` : undefined,
    })}>${inner}</${tag}>`;
  });
  return `${indent}<tr>\n${cells.join('\n')}\n${indent}</tr>`;
}

/**
 * Cell content is emitted without paragraph wrappers when it is a single paragraph.
 *
 * Kindle adds vertical margins to `<p>` inside `<td>`, which makes every table row twice as
 * tall as it needs to be on a 6" screen.
 */
function serializeCellContent(blocks: Block[], ctx: BlockContext, indent: string): string {
  if (blocks.length === 1 && blocks[0]?.kind === 'p') {
    return serializeInlines(blocks[0].inlines, ctx);
  }
  const inner = serializeBlocks(blocks, ctx, indent);
  return inner.trim().length === 0 ? '' : `\n${inner}\n${indent}`;
}
