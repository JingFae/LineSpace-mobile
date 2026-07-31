import { createHash } from "node:crypto";
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import type {
  AuthRegistrationResult,
  AuthSession,
  AuthSessionResult,
  AuthUser
} from "@linespace/api-client";
import {
  ApiAuthError,
  invalidCredentialsError,
  invalidTokenError
} from "./errors.js";
import type { AuthService } from "./service.js";
import type { ValidatedLogin, ValidatedPasswordChange, ValidatedRegistration } from "./validation.js";

type UserIdentityRow = {
  id: string;
  auth_user_id: string | null;
  handle: string;
  display_name: string;
  created_at: string;
};

export class SupabaseAuthService implements AuthService {
  constructor(
    private readonly createPublicClient: () => SupabaseClient,
    private readonly adminClient: SupabaseClient
  ) {}

  async register(input: ValidatedRegistration): Promise<AuthRegistrationResult> {
    const existing = await this.findProfileByUsername(input.username);
    if (existing) {
      throw new ApiAuthError("USERNAME_TAKEN", 409, "This username is unavailable.");
    }

    const internalEmail = createInternalAuthEmail(input.username);
    const { data: created, error: createError } =
      await this.adminClient.auth.admin.createUser({
        email: internalEmail,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          username: input.username,
          handle: input.username,
          display_name: input.username
        }
      });

    if (createError || !created.user) {
      throw this.registrationError(createError);
    }

