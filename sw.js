/* Clínica Boa Visão — service worker: abre a aplicação sem internet (os dados ficam no Firestore offline) */
const VERSAO = 'bv-v1';
const CDN = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
self.addEventListener('install', e=>{
  e.waitUntil((async()=>{
    const c = await caches.open(VERSAO);
    await Promise.all(['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'].map(u=>c.add(u).catch(()=>{})));
    await Promise.all(CDN.map(u=>fetch(u, {mode:'no-cors'}).then(r=>c.put(u, r)).catch(()=>{})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e=>{
  e.waitUntil((async()=>{ for(const k of await caches.keys()) if(k!==VERSAO) await caches.delete(k); await self.clients.claim(); })());
});
const API = /(firestore|identitytoolkit|securetoken|firebaseinstallations|www\.googleapis)\.googleapis\.com|firebaseio\.com|google-analytics/;
self.addEventListener('fetch', e=>{
  const req = e.request, url = new URL(req.url);
  if(req.method!=='GET' || API.test(url.hostname+url.pathname) || API.test(url.href)) return;
  if(req.mode==='navigate'){   // página: rede primeiro (para receber actualizações), cache se estiver offline
    e.respondWith((async()=>{
      const c = await caches.open(VERSAO);
      try{
        const r = await Promise.race([fetch(req), new Promise((_,ko)=>setTimeout(()=>ko(new Error('lento')), 4000))]);
        if(r && r.ok) c.put('index.html', r.clone());
        return r;
      }catch(err){ return (await c.match(req, {ignoreSearch:true})) || (await c.match('index.html')) || (await c.match('./')) || Response.error(); }
    })());
    return;
  }
  e.respondWith((async()=>{   // restantes ficheiros (bibliotecas, tipos de letra, ícones): cache primeiro
    const c = await caches.open(VERSAO), hit = await c.match(req);
    if(hit) return hit;
    try{ const r = await fetch(req); if(r && (r.ok || r.type==='opaque')) c.put(req, r.clone()); return r; }
    catch(err){ return hit || Response.error(); }
  })());
});
