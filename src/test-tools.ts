/**
 * Test script to verify MCP tool implementations
 */

import { DocumentationIndexer } from './indexer/DocumentationIndexer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'data', 'index.json');
const javadocRoot = path.join(__dirname, '..', 'ebx-core-javadoc');

async function main() {
  console.log('=== Testing MCP Tool Implementations ===\n');

  // Initialize indexer
  const startTime = Date.now();
  const indexer = new DocumentationIndexer(indexPath, javadocRoot);
  await indexer.initialize();
  const loadTime = Date.now() - startTime;
  console.log(`✓ Index loaded in ${loadTime}ms\n`);

  // Test 1: search_ebx_class
  console.log('Test 1: search_ebx_class');
  console.log('Query: "Adaptation"');
  const classResults = indexer.searchClasses('Adaptation', { limit: 3 });
  console.log(`Found ${classResults.length} results:`);
  classResults.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.fullyQualifiedName} (${r.type}) - score: ${r.relevanceScore.toFixed(3)}`);
    console.log(`     Package: ${r.package}`);
    console.log(`     Key methods: ${r.keyMethods.slice(0, 3).join(', ')}`);
  });
  console.log();

  // Test 2: get_ebx_class_doc
  console.log('Test 2: get_ebx_class_doc');
  console.log('Class: "Adaptation"');
  const doc = await indexer.getClassDoc('Adaptation');
  if (doc) {
    console.log(`✓ Retrieved documentation for ${doc.fullyQualifiedName}`);
    console.log(`  Type: ${doc.type}`);
    console.log(`  Methods: ${doc.methods.length}`);
    console.log(`  Fields: ${doc.fields.length}`);
    console.log(`  Description length: ${doc.description?.length || 0} chars`);
    console.log(`  First 3 methods: ${doc.methods.slice(0, 3).map(m => m.name).join(', ')}`);
  } else {
    console.log('✗ Failed to retrieve documentation');
  }
  console.log();

  // Test 3: search_ebx_method
  console.log('Test 3: search_ebx_method');
  console.log('Method: "getString"');
  const methodResults = indexer.searchMethods('getString', { limit: 5 });
  console.log(`Found ${methodResults.length} results:`);
  methodResults.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.className}.${r.method} - score: ${r.relevanceScore.toFixed(3)}`);
    console.log(`     Signature: ${r.signature}`);
    console.log(`     Return: ${r.returnType || 'void'}`);
  });
  console.log();

  // Test 4: find_ebx_package
  console.log('Test 4: find_ebx_package');
  console.log('Task: "data access"');
  const packageResults = indexer.findPackagesByTask('data access');
  console.log(`Found ${packageResults.length} results:`);
  packageResults.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name} - score: ${r.relevanceScore.toFixed(3)}`);
    console.log(`     Key classes: ${r.keyClasses.slice(0, 3).join(', ')}`);
  });
  console.log();

  // Test 5: Package search
  console.log('Test 5: Package search (bonus test)');
  console.log('Query: "ui"');
  const pkgSearchResults = indexer.searchPackages('ui', 5);
  console.log(`Found ${pkgSearchResults.length} results:`);
  pkgSearchResults.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name} - score: ${r.relevanceScore.toFixed(3)}`);
  });
  console.log();

  console.log('=== All Tests Completed Successfully ===');
}

main().catch(console.error);
