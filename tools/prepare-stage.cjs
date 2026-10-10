const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),config=require(path.join(root,'build-config.json'));
if(![1,2].includes(config.contentMaxChapter))throw Error('Unsupported content chapter boundary.');
if(config.contentMaxChapter===2&&!config.debug)throw Error('S3 is a development stage. A formal build needs the S5 time/platform adapters, not this test clock.');
if(config.developmentTestClock&&!config.debug)throw Error('Injected test clock cannot enter a formal build.');
if(config.s4Testing&&!config.debug)throw Error('S4 fixtures, metrics and test entry cannot enter a formal build.');
fs.writeFileSync(path.join(root,'assets/scripts/core/BuildStage.ts'),`// Generated from build-config.json by tools/prepare-stage.cjs.\nexport const CONTENT_MAX_CHAPTER = ${config.contentMaxChapter} as const;\nexport const ENABLE_TEST_CLOCK = ${!!config.developmentTestClock} as const;\nexport const ENABLE_S4_TESTS = ${!!config.s4Testing} as const;\n`);
console.log(`Build content boundary: ${config.contentMaxChapter} chapter(s); test clock ${config.developmentTestClock?'explicitly enabled':'disabled'}.`);
