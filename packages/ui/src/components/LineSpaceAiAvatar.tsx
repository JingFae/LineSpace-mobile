import { StyleSheet, View } from "react-native";
import { LineSpaceLogoIcon } from "../icon";

export function LineSpaceAiAvatar({ size = 28 }: { size?: number }) {
  return (
    <View
      accessibilityLabel="LineSpace-AI"
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2
        }
      ]}
    >
      <LineSpaceLogoIcon
        color="#FFFFFF"
        height={size * 0.5}
        width={size * 0.86}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    backgroundColor: "#111318",
    justifyContent: "center",
    overflow: "hidden"
  }
});
