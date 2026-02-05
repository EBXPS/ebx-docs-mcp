/**
 * Utility for extracting zip files
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, rmSync } from 'fs';
import { readdir, stat, mkdir } from 'fs/promises';
import { createUnzip } from 'zlib';
import { Extract } from 'unzipper';
import { join, dirname } from 'path';

export interface ExtractOptions {
  /**
   * If true, removes existing extraction directory before extracting
   */
  clean?: boolean;

  /**
   * If true, logs extraction progress
   */
  verbose?: boolean;
}

/**
 * Extract a zip file to a destination directory
 */
export async function extractZip(
  zipPath: string,
  destPath: string,
  options: ExtractOptions = {}
): Promise<void> {
  const { clean = false, verbose = false } = options;

  if (verbose) {
    console.log(`Extracting ${zipPath} to ${destPath}...`);
  }

  // Clean destination if requested
  if (clean && existsSync(destPath)) {
    if (verbose) {
      console.log(`Cleaning existing directory: ${destPath}`);
    }
    rmSync(destPath, { recursive: true, force: true });
  }

  // Create destination directory
  if (!existsSync(destPath)) {
    mkdirSync(destPath, { recursive: true });
  }

  // Extract the zip file
  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: destPath }))
      .on('close', () => {
        if (verbose) {
          console.log(`Extraction complete: ${destPath}`);
        }
        resolve();
      })
      .on('error', (err) => {
        console.error(`Error extracting zip: ${err.message}`);
        reject(err);
      });
  });
}

/**
 * Check if a directory exists and is not empty
 */
export async function isDirectoryPopulated(dirPath: string): Promise<boolean> {
  try {
    if (!existsSync(dirPath)) {
      return false;
    }

    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      return false;
    }

    const entries = await readdir(dirPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

/**
 * Extract zip if destination doesn't exist or is empty
 */
export async function ensureExtracted(
  zipPath: string,
  destPath: string,
  options: ExtractOptions = {}
): Promise<void> {
  const isPopulated = await isDirectoryPopulated(destPath);

  if (!isPopulated) {
    await extractZip(zipPath, destPath, options);
  } else if (options.verbose) {
    console.log(`Directory already exists and is populated: ${destPath}`);
  }
}
