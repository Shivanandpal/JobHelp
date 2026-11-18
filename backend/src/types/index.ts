export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  googleRefreshToken?: string;
  googleAccessToken?: string;
  tokenExpiry?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateResumeData {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  headline: string;
  summary: string;
  location: string;
  yearsOfExperience: number;
  skills: string[];
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startYear?: string;
    endYear?: string;
  }>;
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  links: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  preferences: {
    targetTitles: string[];
    desiredLocations: string[];
    remoteOnly: boolean;
    noticePeriodDays: number;
    expectedSalary?: string;
    currentSalary?: string;
    authorizedToWork: boolean;
    requiresSponsorship: boolean;
  };
  rawText?: string;
  resumeFileName?: string;
  updatedAt: string;
}

export type ApplicationStatus = 
  | 'APPLIED' 
  | 'NOT_VIEWED' 
  | 'VIEWED' 
  | 'SHORTLISTED' 
  | 'INTERVIEW_SCHEDULED' 
  | 'REJECTED' 
  | 'OFFER';

export type JobPlatform = 'linkedin' | 'indeed' | 'naukri' | 'other';

export interface JobApplication {
  id: string;
  userId: string;
  jobTitle: string;
  company: string;
  location?: string;
  platform: JobPlatform;
  jobUrl: string;
  appliedDate: string;
  status: ApplicationStatus;
  statusHistory: Array<{
    status: ApplicationStatus;
    timestamp: string;
    note?: string;
  }>;
  recruiterEmail?: string;
  recruiterName?: string;
  feedbackRequested?: boolean;
  feedbackRequestId?: string;
  feedbackCompleted?: boolean;
}

export interface RecruiterEmailMessage {
  id: string;
  threadId: string;
  userId: string;
  recruiterName: string;
  recruiterEmail: string;
  company: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
  detectedStatus: ApplicationStatus;
  matchedApplicationId?: string;
}

export interface FeedbackReview {
  id: string;
  applicationId: string;
  userId: string;
  company: string;
  jobTitle: string;
  recruiterEmail: string;
  candidateName: string;
  status: 'SENT' | 'COMPLETED' | 'EXPIRED';
  sentAt: string;
  completedAt?: string;
  answers?: {
    primaryReason: string; // e.g. "Experience Level", "Missing Specific Skill", "Salary Mismatch", "Position Filled"
    skillGaps?: string[];
    resumeClarityRating: 'POOR' | 'AVERAGE' | 'EXCELLENT';
    encouragedToReapply: boolean;
    quickNote?: string;
  };
}
