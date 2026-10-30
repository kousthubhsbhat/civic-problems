import { ENV } from '../config/env';

export const resolveImageUrl = (file?: Express.Multer.File): string | null => {
  if (!file) return null;
  // In development, serve from /uploads/<filename>
  return `/uploads/${file.filename}`;
};
