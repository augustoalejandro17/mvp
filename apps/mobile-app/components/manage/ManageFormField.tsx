import { Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ManageFormFieldProps {
  label: string;
  icon: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
}

export default function ManageFormField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: ManageFormFieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-semibold text-sm mb-2">{label}</Text>
      <View className="flex-row items-start bg-gray-50 border border-gray-200 rounded-xl px-3">
        <Ionicons
          name={icon as any}
          size={18}
          color="#9ca3af"
          style={{ marginTop: multiline ? 13 : 14, marginRight: 8 }}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          multiline={multiline}
          keyboardType={keyboardType}
          numberOfLines={multiline ? 4 : 1}
          className="flex-1 py-3 text-gray-900 text-base"
          style={multiline ? { minHeight: 108, textAlignVertical: 'top' } : undefined}
        />
      </View>
    </View>
  );
}
