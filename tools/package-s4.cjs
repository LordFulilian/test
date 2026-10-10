const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),config=require(path.join(root,'build-config.json'));
if(!config.s4Testing||config.outputName!=='s4-web'||!config.debug)throw Error('S4 packaging requires the explicit debug test build.');
const build=path.join(root,'build/s4-web'),launcher=fs.readFileSync(path.join(root,'tools/s4-launcher.html'),'utf8');
const index=path.join(build,'index.html'),play=path.join(build,'play.html');
if(!fs.existsSync(play)||!fs.readFileSync(index,'utf8').includes('s4-report'))fs.copyFileSync(index,play);
fs.writeFileSync(index,launcher.replace('__S4_FIXED_PRESET__','null'));
const records=[];
for(const [name,preset] of [['s4-20','A'],['s4-30','B']]){
    const dest=path.join(root,'build',name);fs.cpSync(build,dest,{recursive:true});
    fs.writeFileSync(path.join(dest,'index.html'),launcher.replace('__S4_FIXED_PRESET__',JSON.stringify(preset)));
    const manifest={stage:'S4',preset,slots:preset==='A'?20:30,initialContent:'S4Fixtures identical except board capacity',developmentTestClock:true,productionBoardPreset:null,deviceTests:'pending',players:'pending',buildConfig:config};
    fs.writeFileSync(path.join(dest,'s4-test-manifest.json'),JSON.stringify(manifest,null,2));records.push({output:name,preset,playHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(dest,'play.html'))).digest('hex')});
}
fs.writeFileSync(path.join(root,'evidence/s4/package-manifest.json'),JSON.stringify({records,productionBoardPreset:null},null,2));console.log('S4 packaged: build/s4-20 and build/s4-30. Final preset still undecided.');
