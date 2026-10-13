import { Matrix4, Quaternion, Euler, Vector3 } from 'three';
const dim=(key,label,value,min=1,max=500,step=.5)=>({key,label,value,min,max,step,unit:'mm'});
export const SHAPES={
 block:{name:'Block',group:'Shapes',description:'A solid block with optional rounded vertical corners.',fields:[dim('width','Width',50),dim('depth','Depth',40),dim('height','Height',20),dim('radius','Corner radius',0,0,100)],sizeKeys:['width','depth','height']},
 cylinder:{name:'Cylinder',group:'Shapes',description:'A round post, disc, or wheel blank.',fields:[dim('diameter','Diameter',30),dim('height','Height',30)],sizeKeys:['diameter','diameter','height']},
 wedge:{name:'Wedge',group:'Shapes',description:'A triangular ramp. Rotate it to set the direction of its slope.',fields:[dim('width','Width',40),dim('depth','Depth',50),dim('height','Height',30)],sizeKeys:['width','depth','height']},
 sphere:{name:'Sphere',group:'Shapes',description:'An adjustable ball with optional hollow shell, holes, or dimples. Resizes evenly in every direction.',fields:[dim('diameter','Diameter',30)],sizeKeys:['diameter','diameter','diameter']},
 dome:{name:'Dome',group:'Shapes',description:'A curved cap with a flat bottom.',fields:[dim('diameter','Diameter',40),dim('height','Height',20)],sizeKeys:['diameter','diameter','height']},
 cone:{name:'Cone',group:'Shapes',description:'A tapered round shape. Set the top diameter to zero for a point.',fields:[dim('diameter','Base diameter',40),dim('top','Top diameter',10,0),dim('height','Height',40)],sizeKeys:['diameter','diameter','height']},
 polygon:{name:'Polygon prism',group:'More shapes',description:'Choose 3–12 sides. Six makes a hexagonal nut blank or opening.',fields:[dim('diameter','Corner-to-corner',40),dim('height','Height',25),dim('sides','Sides',6,3,12,1)],sizeKeys:['diameter','diameter','height']},
 pyramid:{name:'Pyramid',group:'More shapes',description:'A square-based point, useful as a solid or tapered cutter.',fields:[dim('width','Width',40),dim('depth','Depth',40),dim('height','Height',40)],sizeKeys:['width','depth','height']},
 capsule:{name:'Capsule',group:'More shapes',description:'A rounded cylinder with hemispherical ends. Height includes both ends.',fields:[dim('diameter','Diameter',25),dim('height','Total height',60)],sizeKeys:['diameter','diameter','height']},
 ellipsoid:{name:'Ellipsoid',group:'More shapes',description:'An oval ball with independent width, depth, and height.',fields:[dim('width','Width',50),dim('depth','Depth',30),dim('height','Height',35)],sizeKeys:['width','depth','height']},
 torus:{name:'Torus',group:'More shapes',description:'A doughnut-shaped ring. Tube diameter sets the thickness of the ring.',fields:[dim('diameter','Outside diameter',50),dim('thickness','Tube diameter',12)],sizeKeys:['diameter','diameter','thickness']},
 arch:{name:'Arch',group:'More shapes',description:'A semicircular arch with adjustable band thickness and breadth.',fields:[dim('diameter','Outside width',60),dim('thickness','Band thickness',8),dim('depth','Breadth',20)],sizeKeys:['diameter','depth',null]},
 star:{name:'Star prism',group:'More shapes',description:'A star with adjustable points and inner diameter. Also works as a shaped opening.',fields:[dim('diameter','Tip-to-tip diameter',45),dim('inner','Inner diameter',22),dim('height','Height',15),dim('points','Points',5,3,12,1)],sizeKeys:['diameter','diameter','height']},
 halfCylinder:{name:'Half cylinder',group:'More shapes',description:'A semicircular extrusion with a flat face, for rounded channels or caps.',fields:[dim('diameter','Diameter',40),dim('height','Height',40)],sizeKeys:['diameter','diameter','height']},
 tray:{name:'Tray',group:'Useful parts',description:'An open container with adjustable walls and optional dividers.',fields:[dim('width','Width',100),dim('depth','Depth',70),dim('height','Height',25),dim('wall','Wall thickness',2.4,.8,30,.1),dim('floor','Base thickness',3,.8,30,.1),dim('radius','Corner radius',4,0,100),{key:'compartments',label:'Compartments',value:1,min:1,max:8,step:1,unit:''}],sizeKeys:['width','depth','height']},
 tube:{name:'Tube',group:'Useful parts',description:'A hollow cylinder. Useful for sleeves, rings, and round openings.',fields:[dim('diameter','Outside diameter',35),dim('wall','Wall thickness',3,.8,30,.1),dim('height','Height',30)],sizeKeys:['diameter','diameter','height']},
 bowl:{name:'Bowl',group:'Useful parts',description:'A curved open container with a rounded bottom.',fields:[dim('diameter','Diameter',70),dim('height','Depth',30),dim('wall','Wall thickness',2.4,.8,30,.1)],sizeKeys:['diameter','diameter','height']},
 hook:{name:'C hook',group:'Useful parts',description:'A curved hook opening toward the right. Rotate to face another direction.',fields:[dim('opening','Inside diameter',24,4,300),dim('thickness','Hook thickness',5,1,40),dim('depth','Breadth',10,1,100)],sizeKeys:[null,'depth',null]},
 bracket:{name:'Bracket',group:'Useful parts',description:'A triangular support with an open center.',fields:[dim('width','Breadth',12),dim('depth','Reach',50),dim('height','Height',50),dim('wall','Brace thickness',6,1,40)],sizeKeys:['width','depth','height']}
};
export const HOLLOW_TYPES=['block','cylinder','wedge','sphere','dome','cone','polygon','pyramid','capsule','ellipsoid','torus','arch','star','halfCylinder'];
export const surfaceDefaults=()=>({pattern:'none',mode:'holes',size:6,gap:3,depth:1});
export function normalizePart(p){p.hollow??=false;p.shell??=2.4;p.surface??=surfaceDefaults();return p;}
export const clone=value=>structuredClone(value);
export const round=n=>Math.round(n*1000)/1000;
export const newId=()=>globalThis.crypto?.randomUUID?.()||'p'+Date.now().toString(36)+Math.random().toString(36).slice(2);
export function part(type,overrides={}){
 const s=SHAPES[type];if(!s)throw new Error('Unknown shape.');
 return {id:newId(),type,name:s.name,params:Object.fromEntries(s.fields.map(f=>[f.key,f.value])),position:[0,0,0],rotation:[0,0,0],parentId:null,hole:false,visible:true,hollow:false,shell:2.4,surface:surfaceDefaults(),...overrides};
}
export function copyPiece(p,parts){const c=clone(p);Object.assign(c,poseFromMatrix(worldMatrix(p,parts)));c.parentId=null;return c;}
export function pastePiece(snapshot,offset=0){const c=clone(snapshot);c.id=newId();c.name=(c.name+' copy').slice(0,80);c.position[0]=round(c.position[0]+offset);return c;}
export function project(kind='phone'){
 const p={format:'print-studio',version:1,name:kind==='blank'?'Untitled design':kind==='phone'?'Phone stand':kind==='organizer'?'Desk organizer':'Storage tray',bed:[260,260,255],parts:[]};
 if(kind==='blank')return p;
 if(kind==='ball'){p.name='Perforated ball';p.parts=[part('sphere',{params:{diameter:80},position:[0,0,40],hollow:true,shell:2.4,surface:{pattern:'hexagon',mode:'holes',size:8,gap:3,depth:1}})];return p;}
 if(kind==='tray'){p.parts=[part('tray',{position:[0,0,15],params:{width:120,depth:90,height:30,wall:2.4,floor:3,radius:8,compartments:2}})];return p;}
 const base=part('block',{name:'Base',position:[0,0,3],params:{width:100,depth:80,height:6,radius:6}});
 if(kind==='phone'){
  const back=part('block',{name:'Angled back',parentId:base.id,position:[0,20,38],rotation:[-15,0,0],params:{width:90,depth:6,height:80,radius:2}});
  const lip=part('block',{name:'Retaining lip',parentId:base.id,position:[0,-25,5],params:{width:90,depth:6,height:12,radius:1}});
  const hole=part('cylinder',{name:'Charging opening',parentId:base.id,position:[0,-25,3],rotation:[90,0,0],hole:true,params:{diameter:14,height:16}});
  p.parts=[base,back,lip,hole];
 }else{
  base.params={width:150,depth:90,height:5,radius:6};base.position=[0,0,2.5];
  const tray=part('tray',{name:'Small things tray',parentId:base.id,position:[-28,0,11],params:{width:88,depth:82,height:24,wall:2.4,floor:3,radius:4,compartments:2}});
  const cup=part('tube',{name:'Pen cup',parentId:base.id,position:[49,12,32],params:{diameter:40,height:66,wall:3}});
  p.parts=[base,tray,cup];
 }
 return p;
}
export function matrixOf(p){return new Matrix4().compose(new Vector3(...p.position),new Quaternion().setFromEuler(new Euler(...p.rotation.map(n=>n*Math.PI/180),'XYZ')),new Vector3(1,1,1));}
export function worldMatrix(p,parts,seen=new Set()){
 if(seen.has(p.id))throw new Error('Attachment loop. Detach a part to continue.');
 seen.add(p.id);const m=matrixOf(p);
 if(p.parentId){const parent=parts.find(x=>x.id===p.parentId);if(!parent)throw new Error('An attached part is missing its parent.');return worldMatrix(parent,parts,seen).multiply(m);}return m;
}
export function poseFromMatrix(m){const pos=new Vector3(),q=new Quaternion(),s=new Vector3();m.decompose(pos,q,s);const e=new Euler().setFromQuaternion(q,'XYZ');return {position:pos.toArray().map(round),rotation:[e.x,e.y,e.z].map(n=>round(n*180/Math.PI))};}
export function setWorldMatrix(p,m,parts){
 const parent=parts.find(x=>x.id===p.parentId);
 const local=parent?worldMatrix(parent,parts).invert().multiply(m):m;
 Object.assign(p,poseFromMatrix(local));
}
export function descendants(id,parts){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const p of parts)if(p.parentId&&found.has(p.parentId)&&!found.has(p.id)){found.add(p.id);changed=true;}}return found;}
export function detach(p,parts){const m=worldMatrix(p,parts);p.parentId=null;setWorldMatrix(p,m,parts);}
export function validatePart(p){
 normalizePart(p);
 const s=SHAPES[p.type];if(!s)throw new Error('Choose a supported shape.');
 for(const f of s.fields){const v=p.params?.[f.key];if(!Number.isFinite(v)||v<f.min||v>f.max||(f.step===1&&!Number.isInteger(v)))throw new Error(`${p.name}: ${f.label} must be ${f.min}–${f.max}${f.unit?' '+f.unit:''}${f.step===1?' (whole numbers)':''}.`);}
 for(const a of ['position','rotation'])if(!Array.isArray(p[a])||p[a].length!==3||p[a].some(n=>!Number.isFinite(n)||Math.abs(n)>(a==='position'?5000:3600)))throw new Error(`${p.name}: enter valid ${a==='position'?'positions':'angles'}.`);
 const v=p.params;
 if(['block','tray'].includes(p.type)&&v.radius>Math.min(v.width,v.depth)/2)throw new Error(`${p.name}: corner radius is too large for this width or depth.`);
 if(p.type==='tray'){
  if(2*v.wall>=Math.min(v.width,v.depth)||v.floor>=v.height)throw new Error(`${p.name}: walls or base leave no inside space.`);
  if((v.width-(v.compartments+1)*v.wall)/v.compartments<2)throw new Error(`${p.name}: reduce compartments or increase width.`);
 }
 if(p.type==='tube'&&2*v.wall>=v.diameter)throw new Error(`${p.name}: wall thickness leaves no opening.`);
 if(p.type==='bowl'&&(v.wall>=v.height||2*v.wall>=v.diameter))throw new Error(`${p.name}: reduce the wall thickness.`);
 if(p.type==='bracket'&&v.wall>Math.min(v.depth,v.height)/4)throw new Error(`${p.name}: brace thickness must be at most one quarter of reach and height.`);
 if(p.type==='capsule'&&v.height<v.diameter)throw new Error(`${p.name}: total height must be at least the diameter.`);
 if(p.type==='torus'&&2*v.thickness>=v.diameter)throw new Error(`${p.name}: outside diameter must exceed twice the tube diameter.`);
 if(p.type==='arch'&&2*v.thickness>=v.diameter)throw new Error(`${p.name}: band thickness leaves no arch opening.`);
 if(p.type==='star'&&v.inner>=v.diameter)throw new Error(`${p.name}: inner diameter must be smaller than the tip diameter.`);
 if(typeof p.hollow!=='boolean'||!Number.isFinite(p.shell)||p.shell<.4||p.shell>100)throw new Error(`${p.name}: shell thickness must be 0.4–100 mm.`);
 if(p.hollow&&!HOLLOW_TYPES.includes(p.type))throw new Error(`${p.name}: use this part's existing wall controls.`);
 if(p.hollow){const min=p.type==='torus'?v.thickness:p.type==='arch'?Math.min(v.thickness,v.depth):Math.min(...SHAPES[p.type].sizeKeys.filter(Boolean).map(k=>v[k]));if(2*p.shell>=min)throw new Error(`${p.name}: shell thickness leaves no hollow space. Reduce it or enlarge the shape.`);}
 const srf=p.surface;
 if(!srf||!['none','round','hexagon'].includes(srf.pattern)||!['holes','dimples'].includes(srf.mode)||!Number.isFinite(srf.size)||srf.size<1||srf.size>100||!Number.isFinite(srf.gap)||srf.gap<.8||srf.gap>100||!Number.isFinite(srf.depth)||srf.depth<.2||srf.depth>30)throw new Error(`${p.name}: enter valid surface pattern settings.`);
 if(srf.pattern!=='none'){
  if(p.type!=='sphere')throw new Error('Surface patterns are available on spheres.');
  if(srf.mode==='holes'&&!p.hollow)throw new Error(`${p.name}: turn on Hollow for through holes, or choose shallow dimples.`);
  if(srf.size>v.diameter*.4)throw new Error(`${p.name}: pattern size must be at most 40% of the sphere diameter.`);
  if(srf.mode==='dimples'&&srf.depth>=(p.hollow?p.shell-.2:v.diameter/4))throw new Error(`${p.name}: reduce dimple depth to keep material beneath the pattern.`);
 }
}
export function validateProject(p){
 if(!p||p.format!=='print-studio'||p.version!==1||!Array.isArray(p.parts)||p.parts.length>60)throw new Error('Open a Print Studio project with up to 60 parts.');
 if(!Array.isArray(p.bed)||p.bed.length!==3||p.bed.some(n=>!Number.isFinite(n)||n<20||n>2000))throw new Error('Printer dimensions must be 20–2000 mm.');
 if(typeof p.name!=='string'||p.name.length>120)throw new Error('Design name must be at most 120 characters.');
 const ids=new Set();for(const a of p.parts){if(typeof a.id!=='string'||ids.has(a.id)||typeof a.name!=='string'||a.name.length>80||typeof a.hole!=='boolean'||typeof a.visible!=='boolean')throw new Error('This project contains an invalid part.');ids.add(a.id);validatePart(a);}
 for(const a of p.parts)worldMatrix(a,p.parts);
 return p;
}
