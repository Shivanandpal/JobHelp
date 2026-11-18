"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_js_1 = require("./config/index.js");
const api_routes_js_1 = require("./routes/api.routes.js");
const app = (0, express_1.default)();
// Middlewares
app.use((0, cors_1.default)({
    origin: '*', // Allow extension origins (chrome-extension://*) and localhost
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Job Auto-Apply & Recruiter Mail Tracker Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// Mount API routes
app.use('/api', api_routes_js_1.apiRouter);
// Start server
app.listen(index_js_1.config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Backend running at http://localhost:${index_js_1.config.port}`);
    console.log(`📡 Ready to serve Chrome Extension & Webhooks`);
    console.log(`=======================================================`);
});
exports.default = app;
