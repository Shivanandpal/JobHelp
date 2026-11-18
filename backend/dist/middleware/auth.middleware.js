"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const auth_service_js_1 = require("../services/auth.service.js");
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: missing or invalid Bearer token' });
        return;
    }
    const token = authHeader.split(' ')[1];
    const payload = auth_service_js_1.authService.verifyJwt(token);
    if (!payload) {
        res.status(401).json({ error: 'Unauthorized: token expired or invalid' });
        return;
    }
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
}
