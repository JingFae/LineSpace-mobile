import { Stack, useRootNavigationState, useRouter, useSegments, type Href } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AuthLoadingScreen, AuthSessionProvider, useAuth } from "@/auth/AuthSessionProvider";

const screenInset = 12;
const previewVerticalMargin = 44;
const previewHorizontalMargin = 32;
const previewScreenWidth = 430;
const iphone17ProScreenRatio = 2622 / 1206;
const previewScreenHeight = Math.round(previewScreenWidth * iphone17ProScreenRatio);
const previewShellWidth = previewScreenWidth + screenInset * 2;
const previewShellHeight = previewScreenHeight + screenInset * 2;

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <RouteGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#F4F2F0" }
            }}
          />
        </RouteGuard>
      </AuthSessionProvider>
    </QueryClientProvider>
  );
}

function RouteGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const firstSegment = segments[0] as string | undefined;
  const isPublicRoute =
    firstSegment === "login" || firstSegment === "register" || firstSegment === "auth";

  useEffect(() => {
    if (status === "loading" || !rootNavigationState?.key) return;
    if (status === "unauthenticated" && !isPublicRoute) {
      router.replace("/login" as Href);
    } else if (status === "authenticated" && isPublicRoute) {
      router.replace("/(tabs)" as Href);
    }
  }, [isPublicRoute, rootNavigationState?.key, router, status]);

  const shouldHoldRoute =
    status === "loading" ||
    (status === "unauthenticated" && !isPublicRoute) ||
    (status === "authenticated" && isPublicRoute);

  return (
    <View style={styles.routeGuardRoot}>
      {children}
      {shouldHoldRoute ? (
        <View pointerEvents="auto" style={styles.routeGuardOverlay}>
          <AuthLoadingScreen />
        </View>
      ) : null}
    </View>
  );
}

function WebDevicePreview({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const previewScale = Math.min(
    1,
    (width - previewHorizontalMargin) / previewShellWidth,
    (height - previewVerticalMargin) / previewShellHeight
  );

  return (
    <View style={styles.previewRoot}>
      <View
        style={[
          styles.previewStage,
          {
            width: previewShellWidth * previewScale,
            height: previewShellHeight * previewScale
          }
        ]}
      >
        <View
          style={[
            styles.phoneShell,
            {
              width: previewShellWidth,
              height: previewShellHeight,
              transform: [{ scale: previewScale }]
            }
          ]}
        >
          <View style={[styles.sideButton, styles.leftButton]} />
          <View style={[styles.sideButton, styles.rightButton]} />
          <View style={styles.phoneScreen}>
            <View style={styles.appViewport}>{children}</View>
            <View pointerEvents="none" style={styles.statusBar}>
              <Text style={styles.statusTime}>9:41</Text>
              <View style={styles.statusIcons}>
                <View style={styles.signalIcon}>
                  <View style={[styles.signalBar, styles.signalOne]} />
                  <View style={[styles.signalBar, styles.signalTwo]} />
                  <View style={[styles.signalBar, styles.signalThree]} />
                  <View style={[styles.signalBar, styles.signalFour]} />
                </View>
                <View style={styles.wifiIcon}>
                  <View style={[styles.wifiArc, styles.wifiArcOne]} />
                  <View style={[styles.wifiArc, styles.wifiArcTwo]} />
                  <View style={styles.wifiDot} />
                </View>
                <View style={styles.batteryIcon}>
                  <View style={styles.batteryFill} />
                  <View style={styles.batteryCap} />
                </View>
              </View>
            </View>
            <View pointerEvents="none" style={styles.dynamicIsland} />
            <View pointerEvents="none" style={styles.homeIndicator} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  routeGuardRoot: { flex: 1 },
  routeGuardOverlay: { ...StyleSheet.absoluteFillObject },
  previewRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8EAED",
    paddingHorizontal: 16,
    paddingVertical: 22
  },
  previewStage: {
    alignItems: "center",
    justifyContent: "center"
  },
  phoneShell: {
    borderRadius: 58,
    backgroundColor: "#101010",
    padding: screenInset,
    shadowColor: "#000000",
    shadowOpacity: 0.26,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18
  },
  phoneScreen: {
    width: previewScreenWidth,
    height: previewScreenHeight,
    overflow: "hidden",
    borderRadius: 46,
    backgroundColor: "#F4F2F0"
  },
  appViewport: {
    flex: 1
  },
  statusBar: {
    position: "absolute",
    top: 7,
    left: 0,
    right: 0,
    height: 33,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 35,
    paddingRight: 28
  },
  statusTime: {
    color: "#111111",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600"
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  signalIcon: {
    width: 18,
    height: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2
  },
  signalBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#111111"
  },
  signalOne: {
    height: 4
  },
  signalTwo: {
    height: 6
  },
  signalThree: {
    height: 8
  },
  signalFour: {
    height: 10
  },
  wifiIcon: {
    width: 16,
    height: 12,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  wifiArc: {
    position: "absolute",
    borderTopColor: "#111111",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderStyle: "solid"
  },
  wifiArcOne: {
    top: 1,
    width: 16,
    height: 8,
    borderTopWidth: 2,
    borderRadius: 10
  },
  wifiArcTwo: {
    top: 5,
    width: 9,
    height: 5,
    borderTopWidth: 2,
    borderRadius: 7
  },
  wifiDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#111111"
  },
  batteryIcon: {
    width: 25,
    height: 12,
    borderWidth: 1.3,
    borderColor: "#111111",
    borderRadius: 3,
    padding: 1
  },
  batteryFill: {
    flex: 1,
    width: 17,
    borderRadius: 1.5,
    backgroundColor: "#111111"
  },
  batteryCap: {
    position: "absolute",
    right: -4,
    top: 3,
    width: 2,
    height: 5,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    backgroundColor: "#111111"
  },
  dynamicIsland: {
    position: "absolute",
    top: 11,
    left: "50%",
    width: 78,
    height: 24,
    marginLeft: -39,
    borderRadius: 14,
    backgroundColor: "#050505"
  },
  homeIndicator: {
    position: "absolute",
    left: "50%",
    bottom: 8,
    width: 118,
    height: 5,
    marginLeft: -59,
    borderRadius: 3,
    backgroundColor: "rgba(0, 0, 0, 0.34)"
  },
  sideButton: {
    position: "absolute",
    width: 4,
    borderRadius: 3,
    backgroundColor: "#2A2A2A"
  },
  leftButton: {
    left: -3,
    top: 136,
    height: 72
  },
  rightButton: {
    right: -3,
    top: 188,
    height: 92
  }
});
