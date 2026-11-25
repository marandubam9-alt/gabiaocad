// Modo offline: substitui a nuvem do claude.ai por armazenamento no próprio celular (IndexedDB + Cache)
(()=>{
const DBN='fru-offline',ST='docs';
const idb=new Promise((ok,err)=>{const r=indexedDB.open(DBN,1);r.onupgradeneeded=()=>r.result.createObjectStore(ST);r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error)});
const tx=async(mode,fn)=>{const d=await idb;return new Promise((ok,err)=>{const t=d.transaction(ST,mode),s=t.objectStore(ST);const r=fn(s);t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>err(t.error)})};
const store={};let ready=(async()=>{const d=await idb;await new Promise(ok=>{const t=d.transaction(ST,'readonly'),s=t.objectStore(ST),c=s.openCursor();c.onsuccess=()=>{const cur=c.result;if(cur){store[cur.key]=cur.value;cur.continue()}else ok()}})})();
const put=(p,v)=>tx('readwrite',s=>s.put(v,p)),del=p=>tx('readwrite',s=>s.delete(p));
const subs=[];
const snapC=col=>{const docs=Object.keys(store).filter(p=>p.startsWith(col+'/')&&p.split('/').length===2).map(p=>({id:p.split('/')[1],exists:true,data:()=>store[p],metadata:{}}));return {docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false},docChanges:()=>[]}};
const fire=()=>subs.forEach(s=>{try{s.cb(s.doc?{exists:!!store[s.doc],data:()=>store[s.doc],metadata:{}}:snapC(s.col))}catch(e){}});
const mark=p=>{const d=store['__dirty/x']||{};d[p]=Date.now();store['__dirty/x']=d;put('__dirty/x',d)};
const write=async(p,v)=>{await ready;store[p]=v;mark(p);await put(p,v);setTimeout(fire)};
const docRef=p=>({id:p.split('/')[1],path:p,
  get:async()=>{await ready;return {exists:!!store[p],data:()=>store[p]}},
  set:async(d,o)=>write(p,o&&o.merge?{...(store[p]||{}),...d}:d),
  update:async d=>write(p,{...(store[p]||{}),...d}),
  delete:async()=>{await ready;delete store[p];mark(p);await del(p);setTimeout(fire)},
  onSnapshot:cb=>{subs.push({doc:p,cb});ready.then(()=>cb({exists:!!store[p],data:()=>store[p],metadata:{}}));return()=>{}}});
const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const coll=col=>{const q={path:col,doc:id=>docRef(col+'/'+(id||rid())),add:async d=>{const r=docRef(col+'/'+rid());await r.set(d);return r},
  onSnapshot:cb=>{subs.push({col,cb});ready.then(()=>cb(snapC(col)));return()=>{}}};q.orderBy=()=>q;q.limit=()=>q;q.where=()=>q;return q};
const db={doc:docRef,collection:coll};
// fotos: guardadas no Cache do aparelho, servidas pelo service worker em la/<id>
const assets={upload:async b=>{const id='off'+rid();if(window.DEMO||!(navigator.serviceWorker&&navigator.serviceWorker.controller)){const u=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b)});return {id,url:u}}const url=new URL('la/'+id,location.href).href;const c=await caches.open('fru-fotos');await c.put(url,new Response(b,{headers:{'Content-Type':b.type||'image/jpeg'}}));return {id,url:'la/'+id}}};
const REAL=window.claude;
const downloads={save:async({filename,data})=>{try{if(REAL&&REAL.use){const dl=await REAL.use('downloads');if(dl)return await dl.save({filename,data})}}catch(e){if(e&&e.code==='declined')throw e}const f=new File([data],filename,{type:data.type||'application/octet-stream'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:filename});return {status:'saved'}}catch(e){if(e&&e.name==='AbortError')throw {code:'declined'}}}
  const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),1000);return {status:'saved'}}};
const user={can:async()=>true,id:async()=>'offline',profiles:async ids=>Object.fromEntries((Array.isArray(ids)?ids:[ids]).map(i=>[i,{id:i,name:i==='offline'?'Celular (offline)':''}]))};
window.claude={use:async n=>({db,assets,downloads,user})[n]||null};
// --- pacote para levar ao sistema online ---
const b64=async blob=>new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(blob)});
window.OFFLINE={
  ready,store,
  async exportar(){await ready;const dirty=store['__dirty/x']||{},out={v:1,de:'offline',at:new Date().toISOString(),campo:{},extras:{},fotos:[],hist:[]};
    const c=await caches.open('fru-fotos');
    for(const p of Object.keys(dirty)){const [col,id]=p.split('/');const v=store[p];if(!v)continue;
      if(col==='diario'){const imgs=[];for(const f of (v.fotos||[])){const r=f.url&&f.url.startsWith('la/')?await c.match(new URL(f.url,location.href).href):null;imgs.push(r?await b64(await r.blob()):null)}(out.diario=out.diario||{})[id]={doc:v,imgs}}
      else if(col==='campo')out.campo[id]=v;else if(col==='extras')out.extras[id]=v;else if(col==='hist')out.hist.push(v);
      else if(col==='fotos'){const r=await c.match(new URL(v.url,location.href).href);out.fotos.push({id,doc:v,img:r?await b64(await r.blob()):null})}}
    return out},
  async importar(pk){await ready;let n=0;
    for(const [id,v] of Object.entries(pk.campo||{})){const p='campo/'+id,cur=store[p];if(!cur||!(cur.at>v.at)){store[p]=v;await put(p,v);n++}}
    for(const [id,v] of Object.entries(pk.extras||{})){const p='extras/'+id;if(!store[p]){store[p]=v;await put(p,v);n++}}
    setTimeout(fire);return n},
  async limparEnviados(){const d={};store['__dirty/x']=d;await put('__dirty/x',d)}
};
})();
