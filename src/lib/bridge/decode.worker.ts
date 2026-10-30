import { createDecodeHandler, type DecodeRequest } from './decode-core';

/** Decodes heavy messages off the main thread; see DecodePool. */
const handle = createDecodeHandler();
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};
scope.onmessage = (event) => {
  const { reply, transfer } = handle(event.data);
  scope.postMessage(reply, transfer);
};
