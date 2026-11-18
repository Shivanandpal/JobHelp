"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
class StoreService {
    dbPath;
    data;
    constructor() {
        this.dbPath = path_1.default.join(index_js_1.config.dataDir, 'db.json');
        if (!fs_1.default.existsSync(index_js_1.config.dataDir)) {
            fs_1.default.mkdirSync(index_js_1.config.dataDir, { recursive: true });
        }
        this.data = this.loadData();
    }
    loadData() {
        try {
            if (fs_1.default.existsSync(this.dbPath)) {
                const raw = fs_1.default.readFileSync(this.dbPath, 'utf-8');
                return JSON.parse(raw);
            }
        }
        catch (e) {
            console.error('Error reading db.json, initializing fresh store', e);
        }
        return {
            users: {},
            resumes: {},
            jobs: {},
            emails: {},
            reviews: {},
        };
    }
    save() {
        try {
            fs_1.default.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
        }
        catch (e) {
            console.error('Error saving db.json', e);
        }
    }
    // User operations
    getUser(id) {
        return this.data.users[id];
    }
    getUserByEmail(email) {
        return Object.values(this.data.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
    }
    saveUser(user) {
        this.data.users[user.id] = { ...user, updatedAt: new Date().toISOString() };
        this.save();
        return this.data.users[user.id];
    }
    // Resume operations
    getResume(userId) {
        return this.data.resumes[userId];
    }
    saveResume(resume) {
        this.data.resumes[resume.userId] = { ...resume, updatedAt: new Date().toISOString() };
        this.save();
        return this.data.resumes[resume.userId];
    }
    // Job operations
    getJob(jobId) {
        return this.data.jobs[jobId];
    }
    getUserJobs(userId) {
        return Object.values(this.data.jobs)
            .filter((j) => j.userId === userId)
            .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
    }
    saveJob(job) {
        this.data.jobs[job.id] = job;
        this.save();
        return job;
    }
    updateJob(jobId, updates) {
        const existing = this.data.jobs[jobId];
        if (!existing)
            return undefined;
        const updated = { ...existing, ...updates };
        this.data.jobs[jobId] = updated;
        this.save();
        return updated;
    }
    // Email operations
    getUserEmails(userId) {
        return Object.values(this.data.emails)
            .filter((e) => e.userId === userId)
            .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    }
    saveEmail(email) {
        this.data.emails[email.id] = email;
        this.save();
        return email;
    }
    // Review operations
    getReview(reviewId) {
        return this.data.reviews[reviewId];
    }
    saveReview(review) {
        this.data.reviews[review.id] = review;
        this.save();
        return review;
    }
}
exports.store = new StoreService();
