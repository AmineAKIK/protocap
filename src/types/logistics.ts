export type LogisticsStatus = 'waiting' | 'seen' | 'inProgress' | 'pickedUp' | 'cancelled';
export type Priority = 'normal' | 'high';

export interface LogisticsRequest {
  id: string;
  line: string;
  zone: string;
  palletCount: number;
  priority: Priority;
  nature: string;
  comment?: string;
  createdAt: string;
  completedAt?: string;
  status: LogisticsStatus;
}
