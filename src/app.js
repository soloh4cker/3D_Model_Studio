import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {SHAPES,HOLLOW_TYPES,part,project,clone,copyPiece,pastePiece,round,worldMatrix,poseFromMatrix,setWorldMatrix,descendants,detach,validateProject} from './model.js';
import {initializeGeometry,buildDesign,partBounds,patternDirections,fitBed,stl,threeMF} from './geometry.js';

const $=id=>document.getElementById(id),fmt=n=>Number(n.toFixed(2)).toString(),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='print-studio-design-v1';
let state=project('phone'),selected=state.parts[0].id,history=[],future=[],ready=false,output=null,timer,toastTimer,preview='edit',mobilePanel='preview',tool='translate',cameraView='iso',dirty=false;
let clipboard=null,pasteCount=0,inside=false;
try{const saved=localStorage.getItem(KEY);if(saved){state=validateProject(JSON.parse(saved));selected=state.parts[0]?.id||null;}}catch{}
const current=()=>state.parts.find(p=>p.id===selected);
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function checkpoint(){const s=clone(state);if(!history.length||JSON.stringify(history.at(-1))!==JSON.stringify(s))history.push(s);if(history.length>80)history.shift();future=[];updateHistory();}
function updateHistory(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function change(fn){checkpoint();fn();dirty=true;renderList();renderInspector();schedule();}
function restore(s){state=s;if(!current())selected=state.parts[0]?.id||null;renderAll();schedule();}
$('undo').addEventListener('click',()=>{if(!history.length)return;future.push(clone(state));restore(history.pop());updateHistory();});
$('redo').addEventListener('click',()=>{if(!future.length)return;history.push(clone(state));restore(future.pop());updateHistory();});
function select(id,{panel=false}={}){selected=id;preview='edit';renderList();renderInspector();switchPreview('edit');if(panel&&matchMedia('(max-width:760px)').matches)setPanel('settings');attachHandles();applyInside();}
function numberField(container,id,label,value,min,max,step=.5,unit='mm',onInput){
 const div=document.createElement('div');div.className='field';div.innerHTML=`<label for="${id}">${esc(label)}</label><div class="input-wrap"><input type="number" id="${id}" value="${Number.isFinite(value)?value:''}" min="${min}" max="${max}" step="${step}" inputmode="decimal"><span>${unit}</span></div>`;container.append(div);
 const input=div.querySelector('input');input.addEventListener('focus',checkpoint);input.addEventListener('input',()=>{onInput(input.value===''?NaN:Number(input.value));dirty=true;schedule();});return input;
}
const ICONS={
 block:'<path d="M9 9l22-5 13 8v17l-22 5-13-8zM9 9l13 8 22-5M22 17v17"/>',
 cylinder:'<ellipse cx="26" cy="9" rx="16" ry="5"/><path d="M10 9v21c0 7 32 7 32 0V9M10 30c0-7 32-7 32 0"/>',
 wedge:'<path d="M8 30l28-24 10 9v17L18 37 8 30l10-3 28-12M18 27v10"/>',
 sphere:'<circle cx="26" cy="20" r="16"/><ellipse cx="26" cy="20" rx="7" ry="16"/><ellipse cx="26" cy="20" rx="16" ry="6"/>',
 dome:'<path d="M8 29a18 23 0 0 1 36 0c0 10-36 10-36 0M8 29c0-10 36-10 36 0"/>',
 cone:'<path d="M22 5L9 31c0 8 34 8 34 0L31 5"/><ellipse cx="26.5" cy="5" rx="4.5" ry="2"/><path d="M9 31c0-8 34-8 34 0"/>',
 tray:'<path d="M7 10l25-6 15 8v18l-25 6-15-8zM7 10l15 9 25-7M22 19v17M7 22l15 8 25-6"/>',
 tube:'<ellipse cx="26" cy="9" rx="16" ry="6"/><ellipse cx="26" cy="9" rx="10" ry="3"/><path d="M10 9v20c0 8 32 8 32 0V9"/>',
 bowl:'<ellipse cx="26" cy="10" rx="20" ry="7"/><path d="M6 10c0 32 40 32 40 0"/><ellipse cx="26" cy="10" rx="15" ry="4"/>',
 hook:'<path d="M43 7c-25-17-42 24-15 29 9 2 14-2 18-8l-7-4c-3 4-7 5-11 3-14-6-4-26 11-14z"/>',
 bracket:'<path d="M8 6h8v23h29v8H8zM8 6l37 31M16 20l17 9"/>'
 ,polygon:'<path d="M13 8l14-4 14 7v19l-14 7-14-8zM13 8v21M13 8l14 8 14-5M27 16v21"/>'
 ,pyramid:'<path d="M27 4L8 30l20 8 18-12L27 4 28 38M8 30l18-7 20 3"/>'
 ,capsule:'<path d="M16 13c0-13 21-13 21 0v16c0 13-21 13-21 0zM16 13c0 8 21 8 21 0M16 29c0-8 21-8 21 0"/>'
 ,ellipsoid:'<ellipse cx="27" cy="21" rx="22" ry="13"/><ellipse cx="27" cy="21" rx="8" ry="13"/><path d="M5 21c8-6 36-6 44 0"/>'
 ,torus:'<ellipse cx="27" cy="19" rx="22" ry="13"/><ellipse cx="27" cy="18" rx="11" ry="5"/><path d="M5 19v5c0 18 44 18 44 0v-5"/>'
 ,arch:'<path d="M6 35v-8c0-29 42-29 42 0v8h-9v-8c0-17-24-17-24 0v8z"/>'
 ,star:'<path d="M27 3l6 11 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z"/>'
 ,halfCylinder:'<path d="M10 16c0-17 34-17 34 0H10v17h34V16M10 33c0-17 34-17 34 0"/>'
};
function renderPalette(){
 $('palette').innerHTML=['Shapes','More shapes','Useful parts'].map(group=>`${group==='More shapes'?'<details class="more-shapes"><summary>More shapes <span class="count">8</span></summary>':`<p class="palette-label">${group}</p>`}<div class="shape-grid">${Object.entries(SHAPES).filter(([,s])=>s.group===group).map(([type,s])=>`<button class="shape-button" data-add="${type}" title="${esc(s.description)}" disabled><svg viewBox="0 0 54 42" aria-hidden="true">${ICONS[type]}</svg>${s.name}</button>`).join('')}</div>${group==='More shapes'?'</details>':''}`).join('');
 $('palette').querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>addPiece(b.dataset.add)));
}
function renderList(){
 $('partCount').textContent=state.parts.length;$('partsHint').textContent=state.parts.length?'Click a piece here or in the preview.':'Add your first shape above.';
 $('partList').innerHTML=state.parts.map(p=>`<div class="part-row${p.id===selected?' active':''}" role="listitem"><button class="part-select" data-select="${esc(p.id)}" aria-pressed="${p.id===selected}" title="${esc(p.name)}${p.parentId?' · attached':''}"><span class="part-dot${p.hole?' hole':''}" aria-hidden="true"></span><span>${esc(p.name)}</span></button>${p.parentId?'<span class="linked" title="Moves with its parent" aria-label="Attached">↳</span>':''}<button class="visibility${p.visible?'':' is-hidden'}" data-visible="${esc(p.id)}" aria-label="${p.visible?'Hide':'Show'} ${esc(p.name)}" title="Hidden pieces are excluded from export">${p.visible?'◉':'○'}</button></div>`).join('');
 $('partList').querySelectorAll('[data-select]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.select,{panel:true})));
 $('partList').querySelectorAll('[data-visible]').forEach(b=>b.addEventListener('click',()=>change(()=>{const p=state.parts.find(x=>x.id===b.dataset.visible);p.visible=!p.visible;})));
}
function renderInspector(){
 const p=current();$('copyPiece').disabled=!p||!ready;$('pastePiece').disabled=!clipboard||!ready||state.parts.length>=60;$('selectedInspector').hidden=!p;$('emptyInspector').hidden=!!p;if(!p)return;
 $('partName').value=p.name;$('shapeBadge').textContent=SHAPES[p.type].name;$('partDescription').textContent=SHAPES[p.type].description;
 for(const [id,active] of [['solidMode',!p.hole],['holeMode',p.hole]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}
 $('operationNote').textContent=p.hole?'This piece removes material from every visible solid it crosses.':'Overlapping solids combine in the print result.';
 $('shapeFields').replaceChildren();for(const f of SHAPES[p.type].fields)numberField($('shapeFields'),'param-'+f.key,f.label,p.params[f.key],f.min,f.max,f.step,f.unit,n=>{p.params[f.key]=n;});
 renderShell(p);
 let pose;try{pose=poseFromMatrix(worldMatrix(p,state.parts));}catch{pose={position:p.position,rotation:p.rotation};}
 $('positionFields').replaceChildren();$('angleFields').replaceChildren();
 for(let i=0;i<3;i++){
  numberField($('positionFields'),'pos-'+i,['X','Y','Z'][i],pose.position[i],-5000,5000,.5,'mm',n=>editPose('position',i,n));
  numberField($('angleFields'),'rot-'+i,['Tilt X','Tilt Y','Turn Z'][i],pose.rotation[i],-3600,3600,1,'°',n=>editPose('rotation',i,n));
 }
 const bad=descendants(p.id,state.parts);const choices=state.parts.filter(x=>!bad.has(x.id)&&x.visible&&!x.hole);
 const prev=$('targetPart').value;$('targetPart').innerHTML=choices.length?choices.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''):'<option value="">No eligible target</option>';
 if(choices.some(x=>x.id===prev))$('targetPart').value=prev;
 $('attach').disabled=!choices.length||!p.visible||!ready;
 $('onBed').disabled=!p.visible;$('centerXY').disabled=!p.visible;
 const parent=state.parts.find(x=>x.id===p.parentId);$('detach').hidden=!parent;$('attachmentNote').textContent=parent?`Moves with ${parent.name}. Size changes may need a new placement.`:'Independent piece. Attach to move it with another piece.';
}
function renderShell(p){
 const supported=HOLLOW_TYPES.includes(p.type);$('shellSection').hidden=!supported;$('hollowEnabled').checked=p.hollow;$('shellFields').hidden=!p.hollow;$('shellFields').replaceChildren();
 if(p.hollow)numberField($('shellFields'),'shellThickness','Shell thickness',p.shell,.4,100,.1,'mm',n=>{p.shell=n;});
 $('shellNote').textContent=['ellipsoid','dome'].includes(p.type)?'Closed shell. Thickness is nominal: curved walls vary with the proportions.':'Closed shell with an internal cavity. Add a cutout for an open container.';
 $('surfaceSection').hidden=p.type!=='sphere';$('surfacePattern').value=p.surface.pattern;$('surfaceMode').value=p.surface.mode;$('surfaceControls').hidden=p.surface.pattern==='none';$('surfaceFields').replaceChildren();
 if(p.type==='sphere'&&p.surface.pattern!=='none'){
  numberField($('surfaceFields'),'surfaceSize',p.surface.pattern==='hexagon'?'Hexagon across flats':'Opening diameter',p.surface.size,1,100,.5,'mm',n=>{p.surface.size=n;});
  numberField($('surfaceFields'),'surfaceGap','Minimum web spacing',p.surface.gap,.8,100,.1,'mm',n=>{p.surface.gap=n;});
  if(p.surface.mode==='dimples')numberField($('surfaceFields'),'surfaceDepth','Recess depth',p.surface.depth,.2,30,.1,'mm',n=>{p.surface.depth=n;});
 }
 $('insideView').checked=inside;
 updateSurfaceNote(p);
}
function updateSurfaceNote(p){if(!p||p.type!=='sphere')return;try{const count=patternDirections(p).length;$('surfaceNote').textContent=count?`${count} ${p.surface.mode==='holes'?'through holes':'recesses'}. Web spacing controls the material between openings; shell thickness controls the wall. Patterns are distributed around the sphere, with varying gaps.`:'Choose round or hexagonal openings. Through holes turn Hollow on automatically; dimples leave material underneath.';}catch(e){$('surfaceNote').textContent=e.message;}}
$('hollowEnabled').addEventListener('change',e=>{if(current())change(()=>{current().hollow=e.target.checked;if(!current().hollow&&current().surface.mode==='holes')current().surface.pattern='none';});});
$('surfacePattern').addEventListener('change',e=>{if(current())change(()=>{current().surface.pattern=e.target.value;if(e.target.value!=='none'&&current().surface.mode==='holes')current().hollow=true;});});
$('surfaceMode').addEventListener('change',e=>{if(current())change(()=>{current().surface.mode=e.target.value;if(e.target.value==='holes'&&current().surface.pattern!=='none')current().hollow=true;});});
$('insideView').addEventListener('change',e=>{inside=e.target.checked;applyInside();});
function editPose(key,i,n){
 const p=current();if(!p)return;
 const read=prefix=>[0,1,2].map(j=>$(prefix+j).value===''?NaN:Number($(prefix+j).value));
 const pose={position:read('pos-'),rotation:read('rot-')};
 if([...pose.position,...pose.rotation].some(x=>!Number.isFinite(x)))return;
 const m=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rotation.map(x=>x*Math.PI/180),'XYZ')),new THREE.Vector3(1,1,1));setWorldMatrix(p,m,state.parts);
}
function renderPrinter(){
 $('bedFields').replaceChildren();for(let i=0;i<3;i++)numberField($('bedFields'),'bed-'+i,['Width (X)','Depth (Y)','Height (Z)'][i],state.bed[i],20,2000,1,'mm',n=>{state.bed[i]=n;updatePrinterSummary();});updatePrinterSummary();
}
function updatePrinterSummary(){$('printerSummary').textContent=state.bed.every(Number.isFinite)?state.bed.map(fmt).join(' × '):'Check size';}
function renderAll(){$('projectName').value=state.name;renderList();renderInspector();renderPrinter();updateHistory();}
function setPanel(panel){mobilePanel=panel;document.body.dataset.panel=panel;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));if(panel==='preview'){requestAnimationFrame(()=>{resizeViewer();fitCamera();});}window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.panel)));
function addPiece(type){
 if(state.parts.length>=60){toast('This version supports up to 60 pieces per design.');return;}
 if(!ready)return;checkpoint();const p=part(type);
 const b=partBounds(p,[p]),width=b[1][0]-b[0][0];
 const max=output?.mesh?.bounds[1][0]??-width/2-12;p.position=[round(max+width/2+12),0,-b[0][2]];
 p.name=SHAPES[type].name+' '+(state.parts.filter(x=>x.type===type).length+1);state.parts.push(p);selected=p.id;renderAll();schedule();if(matchMedia('(max-width:760px)').matches)setPanel('settings');
}
$('partName').addEventListener('focus',checkpoint);$('partName').addEventListener('input',e=>{if(current()){current().name=e.target.value||SHAPES[current().type].name;renderList();schedule();}});
$('projectName').addEventListener('focus',checkpoint);$('projectName').addEventListener('input',e=>{state.name=e.target.value||'Untitled design';schedule();});
$('solidMode').addEventListener('click',()=>{if(current())change(()=>current().hole=false);});$('holeMode').addEventListener('click',()=>{if(current())change(()=>current().hole=true);});
function copySelected(){const p=current();if(!p)return;try{validatePoseFields();validateProject(state);clipboard=copyPiece(p,state.parts);pasteCount=0;renderInspector();toast('Piece copied. Paste keeps its size, angles, shell, and pattern.');}catch(e){toast(e.message);}}
function pasteSelected(snapshot=clipboard,offsetCount=++pasteCount){if(!snapshot||!ready)return;if(state.parts.length>=60){toast('This version supports up to 60 pieces.');return;}try{const b=partBounds(snapshot,[snapshot]),c=pastePiece(snapshot,offsetCount*(b[1][0]-b[0][0]+8));change(()=>{state.parts.push(c);selected=c.id;});if(matchMedia('(max-width:760px)').matches)setPanel('settings');}catch(e){toast(e.message);}}
$('copyPiece').addEventListener('click',copySelected);$('pastePiece').addEventListener('click',()=>pasteSelected());
$('duplicate').addEventListener('click',()=>{const p=current();if(!p)return;try{validateProject(state);pasteSelected(copyPiece(p,state.parts),1);}catch(e){toast(e.message);}});
$('deletePart').addEventListener('click',()=>{const p=current();if(!p)return;change(()=>{for(const c of state.parts.filter(x=>x.parentId===p.id))detach(c,state.parts);state.parts=state.parts.filter(x=>x.id!==p.id);selected=state.parts.at(-1)?.id||null;});});
$('detach').addEventListener('click',()=>{if(!current())return;change(()=>detach(current(),state.parts));toast('Detached. Move the piece to separate it from the design.');});
function shift(p,delta){const m=worldMatrix(p,state.parts);m.elements[12]+=delta[0];m.elements[13]+=delta[1];m.elements[14]+=delta[2];setWorldMatrix(p,m,state.parts);}
function boundsOfAssembly(p){const ids=descendants(p.id,state.parts),bounds=state.parts.filter(x=>ids.has(x.id)&&x.visible).map(x=>partBounds(x,state.parts));return[[0,1,2].map(i=>Math.min(...bounds.map(b=>b[0][i]))),[0,1,2].map(i=>Math.max(...bounds.map(b=>b[1][i])))];}
$('onBed').addEventListener('click',()=>{const p=current();if(!p)return;try{change(()=>{const b=boundsOfAssembly(p);shift(p,[0,0,-b[0][2]]);});}catch(e){toast(e.message);}});
$('centerXY').addEventListener('click',()=>{const p=current();if(!p)return;try{change(()=>{const b=boundsOfAssembly(p);shift(p,[-(b[0][0]+b[1][0])/2,-(b[0][1]+b[1][1])/2,0]);});}catch(e){toast(e.message);}});
$('attach').addEventListener('click',()=>{
 const p=current(),target=state.parts.find(x=>x.id===$('targetPart').value);if(!p||!target||descendants(p.id,state.parts).has(target.id))return;
 try{change(()=>{const b=partBounds(p,state.parts),t=partBounds(target,state.parts),[axis,sign]={top:[2,1],bottom:[2,-1],left:[0,-1],right:[0,1],front:[1,-1],back:[1,1]}[$('attachFace').value];const delta=[0,1,2].map(i=>(t[0][i]+t[1][i]-b[0][i]-b[1][i])/2);delta[axis]=sign===1?t[1][axis]-b[0][axis]-.25:t[0][axis]-b[1][axis]+.25;const m=worldMatrix(p,state.parts);for(let i=0;i<3;i++)m.elements[12+i]+=delta[i];p.parentId=$('linkMovement').checked?target.id:null;setWorldMatrix(p,m,state.parts);});toast($('linkMovement').checked?'Attached. Moving the parent carries this piece.':'Placed. This piece moves independently.');}catch(e){toast(e.message);}
});
$('starter').addEventListener('change',e=>{const kind=e.target.value;e.target.value='';if(!kind)return;if(state.parts.length&&!confirm('Replace this design? Save project first if you want to keep an editable copy.'))return;checkpoint();state=project(kind);selected=state.parts[0]?.id||null;preview='edit';renderAll();schedule();switchPreview('edit');setPanel('preview');});
for(const id of ['printerDialog','helpDialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});
$('printerBtn').addEventListener('click',()=>$('printerDialog').showModal());$('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));

let renderer,scene,camera,orbit,transform,selectionBox,bedGroup,resultObject,partsGroup,partGroups=new Map(),activeGesture=false,gizmoUsed=false,clickStart;
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
function initViewer(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;$('viewer').append(renderer.domElement);
  renderer.localClippingEnabled=true;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.1,12000);camera.up.set(0,0,1);camera.position.set(180,-240,180);
  orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.minDistance=10;orbit.maxDistance=7000;orbit.target.set(0,0,35);
  scene.add(new THREE.AmbientLight(0xffffff,2.1));const light=new THREE.DirectionalLight(0xffffff,3.3);light.position.set(-150,-120,300);scene.add(light);const fill=new THREE.DirectionalLight(0xa4c3ff,1.5);fill.position.set(180,180,150);scene.add(fill);
  partsGroup=new THREE.Group();scene.add(partsGroup);bedGroup=new THREE.Group();scene.add(bedGroup);
  transform=new TransformControls(camera,renderer.domElement);transform.setSize(.78);scene.add(transform.getHelper());transform.setSpace('world');
  transform.addEventListener('dragging-changed',e=>{activeGesture=e.value;orbit.enabled=!e.value;if(e.value){gizmoUsed=true;checkpoint();}else finishGesture();});
  transform.addEventListener('objectChange',()=>{
   if(!activeGesture||!current()||!transform.object)return;
   if(tool!=='scale'){transform.object.updateMatrix();setWorldMatrix(current(),transform.object.matrix.clone(),state.parts);syncTransforms(true);updatePoseInputs();}
   selectionBox?.update();
  });
  renderer.domElement.addEventListener('pointerdown',e=>{gizmoUsed=false;clickStart=[e.clientX,e.clientY];},true);
  renderer.domElement.addEventListener('pointerup',e=>{if(gizmoUsed||preview!=='edit'||!clickStart||Math.hypot(e.clientX-clickStart[0],e.clientY-clickStart[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...partGroups.values()].map(g=>g.children[0]),false)[0];if(hit)select(hit.object.userData.id);});
  new ResizeObserver(resizeViewer).observe($('viewer'));resizeViewer();renderer.setAnimationLoop(()=>{orbit.update();renderer.render(scene,camera);});
 }catch(e){$('viewerError').hidden=false;$('viewerError').textContent='3D preview could not start. Try Chrome or Edge with graphics acceleration enabled. The piece controls and model exports remain available.';}
}
function resizeViewer(){if(!renderer)return;const w=$('viewer').clientWidth,h=$('viewer').clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}}
function clearGroup(group){if(!group)return;for(const obj of [...group.children]){obj.traverse(c=>{c.geometry?.dispose();if(c.material)for(const m of Array.isArray(c.material)?c.material:[c.material])m.dispose();});group.remove(obj);}}
function buffer(m){const arr=new Float32Array(m.triangles.length*9);let i=0;for(const ids of m.triangles)for(const id of ids)for(const n of m.vertices[id])arr[i++]=n;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(arr,3));g.computeVertexNormals();return g;}
function meshObject(m,color,hole=false){const g=buffer(m),mat=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.03,transparent:hole,opacity:hole?.28:1,depthWrite:!hole});const obj=new THREE.Mesh(g,mat);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(g,28),new THREE.LineBasicMaterial({color:hole?0xb95249:0x2c4b87,transparent:true,opacity:hole?.7:.25}));return [obj,edge];}
function renderMeshes(){
 if(!renderer||activeGesture||!output)return;transform.detach();clearGroup(partsGroup);partGroups.clear();
 if(resultObject){scene.remove(resultObject);clearGroup(resultObject);resultObject=null;}
 for(const info of output.parts){const p=state.parts.find(x=>x.id===info.id);if(!p)continue;const g=new THREE.Group();for(const obj of meshObject(info,p.hole?0xdd8479:0x5a80e8,p.hole)){g.add(obj);obj.userData.id=p.id;}g.children[0].userData.id=p.id;partsGroup.add(g);partGroups.set(p.id,g);}
 if(output.mesh){resultObject=new THREE.Group();for(const obj of meshObject(output.mesh,0x3c70e4))resultObject.add(obj);scene.add(resultObject);}
 syncTransforms();drawBed();applyPreview();attachHandles();applyInside();
}
function applyInside(){if(!renderer)return;const bounds=output?.mesh?.bounds?.map(b=>b[0])||[-20,20],p=current(),x=p?worldMatrix(p,state.parts).elements[12]:(bounds[0]+bounds[1])/2;const plane=new THREE.Plane(new THREE.Vector3(1,0,0),-x);for(const group of [partsGroup,resultObject])group?.traverse(obj=>{if(obj.material){obj.material.clippingPlanes=inside?[plane]:[];obj.material.side=inside?THREE.DoubleSide:THREE.FrontSide;obj.material.needsUpdate=true;}});$('insideLabel').hidden=!inside;}
function syncTransforms(skipSelected=false){for(const p of state.parts){const g=partGroups.get(p.id);if(!g||(skipSelected&&p.id===selected))continue;worldMatrix(p,state.parts).decompose(g.position,g.quaternion,g.scale);g.updateMatrixWorld(true);}partsGroup?.updateMatrixWorld(true);selectionBox?.update();}
function drawBed(){
 if(!renderer||!state.bed.every(Number.isFinite))return;clearGroup(bedGroup);const[x,y]=state.bed;
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(x,y),new THREE.MeshBasicMaterial({color:0xcdd9ec,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false}));plane.position.z=-.05;bedGroup.add(plane);
 const pts=[];const spacing=Math.max(10,Math.ceil(Math.max(x,y)/25/10)*10);for(let a=-x/2;a<=x/2;a+=spacing)pts.push(new THREE.Vector3(a,-y/2,-.04),new THREE.Vector3(a,y/2,-.04));for(let a=-y/2;a<=y/2;a+=spacing)pts.push(new THREE.Vector3(-x/2,a,-.04),new THREE.Vector3(x/2,a,-.04));
 bedGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xa4b9d8,transparent:true,opacity:.35})));
 const corners=[[-x/2,-y/2],[x/2,-y/2],[x/2,y/2],[-x/2,y/2],[-x/2,-y/2]].map(([a,b])=>new THREE.Vector3(a,b,0));bedGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners),new THREE.LineBasicMaterial({color:0x8fa9cc,transparent:true,opacity:.7})));
}
function attachHandles(){
 if(!transform)return;transform.detach();if(selectionBox){scene.remove(selectionBox);selectionBox.geometry.dispose();selectionBox.material.dispose();selectionBox=null;}
 for(const p of state.parts){const g=partGroups.get(p.id);if(g)g.children[0].material.color.setHex(p.hole?0xdd8479:p.id===selected?0x2b59ef:0x7196e5);}
 const p=current(),g=partGroups.get(selected);if(preview!=='edit'||!p||!g||!p.visible)return;
 selectionBox=new THREE.BoxHelper(g,0xee9833);selectionBox.material.transparent=true;selectionBox.material.opacity=.8;scene.add(selectionBox);transform.setMode(tool);transform.setSpace(tool==='scale'?'local':'world');
 transform.showX=true;transform.showY=!(tool==='scale'&&['cylinder','cone','tube','bowl','sphere','dome','hook','polygon','capsule','torus','star','halfCylinder'].includes(p.type));transform.showZ=!(tool==='scale'&&['sphere','hook','torus','arch'].includes(p.type));transform.attach(g);applySnap();
}
function updatePoseInputs(){const p=current();if(!p)return;const pose=poseFromMatrix(worldMatrix(p,state.parts));for(let i=0;i<3;i++){if($('pos-'+i))$('pos-'+i).value=pose.position[i];if($('rot-'+i))$('rot-'+i).value=pose.rotation[i];}}
function finishGesture(){
 if(!current())return;
 if(tool==='scale'&&transform.object){
  const p=current(),s=transform.object.scale.toArray().map(n=>Math.max(.02,Math.abs(n))),v=p.params,old={...v},size=SHAPES[p.type].sizeKeys;
  const radial=Math.abs(s[0]-1)>.001?s[0]:s[1];
  if(['sphere','hook','torus'].includes(p.type)){const factor=s.find(x=>Math.abs(x-1)>.001)??1;for(const f of SHAPES[p.type].fields)if(f.unit==='mm')v[f.key]=round(old[f.key]*factor);}
  else{for(let i=0;i<3;i++){const k=size[i];if(!k)continue;const factor=k==='diameter'?radial:s[i];v[k]=round(old[k]*factor);}if('top'in v)v.top=round(old.top*radial);if('radius'in v)v.radius=round(old.radius*Math.min(s[0],s[1]));if('wall'in v)v.wall=round(old.wall*Math.min(...s));if('floor'in v)v.floor=round(old.floor*s[2]);}
  for(const f of SHAPES[p.type].fields)v[f.key]=Math.max(f.min,Math.min(f.max,v[f.key]));
  if(p.hollow)p.shell=Math.max(.4,round(p.shell*Math.min(...s)));
  if(p.type==='sphere'){const factor=s.find(x=>Math.abs(x-1)>.001)??1;for(const key of ['size','gap','depth'])p.surface[key]=round(p.surface[key]*factor);if(p.hollow)p.shell=round(p.shell*factor/Math.min(...s));}
  if('inner'in v)v.inner=round(old.inner*radial);if(p.type==='arch')v.thickness=round(old.thickness*s[0]);
 }
 renderInspector();schedule();
}
function applySnap(){if(!transform)return;const enabled=$('snapEnabled').checked;transform.setTranslationSnap(enabled?Number($('snapStep').value):null);transform.setRotationSnap(enabled?5*Math.PI/180:null);transform.setScaleSnap(enabled?.1:null);}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{tool=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));switchPreview('edit');}));
$('snapEnabled').addEventListener('change',applySnap);$('snapStep').addEventListener('change',applySnap);
function fitCamera(){
 if(!camera)return;const b=output?.mesh?.bounds;const center=b?b[0].map((n,i)=>(n+b[1][i])/2):[0,0,20],dims=output?.mesh?.dims||[100,100,50];const size=Math.max(100,...dims),distance=size*2.2*Math.max(1,1/camera.aspect);
 orbit.target.set(...center);camera.up.set(0,0,1);
 if(cameraView==='top'){camera.up.set(0,1,0);camera.position.set(center[0],center[1],center[2]+distance);}
 else if(cameraView==='front')camera.position.set(center[0],center[1]-distance,center[2]+size*.05);
 else camera.position.set(center[0]+distance*.55,center[1]-distance*.65,center[2]+distance*.6);
 orbit.update();
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{cameraView=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));fitCamera();}));$('fitView').addEventListener('click',fitCamera);
function applyPreview(){if(!renderer)return;partsGroup.visible=preview==='edit';if(resultObject)resultObject.visible=preview==='result';if(selectionBox)selectionBox.visible=preview==='edit';if(preview==='result')transform.detach();else attachHandles();}
function switchPreview(mode){preview=mode;for(const[id,active]of[['editView',mode==='edit'],['resultView',mode==='result']]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}$('canvasHelp').textContent=mode==='result'?'Fused solids and cut openings · Drag to orbit · Select a piece in the list to edit':tool==='scale'?'Drag a handle to resize · Enter exact dimensions in Size & shape':tool==='rotate'?'Drag a ring to rotate · Snap uses 5° steps':'Click a piece to select · Drag handles to move · Drag empty space to orbit';applyPreview();}
$('editView').addEventListener('click',()=>switchPreview('edit'));$('resultView').addEventListener('click',()=>switchPreview('result'));
function exportButtons(disabled){$('downloadStl').disabled=disabled;$('download3mf').disabled=disabled;}
function schedule(){clearTimeout(timer);exportButtons(true);$('modelStatus').textContent=ready?'Updating design…':'Loading model engine…';timer=setTimeout(rebuild,160);}
let firstBuild=true;
function validatePoseFields(){if(current()&&[0,1,2].some(i=>['pos-','rot-'].some(prefix=>{const input=$(prefix+i),n=Number(input?.value);return input&&(input.value===''||!Number.isFinite(n)||Math.abs(n)>(prefix==='pos-'?5000:3600));})))throw new Error('Enter valid positions (±5000 mm) and angles (±3600°) to update the design.');}
function rebuild(){
 if(!ready)return;
 try{
  validatePoseFields();
  output=buildDesign(state);renderMeshes();updateSurfaceNote(current());if(firstBuild){fitCamera();firstBuild=false;}
  const m=output.mesh;if(!m){$('modelStatus').textContent=state.parts.length?'Add a visible solid':'Ready for your first piece';$('overallSize').textContent='—';$('modelDetail').textContent='Openings need a solid to cut';$('statusMessage').className='status-message';$('statusMessage').textContent='Choose a shape from Add a piece. You can change it into a cutout later.';exportButtons(true);}
  else{
   const fit=fitBed(m,state.bed);$('modelStatus').textContent=fit.fits?(fit.rotate?'Fits printer · rotate 90°':'Fits printer'):'Exceeds printer volume';$('modelStatus').className=fit.fits?'':'bad';$('overallSize').textContent=m.dims.map(fmt).join(' × ')+' mm';$('modelDetail').textContent=`${m.components} ${m.components===1?'connected solid':'separate solids'} · ${Math.round(m.volume/1000)} cm³ model volume`;
   $('statusMessage').className='status-message'+(!fit.fits?' error':m.components>1||!fit.brimFits?' warning':'');
   $('statusMessage').textContent=!fit.fits?`The upright result exceeds ${state.bed.map(fmt).join(' × ')} mm. Resize the design or change Printer settings.`:m.components>1?`${m.components} separate solids will export. Attach with overlap for one connected object, or keep them as separate pieces.`:!fit.brimFits?'The model fits with little room for a brim. Check placement in your slicer.':m.bounds[0][2]<-.01?'Some pieces are below the bed. Exports lift the lowest point to Z = 0; check the orientation and temporary supports in your slicer.':'Print result shows fused solids and cut openings. Choose orientation and temporary supports in your slicer.';
   exportButtons(!fit.fits);
  }
  $('saveStatus').textContent='Local design';try{localStorage.setItem(KEY,JSON.stringify(state));$('saveStatus').textContent='Saved in this browser';}catch{}
  dirty=false;
 }catch(e){output=null;exportButtons(true);$('modelStatus').textContent='Check the design';$('modelStatus').className='bad';$('modelDetail').textContent='Exports paused';$('overallSize').textContent='—';$('statusMessage').className='status-message error';$('statusMessage').textContent=e.message;if(resultObject)resultObject.visible=false;}
}
function saveBytes(bytes,name,mime){const url=URL.createObjectURL(new Blob([bytes],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(name+' downloaded.');}
const filename=()=>state.name.replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'print-studio-design';
$('saveProject').addEventListener('click',()=>{try{validatePoseFields();validateProject(state);saveBytes(JSON.stringify(state,null,2),filename()+'.printstudio.json','application/json');$('saveStatus').textContent='Project file saved';}catch(e){toast(e.message);}});
$('openProject').addEventListener('click',()=>$('projectFile').click());
$('projectFile').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>2000000)throw new Error('Choose a project file smaller than 2 MB.');const p=validateProject(JSON.parse(await f.text()));if(state.parts.length&&!confirm('Open this project and replace the current design?'))return;checkpoint();state=clone(p);selected=state.parts[0]?.id||null;firstBuild=true;renderAll();switchPreview('edit');schedule();setPanel('preview');toast('Editable project opened.');}catch(e){toast('Could not open project: '+e.message);}});
function download(format){clearTimeout(timer);rebuild();if(!output?.mesh||!fitBed(output.mesh,state.bed).fits)return;try{saveBytes(format==='stl'?stl(output.mesh):threeMF(output.mesh,state.name),filename()+'.'+format,format==='stl'?'model/stl':'model/3mf');}catch(e){toast('Could not export: '+e.message);}}
$('downloadStl').addEventListener('click',()=>download('stl'));$('download3mf').addEventListener('click',()=>download('3mf'));
window.addEventListener('keydown',e=>{
 const writing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
 const dialog=$('printerDialog').open||$('helpDialog').open;
 if((e.ctrlKey||e.metaKey)&&!writing&&!dialog){if(e.key.toLowerCase()==='c'&&current()){e.preventDefault();copySelected();return;}if(e.key.toLowerCase()==='v'&&clipboard){e.preventDefault();pasteSelected();return;}}
 if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='s'){e.preventDefault();$('saveProject').click();}else if(e.key.toLowerCase()==='o'){e.preventDefault();$('openProject').click();}else if(!writing&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}else if(!writing&&e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();}return;}
 if(writing||$('printerDialog').open||$('helpDialog').open)return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('deletePart').click();}if(e.key==='Escape'){selected=null;renderList();renderInspector();attachHandles();}
});
renderPalette();renderAll();document.body.dataset.panel='preview';initViewer();
initializeGeometry().then(()=>{ready=true;document.querySelectorAll('[data-add]').forEach(b=>b.disabled=false);renderInspector();rebuild();}).catch(e=>{$('modelStatus').textContent='Model engine unavailable';$('statusMessage').className='status-message error';$('statusMessage').textContent='Open this file in a current browser with WebAssembly enabled.';console.error(e);});
