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
    <AuthShell
      eyebrow="YOUR NEXT LINE STARTS HERE"
      title="Welcome back."
      subtitle="Return to your lines, your people, and the conversations still unfolding."
    >
      <AuthField
        autoCapitalize="none"
        autoCorrect={false}
        label="username"
        onChangeText={setUsername}
        placeholder="your public handle"
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
      {error ? <AuthError message={error} /> : null}
      <PrimaryButton
        disabled={submitting || !username.trim() || !password}
        label="Enter LineSpace"
        loading={submitting}
        onPress={submit}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>New to LineSpace?</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push("/register" as Href)}>
          <Text style={styles.link}>Create an account</Text>
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
    <AuthShell
      eyebrow="MAKE ROOM FOR SOMETHING NEW"
      formTitle="Create your account"
      title="Create your space."
      subtitle="A softer place for poems made together, one thoughtful line at a time."
    >
      <AuthField
        autoCapitalize="none"
        autoCorrect={false}
        helper="3–32 characters"
        label="username"
        onChangeText={setUsername}
        placeholder="choose a public handle"
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
      {error ? <AuthError message={error} /> : null}
      <PrimaryButton
        disabled={
          submitting || !username.trim() || !email.trim() || !password || !confirmPassword
        }
        label="Create my space"
        loading={submitting}
        onPress={submit}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account?</Text>
        <Pressable accessibilityRole="link" onPress={() => router.replace("/login" as Href)}>
          <Text style={styles.link}>Log in</Text>
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
      <AuthShell
        eyebrow="ONE MORE SMALL STEP"
        formTitle="Email confirmation"
        title="Confirming your email."
        subtitle="One moment while we finish setting up your session."
      >
        <ActivityIndicator color={colors.accent} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow={state === "failed" ? "THAT LINK HAS EXPIRED" : "CHECK YOUR INBOX"}
      formTitle="Email confirmation"
      title={state === "failed" ? "Let's try that again." : "Your space is waiting."}
      subtitle={
        state === "failed"
          ? "Please request a new confirmation email or try signing in again."
          : "Follow the confirmation link we sent, then return here to continue."
      }
    >
      <Text style={styles.confirmationCopy}>
        {state === "failed"
          ? "We could not safely verify that link. No token was kept in this URL or on the device."
          : "Your session will not be active until the email is confirmed. Once it is, your lines will be ready for you."}
      </Text>
      <PrimaryButton label="Return to log in" onPress={() => router.replace("/login" as Href)} />
      <Pressable
        accessibilityRole="link"
        onPress={() => router.replace("/register" as Href)}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Try a different email</Text>
      </Pressable>
    </AuthShell>
  );
}

