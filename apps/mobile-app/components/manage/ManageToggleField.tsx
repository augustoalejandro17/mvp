import { Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ManageToggleFieldProps {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export default function ManageToggleField({
  icon,
  label,
  description,
  value,
  onValueChange,
}: ManageToggleFieldProps) {
  return (
    <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mt-1">
      <View className="flex-row items-center">
        <Ionicons name={icon as any} size={18} color="#9ca3af" />
        <View className="flex-1 ml-2">
          <Text className="text-gray-800 font-semibold text-base">{label}</Text>
          <Text className="text-gray-500 text-xs mt-0.5">{description}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#d1d5db', true: '#f59e0b' }}
          thumbColor="#ffffff"
        />
      </View>
    </View>
  );
}
