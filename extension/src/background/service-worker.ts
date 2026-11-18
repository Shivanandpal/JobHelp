import { ApiClient } from '../services/api.js';

console.log('[Background Service Worker] Initialized');

// Allow clicking extension icon to open side panel
chrome.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.log('Side panel config error:', err));

// Initial defaults in storage
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['autoApplyConfig', 'localApplications']);
  if (!current.autoApplyConfig) {
    await chrome.storage.local.set({
      autoApplyConfig: {
        enabled: false,
        targetTitles: ['Software Engineer', 'Frontend Engineer', 'Full Stack Developer', 'React Developer'],
        targetLocations: ['Bangalore', 'Hyderabad', 'Remote', 'Pune'],
        maxDailyApplications: 25,
        todayCount: 0,
        platforms: {
          linkedin: true,
          indeed: true,
          naukri: true,
        },
      },
    });
  }
  if (!current.localApplications) {
    await chrome.storage.local.set({ localApplications: [] });
  }

  // Periodic alarm to sync recruiter emails every 15 minutes
  chrome.alarms.create('GMAIL_SYNC_ALARM', { periodInMinutes: 15 });
});

// Alarm Handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'GMAIL_SYNC_ALARM') {
    try {
      const res = await ApiClient.syncEmails();
      console.log(`[Alarm: Gmail Sync] Synced ${res.count} recruiter emails.`);
    } catch (e) {
      console.log('[Alarm: Gmail Sync Error]', e);
    }
  }
});

// Check platform authentication cookies
async function checkPlatformConnections() {
  const connections = {
    naukri: false,
    linkedin: false,
    indeed: false,
  };

  try {
    const naukriCookies = await chrome.cookies.getAll({ domain: 'naukri.com' });
    connections.naukri = naukriCookies.length > 2;

    const linkedinCookies = await chrome.cookies.getAll({ domain: 'linkedin.com' });
    connections.linkedin = linkedinCookies.some(c => c.name === 'li_at' || c.name === 'JSESSIONID');

    const indeedCookies = await chrome.cookies.getAll({ domain: 'indeed.com' });
    connections.indeed = indeedCookies.length > 2;
  } catch (err) {
    console.warn('Cookie check error:', err);
  }

  return connections;
}

function buildSearchUrl(platform: 'naukri' | 'linkedin' | 'indeed', title: string, location: string, page = 1): string {
  const cleanTitle = title.trim();
  const cleanLoc = location.trim();

  if (platform === 'naukri') {
    const slugTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugLoc = cleanLoc.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (slugTitle && slugLoc) {
      if (page > 1) {
        return `https://www.naukri.com/${slugTitle}-jobs-in-${slugLoc}-${page}`;
      }
      return `https://www.naukri.com/${slugTitle}-jobs-in-${slugLoc}`;
    }
    const pageParam = page > 1 ? `&pageNo=${page}` : '';
    return `https://www.naukri.com/jobs-in-india?keywords=${encodeURIComponent(cleanTitle)}&location=${encodeURIComponent(cleanLoc)}${pageParam}`;
  }

  if (platform === 'linkedin') {
    const startParam = page > 1 ? `&start=${(page - 1) * 25}` : '';
    return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(cleanTitle)}&location=${encodeURIComponent(cleanLoc)}&f_AL=true${startParam}`;
  }

  if (platform === 'indeed') {
    const startParam = page > 1 ? `&start=${(page - 1) * 10}` : '';
    return `https://www.indeed.com/jobs?q=${encodeURIComponent(cleanTitle)}&l=${encodeURIComponent(cleanLoc)}${startParam}`;
  }

  return 'https://www.google.com';
}

// Queue State for Autonomous Multi-Job Pipeline
interface QueuedJob {
  jobTitle: string;
  company: string;
  jobUrl: string;
}

let activeTabId: number | null = null;
let currentPlatform: 'naukri' | 'linkedin' | 'indeed' = 'naukri';
let currentTargetTitle = '';
let currentTargetLocation = '';
let currentSearchPage = 1;
let currentJobQueue: QueuedJob[] = [];
let currentQueueIndex = 0;
let searchPageUrl = '';
let maxDailyLimit = 25;
let successfulApplies = 0;
let isQueueRunning = false;

