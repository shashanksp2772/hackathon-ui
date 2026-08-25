export type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** What caused this suggestion to be created — drives the re-plan badge in the UI. */
export type TriggerReason = 'INITIAL' | 'AGENT_OFFLINE';

export interface Suggestion {
  id: string;
  orderId: string;
  recommendedAgentId: string;
  confidence: number;
  reasoning: string;
  status: SuggestionStatus;
  triggerReason: TriggerReason;
  createdAt: string;
}
