<<<<<<< HEAD
# Autonomous Job Application & Recruiter Mail Tracker

A production-ready Chrome Extension (Manifest V3) and companion Cloud Backend that automates job applications across LinkedIn, Indeed, and Naukri, tracks application statuses in real-time, synchronizes recruiter emails via Gmail API, and provides a 1-click 30-second MCQ feedback mechanism for rejected candidates.

---

## 📁 Repository Structure

```
chrome_extension/
├── backend/                        # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── config/index.ts         # Environment & OAuth Configuration
│   │   ├── middleware/auth.middleware.ts # JWT Verification Middleware
│   │   ├── routes/api.routes.ts    # REST Endpoints (Auth, Resume, Jobs, Gmail, Feedback)
│   │   ├── services/
│   │   │   ├── auth.service.ts     # Google OAuth & Token Manager
│   │   │   ├── resume.service.ts   # PDF Parsing & AI Screening Answer Engine
│   │   │   ├── gmail.service.ts    # Gmail API Sync & Email Status Classifier
│   │   │   ├── tracker.service.ts  # Job Application CRUD & Metrics
│   │   │   ├── feedback.service.ts # Recruiter MCQ Review Email & Response Service
│   │   │   └── store.service.ts    # JSON-backed Persistence Store (db.json)
│   │   ├── types/index.ts          # Unified Data Contracts & Interfaces
│   │   └── app.ts                  # Server Entry Point (Port 4000)
│   ├── package.json
│   └── tsconfig.json
│
├── extension/                      # Chrome Extension (Manifest V3)
│   ├── dist/                       # Production Build (Load this into Chrome)
│   ├── manifest.json               # Manifest V3 Configuration
│   ├── src/
│   │   ├── background/
│   │   │   └── service-worker.ts   # Background Service Worker & Alarms
│   │   ├── content-scripts/
│   │   │   ├── linkedin.ts         # LinkedIn "Easy Apply" Automation Engine
│   │   │   ├── indeed.ts           # Indeed "Easily Apply" Engine
│   │   │   └── naukri.ts           # Naukri "Quick Apply" Engine
│   │   ├── services/
│   │   │   └── api.ts              # API Client (communicating with Backend)
│   │   ├── sidepanel/              # Chrome Side Panel UI (React 18 + Tailwind)
│   │   │   ├── App.tsx             # Tracker, AutoApply, Emails & Resume Tabs
│   │   │   └── index.html
│   │   ├── popup/                  # Quick Extension Action Popup (React 18)
│   │   │   ├── App.tsx
│   │   │   └── index.html
│   │   └── types.ts
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 🚀 How to Run in Development

### 1. Start the Backend API Server
```powershell
cd backend
npm run dev
```
- Server starts at `http://localhost:4000`.
- Health check available at `http://localhost:4000/health`.
- Data is automatically saved in `backend/data/db.json`.

### 2. Build or Watch the Chrome Extension
```powershell
cd extension
npm run build
```
*(Or use `npm run dev` for continuous hot-reloading during development)*.

### 3. Load Extension into Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** (top-right corner) to **ON**.
3. Click the **"Load unpacked"** button.
4. Select the directory:
   ```
   c:\Users\HImanshi\OneDrive\Desktop\chrome_extension\extension\dist
   ```
5. Pin the **"AutoApply & Recruiter Mail Tracker"** extension in your Chrome toolbar.
6. Click the extension icon to view the quick popup, or open the **Side Panel** for the full application dashboard.

---

## ⚡ Features & Workflows Implemented

### 1. Candidate Login via Gmail
- Extension connects to backend using Google OAuth tokens.
- Secure refresh tokens enable automated Gmail background reading.

### 2. Autonomous Multi-Platform Apply (Zero Human in the Loop)
- Injected content scripts for **LinkedIn** (`linkedin.ts`), **Indeed** (`indeed.ts`), and **Naukri** (`naukri.ts`).
- Reads candidate profile and queries the backend `/api/resume/screening-answer` endpoint to dynamically fill employer screening questions (experience, work authorization, notice period, expected salary).
- Submits applications and logs entries directly to the tracker.
- Includes anti-ban safety limits (adjustable daily max applications, random pauses).

### 3. Real-Time Job Tracking
- Side Panel dashboard displays metrics: `Total Applied`, `Shortlisted`, `Interviews`, `Rejected`, `Not Viewed`.
- Search, filter by status, and view application history.

### 4. Recruiter Email Ingestion & Auto-Status Updates
- Synchronizes recruiter emails via Gmail API.
- Automatically parses messages and classifies candidate status:
  - `SHORTLISTED`
  - `INTERVIEW_SCHEDULED`
  - `REJECTED`
  - `VIEWED` / `NOT_VIEWED`
- Automatically reflects changes in the application tracking list.

### 5. Recruiter 30-Second MCQ Feedback Loop
- For any job marked `REJECTED`:
  - 1-Click **"Request Review"** button generates a lightweight MCQ survey.
  - Sends an email to the recruiter containing 1-click options (*"Years of Experience"*, *"Missing Tech Stack"*, *"Salary Mismatch"*, *"Role Already Filled"*).
  - Recruiter submits feedback in under 30 seconds; results appear directly in candidate's dashboard.
=======
# JobHelp
>>>>>>> f09c29e49b821ecfeab75bd4ddb617e798a12e49
