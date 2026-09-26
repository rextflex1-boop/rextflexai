export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  generatedWebsiteHtml?: string;
}

export type TabMode = 'chat' | 'agent' | 'files' | 'terminal' | 'research' | 'preview';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  badge?: string;
  description: string;
  speed: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  credits: number;
  maxCredits: number;
  plan: 'Free' | 'Pro' | 'Enterprise';
  avatarInitial: string;
}

export interface ProjectData {
  id: string;
  title: string;
  slug: string;
  currentHtml: string;
  lastUpdated: string;
}
