import { Pressable, Text } from "react-native";
import { handleHeaderScrollTitlePress } from "../lib/headerScrollToTop";

type HeaderScrollTitleProps = {
  routeKey: string;
  title: string;
  color: string;
};

export function HeaderScrollTitle({ routeKey, title, color }: HeaderScrollTitleProps) {
  return (
    <Pressable
      hitSlop={8}
      onPress={() => handleHeaderScrollTitlePress(routeKey)}
      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
    >
      <Text
        style={{
          color,
          fontWeight: "bold",
          fontSize: 18,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
