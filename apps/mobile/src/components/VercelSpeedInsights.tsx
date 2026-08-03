import { injectSpeedInsights } from "@vercel/speed-insights";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/** Collects real-user Web Vitals on Vercel without affecting native builds. */
export function VercelSpeedInsights() {
  const pathname = usePathname();
  const controller = useRef<ReturnType<typeof injectSpeedInsights>>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    if (!initialized.current) {
      controller.current = injectSpeedInsights({
        framework: "expo",
        route: pathname
      });
      initialized.current = true;
      return;
    }

    controller.current?.setRoute(pathname);
  }, [pathname]);

  return null;
}
