import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/auth-context";
import { LoginView } from "../src/components/login-view";
import { useAppStyles, useTheme, type Palette } from "../src/theme";

export default function SignInScreen() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand600} />
      </View>
    );
  }
  if (user) {
    return <Redirect href="/" />;
  }
  return <LoginView />;
}

const make_styles = (colors: Palette) => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
