import type {
  AuthRegistrationResult,
  AuthSessionResult,
  AuthUser
} from "@linespace/api-client";
import { ApiAuthError, type AuthService } from "./auth";
import { handleApiRequest } from "./routes";

const lili: AuthUser = {
  id: "user-lili",
  authUserId: "11111111-1111-4111-8111-111111111111",
  username: "lili",
  email: "lili@example.com",
  displayName: "Lili",
  emailConfirmed: true,
  createdAt: "2026-01-01T00:00:00.000Z"
};

class FakeAuthService implements AuthService {
  private readonly usernames = new Set([lili.username]);

  async register(input: {
    username: string;
    email: string;
    password: string;
  }): Promise<AuthRegistrationResult> {
    if (this.usernames.has(input.username)) {
      throw new ApiAuthError("USERNAME_TAKEN", 409, "This username is unavailable.");
    }
    this.usernames.add(input.username);
    return {
      user: {
        ...lili,
        id: `user-${input.username}`,
        authUserId: "22222222-2222-4222-8222-222222222222",
        username: input.username,
        email: input.email,
        displayName: input.username
      },
      session: null,
      emailConfirmationRequired: true
    };
  }

  async login(input: { username: string; password: string }): Promise<AuthSessionResult> {
    if (input.username !== lili.username || input.password !== "ValidPass123") {
      throw new ApiAuthError(
        "INVALID_CREDENTIALS",
        401,
        "Invalid username or password."
      );
    }
    return sessionResult(lili);
  }

  async refresh(refreshToken: string): Promise<AuthSessionResult> {
    if (refreshToken !== "valid-refresh-token") {
      throw new ApiAuthError(
        "INVALID_REFRESH_TOKEN",
        401,
        "A valid refresh token is required."
      );
    }
    return sessionResult(lili);
  }

  async logout(accessToken: string): Promise<void> {
    if (accessToken !== "valid-access-token") {
      throw new ApiAuthError("INVALID_TOKEN", 401, "A valid access token is required.");
    }
  }

  async authenticate(accessToken: string): Promise<AuthUser> {
    if (accessToken !== "valid-access-token") {
      throw new ApiAuthError("INVALID_TOKEN", 401, "A valid access token is required.");
    }
    return lili;
  }
}

function sessionResult(user: AuthUser): AuthSessionResult {
  return {
    user,
    session: {
      accessToken: "valid-access-token",
      refreshToken: "valid-refresh-token",
      expiresAt: 1_900_000_000,
      expiresIn: 3600,
      tokenType: "bearer"
    }
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request(
  service: AuthService,
  method: string,
  pathname: string,
  body?: unknown,
  accessToken?: string
) {
  return handleApiRequest(method, pathname, new URLSearchParams(), body, {
    authService: service,
    authorization: accessToken ? `Bearer ${accessToken}` : undefined
  });
}

async function main() {
  const auth = new FakeAuthService();
  const password = "AnotherPass123";

  const registered = await request(auth, "POST", "/v1/auth/register", {
    username: "New.Poet",
    email: "new.poet@example.com",
    password,
    confirmPassword: password
  });
  assert(registered.status === 201, "Valid registration did not return 201.");
  assert(
    (registered.body as AuthRegistrationResult).user.username === "new.poet",
    "Registration did not normalize the username."
  );

  const duplicate = await request(auth, "POST", "/v1/auth/register", {
    username: "NEW.POET",
    email: "other@example.com",
    password,
    confirmPassword: password
  });
  assert(duplicate.status === 409, "Duplicate case-insensitive username was not rejected.");
  assert(
    (duplicate.body as { code?: string }).code === "USERNAME_TAKEN",
    "Duplicate username returned the wrong code."
  );

  const weakPassword = "weak";
  const weak = await request(auth, "POST", "/v1/auth/register", {
    username: "weak-poet",
    email: "weak@example.com",
    password: weakPassword,
    confirmPassword: weakPassword
  });
  assert(weak.status === 422, "Weak password was not rejected.");
  assert(!JSON.stringify(weak.body).includes(weakPassword), "Weak password leaked in response.");

  const wrongExisting = await request(auth, "POST", "/v1/auth/login", {
    username: "lili",
    password: "WrongPass123"
  });
  const wrongMissing = await request(auth, "POST", "/v1/auth/login", {
    username: "missing-user",
    password: "WrongPass123"
  });
  assert(wrongExisting.status === 401 && wrongMissing.status === 401, "Bad login was not 401.");
  assert(
    JSON.stringify(wrongExisting.body) === JSON.stringify(wrongMissing.body),
    "Login response reveals whether a username exists."
  );

  const login = await request(auth, "POST", "/v1/auth/login", {
    username: "LILI",
    password: "ValidPass123"
  });
  assert(login.status === 200, "Valid username login failed.");

  const invalidMe = await request(
    auth,
    "GET",
    "/v1/auth/me",
    undefined,
    "invalid-token"
  );
  assert(invalidMe.status === 401, "Invalid access token was not rejected.");

  const me = await request(auth, "GET", "/v1/auth/me", undefined, "valid-access-token");
  assert(me.status === 200 && (me.body as AuthUser).id === lili.id, "Auth me failed.");

  const invalidRefresh = await request(auth, "POST", "/v1/auth/refresh", {
    refreshToken: "invalid-refresh"
  });
  assert(invalidRefresh.status === 401, "Invalid refresh token was not rejected.");

  const logout = await request(
    auth,
    "POST",
    "/v1/auth/logout",
    undefined,
    "valid-access-token"
  );
  assert(logout.status === 204, "Logout did not return 204.");

  const unauthenticatedWrite = await request(auth, "POST", "/v1/drafts", {
    ownerId: "user-ray",
    mode: "draft"
  });
  assert(unauthenticatedWrite.status === 401, "Unauthenticated write was not rejected.");

  const spoofedDraft = await request(
    auth,
    "POST",
    "/v1/drafts",
    { ownerId: "user-ray", mode: "draft" },
    "valid-access-token"
  );
  assert(spoofedDraft.status === 201, "Authenticated draft creation failed.");
  assert(
    (spoofedDraft.body as { ownerId?: string }).ownerId === lili.id,
    "Draft owner trusted the request body instead of the verified token."
  );

  const crossUserProfile = await request(
    auth,
    "PUT",
    "/v1/users/user-ray/profile",
    { displayName: "Not Ray" },
    "valid-access-token"
  );
  assert(crossUserProfile.status === 403, "Cross-user profile write was not rejected.");

  process.stdout.write(
    "Auth check passed: registration, case-insensitive uniqueness, weak passwords, generic login errors, refresh, logout, JWT validation, and write ownership.\n"
  );
}

await main();
