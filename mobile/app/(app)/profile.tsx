import { useRouter } from "expo-router";
import { ProfileView } from "../../src/components/profile-view";
import { Button } from "../../src/components/ui/button";
import { Screen, ScreenHeader } from "../../src/components/ui/screen";

export default function ProfileScreen() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader
        title="Profile"
        subtitle="LLM provider credentials"
        right={
          <Button
            label="Close"
            size="sm"
            variant="ghost"
            onPress={() => router.back()}
          />
        }
      />
      <ProfileView />
    </Screen>
  );
}
