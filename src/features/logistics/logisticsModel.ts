import type { LogisticsRequest, LogisticsStatus } from '../../types/logistics';

export const LOGISTICS_TERMINAL_STATUSES: readonly LogisticsStatus[] = ['pickedUp', 'cancelled'];

const allowedTransitions: Readonly<Record<LogisticsStatus, readonly LogisticsStatus[]>> = {
  waiting: ['seen', 'inProgress', 'pickedUp', 'cancelled'],
  seen: ['inProgress', 'pickedUp', 'cancelled'],
  inProgress: ['pickedUp', 'cancelled'],
  pickedUp: [],
  cancelled: [],
};

export type LogisticsTransitionResult =
  | { ok: true; request: LogisticsRequest }
  | { ok: false; reason: 'not-found' | 'invalid-transition' };

export function isTerminalLogisticsStatus(status: LogisticsStatus): boolean {
  return LOGISTICS_TERMINAL_STATUSES.includes(status);
}

export function canTransitionLogisticsStatus(from: LogisticsStatus, to: LogisticsStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionLogisticsRequest(
  request: LogisticsRequest,
  target: LogisticsStatus,
  completedAt: string,
): LogisticsTransitionResult {
  if (!canTransitionLogisticsStatus(request.status, target)) {
    return { ok: false, reason: 'invalid-transition' };
  }
  return {
    ok: true,
    request: {
      ...request,
      status: target,
      ...(isTerminalLogisticsStatus(target) ? { completedAt } : {}),
    },
  };
}
