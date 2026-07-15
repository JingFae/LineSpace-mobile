import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { colors, radius, spacing } from "@linespace/tokens";
import { AppScreen } from "@linespace/ui";
import { useAuth } from "@/auth/AuthSessionProvider";
import { clearEmailConfirmationFragment, parseEmailConfirmationUrl } from "@/auth/emailConfirmation";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      router.replace("/(tabs)" as Href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="welcome back" subtitle="Return to your lines and conversations.">
      <AuthField
        autoCapitalize="none"
        autoCorrect={false}
        label="username"
        onChangeText={setUsername}
        placeholder="your username"
        returnKeyType="next"
        value={username}
      />
      <PasswordField
        onChangeText={setPassword}
        onSubmitEditing={submit}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        value={password}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        disabled={submitting || !username.trim() || !password}
        label="log in"
        loading={submitting}
        onPress={submit}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>New to LineSpace?</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push("/register" as Href)}>
          <Text style={styles.link}>create an account</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

export function RegisterScreen() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const normalized = username.trim();
    if (normalized.length < 3 || normalized.length > 32) {
      setError("Username must contain 3–32 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await register({
        username: normalized,
        email: email.trim(),
        password,
        confirmPassword
      });
      if (result.emailConfirmationRequired && !result.session) {
        router.replace("/auth/confirm" as Href);
      } else {
        router.replace("/(tabs)" as Href);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="make room for lines" subtitle="Create an account for poems made together.">
      <AuthField
        autoCapitalize="none"
        autoCorrect={false}
        helper="3–32 characters"
        label="username"
        onChangeText={setUsername}
        placeholder="choose a username"
        returnKeyType="next"
        value={username}
      />
      <AuthField
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        label="email"
        onChangeText={setEmail}
        placeholder="you@example.com"
        returnKeyType="next"
        value={email}
      />
      <PasswordField
        onChangeText={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        value={password}
      />
      <AuthField
        autoCapitalize="none"
        label="confirm password"
        onChangeText={setConfirmPassword}
        onSubmitEditing={submit}
        placeholder="repeat your password"
        returnKeyType="done"
        secureTextEntry={!showPassword}
        value={confirmPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        disabled={
          submitting || !username.trim() || !email.trim() || !password || !confirmPassword
        }
        label="create account"
        loading={submitting}
        onPress={submit}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account?</Text>
        <Pressable accessibilityRole="link" onPress={() => router.replace("/login" as Href)}>
          <Text style={styles.link}>log in</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

export function EmailConfirmationScreen() {
  const { completeEmailConfirmation } = useAuth();
  const [state, setState] = useState<"waiting" | "verifying" | "failed">("waiting");

  const processCallback = async (url: string) => {
    const callback = parseEmailConfirmationUrl(url);
    if (callback.kind === "none") return;
    clearEmailConfirmationFragment();
    if (callback.kind === "error") {
      setState("failed");
      return;
    }
    setState("verifying");
    const restored = await completeEmailConfirmation(callback.session);
    if (!restored) setState("failed");
  };

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      void processCallback(window.location.href);
    } else {
      void Linking.getInitialURL().then((url) => {
        if (url) void processCallback(url);
      });
    }
    const subscription = Linking.addEventListener("url", ({ url }) => void processCallback(url));
    return () => subscription.remove();
  }, [completeEmailConfirmation]);

  if (state === "verifying") {
    return (
      <AuthShell title="confirming your email" subtitle="One moment while we finish setting up your session.">
        <ActivityIndicator color={colors.accent} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={state === "failed" ? "confirmation link expired" : "check your email"}
      subtitle={state === "failed" ? "Please request a new confirmation email or try signing in again." : "Your account is waiting for email confirmation."}
    >
      <Text style={styles.confirmationCopy}>
        {state === "failed"
          ? "We could not safely verify that link. No token was kept in this URL or on the device."
          : "Follow the confirmation link we sent, then return here to log in. Your session will not be active until the email is confirmed."}
      </Text>
      <PrimaryButton label="return to log in" onPress={() => router.replace("/login" as Href)} />
      <Pressable accessibilityRole="link" onPress={() => router.replace("/register" as Href)} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>try a different email</Text>
      </Pressable>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <AppScreen padded={false} style={styles.screen} contentContainerStyle={styles.screenContent}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark} accessibilityLabel="LineSpace">
            <Text style={styles.brandLine}>line</Text>
            <Text style={styles.brandSpace}>space</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function AuthField({ label, helper, ...props }: { label: string; helper?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      </View>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.profileMuted} style={styles.input} {...props} />
    </View>
  );
}

function PasswordField({ showPassword, setShowPassword, ...props }: { showPassword: boolean; setShowPassword: (value: boolean) => void } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>password</Text>
      <View style={styles.passwordRow}>
        <TextInput
          accessibilityLabel="password"
          autoCapitalize="none"
          placeholder="your password"
          placeholderTextColor={colors.profileMuted}
          secureTextEntry={!showPassword}
          style={styles.passwordInput}
          {...props}
        />
        <Pressable accessibilityLabel={showPassword ? "Hide password" : "Show password"} accessibilityRole="button" onPress={() => setShowPassword(!showPassword)} style={styles.togglePassword}>
          <Text style={styles.togglePasswordText}>{showPassword ? "hide" : "show"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PrimaryButton({ label, disabled, loading = false, onPress }: { label: string; disabled?: boolean; loading?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && styles.primaryButtonMuted]}>
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.profileCanvas },
  screenContent: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingVertical: 44 },
  brandMark: { flexDirection: "row", alignItems: "baseline", marginBottom: 38 },
  brandLine: { color: colors.ink, fontSize: 28, fontWeight: "600" },
  brandSpace: { color: colors.accent, fontSize: 28, fontWeight: "300" },
  title: { color: colors.ink, fontSize: 31, lineHeight: 37, fontWeight: "500" },
  subtitle: { marginTop: 8, color: colors.profileMuted, fontSize: 15, lineHeight: 21 },
  form: { marginTop: 34, gap: 18 },
  field: { gap: 7 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  helper: { color: colors.profileMuted, fontSize: 11 },
  input: { height: 52, paddingHorizontal: 15, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, color: colors.ink, fontSize: 16 },
  passwordRow: { height: 52, flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  passwordInput: { flex: 1, height: "100%", paddingHorizontal: 15, color: colors.ink, fontSize: 16 },
  togglePassword: { minWidth: 56, minHeight: 44, alignItems: "center", justifyContent: "center" },
  togglePasswordText: { color: colors.accent, fontSize: 12 },
  error: { color: colors.accent, fontSize: 13, lineHeight: 18 },
  primaryButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.ink },
  primaryButtonMuted: { opacity: 0.58 },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: "600" },
  switchRow: { flexDirection: "row", justifyContent: "center", gap: 5 },
  switchText: { color: colors.profileMuted, fontSize: 13 },
  link: { color: colors.accent, fontSize: 13, fontWeight: "500" },
  confirmationCopy: { color: colors.inkSoft, fontSize: 16, lineHeight: 24 },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: colors.accent, fontSize: 14 }
});
