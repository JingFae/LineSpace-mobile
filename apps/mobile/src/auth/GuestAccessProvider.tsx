import { router, type Href } from "expo-router";
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@linespace/tokens";
import { useAuth } from "./AuthSessionProvider";

type GuestAccessContextValue = {
  isGuest: boolean;
  requireAccount: (action?: string) => boolean;
};

const GuestAccessContext = createContext<GuestAccessContextValue | undefined>(undefined);

export function GuestAccessProvider({ children }: PropsWithChildren) {
  const { status, leaveGuestMode } = useAuth();
  const [prompt, setPrompt] = useState<string | null>(null);
  const isGuest = status === "guest";

  const requireAccount = useCallback((action = "continue") => {
    if (!isGuest) return true;
    setPrompt(action);
    return false;
  }, [isGuest]);

  const value = useMemo(() => ({ isGuest, requireAccount }), [isGuest, requireAccount]);

  const openLogin = async () => {
    setPrompt(null);
    await leaveGuestMode();
    router.replace("/login" as Href);
  };

  return (
    <GuestAccessContext.Provider value={value}>
      {children}
      <Modal animationType="fade" onRequestClose={() => setPrompt(null)} transparent visible={prompt !== null}>
        <View style={styles.root}>
          <Pressable accessibilityLabel="Keep browsing" onPress={() => setPrompt(null)} style={styles.backdrop} />
          <View accessibilityViewIsModal style={styles.card}>
            <View style={styles.mark}><Text style={styles.markText}>✦</Text></View>
            <Text style={styles.eyebrow}>MAKE THIS SPACE YOURS</Text>
            <Text style={styles.title}>Create an account to {prompt ?? "continue"}.</Text>
            <Text style={styles.copy}>
              Guest browsing stays private and leaves no saved activity. Sign in or create an account when you are ready to join the conversation.
            </Text>
            <Pressable accessibilityRole="button" onPress={openLogin} style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}>
              <Text style={styles.primaryText}>Create or sign in</Text>
              <Text style={styles.primaryArrow}>→</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setPrompt(null)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Keep browsing</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </GuestAccessContext.Provider>
  );
}

export function useGuestAccess() {
  const context = useContext(GuestAccessContext);
  if (!context) throw new Error("useGuestAccess must be used inside GuestAccessProvider.");
  return context;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,14,13,0.48)" },
  card: { alignItems: "center", backgroundColor: "#FFFCF7", borderColor: "rgba(255,255,255,0.62)", borderRadius: 26, borderWidth: 1, maxWidth: 370, paddingHorizontal: 22, paddingBottom: 18, paddingTop: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.2, shadowRadius: 30, width: "100%" },
  mark: { alignItems: "center", backgroundColor: "#FFE7E9", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  markText: { color: colors.accent, fontSize: 20 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginTop: 14 },
  title: { color: colors.ink, fontFamily: "Georgia", fontSize: 23, lineHeight: 29, marginTop: 8, textAlign: "center" },
  copy: { color: colors.inkSoft, fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: "center" },
  primary: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 15, flexDirection: "row", justifyContent: "space-between", marginTop: 19, minHeight: 54, paddingHorizontal: 16, width: "100%" },
  primaryPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  primaryArrow: { color: colors.white, fontSize: 20 },
  secondary: { alignItems: "center", justifyContent: "center", marginTop: 6, minHeight: 44, width: "100%" },
  secondaryText: { color: colors.profileMuted, fontSize: 12, fontWeight: "700" }
});
