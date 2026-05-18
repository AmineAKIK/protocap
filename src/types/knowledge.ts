export type Criticality = 'standard' | 'important' | 'critical';
export type Difficulty = 'simple' | 'intermediate' | 'advanced';

export interface ProcedureDoc {
  id: string;
  title: string;
  category: string;
  summary: string;
  steps: string[];
  watchPoints: string[];
  estimatedMinutes: number;
  author: string;
  validator: string;
  updatedAt: string;
  relatedDocs: string[];
  tags: string[];
  criticality: Criticality;
  difficulty: Difficulty;
}
