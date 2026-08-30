import { Data, Effect, Schema } from 'effect';

const ExtractedArticleSchema = Schema.Struct({
  url: Schema.String,
  title: Schema.String,
  excerpt: Schema.String,
  content: Schema.String,
  byline: Schema.String,
  siteName: Schema.String,
  readTime: Schema.Number,
});

class AddArticleFailure extends Data.TaggedError('AddArticleFailure')<{
  readonly message: string;
}> {}

function errorMessageFrom(body: unknown) {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  return typeof body.error === 'string' ? body.error : null;
}

export function fetchArticleEffect(url: string) {
  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: (signal) => fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal,
      }),
      catch: () => new AddArticleFailure({
        message: 'Could not connect to Shelf. Please try again.',
      }),
    });

    const body = yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: () => new AddArticleFailure({
        message: 'Shelf returned an unreadable response.',
      }),
    });

    if (!response.ok) {
      return yield* Effect.fail(new AddArticleFailure({
        message: errorMessageFrom(body) ?? 'Could not save that article.',
      }));
    }

    return yield* Schema.decodeUnknownEffect(ExtractedArticleSchema)(body).pipe(
      Effect.mapError(() => new AddArticleFailure({
        message: 'Shelf could not verify the extracted article.',
      })),
    );
  }).pipe(
    Effect.timeoutOrElse({
      duration: '15 seconds',
      orElse: () => Effect.fail(new AddArticleFailure({
        message: 'Adding the article took too long. Please try again.',
      })),
    }),
  );
}
