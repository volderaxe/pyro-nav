const HOME_BASE_ID='ruin-station';
const initialStations=[
 {id:'ruin-station',name:'Ruin Station',type:'regular',status:'done',notes:'Permanent home base · every cargo route returns here'},
 {id:'checkmate',name:'Checkmate',type:'external',status:'done',notes:'External freight elevator'},
 {id:'stanton-gateway',name:'Stanton Gateway',type:'external',status:'done',notes:'External freight elevator'},
 {id:'nyx-gateway',name:'Nyx Gateway',type:'external',status:'done',notes:'External freight elevator'},
 {id:'gaslight',name:'Gaslight',type:'external',status:'done',notes:'External freight elevator'},
 {id:'megumi',name:'Megumi Refueling',type:'external',status:'done',notes:'External freight elevator'},
 {id:'orbituary',name:'Orbituary',type:'external',status:'done',notes:'External freight elevator'},
 {id:'endgame',name:'Endgame',type:'regular',status:'done',notes:''},
 {id:'starlight',name:'Starlight',type:'regular',status:'done',notes:''},
 {id:'patch-city',name:'Patch City',type:'regular',status:'done',notes:''},
 {id:'dudley',name:'Dudley & Daughters',type:'regular',status:'done',notes:''},
 {id:'rats-nest',name:"Rat's Nest",type:'regular',status:'done',notes:''},
 {id:'rods',name:"Rod's",type:'regular',status:'done',notes:"Rod's Fuel 'N Supplies"}
];
// Community chart values; values are kept symmetric. Source table includes Ruin but it is not preloaded.
const names=['Checkmate','Dudley & Daughters','Endgame','Gaslight','Megumi Refueling','Nyx Gateway','Orbituary','Patch City',"Rat's Nest","Rod's",'Ruin','Stanton Gateway','Starlight'];
const rows=[
[null,77.69,59.93,48.38,65.42,57.71,27.99,10.12,53.23,32.54,76.73,47.79,26.25],
[77.69,null,115.25,60.62,128.37,27.8,58.49,20.92,29.06,104.92,78.35,118.53,59.06],
[59.93,115.25,null,56.51,108.36,87.78,85.61,50.59,101.37,34.56,136.49,86.58,83.8],
[48.38,60.62,56.51,null,113.8,32.86,55.86,41.28,54.99,58.03,105.09,95.68,54.56],
[65.42,128.37,108.36,113.8,null,117.11,70.57,73.51,99.34,74.06,78.36,21.78,70.42],
[57.71,27.8,87.78,32.86,117.11,null,47.66,56.07,29.62,80.6,85.52,103.43,47.36],
[27.99,58.49,85.61,55.86,70.57,47.66,null,35.45,30.12,60.53,51.59,60.14,1.81],
[10.12,20.92,50.59,41.28,73.51,56.07,35.45,null,56.91,26.9,85.9,54.52,33.64],
[53.23,29.06,101.37,54.99,99.34,29.62,30.12,56.91,null,83.82,56.08,90.23,30.96],
[32.54,104.92,34.56,58.03,74.06,80.6,60.53,26.9,83.82,null,42.92,52.35,58.79],
[76.73,78.35,136.49,105.09,78.36,85.52,51.59,85.9,56.08,42.92,null,82.67,53.68],
[47.79,118.53,86.58,95.68,21.78,103.43,60.14,54.52,90.23,52.35,82.67,null,59.47],
[26.25,59.06,83.8,54.56,70.42,47.36,1.81,33.64,30.96,58.79,53.68,59.47,null]
];
let persistenceWritable=true,persistenceIssue='';
function validStationList(value){return Array.isArray(value)&&value.every(s=>s&&typeof s==='object'&&!Array.isArray(s)&&typeof s.id==='string'&&s.id.length>0&&typeof s.name==='string'&&s.name.trim().length>0&&(s.type==='regular'||s.type==='external')&&(s.status==='done'||s.status==='todo')&&(s.notes===undefined||typeof s.notes==='string')&&(s.visitedAt===undefined||typeof s.visitedAt==='string')&&(s.routeVisitWasDone===undefined||typeof s.routeVisitWasDone==='boolean'))&&new Set(value.map(s=>s.id)).size===value.length}
function validRouteList(value){return Array.isArray(value)&&value.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.id==='string'&&r.id.length>0&&typeof r.name==='string'&&r.name.trim().length>0&&Array.isArray(r.stops)&&r.stops.every(id=>typeof id==='string'&&id.length>0)&&new Set(r.stops).size===r.stops.length&&(r.completed===undefined||Array.isArray(r.completed)&&r.completed.every(id=>typeof id==='string'&&r.stops.includes(id)))&&(r.returnedHome===undefined||typeof r.returnedHome==='boolean')&&(r.runStarted===undefined||typeof r.runStarted==='boolean')&&(r.active===undefined||typeof r.active==='boolean'))&&new Set(value.map(r=>r.id)).size===value.length}
function validDistances(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(d=>typeof d==='number'&&Number.isFinite(d)&&d>=0)}
function load(key,fallback,validate){
 let raw;
 try{raw=localStorage.getItem(key)}catch{
  persistenceWritable=false;
  persistenceIssue='Browser storage is unavailable. The app is using temporary defaults and changes will not be saved in this browser.';
  return JSON.parse(JSON.stringify(fallback));
 }
 if(raw===null)return JSON.parse(JSON.stringify(fallback));
 try{
  const value=JSON.parse(raw);
  if(!validate(value))throw new Error('invalid saved data');
  return value;
 }catch{
  persistenceWritable=false;
  persistenceIssue='Saved browser data is damaged or has an unsupported format. The app is using temporary defaults and will not overwrite saved data. Export anything recoverable before resetting browser data.';
  return JSON.parse(JSON.stringify(fallback));
 }
}
let stations=load('pyroStations',initialStations,validStationList),routes=load('pyroRoutes',[],validRouteList),current=load('pyroCurrent','ruin-station',value=>typeof value==='string'),activeRoute=load('pyroActiveRoute','',value=>typeof value==='string'),customDistances=load('pyroDistances',{},validDistances);
routes.forEach(route=>{if(route.returnedHome)route.active=false;else if(route.active===undefined)route.active=route.id===activeRoute||route.runStarted===true});
if(!stations.some(s=>s.id===HOME_BASE_ID))stations.unshift({...initialStations[0]});
const homeStation=stations.find(s=>s.id===HOME_BASE_ID);
homeStation.name='Ruin Station';homeStation.type='regular';homeStation.status='done';
routes.forEach(r=>{if(r.stops.includes(HOME_BASE_ID)){r.stops=r.stops.filter(id=>id!==HOME_BASE_ID);r.completed=(r.completed||[]).filter(id=>id!==HOME_BASE_ID)}});
function setPersistenceIssue(message){persistenceWritable=false;persistenceIssue=message;let warning=document.getElementById('persistenceWarning');if(warning){warning.textContent=message;warning.hidden=false}}
function save(){
 if(!persistenceWritable)return false;
 const values={pyroStations:stations,pyroRoutes:routes,pyroCurrent:current,pyroActiveRoute:activeRoute,pyroDistances:customDistances};
 const previous={};
 try{
  Object.keys(values).forEach(key=>previous[key]=localStorage.getItem(key));
  const written=[];
  try{
   Object.entries(values).forEach(([key,value])=>{localStorage.setItem(key,JSON.stringify(value));written.push(key)});
   return true;
  }catch(error){
   let rollbackFailed=false;
   written.forEach(key=>{try{if(previous[key]===null)localStorage.removeItem(key);else localStorage.setItem(key,previous[key])}catch{rollbackFailed=true}});
   setPersistenceIssue('Could not save changes to browser storage. '+(rollbackFailed?'Some stored values may have changed. ':'')+'Changes will remain available until this page is closed, but may not be saved for next time.');
   return false;
  }
 }catch{
  setPersistenceIssue('Browser storage is unavailable. Changes will remain available until this page is closed, but will not be saved for next time.');
  return false;
 }
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getStation(id){return stations.find(s=>s.id===id)}
function dist(a,b){if(!a||!b||a===b)return a===b?0:null;let key=[a,b].sort().join('|');if(customDistances[key]!=null)return Number(customDistances[key]);let sa=getStation(a),sb=getStation(b);if(!sa||!sb)return null;let i=names.findIndex(n=>matchName(n)===matchName(sa.name)),j=names.findIndex(n=>matchName(n)===matchName(sb.name));if(i<0||j<0)return null;return rows[i][j]}
function routeDistanceSummary(route,start=HOME_BASE_ID,stops=route.stops){let known=0,unknown=[];let from=start;for(const id of stops){const leg=dist(from,id);if(leg===null)unknown.push([from,id]);else known+=leg;from=id}const home=dist(from,HOME_BASE_ID);if(home===null)unknown.push([from,HOME_BASE_ID]);else known+=home;return{known,unknown}}
function getRouteDistanceSummary(route){const runStarted=route.runStarted||(route.completed||[]).length>0||route.returnedHome;if(!runStarted)return routeDistanceSummary(route);const completed=new Set(route.completed||[]),remaining=route.stops.filter(id=>!completed.has(id)),lastCompleted=route.stops.slice().reverse().find(id=>completed.has(id)),start=route.id===activeRoute&&getStation(current)?current:(lastCompleted||HOME_BASE_ID);return routeDistanceSummary(route,start,remaining)}
function formatRouteDistance(summary){return summary.unknown.length?`${summary.known.toFixed(2)} AU known · ${summary.unknown.length} unknown leg${summary.unknown.length===1?'':'s'}`:`${summary.known.toFixed(2)} AU estimated`}
function matchName(n){let s=n.toLowerCase().replace(/station/g,'').trim();if(s==="rat's nest")return "rat's nest";if(s==="rod's fuel 'n supplies"||s==="rod's")return "rod's";return s}
function closestFrom(id,onlyTodo=true){if(!id)return null;return stations.filter(s=>s.id!==id&&(!onlyTodo||s.status!=='done')).map(s=>({s,d:dist(id,s.id)})).filter(x=>x.d!=null).sort((a,b)=>a.d-b.d)[0]||null}
function fmtDist(d){return d==null?'DIST. N/A':Number(d).toFixed(2)+' AU*'}
function showPage(p){document.querySelectorAll('.content>div[id$="Page"]').forEach(x=>x.classList.add('hidden'));document.getElementById(p+'Page').classList.remove('hidden');document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.page===p));if(p==='stations')renderStations();if(p==='routes'){renderRoutes();renderRouteChecklist()}if(p==='distances')renderMatrix();window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>showPage(b.dataset.page));function goRoutes(){showPage('routes')}
function renderAll(){save();if(persistenceIssue)setPersistenceIssue(persistenceIssue);renderOverview();renderStations();renderRoutes();renderRouteChecklist();renderMatrix();document.getElementById('navCount').textContent=stations.length}
function renderOverview(){
 const done=stations.filter(s=>s.status==='done').length,remaining=stations.length-done,totalRouteStops=routes.reduce((sum,route)=>sum+route.stops.length,0),completedRouteStops=routes.reduce((sum,route)=>sum+route.stops.filter(id=>(route.completed||[]).includes(id)).length,0);
 const activeRouteCount=routes.filter(route=>route.active===true).length;
 document.getElementById('statTotal').textContent=stations.length;document.getElementById('statDone').textContent=done;document.getElementById('statRemaining').textContent=remaining;document.getElementById('statRoutes').textContent=activeRouteCount;
 const pct=totalRouteStops?Math.round(completedRouteStops/totalRouteStops*100):0;document.getElementById('completionPct').textContent=pct+'%';document.getElementById('completionBig').innerHTML=completedRouteStops+'<span style="font-size:14px;color:var(--muted)"> / '+totalRouteStops+' stops</span>';document.getElementById('completionBar').style.width=pct+'%'; document.getElementById('routeRollupCaption').textContent=routes.length?`${activeRouteCount} active of ${routes.length} saved routes · ${done} of ${stations.length} stations marked visited in your registry`:'No saved routes yet. Create a route to start tracking stop completion.';
 let sel=document.getElementById('currentSelect');sel.innerHTML=stations.map(s=>`<option value="${esc(s.id)}" ${s.id===current?'selected':''}>${esc(s.name)}${s.id===HOME_BASE_ID?' · HOME BASE':''}</option>`).join('');
 let near=closestFrom(current,true);document.getElementById('closestName').textContent=near?near.s.name:(remaining?'No distance data available':'All stations visited');document.getElementById('closestSub').textContent=near?(near.s.type==='external'?'External freight elevator':'Regular station')+' · Not visited':current?'No unvisited stations with known distances':'Set your current station to calculate';document.getElementById('closestDistance').textContent=near?fmtDist(near.d):'—';
 const overviewRouteCards=document.getElementById('overviewRouteCards');
 overviewRouteCards.innerHTML=routes.map(route=>{
  const completed=(route.completed||[]).filter(id=>route.stops.includes(id)).length,routePct=route.stops.length?Math.round(completed/route.stops.length*100):0,next=route.stops.map(id=>getStation(id)).find(s=>s&&!(route.completed||[]).includes(s.id)),nextLabel=next?`Next: ${next.name}`:route.returnedHome?'All stops and return complete':'Next: Return to Ruin Station',distance=formatRouteDistance(getRouteDistanceSummary(route));
  return `<div class="overview-route-card ${route.id===activeRoute?'selected':''}"><div class="overview-route-cardhead"><strong>${esc(route.name)}</strong><div><span class="badge ${route.active?'done':''}">${route.active?'ACTIVE':'PAUSED'}</span> <span class="badge ${completed===route.stops.length?'done':'todo'}">${completed}/${route.stops.length} STOPS</span> <span class="badge ${route.returnedHome?'done':''}">${route.returnedHome?'RETURNED':'RETURN LEG'}</span></div></div><div class="progress"><div style="width:${routePct}%"></div></div><div class="overview-route-next">${esc(nextLabel)}</div><div class="overview-route-distance">${esc(distance)}</div><div class="overview-route-cardactions"><button class="track-overview-route" data-route-id="${esc(route.id)}">${route.id===activeRoute?'Focused':'Focus'}</button><button class="toggle-overview-route" data-route-id="${esc(route.id)}">${route.active?'Pause':'Activate'}</button><button class="plan-overview-route" data-route-id="${esc(route.id)}">Plan route</button></div></div>`;
 }).join('')||'<div class="empty">No routes yet. Create a route to track your stops.</div>';
 overviewRouteCards.querySelectorAll('.track-overview-route').forEach(button=>button.onclick=()=>focusRoute(button.dataset.routeId));
 overviewRouteCards.querySelectorAll('.toggle-overview-route').forEach(button=>button.onclick=()=>toggleRouteActive(button.dataset.routeId));
 overviewRouteCards.querySelectorAll('.plan-overview-route').forEach(button=>button.onclick=()=>openRoutePlan(button.dataset.routeId));
 let r=routes.find(x=>x.id===activeRoute),routeSelect=document.getElementById('overviewRouteSelect'),next=r&&r.stops.map(id=>getStation(id)).find(s=>s&&!(r.completed||[]).includes(s.id));
 routeSelect.innerHTML=`<option value="" ${r?'':'selected'}>No focused route</option>`+routes.map(route=>`<option value="${esc(route.id)}" ${route.id===activeRoute?'selected':''}>${esc(route.name)}${route.active?' · ACTIVE':' · PAUSED'}</option>`).join('');
 routeSelect.disabled=false;
 document.getElementById('nextName').textContent=next?next.name:(r&&!r.returnedHome?'Return to Ruin Station':'No focused route stop');document.getElementById('nextSub').textContent=r? r.name+' · '+(r.active?'Active':'Paused')+' · '+(r.completed||[]).length+'/'+r.stops.length+' stops complete · '+(r.returnedHome?'Returned to Ruin':'Ruin return required'):'Create or focus a route to follow stops.';
 const feed=stations.slice().sort((a,b)=>a.name.localeCompare(b.name)),includedStations=r?feed.filter(s=>r.stops.includes(s.id)):[];
 const renderRouteStation=s=>{const done=(r.completed||[]).includes(s.id);return `<div class="station"><div><div class="stationname">${esc(s.name)}</div><div class="stationmeta">${s.type==='external'?'EXTERNAL FREIGHT ELEVATOR':'REGULAR STATION'}</div></div><span class="badge ${done?'done':'todo'}">${done?'VISITED':'NOT VISITED'}</span><div class="stationbuttons"><button onclick="toggleRouteStop('${r.id}','${s.id}')">${done?'Undo':'✓ Done'}</button></div></div>`};
 document.getElementById('feed').innerHTML=includedStations.map(renderRouteStation).join('')||'<div class="empty">No focused route. Create or select a route to see its stops.</div>';
 const excluded=feed.filter(s=>!r||!r.stops.includes(s.id)),excludedSection=document.querySelector('.excluded-stations');
 document.getElementById('excludedSummary').textContent=`Not on this route (${excluded.length})`;
 document.getElementById('excludedFeed').innerHTML=excluded.map(s=>`<div class="station"><div><div class="stationname">${esc(s.name)}</div><div class="stationmeta">${s.type==='external'?'EXTERNAL FREIGHT ELEVATOR':'REGULAR STATION'}</div></div><span class="badge">N/A</span><span></span></div>`).join('')||'<div class="empty">Every station is on this route.</div>';
 excludedSection.hidden=excluded.length===0;excludedSection.open=false;
}
function renderStations(){let q=(document.getElementById('stationSearch')?.value||'').toLowerCase(),f=document.getElementById('stationFilter')?.value||'all',sort=document.getElementById('sortSelect')?.value||'name';let list=stations.filter(s=>(s.name+' '+s.notes).toLowerCase().includes(q)&&(f==='all'||f===s.type||f===s.status));list.sort((a,b)=>sort==='status'?a.status.localeCompare(b.status)||a.name.localeCompare(b.name):sort==='type'?a.type.localeCompare(b.type)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));let groups=[['external','EXTERNAL FREIGHT ELEVATORS'],['regular','REGULAR STATIONS']];document.getElementById('stationList').innerHTML=groups.map(([type,title])=>{let g=list.filter(s=>s.type===type);return g.length?`<div class="stationgroup"><div class="grouphead"><span>${title}</span><span>${g.length} RECORDS</span></div>${g.map(s=>`<div class="station"><div><div class="stationname">${esc(s.name)}</div><div class="stationmeta">${esc(s.notes||'No notes')} ${s.id===current?' · CURRENT LOCATION':''}</div></div><span class="badge ${s.status}">${s.status==='done'?'VISITED':'NOT VISITED'}</span><div class="stationbuttons">${s.id===HOME_BASE_ID?'<span class="muted">FIXED HOME BASE</span>':`<button onclick="toggleStatus('${s.id}')">${s.status==='done'?'Undo':'✓ Visited'}</button><button onclick="editStation('${s.id}')">Edit</button><button class="danger" onclick="deleteStation('${s.id}')">×</button>`}</div></div>`).join('')}</div>`:''}).join('')||'<div class="empty">No stations match this filter.</div>'}
function routeMarksStation(id){return routes.some(r=>(r.completed||[]).includes(id))}
function reconcileRouteVisit(id){let s=getStation(id);if(!s||id===HOME_BASE_ID)return;if(routeMarksStation(id)){s.status='done';return}if(typeof s.routeVisitWasDone==='boolean'){s.status=s.routeVisitWasDone?'done':'todo';if(!s.routeVisitWasDone)delete s.visitedAt;delete s.routeVisitWasDone}}
function toggleStatus(id){let s=getStation(id);if(!s||id===HOME_BASE_ID)return;if(routeMarksStation(id)){alert('Undo this station on its completed route before changing its visit status.');return}s.status=s.status==='done'?'todo':'done';if(s.status==='done')s.visitedAt=new Date().toISOString();else delete s.visitedAt;renderAll()}
function setCurrent(id){current=getStation(id)?id:'';if(current){let s=getStation(current);s.status='done';if(routeMarksStation(current))s.routeVisitWasDone=true}save();renderAll()}
function resetStatuses(){if(!confirm('Reset every station to Not Visited? This does not delete your routes.'))return;stations.forEach(s=>{s.status=s.id===HOME_BASE_ID?'done':'todo';delete s.visitedAt;delete s.routeVisitWasDone});current='';routes.forEach(r=>{r.completed=[];r.returnedHome=false;r.runStarted=false});renderAll()}
function openStationModal(){document.getElementById('stationForm').reset();document.getElementById('editStationId').value='';document.getElementById('stationModalTitle').textContent='Add station';document.getElementById('stationStatus').value='todo';document.getElementById('stationModal').classList.add('open')}
function editStation(id){let s=getStation(id);if(!s||id===HOME_BASE_ID){if(id===HOME_BASE_ID)alert('Ruin Station is the fixed home base and cannot be edited.');return}document.getElementById('stationForm').reset();document.getElementById('editStationId').value=id;document.getElementById('stationName').value=s.name;document.getElementById('stationType').value=s.type;document.getElementById('stationStatus').value=s.status;document.getElementById('stationNotes').value=s.notes||'';document.getElementById('stationModalTitle').textContent='Edit station';document.getElementById('stationModal').classList.add('open')}
document.getElementById('stationForm').onsubmit=e=>{e.preventDefault();let id=document.getElementById('editStationId').value,name=document.getElementById('stationName').value.trim();if(id===HOME_BASE_ID){alert('Ruin Station is the fixed home base and cannot be edited.');return}if(!name)return;if(stations.some(s=>s.name.toLowerCase()===name.toLowerCase()&&s.id!==id)){alert('A station with that name already exists.');return}let data={name,type:document.getElementById('stationType').value,status:document.getElementById('stationStatus').value,notes:document.getElementById('stationNotes').value.trim()};if(id)Object.assign(getStation(id),data);else stations.push({id:'station-'+Date.now(),...data});closeModal('stationModal');renderAll()};
function deleteStation(id){let s=getStation(id);if(!s||id===HOME_BASE_ID||!confirm('Delete '+s.name+'? This also removes it from saved routes.'))return;stations=stations.filter(x=>x.id!==id);routes.forEach(r=>{r.stops=r.stops.filter(x=>x!==id);r.completed=(r.completed||[]).filter(x=>x!==id)});if(current===id)current='';renderAll()}
function openRouteModal(){document.getElementById('routeForm').reset();document.getElementById('routeStart').innerHTML='<option value="ruin-station">Ruin Station (fixed home base)</option>';document.getElementById('routeTypeFilter').value='all';renderRoutePicks();document.getElementById('routeModal').classList.add('open')}
function renderRoutePicks(){let f=document.getElementById('routeTypeFilter').value;let list=stations.filter(s=>s.id!==HOME_BASE_ID&&(f==='all'||s.type===f));document.getElementById('routePicks').innerHTML=list.map(s=>`<label class="pick"><input type="checkbox" value="${esc(s.id)}" checked><span>${esc(s.name)}<small style="display:block;color:var(--muted)">${s.type==='external'?'External elevator':'Regular station'}</small></span></label>`).join('')||'<span class="muted">No stations in this category.</span>'}
document.getElementById('routeForm').onsubmit=e=>{e.preventDefault();let stops=[...document.querySelectorAll('#routePicks input:checked')].map(x=>x.value).filter(id=>id!==HOME_BASE_ID);if(!stops.length){alert('Select at least one station to visit.');return}let r={id:'route-'+Date.now(),name:document.getElementById('routeName').value.trim(),stops,completed:[],returnedHome:false,runStarted:false};routes.push(r);activeRoute=r.id;closeModal('routeModal');renderAll();showPage('routes')};
function renderRoutes(){
 document.getElementById('routeCountTag').textContent=routes.length+' ROUTES';
 document.getElementById('routeCards').innerHTML=routes.map(r=>`<div class="route-stop" style="${r.id===activeRoute?'border-color:#3d9eae':''}"><div class="num">⌁</div><div><strong>${esc(r.name)}</strong><small>${r.stops.length} stops · ${(r.completed||[]).length} route stops complete · ${r.active?'ACTIVE':'PAUSED'}</small><small class="route-card-distance">${esc(formatRouteDistance(getRouteDistanceSummary(r)))}</small></div><div class="stopactions"><button onclick="focusRoute('${r.id}')">${r.id===activeRoute?'Focused':'Focus'}</button><button onclick="toggleRouteActive('${r.id}')">${r.active?'Pause':'Activate'}</button><button onclick="deleteRoute('${r.id}')" class="danger">×</button></div></div>`).join('')||'<div class="empty">No saved routes. Create one to begin planning.</div>';
 let r=routes.find(x=>x.id===activeRoute);
 if(!r){document.getElementById('activeRoutePanel').innerHTML='<div class="empty">Choose a saved route or create a new one.</div>';return}
 document.getElementById('activeRoutePanel').innerHTML=`<div class="eyebrow" style="margin-bottom:5px">FOCUSED ITINERARY · ${r.active?'ACTIVE':'PAUSED'}</div><h3 style="font-size:19px;margin:0 0 5px">${esc(r.name)}</h3><div class="muted" style="font-size:11px;margin-bottom:12px">${(r.completed||[]).length} / ${r.stops.length} selected stops complete</div><div class="progress"><div style="width:${r.stops.length?Math.round((r.completed||[]).length/r.stops.length*100):0}%"></div></div><div class="route-list"><div class="route-stop"><div class="num">⌂</div><div><strong>Ruin Station</strong><small>HOME BASE · DEPARTURE</small></div><span class="badge done">START</span></div>${r.stops.map((id,i)=>{let s=getStation(id),done=(r.completed||[]).includes(id);if(!s)return'';let prev=i===0?((r.completed||[]).length===0&&getStation(current)?current:HOME_BASE_ID):r.stops[i-1],d=dist(prev,id),origin=i===0&&(r.completed||[]).length===0&&current&&current!==HOME_BASE_ID?'from current station':'from previous stop';return `<div class="route-stop ${done?'completed':''}"><div class="num">${done?'✓':String(i+1).padStart(2,'0')}</div><div><strong>${esc(s.name)}</strong><small>${s.type==='external'?'External freight elevator':'Regular station'} · ${fmtDist(d)} ${origin}</small></div><div class="stopactions"><button onclick="moveStop('${r.id}',${i},-1)" ${i===0?'disabled':''}>↑</button><button onclick="moveStop('${r.id}',${i},1)" ${i===r.stops.length-1?'disabled':''}>↓</button><button onclick="toggleRouteStop('${r.id}','${id}')">${done?'Undo':'Done'}</button></div></div>`}).join('')}<div class="route-stop ${r.returnedHome?'completed':''}"><div class="num">${r.returnedHome?'✓':'↩'}</div><div><strong>Ruin Station</strong><small>MANDATORY RETURN · CARGO DELIVERY</small></div><div class="stopactions"><button onclick="toggleReturnHome('${r.id}')">${r.returnedHome?'Undo return':'Returned'}</button></div></div></div><div class="actions" style="margin-top:12px"><button onclick="optimizeRoute('${r.id}')">Optimize order</button><button onclick="clearRouteProgress('${r.id}')">Reset route progress</button></div><div class="note">Ruin Station is always the departure and return point. Optimize order keeps completed stops fixed and includes the known return leg to Ruin; unknown distances limit optimization. Review the route before flying.</div>`
}
function renderRouteChecklist(){
 const route=routes.find(item=>item.id===activeRoute),panel=document.getElementById('activeRoutePanel');
 if(!panel)return;
 if(!route)return;
 const started=route.runStarted||(route.completed||[]).length>0||route.returnedHome,completed=new Set(route.completed||[]),next=route.stops.find(id=>!completed.has(id)),distance=getRouteDistanceSummary(route),missing=distance.unknown.map(([from,to])=>`${getStation(from)?.name||from} → ${getStation(to)?.name||to}`).join(', ');
 const action=!started?'Ready to depart from Ruin Station':next?`Next stop: ${getStation(next)?.name||'Unavailable station'}`:route.returnedHome?'Haul run complete':'All stops complete · return to Ruin Station';
 const checklist=`<div class="haul-checklist"><div class="haul-checklist-head"><div><div class="eyebrow">HAUL RUN CHECKLIST</div><strong>${esc(action)}</strong></div><span class="badge ${route.returnedHome?'done':started?'current':''}">${route.returnedHome?'COMPLETE':started?'IN PROGRESS':'READY'}</span></div><div class="haul-distance"><span>Remaining estimate</span><strong>${esc(formatRouteDistance(distance))}</strong></div>${distance.unknown.length?`<div class="haul-warning">${esc(missing)} <button onclick="showPage('distances')">Add distances</button></div>`:''}<div class="haul-checklist-actions">${started?`<button onclick="startFreshHaulRun('${route.id}')">Start fresh run</button>`:`<button class="primary" onclick="startHaulRun('${route.id}')">Start haul run</button>`}${started&&!route.returnedHome&&!next?`<button class="primary" onclick="toggleReturnHome('${route.id}')">Complete return to Ruin</button>`:''}</div></div>`;
 const stopList=panel.querySelector('.route-list');
 if(stopList)stopList.insertAdjacentHTML('beforebegin',checklist);
}
function focusRoute(id){activeRoute=routes.some(route=>route.id===id)?id:'';save();renderAll()}
function activateRoute(id){let route=routes.find(item=>item.id===id);if(!route)return;route.active=true;activeRoute=id;save();renderAll()}
function toggleRouteActive(id){let route=routes.find(item=>item.id===id);if(!route)return;if(!route.active&&route.returnedHome){alert('This haul run is complete. Start a fresh run from the focused route to activate it again.');return}route.active=!route.active;if(route.active)activeRoute=id;save();renderAll()}
function openRoutePlan(id){focusRoute(id);showPage('routes')}
function deleteRoute(id){if(!confirm('Delete this route?'))return;routes=routes.filter(r=>r.id!==id);if(activeRoute===id)activeRoute=routes[0]?.id||'';renderAll()}
function moveStop(rid,i,delta){let r=routes.find(x=>x.id===rid),j=i+delta;if(!r||j<0||j>=r.stops.length)return;[r.stops[i],r.stops[j]]=[r.stops[j],r.stops[i]];renderAll()}
function startHaulRun(rid){let r=routes.find(x=>x.id===rid);if(!r)return;r.runStarted=true;r.active=true;r.returnedHome=false;if(!getStation(current))current=HOME_BASE_ID;activeRoute=rid;renderAll()}
function startFreshHaulRun(rid){let r=routes.find(x=>x.id===rid);if(!r||!confirm('Start a fresh haul run? This clears this route’s stop and return progress but keeps the saved route.'))return;let completed=[...(r.completed||[])];r.completed=[];r.returnedHome=false;r.runStarted=true;r.active=true;completed.forEach(reconcileRouteVisit);current=HOME_BASE_ID;activeRoute=rid;renderAll()}
function toggleRouteStop(rid,id){let r=routes.find(x=>x.id===rid);if(!r)return;r.completed=r.completed||[];if(r.completed.includes(id)){r.completed=r.completed.filter(x=>x!==id);r.returnedHome=false;reconcileRouteVisit(id);if(current===id&&getStation(id)?.status==='todo'){let index=r.stops.indexOf(id);current=r.stops.slice(0,index).reverse().find(stop=>(r.completed||[]).includes(stop))||HOME_BASE_ID}}else{if(!r.active){alert('Activate this route before checking off route stops.');return}if(!r.runStarted&&!(r.completed||[]).length){alert('Start the haul run before checking off route stops.');return}const nextStop=r.stops.find(stop=>!r.completed.includes(stop));if(nextStop!==id){alert(`Complete ${getStation(nextStop)?.name||'the next route stop'} first to keep the haul run in order.`);return}let s=getStation(id);if(s&&!routeMarksStation(id))s.routeVisitWasDone=s.status==='done';r.completed.push(id);if(s){s.status='done';s.visitedAt=s.visitedAt||new Date().toISOString()}current=id;r.returnedHome=false}renderAll()}
function toggleReturnHome(rid){let r=routes.find(x=>x.id===rid);if(!r)return;if(r.returnedHome){r.returnedHome=false;r.active=true;r.runStarted=true}else{if(!r.active){alert('Activate this route before recording the return.');return}if(!r.runStarted&&!(r.completed||[]).length){alert('Start the haul run before recording the return.');return}if(!r.stops.every(id=>(r.completed||[]).includes(id))){alert('Complete every route stop before recording the return to Ruin Station.');return}r.returnedHome=true;r.active=false;current=HOME_BASE_ID}renderAll()}
function clearRouteProgress(rid){let r=routes.find(x=>x.id===rid);if(r){let completed=[...(r.completed||[])];r.completed=[];r.returnedHome=false;r.runStarted=false;r.active=false;completed.forEach(reconcileRouteVisit)}current=HOME_BASE_ID;renderAll()}
function routeCost(start,order){let total=0,from=start;for(const id of order){let leg=dist(from,id);if(leg==null)return null;total+=leg;from=id}let home=dist(from,HOME_BASE_ID);return home==null?null:total+home}
function optimizeRoute(rid){
 let r=routes.find(x=>x.id===rid);if(!r||r.stops.length<2)return;
 let completed=new Set(r.completed||[]),done=r.stops.filter(id=>completed.has(id)),remaining=r.stops.filter(id=>!completed.has(id));
 if(!remaining.length)return;
 let start=getStation(current)?current:(done.length?done[done.length-1]:HOME_BASE_ID);
 let order=[];
 while(remaining.length){
  let from=order.length?order[order.length-1]:start;
  let candidates=remaining.map((id,index)=>({id,index,d:dist(from,id)})).filter(x=>x.d!=null).sort((a,b)=>a.d-b.d||a.index-b.index);
  let next=candidates.length?candidates[0].id:remaining[0];
  order.push(next);remaining=remaining.filter(id=>id!==next);
 }
 let bestCost=routeCost(start,order);
 if(bestCost!==null){
  let improved=true;
  while(improved){
   improved=false;
   for(let i=0;i<order.length-1&&!improved;i++)for(let j=i+1;j<order.length;j++){
    let candidate=[...order.slice(0,i),...order.slice(i,j+1).reverse(),...order.slice(j+1)],cost=routeCost(start,candidate);
    if(cost!==null&&cost<bestCost){order=candidate;bestCost=cost;improved=true;break}
   }
  }
 }
 r.stops=[...done,...order];r.returnedHome=false;activeRoute=rid;renderAll()
}
function openDistanceModal(){let opts=stations.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');document.getElementById('distanceFrom').innerHTML=opts;document.getElementById('distanceTo').innerHTML=opts;document.getElementById('distanceValue').value='';document.getElementById('distanceModal').classList.add('open')}
document.getElementById('distanceForm').onsubmit=e=>{e.preventDefault();let a=document.getElementById('distanceFrom').value,b=document.getElementById('distanceTo').value,v=Number(document.getElementById('distanceValue').value);if(a===b){alert('Choose two different stations.');return}if(!Number.isFinite(v)||v<0)return;customDistances[[a,b].sort().join('|')]=v;closeModal('distanceModal');renderAll()}
function renderMatrix(){let q=(document.getElementById('distanceSearch')?.value||'').toLowerCase(),list=stations.filter(s=>s.name.toLowerCase().includes(q));document.getElementById('matrixWrap').innerHTML=`<table style="border-collapse:collapse;width:100%;font-size:11px;white-space:nowrap"><thead><tr><th style="text-align:left;position:sticky;left:0;background:#101922;padding:10px;border-bottom:1px solid var(--line)">FROM / TO</th>${list.map(s=>`<th style="padding:10px;border-bottom:1px solid var(--line);color:var(--cyan)">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${list.map(a=>`<tr><th style="text-align:left;position:sticky;left:0;background:#101922;padding:10px;border-bottom:1px solid #1d2b34">${esc(a.name)}</th>${list.map(b=>{let d=dist(a.id,b.id);return `<td title="${esc(a.name)} to ${esc(b.name)}" style="text-align:center;padding:10px;border-bottom:1px solid #1d2b34;color:${a.id===b.id?'var(--muted)':d==null?'#526674':'var(--text)'};background:${a.id===b.id?'#18242c':'transparent'}">${a.id===b.id?'—':d==null?'·':Number(d).toFixed(2)}</td>`}).join('')}</tr>`).join('')}</tbody></table><div class="note">* Distance values are from a community reference table; values added manually override the reference. Dot means no known value.</div>`}
function exportData(){let blob=new Blob([JSON.stringify({stations,routes,current,activeRoute,customDistances},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='pyro-nav-backup.json';a.click();URL.revokeObjectURL(a.href)}
function validBackupData(data){if(!data||typeof data!=='object'||!validStationList(data.stations)||!validRouteList(data.routes)||typeof data.current!=='string'||typeof data.activeRoute!=='string'||!validDistances(data.customDistances))return false;const ids=new Set(data.stations.map(s=>s.id)),routeIds=new Set(data.routes.map(r=>r.id));if(data.current&&!ids.has(data.current)||data.activeRoute&&!routeIds.has(data.activeRoute))return false;if(data.routes.some(r=>r.stops.some(id=>!ids.has(id)||id===HOME_BASE_ID)))return false;return Object.keys(data.customDistances).every(key=>{const pair=key.split('|');return pair.length===2&&pair[0]!==pair[1]&&ids.has(pair[0])&&ids.has(pair[1])})}
async function importBackup(file){if(!file)return;let data;try{data=JSON.parse(await file.text())}catch{alert('This file is not valid JSON. Your saved data was not changed.');return}if(!validBackupData(data)){alert('This backup has missing or invalid Pyro Nav data. Your saved data was not changed.');return}if(!confirm('Replace the current Pyro Nav data with this backup?'))return;const old={stations,routes,current,activeRoute,customDistances},oldIssue=persistenceIssue;stations=data.stations.map(s=>({...s}));if(!stations.some(s=>s.id===HOME_BASE_ID))stations.unshift({...initialStations[0]});const home=stations.find(s=>s.id===HOME_BASE_ID);home.name='Ruin Station';home.type='regular';home.status='done';routes=data.routes.map(r=>({...r,stops:r.stops.filter(id=>id!==HOME_BASE_ID),completed:(r.completed||[]).filter(id=>id!==HOME_BASE_ID),runStarted:r.runStarted??((r.completed||[]).length>0||r.returnedHome===true),active:r.returnedHome===true?false:r.active??(r.id===data.activeRoute||(r.completed||[]).length>0)}));current=data.current;activeRoute=data.activeRoute;customDistances={...data.customDistances};persistenceWritable=true;persistenceIssue='';if(!save()){stations=old.stations;routes=old.routes;current=old.current;activeRoute=old.activeRoute;customDistances=old.customDistances;persistenceWritable=false;if(!persistenceIssue)persistenceIssue=oldIssue;renderAll();alert('The backup could not be saved to browser storage. The current in-memory data was restored.');return}const warning=document.getElementById('persistenceWarning');warning.hidden=true;warning.textContent='';renderAll();alert('Backup restored successfully.')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
function resetData(){if(!confirm('Reset all Pyro Nav data to defaults? This does not affect other websites’ browser data.'))return;const keys=['pyroStations','pyroRoutes','pyroCurrent','pyroActiveRoute','pyroDistances'],previous={};try{keys.forEach(key=>previous[key]=localStorage.getItem(key))}catch{setPersistenceIssue('Browser storage could not be read, so the reset was cancelled and saved data was left untouched.');return}const removed=[];try{keys.forEach(key=>{localStorage.removeItem(key);removed.push(key)})}catch{let rollbackFailed=false;removed.forEach(key=>{try{if(previous[key]!==null)localStorage.setItem(key,previous[key])}catch{rollbackFailed=true}});setPersistenceIssue('Browser storage could not complete the reset. '+(rollbackFailed?'Some saved values may have changed.':'The app attempted to restore the saved data.'));return}persistenceWritable=true;persistenceIssue='';stations=initialStations.map(s=>({...s}));routes=[];current='ruin-station';activeRoute='';customDistances={};renderAll()}
function updateClock(){document.getElementById('clock').textContent=new Date().toLocaleTimeString([], {hour12:false})}
setInterval(updateClock,1000);updateClock();renderAll();
