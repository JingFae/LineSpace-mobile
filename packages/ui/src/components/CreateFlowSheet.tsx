import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@linespace/tokens";
import { BackgroundPaperIcon, PoemRelayIcon } from "../icon";

type CreateFlowSheetProps = {
  visible: boolean;
  onClose: () => void;
  onDraftPress: () => void;
  onRelayPress?: () => void;
};

/** Entry chooser shown from the central Create action. */
export function CreateFlowSheet({
  visible,
  onClose,
  onDraftPress,
  onRelayPress
}: CreateFlowSheetProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close create options" onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>CREATE</Text>
          <Text style={styles.title}>How would you like to begin?</Text>
          <Text style={styles.subtitle}>Start privately, or pass a line between writers.</Text>

          <View style={styles.options}>
            <Pressable
              accessibilityHint="Relay is reserved for the next implementation phase"
              accessibilityRole="button"
              onPress={onRelayPress}
              style={({ pressed }) => [styles.option, styles.relayOption, pressed && styles.pressed]}
            >
              <PoemRelayIcon />
              <Text style={styles.relayTitle}>Relay</Text>
              <Text style={styles.relayDescription}>Build a poem line by line.</Text>
              <View style={styles.soonPill}><Text style={styles.soonText}>coming soon</Text></View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onDraftPress}
              style={({ pressed }) => [styles.option, styles.draftOption, pressed && styles.pressed]}
            >
              <View style={styles.draftIcon}><BackgroundPaperIcon width={55} height={52} /></View>
              <Text style={styles.draftTitle}>Draft</Text>
              <Text style={styles.draftDescription}>Write freely, then style and publish.</Text>
              <View style={styles.startPill}><Text style={styles.startText}>start writing</Text></View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface
  },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: radius.pill, backgroundColor: colors.faint },
  eyebrow: { marginTop: 24, color: colors.profileMuted, fontSize: 10, lineHeight: 14, letterSpacing: 1.4 },
  title: { marginTop: 4, color: colors.ink, fontSize: 27, lineHeight: 33 },
  subtitle: { marginTop: 6, color: colors.profileMuted, fontSize: 13, lineHeight: 18 },
  options: { marginTop: 22, flexDirection: "row", gap: 12 },
  option: { flex: 1, minHeight: 246, padding: 15, borderRadius: 21 },
  relayOption: { backgroundColor: colors.black },
  draftOption: { backgroundColor: colors.surfaceWarm, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.75 },
  relayTitle: { marginTop: 9, color: colors.white, fontSize: 22, lineHeight: 27 },
  draftTitle: { marginTop: 18, color: colors.ink, fontSize: 22, lineHeight: 27 },
  relayDescription: { marginTop: 5, color: "#C9C9C9", fontSize: 12, lineHeight: 17 },
  draftDescription: { marginTop: 5, color: colors.profileMuted, fontSize: 12, lineHeight: 17 },
  draftIcon: { height: 64, alignItems: "center", justifyContent: "center" },
  soonPill: { alignSelf: "flex-start", marginTop: 14, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "#292929" },
  soonText: { color: "#BEBEBE", fontSize: 10, lineHeight: 13 },
  startPill: { alignSelf: "flex-start", marginTop: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.black },
  startText: { color: colors.white, fontSize: 10, lineHeight: 13 }
});
