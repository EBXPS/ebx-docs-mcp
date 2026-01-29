/**
 * SearchEngine - Fuse.js-based fuzzy search for EBX documentation
 */

import Fuse from 'fuse.js';
import type {
  ClassDocumentation,
  MethodSearchEntry,
  PackageDocumentation,
  SerializableSearchIndex,
} from './types.js';

export interface ClassSearchResult {
  name: string;
  fullyQualifiedName: string;
  type: 'interface' | 'class' | 'enum' | 'exception' | 'annotation';
  package: string;
  description?: string;
  keyMethods: string[];
  relevanceScore: number;
}

export interface MethodSearchResult {
  method: string;
  signature: string;
  className: string;
  packageName: string;
  returnType?: string;
  description?: string;
  relevanceScore: number;
}

export interface PackageSearchResult {
  name: string;
  description?: string;
  keyClasses: string[];
  relevanceScore: number;
}

export class SearchEngine {
  private classFuse: Fuse<ClassDocumentation>;
  private methodFuse: Fuse<MethodSearchEntry>;
  private packageFuse: Fuse<PackageDocumentation>;
  private classMap: Map<string, ClassDocumentation>;
  private methodMap: Map<string, MethodSearchEntry[]>;
  private packageMap: Map<string, PackageDocumentation>;
  private categoriesByTask: Map<string, string[]>;

  constructor(index: SerializableSearchIndex) {
    // Convert serializable records to Maps
    this.classMap = new Map(Object.entries(index.classes));
    this.methodMap = new Map(Object.entries(index.methods));
    this.packageMap = new Map(Object.entries(index.packages));
    this.categoriesByTask = new Map(Object.entries(index.categoriesByTask));

    // Build class search index
    const classes = Array.from(this.classMap.values())
      // Filter out simple name duplicates - only keep FQN entries
      .filter(c => c.fullyQualifiedName.includes('.'));

    this.classFuse = new Fuse(classes, {
      keys: [
        { name: 'simpleName', weight: 2.0 },
        { name: 'fullyQualifiedName', weight: 1.5 },
        { name: 'package', weight: 0.5 },
        { name: 'description', weight: 0.8 },
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
    });

    // Build method search index
    const methods: MethodSearchEntry[] = [];
    for (const entries of this.methodMap.values()) {
      methods.push(...entries);
    }

    this.methodFuse = new Fuse(methods, {
      keys: [
        { name: 'method', weight: 2.0 },
        { name: 'className', weight: 1.0 },
        { name: 'signature', weight: 0.5 },
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
    });

    // Build package search index
    const packages = Array.from(this.packageMap.values());

    this.packageFuse = new Fuse(packages, {
      keys: [
        { name: 'name', weight: 2.0 },
        { name: 'description', weight: 1.0 },
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 2,
    });
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
    const limit = options.limit || 10;

    // Search using Fuse.js
    let results = this.classFuse.search(query, { limit: limit * 3 });

    // Filter by type if specified
    if (options.type && options.type !== 'all') {
      results = results.filter(r => r.item.type === options.type);
    }

    // Filter by package if specified
    if (options.package) {
      results = results.filter(r => r.item.package === options.package);
    }

    // Convert to search results
    return results.slice(0, limit).map(result => {
      const doc = result.item;
      const keyMethods = doc.methods
        .slice(0, 5)
        .map(m => m.name)
        .filter((name, index, self) => self.indexOf(name) === index); // unique

      return {
        name: doc.simpleName,
        fullyQualifiedName: doc.fullyQualifiedName,
        type: doc.type,
        package: doc.package,
        description: doc.description?.substring(0, 200),
        keyMethods,
        relevanceScore: 1 - (result.score || 0),
      };
    });
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
    const limit = options.limit || 10;

    // Search using Fuse.js
    let results = this.methodFuse.search(methodName, { limit: limit * 3 });

    // Filter by className if specified
    if (options.className) {
      const classNameLower = options.className.toLowerCase();
      results = results.filter(r =>
        r.item.className.toLowerCase().includes(classNameLower)
      );
    }

    // Filter by returnType if specified
    if (options.returnType) {
      const returnTypeLower = options.returnType.toLowerCase();
      results = results.filter(r =>
        r.item.returnType?.toLowerCase().includes(returnTypeLower)
      );
    }

    // Convert to search results
    return results.slice(0, limit).map(result => ({
      method: result.item.method,
      signature: result.item.signature,
      className: result.item.className,
      packageName: result.item.packageName,
      returnType: result.item.returnType,
      description: result.item.description?.substring(0, 200),
      relevanceScore: 1 - (result.score || 0),
    }));
  }

  /**
   * Find packages by task/domain category
   */
  findPackagesByTask(task: string): PackageSearchResult[] {
    const taskLower = task.toLowerCase();

    // Try exact or fuzzy match in categoriesByTask
    let relevantClasses: string[] = [];

    for (const [category, classes] of this.categoriesByTask.entries()) {
      if (category.toLowerCase().includes(taskLower) ||
          taskLower.includes(category.toLowerCase())) {
        relevantClasses.push(...classes);
      }
    }

    // Extract packages from relevant classes
    const packageNames = new Set<string>();
    for (const className of relevantClasses) {
      const doc = this.classMap.get(className);
      if (doc) {
        packageNames.add(doc.package);
      }
    }

    // Build package results
    const results: PackageSearchResult[] = [];
    for (const packageName of packageNames) {
      const pkg = this.packageMap.get(packageName);
      if (pkg) {
        // Find key classes in this package that match the task
        const keyClasses = pkg.classes
          .filter(c => relevantClasses.includes(c))
          .slice(0, 5);

        results.push({
          name: pkg.name,
          description: pkg.description,
          keyClasses,
          relevanceScore: keyClasses.length / Math.max(relevantClasses.length, 1),
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return results;
  }

  /**
   * Search packages by name or description
   */
  searchPackages(query: string, limit: number = 10): PackageSearchResult[] {
    const results = this.packageFuse.search(query, { limit });

    return results.map(result => ({
      name: result.item.name,
      description: result.item.description,
      keyClasses: result.item.classes.slice(0, 5),
      relevanceScore: 1 - (result.score || 0),
    }));
  }

  /**
   * Get a class by FQN or simple name
   */
  getClass(className: string): ClassDocumentation | undefined {
    return this.classMap.get(className);
  }

  /**
   * Get all classes (for debugging)
   */
  getAllClasses(): ClassDocumentation[] {
    return Array.from(this.classMap.values())
      .filter(c => c.fullyQualifiedName.includes('.'));
  }

  /**
   * Get statistics about the index
   */
  getStats() {
    const classes = Array.from(this.classMap.values())
      .filter(c => c.fullyQualifiedName.includes('.'));

    const methods = Array.from(this.methodMap.values())
      .reduce((sum, entries) => sum + entries.length, 0);

    return {
      classes: classes.length,
      classesWithAliases: this.classMap.size,
      methods,
      packages: this.packageMap.size,
      categories: this.categoriesByTask.size,
    };
  }
}
