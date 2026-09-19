import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";

export type MenuItem = {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  value?: string;
  description?: string;
  onPress: () => void;
  danger?: boolean;
};
export function MenuCard({
  title,
  items,
}: {
  title?: string;
  items: MenuItem[];
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 24 }}>
      {title ? (
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            letterSpacing: 1,
            marginBottom: 10,
            marginLeft: 4,
          }}
        >
          {title.toLocaleUpperCase("cs")}
        </Text>
      ) : null}
      <View
        style={{
          borderRadius: 20,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        {items.map((item, index) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={item.onPress}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 16,
              minHeight: 62,
              opacity: pressed ? 0.6 : 1,
              borderBottomWidth:
                index < items.length - 1 ? StyleSheet.hairlineWidth : 0,
              borderBottomColor: colors.border,
            })}
          >
            <Feather
              name={item.icon}
              size={22}
              color={item.danger ? colors.destructive : colors.foreground}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: item.danger ? colors.destructive : colors.foreground,
                  fontSize: 15,
                }}
              >
                {item.label}
              </Text>
              {item.description ? (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    marginTop: 4,
                    lineHeight: 17,
                  }}
                >
                  {item.description}
                </Text>
              ) : null}
            </View>
            {item.value ? (
              <Text
                numberOfLines={1}
                style={{
                  color: colors.mutedForeground,
                  maxWidth: "38%",
                  fontSize: 12,
                }}
              >
                {item.value}
              </Text>
            ) : null}
            <Feather
              name="chevron-right"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
