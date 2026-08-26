export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 8_000;

export function installGracefulShutdown({
  server,
  cleanupTimer,
  logger,
  processRef = process,
  shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  signals = ['SIGTERM', 'SIGINT'],
  clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  if (!server || typeof server.close !== 'function') {
    throw new TypeError('A Node HTTP server is required.');
  }
  if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
    throw new TypeError('A structured logger is required.');
  }
  if (!Number.isSafeInteger(shutdownTimeoutMs) || shutdownTimeoutMs < 1) {
    throw new RangeError('shutdownTimeoutMs must be a positive integer.');
  }

  let shuttingDown = false;
  let stopped = false;
  let activeSignal = null;
  let forceTimer = null;

  const finish = ({ exitCode, forced, error = null }) => {
    if (stopped) return;
    stopped = true;
    if (forceTimer) clearTimeoutFn(forceTimer);

    const fields = {
      signal: activeSignal,
      forced,
      exitCode,
    };
    if (error) fields.error = error instanceof Error ? error.name : 'Error';

    logger.info('server_stopped', fields);
    processRef.exit(exitCode);
  };

  const forceStop = () => {
    if (stopped) return;
    logger.error('server_shutdown_timeout', {
      signal: activeSignal,
      shutdownTimeoutMs,
    });
    server.closeAllConnections?.();
    finish({ exitCode: 1, forced: true });
  };

  const shutdown = (signal = 'manual') => {
    if (stopped) return;
    if (shuttingDown) {
      logger.error('server_shutdown_repeated', {
        signal,
        activeSignal,
      });
      server.closeAllConnections?.();
      finish({ exitCode: 1, forced: true });
      return;
    }

    shuttingDown = true;
    activeSignal = signal;
    if (cleanupTimer) clearIntervalFn(cleanupTimer);

    logger.info('server_stopping', {
      signal,
      shutdownTimeoutMs,
    });

    forceTimer = setTimeoutFn(forceStop, shutdownTimeoutMs);
    forceTimer?.unref?.();

    try {
      server.close((error) => {
        if (error) {
          logger.error('server_shutdown_error', {
            signal: activeSignal,
            error: error instanceof Error ? error.name : 'Error',
          });
          finish({ exitCode: 1, forced: false, error });
          return;
        }
        finish({ exitCode: 0, forced: false });
      });
    } catch (error) {
      logger.error('server_shutdown_error', {
        signal: activeSignal,
        error: error instanceof Error ? error.name : 'Error',
      });
      finish({ exitCode: 1, forced: false, error });
    }
  };

  for (const signal of signals) {
    processRef.on(signal, () => shutdown(signal));
  }

  return { shutdown };
}
