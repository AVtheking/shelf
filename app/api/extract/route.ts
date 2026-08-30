import { Readability } from '@mozilla/readability';
import { Data, Effect, Schema } from 'effect';
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
const ArticleRequestSchema = Schema.Struct({ url: Schema.String });

class InvalidArticleRequest extends Data.TaggedError('InvalidArticleRequest')<{
  readonly message: string;
}> {}

class ArticleFetchFailure extends Data.TaggedError('ArticleFetchFailure')<{
  readonly message: string;
}> {}

class ArticleFetchTimeout extends Data.TaggedError('ArticleFetchTimeout')<{
  readonly message: string;
}> {}

class ArticleExtractionFailure extends Data.TaggedError('ArticleExtractionFailure')<{
  readonly message: string;
}> {}

function isPrivateHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '');
  if (FORBIDDEN_HOSTS.test(normalized) || normalized.endsWith('.local')) return true;
  if (/^(::1|f[cd][0-9a-f]{2}:|fe80:)/i.test(normalized)) return true;
  const match = normalized.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function normalizeUrl(value: string) {
  return Effect.try({
    try: () => {
      const url = new URL(value.trim());
      if (!['http:', 'https:'].includes(url.protocol) || isPrivateHost(url.hostname)) {
        throw new Error('Unsupported article URL');
      }
      return url;
    },
    catch: () => new InvalidArticleRequest({
      message: 'Only public http or https article URLs are supported.',
    }),
  });
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

function readArticleUrl(request: Request) {
  return Effect.tryPromise({
    try: () => request.json(),
    catch: () => new InvalidArticleRequest({ message: 'Enter a valid article URL.' }),
  }).pipe(
    Effect.flatMap((body) => Schema.decodeUnknownEffect(ArticleRequestSchema)(body).pipe(
      Effect.mapError(() => new InvalidArticleRequest({ message: 'Enter a valid article URL.' })),
    )),
    Effect.flatMap(({ url }) => normalizeUrl(url)),
  );
}

function fetchPublicPage(startUrl: URL) {
  return Effect.gen(function* () {
    let currentUrl = startUrl;

    for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
      const requestUrl = currentUrl;
      const response = yield* Effect.tryPromise({
        try: (signal) => fetch(requestUrl.href, {
          redirect: 'manual',
          signal,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'ShelfReader/0.1 (+personal reading app)',
          },
        }),
        catch: () => new ArticleFetchFailure({ message: 'Shelf could not reach that article.' }),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return yield* Effect.fail(new ArticleFetchFailure({
            message: 'The article redirected without a destination.',
          }));
        }
        currentUrl = yield* normalizeUrl(new URL(location, currentUrl).href).pipe(
          Effect.mapError((error) => new ArticleFetchFailure({ message: error.message })),
        );
        continue;
      }

      return { response, finalUrl: currentUrl };
    }

    return yield* Effect.fail(new ArticleFetchFailure({
      message: 'The article redirected too many times.',
    }));
  });
}

function downloadArticle(url: URL) {
  return Effect.gen(function* () {
    const { response, finalUrl } = yield* fetchPublicPage(url);

    if (!response.ok) {
      return yield* Effect.fail(new ArticleFetchFailure({
        message: `The page returned ${response.status}.`,
      }));
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return yield* Effect.fail(new ArticleFetchFailure({
        message: 'That URL is not an HTML article.',
      }));
    }

    const html = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => new ArticleFetchFailure({ message: 'Shelf could not download that article.' }),
    });

    if (html.length > MAX_HTML_LENGTH) {
      return yield* Effect.fail(new ArticleFetchFailure({
        message: 'That page is too large to save.',
      }));
    }

    return { html, finalUrl };
  }).pipe(
    Effect.timeoutOrElse({
      duration: '12 seconds',
      orElse: () => Effect.fail(new ArticleFetchTimeout({
        message: 'The article took too long to respond.',
      })),
    }),
  );
}

function extractReadableArticle(html: string, finalUrl: URL) {
  return Effect.gen(function* () {
    const parsed = yield* Effect.try({
      try: () => {
        const { document } = parseHTML(html);
        return new Readability(document as unknown as Document, {
          charThreshold: 180,
          keepClasses: true,
        }).parse();
      },
      catch: () => new ArticleExtractionFailure({
        message: 'Shelf could not process that article.',
      }),
    });

    if (!parsed?.content || !parsed.title) {
      return yield* Effect.fail(new ArticleExtractionFailure({
        message: 'Shelf could not find a readable article on that page.',
      }));
    }

    const parsedContent = parsed.content;
    const content = yield* Effect.try({
      try: () => sanitizeArticle(parsedContent, finalUrl),
      catch: () => new ArticleExtractionFailure({
        message: 'Shelf could not create a safe reading copy of that article.',
      }),
    });

    if (!content) {
      return yield* Effect.fail(new ArticleExtractionFailure({
        message: 'The article did not contain readable content.',
      }));
    }

    return {
      url: finalUrl.href,
      title: parsed.title,
      excerpt: parsed.excerpt || '',
      content,
      byline: parsed.byline || '',
      siteName: parsed.siteName || finalUrl.hostname.replace(/^www\./, ''),
      readTime: Math.max(1, Math.ceil((parsed.length || parsed.textContent?.length || 0) / 1000)),
    };
  });
}

function errorResponse(status: number) {
  return (error: { readonly message: string }) => Effect.succeed(
    Response.json({ error: error.message }, { status }),
  );
}

export function POST(request: Request) {
  const program = Effect.gen(function* () {
    const url = yield* readArticleUrl(request);
    const { html, finalUrl } = yield* downloadArticle(url);
    return yield* extractReadableArticle(html, finalUrl);
  }).pipe(
    Effect.map((article) => Response.json(article)),
    Effect.catchTags({
      InvalidArticleRequest: errorResponse(400),
      ArticleFetchFailure: errorResponse(400),
      ArticleFetchTimeout: errorResponse(408),
      ArticleExtractionFailure: errorResponse(422),
    }),
  );

  return Effect.runPromise(program);
}
