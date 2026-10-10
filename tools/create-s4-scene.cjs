const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'assets/scenes/S4.scene');if(fs.existsSync(file))throw Error('S4 scene already exists; edit it instead of regenerating.');
const scene=JSON.parse(fs.readFileSync(path.join(root,'assets/scenes/S3.scene'),'utf8'));
const uuid='51efba8e-0c2f-4c3b-9b20-746af94e078d',script='de7e9ad4-2ec4-4c80-a5da-4757a8c086eb';
const h=script.replaceAll('-',''),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let compressed=h.slice(0,5);
for(let i=5;i<32;i+=3){const n=parseInt(h.slice(i,i+3),16);compressed+=alphabet[n>>6]+alphabet[n&63];}
for(const n of scene)if(n._id)n._id=crypto.randomUUID();scene[0]._name=scene[1]._name='S4';scene[1]._id=uuid;
const component=scene[2]._components.find(c=>!scene[c.__id__].__type__.startsWith('cc.')).__id__;scene[component].__type__=compressed;
fs.writeFileSync(file,JSON.stringify(scene,null,2));fs.writeFileSync(file+'.meta',JSON.stringify({ver:'1.1.50',importer:'scene',imported:true,uuid,files:['.json'],subMetas:{},userData:{}},null,2));
fs.writeFileSync(path.join(root,'assets/scripts/S4Game.ts.meta'),JSON.stringify({ver:'4.0.24',importer:'typescript',imported:true,uuid:script,files:[],subMetas:{},userData:{}},null,2));
for(const name of ['S4Metrics','S4Fixtures']){const f=path.join(root,`assets/scripts/testing/${name}.ts.meta`);if(!fs.existsSync(f))fs.writeFileSync(f,JSON.stringify({ver:'4.0.24',importer:'typescript',imported:true,uuid:crypto.randomUUID(),files:[],subMetas:{},userData:{}},null,2));}
console.log('Editable S4 scene derived from S3; earlier scenes and art preserved.');
