import { v4 as uuidv4 } from 'uuid';
import { store } from './store.service.js';
import { JobApplication, ApplicationStatus, JobPlatform } from '../types/index.js';

export class TrackerService {
  recordApplication(
    userId: string,
    data: {
      jobTitle: string;
      company: string;
      location?: string;
      platform: JobPlatform;
      jobUrl: string;
      recruiterEmail?: string;
      recruiterName?: string;
    }
  ): JobApplication {
    const newJob: JobApplication = {
      id: uuidv4(),
      userId,
      jobTitle: data.jobTitle,
      company: data.company,
      location: data.location || 'Remote / Hybrid',
      platform: data.platform,
      jobUrl: data.jobUrl,
      appliedDate: new Date().toISOString(),
      status: 'APPLIED',
      statusHistory: [
        {
          status: 'APPLIED',
          timestamp: new Date().toISOString(),
          note: `Applied automatically via ${data.platform.toUpperCase()}`,
        },
      ],
      recruiterEmail: data.recruiterEmail,
      recruiterName: data.recruiterName,
      feedbackRequested: false,
    };

    return store.saveJob(newJob);
  }

  getUserApplications(userId: string): {
    applications: JobApplication[];
    summary: Record<ApplicationStatus, number> & { total: number };
  } {
    let applications = store.getUserJobs(userId);

    // If zero applications, seed with demo data to test tracking immediately
    if (applications.length === 0) {
      this.seedDemoApplications(userId);
      applications = store.getUserJobs(userId);
    }

    const summary: Record<ApplicationStatus, number> & { total: number } = {
      total: applications.length,
      APPLIED: 0,
      NOT_VIEWED: 0,
      VIEWED: 0,
      SHORTLISTED: 0,
      INTERVIEW_SCHEDULED: 0,
      REJECTED: 0,
      OFFER: 0,
    };

    for (const app of applications) {
      if (summary[app.status] !== undefined) {
        summary[app.status]++;
      }
    }

    return { applications, summary };
  }

  updateApplicationStatus(jobId: string, status: ApplicationStatus, note?: string): JobApplication | undefined {
    const existing = store.getJob(jobId);
    if (!existing) return undefined;

    const history = [...existing.statusHistory, { status, timestamp: new Date().toISOString(), note }];
    return store.updateJob(jobId, { status, statusHistory: history });
  }

  private seedDemoApplications(userId: string) {
    const demoItems = [
      {
        jobTitle: 'Senior Frontend Engineer',
        company: 'FinTech Innovations',
        location: 'Bangalore (Hybrid)',
        platform: 'naukri' as JobPlatform,
        jobUrl: 'https://naukri.com/job-101',
        status: 'SHORTLISTED' as ApplicationStatus,
        recruiterEmail: 'alerts@naukri.com',
      },
      {
        jobTitle: 'Full Stack Developer',
        company: 'TechCorp Solutions',
        location: 'Remote',
        platform: 'linkedin' as JobPlatform,
        jobUrl: 'https://linkedin.com/jobs/view/202',
        status: 'REJECTED' as ApplicationStatus,
        recruiterEmail: 'sarah.jenkins@techcorp.io',
        recruiterName: 'Sarah Jenkins',
      },
      {
        jobTitle: 'React & Node.js Specialist',
        company: 'CloudScale Systems',
        location: 'Hyderabad',
        platform: 'indeed' as JobPlatform,
        jobUrl: 'https://indeed.com/viewjob?jk=303',
        status: 'INTERVIEW_SCHEDULED' as ApplicationStatus,
        recruiterEmail: 'alex.rivera@cloudscale.net',
        recruiterName: 'Alex Rivera',
      },
      {
        jobTitle: 'Software Engineer II',
        company: 'Global Retail Labs',
        location: 'Gurgaon',
        platform: 'linkedin' as JobPlatform,
        jobUrl: 'https://linkedin.com/jobs/view/404',
        status: 'VIEWED' as ApplicationStatus,
      },
      {
        jobTitle: 'Frontend Engineer (Vue/React)',
        company: 'NexGen Digital',
        location: 'Pune',
        platform: 'naukri' as JobPlatform,
        jobUrl: 'https://naukri.com/job-505',
        status: 'NOT_VIEWED' as ApplicationStatus,
      },
    ];

    for (const item of demoItems) {
      const job: JobApplication = {
        id: uuidv4(),
        userId,
        jobTitle: item.jobTitle,
        company: item.company,
        location: item.location,
        platform: item.platform,
        jobUrl: item.jobUrl,
        appliedDate: new Date(Date.now() - Math.floor(Math.random() * 5 * 86400000)).toISOString(),
        status: item.status,
        statusHistory: [
          {
            status: 'APPLIED',
            timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
            note: 'Applied automatically',
          },
          {
            status: item.status,
            timestamp: new Date().toISOString(),
            note: 'Status updated',
          },
        ],
        recruiterEmail: item.recruiterEmail,
        recruiterName: item.recruiterName,
        feedbackRequested: false,
      };
      store.saveJob(job);
    }
  }
}

export const trackerService = new TrackerService();
