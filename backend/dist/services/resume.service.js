"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeService = exports.ResumeService = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const store_service_js_1 = require("./store.service.js");
class ResumeService {
    async parsePdfBuffer(buffer) {
        try {
            const data = await (0, pdf_parse_1.default)(buffer);
            return data.text || '';
        }
        catch (error) {
            console.error('Error parsing PDF buffer:', error);
            return '';
        }
    }
    extractProfileFromText(userId, rawText, originalFileName) {
        // Robust heuristic extraction with fallback defaults
        const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const phoneMatch = rawText.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/);
        // Common skill dictionary to detect from text
        const commonSkills = [
            'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'SQL',
            'PostgreSQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Git', 'REST API',
            'HTML', 'CSS', 'Tailwind', 'Next.js', 'Express', 'GraphQL', 'Redux', 'C++',
            'Linux', 'CI/CD', 'Agile', 'Figma', 'System Design', 'Microservices'
        ];
        const detectedSkills = commonSkills.filter((skill) => new RegExp(`\\b${skill}\\b`, 'i').test(rawText));
        // Heuristic years of experience calculation
        let yearsOfExperience = 2; // Default reasonable baseline
        const expMatches = rawText.match(/(\d+)\+?\s*(years?|yrs?)\s*(of)?\s*experience/i);
        if (expMatches && expMatches[1]) {
            yearsOfExperience = parseInt(expMatches[1], 10);
        }
        // Extract basic name: first non-empty lines usually have the name
        const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        const fullName = lines.length > 0 && lines[0].length < 40 ? lines[0] : 'Candidate';
        const resumeData = {
            userId,
            fullName,
            email: emailMatch ? emailMatch[0] : '',
            phone: phoneMatch ? phoneMatch[0] : '',
            headline: 'Full Stack Software Engineer',
            summary: lines.slice(1, 5).join(' ').slice(0, 300) || 'Experienced software professional.',
            location: 'Bangalore, India',
            yearsOfExperience,
            skills: detectedSkills.length > 0 ? detectedSkills : ['JavaScript', 'React', 'Node.js'],
            education: [
                {
                    institution: 'University',
                    degree: 'Bachelor of Technology',
                    field: 'Computer Science',
                    endYear: '2024',
                },
            ],
            experience: [
                {
                    company: 'Tech Solutions Inc.',
                    title: 'Software Engineer',
                    startDate: '2022',
                    endDate: 'Present',
                    description: 'Developed scalable web applications and cloud integrations.',
                },
            ],
            links: {
                linkedin: 'https://linkedin.com/in/candidate',
                github: 'https://github.com/candidate',
            },
            preferences: {
                targetTitles: ['Software Engineer', 'Frontend Engineer', 'Full Stack Developer', 'React Developer'],
                desiredLocations: ['Remote', 'Bangalore', 'Hyderabad', 'Pune'],
                remoteOnly: false,
                noticePeriodDays: 15,
                expectedSalary: '18 LPA',
                currentSalary: '12 LPA',
                authorizedToWork: true,
                requiresSponsorship: false,
            },
            rawText,
            resumeFileName: originalFileName,
            updatedAt: new Date().toISOString(),
        };
        return store_service_js_1.store.saveResume(resumeData);
    }
    // Auto-answer questions encountered during LinkedIn Easy Apply / Indeed / Naukri
    answerScreeningQuestion(userId, question) {
        const profile = store_service_js_1.store.getResume(userId);
        const qLower = question.toLowerCase();
        if (!profile) {
            return { answer: 'Yes', confidence: 0.5 };
        }
        // Experience question
        if (qLower.includes('how many years') || qLower.includes('years of experience')) {
            for (const skill of profile.skills) {
                if (qLower.includes(skill.toLowerCase())) {
                    return { answer: profile.yearsOfExperience, confidence: 0.95 };
                }
            }
            return { answer: profile.yearsOfExperience, confidence: 0.9 };
        }
        // Work authorization & Sponsorship
        if (qLower.includes('sponsorship') || qLower.includes('require visa')) {
            return { answer: profile.preferences.requiresSponsorship ? 'Yes' : 'No', confidence: 0.95 };
        }
        if (qLower.includes('authorized to work') || qLower.includes('legally authorized')) {
            return { answer: profile.preferences.authorizedToWork ? 'Yes' : 'No', confidence: 0.95 };
        }
        // Notice period
        if (qLower.includes('notice period') || qLower.includes('how soon can you start')) {
            return { answer: `${profile.preferences.noticePeriodDays} days`, confidence: 0.9 };
        }
        // Expected CTC / Salary
        if (qLower.includes('expected ctc') || qLower.includes('expected salary') || qLower.includes('compensation')) {
            return { answer: profile.preferences.expectedSalary || 'Negotiable', confidence: 0.9 };
        }
        // Current CTC
        if (qLower.includes('current ctc') || qLower.includes('current salary')) {
            return { answer: profile.preferences.currentSalary || 'Confidential', confidence: 0.9 };
        }
        // Relocation / Remote
        if (qLower.includes('willing to relocate') || qLower.includes('relocate')) {
            return { answer: 'Yes', confidence: 0.85 };
        }
        if (qLower.includes('remote') || qLower.includes('work from home')) {
            return { answer: 'Yes', confidence: 0.95 };
        }
        // General yes/no questions (e.g., background check, drug test, 18+ years old)
        if (qLower.includes('background check') || qLower.includes('drug test') || qLower.includes('18 years')) {
            return { answer: 'Yes', confidence: 0.9 };
        }
        // Default polite positive affirmative
        return { answer: 'Yes', confidence: 0.7 };
    }
}
exports.ResumeService = ResumeService;
exports.resumeService = new ResumeService();
