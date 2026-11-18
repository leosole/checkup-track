import { StyleSheet, Text, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { useAppStyles, useTheme, type Palette } from "../../../src/theme";

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  const styles = useAppStyles(make_styles);
  return <Text style={[styles.icon, { color }]}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon glyph="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: "Exams",
          tabBarIcon: ({ color }) => <TabIcon glyph="▤" color={color} />,
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: "Meds",
          tabBarIcon: ({ color }) => <TabIcon glyph="✚" color={color} />,
        }}
      />
      <Tabs.Screen
        name="symptoms"
        options={{
          title: "Symptoms",
          tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <TabIcon glyph="⋯" color={color} />,
        }}
      />
    </Tabs>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 62,
    paddingBottom: 6,
    paddingTop: 4,
  },
  label: { fontSize: 10, fontWeight: "600" },
  item: { paddingVertical: 2 },
  icon: { fontSize: 18, lineHeight: 20 },
});
