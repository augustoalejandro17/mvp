import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ManageHeaderProps {
  sectionLabel: string;
  title: string;
  onBack: () => void;
}

export default function ManageHeader({
  sectionLabel,
  title,
  onBack,
}: ManageHeaderProps) {
  return (
    <View
      className="bg-amber-500 px-5 pt-5 pb-7"
      style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
    >
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={onBack}
          className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
        >
          <Ionicons name="arrow-back" size={21} color="white" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-xs opacity-80 mb-1">{sectionLabel}</Text>
          <Text className="text-white text-xl font-bold">{title}</Text>
        </View>
      </View>
    </View>
  );
}
