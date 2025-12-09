export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  THINKING = 'THINKING', // Gemini 3 Pro Thinking Mode
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface SpeakerSegment {
  speaker: string;
  timestamp: string;
  text: string;
}

export interface ActionItem {
  task: string;
  owner: string;
  status: 'Pending' | 'In Progress' | 'Done';
  dueDate?: string;
}

export interface SentimentPoint {
  time: string; // e.g., "00:05:30"
  score: number; // -1.0 to 1.0
  mood: string;
}

export interface MeetingAnalysisResult {
  title: string;
  summary: string;
  keyDecisions: string[];
  transcript: SpeakerSegment[];
  actionItems: ActionItem[];
  sentimentData: SentimentPoint[];
  topics: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  sources?: Array<{ title: string; uri: string }>;
  isThinking?: boolean;
}