import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { authService } from '../services/auth.service.js';
import { resumeService } from '../services/resume.service.js';
import { store } from '../services/store.service.js';
import { trackerService } from '../services/tracker.service.js';
import { gmailService } from '../services/gmail.service.js';
import { feedbackService } from '../services/feedback.service.js';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================
apiRouter.post('/auth/google', async (req, res): Promise<any> => {
  try {
    const { idToken, refreshToken, accessToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }
    const result = await authService.loginWithGoogleToken(idToken, refreshToken, accessToken);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Google Auth failed' });
  }
});

apiRouter.post('/auth/dev-login', (req, res): any => {
  const { email, name } = req.body;
  const result = authService.devMockLogin(email || 'demo.candidate@gmail.com', name || 'Demo Candidate');
  return res.json(result);
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response): any => {
  const user = store.getUser(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

// ==========================================
// 2. RESUME & SCREENING PROFILE ROUTES
// ==========================================
apiRouter.post('/resume/upload', requireAuth, upload.single('resume'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Resume PDF file required' });
    }
    const rawText = await resumeService.parsePdfBuffer(req.file.buffer);
    const profile = resumeService.extractProfileFromText(req.userId!, rawText, req.file.originalname);
    return res.json({ success: true, profile });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to process resume' });
  }
});

apiRouter.get('/resume', requireAuth, (req: AuthenticatedRequest, res: Response): any => {
  let profile = store.getResume(req.userId!);
  if (!profile) {
    // Return sample candidate baseline profile if none uploaded yet
    profile = resumeService.extractProfileFromText(
      req.userId!,
      'John Doe\njohn.doe@example.com\n+1 555-0199\n5 years of experience in JavaScript, React, Node.js, TypeScript, PostgreSQL',
      'sample_resume.pdf'
    );
  }
  return res.json({ profile });
});

apiRouter.put('/resume', requireAuth, (req: AuthenticatedRequest, res: Response): any => {
  const existing = store.getResume(req.userId!);
  const updated = store.saveResume({ ...(existing || {}), ...req.body, userId: req.userId! });
  return res.json({ success: true, profile: updated });
});

// Used by Chrome content scripts during live application form filling
apiRouter.post('/resume/screening-answer', requireAuth, (req: AuthenticatedRequest, res: Response): any => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Question text is required' });
  const answerResult = resumeService.answerScreeningQuestion(req.userId!, question);
  return res.json(answerResult);
});

// ==========================================
// 3. JOB TRACKING & AUTO-APPLY ROUTES
// ==========================================
apiRouter.get('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response): any => {
  const data = trackerService.getUserApplications(req.userId!);
  return res.json(data);
});

// Called by extension content script when an auto-apply finishes
apiRouter.post('/jobs/apply', requireAuth, (req: AuthenticatedRequest, res: Response): any => {
  const { jobTitle, company, location, platform, jobUrl, recruiterEmail, recruiterName } = req.body;
  if (!jobTitle || !company || !platform) {
    return res.status(400).json({ error: 'jobTitle, company, and platform are required' });
  }
  const job = trackerService.recordApplication(req.userId!, {
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

apiRouter.patch('/jobs/:id/status', requireAuth, (req: AuthenticatedRequest, res: Response): any => {
  const { status, note } = req.body;
  const updated = trackerService.updateApplicationStatus(req.params.id, status, note);
  if (!updated) return res.status(404).json({ error: 'Job not found' });
  return res.json({ success: true, job: updated });
});

// ==========================================
// 4. GMAIL RECRUITER EMAIL ROUTES
// ==========================================
apiRouter.get('/gmail/emails', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const emails = await gmailService.syncUserEmails(req.userId!);
  return res.json({ emails });
});

apiRouter.post('/gmail/sync', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const emails = await gmailService.syncUserEmails(req.userId!);
  return res.json({ success: true, count: emails.length, emails });
});

// ==========================================
// 5. RECRUITER MCQ REVIEW ROUTES
// ==========================================
apiRouter.post('/feedback/request', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  const { jobId, recruiterEmail } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  const result = await feedbackService.sendReviewRequest(req.userId!, jobId, recruiterEmail);
  if (!result.success) return res.status(400).json(result);
  return res.json(result);
});

// Public Form for Recruiters to submit 20-second MCQ feedback
apiRouter.get('/feedback/form/:reviewId', (req, res): any => {
  const review = store.getReview(req.params.reviewId);
  const preselect = req.query.ans as string;

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

apiRouter.post('/feedback/submit/:reviewId', (req, res): any => {
  const { primaryReason, resumeClarityRating, quickNote } = req.body;
  const updated = feedbackService.submitReviewFeedback(req.params.reviewId, {
    primaryReason: primaryReason || 'Experience Requirements',
    resumeClarityRating: resumeClarityRating || 'AVERAGE',
    encouragedToReapply: true,
    quickNote: quickNote || '',
  });

  if (!updated) return res.status(404).send('Review not found');

  return res.redirect(`/api/feedback/form/${req.params.reviewId}`);
});
