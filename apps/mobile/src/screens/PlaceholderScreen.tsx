import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen, BottomNavigation, EmptyState } from "@linespace/ui";
import { colors, spacing, typography } from "@linespace/tokens";
import { mainTabs, tabRoutes, type MainTab } from "@/navigation/tabs";

type PlaceholderScreenProps = {
  activeTab: MainTab;
  title: string;
  body: string;
};

export function PlaceholderScreen({ activeTab, title, body }: PlaceholderScreenProps) {
  return (
    <AppScreen scroll={false}>
      <View style={styles.header}>
        <Text style={styles.brand}>LineSpace</Text>
      </View>
      <EmptyState title={title} body={body} />
      <BottomNavigation
        items={mainTabs}
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
