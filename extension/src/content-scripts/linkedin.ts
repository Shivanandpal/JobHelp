console.log('[AutoApply: LinkedIn Engine] Injected and active on:', window.location.href);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class LinkedInAutoApplier {
  private isRunning = false;

  constructor() {
    this.createFloatingStatusBanner();
    this.initListeners();
  }

  private sendLog(text: string) {
    console.log(`[LinkedIn AutoApply] ${text}`);
    this.updateStatus(text, this.isRunning);
    chrome.runtime.sendMessage({
      type: 'AUTOAPPLY_LOG',
      log: `[LinkedIn] ${text}`,
    }).catch(() => {});
  }

  private createFloatingStatusBanner() {
    if (document.getElementById('autoapply-linkedin-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'autoapply-linkedin-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 14px 20px;
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.35);
      z-index: 99999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid #334155;
      max-width: 420px;
    `;
    banner.innerHTML = `
      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e;" id="li-indicator"></span>
      <span id="autoapply-status-text" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">AutoApply LinkedIn: Ready</span>
      <button id="autoapply-action-btn" style="background:#2563eb; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600; shrink:0;">Start</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('autoapply-action-btn')?.addEventListener('click', () => {
      if (this.isRunning) this.stop();
      else this.start();
    });
  }

  private updateStatus(text: string, running = true) {
    const el = document.getElementById('autoapply-status-text');
    const btn = document.getElementById('autoapply-action-btn');
    const indicator = document.getElementById('li-indicator');
    if (el) el.innerText = text;
    if (btn) {
      btn.innerText = running ? 'Stop' : 'Start';
      btn.style.background = running ? '#dc2626' : '#2563eb';
    }
    if (indicator) {
      indicator.style.background = running ? '#22c55e' : '#f59e0b';
    }
  }

  private initListeners() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'START_LINKEDIN_APPLY') {
        this.start(msg.maxDaily || 25);
      }
      if (msg.type === 'STOP_APPLY' || msg.type === 'STOP_LINKEDIN_APPLY') {
        this.stop();
      }
    });
  }

  async start(maxApplications = 20) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.sendLog('Scanning for Easy Apply jobs...');

    // Wait for search result cards
    await sleep(2000);
    const jobCards = Array.from(document.querySelectorAll<HTMLElement>(
      '.job-card-container, .jobs-search-results__list-item, div[data-job-id]'
    ));

    if (jobCards.length === 0) {
      this.sendLog('No job cards found. Make sure you are on LinkedIn jobs search.');
      this.isRunning = false;
      return;
    }

    this.sendLog(`Found ${jobCards.length} jobs. Beginning application loop...`);
    let appliedCount = 0;

    for (let i = 0; i < jobCards.length; i++) {
      if (!this.isRunning || appliedCount >= maxApplications) break;

      const card = jobCards[i];
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.click();
      await sleep(2500);

      const titleEl = document.querySelector<HTMLElement>('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1');
      const companyEl = document.querySelector<HTMLElement>('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, [class*="company-name"]');
      const jobTitle = titleEl?.innerText?.trim() || 'Software Engineer';
      const company = companyEl?.innerText?.trim() || 'Company';

      this.sendLog(`[${i + 1}/${jobCards.length}] Inspecting: "${jobTitle}" at "${company}"...`);

      // Find "Easy Apply" button
      const applyBtn = document.querySelector<HTMLButtonElement>(
        'button.jobs-apply-button, button[aria-label*="Easy Apply"]'
      );

      if (!applyBtn || !applyBtn.innerText.toLowerCase().includes('easy apply')) {
        this.sendLog(`Skipping ${company}: No Easy Apply.`);
        continue;
      }

      this.sendLog(`Clicking Easy Apply for ${company}...`);
      applyBtn.click();
      await sleep(2000);

      const applied = await this.handleApplicationModal(jobTitle, company);
      if (applied) {
        appliedCount++;
        this.sendLog(`✓ Successfully applied to ${company}! (${appliedCount}/${maxApplications})`);
        await sleep(3500);
      }
    }

    this.sendLog(`Autonomous session finished! Applied to ${appliedCount} jobs.`);
    this.isRunning = false;
  }

  stop() {
    this.isRunning = false;
    this.sendLog('AutoApply stopped by user.');
  }

  private async handleApplicationModal(jobTitle: string, company: string): Promise<boolean> {
    const maxSteps = 8;
    for (let step = 0; step < maxSteps; step++) {
      if (!this.isRunning) return false;

      // Fill visible form inputs
      await this.autoFillFormFields();

      // Look for buttons: "Submit application", "Review", "Next"
      const submitBtn = document.querySelector<HTMLButtonElement>('button[aria-label*="Submit application"], button[aria-label*="Submit"]');
      if (submitBtn) {
        submitBtn.click();
        await sleep(2000);

        chrome.runtime.sendMessage({
          type: 'RECORD_APPLICATION',
          jobData: {
            jobTitle,
            company,
            platform: 'linkedin',
            jobUrl: window.location.href,
          },
        }).catch(() => {});

        const dismissBtn = document.querySelector<HTMLButtonElement>('button[aria-label*="Dismiss"], button.artdeco-modal__dismiss');
        dismissBtn?.click();
        return true;
      }

      const nextOrReviewBtn = document.querySelector<HTMLButtonElement>(
        'button[aria-label*="Continue to next step"], button[aria-label*="Review your application"], button.artdeco-button--primary'
      );

      if (nextOrReviewBtn && nextOrReviewBtn.innerText.match(/Next|Review|Continue/i)) {
        nextOrReviewBtn.click();
        await sleep(1500);
      } else {
        break;
      }
    }

    // Discard if stuck
    const closeBtn = document.querySelector<HTMLButtonElement>('button[aria-label*="Dismiss"], button.artdeco-modal__dismiss');
    closeBtn?.click();
    await sleep(500);
    const discardBtn = document.querySelector<HTMLButtonElement>('button[data-control-name="discard_application_confirm_btn"]');
    discardBtn?.click();
    return false;
  }

  private async autoFillFormFields() {
    const textInputs = document.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"]');
    for (const input of Array.from(textInputs)) {
      if (input.value) continue;
      const label = input.getAttribute('aria-label') || input.parentElement?.innerText || '';
      if (!label) continue;

      const response = await chrome.runtime.sendMessage({
        type: 'GET_SCREENING_ANSWER',
        question: label,
      });

      if (response?.success && response.data?.answer !== undefined) {
        input.value = String(response.data.answer);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    const radioInputs = document.querySelectorAll<HTMLInputElement>('input[type="radio"][value="Yes"]');
    for (const radio of Array.from(radioInputs)) {
      if (!radio.checked) {
        radio.click();
      }
    }
  }
}

new LinkedInAutoApplier();
