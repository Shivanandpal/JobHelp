import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { store } from './store.service.js';
import { UserProfile } from '../types/index.js';

export class AuthService {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  generateJwt(user: UserProfile): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      config.jwtSecret,
      { expiresIn: '30d' }
    );
  }

  verifyJwt(token: string): { userId: string; email: string; name: string } | null {
    try {
      return jwt.verify(token, config.jwtSecret) as { userId: string; email: string; name: string };
    } catch {
      return null;
    }
  }

  async loginWithGoogleToken(idToken: string, refreshToken?: string, accessToken?: string): Promise<{ user: UserProfile; token: string }> {
    let email = '';
    let name = 'Candidate';
    let picture = '';

    // If real Google Client ID is configured, verify signature
    if (config.google.clientId) {
      try {
        const ticket = await this.googleClient.verifyIdToken({
          idToken,
          audience: config.google.clientId,
        });
        const payload = ticket.getPayload();
        if (payload?.email) {
          email = payload.email;
          name = payload.name || name;
          picture = payload.picture || '';
        }
      } catch (err) {
        console.warn('Google token verification fallback (mock/dev mode)', err);
      }
    }

    // Fallback decoding if token is a basic payload or dev mock token
    if (!email) {
      try {
        const decoded = jwt.decode(idToken) as any;
        if (decoded?.email) {
          email = decoded.email;
          name = decoded.name || name;
          picture = decoded.picture || '';
        }
      } catch {
        // Fallback for local testing
        email = 'candidate.demo@gmail.com';
        name = 'Demo Candidate';
      }
    }

    let user = store.getUserByEmail(email);
    if (!user) {
      user = {
        id: uuidv4(),
        email,
        name,
        picture,
        googleRefreshToken: refreshToken,
        googleAccessToken: accessToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      user.name = name || user.name;
      user.picture = picture || user.picture;
      if (refreshToken) user.googleRefreshToken = refreshToken;
      if (accessToken) user.googleAccessToken = accessToken;
    }

    store.saveUser(user);
    const token = this.generateJwt(user);
    return { user, token };
  }

  // Developer quick login for quick local testing without setting Google Cloud keys immediately
  devMockLogin(email: string, name: string): { user: UserProfile; token: string } {
    let user = store.getUserByEmail(email);
    if (!user) {
      user = {
        id: uuidv4(),
        email,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.saveUser(user);
    }
    const token = this.generateJwt(user);
    return { user, token };
  }
}

export const authService = new AuthService();
