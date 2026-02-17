import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BottomTabs, type DashboardTab } from "../components/navigation/BottomTabs";
import { AveButton } from "../components/ui/AveButton";
import type { Identity, LoginRequest } from "../lib/api";

type Props = {
  handle: string;
  identities: Identity[];
  requests: LoginRequest[];
  tab: DashboardTab;
  loading: boolean;
  refreshing: boolean;
  onTabChange: (tab: DashboardTab) => void;
  onOpenScanner: () => void;
  onRefresh: () => void;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  onLogout: () => void;
};

export function DashboardScreen({
  handle,
  identities,
  requests,
  tab,
  loading,
  refreshing,
  onTabChange,
  onOpenScanner,
  onRefresh,
  onApprove,
  onDeny,
  onLogout,
}: Props) {
  const activeTitle = tab === "home" ? "Home" : tab === "security" ? "Security" : tab === "id" ? "ID" : "Settings";

  return (
    <SafeAreaView className="flex-1 bg-[#090909] px-4 py-4">
      <StatusBar style="light" />

      <Text className="text-[#858585] text-[15px] mb-3 ml-1">◻ {activeTitle}</Text>

      <View className="flex-1 rounded-[30px] border border-[#1C1C1C] bg-[#0C0C0C] px-3 pt-3 pb-20 overflow-hidden">
        <View className="absolute left-0 right-0 top-0 h-[220px] bg-[#2B3F55]/15" />

        {tab === "home" ? (
          <ScrollView className="flex-1" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            {identities.length === 0 ? (
              <View className="bg-[#141414] rounded-[24px] p-5 border border-[#1F1F1F]">
                <Text className="text-[#8C8C8C]">No identities loaded yet.</Text>
              </View>
            ) : (
              identities.map((identity, index) => (
                <View key={identity.id} className="rounded-[26px] border border-[#242424] bg-[#121212] overflow-hidden">
                  <View className={`${index % 2 === 0 ? "bg-[#1a4a68]" : "bg-[#5B2C62]"} h-[64px] px-3 py-2 flex-row items-center`}>
                    <View className="w-[54px] h-[54px] rounded-[16px] bg-black/45 border border-white/20" />
                  </View>
                  <View className="p-3 gap-2">
                    <View className="bg-[#0A0A0A] rounded-[16px] px-3 py-2">
                      <Text className="text-[#7A7A7A] text-[10px] font-black uppercase">Name</Text>
                      <Text className="text-white text-[22px] font-semibold mt-1">{identity.displayName}</Text>
                    </View>
                    <View className="bg-[#0A0A0A] rounded-[16px] px-3 py-2">
                      <Text className="text-[#7A7A7A] text-[10px] font-black uppercase">Handle</Text>
                      <Text className="text-white text-[22px] font-semibold mt-1">{identity.handle}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : null}

        {tab === "security" ? (
          <ScrollView className="flex-1" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            <View className="bg-[#171717] rounded-[28px] p-3 border border-[#252525]">
              <View className="h-[210px] rounded-[24px] bg-[#2A2A2A] border border-[#404040] items-center justify-center">
                <View className="w-[150px] h-[150px] bg-[#EAEAEA] rounded-[12px] items-center justify-center">
                  <Text className="text-[#111] font-black">QR</Text>
                </View>
              </View>
              <View className="h-[2px] bg-[#242424] my-4" />
              <View className="flex-row gap-2">
                <View className="flex-1 bg-[#121212] rounded-[18px] px-4 py-3 border border-[#242424]">
                  <Text className="text-white text-[16px] font-black uppercase">Confirm a login</Text>
                  <Text className="text-[#8A8A8A] text-[13px] mt-1">Sign in on another device.</Text>
                </View>
                <View className="w-[66px]">
                  <AveButton title="›" onPress={onOpenScanner} />
                </View>
              </View>
              <View className="mt-2">
                <AveButton title={refreshing ? "REFRESHING..." : "REFRESH REQUESTS"} onPress={onRefresh} disabled={refreshing} />
              </View>
            </View>

            {requests.length === 0 ? (
              <View className="bg-[#121212] rounded-[22px] p-4 border border-[#1F1F1F]">
                <Text className="text-[#8C8C8C]">No pending login requests</Text>
              </View>
            ) : (
              requests.map((request) => (
                <View key={request.id} className="bg-[#171717] rounded-[22px] p-4 border border-[#222]">
                  <Text className="text-white text-[18px] font-black">{request.deviceName || "Unknown device"}</Text>
                  <Text className="text-[#BEBEBE] text-[13px] mt-1">{request.browser || "Unknown browser"} on {request.os || "Unknown OS"}</Text>
                  {request.ipAddress ? <Text className="text-[#777] text-[12px] mt-1">IP: {request.ipAddress}</Text> : null}
                  <View className="flex-row gap-3 mt-4">
                    <AveButton title={loading ? "APPROVING..." : "APPROVE"} onPress={() => onApprove(request.id)} disabled={loading} expand />
                    <AveButton title={loading ? "DENYING..." : "DENY"} variant="danger" onPress={() => onDeny(request.id)} disabled={loading} expand />
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : null}

        {tab === "id" ? (
          <ScrollView className="flex-1" contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
            <View className="bg-[#141414] rounded-[20px] p-4 border border-[#1F1F1F]">
              <Text className="text-white text-[15px] font-black uppercase">Random thought for today...</Text>
              <Text className="text-[#8A8A8A] text-[13px] mt-2">If every login left a footprint, what path have you created?</Text>
            </View>

            {[
              { title: "SECURITY", action: () => onTabChange("security") },
              { title: "DEVICES", action: () => onTabChange("security") },
              { title: "MY DATA", action: () => onTabChange("id") },
              { title: "ACTIVITY LOG", action: () => onTabChange("security") },
            ].map((item) => (
              <View key={item.title} className="flex-row rounded-[18px] overflow-hidden border border-[#242424] bg-[#121212]">
                <View className="flex-1 px-4 py-3">
                  <Text className="text-white text-[15px] font-black">{item.title}</Text>
                </View>
                <View className="w-[52px] items-center justify-center bg-[#0F0F0F] border-l border-[#222]">
                  <Text className="text-white text-[24px]" onPress={item.action}>›</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {tab === "settings" ? (
          <ScrollView className="flex-1" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            <View className="items-center mt-8 mb-4">
              <Text className="text-[#D4D4D4] text-[52px] font-black">Ave</Text>
              <Text className="text-[#8C8C8C] text-[18px] mt-1">v1.0.5.33</Text>
            </View>

            <View className="flex-row rounded-[18px] overflow-hidden border border-[#242424] bg-[#121212]">
              <View className="flex-1 px-4 py-4">
                <Text className="text-white text-[15px] font-black">VIEW OUR POLICIES</Text>
              </View>
              <View className="w-[52px] items-center justify-center bg-[#0F0F0F] border-l border-[#222]">
                <Text className="text-white text-[24px]">›</Text>
              </View>
            </View>

            <View className="flex-row rounded-[18px] overflow-hidden border border-[#3F1F26] bg-[#161012]">
              <View className="flex-1 px-4 py-4">
                <Text className="text-[#F45A71] text-[15px] font-black">LOG OUT</Text>
              </View>
              <View className="w-[52px] items-center justify-center bg-[#140D0F] border-l border-[#3F1F26]">
                <Text className="text-[#F45A71] text-[24px]" onPress={onLogout}>›</Text>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </View>

      <View className="absolute left-12 right-12 bottom-6">
        <BottomTabs tab={tab} onChange={onTabChange} />
      </View>
    </SafeAreaView>
  );
}
