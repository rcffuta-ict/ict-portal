import { FullUserProfile } from "@rcffuta/ict-lib";

export function displayLevelBetter(level: FullUserProfile['academics']['currentLevel']) {
  switch (level) {
    case '100L':
      return 'Fresher';
    case '200L':
      return '200 Level';
    case '300L':
      return '300 Level';
    case '400L':
      return '400 Level';
    case '500L':
      return '500 Level';
    default:
      return level;
  }
}

export function truncate(text: string | null | undefined, length: number) {
  if (!text) return "";
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
}
