import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { 
  UserProfile, 
  CandidateResumeData, 
  JobApplication, 
  RecruiterEmailMessage, 
  FeedbackReview 
} from '../types/index.js';

interface DatabaseSchema {
  users: Record<string, UserProfile>;
  resumes: Record<string, CandidateResumeData>; // keyed by userId
  jobs: Record<string, JobApplication>; // keyed by jobId
  emails: Record<string, RecruiterEmailMessage>; // keyed by emailId
  reviews: Record<string, FeedbackReview>; // keyed by reviewId
}

class StoreService {
  private dbPath: string;
  private data: DatabaseSchema;

  constructor() {
    this.dbPath = path.join(config.dataDir, 'db.json');
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading db.json, initializing fresh store', e);
    }
    return {
      users: {},
      resumes: {},
      jobs: {},
      emails: {},
      reviews: {},
    };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving db.json', e);
    }
  }

  // User operations
  getUser(id: string): UserProfile | undefined {
    return this.data.users[id];
  }

  getUserByEmail(email: string): UserProfile | undefined {
    return Object.values(this.data.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  saveUser(user: UserProfile): UserProfile {
    this.data.users[user.id] = { ...user, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.users[user.id];
  }

  // Resume operations
  getResume(userId: string): CandidateResumeData | undefined {
    return this.data.resumes[userId];
  }

  saveResume(resume: CandidateResumeData): CandidateResumeData {
    this.data.resumes[resume.userId] = { ...resume, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.resumes[resume.userId];
  }

  // Job operations
  getJob(jobId: string): JobApplication | undefined {
    return this.data.jobs[jobId];
  }

  getUserJobs(userId: string): JobApplication[] {
    return Object.values(this.data.jobs)
      .filter((j) => j.userId === userId)
      .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
  }

  saveJob(job: JobApplication): JobApplication {
    this.data.jobs[job.id] = job;
    this.save();
    return job;
  }

  updateJob(jobId: string, updates: Partial<JobApplication>): JobApplication | undefined {
    const existing = this.data.jobs[jobId];
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.data.jobs[jobId] = updated;
    this.save();
    return updated;
  }

  // Email operations
  getUserEmails(userId: string): RecruiterEmailMessage[] {
    return Object.values(this.data.emails)
      .filter((e) => e.userId === userId)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }

  saveEmail(email: RecruiterEmailMessage): RecruiterEmailMessage {
    this.data.emails[email.id] = email;
    this.save();
    return email;
  }

  // Review operations
  getReview(reviewId: string): FeedbackReview | undefined {
    return this.data.reviews[reviewId];
  }

  saveReview(review: FeedbackReview): FeedbackReview {
    this.data.reviews[review.id] = review;
    this.save();
    return review;
  }
}

export const store = new StoreService();
