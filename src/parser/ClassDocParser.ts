/**
 * HTML Documentation Parser for EBX Javadoc
 * Parses individual class HTML files to extract full documentation
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import TurndownService from 'turndown';
import { ClassDocumentation, MethodDoc, FieldDoc, ParameterDoc } from '../indexer/types.js';
import { classDocCache } from '../cache/CacheManager.js';

export class ClassDocParser {
  private javadocRoot: string;
  private turndown: TurndownService;

  constructor(javadocRoot: string) {
    this.javadocRoot = javadocRoot;

    // Configure Turndown for markdown conversion
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    // Custom rules to clean up javadoc HTML
    this.turndown.addRule('removeLineBreaks', {
      filter: ['br'],
      replacement: () => '\n',
    });
  }

  /**
   * Parse a class HTML file and return full documentation
   * Uses cache to avoid re-parsing
   */
  async parseClassDoc(fullyQualifiedName: string, htmlPath: string): Promise<ClassDocumentation> {
    // Check cache first
    const cached = classDocCache.get(fullyQualifiedName);
    if (cached) {
      return cached;
    }

    // Parse HTML file
    const fullPath = path.join(this.javadocRoot, htmlPath);
    const html = await fs.readFile(fullPath, 'utf-8');
    const $ = cheerio.load(html);

    // Extract class info
    const classDoc = this.extractClassInfo($, fullyQualifiedName, htmlPath);

    // Cache the result
    classDocCache.set(fullyQualifiedName, classDoc);

    return classDoc;
  }

  /**
   * Extract class information from parsed HTML
   */
  private extractClassInfo(
    $: cheerio.CheerioAPI,
    fullyQualifiedName: string,
    htmlPath: string
  ): ClassDocumentation {
    const simpleName = fullyQualifiedName.split('.').pop() || fullyQualifiedName;
    const packageName = fullyQualifiedName.substring(0, fullyQualifiedName.lastIndexOf('.'));

    // Determine class type
    const typeSignature = $('.type-signature').text();
    let type: ClassDocumentation['type'] = 'class';
    if (typeSignature.includes('interface')) {
      type = 'interface';
    } else if (typeSignature.includes('enum')) {
      type = 'enum';
    } else if (typeSignature.includes('@interface')) {
      type = 'annotation';
    } else if (typeSignature.includes('Exception') || typeSignature.includes('Error')) {
      type = 'exception';
    }

    // Extract description
    const description = this.extractDescription($);

    // Extract inheritance info
    const extendsClasses = this.extractExtends($);
    const implementsInterfaces = this.extractImplements($);

    // Extract deprecated status
    const deprecated = $('.deprecation-block').length > 0;

    // Extract see also links
    const seeAlso = this.extractSeeAlso($);

    // Extract methods
    const methods = this.extractMethods($, fullyQualifiedName, packageName);

    // Extract fields
    const fields = this.extractFields($);

    return {
      fullyQualifiedName,
      simpleName,
      package: packageName,
      type,
      description,
      extends: extendsClasses,
      implements: implementsInterfaces,
      methods,
      fields,
      deprecated,
      seeAlso,
      htmlPath,
    };
  }

  /**
   * Extract class description and convert to markdown
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    const descBlock = $('.class-description .block').first();
    if (descBlock.length === 0) {
      return '';
    }

    // Get HTML and convert to markdown
    const html = descBlock.html() || '';
    return this.turndown.turndown(html).trim();
  }

  /**
   * Extract parent classes
   */
  private extractExtends($: cheerio.CheerioAPI): string[] {
    const extendsList: string[] = [];

    $('.class-description dl.notes dt').each((i, dt) => {
      const $dt = $(dt);
      if ($dt.text().trim() === 'All Superinterfaces:') {
        const $dd = $dt.next('dd');
        $dd.find('code a').each((j, a) => {
          const href = $(a).attr('href');
          const text = $(a).text();
          if (href && !href.startsWith('http')) {
            extendsList.push(text);
          }
        });
      }
    });

    // Also check the type signature for extends
    const typeSignature = $('.type-signature').text();
    const extendsMatch = typeSignature.match(/extends\s+([\w.]+)/);
    if (extendsMatch) {
      const className = extendsMatch[1].split('.').pop() || extendsMatch[1];
      if (!extendsList.includes(className)) {
        extendsList.push(className);
      }
    }

    return extendsList;
  }

  /**
   * Extract implemented interfaces
   */
  private extractImplements($: cheerio.CheerioAPI): string[] {
    const implementsList: string[] = [];

    $('.class-description dl.notes dt').each((i, dt) => {
      const $dt = $(dt);
      if ($dt.text().trim().startsWith('All Known Implementing Classes:')) {
        const $dd = $dt.next('dd');
        $dd.find('code a').each((j, a) => {
          implementsList.push($(a).text());
        });
      }
    });

    // Also check the type signature for implements
    const typeSignature = $('.type-signature').text();
    const implementsMatch = typeSignature.match(/implements\s+([\w.,\s]+)/);
    if (implementsMatch) {
      const interfaces = implementsMatch[1].split(',').map(s => {
        const className = s.trim().split('.').pop();
        return className || s.trim();
      });
      interfaces.forEach(iface => {
        if (!implementsList.includes(iface)) {
          implementsList.push(iface);
        }
      });
    }

    return implementsList;
  }

  /**
   * Extract "See Also" references
   */
  private extractSeeAlso($: cheerio.CheerioAPI): string[] {
    const seeAlso: string[] = [];

    $('.class-description dl.notes dt').each((i, dt) => {
      const $dt = $(dt);
      if ($dt.text().trim() === 'See Also:') {
        const $dd = $dt.next('dd');
        $dd.find('a').each((j, a) => {
          const text = $(a).text();
          if (text) {
            seeAlso.push(text);
          }
        });
      }
    });

    return seeAlso;
  }

  /**
   * Extract all methods from the class
   */
  private extractMethods($: cheerio.CheerioAPI, className: string, packageName: string): MethodDoc[] {
    const methods: MethodDoc[] = [];

    // Parse method details section
    $('.method-details .detail').each((i, section) => {
      const $section = $(section);
      const methodName = $section.find('h3').first().text().trim();

      if (!methodName) return;

      // Extract signature
      const signature = $section.find('.member-signature').text().trim();

      // Extract return type
      const returnTypeElem = $section.find('.member-signature .return-type');
      const returnType = returnTypeElem.text().trim();

      // Extract parameters
      const parameters = this.extractParameters($section);

      // Extract description
      const descBlock = $section.find('.block').first();
      const description = descBlock.length > 0
        ? this.turndown.turndown(descBlock.html() || '').trim()
        : '';

      // Extract modifiers from signature
      const modifiers: string[] = [];
      if (signature.includes('public')) modifiers.push('public');
      if (signature.includes('private')) modifiers.push('private');
      if (signature.includes('protected')) modifiers.push('protected');
      if (signature.includes('static')) modifiers.push('static');
      if (signature.includes('final')) modifiers.push('final');
      if (signature.includes('abstract')) modifiers.push('abstract');
      if (signature.includes('default')) modifiers.push('default');

      // Check if deprecated
      const deprecated = $section.find('.deprecation-block').length > 0;

      methods.push({
        name: methodName,
        signature,
        returnType: returnType || 'void',
        parameters,
        description,
        modifiers,
        deprecated,
        className,
        packageName,
      });
    });

    return methods;
  }

  /**
   * Extract method parameters
   */
  private extractParameters($section: cheerio.Cheerio<any>): ParameterDoc[] {
    const parameters: ParameterDoc[] = [];

    // Parse from signature
    const signature = $section.find('.member-signature').text();
    const paramsMatch = signature.match(/\((.*?)\)/);

    if (paramsMatch && paramsMatch[1].trim()) {
      const paramsList = paramsMatch[1];

      // Simple parameter parsing (handles basic cases)
      // Format: "Type name, Type2 name2, ..."
      const parts = paramsList.split(',').map(p => p.trim());

      for (const part of parts) {
        if (!part) continue;

        // Split on last space to separate type from name
        const lastSpace = part.lastIndexOf(' ');
        if (lastSpace > 0) {
          const type = part.substring(0, lastSpace).trim();
          const name = part.substring(lastSpace + 1).trim();
          parameters.push({ name, type });
        } else {
          // No name, just type
          parameters.push({ type: part, name: undefined });
        }
      }
    }

    return parameters;
  }

  /**
   * Extract fields/constants
   */
  private extractFields($: cheerio.CheerioAPI): FieldDoc[] {
    const fields: FieldDoc[] = [];

    // Parse field details section
    $('.field-details .detail').each((i, section) => {
      const $section = $(section);
      const fieldName = $section.find('h3').first().text().trim();

      if (!fieldName) return;

      // Extract type
      const signature = $section.find('.member-signature').text();
      const typeMatch = signature.match(/^([\w.<>\[\]]+)\s+\w+/);
      const type = typeMatch ? typeMatch[1] : 'Object';

      // Extract description
      const descBlock = $section.find('.block').first();
      const description = descBlock.length > 0
        ? this.turndown.turndown(descBlock.html() || '').trim()
        : '';

      // Extract modifiers
      const modifiers: string[] = [];
      if (signature.includes('public')) modifiers.push('public');
      if (signature.includes('private')) modifiers.push('private');
      if (signature.includes('protected')) modifiers.push('protected');
      if (signature.includes('static')) modifiers.push('static');
      if (signature.includes('final')) modifiers.push('final');

      // Check if deprecated
      const deprecated = $section.find('.deprecation-block').length > 0;

      fields.push({
        name: fieldName,
        type,
        description,
        modifiers,
        deprecated,
      });
    });

    return fields;
  }
}
