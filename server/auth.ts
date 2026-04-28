import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { storage } from "./storage";
import { log } from "./index";
import type { User } from "@shared/schema";

// Extend Express types so req.user is typed
declare global {
  namespace Express {
    interface User {
      id: string;
      googleId: string;
      email: string;
      name: string;
      avatarUrl?: string;
      createdAt: string;
    }
  }
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  // ── Session Middleware ──────────────────────────────────────────────────────
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        // In production (Railway), cookies go over HTTPS
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );

  // ── Passport Middleware ─────────────────────────────────────────────────────
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize: store just the user ID in the session cookie
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize: fetch full user from storage on each request
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });

  // ── Google OAuth Strategy ───────────────────────────────────────────────────
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    log("⚠️  Google OAuth credentials not set — skipping Google strategy", "auth");
    return;
  }

  const callbackURL =
    process.env.NODE_ENV === "production"
      ? "https://diplomatic-learning-production-f128.up.railway.app/api/auth/google/callback"
      : "http://localhost:5000/api/auth/google/callback";

  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: any, user?: User | false) => void,
      ) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value ?? "";
          const name = profile.displayName ?? email;
          const avatarUrl = profile.photos?.[0]?.value;

          // Find or create the user
          let user = await storage.getUserByGoogleId(googleId);
          if (!user) {
            user = await storage.createUser({ googleId, email, name, avatarUrl });
            log(`New user registered: ${email}`, "auth");
          } else {
            log(`User signed in: ${email}`, "auth");
          }

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );

  // ── Auth Routes ─────────────────────────────────────────────────────────────

  // 1️⃣  Start the Google OAuth flow
  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] }),
  );

  // 2️⃣  Google redirects back here with a code
  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/login?error=auth_failed",
    }),
    (_req: Request, res: Response) => {
      // Success → back to home page
      res.redirect("/");
    },
  );

  // 3️⃣  Return current user (or null if not logged in)
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.json(null);
    }
  });

  // 4️⃣  Sign out
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  log("✅ Google OAuth ready", "auth");
}

// Middleware: protect routes that require a logged-in user
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
}
