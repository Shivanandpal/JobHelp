import React, { useState, useEffect } from 'react';
import { ApiClient } from '../services/api.js';
import { JobApplication, ApplicationStatus, RecruiterEmailMessage } from '../types.js';
import { 
  Briefcase, 
  Mail, 
  Send, 
  UserCheck, 
  Play, 
  Square, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Sparkles, 
  ExternalLink, 
  Sliders, 
  FileText, 
  Terminal, 
  LogIn
} from 'lucide-react';

interface PlatformConnections {
  naukri: boolean;
  linkedin: boolean;
  indeed: boolean;
}

export default function SidepanelApp() {
  const [activeTab, setActiveTab] = useState<'tracker' | 'autoapply' | 'emails' | 'profile'>('autoapply');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [emails, setEmails] = useState<RecruiterEmailMessage[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Platform connection status
  const [connections, setConnections] = useState<PlatformConnections>({
    naukri: false,
    linkedin: false,
    indeed: false,
  });

  // AutoApply settings
  const [selectedPlatform, setSelectedPlatform] = useState<'naukri' | 'linkedin' | 'indeed'>('naukri');
  const [isRunning, setIsRunning] = useState(false);
  const [maxDaily, setMaxDaily] = useState(25);
  const [targetTitle, setTargetTitle] = useState('Full Stack Developer');
  const [targetLocation, setTargetLocation] = useState('Bangalore');
  const [logs, setLogs] = useState<string[]>([
    'System standby. Connect your recruiting account and click "Launch Autonomous Apply".'
  ]);

  useEffect(() => {
    initAuthAndData();
    checkConnections();

    // Listen to live events from background and content scripts
    const eventListener = (msg: any) => {
      if (msg.type === 'AUTOAPPLY_LOG' && msg.log) {
        const time = new Date().toLocaleTimeString();
        setLogs((prev) => [`[${time}] ${msg.log}`, ...prev.slice(0, 49)]);
      }

      // Live real-time update when a new job is applied
      if (msg.type === 'NEW_JOB_APPLIED' && msg.job) {
        setJobs((prev) => {
          if (prev.some((j) => j.jobUrl === msg.job.jobUrl)) return prev;
          return [msg.job, ...prev];
        });
        setSummary((prev: any) => ({
          ...(prev || {}),
          total: (prev?.total || 0) + 1,
          APPLIED: (prev?.APPLIED || 0) + 1,
        }));
      }
    };

    chrome.runtime.onMessage.addListener(eventListener);
    return () => chrome.runtime.onMessage.removeListener(eventListener);
  }, []);

  const checkConnections = async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'CHECK_PLATFORM_CONNECTIONS' });
      if (res?.success && res.connections) {
        setConnections(res.connections);
      }
    } catch (e) {
      console.warn('Could not check connections:', e);
    }
  };

  const handleOpenLogin = (platform: 'naukri' | 'linkedin' | 'indeed') => {
    chrome.runtime.sendMessage({ type: 'OPEN_PLATFORM_LOGIN', platform });
    setTimeout(checkConnections, 6000);
  };

  const initAuthAndData = async () => {
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

      await refreshData();
    } catch (err) {
      console.error('Init error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      // 1. Fetch from extension local storage
      const stored = await chrome.storage.local.get(['localApplications']);
      const localList: JobApplication[] = stored.localApplications || [];

      // 2. Fetch from backend API
      let backendList: JobApplication[] = [];
      try {
        const [jobsData, emailsData, resumeData] = await Promise.all([
          ApiClient.getJobs(),
          ApiClient.getEmails(),
          ApiClient.getResume(),
        ]);
        backendList = jobsData.applications || [];
        setEmails(emailsData.emails || []);
        setProfile(resumeData.profile);
      } catch (e) {
        console.warn('Backend sync note (using extension storage):', e);
      }

      // 3. Merge & deduplicate by jobUrl or id
      const combinedMap = new Map<string, JobApplication>();
      for (const app of [...localList, ...backendList]) {
        const key = app.jobUrl || app.id;
        if (!combinedMap.has(key)) {
          combinedMap.set(key, app);
        }
      }
      const mergedJobs = Array.from(combinedMap.values());
      setJobs(mergedJobs);

      // 4. Compute accurate summary metrics
      const counts: Record<string, number> = {
        total: mergedJobs.length,
        APPLIED: 0,
        SHORTLISTED: 0,
        INTERVIEW_SCHEDULED: 0,
        REJECTED: 0,
        VIEWED: 0,
        NOT_VIEWED: 0,
      };
      for (const j of mergedJobs) {
        if (counts[j.status] !== undefined) counts[j.status]++;
      }
      setSummary(counts);
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  const handleSyncEmails = async () => {
    setLoading(true);
    try {
      await ApiClient.syncEmails();
      await refreshData();
    } catch (err) {
      console.error('Email sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMcqReview = async (jobId: string, recruiterEmail?: string) => {
    setFeedbackLoading(jobId);
    setFeedbackSuccess(null);
    try {
      const res = await ApiClient.requestFeedback(jobId, recruiterEmail);
      setFeedbackSuccess(`✓ MCQ Review sent: ${res.message}`);
      await refreshData();
      setTimeout(() => setFeedbackSuccess(null), 5000);
    } catch (err: any) {
      alert(`Error sending review request: ${err.message}`);
    } finally {
      setFeedbackLoading(null);
    }
  };

  const startAutonomousRun = async () => {
    setIsRunning(true);
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      `[${time}] 🚀 Initiating autonomous run for "${targetTitle}" in "${targetLocation}" on ${selectedPlatform.toUpperCase()}...`,
      ...prev
    ]);

    try {
      await chrome.runtime.sendMessage({
        type: 'START_AUTONOMOUS_RUN',
        platform: selectedPlatform,
        targetTitle,
        targetLocation,
        maxDaily,
      });
    } catch (err: any) {
      setLogs((prev) => [`[${time}] ❌ Launch error: ${err.message}`, ...prev]);
      setIsRunning(false);
    }
  };

  const stopAutonomousRun = async () => {
    setIsRunning(false);
    await chrome.runtime.sendMessage({ type: 'STOP_AUTONOMOUS_RUN' });
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] 🛑 Autonomous run stopped.`, ...prev]);
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'SHORTLISTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><CheckCircle2 className="w-3 h-3"/> Shortlisted</span>;
      case 'INTERVIEW_SCHEDULED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800"><Clock className="w-3 h-3"/> Interview</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"><XCircle className="w-3 h-3"/> Rejected</span>;
      case 'VIEWED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"><UserCheck className="w-3 h-3"/> Viewed</span>;
      case 'NOT_VIEWED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700"><Clock className="w-3 h-3"/> Not Viewed</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800"><Send className="w-3 h-3"/> Applied</span>;
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const matchesFilter = filterStatus === 'ALL' || j.status === filterStatus;
    const matchesSearch = j.company.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          j.jobTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow">
            {user?.name ? user.name[0] : 'U'}
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
              {user?.name || 'Candidate Hub'}
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected"></span>
            </h1>
            <p className="text-xs text-slate-500 leading-none">{user?.email || 'Logged in via Gmail'}</p>
          </div>
        </div>
        <button
          onClick={() => { refreshData(); checkConnections(); }}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          title="Refresh Data & Connections"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Tabs Bar */}
      <nav className="flex bg-white border-b border-slate-200 px-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('tracker')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'tracker' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" /> Tracker ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('autoapply')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'autoapply' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Auto-Apply
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'emails' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="w-3.5 h-3.5" /> Recruiter Mails
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'profile' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Resume
        </button>
      </nav>

      {feedbackSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-4 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {/* Main Tab Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ============================================================== */}
        {/* 1. TRACKER TAB */}
        {/* ============================================================== */}
        {activeTab === 'tracker' && (
          <div className="space-y-4">
            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                <span className="block text-lg font-extrabold text-blue-600">{summary?.total || 0}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Applied</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                <span className="block text-lg font-extrabold text-indigo-600">{summary?.INTERVIEW_SCHEDULED || 0}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Interview</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                <span className="block text-lg font-extrabold text-emerald-600">{summary?.SHORTLISTED || 0}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Shortlisted</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                <span className="block text-lg font-extrabold text-rose-600">{summary?.REJECTED || 0}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Rejected</span>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search job or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="APPLIED">Applied</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="INTERVIEW_SCHEDULED">Interview</option>
                <option value="VIEWED">Viewed</option>
                <option value="NOT_VIEWED">Not Viewed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Applications List */}
            <div className="space-y-2.5">
              {filteredJobs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No applications recorded yet. Launch an auto-apply session to start tracking!
                </div>
              ) : (
                filteredJobs.map((job) => (
                  <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-slate-300 transition space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 leading-snug">{job.jobTitle}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700">{job.company}</span>
                          <span>•</span>
                          <span className={`uppercase text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            job.platform === 'naukri' ? 'bg-amber-100 text-amber-800' :
                            job.platform === 'linkedin' ? 'bg-blue-100 text-blue-800' :
                            'bg-sky-100 text-sky-800'
                          }`}>
                            {job.platform}
                          </span>
                        </p>
                      </div>
                      <div>{getStatusBadge(job.status)}</div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Applied: {new Date(job.appliedDate).toLocaleDateString()}</span>
                      <a href={job.jobUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                        View Job <ExternalLink className="w-2.5 h-2.5"/>
                      </a>
                    </div>

                    {/* MCQ Review Request for Rejected Jobs */}
                    {job.status === 'REJECTED' && (
                      <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-xs mt-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-rose-900 text-[11px]">Candidate Rejected</p>
                            <p className="text-[10px] text-rose-700">Request quick 30-sec MCQ review from recruiter.</p>
                          </div>
                          {job.feedbackCompleted ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                              Feedback Received ✓
                            </span>
                          ) : job.feedbackRequested ? (
                            <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-medium text-[10px]">
                              Review Sent
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSendMcqReview(job.id, job.recruiterEmail)}
                              disabled={feedbackLoading === job.id}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold transition shrink-0 flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              {feedbackLoading === job.id ? 'Sending...' : 'Request Review'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. AUTO-APPLY ENGINE TAB */}
        {/* ============================================================== */}
        {activeTab === 'autoapply' && (
          <div className="space-y-4">
            {/* Connected Recruiting Apps Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" /> Connected Recruiting Apps
                </h3>
                <button
                  onClick={checkConnections}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Re-check
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                The extension runs natively inside your logged-in browser session with zero human intervention.
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {/* Naukri Connection Card */}
                <div className={`p-2.5 rounded-lg border text-center transition ${
                  connections.naukri ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="font-bold text-xs text-slate-900 block">Naukri</span>
                  <div className="flex items-center justify-center gap-1 text-[10px] my-1 font-semibold">
                    <span className={`w-2 h-2 rounded-full ${connections.naukri ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                    <span className={connections.naukri ? 'text-emerald-700' : 'text-slate-500'}>
                      {connections.naukri ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  {!connections.naukri && (
                    <button
                      onClick={() => handleOpenLogin('naukri')}
                      className="w-full mt-1 py-1 px-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 shadow-xs"
                    >
                      <LogIn className="w-2.5 h-2.5" /> Login Once
                    </button>
                  )}
                </div>

                {/* LinkedIn Connection Card */}
                <div className={`p-2.5 rounded-lg border text-center transition ${
                  connections.linkedin ? 'bg-blue-50/60 border-blue-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="font-bold text-xs text-slate-900 block">LinkedIn</span>
                  <div className="flex items-center justify-center gap-1 text-[10px] my-1 font-semibold">
                    <span className={`w-2 h-2 rounded-full ${connections.linkedin ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                    <span className={connections.linkedin ? 'text-emerald-700' : 'text-slate-500'}>
                      {connections.linkedin ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  {!connections.linkedin && (
                    <button
                      onClick={() => handleOpenLogin('linkedin')}
                      className="w-full mt-1 py-1 px-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 shadow-xs"
                    >
                      <LogIn className="w-2.5 h-2.5" /> Login Once
                    </button>
                  )}
                </div>

                {/* Indeed Connection Card */}
                <div className={`p-2.5 rounded-lg border text-center transition ${
                  connections.indeed ? 'bg-sky-50/60 border-sky-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="font-bold text-xs text-slate-900 block">Indeed</span>
                  <div className="flex items-center justify-center gap-1 text-[10px] my-1 font-semibold">
                    <span className={`w-2 h-2 rounded-full ${connections.indeed ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                    <span className={connections.indeed ? 'text-emerald-700' : 'text-slate-500'}>
                      {connections.indeed ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  {!connections.indeed && (
                    <button
                      onClick={() => handleOpenLogin('indeed')}
                      className="w-full mt-1 py-1 px-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 shadow-xs"
                    >
                      <LogIn className="w-2.5 h-2.5" /> Login Once
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Target Job & Location Configuration */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Autonomous Search & Apply Parameters
              </h3>

              {/* Platform Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Target Recruiting Platform</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPlatform('naukri')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                      selectedPlatform === 'naukri' 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Naukri
                  </button>
                  <button
                    onClick={() => setSelectedPlatform('linkedin')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                      selectedPlatform === 'linkedin' 
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    LinkedIn
                  </button>
                  <button
                    onClick={() => setSelectedPlatform('indeed')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                      selectedPlatform === 'indeed' 
                        ? 'bg-sky-600 text-white border-sky-700 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Indeed
                  </button>
                </div>
              </div>

              {/* Title & Location Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Target Job Title</label>
                  <input
                    type="text"
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                    placeholder="e.g. React Developer"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Location / Remote</label>
                  <input
                    type="text"
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    placeholder="e.g. Bangalore"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Daily Cap */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 flex justify-between mb-1">
                  <span>Safety Cap: Max Applications per Run</span>
                  <span className="font-bold text-blue-600">{maxDaily} jobs</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={maxDaily}
                  onChange={(e) => setMaxDaily(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Primary Action Button */}
              {isRunning ? (
                <button
                  onClick={stopAutonomousRun}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow"
                >
                  <Square className="w-3.5 h-3.5" /> Stop Autonomous Run
                </button>
              ) : (
                <button
                  onClick={startAutonomousRun}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Launch Autonomous Apply (Zero-Click)
                </button>
              )}
            </div>

            {/* Real-time Activity Terminal */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2 shadow">
              <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                <span className="text-[11px] font-mono font-bold flex items-center gap-1.5 text-slate-300">
                  <Terminal className="w-3 h-3 text-emerald-400" /> Live Execution Stream
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </div>
              <div className="h-36 overflow-y-auto font-mono text-[11px] space-y-1.5 text-slate-300 pr-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed break-words">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. RECRUITER EMAILS TAB */}
        {/* ============================================================== */}
        {activeTab === 'emails' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recruiter Inbox</h2>
                <p className="text-[11px] text-slate-500">Live Gmail synchronization & status detection</p>
              </div>
              <button
                onClick={handleSyncEmails}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition"
              >
                <RefreshCw className="w-3 h-3" /> Sync Gmail
              </button>
            </div>

            <div className="space-y-2.5">
              {emails.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">No recruiter emails detected yet.</div>
              ) : (
                emails.map((mail) => (
                  <div key={mail.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">{mail.recruiterName}</span>
                      {getStatusBadge(mail.detectedStatus)}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 leading-snug">{mail.subject}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{mail.snippet}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>{mail.company}</span>
                      <span>{new Date(mail.receivedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. RESUME & PROFILE TAB */}
        {/* ============================================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Candidate Profile</h3>
                  <p className="text-[11px] text-slate-500">{profile?.fullName || user?.name}</p>
                </div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                  {profile?.yearsOfExperience || 3} Years Exp
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Parsed Skills</label>
                <div className="flex flex-wrap gap-1">
                  {(profile?.skills || ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL']).map((skill: string) => (
                    <span key={skill} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[11px]">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-semibold">Notice Period</span>
                  <span className="font-bold text-slate-800">{profile?.preferences?.noticePeriodDays || 15} Days</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-semibold">Work Authorization</span>
                  <span className="font-bold text-emerald-700">Authorized (No Visa)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
