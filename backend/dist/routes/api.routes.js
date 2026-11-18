"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const auth_service_js_1 = require("../services/auth.service.js");
const resume_service_js_1 = require("../services/resume.service.js");
const store_service_js_1 = require("../services/store.service.js");
const tracker_service_js_1 = require("../services/tracker.service.js");
const gmail_service_js_1 = require("../services/gmail.service.js");
const feedback_service_js_1 = require("../services/feedback.service.js");
const upload = (0, multer_1.default)({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
exports.apiRouter = (0, express_1.Router)();
// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================
exports.apiRouter.post('/auth/google', async (req, res) => {
    try {
        const { idToken, refreshToken, accessToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required' });
        }
        const result = await auth_service_js_1.authService.loginWithGoogleToken(idToken, refreshToken, accessToken);
        return res.json(result);
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Google Auth failed' });
    }
});
exports.apiRouter.post('/auth/dev-login', (req, res) => {
    const { email, name } = req.body;
    const result = auth_service_js_1.authService.devMockLogin(email || 'demo.candidate@gmail.com', name || 'Demo Candidate');
    return res.json(result);
});
exports.apiRouter.get('/auth/me', auth_middleware_js_1.requireAuth, (req, res) => {
    const user = store_service_js_1.store.getUser(req.userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
});
// ==========================================
// 2. RESUME & SCREENING PROFILE ROUTES
// ==========================================
exports.apiRouter.post('/resume/upload', auth_middleware_js_1.requireAuth, upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Resume PDF file required' });
        }
        const rawText = await resume_service_js_1.resumeService.parsePdfBuffer(req.file.buffer);
        const profile = resume_service_js_1.resumeService.extractProfileFromText(req.userId, rawText, req.file.originalname);
        return res.json({ success: true, profile });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to process resume' });
    }
});
exports.apiRouter.get('/resume', auth_middleware_js_1.requireAuth, (req, res) => {
    let profile = store_service_js_1.store.getResume(req.userId);
    if (!profile) {
        // Return sample candidate baseline profile if none uploaded yet
        profile = resume_service_js_1.resumeService.extractProfileFromText(req.userId, 'John Doe\njohn.doe@example.com\n+1 555-0199\n5 years of experience in JavaScript, React, Node.js, TypeScript, PostgreSQL', 'sample_resume.pdf');
    }
    return res.json({ profile });
});
exports.apiRouter.put('/resume', auth_middleware_js_1.requireAuth, (req, res) => {
    const existing = store_service_js_1.store.getResume(req.userId);
    const updated = store_service_js_1.store.saveResume({ ...(existing || {}), ...req.body, userId: req.userId });
    return res.json({ success: true, profile: updated });
});
// Used by Chrome content scripts during live application form filling
exports.apiRouter.post('/resume/screening-answer', auth_middleware_js_1.requireAuth, (req, res) => {
    const { question } = req.body;
    if (!question)
        return res.status(400).json({ error: 'Question text is required' });
    const answerResult = resume_service_js_1.resumeService.answerScreeningQuestion(req.userId, question);
    return res.json(answerResult);
});
// ==========================================
// 3. JOB TRACKING & AUTO-APPLY ROUTES
// ==========================================
exports.apiRouter.get('/jobs', auth_middleware_js_1.requireAuth, (req, res) => {
    const data = tracker_service_js_1.trackerService.getUserApplications(req.userId);
    return res.json(data);
});
// Called by extension content script when an auto-apply finishes
exports.apiRouter.post('/jobs/apply', auth_middleware_js_1.requireAuth, (req, res) => {
    const { jobTitle, company, location, platform, jobUrl, recruiterEmail, recruiterName } = req.body;
    if (!jobTitle || !company || !platform) {
        return res.status(400).json({ error: 'jobTitle, company, and platform are required' });
    }
    const job = tracker_service_js_1.trackerService.recordApplication(req.userId, {
        jobTitle,
        company,
        location,
        platform,
        jobUrl: jobUrl || '',
        recruiterEmail,
        recruiterName,
    });
    return res.json({ success: true, job });
});
exports.apiRouter.patch('/jobs/:id/status', auth_middleware_js_1.requireAuth, (req, res) => {
    const { status, note } = req.body;
    const updated = tracker_service_js_1.trackerService.updateApplicationStatus(req.params.id, status, note);
    if (!updated)
        return res.status(404).json({ error: 'Job not found' });
    return res.json({ success: true, job: updated });
});
// ==========================================
// 4. GMAIL RECRUITER EMAIL ROUTES
// ==========================================
exports.apiRouter.get('/gmail/emails', auth_middleware_js_1.requireAuth, async (req, res) => {
    const emails = await gmail_service_js_1.gmailService.syncUserEmails(req.userId);
    return res.json({ emails });
});
exports.apiRouter.post('/gmail/sync', auth_middleware_js_1.requireAuth, async (req, res) => {
    const emails = await gmail_service_js_1.gmailService.syncUserEmails(req.userId);
    return res.json({ success: true, count: emails.length, emails });
});
// ==========================================
// 5. RECRUITER MCQ REVIEW ROUTES
// ==========================================
exports.apiRouter.post('/feedback/request', auth_middleware_js_1.requireAuth, async (req, res) => {
    const { jobId, recruiterEmail } = req.body;
    if (!jobId)
        return res.status(400).json({ error: 'jobId is required' });
    const result = await feedback_service_js_1.feedbackService.sendReviewRequest(req.userId, jobId, recruiterEmail);
    if (!result.success)
        return res.status(400).json(result);
    return res.json(result);
});
// Public Form for Recruiters to submit 20-second MCQ feedback
exports.apiRouter.get('/feedback/form/:reviewId', (req, res) => {
    const review = store_service_js_1.store.getReview(req.params.reviewId);
    const preselect = req.query.ans;
    if (!review) {
        return res.status(404).send('<h3>Feedback Request Not Found or Expired</h3>');
    }
    if (review.status === 'COMPLETED') {
        return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Feedback Submitted</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 480px; text-align: center; }
          h2 { color: #16a34a; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✓ Feedback Received!</h2>
          <p>Thank you for helping <strong>${review.candidateName}</strong> grow professionally. Your 20-second contribution makes a big impact.</p>
        </div>
      </body>
      </html>
    `);
    }
    return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Quick Candidate Feedback - ${review.candidateName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #f1f5f9; padding: 24px; margin: 0; color: #1e293b; }
        .container { max-width: 520px; margin: 24px auto; background: white; border-radius: 12px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        h2 { margin-top: 0; color: #0f172a; font-size: 20px; }
        .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 9999px; font-size: 13px; font-weight: 600; display: inline-block; margin-bottom: 16px; }
        label { display: block; font-weight: 600; margin-top: 18px; margin-bottom: 8px; font-size: 14px; }
        .option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s; }
        .option:hover { background: #f8fafc; }
        textarea { width: 100%; box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-family: inherit; resize: vertical; }
        button { width: 100%; background: #2563eb; color: white; padding: 12px; border: none; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer; margin-top: 20px; }
        button:hover { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <div class="container">
        <span class="badge">30-Second Micro Review</span>
        <h2>Feedback for ${review.candidateName}</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: -8px;">Role: <strong>${review.jobTitle}</strong> at <strong>${review.company}</strong></p>

        <form method="POST" action="/api/feedback/submit/${review.id}">
          <label>1. Primary reason candidate was not selected:</label>
          <div class="option">
            <input type="radio" id="r1" name="primaryReason" value="Years of Experience" ${preselect === 'experience' ? 'checked' : ''} required />
            <label for="r1" style="margin: 0; font-weight: normal; cursor: pointer;">More years of specific experience required</label>
          </div>
          <div class="option">
            <input type="radio" id="r2" name="primaryReason" value="Missing Tech Stack" ${preselect === 'tech_stack' ? 'checked' : ''} />
            <label for="r2" style="margin: 0; font-weight: normal; cursor: pointer;">Looking for a specific skill / tech stack</label>
          </div>
          <div class="option">
            <input type="radio" id="r3" name="primaryReason" value="Compensation / CTC" ${preselect === 'salary' ? 'checked' : ''} />
            <label for="r3" style="margin: 0; font-weight: normal; cursor: pointer;">Compensation / CTC mismatch</label>
          </div>
          <div class="option">
            <input type="radio" id="r4" name="primaryReason" value="Position Already Filled / High Volume" ${preselect === 'filled' ? 'checked' : ''} />
            <label for="r4" style="margin: 0; font-weight: normal; cursor: pointer;">Position already filled / High applicant volume</label>
          </div>

          <label>2. Resume Quality & Relevance:</label>
          <div style="display: flex; gap: 12px;">
            <label class="option" style="flex: 1;"><input type="radio" name="resumeClarityRating" value="EXCELLENT" checked /> Clear & Strong</label>
            <label class="option" style="flex: 1;"><input type="radio" name="resumeClarityRating" value="AVERAGE" /> Average</label>
            <label class="option" style="flex: 1;"><input type="radio" name="resumeClarityRating" value="POOR" /> Needs Work</label>
          </div>

          <label>3. Optional 1-sentence note for candidate:</label>
          <textarea name="quickNote" rows="2" placeholder="e.g., Strengthen system design or Docker experience."></textarea>

          <button type="submit">Submit Feedback (Done!)</button>
        </form>
      </div>
    </body>
    </html>
  `);
});
exports.apiRouter.post('/feedback/submit/:reviewId', (req, res) => {
    const { primaryReason, resumeClarityRating, quickNote } = req.body;
    const updated = feedback_service_js_1.feedbackService.submitReviewFeedback(req.params.reviewId, {
        primaryReason: primaryReason || 'Experience Requirements',
        resumeClarityRating: resumeClarityRating || 'AVERAGE',
        encouragedToReapply: true,
        quickNote: quickNote || '',
    });
    if (!updated)
        return res.status(404).send('Review not found');
    return res.redirect(`/api/feedback/form/${req.params.reviewId}`);
});
