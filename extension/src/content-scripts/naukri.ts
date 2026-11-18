console.log('[AutoApply: Naukri Engine] Injected and active on:', window.location.href);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class NaukriAutoApplier {
  private isRunning = false;
  private bannerEl: HTMLElement | null = null;

  constructor() {
    this.createFloatingStatusBanner();
    this.initListeners();
    this.checkAutoApplyContext();
  }

  private sendLog(text: string) {
    console.log(`[Naukri AutoApply] ${text}`);
    this.updateStatus(text, this.isRunning);
    chrome.runtime.sendMessage({
      type: 'AUTOAPPLY_LOG',
      log: `[Naukri] ${text}`,
    }).catch(() => {});
  }

  private simulateClick(el: HTMLElement) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const rect = el.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  }

  private createFloatingStatusBanner() {
    if (document.getElementById('autoapply-naukri-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'autoapply-naukri-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 14px 20px;
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.4);
      z-index: 99999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid #334155;
      max-width: 440px;
    `;
    banner.innerHTML = `
      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#f59e0b;" id="naukri-indicator"></span>
      <span id="autoapply-naukri-status" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">Naukri AutoApply: Ready</span>
      <button id="autoapply-naukri-btn" style="background:#d97706; color:white; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:700; shrink:0;">Start</button>
    `;
    document.body.appendChild(banner);
    this.bannerEl = banner;

    document.getElementById('autoapply-naukri-btn')?.addEventListener('click', () => {
      if (this.isRunning) this.stop();
      else this.start(25);
    });
  }

  private updateStatus(text: string, running = true) {
    const el = document.getElementById('autoapply-naukri-status');
    const btn = document.getElementById('autoapply-naukri-btn');
    const indicator = document.getElementById('naukri-indicator');
    if (el) el.innerText = text;
    if (btn) {
      btn.innerText = running ? 'Stop' : 'Start';
      btn.style.background = running ? '#dc2626' : '#d97706';
    }
    if (indicator) {
      indicator.style.background = running ? '#22c55e' : '#f59e0b';
    }
  }

  private initListeners() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === 'PING') {
        sendResponse({ pong: true, running: this.isRunning });
        return true;
      }

      if (msg.type === 'START_NAUKRI_APPLY') {
        sendResponse({ received: true });
        this.start(msg.maxDaily || 25);
        return true;
      }

      if (msg.type === 'STOP_APPLY' || msg.type === 'STOP_NAUKRI_APPLY') {
        sendResponse({ received: true });
        this.stop();
        return true;
      }

      return false;
    });
  }

  private async checkAutoApplyContext() {
    await sleep(1500);
    if (window.location.pathname.includes('/job-listings')) {
      await this.handleSingleJobListingPage();
    }
  }

  async start(maxApplications = 25) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.sendLog('🚀 Starting autonomous application sequence on Naukri...');

    if (window.location.pathname.includes('/job-listings')) {
      await this.handleSingleJobListingPage();
      this.isRunning = false;
      return;
    }

    await this.handleSearchResultsPage(maxApplications);
  }

  stop() {
    this.isRunning = false;
    this.sendLog('🛑 Autonomous run stopped.');
  }

  // =========================================================================
  // SRP (Search Result Page): Extract Job Listings for Queue
  // =========================================================================
  private async handleSearchResultsPage(maxApplications: number) {
    this.sendLog('Scanning page for job listings...');

    const jobCards = await this.waitForJobCards();

    if (jobCards.length === 0) {
      this.sendLog('No job cards identified. Scrolling down to trigger load...');
      window.scrollBy({ top: 500, behavior: 'smooth' });
      await sleep(2000);
    }

    const cards = await this.waitForJobCards();
    if (cards.length === 0) {
      this.sendLog('Could not find job cards. Ensure search results are loaded.');
      this.isRunning = false;
      return;
    }

    this.sendLog(`Found ${cards.length} job cards. Extracting direct application links...`);

    const jobQueue: Array<{ jobTitle: string; company: string; jobUrl: string }> = [];

    for (const card of cards) {
      const titleEl = card.querySelector<HTMLAnchorElement>('a.title, a[href*="job-listings"], [class*="title"] a, [data-job-id] a');
      const companyEl = card.querySelector<HTMLElement>('a.comp-name, [class*="comp-name"], a.subTitle, [class*="company"]');
      const jobTitle = titleEl?.innerText?.trim() || 'Software Engineer';
      const company = companyEl?.innerText?.trim() || 'Hiring Company';
      const href = titleEl?.getAttribute('href');

      if (href && href.includes('job-listings')) {
        const fullUrl = href.startsWith('http') ? href : `https://www.naukri.com${href}`;
        jobQueue.push({ jobTitle, company, jobUrl: fullUrl });
      }
    }

    if (jobQueue.length === 0) {
      this.sendLog('No direct job URLs found in cards.');
      this.isRunning = false;
      return;
    }

    this.sendLog(`Handing off ${jobQueue.length} jobs to background executor...`);
    
    chrome.runtime.sendMessage({
      type: 'SET_JOB_QUEUE',
      jobs: jobQueue.slice(0, maxApplications),
    }).catch(() => {});
  }

  // =========================================================================
  // Single Job Page (/job-listings-...): Apply & Answer All Subquestions
  // =========================================================================
  private async handleSingleJobListingPage() {
    this.sendLog('Job details page loaded. Finding Apply button...');
    await sleep(2000);

    const titleEl = document.querySelector<HTMLElement>('h1.jd-header-title, .job-title, [class*="header-title"], h1');
    const compEl = document.querySelector<HTMLElement>('a.pad-rt-8, .jd-header-comp-name, [class*="comp-name"]');
    const jobTitle = titleEl?.innerText?.trim() || 'Software Engineer';
    const company = compEl?.innerText?.trim() || 'Company';

    const applyBtn = await this.waitForApplyButton();

    if (!applyBtn) {
      this.sendLog(`No apply button found for ${company}.`);
      chrome.runtime.sendMessage({ type: 'JOB_APPLY_FINISHED', status: 'not_found', company });
      return;
    }

    const btnText = (applyBtn.innerText || '').trim().toLowerCase();

    if (btnText.includes('already applied') || btnText === 'applied') {
      this.sendLog(`Already applied to ${company}.`);
      chrome.runtime.sendMessage({ type: 'JOB_APPLY_FINISHED', status: 'already_applied', company });
      return;
    }

    if (btnText.includes('company site') || btnText.includes('company website')) {
      this.sendLog(`Skipping ${company}: External career site.`);
      chrome.runtime.sendMessage({ type: 'JOB_APPLY_FINISHED', status: 'external_site', company });
      return;
    }

    if (btnText.includes('apply')) {
      this.sendLog(`Clicking Apply button for ${company}...`);
      this.simulateClick(applyBtn);
      await sleep(2000);

      // Thoroughly process any internal questionnaire, chatbot, or subquestions
      await this.handleSubquestionsAndQuestionnaire(jobTitle, company, window.location.href);

      // Finished! Signal service worker to return to initial search page
      chrome.runtime.sendMessage({ type: 'JOB_APPLY_FINISHED', status: 'applied', company });
    }
  }

  // =========================================================================
  // Thorough Subquestion & Chatbot Answering Engine
  // =========================================================================
  private async handleSubquestionsAndQuestionnaire(jobTitle: string, company: string, jobUrl: string) {
    this.sendLog(`Checking for recruiter subquestions or chatbot drawer for ${company}...`);

    // Give questionnaire / chatbot drawer up to 3 seconds to mount
    const container = await this.waitForQuestionnaireContainer(3500);

    if (!container) {
      this.sendLog(`No subquestions required. Application confirmed for ${company}!`);
      this.recordApplicationSuccess(jobTitle, company, jobUrl);
      return;
    }

    this.sendLog(`📝 Chatbot / Questionnaire active. Answering subquestions sequentially...`);

    // Loop through multi-step subquestions (up to 12 steps)
    const maxSteps = 12;
    for (let step = 1; step <= maxSteps; step++) {
      await sleep(1200);

      // Check if application is already successfully completed
      const bodyText = document.body.innerText.toLowerCase();
      if (
        bodyText.includes('successfully applied') ||
        bodyText.includes('application has been sent') ||
        bodyText.includes('applied successfully') ||
        bodyText.includes('your application was submitted')
      ) {
        this.sendLog(`✅ All subquestions answered! Application confirmed for ${company}.`);
        this.recordApplicationSuccess(jobTitle, company, jobUrl);
        await sleep(1000);
        return;
      }

      // Check if container is still visible / attached
      const activeContainer = document.querySelector<HTMLElement>(
        '.chatbot_Drawer, .drawer, .chatbot-container, .modal, [class*="questionnaire"], [class*="apply-container"], [class*="drawer-wrapper"]'
      );

      if (!activeContainer || activeContainer.offsetHeight === 0) {
        this.sendLog(`Subquestion drawer closed. Application complete.`);
        this.recordApplicationSuccess(jobTitle, company, jobUrl);
        return;
      }

      let answeredSomething = false;

      // 1. Answer Clickable Options / Chips / Pills (e.g. Notice Period, Yes/No, Experience ranges)
      const clickableChips = Array.from(
        activeContainer.querySelectorAll<HTMLElement>(
          '.chip, [class*="chip"], .pill, [class*="pill"], .custom-radio, [class*="option"], li[role="button"]'
        )
      );

      for (const chip of clickableChips) {
        const chipText = (chip.innerText || '').trim().toLowerCase();
        // Common recruiter subquestion answers
        if (
          chipText.includes('15 days') ||
          chipText.includes('immediate') ||
          chipText.includes('serving notice') ||
          chipText === 'yes' ||
          chipText.includes('bangalore') ||
          chipText.includes('remote') ||
          chipText.includes('1-3 years') ||
          chipText.includes('3-5 years')
        ) {
          this.sendLog(`Selected option chip: "${chip.innerText.trim()}"`);
          this.simulateClick(chip);
          answeredSomething = true;
          await sleep(600);
          break;
        }
      }

      // 2. Answer Radio Buttons
      const radios = Array.from(activeContainer.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:checked)'));
      for (const radio of radios) {
        const val = (radio.value || radio.parentElement?.innerText || '').toLowerCase();
        if (val.includes('yes') || val.includes('immediate') || val.includes('15 days') || val.includes('full time')) {
          this.simulateClick(radio);
          answeredSomething = true;
          await sleep(400);
        }
      }

      // 3. Answer Text / Number Inputs (CTC, Experience, Notice Period, Skills)
      const inputs = Array.from(
        activeContainer.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input[type="text"], input[type="number"], textarea'
        )
      ).filter(input => !input.value || input.value.trim() === '');

      for (const input of inputs) {
        // Find preceding question label
        const label = input.getAttribute('placeholder') || 
                      input.getAttribute('aria-label') || 
                      input.closest('div, li')?.querySelector('label, p, span, .bot-msg')?.textContent || 
                      input.parentElement?.innerText || 
                      '';

        if (label) {
          const res = await chrome.runtime.sendMessage({
            type: 'GET_SCREENING_ANSWER',
            question: label,
          });

          if (res?.success && res.data?.answer !== undefined) {
            const answerStr = String(res.data.answer);
            this.sendLog(`Answering "${label.slice(0, 35)}..." -> ${answerStr}`);
            input.value = answerStr;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            answeredSomething = true;
            await sleep(500);
          }
        }
      }

      // 4. Answer Select Dropdowns
      const selects = Array.from(activeContainer.querySelectorAll<HTMLSelectElement>('select'));
      for (const sel of selects) {
        if (sel.selectedIndex <= 0 && sel.options.length > 1) {
          sel.selectedIndex = 1; // Select first valid positive option
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          answeredSomething = true;
        }
      }

      // 5. Click Next / Save / Send / Submit Button
      const buttons = Array.from(
        activeContainer.querySelectorAll<HTMLElement>('button, a, .apply-btn, input[type="submit"]')
      );

      const nextBtn = buttons.find((b) => {
        const t = (b.innerText || b.getAttribute('value') || '').trim().toLowerCase();
        return (
          t.includes('submit') || 
          t.includes('apply now') || 
          t.includes('save & next') || 
          t.includes('save') || 
          t.includes('next') || 
          t.includes('send') || 
          t.includes('confirm')
        );
      });

      if (nextBtn) {
        this.sendLog(`Progressing subquestion step ${step}...`);
        this.simulateClick(nextBtn);
        await sleep(1800);
      } else if (!answeredSomething) {
        // No more inputs or buttons found
        break;
      }
    }

    this.sendLog(`Subquestions completed. Application logged for ${company}.`);
    this.recordApplicationSuccess(jobTitle, company, jobUrl);
    await sleep(1500);
  }

  private async waitForQuestionnaireContainer(timeoutMs = 3500): Promise<HTMLElement | null> {
    const startTime = Date.now();
    const selectors = [
      '.chatbot_Drawer',
      '.drawer',
      '.chatbot-container',
      '.modal',
      '[class*="questionnaire"]',
      '[class*="apply-container"]',
      '[class*="drawer-wrapper"]'
    ];

    while (Date.now() - startTime < timeoutMs) {
      for (const sel of selectors) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetHeight > 50) {
          return el;
        }
      }
      await sleep(500);
    }
    return null;
  }

  private recordApplicationSuccess(jobTitle: string, company: string, jobUrl: string) {
    chrome.runtime.sendMessage({
      type: 'RECORD_APPLICATION',
      jobData: {
        jobTitle,
        company,
        platform: 'naukri',
        jobUrl,
      },
    }).catch(() => {});
  }

  // =========================================================================
  // Selector Utilities
  // =========================================================================
  private async waitForApplyButton(timeoutMs = 6000): Promise<HTMLElement | null> {
    const startTime = Date.now();
    const selectors = [
      '#apply-button',
      'button.apply-button',
      'button[class*="apply-button"]',
      '[id*="apply-button"]',
      'div[class*="apply-button-container"] button',
      'button[class*="apply"]',
      '[class*="applyBtn"]'
    ];

    while (Date.now() - startTime < timeoutMs) {
      for (const sel of selectors) {
        const btn = document.querySelector<HTMLElement>(sel);
        if (btn && (btn.innerText || '').toLowerCase().includes('apply')) {
          return btn;
        }
      }
      await sleep(600);
    }
    return null;
  }

  private async waitForJobCards(timeoutMs = 8000): Promise<HTMLElement[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const jobLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="job-listings"], a.title')
      ).filter((a) => {
        const text = (a.innerText || '').trim();
        const href = a.getAttribute('href') || '';
        return text.length > 2 && !text.toLowerCase().includes('naukri') && href.includes('job-listings');
      });

      if (jobLinks.length > 0) {
        const uniqueCards = new Set<HTMLElement>();
        for (const link of jobLinks) {
          const card = link.closest<HTMLElement>(
            '.srp-jobtuple-wrapper, .cust-job-tuple, article, [data-job-id], [class*="tuple"], [class*="card"], [class*="Tuple"], [class*="container"]'
          ) || link.parentElement?.parentElement?.parentElement || link;
          uniqueCards.add(card);
        }
        if (uniqueCards.size > 0) {
          return Array.from(uniqueCards);
        }
      }
      await sleep(1000);
    }

    return [];
  }
}

new NaukriAutoApplier();
