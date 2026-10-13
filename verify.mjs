import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {initializeGeometry,buildDesign,patternDirections,fitBed,stl,threeMF} from './src/geometry.js';
import {SHAPES,HOLLOW_TYPES,part,project,clone,copyPiece,pastePiece,worldMatrix,detach,validateProject} from './src/model.js';
await initializeGeometry();let count=0;
function verify(p){
 const result=buildDesign(p),m=result.mesh;assert(m&&m.volume>0&&m.triangles.length);const bytes=stl(m),view=new DataView(bytes.buffer),edges=new Map();
 assert.equal(view.getUint32(80,true),m.triangles.length);assert.equal(bytes.length,84+50*m.triangles.length);
 let lowest=Infinity;
 for(let i=0;i<m.triangles.length;i++){
  const vv=Array.from({length:3},(_,j)=>Array.from({length:3},(_,k)=>view.getFloat32(84+i*50+12+j*12+k*4,true)));
  for(const v of vv){assert(v.every(Number.isFinite));lowest=Math.min(lowest,v[2]);}
  const keys=vv.map(v=>v.join(','));assert.equal(new Set(keys).size,3,'Serialized triangle must not collapse');
  for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'|'+b:b+'|'+a;edges.set(key,(edges.get(key)||0)+1);}
 }
 assert(Math.abs(lowest)<.0001);assert([...edges.values()].every(n=>n===2),'Serialized STL must be closed');
 const z=unzipSync(threeMF(m,p.name)),xml=strFromU8(z['3D/3dmodel.model']);assert(xml.includes('unit="millimeter"'));assert.equal((xml.match(/<triangle /g)||[]).length,m.triangles.length);assert(z['[Content_Types].xml']&&z['_rels/.rels']);count++;return result;
}
for(const type of Object.keys(SHAPES))for(const factor of [.5,1,2]){
 const p=project('blank'),a=part(type);for(const f of SHAPES[type].fields)if(f.unit==='mm')a.params[f.key]=Math.max(f.min,Math.min(f.max,a.params[f.key]*factor));a.position=[15,-23,48];a.rotation=[13,27,42];p.parts=[a];assert.equal(verify(p).mesh.components,1);
}
for(const kind of ['phone','organizer','tray'])assert.equal(verify(project(kind)).mesh.components,1);
const cut=project('blank'),base=part('block',{params:{width:60,depth:60,height:10,radius:5},position:[0,0,5]}),hole=part('cylinder',{hole:true,params:{diameter:20,height:30},position:[0,0,5]});cut.parts=[base,hole];const perforated=verify(cut);assert(perforated.mesh.volume<buildDesign({...cut,parts:[base]}).mesh.volume);assert.equal(perforated.mesh.components,1);
hole.position[0]=100;const missed=verify(cut);assert.equal(missed.mesh.volume,buildDesign({...cut,parts:[base]}).mesh.volume);
hole.params.diameter=150;hole.params.height=100;hole.position=[0,0,5];assert.throws(()=>buildDesign(cut),/entire design/);
hole.visible=false;assert.equal(verify(cut).mesh.components,1);
const separate=project('blank');separate.parts=[part('cylinder',{position:[-35,0,15]}),part('block',{position:[35,0,10]})];assert.equal(verify(separate).mesh.components,2);
const linked=project('phone'),child=linked.parts[1],before=worldMatrix(child,linked.parts).elements.slice();linked.parts[0].position[0]+=17;assert(Math.abs(worldMatrix(child,linked.parts).elements[12]-before[12]-17)<.0001);const same=worldMatrix(child,linked.parts).elements.slice();detach(child,linked.parts);assert.equal(child.parentId,null);assert(worldMatrix(child,linked.parts).elements.every((n,i)=>Math.abs(n-same[i])<.001));verify(linked);
const loops=project('phone');loops.parts[0].parentId=loops.parts[1].id;assert.throws(()=>validateProject(loops),/loop/);
for(const [key,value] of [['width',NaN],['width',0],['radius',90]]){const p=project('blank');p.parts=[part('block')];p.parts[0].params[key]=value;assert.throws(()=>validateProject(p));}
for(const type of ['tray','tube','bowl','bracket']){const p=project('blank');const a=part(type);a.params.wall=30;if(type==='tray')a.params.depth=40;p.parts=[a];assert.throws(()=>buildDesign(p));}
const malformed=project('phone');malformed.parts[1].id=malformed.parts[0].id;assert.throws(()=>validateProject(malformed));
const unknown=project('blank');unknown.parts=[{...part('block'),type:'untrusted'}];assert.throws(()=>validateProject(unknown));
const m=buildDesign(project('phone')).mesh;assert(fitBed(m,[260,260,255]).fits);for(let i=0;i<3;i++){const bed=[260,260,255];bed[i]=20;assert(!fitBed(m,bed).fits);}const rotated=fitBed(m,[90,110,100]);assert(rotated.fits&&rotated.rotate);assert(!fitBed(m,[100,80,100]).brimFits);
const named=project('tray');named.name='<Tray & "tools">';assert(strFromU8(unzipSync(threeMF(buildDesign(named).mesh,named.name))['3D/3dmodel.model']).includes('&lt;Tray &amp; &quot;tools&quot;&gt;'));
assert.equal(buildDesign(project('blank')).mesh,null);const invisible=project('phone');invisible.parts.forEach(p=>p.visible=false);assert.equal(buildDesign(invisible).mesh,null);
const saved=project('organizer');saved.parts[1].params.compartments=3;const reopened=validateProject(JSON.parse(JSON.stringify(saved)));assert.deepEqual(buildDesign(reopened).mesh.dims,buildDesign(saved).mesh.dims);assert.equal(reopened.parts[1].params.compartments,3);assert.equal(reopened.parts[1].parentId,reopened.parts[0].id);
for(const type of HOLLOW_TYPES){const p=project('blank'),a=part(type,{hollow:true,shell:1,rotation:[13,27,42]});p.parts=[a];const shell=verify(p).mesh;assert.equal(shell.components,1,`${type} shell must remain connected`);a.hollow=false;assert(shell.volume<buildDesign(p).mesh.volume,`${type} must have a real cavity`);}
const ball=project('ball');ball.parts[0].rotation=[13,27,42];const airless=verify(ball).mesh;assert.equal(airless.components,1);const patternedVolume=airless.volume;ball.parts[0].surface.pattern='none';const plainShell=verify(ball).mesh;assert(patternedVolume<plainShell.volume);ball.parts[0].hollow=false;const solidBall=verify(ball).mesh;assert(plainShell.volume<solidBall.volume*.25);
const b=ball.parts[0];b.hollow=true;b.shell=4;assert(verify(ball).mesh.volume>plainShell.volume);b.shell=2.4;b.surface.pattern='round';assert.equal(verify(ball).mesh.components,1);
b.surface.mode='dimples';b.surface.depth=1;assert.equal(verify(ball).mesh.components,1);b.hollow=false;assert(verify(ball).mesh.volume<solidBall.volume);b.surface.pattern='hexagon';assert.equal(verify(ball).mesh.components,1);
b.surface.mode='holes';assert.throws(()=>validateProject(ball),/turn on Hollow/);b.hollow=true;b.shell=40;assert.throws(()=>validateProject(ball),/no hollow space/);b.shell=2.4;b.surface.mode='dimples';b.surface.depth=3;assert.throws(()=>validateProject(ball),/dimple depth/);b.surface.depth=1;b.surface.mode='holes';b.surface.size=1;b.surface.gap=.8;assert.throws(()=>buildDesign(ball),/increase pattern size/);
const spaced=project('ball').parts[0],dense=patternDirections(spaced).length;spaced.surface.gap=6;assert(patternDirections(spaced).length<dense);
const legacy=project('phone');legacy.parts.forEach(p=>{delete p.hollow;delete p.shell;delete p.surface;});validateProject(legacy);assert(legacy.parts.every(p=>p.hollow===false&&p.surface.pattern==='none'));verify(legacy);
const source=project('ball');source.parts[0].position=[20,12,40];source.parts[0].rotation=[15,25,35];const snapshot=copyPiece(source.parts[0],source.parts),c1=pastePiece(snapshot,88),c2=pastePiece(snapshot,176);source.parts.push(c1,c2);assert.equal(new Set(source.parts.map(p=>p.id)).size,3);for(const c of[c1,c2]){assert.deepEqual(c.params,snapshot.params);assert.deepEqual(c.rotation,snapshot.rotation);assert.deepEqual(c.surface,snapshot.surface);assert.equal(c.shell,snapshot.shell);assert.equal(c.hollow,true);assert.equal(c.parentId,null);}c1.surface.size=10;assert.equal(snapshot.surface.size,8);assert.equal(c2.surface.size,8);c1.surface.size=8;assert.equal(verify(source).mesh.components,3);const reopenedShell=validateProject(JSON.parse(JSON.stringify(source)));assert.deepEqual(buildDesign(reopenedShell).mesh.dims,buildDesign(source).mesh.dims);
const linkedCopy=project('phone');const cp=copyPiece(linkedCopy.parts[1],linkedCopy.parts);assert.equal(cp.parentId,null);assert.deepEqual(cp.position,worldMatrix(linkedCopy.parts[1],linkedCopy.parts).elements.slice(12,15));
for(const type of ['polygon','capsule','ellipsoid','torus','arch','star','halfCylinder','pyramid']){const p=project('blank');p.parts=[part('block',{params:{width:100,depth:100,height:100,radius:0}}),part(type,{hole:true})];const r=verify(p);assert(r.mesh.volume<1000000);assert.equal(r.mesh.components,1);}
console.log(`Passed ${count} printable designs: 19 shapes, 14 hollow shells, sphere holes and dimples, closed serialized STL/3MF, copy/paste independence, legacy projects, attachments, and custom printer fit.`);
