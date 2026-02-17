import { Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "ghost";
  expand?: boolean;
};

export function AveButton({ title, onPress, disabled, variant = "primary", expand }: Props) {
  const base = expand ? "flex-1" : "w-full";

  if (variant === "danger") {
    return (
      <Pressable
        className={`${base} bg-[#2A1114] rounded-full px-6 py-4 items-center border border-[#5E1E28] ${disabled ? "opacity-60" : ""}`}
        onPress={onPress}
        disabled={disabled}
      >
        <Text className="text-[#F7697E] font-bold tracking-wide">{title}</Text>
      </Pressable>
    );
  }

  if (variant === "ghost") {
    return (
      <Pressable className={`${base} rounded-full px-6 py-4 items-center ${disabled ? "opacity-60" : ""}`} onPress={onPress} disabled={disabled}>
        <Text className="text-[#9A9A9A] font-medium">{title}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      className={`${base} bg-[#D7D9DD] rounded-full px-6 py-4 items-center ${disabled ? "opacity-60" : ""}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className="text-[#090909] font-black tracking-wide">{title}</Text>
    </Pressable>
  );
}
