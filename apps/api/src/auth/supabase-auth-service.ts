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
} from "./errors";
import type { AuthService } from "./service";
import type { ValidatedLogin, ValidatedRegistration } from "./validation";

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
    private readonly adminClient: SupabaseClient,
    private readonly emailRedirectTo?: string
  ) {}

  async register(input: ValidatedRegistration): Promise<AuthRegistrationResult> {
    const existing = await this.findProfileByUsername(input.username);
    if (existing) {
      throw new ApiAuthError("USERNAME_TAKEN", 409, "This username is unavailable.");
    }

    const { data, error } = await this.createPublicClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        ...(this.emailRedirectTo ? { emailRedirectTo: this.emailRedirectTo } : {}),
        data: {
          username: input.username,
          handle: input.username,
          display_name: input.username
        }
      }
    });

    if (error || !data.user) {
      throw this.registrationError(error);
    }

    const profile = await this.findProfileByAuthUserId(data.user.id);
    if (!profile) {
      throw new ApiAuthError(
        "REGISTRATION_FAILED",
        503,
        "Registration could not be completed."
      );
    }

    return {
      user: mapAuthUser(profile, data.user),
      session: data.session ? mapSession(data.session) : null,
      emailConfirmationRequired: data.session === null
    };
  }

  async login(input: ValidatedLogin): Promise<AuthSessionResult> {
    const profile = await this.findProfileByUsername(input.username);
    if (!profile?.auth_user_id) {
      throw invalidCredentialsError();
    }

    const { data: adminData, error: adminError } =
      await this.adminClient.auth.admin.getUserById(profile.auth_user_id);
    const email = adminData.user?.email;
    if (adminError || !email) {
      throw invalidCredentialsError();
    }

    const { data, error } = await this.createPublicClient().auth.signInWithPassword({
      email,
      password: input.password
    });
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
        "Password does not meet the configured security requirements."
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
    createClient(url, serviceRoleKey, serverAuthOptions),
    process.env.AUTH_EMAIL_REDIRECT_URL
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
    email: user.email ?? "",
    displayName: profile.display_name,
    emailConfirmed: Boolean(user.email_confirmed_at),
    createdAt: profile.created_at
  };
}

function providerErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}
