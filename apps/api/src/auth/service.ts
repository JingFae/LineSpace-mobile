import type {
  AuthRegistrationResult,
  AuthSessionResult,
  AuthUser
} from "@linespace/api-client";
import type { ValidatedLogin, ValidatedPasswordChange, ValidatedRegistration } from "./validation.js";

export interface AuthService {
  register(input: ValidatedRegistration): Promise<AuthRegistrationResult>;
  login(input: ValidatedLogin): Promise<AuthSessionResult>;
  refresh(refreshToken: string): Promise<AuthSessionResult>;
  logout(accessToken: string): Promise<void>;
  authenticate(accessToken: string): Promise<AuthUser>;
  changePassword(accessToken: string, input: ValidatedPasswordChange): Promise<void>;
}
