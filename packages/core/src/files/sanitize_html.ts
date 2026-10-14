import sanitizeHtml from 'sanitize-html'

/**
 * What a `richText` field keeps: the markup Tiptap 3's StarterKit
 * produces (paragraphs, headings, lists, quotes, code, rules, line
 * breaks, bold, italic, underline, strike, inline code and links).
 * Everything else, scripts, event handlers, styles and iframes
 * included, is removed. Links may only be http, https or mailto, and
 * links opening a new tab get `rel="noopener noreferrer"`.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'code',
    'ul',
    'ol',
    'li',
    'hr',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'a',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    ol: ['start'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  allowedSchemesAppliedToAttributes: ['href'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs:
        attribs.target === '_blank'
          ? { ...attribs, rel: 'noopener noreferrer nofollow' }
          : { ...attribs, target: '', rel: attribs.rel ?? '' },
    }),
  },
  // Drop the contents of dangerous elements, not just their tags
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object'],
}

/**
 * Sanitises rich text HTML on the server: before a `richText` value
 * reaches the app's validator, and again before it's sent to a page,
 * so HTML written outside Azu is safe to render too.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}
