import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AveButton } from "../components/ui/AveButton";

type Props = {
  handle: string;
  trustCode: string;
  loading: boolean;
  onTrustCodeChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function LoginTrustCodeScreen({ handle, trustCode, loading, onTrustCodeChange, onSubmit, onBack }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#090909] px-6 py-10">
      <StatusBar style="light" />
      <View className="flex-1 justify-center gap-6">
        <Text className="text-white text-[46px] leading-[50px] font-black">YOUR TRUST CODE</Text>
        <Text className="text-[#929292] text-[16px]">Signing in as @{handle}</Text>
        <TextInput
          className="bg-[#101114] rounded-full px-6 py-5 text-white text-[22px]"
          placeholder="Trust code"
          placeholderTextColor="#666"
          autoCapitalize="characters"
          value={trustCode}
          onChangeText={onTrustCodeChange}
        />
        <AveButton title={loading ? "SIGNING IN..." : "CONTINUE"} onPress={onSubmit} disabled={loading || !trustCode.trim()} />
        <AveButton title="BACK" variant="ghost" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}