    try {
      const profile = await this.findProfileByAuthUserId(created.user.id);
      if (!profile) {
        throw new ApiAuthError(
          "REGISTRATION_FAILED",
          503,
          "Registration could not be completed."
        );
      }

      const { data: signedIn, error: signInError } =
        await this.createPublicClient().auth.signInWithPassword({
          email: internalEmail,
          password: input.password
        });
      if (signInError || !signedIn.session || !signedIn.user) {
        throw this.registrationError(signInError);
      }

      return {
        user: mapAuthUser(profile, signedIn.user),
        session: mapSession(signedIn.session),
        emailConfirmationRequired: false
      };
    } catch (error) {
      // Registration must not leave an unusable Auth identity or business
      // profile behind when profile provisioning or initial sign-in fails.
      await this.adminClient.auth.admin.deleteUser(created.user.id).catch(() => undefined);
      throw error;
    }
  }

  async login(input: ValidatedLogin): Promise<AuthSessionResult> {
    const profile = await this.findProfileByUsername(input.username);
    if (!profile?.auth_user_id) {
      throw invalidCredentialsError();
    }

    const { data: adminData, error: adminError } =
      await this.adminClient.auth.admin.getUserById(profile.auth_user_id);
    let authUser = adminData.user;
    if (adminError || !authUser?.email) {
      throw invalidCredentialsError();
    }

    const email = authUser.email;
    let signInResult = await this.createPublicClient().auth.signInWithPassword({
      email,
      password: input.password
    });

    // A correct password for an older account can still reach the provider's
    // email_not_confirmed state. Only then migrate that identity to the new
    // no-confirmation policy and retry the same credential once.
    if (
      providerErrorCode(signInResult.error) === "email_not_confirmed" &&
      !authUser.email_confirmed_at
    ) {
      const { data: confirmed, error: confirmError } =
        await this.adminClient.auth.admin.updateUserById(authUser.id, {
          email_confirm: true
        });
      if (confirmError || !confirmed.user?.email) {
        throw invalidCredentialsError();
      }
      authUser = confirmed.user;
      signInResult = await this.createPublicClient().auth.signInWithPassword({
        email,
        password: input.password
      });
    }

    const { data, error } = signInResult;
    if (error || !data.session || !data.user) {
      throw invalidCredentialsError();
    }

    return {
      user: mapAuthUser(profile, data.user),
      session: mapSession(data.session)
    };
  }

  async refresh(refreshToken: string): Promise<AuthSessionResult> {
    const { data, error } = await this.createPublicClient().auth.refreshSession({
      refresh_token: refreshToken
    });
    if (error || !data.session || !data.user) {
      throw new ApiAuthError(
        "INVALID_REFRESH_TOKEN",
        401,
        "A valid refresh token is required."
      );
    }

    const profile = await this.findProfileByAuthUserId(data.user.id);
    if (!profile) {
      throw this.profileMissingError();
    }

    return {
      user: mapAuthUser(profile, data.user),
      session: mapSession(data.session)
    };
  }

  async logout(accessToken: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.signOut(accessToken, "local");
    if (error) {
      throw invalidTokenError();
    }
  }

  async authenticate(accessToken: string): Promise<AuthUser> {
    const { data, error } = await this.createPublicClient().auth.getUser(accessToken);
    if (error || !data.user) {
      throw invalidTokenError();
    }

    const profile = await this.findProfileByAuthUserId(data.user.id);
    if (!profile) {
      throw this.profileMissingError();
    }
    return mapAuthUser(profile, data.user);
  }

  async changePassword(accessToken: string, input: ValidatedPasswordChange): Promise<void> {
    const { data, error } = await this.createPublicClient().auth.getUser(accessToken);
    if (error || !data.user?.email) throw invalidTokenError();

    const verification = await this.createPublicClient().auth.signInWithPassword({
      email: data.user.email,
      password: input.currentPassword
    });
    if (verification.error || !verification.data.user) throw invalidCredentialsError();

    const updated = await this.adminClient.auth.admin.updateUserById(data.user.id, {
      password: input.newPassword
    });
    if (updated.error) {
      if (providerErrorCode(updated.error) === "weak_password") {
        throw new ApiAuthError(
          "WEAK_PASSWORD",
          422,
          "Password must contain at least 6 characters."
        );
      }
      throw this.providerUnavailableError();
    }
  }

  private async findProfileByUsername(username: string) {
    const { data, error } = await this.adminClient
      .from("users")
      .select("id,auth_user_id,handle,display_name,created_at")
      .eq("handle", username)
      .maybeSingle();
    if (error) {
      throw this.providerUnavailableError();
    }
    return data as UserIdentityRow | null;
  }

  private async findProfileByAuthUserId(authUserId: string) {
    const { data, error } = await this.adminClient
      .from("users")
      .select("id,auth_user_id,handle,display_name,created_at")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) {
      throw this.providerUnavailableError();
    }
    return data as UserIdentityRow | null;
  }

  private registrationError(error: unknown) {
    const code = providerErrorCode(error);
    if (code === "weak_password") {
      return new ApiAuthError(
        "WEAK_PASSWORD",
        422,
        "Password must contain at least 6 characters."
      );
    }
    return new ApiAuthError(
      "REGISTRATION_FAILED",
      400,
      "Registration could not be completed."
    );
  }

  private providerUnavailableError() {
    return new ApiAuthError(
      "AUTH_PROVIDER_UNAVAILABLE",
      503,
      "Authentication is temporarily unavailable."
    );
  }

  private profileMissingError() {
    return new ApiAuthError(
      "AUTH_PROFILE_MISSING",
      403,
      "The authenticated account is not linked to a LineSpace profile."
    );
  }
}

let defaultService: SupabaseAuthService | undefined;

export function getServerAuthService(): AuthService {
  if (defaultService) return defaultService;

  const url = process.env.SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) {
    throw new ApiAuthError(
      "AUTH_NOT_CONFIGURED",
      503,
      "Authentication is not configured."
    );
  }

  const serverAuthOptions = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  } as const;

  defaultService = new SupabaseAuthService(
    () => createClient(url, publishableKey, serverAuthOptions),
    createClient(url, serviceRoleKey, serverAuthOptions)
  );
  return defaultService;
}

function mapSession(session: Session): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
    expiresIn: session.expires_in,
    tokenType: session.token_type
  };
}

function mapAuthUser(profile: UserIdentityRow, user: User): AuthUser {
  return {
    id: profile.id,
    authUserId: user.id,
    username: profile.handle,
    // Supabase password auth still stores an internal, non-deliverable email
    // identifier. It is an implementation detail and must not enter the product
    // profile or client-visible account data.
    email: "",
    displayName: profile.display_name,
    emailConfirmed: true,
    createdAt: profile.created_at
  };
}

function createInternalAuthEmail(username: string) {
  const digest = createHash("sha256")
    .update(`linespace:${username}`, "utf8")
    .digest("hex")
    .slice(0, 48);
  return `u-${digest}@users.linespace.invalid`;
}

function providerErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}
