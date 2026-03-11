import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ManageSummaryCardProps {
  icon: string;
  title: string;
  subtitle: string;
}

export default function ManageSummaryCard({
  icon,
  title,
  subtitle,
}: ManageSummaryCardProps) {
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-3 border border-amber-100"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}
    >
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-xl bg-amber-50 items-center justify-center mr-3">
          <Ionicons name={icon as any} size={20} color="#d97706" />
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-gray-500 text-xs mt-0.5">{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}
