import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL, getGuestToken, getToken } from "./api-client";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function safeName(title: string): string {
  return (
    title
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^[_.]+|[_.]+$/g, "")
      .slice(0, 80) || "exam"
  );
}

/**
 * Download a stored exam file and hand it to the Android share/open sheet.
 * The backend requires a Bearer token, so the file cannot be opened by URL.
 */
export async function openStoredExam(
  examId: number,
  title: string,
  pdfPath: string,
  guest = false,
): Promise<void> {
  const token = guest ? await getGuestToken() : await getToken();
  const rawSuffix = pdfPath.split(".").pop()?.toLowerCase() ?? "pdf";
  const suffix = rawSuffix in MIME_TYPES ? rawSuffix : "pdf";
  const destination = new File(Paths.cache, `${safeName(title)}.${suffix}`);
  if (destination.exists) {
    destination.delete();
  }
  const path = guest ? `guest/exams/${examId}/pdf` : `exams/${examId}/pdf`;
  let downloaded: File;
  try {
    downloaded = await File.downloadFileAsync(
      `${API_URL}/api/${path}`,
      destination,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    );
  } catch {
    throw new Error("Could not download the exam file.");
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Opening files is not available on this device.");
  }
  await Sharing.shareAsync(downloaded.uri, {
    mimeType: MIME_TYPES[suffix],
    dialogTitle: title,
  });
}
