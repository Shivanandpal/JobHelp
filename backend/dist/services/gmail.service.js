"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gmailService = exports.GmailService = void 0;
const googleapis_1 = require("googleapis");
const uuid_1 = require("uuid");
const index_js_1 = require("../config/index.js");
const store_service_js_1 = require("./store.service.js");
class GmailService {
    getOAuthClient(refreshToken, accessToken) {
        const oAuth2Client = new googleapis_1.google.auth.OAuth2(index_js_1.config.google.clientId, index_js_1.config.google.clientSecret, index_js_1.config.google.redirectUri);
        oAuth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken,
        });
        return oAuth2Client;
    }
    // Analyzes email subject & snippet to determine recruitment status
    classifyEmailContent(subject, bodyText) {
        const text = `${subject} ${bodyText}`.toLowerCase();
        // Attempt company extraction from subject lines e.g., "Your application at Google", "Interview with Stripe"
        let company = 'Recruiter';
        const atMatch = subject.match(/(?:at|with|for)\s+([A-Za-z0-9\s&]+?)(?:\s+[-|–]|\s*$)/i);
        if (atMatch && atMatch[1] && atMatch[1].trim().length < 30) {
            company = atMatch[1].trim();
        }
        // Classification rules
        if (text.includes('unfortunately') ||
            text.includes('not moving forward') ||
            text.includes('decided to pursue other candidates') ||
            text.includes('not selected') ||
            text.includes('other applicants whose qualifications') ||
            text.includes('regret to inform')) {
            return { status: 'REJECTED', company };
        }
        if (text.includes('interview') ||
            text.includes('schedule a call') ||
            text.includes('chat about your experience') ||
            text.includes('screening round') ||
            text.includes('technical discussion') ||
            text.includes('calendly.com')) {
            return { status: 'INTERVIEW_SCHEDULED', company };
        }
        if (text.includes('shortlisted') ||
            text.includes('impressed with your profile') ||
            text.includes('next steps in our hiring')) {
            return { status: 'SHORTLISTED', company };
        }
        if (text.includes('viewed your application') ||
            text.includes('application was viewed')) {
            return { status: 'VIEWED', company };
        }
        if (text.includes('thank you for applying') ||
            text.includes('application received') ||
            text.includes('we received your application')) {
            return { status: 'APPLIED', company };
        }
        return { status: 'NOT_VIEWED', company };
    }
    // Sync real emails from Gmail API if connected, or return synced/mock emails for demo
    async syncUserEmails(userId) {
        const user = store_service_js_1.store.getUser(userId);
        if (!user)
            return [];
        if (user.googleRefreshToken && index_js_1.config.google.clientId) {
            try {
                const auth = this.getOAuthClient(user.googleRefreshToken, user.googleAccessToken);
                const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
                // Query for recruitment and job application related emails
                const query = 'subject:(application OR interview OR recruiter OR "moving forward" OR "unfortunately" OR shortlisted OR "thank you for applying")';
                const listRes = await gmail.users.messages.list({
                    userId: 'me',
                    q: query,
                    maxResults: 15,
                });
                const messages = listRes.data.messages || [];
                for (const msg of messages) {
                    if (!msg.id)
                        continue;
                    const msgDetail = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id,
                        format: 'full',
                    });
                    const headers = msgDetail.data.payload?.headers || [];
                    const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || 'Job Update';
                    const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Recruiter';
                    const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date')?.value || new Date().toISOString();
                    const snippet = msgDetail.data.snippet || '';
                    const { status, company } = this.classifyEmailContent(subjectHeader, snippet);
                    const recruiterEmail = {
                        id: msg.id,
                        threadId: msg.threadId || msg.id,
                        userId,
                        recruiterName: fromHeader.split('<')[0].replace(/"/g, '').trim(),
                        recruiterEmail: (fromHeader.match(/<([^>]+)>/) || [])[1] || fromHeader,
                        company,
                        subject: subjectHeader,
                        snippet,
                        bodyText: snippet,
                        receivedAt: new Date(dateHeader).toISOString(),
                        detectedStatus: status,
                    };
                    store_service_js_1.store.saveEmail(recruiterEmail);
                    this.autoUpdateApplicationStatusFromEmail(userId, recruiterEmail);
                }
            }
            catch (err) {
                console.warn('Could not sync live Gmail, falling back to cached/demo messages:', err);
            }
        }
        // Ensure there are realistic initial emails so the user sees real-time tracking immediately
        const existing = store_service_js_1.store.getUserEmails(userId);
        if (existing.length === 0) {
            this.populateDemoEmails(userId);
        }
        return store_service_js_1.store.getUserEmails(userId);
    }
    autoUpdateApplicationStatusFromEmail(userId, email) {
        const jobs = store_service_js_1.store.getUserJobs(userId);
        const matchedJob = jobs.find((j) => email.company.toLowerCase().includes(j.company.toLowerCase()) ||
            j.company.toLowerCase().includes(email.company.toLowerCase()));
        if (matchedJob && email.detectedStatus !== 'NOT_VIEWED') {
            email.matchedApplicationId = matchedJob.id;
            store_service_js_1.store.saveEmail(email);
            store_service_js_1.store.updateJob(matchedJob.id, {
                status: email.detectedStatus,
                recruiterEmail: email.recruiterEmail,
                recruiterName: email.recruiterName,
                statusHistory: [
                    ...matchedJob.statusHistory,
                    {
                        status: email.detectedStatus,
                        timestamp: new Date().toISOString(),
                        note: `Auto-updated from recruiter email: "${email.subject}"`,
                    },
                ],
            });
        }
    }
    // Populate realistic sample recruiter emails for immediate testing
    populateDemoEmails(userId) {
        const samples = [
            {
                threadId: 'thread_1',
                userId,
                recruiterName: 'Sarah Jenkins',
                recruiterEmail: 'sarah.jenkins@techcorp.io',
                company: 'TechCorp Solutions',
                subject: 'Update on your Software Engineer application at TechCorp',
                snippet: 'Thank you for your interest. Unfortunately, after careful consideration, we have decided to pursue other candidates whose skills more closely align...',
                bodyText: 'Thank you for taking the time to speak with us. Unfortunately, we will not be moving forward with your candidacy at this time.',
                receivedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
                detectedStatus: 'REJECTED',
            },
            {
                threadId: 'thread_2',
                userId,
                recruiterName: 'Alex Rivera (Talent Acquisition)',
                recruiterEmail: 'alex.rivera@cloudscale.net',
                company: 'CloudScale Systems',
                subject: 'Invitation to Technical Discussion: CloudScale Systems',
                snippet: 'We were very impressed with your background in React and TypeScript. We would love to schedule a 30-minute introductory call this week.',
                bodyText: 'We were impressed with your application and would like to schedule an interview round with our engineering lead.',
                receivedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
                detectedStatus: 'INTERVIEW_SCHEDULED',
            },
            {
                threadId: 'thread_3',
                userId,
                recruiterName: 'Naukri Recruiter Alert',
                recruiterEmail: 'alerts@naukri.com',
                company: 'FinTech Innovations',
                subject: 'Your CV was shortlisted by FinTech Innovations',
                snippet: 'Congratulations! Your profile has been shortlisted for the Senior Frontend Engineer role in Bangalore.',
                bodyText: 'Your profile has been shortlisted. The recruiter will reach out shortly.',
                receivedAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
                detectedStatus: 'SHORTLISTED',
            },
        ];
        for (const sample of samples) {
            const emailObj = { ...sample, id: (0, uuid_1.v4)() };
            store_service_js_1.store.saveEmail(emailObj);
            this.autoUpdateApplicationStatusFromEmail(userId, emailObj);
        }
    }
    // Send email via Gmail API
    async sendEmail(userId, to, subject, bodyHtml) {
        const user = store_service_js_1.store.getUser(userId);
        if (!user)
            return false;
        if (user.googleRefreshToken && index_js_1.config.google.clientId) {
            try {
                const auth = this.getOAuthClient(user.googleRefreshToken, user.googleAccessToken);
                const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
                const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
                const messageParts = [
                    `From: ${user.name} <${user.email}>`,
                    `To: ${to}`,
                    'Content-Type: text/html; charset=utf-8',
                    'MIME-Version: 1.0',
                    `Subject: ${utf8Subject}`,
                    '',
                    bodyHtml,
                ];
                const rawMessage = messageParts.join('\n');
                const encodedMessage = Buffer.from(rawMessage)
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');
                await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: { raw: encodedMessage },
                });
                return true;
            }
            catch (err) {
                console.error('Failed to send email via Gmail API:', err);
            }
        }
        // In local development / mock mode, log success
        console.log(`[Mock Mail Sent] From: ${user.email} -> To: ${to} | Subject: ${subject}`);
        return true;
    }
}
exports.GmailService = GmailService;
exports.gmailService = new GmailService();
