import type { ReactNode } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { colors, spacing } from "@linespace/tokens";

type AppScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function AppScreen({
  children,
  scroll = true,
  padded = true,
  style,
  contentContainerStyle
}: AppScreenProps) {
  const contentStyle = [
    styles.content,
    padded && styles.padded,
    contentContainerStyle
  ];

  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      <View style={styles.deviceFrame}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={contentStyle}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={contentStyle}>{children}</View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  deviceFrame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 430 : undefined,
    alignSelf: "center",
    backgroundColor: colors.surface
  },
  content: {
    flexGrow: 1,
    paddingBottom: 96
  },
  padded: {
    paddingHorizontal: spacing.lg
  }
});
