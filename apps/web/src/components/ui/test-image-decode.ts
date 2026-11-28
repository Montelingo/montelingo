import { vi } from "vitest";

/** One picture a game asked the browser to decode, as the browser was told to choose it. */
export type DecodeRequest = {
  src: string;
  srcset: string;
  sizes: string;
};

type Pending = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

/** Resolves the decodes, failing those `fails` picks, and settles with them. */
function settle(
  decodes: readonly Pending[],
  fails: (index: number) => boolean,
): Promise<unknown> {
  for (const [index, { resolve, reject }] of decodes.entries()) {
    if (fails(index)) {
      reject(new Error("EncodingError"));
    } else {
      resolve();
    }
  }
  return Promise.allSettled(decodes.map(({ promise }) => promise));
}

/**
 * Gives jsdom's images the `decode()` a browser's have, so a game waits for its
 * pictures as it does in a browser (#206). Every decode stays pending until the
 * test settles it. Call `restore()` after the test: without `decode`, games
 * start at once, which the other tests rely on.
 */
export function stubImageDecode() {
  const requests: DecodeRequest[] = [];
  const pending: Pending[] = [];
  HTMLImageElement.prototype.decode = vi.fn(function decode(
    this: HTMLImageElement,
  ) {
    requests.push({
      src: this.getAttribute("src") ?? "",
      srcset: this.srcset,
      sizes: this.sizes,
    });
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    pending.push({ promise, resolve, reject });
    return promise;
  });

  return {
    requests,
    /**
     * Every picture asked for so far loads. Settles once the decodes have, so
     * a test can `await act(() => decode.loadAll())`.
     */
    loadAll() {
      return settle(pending.splice(0), () => false);
    },
    /** As `loadAll`, except that the first picture fails. */
    failFirst() {
      return settle(pending.splice(0), (index) => index === 0);
    },
    restore() {
      Reflect.deleteProperty(HTMLImageElement.prototype, "decode");
    },
  };
}
