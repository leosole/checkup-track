import { useRouter } from "expo-router";
import { ShareView } from "../../src/components/share-view";
import { Button } from "../../src/components/ui/button";
import { Screen, ScreenHeader } from "../../src/components/ui/screen";

export default function ShareScreen() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader
        title="Share your records"
        subtitle="Pick the records to share, then send the one-time code."
        right={
          <Button
            label="Close"
            size="sm"
            variant="ghost"
            onPress={() => router.back()}
          />
        }
      />
      <ShareView />
    </Screen>
  );
}
