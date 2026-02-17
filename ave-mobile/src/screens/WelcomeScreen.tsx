import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AveButton } from "../components/ui/AveButton";

type Props = {
  onLogin: () => void;
};

export function WelcomeScreen({ onLogin }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#090909] px-6 py-10">
      <StatusBar style="light" />
      <View className="flex-1 justify-between">
        <View className="mt-24">
          <Text className="text-white text-5xl font-black">Welcome to Ave.</Text>
          <Text className="text-[#A5A5A5] text-base mt-4 leading-6">Your trusted identity and security center.</Text>
        </View>
        <View className="mb-10 gap-4">
          <AveButton title="LOG IN" onPress={onLogin} />
        </View>
      </View>
    </SafeAreaView>
  );
}
