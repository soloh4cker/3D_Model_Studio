import ManifoldModule from 'manifold-3d';
import wasmData from './wasm-data.js';
import {zipSync,strToU8} from 'fflate';
import {worldMatrix,validateProject,validatePart} from './model.js';
import {Matrix4,Quaternion,Vector3} from 'three';
let M,C,pool=[];
const use=o=>{pool.push(o);return o;};
export async function initializeGeometry(){if(M)return;const lib=await ManifoldModule({wasmBinary:Uint8Array.from(atob(wasmData),c=>c.charCodeAt(0))});lib.setup();M=lib.Manifold;C=lib.CrossSection;}
const box=(size,pos=[0,0,0])=>use(use(M.cube(size,true)).translate(pos));
const move=(s,pos)=>use(s.translate(pos));
const union=parts=>use(M.union(parts));
function outline(w,d,r){
 if(r<.01)return use(C.square([w,d],true));
 const pts=[];for(const [x,y,a] of [[w/2-r,d/2-r,0],[-w/2+r,d/2-r,90],[-w/2+r,-d/2+r,180],[w/2-r,-d/2+r,270]])for(let i=0;i<=12;i++){const b=(a+i*7.5)*Math.PI/180;pts.push([x+r*Math.cos(b),y+r*Math.sin(b)]);}return use(new C([pts]));
}
const slab=(w,d,h,r=0,z=0)=>move(use(outline(w,d,r).extrude(h)),[0,0,z-h/2]);
const cyl=(d,h,top=d)=>use(M.cylinder(h,d/2,top/2,96,true));
function prism(points,width){return use(move(use(use(new C([points])).extrude(width)),[0,0,-width/2]).rotate([90,0,90]));}
const section=(p)=>{
 const v=p.params;
 if(p.type==='wedge')return use(new C([[[-v.depth/2,-v.height/2],[v.depth/2,-v.height/2],[v.depth/2,v.height/2]]]));
 if(p.type==='polygon')return use(new C([Array.from({length:v.sides},(_,i)=>[v.diameter/2*Math.cos(i*2*Math.PI/v.sides),v.diameter/2*Math.sin(i*2*Math.PI/v.sides)])]));
 if(p.type==='star')return use(new C([Array.from({length:v.points*2},(_,i)=>{const r=(i%2?v.inner:v.diameter)/2,a=i*Math.PI/v.points;return[r*Math.cos(a),r*Math.sin(a)];})]));
 if(p.type==='halfCylinder')return use(use(C.circle(v.diameter/2,96)).intersect(use(use(C.square([v.diameter+2,v.diameter/2],true)).translate([0,v.diameter/4]))));
 if(p.type==='arch'){const ring=use(use(C.circle(v.diameter/2,96)).subtract(use(C.circle(v.diameter/2-v.thickness,96))));return use(ring.intersect(use(use(C.square([v.diameter+2,v.diameter/2],true)).translate([0,v.diameter/4]))));}
};
function extrudedSection(p,cs,height){const v=p.params;let s=move(use(cs.extrude(height)),[0,0,-height/2]);if(p.type==='wedge')s=use(s.rotate([90,0,90]));if(p.type==='arch')s=move(use(s.rotate([90,0,0])),[0,0,-v.diameter/4]);if(p.type==='halfCylinder')s=move(s,[0,-v.diameter/4,0]);return s;}
const torus=(major,minor)=>use(use(use(C.circle(minor,48)).translate([major,0])).revolve(96));
function capsule(d,h){if(h-d<.001)return use(M.sphere(d/2,64));return union([cyl(d,h-d),move(use(M.sphere(d/2,64)),[0,0,(h-d)/2]),move(use(M.sphere(d/2,64)),[0,0,-(h-d)/2])]);}
function baseShape(p){
 validatePart(p);const v=p.params;
 switch(p.type){
  case 'block':return slab(v.width,v.depth,v.height,v.radius);
  case 'cylinder':return cyl(v.diameter,v.height);
  case 'cone':return cyl(v.diameter,v.height,v.top);
  case 'sphere':return use(M.sphere(v.diameter/2,64));
  case 'ellipsoid':return use(use(M.sphere(1,64)).scale([v.width/2,v.depth/2,v.height/2]));
  case 'capsule':return capsule(v.diameter,v.height);
  case 'torus':return torus((v.diameter-v.thickness)/2,v.thickness/2);
  case 'pyramid':return use(M.hull([[-v.width/2,-v.depth/2,-v.height/2],[v.width/2,-v.depth/2,-v.height/2],[v.width/2,v.depth/2,-v.height/2],[-v.width/2,v.depth/2,-v.height/2],[0,0,v.height/2]]));
  case 'polygon':case 'star':case 'halfCylinder':return extrudedSection(p,section(p),v.height);
  case 'arch':return extrudedSection(p,section(p),v.depth);
  case 'tube':return use(cyl(v.diameter,v.height).subtract(cyl(v.diameter-2*v.wall,v.height+2)));
  case 'wedge':return prism([[-v.depth/2,-v.height/2],[v.depth/2,-v.height/2],[v.depth/2,v.height/2]],v.width);
  case 'bracket':{
   const cs=use(new C([[[-v.depth/2,-v.height/2],[v.depth/2,-v.height/2],[-v.depth/2,v.height/2]]]));
   const ring=use(cs.subtract(use(cs.offset(-v.wall))));return use(move(use(ring.extrude(v.width)),[0,0,-v.width/2]).rotate([90,0,90]));
  }
  case 'dome':{
   const sphere=use(use(M.sphere(v.diameter/2,64)).scale([1,1,2*v.height/v.diameter]));
   return move(use(sphere.intersect(box([v.diameter+2,v.diameter+2,v.height],[0,0,v.height/2]))),[0,0,-v.height/2]);
  }
  case 'bowl':{
   const outside=move(use(use(M.sphere(v.diameter/2,96)).scale([1,1,2*v.height/v.diameter])),[0,0,v.height/2]);
   const half=use(outside.intersect(box([v.diameter+2,v.diameter+2,v.height],[0,0,0])));
   const inside=move(use(use(M.sphere((v.diameter-2*v.wall)/2,96)).scale([1,1,2*(v.height-v.wall)/(v.diameter-2*v.wall)])),[0,0,v.height/2+.02]);
   return use(half.subtract(inside));
  }
  case 'hook':{
   const r=v.opening/2+v.thickness;
   const ring=use(use(C.circle(r,96)).subtract(use(C.circle(v.opening/2,96))));
   const opening=use(use(C.square([r+2,v.opening*.7],true)).translate([(r+2)/2,0]));
   return use(move(use(use(ring.subtract(opening)).extrude(v.depth)),[0,0,-v.depth/2]).rotate([90,0,0]));
  }
  case 'tray':{
   let s=use(slab(v.width,v.depth,v.height,v.radius).subtract(slab(v.width-2*v.wall,v.depth-2*v.wall,v.height-v.floor+1,Math.max(0,v.radius-v.wall),v.floor/2+.5)));
   const pieces=[s];for(let i=1;i<v.compartments;i++)pieces.push(box([v.wall,v.depth-2*v.wall+.2,v.height-v.floor+.2],[-v.width/2+v.wall+(v.width-2*v.wall)*i/v.compartments,0,v.floor/2-.1]));return union(pieces);
  }
 }
 throw new Error('Unsupported shape.');
}
function cavity(p,outer){const v=p.params,t=p.shell;
 switch(p.type){
  case 'sphere':return use(M.sphere(v.diameter/2-t,64));
  case 'block':return slab(v.width-2*t,v.depth-2*t,v.height-2*t,Math.max(0,v.radius-t));
  case 'cylinder':return cyl(v.diameter-2*t,v.height-2*t);
  case 'ellipsoid':return use(use(M.sphere(1,64)).scale([v.width/2-t,v.depth/2-t,v.height/2-t]));
  case 'capsule':return capsule(v.diameter-2*t,v.height-2*t);
  case 'torus':return torus((v.diameter-v.thickness)/2,v.thickness/2-t);
  case 'cone':{const k=(v.top-v.diameter)/(2*v.height),gap=t*Math.sqrt(1+k*k);let low=-v.height/2+t,high=v.height/2-t,rb=v.diameter/2+k*t-gap,rt=v.top/2-k*t-gap;if(rb<0&&k>0){low=-v.height/2+(gap-v.diameter/2)/k;rb=0;}if(rt<0&&k<0){high=-v.height/2+(gap-v.diameter/2)/k;rt=0;}if(high<=low||Math.max(rb,rt)<=0)throw new Error(`${p.name}: reduce shell thickness to leave an interior.`);return move(cyl(Math.max(0,rb)*2,high-low,Math.max(0,rt)*2),[0,0,(high+low)/2]);}
  case 'wedge':case 'polygon':case 'star':case 'halfCylinder':case 'arch':{
   const cs=use(section(p).offset(-t)),height=(p.type==='wedge'?v.width:p.type==='arch'?v.depth:v.height)-2*t;
   if(cs.isEmpty())throw new Error(`${p.name}: reduce shell thickness to leave an interior.`);
   return extrudedSection(p,cs,height);
  }
  case 'dome':{const sphere=use(use(M.sphere(1,64)).scale([v.diameter/2-t,v.diameter/2-t,v.height-t]));return move(use(sphere.intersect(box([v.diameter,v.diameter,v.height-2*t],[0,0,v.height/2]))),[0,0,-v.height/2]);}
  default:return use(outer.minkowskiDifference(use(M.sphere(t,32))));
 }
}
export function patternDirections(p){
 const f=p.surface;if(f.pattern==='none')return[];
 const r=p.params.diameter/2-(f.mode==='holes'?p.shell:0),holeRadius=f.pattern==='hexagon'?f.size/Math.sqrt(3):f.size/2;
 if(holeRadius>=r)throw new Error(`${p.name}: reduce pattern size or shell thickness.`);
 const angle=2*Math.asin(holeRadius/r)+f.gap/r,estimate=Math.ceil(4*Math.PI/(angle*angle));
 if(estimate>300)throw new Error(`${p.name}: increase pattern size or web spacing for a lighter model (up to 240 openings).`);
 const count=Math.max(12,estimate*6),directions=[],limit=Math.cos(angle),gold=Math.PI*(3-Math.sqrt(5));
 for(let i=0;i<count;i++){const z=1-2*(i+.5)/count,q=Math.sqrt(1-z*z),a=i*gold,n=[q*Math.cos(a),q*Math.sin(a),z];if(directions.every(d=>d[0]*n[0]+d[1]*n[1]+d[2]*n[2]<=limit))directions.push(n);}
 if(directions.length>240)throw new Error(`${p.name}: increase pattern size or web spacing (up to 240 openings).`);
 if(directions.length<4)throw new Error(`${p.name}: reduce pattern size or spacing to distribute at least four openings.`);
 return directions;
}
function patterned(p,s){
 const f=p.surface;if(f.pattern==='none')return s;const r=p.params.diameter/2,dirs=patternDirections(p),cutters=[];
 for(const n of dirs){
  let cutter;
  if(f.mode==='dimples'&&f.pattern==='round'){
   // Spherical cutters sized for the requested opening on the curved ball.
   const a=f.size/2,z=Math.sqrt(r*r-a*a),c=(2*r*f.depth-f.depth*f.depth)/(2*(z-r+f.depth));
   if(z-r+f.depth<=0)throw new Error(`${p.name}: increase dimple depth or reduce the dimple width.`);
   cutter=move(use(M.sphere(c-r+f.depth,32)),n.map(x=>x*c));
  }else{
   const low=f.mode==='holes'?r-p.shell-1:r-f.depth,high=r+Math.max(2,f.size*.15),height=high-low;
   cutter=f.pattern==='hexagon'?use(use(C.circle(f.size/Math.sqrt(3),6)).extrude(height)):use(M.cylinder(height,f.size/2,f.size/2,32,false));
   const m=new Matrix4().compose(new Vector3(...n.map(x=>x*low)),new Quaternion().setFromUnitVectors(new Vector3(0,0,1),new Vector3(...n)),new Vector3(1,1,1));cutter=use(cutter.transform(m.toArray()));
  }
  cutters.push(cutter);
 }
 return use(s.subtract(union(cutters)));
}
const shapeCache=new Map();
function shape(p){validatePart(p);const key=JSON.stringify([p.type,p.params,p.hollow,p.shell,p.surface]);if(shapeCache.has(key))return use(M.ofMesh(shapeCache.get(key)));
 let s=baseShape(p);if(p.hollow){const inner=cavity(p,s);if(inner.isEmpty())throw new Error(`${p.name}: reduce shell thickness to leave an interior.`);s=use(s.subtract(inner));}s=patterned(p,s);
 if(s.isEmpty())throw new Error(`${p.name}: these settings remove the whole piece.`);
 const raw=s.getMesh();shapeCache.set(key,raw);if(shapeCache.size>30)shapeCache.delete(shapeCache.keys().next().value);return s;
}
function meshOf(s){
 const original=use(s.asOriginal()),clean=use(original.simplify(.001));
 if(clean.isEmpty())throw new Error('The openings remove the entire design. Move or resize a cutout.');
 const raw=clean.getMesh(),vertices=[],triangles=[];
 for(let i=0;i<raw.vertProperties.length;i+=raw.numProp)vertices.push(Array.from(raw.vertProperties.slice(i,i+3)));
 for(let i=0;i<raw.triVerts.length;i+=3)triangles.push(Array.from(raw.triVerts.slice(i,i+3)));
 const bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
 for(const v of vertices)for(let a=0;a<3;a++){bounds[0][a]=Math.min(bounds[0][a],v[a]);bounds[1][a]=Math.max(bounds[1][a],v[a]);}
 const pieces=clean.decompose();pieces.forEach(use);
 return {vertices,triangles,bounds,dims:bounds[1].map((n,i)=>n-bounds[0][i]),volume:clean.volume(),components:pieces.filter(p=>p.volume()>0).length};
}
function finish(){for(const o of pool.reverse())o.delete();pool=[];}
export function buildDesign(p){
 if(!M)throw new Error('The model engine is loading.');validateProject(p);pool=[];
 try{
  const parts=[],solids=[],holes=[];
  for(const a of p.parts){if(!a.visible)continue;const local=shape(a),world=use(local.transform(worldMatrix(a,p.parts).toArray()));const view=meshOf(local),bounds=world.boundingBox();parts.push({id:a.id,...view,worldBounds:[bounds.min,bounds.max]});(a.hole?holes:solids).push(world);}
  if(!solids.length)return {parts,mesh:null,cutouts:holes.length};
  let joined=union(solids);if(holes.length)joined=use(joined.subtract(union(holes)));
  return {parts,mesh:meshOf(joined),cutouts:holes.length};
 }finally{finish();}
}
export function partBounds(p,parts){pool=[];try{const s=use(baseShape(p).transform(worldMatrix(p,parts).toArray()));const b=s.boundingBox();return[b.min,b.max];}finally{finish();}}
export function fitBed(m,bed){const [x,y,z]=m.dims,[bx,by,bz]=bed;const normal=x<=bx+.0001&&y<=by+.0001,turned=y<=bx+.0001&&x<=by+.0001;return{fits:z<=bz+.0001&&(normal||turned),rotate:!normal&&turned,brimFits:z<=bz&&(x+10<=bx&&y+10<=by||y+10<=bx&&x+10<=by)};}
const coords=m=>m.vertices.map(v=>[v[0]-(m.bounds[0][0]+m.bounds[1][0])/2,v[1]-(m.bounds[0][1]+m.bounds[1][1])/2,v[2]-m.bounds[0][2]]);
export function stl(m){
 const vs=coords(m),out=new Uint8Array(84+50*m.triangles.length),d=new DataView(out.buffer);out.set(strToU8('Print Studio | millimeters | model only'));d.setUint32(80,m.triangles.length,true);
 m.triangles.forEach((ids,i)=>{const[a,b,c]=ids.map(id=>vs[id]),u=b.map((n,j)=>n-a[j]),v=c.map((n,j)=>n-a[j]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;let at=84+i*50;for(const value of [...n.map(x=>x/len),...a,...b,...c]){d.setFloat32(at,value,true);at+=4;}});return out;
}
const xmlEscape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function threeMF(m,name){
 const vs=coords(m),xml=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${xmlEscape(name)}</metadata><metadata name="Designer">Print Studio</metadata><resources><object id="1" type="model"><mesh><vertices>${vs.map(v=>`<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join('')}</vertices><triangles>${m.triangles.map(t=>`<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
 return zipSync({'[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),'_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),'3D/3dmodel.model':strToU8(xml)},{level:6});
}
