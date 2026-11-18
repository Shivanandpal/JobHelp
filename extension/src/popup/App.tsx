import React, { useState, useEffect } from 'react';
import { ApiClient } from '../services/api.js';
import { Briefcase, Mail, ExternalLink, Sparkles, RefreshCw } from 'lucide-react';

export default function PopupApp() {
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let me;
      try {
        me = await ApiClient.getMe();
      } catch {
        const loginRes = await ApiClient.devLogin('candidate.jobseeker@gmail.com', 'Alex Candidate');
        me = { user: loginRes.user };
      }
      setUser(me.user);

      const jobsData = await ApiClient.getJobs();
      setSummary(jobsData.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openSidepanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.windowId) {
        chrome.sidePanel.open({ windowId: tab.windowId });
        window.close();
      }
    });
  };

  return (
    <div className="w-80 p-4 bg-white font-sans text-slate-800">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xs font-bold text-slate-900 leading-tight">AutoApply & Tracker</h2>
          <p className="text-[11px] text-slate-500">{user?.email || 'Logged in via Gmail'}</p>
        </div>
        <button onClick={loadData} className="p-1 hover:bg-slate-100 rounded text-slate-500">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5 py-3">
        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
          <span className="block text-base font-extrabold text-blue-600">{summary?.total || 0}</span>
          <span className="text-[9px] uppercase font-bold text-slate-400">Total</span>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
          <span className="block text-base font-extrabold text-indigo-600">{summary?.INTERVIEW_SCHEDULED || 0}</span>
          <span className="text-[9px] uppercase font-bold text-slate-400">Interviews</span>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
          <span className="block text-base font-extrabold text-emerald-600">{summary?.SHORTLISTED || 0}</span>
          <span className="text-[9px] uppercase font-bold text-slate-400">Shortlist</span>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
          <span className="block text-base font-extrabold text-rose-600">{summary?.REJECTED || 0}</span>
          <span className="text-[9px] uppercase font-bold text-slate-400">Rejected</span>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <button
          onClick={openSidepanel}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open Full Side Panel Hub
        </button>
        <p className="text-[10px] text-slate-400 text-center">
          Tracks LinkedIn, Indeed & Naukri • Gmail Sync Active
        </p>
      </div>
    </div>
  );
}
