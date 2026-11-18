(function(){var c=Object.defineProperty;var f=(n,e,t)=>e in n?c(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var l=(n,e,t)=>f(n,typeof e!="symbol"?e+"":e,t);console.log("[AutoApply: Indeed Engine] Injected and active");const r=n=>new Promise(e=>setTimeout(e,n));class y{constructor(){l(this,"isRunning",!1);this.createFloatingStatusBanner(),this.initListeners()}createFloatingStatusBanner(){var t;if(document.getElementById("autoapply-indeed-banner"))return;const e=document.createElement("div");e.id="autoapply-indeed-banner",e.style.cssText=`
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
    `,e.innerHTML=`
      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#38bdf8;"></span>
      <span id="autoapply-indeed-status">AutoApply Indeed: Ready</span>
      <button id="autoapply-indeed-btn" style="background:#0284c7; color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Run Auto-Apply</button>
    `,document.body.appendChild(e),(t=document.getElementById("autoapply-indeed-btn"))==null||t.addEventListener("click",()=>{this.isRunning?this.stop():this.start()})}updateStatus(e,t=!0){const s=document.getElementById("autoapply-indeed-status"),o=document.getElementById("autoapply-indeed-btn");s&&(s.innerText=e),o&&(o.innerText=t?"Stop":"Run Auto-Apply",o.style.background=t?"#dc2626":"#0284c7")}initListeners(){chrome.runtime.onMessage.addListener(e=>{e.type==="START_INDEED_APPLY"&&this.start(),e.type==="STOP_INDEED_APPLY"&&this.stop()})}async start(){var t,s;this.isRunning=!0,this.updateStatus("Scanning for Indeed jobs...",!0);const e=document.querySelectorAll(".job_seen_beacon, .resultContent");if(e.length===0){this.updateStatus("No job cards found. Open Indeed search results.",!1),this.isRunning=!1;return}for(const o of Array.from(e)){if(!this.isRunning)break;o.scrollIntoView({behavior:"smooth",block:"center"}),o.click(),await r(2500);const i=document.querySelector("h2.jobsearch-JobInfoHeader-title"),a=document.querySelector('[data-company-name="true"], .jobsearch-CompanyInfoContainer'),p=((t=i==null?void 0:i.innerText)==null?void 0:t.trim())||"Software Engineer",d=((s=a==null?void 0:a.innerText)==null?void 0:s.trim())||"Indeed Employer",u=document.querySelector('#indeedApplyButton, button[aria-label*="Apply now"]');u&&(this.updateStatus(`Applying: ${p} @ ${d}...`,!0),u.click(),await r(2500),chrome.runtime.sendMessage({type:"RECORD_APPLICATION",jobData:{jobTitle:p,company:d,platform:"indeed",jobUrl:window.location.href}}),this.updateStatus(`✓ Processed: ${d}`,!0),await r(3e3))}this.updateStatus("Indeed session finished.",!1),this.isRunning=!1}stop(){this.isRunning=!1,this.updateStatus("AutoApply stopped.",!1)}}new y;
})()
