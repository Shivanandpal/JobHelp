"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackService = exports.FeedbackService = void 0;
const uuid_1 = require("uuid");
const store_service_js_1 = require("./store.service.js");
const gmail_service_js_1 = require("./gmail.service.js");
const index_js_1 = require("../config/index.js");
class FeedbackService {
    async sendReviewRequest(userId, jobId, recruiterEmailOverride) {
        const job = store_service_js_1.store.getJob(jobId);
        if (!job) {
            return { success: false, message: 'Job not found' };
        }
        const user = store_service_js_1.store.getUser(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }
        const recruiterEmail = recruiterEmailOverride || job.recruiterEmail;
        if (!recruiterEmail) {
            return {
                success: false,
                message: 'No recruiter email found for this application. Please provide the recruiter email manually.',
            };
        }
        const reviewId = (0, uuid_1.v4)();
        const reviewUrl = `http://localhost:${index_js_1.config.port}/api/feedback/form/${reviewId}`;
        const review = {
            id: reviewId,
            applicationId: job.id,
            userId,
            company: job.company,
            jobTitle: job.jobTitle,
            recruiterEmail,
            candidateName: user.name,
            status: 'SENT',
            sentAt: new Date().toISOString(),
        };
        store_service_js_1.store.saveReview(review);
        store_service_js_1.store.updateJob(job.id, {
            feedbackRequested: true,
            feedbackRequestId: reviewId,
        });
        const subject = `Quick 30-sec feedback request: ${user.name} - ${job.jobTitle}`;
        const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif; max-width: 600px; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #1e293b; margin-top: 0;">Hi ${job.recruiterName || 'Hiring Team'},</h3>
        <p>
          Thank you for considering my application for the <strong>${job.jobTitle}</strong> position at <strong>${job.company}</strong>.
        </p>
        <p>
          I understand I was not selected, and I truly value your time. To help me grow and improve, could you please take <strong>20 seconds</strong> to click one quick multiple-choice response below?
        </p>
        
        <div style="background-color: #f8fafc; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <p style="margin-top: 0; font-weight: 600; color: #475569;">What was the primary reason for non-selection?</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <a href="${reviewUrl}?ans=experience" style="display: block; padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; text-decoration: none; color: #0284c7; font-weight: 500;">
              • More years of specific experience required
            </a>
            <a href="${reviewUrl}?ans=tech_stack" style="display: block; padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; text-decoration: none; color: #0284c7; font-weight: 500;">
              • Looking for a specific skill/tech stack not present
            </a>
            <a href="${reviewUrl}?ans=salary" style="display: block; padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; text-decoration: none; color: #0284c7; font-weight: 500;">
              • Compensation / CTC expectations mismatch
            </a>
            <a href="${reviewUrl}?ans=filled" style="display: block; padding: 8px 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; text-decoration: none; color: #0284c7; font-weight: 500;">
              • Role already filled / Large applicant volume
            </a>
          </div>
        </div>

        <p style="font-size: 14px; color: #64748b;">
          Or open the complete 3-question mini-survey here: <br/>
          <a href="${reviewUrl}" style="color: #2563eb;">${reviewUrl}</a>
        </p>

        <p style="margin-bottom: 0;">
          Warm regards,<br/>
          <strong>${user.name}</strong><br/>
          ${user.email}
        </p>
      </div>
    `;
        await gmail_service_js_1.gmailService.sendEmail(userId, recruiterEmail, subject, htmlBody);
        return { success: true, reviewId, message: 'Review request sent to recruiter!' };
    }
    submitReviewFeedback(reviewId, answers) {
        const review = store_service_js_1.store.getReview(reviewId);
        if (!review)
            return undefined;
        review.status = 'COMPLETED';
        review.completedAt = new Date().toISOString();
        review.answers = answers;
        store_service_js_1.store.saveReview(review);
        // Update job status
        const job = store_service_js_1.store.getJob(review.applicationId);
        if (job) {
            store_service_js_1.store.updateJob(job.id, {
                feedbackCompleted: true,
                statusHistory: [
                    ...job.statusHistory,
                    {
                        status: job.status,
                        timestamp: new Date().toISOString(),
                        note: `Recruiter submitted feedback: "${answers.primaryReason}"`,
                    },
                ],
            });
        }
        return review;
    }
}
exports.FeedbackService = FeedbackService;
exports.feedbackService = new FeedbackService();
