/**
 * Test script for SearchEngine and DocumentationIndexer
 */

import { DocumentationIndexer } from './indexer/DocumentationIndexer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Testing DocumentationIndexer ===\n');

  const indexPath = path.join(__dirname, '..', 'data', 'index.json');
  const javadocRoot = path.join(__dirname, '..', 'ebx-core-javadoc');

  const indexer = new DocumentationIndexer(indexPath, javadocRoot);

  console.log('Initializing indexer...');
  await indexer.initialize();
  console.log('✅ Indexer initialized\n');

  // Test 1: Search for classes
  console.log('=== Test 1: Search Classes ===');
  console.log('Query: "Adaptation"');
  const classResults = indexer.searchClasses('Adaptation', { limit: 5 });
  console.log(`Found ${classResults.length} results:`);
  classResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.name} (${result.fullyQualifiedName})`);
    console.log(`   Type: ${result.type}, Package: ${result.package}`);
    console.log(`   Relevance: ${result.relevanceScore.toFixed(2)}`);
    console.log(`   Key methods: ${result.keyMethods.slice(0, 3).join(', ')}`);
    if (result.description) {
      console.log(`   Description: ${result.description.substring(0, 100)}...`);
    }
  });

  // Test 2: Search for methods
  console.log('\n=== Test 2: Search Methods ===');
  console.log('Query: "get"');
  const methodResults = indexer.searchMethods('get', { limit: 10 });
  console.log(`Found ${methodResults.length} results:`);
  methodResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.method}`);
    console.log(`   Class: ${result.className}`);
    console.log(`   Signature: ${result.signature}`);
    console.log(`   Return type: ${result.returnType || 'void'}`);
    console.log(`   Relevance: ${result.relevanceScore.toFixed(2)}`);
  });

  // Test 3: Find packages by task
  console.log('\n=== Test 3: Find Packages by Task ===');
  console.log('Query: "data access"');
  const taskResults = indexer.findPackagesByTask('data access');
  console.log(`Found ${taskResults.length} packages:`);
  taskResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.name}`);
    console.log(`   Relevance: ${result.relevanceScore.toFixed(2)}`);
    console.log(`   Key classes: ${result.keyClasses.join(', ')}`);
    if (result.description) {
      console.log(`   Description: ${result.description}`);
    }
  });

  // Test 4: Get full class documentation
  console.log('\n=== Test 4: Get Full Class Documentation ===');
  console.log('Class: "Adaptation"');
  const doc = await indexer.getClassDoc('Adaptation');
  if (doc) {
    console.log('✅ Successfully retrieved full documentation');
    console.log(`Class: ${doc.fullyQualifiedName}`);
    console.log(`Type: ${doc.type}`);
    console.log(`Methods: ${doc.methods.length}`);
    console.log(`Fields: ${doc.fields.length}`);
    console.log(`Description length: ${doc.description?.length || 0} chars`);
    console.log('Sample methods:');
    doc.methods.slice(0, 5).forEach(method => {
      console.log(`  - ${method.name}(${method.parameters.map(p => p.type).join(', ')}): ${method.returnType}`);
    });
  } else {
    console.log('❌ Class not found');
  }

  // Test 5: Search by type filter
  console.log('\n=== Test 5: Search Classes by Type ===');
  console.log('Query: "validation", Type: interface');
  const interfaceResults = indexer.searchClasses('validation', {
    type: 'interface',
    limit: 5
  });
  console.log(`Found ${interfaceResults.length} interfaces:`);
  interfaceResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.name} (${result.fullyQualifiedName})`);
  });

  // Test 6: Search packages
  console.log('\n=== Test 6: Search Packages ===');
  console.log('Query: "ui"');
  const packageResults = indexer.searchPackages('ui', 5);
  console.log(`Found ${packageResults.length} packages:`);
  packageResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.name}`);
    console.log(`   Relevance: ${result.relevanceScore.toFixed(2)}`);
    console.log(`   Key classes: ${result.keyClasses.slice(0, 3).join(', ')}`);
  });

  console.log('\n=== All Tests Complete ===');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
