/**
 * Utility for extracting EBX version from javadoc index.html
 */

import { readFile } from 'fs/promises';
import * as cheerio from 'cheerio';

/**
 * Extract EBX version from the javadoc index.html file
 * Looks for pattern like "TIBCO EBX® Version X.Y.Z" in the title
 */
export async function extractVersionFromIndexHtml(indexHtmlPath: string): Promise<string | null> {
  try {
    const html = await readFile(indexHtmlPath, 'utf-8');
    const $ = cheerio.load(html);
    const title = $('title').text();

    // Extract version from title like "Overview (TIBCO EBX® Version 6.2.2 Java API)"
    const versionMatch = title.match(/Version\s+([\d.]+)/i);

    if (versionMatch && versionMatch[1]) {
      return versionMatch[1];
    }

    return null;
  } catch (error) {
    console.error(`Error extracting version from ${indexHtmlPath}:`, error);
    return null;
  }
}
