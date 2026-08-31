import { Data, Effect, Match, Option, Schema } from 'effect';

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
  return Match.value(body).pipe(
    Match.when(
      (value: unknown): value is { readonly error: string } => typeof value === 'object'
        && value !== null
        && 'error' in value
        && typeof value.error === 'string',
      ({ error }) => Option.some(error),
    ),
    Match.orElse(() => Option.none<string>()),
  );
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
        message: errorMessageFrom(body).pipe(
          Option.getOrElse(() => 'Could not save that article.'),
        ),
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
