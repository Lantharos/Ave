import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MethodCard } from "../components/ui/MethodCard";
import { AveButton } from "../components/ui/AveButton";
import type { Identity } from "../lib/api";

type Props = {
  identity: Identity | null;
  hasDevices: boolean;
  loading: boolean;
  onTrustedDevice: () => void;
  onTrustCode: () => void;
  onBack: () => void;
};

export function LoginMethodsScreen({ identity, hasDevices, loading, onTrustedDevice, onTrustCode, onBack }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#090909] px-6 py-10">
      <StatusBar style="light" />
      <View className="flex-1 justify-center gap-6">
        <Text className="text-white text-[46px] leading-[50px] font-black">PROVE IT’S YOU</Text>
        {identity ? (
          <View className="bg-[#141414] rounded-[26px] px-5 py-4 border border-[#1E1E1E]">
            <Text className="text-white text-[24px] font-bold">{identity.displayName}</Text>
            <Text className="text-[#8E8E8E] text-[16px] mt-1">@{identity.handle}</Text>
          </View>
        ) : null}

        {hasDevices ? (
          <MethodCard
            title={loading ? "REQUESTING..." : "USE A TRUSTED DEVICE"}
            subtitle="Approve this login in on one of your other devices."
            onPress={onTrustedDevice}
            disabled={loading}
          />
        ) : null}

        <MethodCard
          title="USE TRUST CODES"
          subtitle="Enter your trust code to sign in instantly."
          onPress={onTrustCode}
          disabled={loading}
        />

        <AveButton title="BACK" variant="ghost" onPress={onBack} />
      </View>
    </SafeAreaView>
  );
}
