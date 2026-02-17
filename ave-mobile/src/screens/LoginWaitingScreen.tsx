import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AveButton } from "../components/ui/AveButton";

type Props = {
  statusText: string;
  onBack: () => void;
};

export function LoginWaitingScreen({ statusText, onBack }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#090909] px-6 py-10">
      <StatusBar style="light" />
      <View className="flex-1 justify-center gap-8">
        <Text className="text-white text-[44px] leading-[48px] font-black">WAITING FOR APPROVAL</Text>
        <View className="bg-[#141414] rounded-[28px] border border-[#1F1F1F] p-5">
          <Text className="text-[#BABABA] text-[18px] leading-7">{statusText}</Text>
        </View>
        <AveButton title="TRY ANOTHER METHOD" variant="ghost" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}
