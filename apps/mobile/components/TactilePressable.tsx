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
      scale: 0.8,
      popScale: 1.045,
      opacity: 0.82,
      inSpring: { stiffness: 780, damping: 34, mass: 0.54 },
      reboundSpring: { stiffness: 920, damping: 14, mass: 0.42 },
      settleSpring: { stiffness: 620, damping: 24, mass: 0.58 },
      restingShadow: styles.compactRestingShadow,
    };
  }

  return {
    scale: 0.87,
    popScale: 1.03,
    opacity: 0.88,
    inSpring: { stiffness: 680, damping: 32, mass: 0.62 },
    reboundSpring: { stiffness: 780, damping: 15, mass: 0.48 },
    settleSpring: { stiffness: 520, damping: 22, mass: 0.66 },
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
  const opacity = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const config = variantConfig(variant);

  const handlePressIn = (event: GestureResponderEvent) => {
    setPressed(true);
    scale.stopAnimation();
    opacity.stopAnimation();
    Animated.parallel([
      Animated.spring(scale, {
        toValue: config.scale,
        useNativeDriver: true,
        ...config.inSpring,
      }),
      Animated.timing(opacity, {
        toValue: config.opacity,
        duration: 70,
        useNativeDriver: true,
      }),
    ]).start();
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    setPressed(false);
    scale.stopAnimation();
    opacity.stopAnimation();
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, {
          toValue: config.popScale,
          useNativeDriver: true,
          ...config.reboundSpring,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          ...config.settleSpring,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
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
          opacity,
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
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  compactRestingShadow: {
    shadowColor: "#09111f",
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  pressedShadow: {
    shadowOpacity: 0.02,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  disabledShadow: {
    shadowOpacity: 0,
    elevation: 0,
  },
});
