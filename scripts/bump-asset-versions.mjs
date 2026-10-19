import {readFileSync,writeFileSync} from 'node:fs';
function fp(v){let h=0xcbf29ce484222325n;for(let i=0;i<v.length;i++){h^=BigInt(v.charCodeAt(i));h=BigInt.asUintN(64,h*0x100000001b3n)}return h.toString(16).padStart(16,'0')}
let html=readFileSync('index.html','utf8');
for(const path of ['assets/css/app.css','assets/js/cloud-api.js','assets/js/app.js']){
 const anchor='./'+path+'?v=',pos=html.indexOf(anchor);
 if(pos<0||html.indexOf(anchor,pos+anchor.length)>=0)throw new Error('Missing or repeated reference: '+anchor);
 const start=pos+anchor.length,previous=html.slice(start,start+16);
 if(!/^[a-f0-9]{16}$/.test(previous))throw new Error('Malformed asset version: '+path);
 html=html.slice(0,start)+fp(readFileSync(path,'utf8'))+html.slice(start+16);
}
writeFileSync('index.html',html,'utf8');
console.log('Updated cache versions. Now run node scripts/check.mjs');
