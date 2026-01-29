import { readFileSync } from 'fs';
import { join } from 'path';
import {
  TypeSearchEntry,
  MemberSearchEntry,
  PackageSearchEntry,
  ClassDocumentation,
  MethodSearchEntry,
  PackageDocumentation,
} from '../indexer/types.js';

/**
 * Parser for javadoc search index JavaScript files
 */
export class SearchIndexParser {
  private javadocPath: string;

  constructor(javadocPath: string) {
    this.javadocPath = javadocPath;
  }

  /**
   * Parse all search indices and return structured data
   */
  public parseAll() {
    console.error('Parsing search indices...');

    const types = this.parseTypeSearchIndex();
    const members = this.parseMemberSearchIndex();
    const packages = this.parsePackageSearchIndex();

    console.error(`Found ${types.length} types, ${members.length} members, ${packages.length} packages`);

    return {
      types,
      members,
      packages,
    };
  }

  /**
   * Parse type-search-index.js to get all classes/interfaces/enums
   */
  public parseTypeSearchIndex(): TypeSearchEntry[] {
    const filePath = join(this.javadocPath, 'type-search-index.js');
    const content = readFileSync(filePath, 'utf-8');

    // Extract the JSON array from: typeSearchIndex = [...];
    const match = content.match(/typeSearchIndex\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
      throw new Error('Could not parse type-search-index.js');
    }

    try {
      return JSON.parse(match[1]) as TypeSearchEntry[];
    } catch (error) {
      throw new Error(`Failed to parse type search index JSON: ${error}`);
    }
  }

  /**
   * Parse member-search-index.js to get all methods and fields
   */
  public parseMemberSearchIndex(): MemberSearchEntry[] {
    const filePath = join(this.javadocPath, 'member-search-index.js');
    const content = readFileSync(filePath, 'utf-8');

    // Extract the JSON array from: memberSearchIndex = [...];
    const match = content.match(/memberSearchIndex\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
      throw new Error('Could not parse member-search-index.js');
    }

    try {
      return JSON.parse(match[1]) as MemberSearchEntry[];
    } catch (error) {
      throw new Error(`Failed to parse member search index JSON: ${error}`);
    }
  }

  /**
   * Parse package-search-index.js to get all packages
   */
  public parsePackageSearchIndex(): PackageSearchEntry[] {
    const filePath = join(this.javadocPath, 'package-search-index.js');
    const content = readFileSync(filePath, 'utf-8');

    // Extract the JSON array from: packageSearchIndex = [...];
    const match = content.match(/packageSearchIndex\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
      throw new Error('Could not parse package-search-index.js');
    }

    try {
      return JSON.parse(match[1]) as PackageSearchEntry[];
    } catch (error) {
      throw new Error(`Failed to parse package search index JSON: ${error}`);
    }
  }

  /**
   * Convert raw entries to ClassDocumentation objects
   */
  public buildClassIndex(types: TypeSearchEntry[]): Map<string, ClassDocumentation> {
    const classMap = new Map<string, ClassDocumentation>();

    for (const entry of types) {
      // Skip entries without a package (like "All Classes and Interfaces")
      if (!entry.p) {
        continue;
      }

      const fullyQualifiedName = `${entry.p}.${entry.l}`;
      const htmlPath = `${entry.p.replace(/\./g, '/')}/${entry.l}.html`;

      // Infer type from naming conventions
      let type: ClassDocumentation['type'] = 'class';
      if (entry.l.endsWith('Exception') || entry.l.endsWith('Error')) {
        type = 'exception';
      }
      // We'll determine interface/enum/annotation later from HTML parsing

      const classDoc: ClassDocumentation = {
        fullyQualifiedName,
        simpleName: entry.l,
        package: entry.p,
        type,
        methods: [],
        fields: [],
        deprecated: false,
        seeAlso: [],
        htmlPath,
      };

      classMap.set(fullyQualifiedName, classDoc);
      // Also index by simple name for easier lookup
      classMap.set(entry.l, classDoc);
    }

    return classMap;
  }

  /**
   * Convert raw member entries to method search entries
   */
  public buildMethodIndex(
    members: MemberSearchEntry[],
    classMap: Map<string, ClassDocumentation>
  ): Map<string, MethodSearchEntry[]> {
    const methodMap = new Map<string, MethodSearchEntry[]>();

    for (const entry of members) {
      // Skip fields (they don't have parentheses in their label)
      if (!entry.l.includes('(')) {
        continue;
      }

      const methodName = entry.l.split('(')[0];
      const fullyQualifiedClassName = `${entry.p}.${entry.c}`;

      // Decode the URL parameter which contains the signature
      let signature = entry.l;
      if (entry.u) {
        try {
          signature = decodeURIComponent(entry.u.replace(/%3C/g, '<').replace(/%3E/g, '>'));
        } catch {
          // If decoding fails, use the label
        }
      }

      const methodEntry: MethodSearchEntry = {
        method: methodName,
        signature,
        className: fullyQualifiedClassName,
        packageName: entry.p,
      };

      // Add to method map
      if (!methodMap.has(methodName)) {
        methodMap.set(methodName, []);
      }
      methodMap.get(methodName)!.push(methodEntry);

      // Also add to the class's methods list
      const classDoc = classMap.get(fullyQualifiedClassName);
      if (classDoc) {
        classDoc.methods.push({
          name: methodName,
          signature,
          parameters: [],
          className: fullyQualifiedClassName,
          packageName: entry.p,
        });
      }
    }

    return methodMap;
  }

  /**
   * Build package index
   */
  public buildPackageIndex(
    packages: PackageSearchEntry[],
    classMap: Map<string, ClassDocumentation>
  ): Map<string, PackageDocumentation> {
    const packageMap = new Map<string, PackageDocumentation>();

    for (const entry of packages) {
      // Skip the "All Packages" entry
      if (entry.l === 'All Packages') {
        continue;
      }

      // Find all classes in this package
      const classes: string[] = [];
      for (const classDoc of classMap.values()) {
        if (classDoc.package === entry.l && classDoc.fullyQualifiedName.includes('.')) {
          classes.push(classDoc.fullyQualifiedName);
        }
      }

      const packageDoc: PackageDocumentation = {
        name: entry.l,
        classes,
        relatedPackages: [],
      };

      packageMap.set(entry.l, packageDoc);
    }

    return packageMap;
  }
}
