import { tokens } from "../generated/tokens";

const parseDimension = (value: string) =>
  value.endsWith("rem") ? Number.parseFloat(value) * 16 : Number.parseFloat(value);

export const nativeTheme = {
  color: tokens.color,
  radius: parseDimension(tokens.radius),
  spacing: parseDimension(tokens.spacing),
  fonts: {
    regular: "Roboto_400Regular",
    medium: "Roboto_500Medium",
    bold: "Roboto_700Bold",
  },
} as const;

export type NativeColors = typeof nativeTheme.color.light;