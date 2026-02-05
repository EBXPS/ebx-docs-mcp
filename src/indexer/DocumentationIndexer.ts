/**
 * DocumentationIndexer - Main coordinator for loading and searching EBX documentation
 */

import { readFile } from 'fs/promises';
import * as path from 'path';
import { SearchEngine } from './SearchEngine.js';
import { ClassDocParser } from '../parser/ClassDocParser.js';
import type {
  ClassDocumentation,
  SerializableSearchIndex,
} from './types.js';
import type {
  ClassSearchResult,
  MethodSearchResult,
  PackageSearchResult,
} from './SearchEngine.js';

export class DocumentationIndexer {
  private searchEngine: SearchEngine | null = null;
  private classDocParser: ClassDocParser | null = null;
  private indexPath: string;
  private zipPath: string;
  private version: string | null = null;

  constructor(indexPath: string, zipPath: string) {
    this.indexPath = indexPath;
    this.zipPath = zipPath;
  }

  /**
   * Load the pre-built index and initialize search engine
   */
  async initialize(): Promise<void> {
    const startTime = Date.now();

    // Load the serialized index
    const indexData = await readFile(this.indexPath, 'utf-8');
    const index: SerializableSearchIndex = JSON.parse(indexData);

    // Store version if available
    this.version = index.version || null;

    // Initialize search engine
    this.searchEngine = new SearchEngine(index);

    // Initialize HTML parser (with cache) - reads from zip
    this.classDocParser = new ClassDocParser(this.zipPath);

    const endTime = Date.now();
    console.error(`Documentation index loaded in ${endTime - startTime}ms`);
    if (this.version) {
      console.error(`EBX Version: ${this.version}`);
    }
    console.error(`Index stats:`, this.searchEngine.getStats());
  }

  /**
   * Ensure the indexer is initialized
   */
  private ensureInitialized(): void {
    if (!this.searchEngine || !this.classDocParser) {
      throw new Error('DocumentationIndexer not initialized. Call initialize() first.');
    }
  }

  /**
   * Search for classes by name or description
   */
  searchClasses(
    query: string,
    options: {
      type?: 'class' | 'interface' | 'enum' | 'exception' | 'annotation' | 'all';
      package?: string;
      limit?: number;
    } = {}
  ): ClassSearchResult[] {
    this.ensureInitialized();
    return this.searchEngine!.searchClasses(query, options);
  }

  /**
   * Get full documentation for a class
   */
  async getClassDoc(
    className: string,
    options: { includeInherited?: boolean } = {}
  ): Promise<ClassDocumentation | null> {
    this.ensureInitialized();

    // First try to find the class in the index to get its HTML path
    const classInfo = this.searchEngine!.getClass(className);
    if (!classInfo) {
      return null;
    }

    // Parse the full HTML documentation
    const doc = await this.classDocParser!.parseClassDoc(
      classInfo.fullyQualifiedName,
      classInfo.htmlPath
    );

    // TODO: If includeInherited is true, parse parent classes and merge methods
    // This would require parsing the extends/implements classes and merging their methods
    // For now, we just return the direct class documentation

    return doc;
  }

  /**
   * Search for methods across all classes
   */
  searchMethods(
    methodName: string,
    options: {
      className?: string;
      returnType?: string;
      limit?: number;
    } = {}
  ): MethodSearchResult[] {
    this.ensureInitialized();
    return this.searchEngine!.searchMethods(methodName, options);
  }

  /**
   * Find packages by task/domain
   */
  findPackagesByTask(task: string): PackageSearchResult[] {
    this.ensureInitialized();
    return this.searchEngine!.findPackagesByTask(task);
  }

  /**
   * Search packages by name or description
   */
  searchPackages(query: string, limit?: number): PackageSearchResult[] {
    this.ensureInitialized();
    return this.searchEngine!.searchPackages(query, limit);
  }

  /**
   * Get statistics about the documentation index
   */
  getStats() {
    this.ensureInitialized();
    return this.searchEngine!.getStats();
  }

  /**
   * Get the EBX version from the documentation
   */
  getVersion(): string | null {
    return this.version;
  }
}