function AuthShell({
  eyebrow,
  formTitle = "Sign in to continue",
  title,
  subtitle,
  children
}: {
  eyebrow: string;
  formTitle?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AppScreen padded={false} style={styles.screen} contentContainerStyle={styles.screenContent}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View pointerEvents="none" style={styles.decorativeField}>
            <View style={styles.decorativeHalo} />
            <View style={styles.decorativeOrb} />
            <View style={styles.decorativeOrbit} />
            <Text style={styles.decorativeQuote}>write<br />together</Text>
            <Text style={styles.decorativeCaption}>01 / 01</Text>
          </View>
          <View style={styles.topRow}>
            <View style={styles.wordmark}>
              <Text style={styles.wordmarkLine}>line</Text>
              <Text style={styles.wordmarkSpace}>space</Text>
            </View>
            <Text style={styles.topNote}>a social notebook<br />for poets</Text>
          </View>
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.formCard}>
            <View style={styles.formCardHeader}>
              <Text style={styles.formCardTitle}>{formTitle}</Text>
              <View style={styles.liveDot} />
            </View>
            <View style={styles.form}>{children}</View>
          </View>
          <Text style={styles.footnote}>By continuing, you agree to keep this a generous place to write.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function AuthField({
  label,
  helper,
  ...props
}: { label: string; helper?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.profileMuted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

function PasswordField({
  showPassword,
  setShowPassword,
  ...props
}: {
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
} & React.ComponentProps<typeof TextInput>) {
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
        <Pressable
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          accessibilityRole="button"
          onPress={() => setShowPassword(!showPassword)}
          style={styles.togglePassword}
        >
          <Text style={styles.togglePasswordText}>{showPassword ? "hide" : "show"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <View style={styles.errorCard}>
      <View style={styles.errorDot} />
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  disabled,
  loading = false,
  onPress
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.primaryButtonPressed,
        disabled && styles.primaryButtonMuted
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          <Text style={styles.primaryButtonText}>{label}</Text>
          <Text style={styles.primaryButtonArrow}>↗</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F5F2EC" },
  screenContent: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 30,
    paddingBottom: 28
  },
  decorativeField: {
    position: "absolute",
    top: 50,
    right: -34,
    height: 190,
    width: 190
  },
  decorativeHalo: {
    position: "absolute",
    top: 8,
    right: 0,
    height: 158,
    width: 158,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "rgba(245,50,74,0.2)"
  },
  decorativeOrb: {
    position: "absolute",
    top: 31,
    right: 23,
    height: 111,
    width: 111,
    borderRadius: 56,
    backgroundColor: "#F5324A",
    opacity: 0.92
  },
  decorativeOrbit: {
    position: "absolute",
    top: 43,
    right: 35,
    height: 87,
    width: 87,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.58)"
  },
  decorativeQuote: {
    position: "absolute",
    top: 66,
    right: 42,
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 17,
    letterSpacing: 0.4,
    transform: [{ rotate: "-8deg" }]
  },
  decorativeCaption: {
    position: "absolute",
    top: 167,
    right: 36,
    color: colors.profileMuted,
    fontSize: 9,
    letterSpacing: 1.4
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingRight: 4
  },
  wordmark: { flexDirection: "row", alignItems: "baseline" },
  wordmarkLine: { color: colors.ink, fontSize: 26, fontWeight: "700", letterSpacing: -1 },
  wordmarkSpace: { color: colors.accent, fontSize: 26, fontWeight: "300", letterSpacing: -1 },
  topNote: {
    color: colors.profileMuted,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.2,
    textAlign: "right",
    textTransform: "uppercase"
  },
  intro: { marginTop: 76, maxWidth: 300 },
  eyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6
  },
  title: {
    color: colors.ink,
    fontSize: 39,
    fontWeight: "600",
    letterSpacing: -1.2,
    lineHeight: 44,
    marginTop: 12
  },
  subtitle: {
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 11,
    maxWidth: 305
  },
  formCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "rgba(21,21,21,0.07)",
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 31,
    padding: 18,
    shadowColor: "#7E776E",
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 11 },
    elevation: 2
  },
  formCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  formCardTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  liveDot: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: 7 },
  form: { gap: 17, marginTop: 17 },
  field: { gap: 7 },
  labelRow: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  label: { color: colors.ink, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  helper: { color: colors.profileMuted, fontSize: 10 },
  input: {
    backgroundColor: "#FBFAF8",
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    height: 55,
    paddingHorizontal: 15
  },
  passwordRow: {
    alignItems: "center",
    backgroundColor: "#FBFAF8",
    borderColor: colors.line,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    height: 55
  },
  passwordInput: { color: colors.ink, flex: 1, fontSize: 16, height: "100%", paddingHorizontal: 15 },
  togglePassword: { alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 58 },
  togglePasswordText: { color: colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FFF0EE",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 10
  },
  errorDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, width: 7 },
  error: { color: "#B52E3E", flex: 1, fontSize: 12, lineHeight: 17 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 17
  },
  primaryButtonPressed: { backgroundColor: "#373431" },
  primaryButtonMuted: { opacity: 0.47 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  primaryButtonArrow: { color: colors.white, fontSize: 22, fontWeight: "300" },
  switchRow: { alignItems: "center", flexDirection: "row", gap: 5, justifyContent: "center" },
  switchText: { color: colors.profileMuted, fontSize: 12 },
  link: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  confirmationCopy: { color: colors.inkSoft, fontSize: 15, lineHeight: 23 },
  secondaryButton: { alignItems: "center", justifyContent: "center", minHeight: 48 },
  secondaryButtonText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  footnote: {
    color: colors.profileMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 17,
    textAlign: "center"
  }
});
