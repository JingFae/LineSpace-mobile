import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Avatar } from "@linespace/ui";
import { colors, radius } from "@linespace/tokens";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";

type InviteCollaboratorsSheetProps = {
  draftId?: string;
  visible: boolean;
  onClose: () => void;
  onOpenRoom: () => void;
};

export function InviteCollaboratorsSheet({
  draftId,
  visible,
  onClose,
  onOpenRoom
}: InviteCollaboratorsSheetProps) {
  const queryClient = useQueryClient();
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const candidatesQuery = useQuery({
    queryKey: ["draft-invite-candidates", currentUserId],
    queryFn: () => lineSpaceApi.listDraftInviteCandidates(currentUserId),
    enabled: visible
  });
  const inviteMutation = useMutation({
    mutationFn: (inviteeId: string) => {
      if (!draftId) throw new Error("Draft is not ready");
      return lineSpaceApi.inviteDraftCollaborator({
        draftId,
        inviterId: currentUserId,
        inviteeId
      });
    },
    onSuccess: (invitation) => {
      setInvitedIds((ids) =>
        ids.includes(invitation.inviteeId) ? ids : [...ids, invitation.inviteeId]
      );
      void queryClient.invalidateQueries({ queryKey: ["compose-draft", draftId] });
    }
  });

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close invite panel" onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>CO-WRITE</Text>
          <Text style={styles.title}>Invite a writer</Text>
          <Text style={styles.subtitle}>
            Invited writers can edit the same draft and see new lines as they arrive.
          </Text>

          <View style={styles.listFrame}>
            {candidatesQuery.isLoading ? (
              <View style={styles.loading}><ActivityIndicator color={colors.ink} /></View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(candidatesQuery.data ?? []).map((person) => {
                  const invited = invitedIds.includes(person.id);
                  return (
                    <View key={person.id} style={styles.personRow}>
                      <Avatar
                        color={person.avatarColor}
                        imageSource={person.avatarUrl ? { uri: person.avatarUrl } : undefined}
                        label={person.displayName}
                        size={44}
                      />
                      <View style={styles.personCopy}>
                        <Text style={styles.personName}>{person.displayName}</Text>
                        <Text style={styles.personHandle}>@{person.handle}</Text>
                        {person.bio ? <Text numberOfLines={1} style={styles.personBio}>{person.bio}</Text> : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={invited || inviteMutation.isPending || !draftId}
                        onPress={() => inviteMutation.mutate(person.id)}
                        style={[styles.inviteButton, invited && styles.invitedButton]}
                      >
                        <Text style={[styles.inviteText, invited && styles.invitedText]}>
                          {invited ? "invited" : "invite"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {inviteMutation.isError ? (
            <Text style={styles.error}>The invitation could not be sent.</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={invitedIds.length === 0}
            onPress={onOpenRoom}
            style={[styles.roomButton, invitedIds.length === 0 && styles.roomButtonDisabled]}
          >
            <Text style={styles.roomButtonText}>
              {invitedIds.length === 0 ? "invite someone first" : "open shared draft"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    minHeight: 520,
    maxHeight: "78%",
    paddingHorizontal: 20,
    paddingTop: 9,
    paddingBottom: 26,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface
  },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: radius.pill, backgroundColor: colors.faint },
  eyebrow: { marginTop: 22, color: colors.profileMuted, fontSize: 10, lineHeight: 14, letterSpacing: 1.4 },
  title: { marginTop: 3, color: colors.ink, fontSize: 27, lineHeight: 33 },
  subtitle: { marginTop: 6, maxWidth: 335, color: colors.profileMuted, fontSize: 13, lineHeight: 18 },
  listFrame: { minHeight: 210, maxHeight: 300, marginTop: 18 },
  loading: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  personRow: { minHeight: 76, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  personCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  personName: { color: colors.ink, fontSize: 16, lineHeight: 20, fontWeight: "500" },
  personHandle: { color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  personBio: { marginTop: 2, color: colors.inkSoft, fontSize: 11, lineHeight: 15 },
  inviteButton: { minWidth: 66, height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" },
  invitedButton: { backgroundColor: colors.surfacePressed },
  inviteText: { color: colors.white, fontSize: 11, lineHeight: 14 },
  invitedText: { color: colors.ink },
  error: { marginTop: 10, color: colors.accent, fontSize: 12, lineHeight: 16 },
  roomButton: { height: 48, marginTop: 16, borderRadius: radius.pill, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" },
  roomButtonDisabled: { backgroundColor: colors.faint },
  roomButtonText: { color: colors.white, fontSize: 14, lineHeight: 18, fontWeight: "500" }
});
