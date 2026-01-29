#!/usr/bin/env node

/**
 * Build-time index generator for EBX documentation
 * This script parses the javadoc HTML and search indices to create
 * a pre-built index for fast server startup
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { SearchIndexParser } from "./parser/SearchIndexParser.js";
import { SerializableSearchIndex } from "./indexer/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '../data');
const javadocPath = join(__dirname, '../ebx-core-javadoc');

console.log("=== EBX Documentation Index Builder ===");
console.log(`Javadoc path: ${javadocPath}`);
console.log(`Output path: ${dataDir}`);

// Create data directory if it doesn't exist
mkdirSync(dataDir, { recursive: true });

try {
  // Parse search indices
  const parser = new SearchIndexParser(javadocPath);
  const { types, members, packages } = parser.parseAll();

  console.log(`\nParsing statistics:`);
  console.log(`- Types: ${types.length}`);
  console.log(`- Members: ${members.length}`);
  console.log(`- Packages: ${packages.length}`);

  // Build structured index
  console.log('\nBuilding structured index...');
  const classMap = parser.buildClassIndex(types);
  const methodMap = parser.buildMethodIndex(members, classMap);
  const packageMap = parser.buildPackageIndex(packages, classMap);

  console.log(`- Unique classes: ${classMap.size}`);
  console.log(`- Unique method names: ${methodMap.size}`);
  console.log(`- Packages: ${packageMap.size}`);

  // Convert Maps to plain objects for JSON serialization
  const classesObj: Record<string, any> = {};
  classMap.forEach((value, key) => {
    classesObj[key] = value;
  });

  const methodsObj: Record<string, any> = {};
  methodMap.forEach((value, key) => {
    methodsObj[key] = value;
  });

  const packagesObj: Record<string, any> = {};
  packageMap.forEach((value, key) => {
    packagesObj[key] = value;
  });

  // Create basic task categorization (using FQNs for matching)
  const categoriesByTask: Record<string, string[]> = {
    'data access': [
      'com.onwbp.adaptation.Adaptation',
      'com.onwbp.adaptation.AdaptationTable',
      'com.onwbp.adaptation.AdaptationHome',
      'com.onwbp.adaptation.Request',
      'com.onwbp.adaptation.RequestResult',
    ],
    'schema': [
      'com.orchestranetworks.schema.SchemaNode',
      'com.orchestranetworks.schema.Path',
      'com.orchestranetworks.schema.SchemaExtensions',
      'com.orchestranetworks.schema.SchemaLocation',
    ],
    'validation': [
      'com.orchestranetworks.instance.ValidationReport',
      'com.orchestranetworks.schema.ConstraintContext',
      'com.orchestranetworks.schema.ConstraintViolation',
      'com.orchestranetworks.instance.ValidationContext',
    ],
    'triggers': [
      'com.orchestranetworks.schema.trigger.TableTrigger',
      'com.orchestranetworks.schema.trigger.InstanceTrigger',
      'com.orchestranetworks.schema.trigger.TriggerExecutionContext',
      'com.orchestranetworks.schema.trigger.BeforeCreateOccurrenceContext',
    ],
    'ui': [
      'com.orchestranetworks.ui.UIForm',
      'com.orchestranetworks.ui.UIComponentWriter',
      'com.orchestranetworks.ui.UIFormPane',
      'com.orchestranetworks.ui.UIHttpManagerComponent',
    ],
    'workflow': [
      'com.orchestranetworks.workflow.ProcessInstance',
      'com.orchestranetworks.workflow.UserTask',
      'com.orchestranetworks.workflow.WorkItem',
      'com.orchestranetworks.workflow.WorkflowEngine',
    ],
  };

  const index: SerializableSearchIndex = {
    classes: classesObj,
    methods: methodsObj,
    packages: packagesObj,
    categoriesByTask,
  };

  // Write to file
  const outputPath = join(dataDir, 'index.json');
  console.log(`\nWriting index to ${outputPath}...`);
  writeFileSync(outputPath, JSON.stringify(index, null, 2));

  const stats = {
    fileSize: (JSON.stringify(index).length / 1024 / 1024).toFixed(2) + ' MB',
    classes: classMap.size,
    methods: methodMap.size,
    packages: packageMap.size,
  };

  console.log('\n=== Build Complete! ===');
  console.log(`Index file size: ${stats.fileSize}`);
  console.log(`Total classes indexed: ${stats.classes}`);
  console.log(`Total unique methods: ${stats.methods}`);
  console.log(`Total packages: ${stats.packages}`);

} catch (error) {
  console.error('\n=== Build Failed! ===');
  console.error(error);
  process.exit(1);
}
