"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackerService = exports.TrackerService = void 0;
const uuid_1 = require("uuid");
const store_service_js_1 = require("./store.service.js");
class TrackerService {
    recordApplication(userId, data) {
        const newJob = {
            id: (0, uuid_1.v4)(),
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
        return store_service_js_1.store.saveJob(newJob);
    }
    getUserApplications(userId) {
        let applications = store_service_js_1.store.getUserJobs(userId);
        // If zero applications, seed with demo data to test tracking immediately
        if (applications.length === 0) {
            this.seedDemoApplications(userId);
            applications = store_service_js_1.store.getUserJobs(userId);
        }
        const summary = {
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
    updateApplicationStatus(jobId, status, note) {
        const existing = store_service_js_1.store.getJob(jobId);
        if (!existing)
            return undefined;
        const history = [...existing.statusHistory, { status, timestamp: new Date().toISOString(), note }];
        return store_service_js_1.store.updateJob(jobId, { status, statusHistory: history });
    }
    seedDemoApplications(userId) {
        const demoItems = [
            {
                jobTitle: 'Senior Frontend Engineer',
                company: 'FinTech Innovations',
                location: 'Bangalore (Hybrid)',
                platform: 'naukri',
                jobUrl: 'https://naukri.com/job-101',
                status: 'SHORTLISTED',
                recruiterEmail: 'alerts@naukri.com',
            },
            {
                jobTitle: 'Full Stack Developer',
                company: 'TechCorp Solutions',
                location: 'Remote',
                platform: 'linkedin',
                jobUrl: 'https://linkedin.com/jobs/view/202',
                status: 'REJECTED',
                recruiterEmail: 'sarah.jenkins@techcorp.io',
                recruiterName: 'Sarah Jenkins',
            },
            {
                jobTitle: 'React & Node.js Specialist',
                company: 'CloudScale Systems',
                location: 'Hyderabad',
                platform: 'indeed',
                jobUrl: 'https://indeed.com/viewjob?jk=303',
                status: 'INTERVIEW_SCHEDULED',
                recruiterEmail: 'alex.rivera@cloudscale.net',
                recruiterName: 'Alex Rivera',
            },
            {
                jobTitle: 'Software Engineer II',
                company: 'Global Retail Labs',
                location: 'Gurgaon',
                platform: 'linkedin',
                jobUrl: 'https://linkedin.com/jobs/view/404',
                status: 'VIEWED',
            },
            {
                jobTitle: 'Frontend Engineer (Vue/React)',
                company: 'NexGen Digital',
                location: 'Pune',
                platform: 'naukri',
                jobUrl: 'https://naukri.com/job-505',
                status: 'NOT_VIEWED',
            },
        ];
        for (const item of demoItems) {
            const job = {
                id: (0, uuid_1.v4)(),
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
            store_service_js_1.store.saveJob(job);
        }
    }
}
exports.TrackerService = TrackerService;
exports.trackerService = new TrackerService();
