import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export const runtime = 'nodejs';

const MAX_HTML_LENGTH = 5_000_000;
const FORBIDDEN_HOSTS = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1$)/i;
const ALLOWED_TAGS = new Set([
  'a', 'article', 'aside', 'b', 'blockquote', 'br', 'code', 'div', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'img', 'li',
  'mark', 'ol', 'p', 'pre', 'section', 'small', 'span', 'strong', 'sub', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
]);
const BLOCK_TAGS = new Set(['blockquote', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'li', 'p', 'pre']);
const ASCII_ART_PATTERN = /[┌┐└┘│─╔╗╚╝═║▲▼◐○]/;

function isPrivateHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '');
  if (FORBIDDEN_HOSTS.test(normalized) || normalized.endsWith('.local')) return true;
  if (/^(::1|f[cd][0-9a-f]{2}:|fe80:)/i.test(normalized)) return true;
  const match = normalized.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function normalizeUrl(value: unknown) {
  if (typeof value !== 'string') throw new Error('Enter a valid article URL.');
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || isPrivateHost(url.hostname)) {
    throw new Error('Only public http or https article URLs are supported.');
  }
  return url;
}

function safeAbsoluteUrl(value: string, base: URL) {
  try {
    const resolved = new URL(value, base);
    return ['http:', 'https:', 'mailto:'].includes(resolved.protocol) ? resolved.href : '';
  } catch {
    return '';
  }
}

function sanitizeArticle(html: string, baseUrl: URL) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const body = document.querySelector('body');
  if (!body) return '';

  Array.from(body.querySelectorAll('*')).forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math'].includes(tag)) {
        element.remove();
      } else {
        element.replaceWith(...Array.from(element.childNodes));
      }
      return;
    }

    const rawHref = tag === 'a' ? element.getAttribute('href') ?? '' : '';
    const rawSrc = tag === 'img'
      ? element.getAttribute('src') ?? element.getAttribute('data-src') ?? ''
      : '';
    const rawAlt = tag === 'img' ? element.getAttribute('alt') ?? '' : '';
    const rawClassName = element.getAttribute('class') ?? '';
    const rawText = element.textContent ?? '';
    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));

    if (tag === 'a') {
      const href = safeAbsoluteUrl(rawHref, baseUrl);
      if (href) element.setAttribute('href', href);
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noreferrer noopener');
    }

    if (tag === 'img') {
      const src = safeAbsoluteUrl(rawSrc, baseUrl);
      if (!src) {
        element.remove();
        return;
      }
      element.setAttribute('src', src);
      element.setAttribute('alt', rawAlt);
      element.setAttribute('loading', 'lazy');
    }

    if (tag === 'pre') {
      const hiddenByDefault = /(?:^|\s)hidden(?:\s|$)/.test(rawClassName);
      const shownAtBreakpoint = /(?:^|\s)(?:sm|md|lg|xl|2xl):block(?:\s|$)/.test(rawClassName);
      const shownByDefault = /(?:^|\s)block(?:\s|$)/.test(rawClassName);
      const hiddenAtBreakpoint = /(?:^|\s)(?:sm|md|lg|xl|2xl):hidden(?:\s|$)/.test(rawClassName);

      if (hiddenByDefault && shownAtBreakpoint) element.setAttribute('data-reader-variant', 'wide');
      if (shownByDefault && hiddenAtBreakpoint) element.setAttribute('data-reader-variant', 'narrow');
      if (ASCII_ART_PATTERN.test(rawText)) element.setAttribute('data-reader-ascii', 'true');
    }
  });

  let blockIndex = 0;
  Array.from(body.querySelectorAll('*')).forEach((element) => {
    if (BLOCK_TAGS.has(element.tagName.toLowerCase())) {
      element.setAttribute('data-reader-block', `block-${blockIndex++}`);
    }
  });

  return body.innerHTML;
}

async function fetchPublicPage(startUrl: URL, signal: AbortSignal) {
  let currentUrl = startUrl;

  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    const response = await fetch(currentUrl.href, {
      redirect: 'manual',
      signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'ShelfReader/0.1 (+personal reading app)',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The article redirected without a destination.');
      currentUrl = normalizeUrl(new URL(location, currentUrl).href);
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error('The article redirected too many times.');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const url = normalizeUrl(body.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const { response, finalUrl } = await fetchPublicPage(url, controller.signal)
      .finally(() => clearTimeout(timeout));

    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) throw new Error('That URL is not an HTML article.');

    const html = await response.text();
    if (html.length > MAX_HTML_LENGTH) throw new Error('That page is too large to save.');

    const { document } = parseHTML(html);
    const parsed = new Readability(document as unknown as Document, {
      charThreshold: 180,
      keepClasses: true,
    }).parse();

    if (!parsed?.content || !parsed.title) {
      throw new Error('Shelf could not find a readable article on that page.');
    }

    const content = sanitizeArticle(parsed.content, finalUrl);
    if (!content) throw new Error('The article did not contain readable content.');

    return Response.json({
      url: finalUrl.href,
      title: parsed.title,
      excerpt: parsed.excerpt || '',
      content,
      byline: parsed.byline || '',
      siteName: parsed.siteName || finalUrl.hostname.replace(/^www\./, ''),
      readTime: Math.max(1, Math.ceil((parsed.length || parsed.textContent?.length || 0) / 1000)),
    });
  } catch (error) {
    const message = error instanceof Error && error.name !== 'AbortError'
      ? error.message
      : 'The article took too long to respond.';
    return Response.json({ error: message }, { status: 400 });
  }
}
