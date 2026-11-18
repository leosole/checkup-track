import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { api, type PickedFile } from "../api-client";
import { isValidIso } from "../date-utils";
import {
  radius,
  useAppStyles,
  useTheme,
  type Palette,
} from "../theme";
import type { Exam } from "../types";
import { Button } from "./ui/button";
import { TextField } from "./ui/input";
import { Sheet } from "./ui/sheet";

export function UploadExamModal({
  visible,
  onClose,
  onUploaded,
}: {
  visible: boolean;
  onClose: () => void;
  onUploaded: (exam: Exam) => void;
}) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  const [file, set_file] = useState<PickedFile | null>(null);
  const [title, set_title] = useState("");
  const [date_performed, set_date_performed] = useState("");
  const [image_only, set_image_only] = useState(false);
  const [progress, set_progress] = useState(0);
  const [uploading, set_uploading] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    set_file(null);
    set_title("");
    set_date_performed("");
    set_image_only(false);
    set_progress(0);
    set_error(null);
    set_uploading(false);
  }, [visible]);

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: image_only
          ? ["application/pdf", "image/jpeg", "image/png", "image/webp"]
          : "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      set_file({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? null,
      });
      set_error(null);
    } catch {
      set_error("Could not open the file picker.");
    }
  }

  async function submit() {
    if (!file) {
      set_error("Choose an exam file to upload first.");
      return;
    }
    if (!image_only && !file.name.toLowerCase().endsWith(".pdf")) {
      set_error("Choose a PDF, or turn on Image exam to save an image file.");
      return;
    }
    if (date_performed && !isValidIso(date_performed)) {
      set_error("Date performed must use YYYY-MM-DD.");
      return;
    }
    set_uploading(true);
    set_error(null);
    set_progress(0);
    try {
      const exam = await api.uploadExam(file, {
        title,
        date_performed: date_performed || undefined,
        image_only,
        onProgress: set_progress,
      });
      set_progress(100);
      onUploaded(exam);
      onClose();
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      set_uploading(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Upload exam"
      subtitle="Add a report PDF for extraction, or save an image exam without parsing."
      onClose={uploading ? () => undefined : onClose}
      footer={
        <>
          <Button
            label="Cancel"
            variant="secondary"
            onPress={onClose}
            disabled={uploading}
          />
          <Button
            label={image_only ? "Save exam" : "Upload exam"}
            loading={uploading}
            disabled={!file}
            onPress={() => void submit()}
          />
        </>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.field}>
        <Text style={styles.label}>Exam file</Text>
        <View style={styles.fileRow}>
          <Text style={styles.fileName} numberOfLines={1}>
            {file ? file.name : "No file chosen"}
          </Text>
          <Button
            label="Choose file"
            size="sm"
            variant="secondary"
            disabled={uploading}
            onPress={() => void pickFile()}
          />
        </View>
        <Text style={styles.hint}>
          {image_only
            ? "PDF, JPEG, PNG, and WebP files are saved without extraction."
            : "PDF reports are parsed into biomarkers after upload."}
        </Text>
      </View>

      {uploading && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.hint}>Uploading {progress}%</Text>
        </View>
      )}

      <TextField
        label="Exam name (optional)"
        value={title}
        onChangeText={set_title}
        placeholder={
          image_only ? "Uses the file name" : "Uses the report title or file name"
        }
        maxLength={200}
      />

      <TextField
        label="Date performed (optional)"
        value={date_performed}
        onChangeText={set_date_performed}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        hint={
          image_only
            ? "Leave blank to use today's date."
            : "Leave blank to use the date in the report, or today if unavailable."
        }
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Image exam</Text>
        <Switch
          value={image_only}
          onValueChange={set_image_only}
          trackColor={{ true: colors.brand400, false: colors.borderStrong }}
          thumbColor={colors.white}
        />
      </View>
      {image_only && (
        <Text style={styles.warning}>
          Naming and dating image exams is recommended so they are easy to find,
          but both fields are optional.
        </Text>
      )}
    </Sheet>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  hint: { fontSize: 12, color: colors.textSubtle },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 8,
  },
  progressWrap: { gap: 4 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: { height: 6, backgroundColor: colors.brand600 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  warning: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: 8,
  },
});
