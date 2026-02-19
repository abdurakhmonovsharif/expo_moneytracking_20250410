import { API_BASE_URL } from "constants/featureFlags";

export type VoiceSttResult = {
  text: string;
  raw?: unknown;
};

const getFilename = (uri: string) => {
  const parts = uri.split("/");
  const last = parts[parts.length - 1];
  return last || `voice-${Date.now()}.wav`;
};

const getMimeType = (uri: string) => {
  const name = getFilename(uri);
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/m4a";
    case "aac":
      return "audio/aac";
    case "mp3":
      return "audio/mpeg";
    case "webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
};

export const transcribeVoice = async (fileUri: string): Promise<VoiceSttResult> => {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured.");
  }
  const baseUrl = API_BASE_URL.replace(/\/$/, "");

  const form = new FormData();
  form.append("audio", {
    uri: fileUri,
    name: getFilename(fileUri),
    type: getMimeType(fileUri),
  } as any);

  const response = await fetch(`${baseUrl}/stt`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Speech-to-text failed.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    return {
      text: data?.text ?? data?.result ?? data?.transcript ?? "",
      raw: data,
    };
  }

  const text = await response.text();
  return { text, raw: text };
};