async function processNextQueuedJob() {
  if (!isQueueRunning || !activeTabId) return;

  // Check if daily cap reached
  if (successfulApplies >= maxDailyLimit) {
    chrome.runtime.sendMessage({
      type: 'AUTOAPPLY_LOG',
      log: `🎉 Safety cap reached (${successfulApplies}/${maxDailyLimit}). Run complete!`
    }).catch(() => {});

    isQueueRunning = false;
    if (searchPageUrl) {
      await chrome.tabs.update(activeTabId, { url: searchPageUrl });
    }
    return;
  }

  // If current page's queue is exhausted, advance to the NEXT search page!
  if (currentQueueIndex >= currentJobQueue.length) {
    currentSearchPage++;
    searchPageUrl = buildSearchUrl(currentPlatform, currentTargetTitle, currentTargetLocation, currentSearchPage);
    currentQueueIndex = 0;
    currentJobQueue = [];

    chrome.runtime.sendMessage({
      type: 'AUTOAPPLY_LOG',
      log: `📄 Page finished. Advancing to Search Results Page ${currentSearchPage}...`
    }).catch(() => {});

    await chrome.tabs.update(activeTabId, { url: searchPageUrl });

    // Wait for next search page to hydrate and trigger scraping
    setTimeout(async () => {
      await sendCommandWithRetry(activeTabId!, {
        type: `START_${currentPlatform.toUpperCase()}_APPLY`,
        targetTitle: currentTargetTitle,
        targetLocation: currentTargetLocation,
        maxDaily: maxDailyLimit,
      });
    }, 3500);

    return;
  }

  const job = currentJobQueue[currentQueueIndex];
  currentQueueIndex++;

  chrome.runtime.sendMessage({
    type: 'AUTOAPPLY_LOG',
    log: `[Job ${currentQueueIndex}/${currentJobQueue.length} on Page ${currentSearchPage}] Opening: "${job.jobTitle}" at "${job.company}"...`
  }).catch(() => {});

  // Navigate to job listing page to apply
  await chrome.tabs.update(activeTabId, { url: job.jobUrl });
}

