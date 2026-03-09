import { ReactNode, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TactileVariant = "regular" | "compact";

type TactilePressableProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: TactileVariant;
};

function variantConfig(variant: TactileVariant) {
  if (variant === "compact") {
    return {
      scale: 0.9,
      inSpring: { stiffness: 620, damping: 30, mass: 0.58 },
      outSpring: { stiffness: 460, damping: 18, mass: 0.68 },
      restingShadow: styles.compactRestingShadow,
    };
  }

  return {
    scale: 0.95,
    inSpring: { stiffness: 520, damping: 28, mass: 0.66 },
    outSpring: { stiffness: 420, damping: 18, mass: 0.74 },
    restingShadow: styles.regularRestingShadow,
  };
}

export function TactilePressable({
  children,
  disabled,
  onPressIn,
  onPressOut,
  style,
  variant = "regular",
  ...props
}: TactilePressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const config = variantConfig(variant);

  const handlePressIn = (event: GestureResponderEvent) => {
    setPressed(true);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: config.scale,
        useNativeDriver: true,
        ...config.inSpring,
      }),
    ]).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    setPressed(false);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        ...config.outSpring,
      }),
    ]).start();
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        config.restingShadow,
        pressed ? styles.pressedShadow : null,
        disabled ? styles.disabledShadow : null,
        style,
        {
          transform: [{ scale }],
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  regularRestingShadow: {
    shadowColor: "#09111f",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  compactRestingShadow: {
    shadowColor: "#09111f",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  pressedShadow: {
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  disabledShadow: {
    shadowOpacity: 0,
    elevation: 0,
  },
});
