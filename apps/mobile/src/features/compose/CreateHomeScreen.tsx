import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";

export function CreateHomeScreen() {
  return (
    <AppScreen scroll padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>CREATE</Text>
          <Text style={styles.title}>Make space for a new line.</Text>
        </View>
      </View>
      <Text style={styles.intro}>Choose how you want to share your next idea with the LineSpace community.</Text>

      <CreateChoice
        accent="#1F1C18"
        description="A finished poem, thought or image-led post with your own layout."
        icon="✦"
        label="Post"
        onPress={() => router.push({ pathname: "/compose", params: { type: "post" } } as unknown as Href)}
      />
      <CreateChoice
        accent="#557B79"
        description="Set a prompt or rule and invite the community to continue the poem."
        icon="↗"
        label="Thread · Poem relay"
        onPress={() => router.push({ pathname: "/compose", params: { type: "thread" } } as unknown as Href)}
      />

      <View style={styles.footerCard}>
        <Text style={styles.footerTitle}>Your work stays yours</Text>
        <Text style={styles.footerBody}>Save at any stage. You can choose visibility, collaborators and publishing when the work feels ready.</Text>
      </View>
    </AppScreen>
  );
}

function CreateChoice({ label, description, icon, accent, onPress }: { label: string; description: string; icon: string; accent: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
      <View style={[styles.icon, { backgroundColor: accent }]}><Text style={styles.iconText}>{icon}</Text></View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceLabel}>{label}</Text>
        <Text style={styles.choiceDescription}>{description}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { minHeight: "100%", padding: spacing.lg, paddingTop: 22, backgroundColor: colors.profileCanvas },
  header: { flexDirection: "row", alignItems: "center" },
  backButton: { width: 36, height: 42, marginRight: 8, alignItems: "center", justifyContent: "center" },
  backGlyph: { color: colors.ink, fontSize: 34, fontWeight: "300", lineHeight: 38 },
  eyebrow: { color: colors.profileMuted, fontSize: 10, letterSpacing: 1.8, lineHeight: 14 },
  title: { marginTop: 3, color: colors.ink, fontFamily: "Georgia", fontSize: 27, lineHeight: 34 },
  intro: { marginTop: 26, marginBottom: 18, maxWidth: 340, color: colors.profileMuted, fontSize: 14, lineHeight: 20 },
  choice: { minHeight: 112, marginTop: 12, padding: 16, borderRadius: radius.lg, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", shadowColor: colors.black, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  choicePressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  icon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  iconText: { color: colors.white, fontSize: 25, lineHeight: 29 },
  choiceCopy: { flex: 1, minWidth: 0, marginLeft: 14 },
  choiceLabel: { color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: "600" },
  choiceDescription: { marginTop: 5, color: colors.profileMuted, fontSize: 12, lineHeight: 17 },
  arrow: { marginLeft: 8, color: colors.profileMuted, fontSize: 24, lineHeight: 28 },
  footerCard: { marginTop: 26, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surfaceWarm, borderWidth: 1, borderColor: colors.line },
  footerTitle: { color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: "600" },
  footerBody: { marginTop: 5, color: colors.profileMuted, fontSize: 12, lineHeight: 17 }
});
