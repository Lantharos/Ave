import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView, type PermissionResponse } from "expo-camera";
import { AveButton } from "../components/ui/AveButton";

type Props = {
  permission: PermissionResponse | null;
  onRequestPermission: () => void;
  onScan: (value: string) => void;
  onCancel: () => void;
};

export function ScannerScreen({ permission, onRequestPermission, onScan, onCancel }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#090909]">
      <StatusBar style="light" />
      {!permission?.granted ? (
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <Text className="text-white text-xl font-semibold text-center">Camera access is required</Text>
          <AveButton title="ALLOW CAMERA" onPress={onRequestPermission} />
          <AveButton title="BACK" variant="ghost" onPress={onCancel} />
        </View>
      ) : (
        <View className="flex-1">
          <CameraView className="flex-1" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => onScan(data)} />
          <View className="absolute bottom-10 left-0 right-0 px-6">
            <AveButton title="CANCEL" variant="ghost" onPress={onCancel} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
