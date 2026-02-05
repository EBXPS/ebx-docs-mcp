/**
 * Utility for reading files from zip archives
 */

import { Open } from 'unzipper';

/**
 * Read a file from a zip archive by its path
 */
export async function readFileFromZip(
  zipPath: string,
  filePath: string
): Promise<string | null> {
  try {
    const directory = await Open.file(zipPath);

    // Find the file in the zip archive
    const file = directory.files.find(f => f.path === filePath);

    if (!file) {
      return null;
    }

    // Read file content as buffer and convert to string
    const buffer = await file.buffer();
    return buffer.toString('utf-8');
  } catch (error) {
    console.error(`Error reading ${filePath} from ${zipPath}:`, error);
    return null;
  }
}
