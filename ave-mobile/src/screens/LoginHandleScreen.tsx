import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AveButton } from "../components/ui/AveButton";

type Props = {
  handle: string;
  loading: boolean;
  onHandleChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
};

export function LoginHandleScreen({ handle, loading, onHandleChange, onContinue, onBack }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#090909] px-6 py-10">
      <StatusBar style="light" />
      <View className="flex-1 justify-center gap-6">
        <Text className="text-white text-[52px] leading-[56px] font-black">WHO’S SIGNING IN?</Text>
        <TextInput
          className="bg-[#101114] rounded-full px-6 py-5 text-white text-[22px]"
          placeholder="Your Handle or ID"
          placeholderTextColor="#666"
          autoCapitalize="none"
          value={handle}
          onChangeText={onHandleChange}
        />
        <AveButton title={loading ? "CHECKING..." : "CONTINUE"} onPress={onContinue} disabled={loading || !handle.trim()} />
        <AveButton title="BACK" variant="ghost" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}
