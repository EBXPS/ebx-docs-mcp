/**
 * Test script for ClassDocParser
 * Tests parsing of the Adaptation interface
 */

import { ClassDocParser } from './parser/ClassDocParser.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Testing ClassDocParser ===\n');

  const javadocRoot = path.join(__dirname, '..', 'ebx-core-javadoc');
  const parser = new ClassDocParser(javadocRoot);

  // Test parsing Adaptation interface
  const className = 'com.onwbp.adaptation.Adaptation';
  const htmlPath = 'com/onwbp/adaptation/Adaptation.html';

  console.log(`Parsing: ${className}`);
  console.log(`HTML path: ${htmlPath}\n`);

  try {
    const doc = await parser.parseClassDoc(className, htmlPath);

    console.log('✅ Successfully parsed class documentation\n');
    console.log('Class Information:');
    console.log(`- Fully Qualified Name: ${doc.fullyQualifiedName}`);
    console.log(`- Simple Name: ${doc.simpleName}`);
    console.log(`- Package: ${doc.package}`);
    console.log(`- Type: ${doc.type}`);
    console.log(`- Deprecated: ${doc.deprecated}`);
    console.log(`- Extends: ${doc.extends?.join(', ') || 'none'}`);
    console.log(`- Implements: ${doc.implements?.join(', ') || 'none'}`);
    console.log(`\nDescription (first 200 chars):`);
    console.log(doc.description?.substring(0, 200) || 'No description');
    console.log('...\n');

    console.log(`Methods found: ${doc.methods.length}`);
    console.log('Sample methods:');
    doc.methods.slice(0, 5).forEach(method => {
      console.log(`  - ${method.name}(${method.parameters.map(p => p.type).join(', ')}): ${method.returnType}`);
      console.log(`    Modifiers: ${method.modifiers?.join(' ') || 'none'}`);
      if (method.description) {
        console.log(`    Description: ${method.description.substring(0, 100)}...`);
      }
    });

    console.log(`\nFields found: ${doc.fields.length}`);
    if (doc.fields.length > 0) {
      console.log('Sample fields:');
      doc.fields.slice(0, 5).forEach(field => {
        console.log(`  - ${field.name}: ${field.type}`);
        if (field.description) {
          console.log(`    ${field.description.substring(0, 100)}...`);
        }
      });
    }

    console.log(`\nSee Also: ${doc.seeAlso.join(', ') || 'none'}`);

    // Test cache
    console.log('\n=== Testing Cache ===');
    console.log('Parsing same class again (should use cache)...');
    const startTime = Date.now();
    const doc2 = await parser.parseClassDoc(className, htmlPath);
    const endTime = Date.now();
    console.log(`✅ Retrieved from cache in ${endTime - startTime}ms`);
    console.log(`Same object: ${doc === doc2}`);

  } catch (error) {
    console.error('❌ Error parsing class:', error);
    process.exit(1);
  }

  console.log('\n=== Test Complete ===');
}

main();
