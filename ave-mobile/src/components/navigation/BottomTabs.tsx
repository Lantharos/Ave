import { Pressable, Text, View } from "react-native";

export type DashboardTab = "home" | "security" | "id" | "settings";

type Props = {
  tab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

const tabs: Array<{ key: DashboardTab; label: string }> = [
  { key: "home", label: "◉" },
  { key: "security", label: "◍" },
  { key: "id", label: "◌" },
  { key: "settings", label: "◎" },
];

export function BottomTabs({ tab, onChange }: Props) {
  return (
    <View className="bg-[#2B2B2B]/92 border border-[#5A5A5A] rounded-full px-3 py-2 flex-row justify-between">
      {tabs.map((item) => (
        <Pressable
          key={item.key}
          className={`w-[42px] h-[34px] rounded-full items-center justify-center ${tab === item.key ? "bg-[#E0E0E0]" : ""}`}
          onPress={() => onChange(item.key)}
        >
          <Text className={`${tab === item.key ? "text-[#111]" : "text-[#A7A7A7]"} text-[13px]`}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
