/**
 * Type definitions for the EBX Documentation Index
 */

/**
 * Represents a method parameter
 */
export interface ParameterDoc {
  name?: string;
  type: string;
}

/**
 * Represents a method in the documentation
 */
export interface MethodDoc {
  name: string;
  signature: string;
  returnType?: string;
  parameters: ParameterDoc[];
  description?: string;
  modifiers?: string[];
  deprecated?: boolean;
  className: string;
  packageName: string;
}

/**
 * Represents a field in the documentation
 */
export interface FieldDoc {
  name: string;
  type: string;
  description?: string;
  modifiers?: string[];
  deprecated?: boolean;
}

/**
 * Represents a class/interface/enum in the documentation
 */
export interface ClassDocumentation {
  fullyQualifiedName: string;
  simpleName: string;
  package: string;
  type: 'interface' | 'class' | 'enum' | 'exception' | 'annotation';
  description?: string;
  extends?: string[];
  implements?: string[];
  methods: MethodDoc[];
  fields: FieldDoc[];
  deprecated: boolean;
  seeAlso: string[];
  htmlPath: string;
}

/**
 * Represents a package in the documentation
 */
export interface PackageDocumentation {
  name: string;
  description?: string;
  classes: string[];
  relatedPackages: string[];
}

/**
 * Entry for method search results
 */
export interface MethodSearchEntry {
  method: string;
  signature: string;
  className: string;
  packageName: string;
  returnType?: string;
  description?: string;
}

/**
 * The main search index containing all documentation
 */
export interface SearchIndex {
  classes: Map<string, ClassDocumentation>;
  methods: Map<string, MethodSearchEntry[]>;
  packages: Map<string, PackageDocumentation>;
  categoriesByTask: Map<string, string[]>;
}

/**
 * Raw entries from the javadoc search indices
 */
export interface TypeSearchEntry {
  p: string;  // package
  l: string;  // label (class name)
  u?: string; // URL (optional)
}

export interface MemberSearchEntry {
  p: string;  // package
  c: string;  // class
  l: string;  // label (member name)
  u?: string; // URL/signature
}

export interface PackageSearchEntry {
  l: string;  // label (package name)
  u?: string; // URL (optional)
}

/**
 * Serializable version of SearchIndex for JSON storage
 */
export interface SerializableSearchIndex {
  version?: string;
  classes: Record<string, ClassDocumentation>;
  methods: Record<string, MethodSearchEntry[]>;
  packages: Record<string, PackageDocumentation>;
  categoriesByTask: Record<string, string[]>;
}
