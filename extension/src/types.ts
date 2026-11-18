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
  jobTitle: string;
  company: string;
  location?: string;
  platform: JobPlatform;
  jobUrl: string;
  appliedDate: string;
  status: ApplicationStatus;
  recruiterEmail?: string;
  recruiterName?: string;
  feedbackRequested?: boolean;
  feedbackRequestId?: string;
  feedbackCompleted?: boolean;
}

export interface RecruiterEmailMessage {
  id: string;
  recruiterName: string;
  recruiterEmail: string;
  company: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  detectedStatus: ApplicationStatus;
}

export interface AutoApplyConfig {
  enabled: boolean;
  targetTitles: string[];
  targetLocations: string[];
  maxDailyApplications: number;
  todayCount: number;
  platforms: {
    linkedin: boolean;
    indeed: boolean;
    naukri: boolean;
  };
}
