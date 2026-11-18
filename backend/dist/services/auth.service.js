"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const google_auth_library_1 = require("google-auth-library");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const index_js_1 = require("../config/index.js");
const store_service_js_1 = require("./store.service.js");
class AuthService {
    googleClient;
    constructor() {
        this.googleClient = new google_auth_library_1.OAuth2Client(index_js_1.config.google.clientId, index_js_1.config.google.clientSecret, index_js_1.config.google.redirectUri);
    }
    generateJwt(user) {
        return jsonwebtoken_1.default.sign({
            userId: user.id,
            email: user.email,
            name: user.name,
        }, index_js_1.config.jwtSecret, { expiresIn: '30d' });
    }
    verifyJwt(token) {
        try {
            return jsonwebtoken_1.default.verify(token, index_js_1.config.jwtSecret);
        }
        catch {
            return null;
        }
    }
    async loginWithGoogleToken(idToken, refreshToken, accessToken) {
        let email = '';
        let name = 'Candidate';
        let picture = '';
        // If real Google Client ID is configured, verify signature
        if (index_js_1.config.google.clientId) {
            try {
                const ticket = await this.googleClient.verifyIdToken({
                    idToken,
                    audience: index_js_1.config.google.clientId,
                });
                const payload = ticket.getPayload();
                if (payload?.email) {
                    email = payload.email;
                    name = payload.name || name;
                    picture = payload.picture || '';
                }
            }
            catch (err) {
                console.warn('Google token verification fallback (mock/dev mode)', err);
            }
        }
        // Fallback decoding if token is a basic payload or dev mock token
        if (!email) {
            try {
                const decoded = jsonwebtoken_1.default.decode(idToken);
                if (decoded?.email) {
                    email = decoded.email;
                    name = decoded.name || name;
                    picture = decoded.picture || '';
                }
            }
            catch {
                // Fallback for local testing
                email = 'candidate.demo@gmail.com';
                name = 'Demo Candidate';
            }
        }
        let user = store_service_js_1.store.getUserByEmail(email);
        if (!user) {
            user = {
                id: (0, uuid_1.v4)(),
                email,
                name,
                picture,
                googleRefreshToken: refreshToken,
                googleAccessToken: accessToken,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
        }
        else {
            user.name = name || user.name;
            user.picture = picture || user.picture;
            if (refreshToken)
                user.googleRefreshToken = refreshToken;
            if (accessToken)
                user.googleAccessToken = accessToken;
        }
        store_service_js_1.store.saveUser(user);
        const token = this.generateJwt(user);
        return { user, token };
    }
    // Developer quick login for quick local testing without setting Google Cloud keys immediately
    devMockLogin(email, name) {
        let user = store_service_js_1.store.getUserByEmail(email);
        if (!user) {
            user = {
                id: (0, uuid_1.v4)(),
                email,
                name,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            store_service_js_1.store.saveUser(user);
        }
        const token = this.generateJwt(user);
        return { user, token };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
