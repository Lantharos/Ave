import { Pressable, Text, View } from "react-native";

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
};

export function MethodCard({ title, subtitle, onPress, disabled }: Props) {
  return (
    <Pressable
      className={`bg-[#141414] rounded-[24px] border border-[#1E1E1E] overflow-hidden ${disabled ? "opacity-60" : ""}`}
      onPress={onPress}
      disabled={disabled}
    >
      <View className="flex-row items-stretch">
        <View className="flex-1 px-5 py-4">
          <Text className="text-white text-[18px] font-black uppercase">{title}</Text>
          <Text className="text-[#8A8A8A] text-[14px] mt-2">{subtitle}</Text>
        </View>
        <View className="w-[72px] bg-[#101010] border-l border-[#222] items-center justify-center">
          <Text className="text-white text-[34px]">›</Text>
        </View>
      </View>
    </Pressable>
  );
}