// Handshake with retry to guarantee content script receives message
async function sendCommandWithRetry(tabId: number, message: any, maxAttempts = 15) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, message);
      if (res && res.received) {
        return true;
      }
    } catch {
      // Content script still loading/hydrating
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// Save applied application locally & sync to backend
async function saveAppliedJob(jobData: any) {
  const newApp = {
    id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    jobTitle: jobData.jobTitle || 'Software Engineer',
    company: jobData.company || 'Hiring Company',
    location: jobData.location || 'Bangalore / Remote',
    platform: jobData.platform || 'naukri',
    jobUrl: jobData.jobUrl || '',
    appliedDate: new Date().toISOString(),
    status: 'APPLIED',
  };

  // 1. Save locally in chrome.storage.local for instant tracking
  try {
    const stored = await chrome.storage.local.get(['localApplications']);
    const list = stored.localApplications || [];
    // Avoid duplicate records for the same job URL
    if (!list.some((j: any) => j.jobUrl === newApp.jobUrl)) {
      list.unshift(newApp);
      await chrome.storage.local.set({ localApplications: list });
    }
  } catch (err) {
    console.warn('Storage save error:', err);
  }

  // 2. Also sync to backend API
  try {
    await ApiClient.recordApplication(newApp);
  } catch (err) {
    console.warn('Backend record sync warning (will remain safely saved in extension storage):', err);
  }

  // 3. Broadcast to Side Panel to update the Tracker UI live
  chrome.runtime.sendMessage({
    type: 'NEW_JOB_APPLIED',
    job: newApp,
  }).catch(() => {});

  return newApp;
}

// Message Bus
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'CHECK_PLATFORM_CONNECTIONS': {
          const status = await checkPlatformConnections();
          sendResponse({ success: true, connections: status });
          break;
        }

        case 'OPEN_PLATFORM_LOGIN': {
          const { platform } = message;
          let loginUrl = 'https://www.naukri.com/nlogin/login';
          if (platform === 'linkedin') loginUrl = 'https://www.linkedin.com/login';
          if (platform === 'indeed') loginUrl = 'https://secure.indeed.com/auth';
          await chrome.tabs.create({ url: loginUrl, active: true });
          sendResponse({ success: true });
          break;
        }

        case 'START_AUTONOMOUS_RUN': {
          const { platform, targetTitle, targetLocation, maxDaily } = message;
          currentPlatform = platform || 'naukri';
          currentTargetTitle = targetTitle || 'Full Stack Developer';
          currentTargetLocation = targetLocation || 'Bangalore';
          currentSearchPage = 1;
          searchPageUrl = buildSearchUrl(currentPlatform, currentTargetTitle, currentTargetLocation, 1);
          maxDailyLimit = maxDaily || 25;
          successfulApplies = 0;
          currentJobQueue = [];
          currentQueueIndex = 0;
          isQueueRunning = true;

          chrome.runtime.sendMessage({
            type: 'AUTOAPPLY_LOG',
            log: `🚀 Navigating to ${platform.toUpperCase()} search: "${currentTargetTitle}" in "${currentTargetLocation}"...`
          }).catch(() => {});

          const tab = await chrome.tabs.create({ url: searchPageUrl, active: true });
          activeTabId = tab.id || null;

          // Connect with content script on search page
          setTimeout(async () => {
            chrome.runtime.sendMessage({
              type: 'AUTOAPPLY_LOG',
              log: `🔍 Scanning search results page for job postings...`
            }).catch(() => {});

            await sendCommandWithRetry(tab.id!, {
              type: `START_${platform.toUpperCase()}_APPLY`,
              targetTitle: currentTargetTitle,
              targetLocation: currentTargetLocation,
              maxDaily: maxDailyLimit,
            });
          }, 3000);

          sendResponse({ success: true, tabId: tab.id });
          break;
        }

        case 'SET_JOB_QUEUE': {
          const { jobs } = message;
          if (jobs && jobs.length > 0) {
            currentJobQueue = jobs;
            currentQueueIndex = 0;
            chrome.runtime.sendMessage({
              type: 'AUTOAPPLY_LOG',
              log: `📋 Found ${jobs.length} jobs on Page ${currentSearchPage}. Starting sequential apply...`
            }).catch(() => {});

            // Process first job
            await processNextQueuedJob();
          } else {
            chrome.runtime.sendMessage({
              type: 'AUTOAPPLY_LOG',
              log: `⚠️ No applyable job listings found on this page.`
            }).catch(() => {});
            isQueueRunning = false;
          }
          sendResponse({ success: true });
          break;
        }

        case 'JOB_APPLY_FINISHED': {
          const { status, company } = message;
          if (status === 'applied') {
            successfulApplies++;
            chrome.runtime.sendMessage({
              type: 'AUTOAPPLY_LOG',
              log: `✓ Applied to ${company}! (${successfulApplies}/${maxDailyLimit})`
            }).catch(() => {});
          } else if (status === 'already_applied') {
            chrome.runtime.sendMessage({
              type: 'AUTOAPPLY_LOG',
              log: `Skipped ${company}: Already applied.`
            }).catch(() => {});
          } else if (status === 'external_site') {
            chrome.runtime.sendMessage({
              type: 'AUTOAPPLY_LOG',
              log: `Skipped ${company}: Requires external career portal.`
            }).catch(() => {});
          }

          // Return back to the initial search page before proceeding to the next job!
          if (isQueueRunning && activeTabId && searchPageUrl) {
            chrome.runtime.sendMessage({
              type: 'AUTOAPPLY_LOG',
              log: `↩️ Returning to initial search page to prepare next application...`
            }).catch(() => {});

            await chrome.tabs.update(activeTabId, { url: searchPageUrl });

            // Allow 2.5s on the initial search page before opening the next job
            setTimeout(async () => {
              await processNextQueuedJob();
            }, 2500);
          }

          sendResponse({ success: true });
          break;
        }

        case 'RECORD_APPLICATION': {
          const app = await saveAppliedJob(message.jobData);
          const cfg = (await chrome.storage.local.get(['autoApplyConfig'])).autoApplyConfig;
          if (cfg) {
            cfg.todayCount = (cfg.todayCount || 0) + 1;
            await chrome.storage.local.set({ autoApplyConfig: cfg });
          }
          sendResponse({ success: true, data: app });
          break;
        }

        case 'STOP_AUTONOMOUS_RUN': {
          isQueueRunning = false;
          if (activeTabId) {
            chrome.tabs.sendMessage(activeTabId, { type: 'STOP_APPLY' }).catch(() => {});
          }
          sendResponse({ success: true });
          break;
        }

        case 'AUTOAPPLY_LOG': {
          chrome.runtime.sendMessage(message).catch(() => {});
          sendResponse({ success: true });
          break;
        }

        case 'GET_SCREENING_ANSWER': {
          const ans = await ApiClient.answerScreening(message.question);
          sendResponse({ success: true, data: ans });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true;
});
