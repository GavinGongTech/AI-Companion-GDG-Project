export interface ConceptNode {
  conceptNode: string
  accuracyRate: number
  interactionCount: number
  errorTypeMap: Record<string, number>
  easeFactor: number
  reviewIntervalDays: number
  nextReviewDate: { _seconds: number } | string | null
}

export interface DrillItem {
  conceptNode: string
  accuracyRate: number
  urgency: number
  reviewIntervalDays?: number
  nextReviewDate?: { _seconds: number } | string | null
}

export interface StudyEvent {
  eventId: string
  eventType: string
  content: string
  response?: string
  classifierTag?: string
  createdAt: { _seconds: number } | string
  courseId?: string
}

export interface Course {
  courseId: string
  platform: string
  lastIngestedAt: { _seconds: number } | string
}

export interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  conceptNode: string
}

export interface GraphData {
  nodes: ConceptNode[]
}

export interface DrillData {
  queue: DrillItem[]
}

export interface EventsData {
  events: StudyEvent[]
}
