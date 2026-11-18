console.log('[AutoApply: Indeed Engine] Injected and active');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class IndeedAutoApplier {
  private isRunning = false;

  constructor() {
    this.createFloatingStatusBanner();
    this.initListeners();
  }

  private createFloatingStatusBanner() {
    if (document.getElementById('autoapply-indeed-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'autoapply-indeed-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid #334155;
    `;
    banner.innerHTML = `
      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#38bdf8;"></span>
      <span id="autoapply-indeed-status">AutoApply Indeed: Ready</span>
      <button id="autoapply-indeed-btn" style="background:#0284c7; color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Run Auto-Apply</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('autoapply-indeed-btn')?.addEventListener('click', () => {
      if (this.isRunning) this.stop();
      else this.start();
    });
  }

  private updateStatus(text: string, running = true) {
    const el = document.getElementById('autoapply-indeed-status');
    const btn = document.getElementById('autoapply-indeed-btn');
    if (el) el.innerText = text;
    if (btn) {
      btn.innerText = running ? 'Stop' : 'Run Auto-Apply';
      btn.style.background = running ? '#dc2626' : '#0284c7';
    }
  }

  private initListeners() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'START_INDEED_APPLY') this.start();
      if (msg.type === 'STOP_INDEED_APPLY') this.stop();
    });
  }

  async start() {
    this.isRunning = true;
    this.updateStatus('Scanning for Indeed jobs...', true);

    const jobCards = document.querySelectorAll<HTMLElement>('.job_seen_beacon, .resultContent');
    if (jobCards.length === 0) {
      this.updateStatus('No job cards found. Open Indeed search results.', false);
      this.isRunning = false;
      return;
    }

    for (const card of Array.from(jobCards)) {
      if (!this.isRunning) break;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.click();
      await sleep(2500);

      const titleEl = document.querySelector<HTMLElement>('h2.jobsearch-JobInfoHeader-title');
      const companyEl = document.querySelector<HTMLElement>('[data-company-name="true"], .jobsearch-CompanyInfoContainer');
      const jobTitle = titleEl?.innerText?.trim() || 'Software Engineer';
      const company = companyEl?.innerText?.trim() || 'Indeed Employer';

      const applyBtn = document.querySelector<HTMLButtonElement>(
        '#indeedApplyButton, button[aria-label*="Apply now"]'
      );

      if (!applyBtn) continue;

      this.updateStatus(`Applying: ${jobTitle} @ ${company}...`, true);
      applyBtn.click();
      await sleep(2500);

      // Record applied state
      chrome.runtime.sendMessage({
        type: 'RECORD_APPLICATION',
        jobData: {
          jobTitle,
          company,
          platform: 'indeed',
          jobUrl: window.location.href,
        },
      });

      this.updateStatus(`✓ Processed: ${company}`, true);
      await sleep(3000);
    }

    this.updateStatus('Indeed session finished.', false);
    this.isRunning = false;
  }

  stop() {
    this.isRunning = false;
    this.updateStatus('AutoApply stopped.', false);
  }
}

new IndeedAutoApplier();
