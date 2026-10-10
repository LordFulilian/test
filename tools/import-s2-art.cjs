const fs=require('node:fs'),path=require('node:path');
const manifest=require('./s2-art-sources.json'),root=path.resolve(__dirname,'..'),target=path.join(root,'assets/resources/s2');
fs.mkdirSync(target,{recursive:true});
for(const a of manifest.assets){const dest=path.join(target,a.name+'.png');if(!fs.existsSync(dest))fs.copyFileSync(a.source,dest);}
console.log('S2 art copied to assets/resources/s2; user Image originals unchanged.');
