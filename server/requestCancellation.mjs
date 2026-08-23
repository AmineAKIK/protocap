export function createClientDisconnectSignal(res) {
  const controller = new AbortController();

  const onClose = () => {
    if (!res.writableEnded && !controller.signal.aborted) {
      controller.abort(new Error('HTTP client disconnected before the response completed.'));
    }
  };

  res.once('close', onClose);

  return {
    signal: controller.signal,
    dispose() {
      res.off('close', onClose);
    },
  };
}
