import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const result=await build({entryPoints:['src/app.js'],bundle:true,write:false,format:'iife',platform:'browser',external:['node:module'],target:'es2022',minify:true,legalComments:'eof',define:{'import.meta.url':'globalThis.location.href'}});
const template=await readFile('index.template.html','utf8'),css=await readFile('src/style.css','utf8'),notices=await readFile('THIRD_PARTY_NOTICES.txt','utf8');
const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const html=template.replace('/* STYLES */',()=>css).replace('/* APP */',()=>js).replace('</body>',()=>'<script type="text/plain" id="third-party-notices">'+notices.replaceAll('</script','<\\/script')+'</script></body>');
await mkdir('dist',{recursive:true});await writeFile('dist/index.html',html);await writeFile('index.html',html);
console.log('Built standalone Print Studio HTML.');
