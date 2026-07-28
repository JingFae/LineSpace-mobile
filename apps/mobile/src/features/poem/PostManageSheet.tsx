import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@linespace/tokens";

export function PostManageSheet({
  visible,
  pending,
  error,
  onClose,
  onEdit,
  onDelete
}: {
  visible: boolean;
  pending: boolean;
  error: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!visible) setConfirmingDelete(false);
  }, [visible]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Close post actions"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {confirmingDelete ? (
            <>
              <Text style={styles.title}>Delete this post?</Text>
              <Text style={styles.body}>
                This removes the poem and its community conversation permanently.
              </Text>
              {error ? (
                <Text style={styles.error}>
                  The post could not be deleted. Please try again.
                </Text>
              ) : null}
              <View style={styles.confirmRow}>
                <Pressable
                  disabled={pending}
                  onPress={() => setConfirmingDelete(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Keep post</Text>
                </Pressable>
                <Pressable
                  disabled={pending}
                  onPress={onDelete}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteText}>
                    {pending ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Post options</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onEdit}
                style={styles.actionButton}
              >
                <Text style={styles.actionTitle}>Edit in Compose</Text>
                <Text style={styles.actionHint}>
                  Keep this post, its comments and its engagement.
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmingDelete(true)}
                style={[styles.actionButton, styles.dangerAction]}
              >
                <Text style={styles.dangerTitle}>Delete post</Text>
                <Text style={styles.actionHint}>A confirmation is required.</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)"
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.faint
  },
  title: {
    marginTop: 18,
    color: colors.ink,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "600"
  },
  body: {
    marginTop: 7,
    color: colors.profileMuted,
    fontSize: 13,
    lineHeight: 19
  },
  actionButton: {
    marginTop: 12,
    padding: 15,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line
  },
  actionTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  actionHint: {
    marginTop: 4,
    color: colors.profileMuted,
    fontSize: 12,
    lineHeight: 17
  },
  dangerAction: { borderColor: "#F0C5BF", backgroundColor: "#FFF7F5" },
  dangerTitle: { color: "#B23B31", fontSize: 16, fontWeight: "600" },
  error: { marginTop: 10, color: "#B23B31", fontSize: 12 },
  confirmRow: { marginTop: 18, flexDirection: "row", gap: 10 },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.faint,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  deleteButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: "#B23B31",
    alignItems: "center",
    justifyContent: "center"
  },
  deleteText: { color: colors.white, fontSize: 13, fontWeight: "700" }
});
