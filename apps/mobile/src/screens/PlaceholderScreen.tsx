import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen, BottomNavigation, EmptyState } from "@linespace/ui";
import { colors, spacing, typography } from "@linespace/tokens";
import { mainTabs, tabRoutes, type MainTab } from "@/navigation/tabs";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";

type PlaceholderScreenProps = {
  activeTab: MainTab;
  title: string;
  body: string;
};

export function PlaceholderScreen({ activeTab, title, body }: PlaceholderScreenProps) {
  const profileQuery = useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId)
  });

  return (
    <AppScreen scroll={false}>
      <View style={styles.header}>
        <Text style={styles.brand}>LineSpace</Text>
      </View>
      <EmptyState title={title} body={body} />
      <BottomNavigation
        items={mainTabs}
        profileAvatar={
          profileQuery.data
            ? {
                color: profileQuery.data.avatarColor,
                imageSource: profileQuery.data.avatarUrl
                  ? { uri: profileQuery.data.avatarUrl }
                  : undefined,
                label: profileQuery.data.displayName
              }
            : undefined
        }
        value={activeTab}
        onChange={(value) => router.push(tabRoutes[value])}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg
  },
  brand: {
    ...typography.title,
    color: colors.ink
  }
});
