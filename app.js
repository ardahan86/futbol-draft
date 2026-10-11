/* Futbol Draft — player data from the latest user spreadsheet. */
const firebaseConfig = {
  apiKey: "AIzaSyAT2TvXqXNzcAOHc9DFJYp7WA1e6M8cT2c",
  authDomain: "futbol-draft-f596c.firebaseapp.com",
  projectId: "futbol-draft-f596c",
  storageBucket: "futbol-draft-f596c.firebasestorage.app",
  messagingSenderId: "832029725377",
  appId: "1:832029725377:web:1be6412d7300df7f4f3a40"
};
const BUDGET = 1100;
const LIMITS = {GK:1,RB:1,CB:2,LB:1,DM:1,CM:1,CAM:1,RW:1,LW:1,ST:1};
const POSITIONS = {GK:'Kaleci',RB:'Sağ Bek',CB:'Stoper',LB:'Sol Bek',DM:'Ön Libero',CM:'Orta Saha',CAM:'10 Numara',RW:'Sağ Açık',LW:'Sol Açık',ST:'Santrfor'};
const LEGEND_CAPTAINS = new Set(['Javier Zanetti','Paolo Maldini','Carles Puyol','Steven Gerrard','Francesco Totti','Alessandro Del Piero']);
const GREAT_LEADERS = new Set(['Gianluigi Buffon','John Terry','Andrea Pirlo','Xavi','Frank Lampard','Zinedine Zidane']);
const $ = id => document.getElementById(id);
let db, auth, uid = null, playerPool = [], roomCode = localStorage.getItem('fd_room_code') || '', room = null, roomUnsub = null, busy = false, noticeTimer = null;

firebase.initializeApp(firebaseConfig); auth = firebase.auth(); db = firebase.firestore();

function notify(message, error=false) {
  const el=$('notice'); el.textContent=message; el.classList.remove('hidden','error'); if(error) el.classList.add('error');
  if(noticeTimer) clearTimeout(noticeTimer); noticeTimer=setTimeout(()=>el.classList.add('hidden'),6500);
}
function setBusy(value){busy=value; ['createRoom','joinRoom','startDraft'].forEach(id=>{if($(id)) $(id).disabled=value || (id==='startDraft' && !canStart());});}
function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===name));const titles={home:'Menajer Merkezi',room:'Oyun Odası',draft:'Draft Merkezi',squad:'Kadrom',league:'Lig Merkezi',rules:'Oyun Kuralları'};$('pageTitle').textContent=titles[name]||'Menajer Merkezi';if(name==='draft'||name==='squad') renderAll();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));

function currentMember(){return room?.members?.[uid]||null;}
function myPicks(){return (room?.picks||[]).filter(p=>p.uid===uid);}
function spent(squad=myPicks()){return squad.reduce((sum,p)=>sum+Number(p.fee||0),0);}
function pickedIds(){return new Set((room?.picks||[]).map(p=>p.id));}
function captainBonus(name){return LEGEND_CAPTAINS.has(name)?4:GREAT_LEADERS.has(name)?2:0;}
function countryBonus(squad){const counts={};squad.forEach(p=>{if(p.country)counts[p.country]=(counts[p.country]||0)+1;});return Object.values(counts).reduce((sum,n)=>sum+(n>=5?5:n===4?4:n===3?3:0),0);}
function linkScore(squad){const names=new Set(squad.map(p=>p.name));return squad.reduce((sum,p)=>sum+(p.link && names.has(p.link)?Number(p.linkBonus||0):0),0);}
function scoreParts(squad, captainId){const base=squad.reduce((s,p)=>s+Number(p.rating||0),0);const country=countryBonus(squad);const links=linkScore(squad);const cap=squad.find(p=>p.id===captainId);const captain=cap?captainBonus(cap.name):0;return {base,country,links,captain,total:base+country+links+captain};}
function slotKey(pos){return pos;}
function countsFor(squad){const counts={};Object.keys(LIMITS).forEach(k=>counts[k]=squad.filter(p=>p.position===k).length);return counts;}
function missingSlots(squad){const counts=countsFor(squad), slots=[];Object.keys(LIMITS).forEach(k=>{for(let i=counts[k];i<LIMITS[k];i++)slots.push(k);});return slots;}
function minimumReserve(squad, candidate=null){const chosen=[...squad];if(candidate)chosen.push(candidate);const missing=missingSlots(chosen);const unavailable=pickedIds();if(candidate) unavailable.add(candidate.id);const candidates=playerPool.filter(p=>!unavailable.has(p.id));let reserve=0;for(const pos of missing){const idx=candidates.map(p=>p.position).indexOf(pos);if(idx<0)return Infinity;const possible=candidates.filter(p=>p.position===pos).sort((a,b)=>a.fee-b.fee);if(!possible.length)return Infinity;const next=possible.shift();reserve+=next.fee;unavailable.add(next.id);candidates.splice(candidates.findIndex(p=>p.id===next.id),1);}return reserve;}
function canPick(player, silent=false){if(!room||room.status!=='drafting')return false;if(turnUid()!==uid)return false;const squad=myPicks();if(squad.length>=11)return false;if(pickedIds().has(player.id))return false;const counts=countsFor(squad);if((counts[player.position]||0)>=LIMITS[player.position])return false;const reserve=minimumReserve(squad,player);if(spent(squad)+player.fee+reserve>BUDGET){if(!silent)notify(`Bu seçim bütçeni aşar. Bu oyuncudan sonra kalan mevkileri doldurmak için en az ${reserve===Infinity?'mümkün olmayan':reserve+' M€'} gerekir.`,true);return false;}return true;}
function turnUid(){const base=room?.draftOrder?.length?room.draftOrder:room?.memberOrder;if(!room||!base?.length)return null;const idx=Number(room.currentPick||0), n=base.length, round=Math.floor(idx/n), inRound=idx%n;const order=round%2===0?base:[...base].reverse();return order[inRound]||null;}
function displayName(id){return room?.members?.[id]?.name||'Menajer';}
function isHost(){return !!room&&room.hostUid===uid;}
function canStart(){return !!room&&room.status==='lobby'&&isHost()&&room.memberOrder?.length>=2&&room.memberOrder.length<=6;}
function fmt(value){return Number(value).toLocaleString('tr-TR');}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function playerCopy(p){return {id:p.id,name:p.name,country:p.country,rating:p.rating,fee:p.fee,position:p.position,link:p.link||null,linkBonus:Number(p.linkBonus||0)};}

async function init(){
  // Eski index.html sürümünden kalmış ayrı Puan Tablosu sekmesini kaldır.
  document.querySelectorAll('[data-view="leaderboard"], #view-leaderboard').forEach(el=>el.remove());
  try{
    const response=await fetch('./players.json',{cache:'no-store'});if(!response.ok)throw new Error('players.json dosyası yüklenemedi.');
    const data=await response.json();playerPool=data.players||[];
    if(playerPool.length!==140)throw new Error(`Oyuncu listesinde 140 kişi bekleniyordu, ${playerPool.length} bulundu.`);
    const filter=$('positionFilter');Object.entries(POSITIONS).forEach(([key,label])=>{const o=document.createElement('option');o.value=key;o.textContent=label;filter.appendChild(o);});
    $('playerSearch').addEventListener('input',renderPlayers);$('positionFilter').addEventListener('change',renderPlayers);$('sortFilter').addEventListener('change',renderPlayers);
    $('createRoom').addEventListener('click',createRoom);$('joinRoom').addEventListener('click',joinRoom);$('startDraft').addEventListener('click',startDraft);$('copyCode').addEventListener('click',copyRoomCode);$('leaveRoom').addEventListener('click',leaveRoom);$('captainSelect').addEventListener('change',setCaptain);$('createFixtures').addEventListener('click',createLeagueFixtures);
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);const user=auth.currentUser|| (await auth.signInAnonymously()).user;uid=user.uid;
    $('connectionLabel').textContent='Firebase bağlantısı hazır';
    if(roomCode) await attachRoom(roomCode);else renderAll();
  }catch(err){console.error(err);$('connectionLabel').textContent='Bağlantı hatası';notify(err.message||'Başlatma sırasında hata oluştu.',true);}
}
async function createRoom(){if(busy)return;const name=$('createName').value.trim();if(!name){notify('Önce menajer adını yaz.',true);return;}if(!uid)return;setBusy(true);try{if(roomUnsub)roomUnsub();const code=await uniqueCode();const now=firebase.firestore.FieldValue.serverTimestamp();const initial={code,hostUid:uid,status:'lobby',members:{[uid]:{name,joinedAt:Date.now()}},memberOrder:[uid],picks:[],currentPick:0,captains:{},createdAt:now,updatedAt:now};await db.collection('rooms').doc(code).set(initial);roomCode=code;localStorage.setItem('fd_room_code',code);await attachRoom(code);notify('Oda oluşturuldu. Kodu arkadaşlarınla paylaş.');showView('room');}catch(err){console.error(err);notify(firebaseError(err),true);}finally{setBusy(false);}}
async function uniqueCode(){for(let i=0;i<8;i++){const code=String(Math.floor(100000+Math.random()*900000));const doc=await db.collection('rooms').doc(code).get();if(!doc.exists)return code;}throw new Error('Benzersiz oda kodu oluşturulamadı. Tekrar dene.');}
async function joinRoom(){if(busy)return;const name=$('joinName').value.trim(),code=$('joinCode').value.trim();if(!name){notify('Önce menajer adını yaz.',true);return;}if(!/^\d{6}$/.test(code)){notify('Oda kodu 6 haneli olmalı.',true);return;}setBusy(true);try{const ref=db.collection('rooms').doc(code);await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error('Bu kodla bir oda bulunamadı.');const r=snap.data();if(r.members?.[uid])return;if(r.status!=='lobby')throw new Error('Draft başlamış. Yeni oyuncu katılamaz.');if((r.memberOrder||[]).length>=6)throw new Error('Oda 6 oyuncuya ulaştı.');const members={...(r.members||{}),[uid]:{name,joinedAt:Date.now()}};const order=[...(r.memberOrder||[]),uid];tx.update(ref,{members,memberOrder:order,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});});roomCode=code;localStorage.setItem('fd_room_code',code);await attachRoom(code);notify('Odaya katıldın.');showView('room');}catch(err){console.error(err);notify(firebaseError(err),true);}finally{setBusy(false);}}
function firebaseError(err){if(err?.code==='permission-denied')return 'Firebase izin vermedi. Firestore Rules dosyasını konsolda yayımladığını kontrol et.';if(err?.code==='unavailable')return 'Firebase bağlantısı kurulamadı. İnternet bağlantını kontrol et.';return err?.message||'Beklenmeyen bir hata oluştu.';}
async function attachRoom(code){if(roomUnsub)roomUnsub();const ref=db.collection('rooms').doc(code);const snap=await ref.get();if(!snap.exists){roomCode='';localStorage.removeItem('fd_room_code');room=null;renderAll();notify('Kaydedilen oda bulunamadı. Yeni oda kurabilir veya başka odaya katılabilirsin.',true);return;}const r=snap.data();if(!r.members?.[uid]){roomCode='';localStorage.removeItem('fd_room_code');room=null;renderAll();notify('Bu oda senin menajer kimliğine bağlı değil. Oda koduyla katıl.',true);return;}roomUnsub=ref.onSnapshot(s=>{if(!s.exists){room=null;roomCode='';localStorage.removeItem('fd_room_code');renderAll();notify('Oda sahibi odayı kapattı veya oda silindi.');return;}room=s.data();renderAll();},err=>{console.error(err);notify(firebaseError(err),true);});}
async function startDraft(){if(!canStart()){notify('Draftı başlatmak için oda sahibi olmalı ve odada en az 2 oyuncu bulunmalı.',true);return;}try{const ref=db.collection('rooms').doc(roomCode);let drawnOrder=[];await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error('Oda bulunamadı.');const r=snap.data();if(r.hostUid!==uid||r.status!=='lobby')throw new Error('Draft başlatılamıyor; oda durumu değişmiş olabilir.');drawnOrder=[...(r.memberOrder||[])];for(let i=drawnOrder.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[drawnOrder[i],drawnOrder[j]]=[drawnOrder[j],drawnOrder[i]];}tx.update(ref,{status:'drafting',draftOrder:drawnOrder,currentPick:0,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});});notify(`Kura çekildi! İlk sıra: ${displayName(drawnOrder[0])}. Draft başladı.`);showView('draft');}catch(err){notify(firebaseError(err),true);}}
async function leaveRoom(){
  if(!room || busy) return;
  const host = isHost();
  if(!host && !['lobby','cancelled'].includes(room.status)){
    notify('Draft başladıktan sonra oyuncular ayrılamaz. Oda sahibi oyunu iptal ederse ayrılabilirsin.', true);
    return;
  }
  const question = host
    ? 'Oyunu iptal edip odayı kapatmak istiyor musun? Tüm oyuncuların bağlantısı kesilecek.'
    : 'Odadan ayrılmak istiyor musun?';
  if(!confirm(question)) return;

  busy = true;
  $('leaveRoom').disabled = true;
  try {
    const codeToClose = roomCode;
    const ref = db.collection('rooms').doc(codeToClose);
    if(host){
      // Oda sahibi draftın her aşamasında odayı silebilir.
      // Firestore Rules içinde hostUid == request.auth.uid delete izni gerekir.
      await ref.delete();
      if(roomUnsub){ roomUnsub(); roomUnsub = null; }
      room = null;
      roomCode = '';
      localStorage.removeItem('fd_room_code');
      renderAll();
      showView('home');
      notify('Oyun iptal edildi ve oda kapatıldı.');
    } else {
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if(!snap.exists) return;
        const data = snap.data();
        if(!['lobby','cancelled'].includes(data.status))
          throw new Error('Draft devam ederken odadan ayrılamazsın.');
        const members = { ...(data.members || {}) };
        delete members[uid];
        tx.update(ref, {
          members,
          memberOrder: (data.memberOrder || []).filter(id => id !== uid),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      if(roomUnsub){ roomUnsub(); roomUnsub = null; }
      room = null;
      roomCode = '';
      localStorage.removeItem('fd_room_code');
      renderAll();
      showView('home');
      notify('Odadan ayrıldın.');
    }
  } catch(err) {
    console.error('Oda kapatma/ayrılma hatası:', err);
    notify(firebaseError(err), true);
  } finally {
    busy = false;
    if($('leaveRoom')) $('leaveRoom').disabled = !room || (!isHost() && !['lobby','cancelled'].includes(room?.status));
  }
}
async function copyRoomCode(){if(!roomCode)return;try{await navigator.clipboard.writeText(roomCode);notify('Oda kodu kopyalandı.');}catch{const inp=document.createElement('input');inp.value=roomCode;document.body.appendChild(inp);inp.select();document.execCommand('copy');inp.remove();notify('Oda kodu kopyalandı.');}}
async function setCaptain(){if(!room||room.status!=='finished')return;if(Object.keys(room.league?.results||{}).length){notify('Lig maçları oynanmaya başladı; mevcut skorları korumak için kaptan artık değiştirilemez.',true);renderAll();return;}const playerId=$('captainSelect').value;if(playerId&&!myPicks().some(p=>p.id===playerId)){notify('Kaptan yalnızca kendi kadronuzdan seçilebilir.',true);renderAll();return;}if(playerId&&!captainBonus(myPicks().find(p=>p.id===playerId)?.name)){notify('Bu futbolcu kaptan bonusu alamıyor.',true);renderAll();return;}try{await db.collection('rooms').doc(roomCode).update({[`captains.${uid}`]:playerId||null,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}catch(err){notify(firebaseError(err),true);}}
async function pickPlayer(id){if(busy)return;const player=playerPool.find(p=>p.id===id);if(!player)return;if(!canPick(player)){if(room&&turnUid()!==uid)notify(`Şu an sıra ${displayName(turnUid())} adlı menajerde.`,true);else if(room?.status!=='drafting')notify('Draft henüz başlamadı.',true);else if(myPicks().length>=11)notify('Kadron 11 futbolcuya ulaştı.',true);else if((countsFor(myPicks())[player.position]||0)>=LIMITS[player.position])notify(`Kadronun ${POSITIONS[player.position]} kontenjanı dolu.`,true);return;}setBusy(true);try{const ref=db.collection('rooms').doc(roomCode);await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error('Oda bulunamadı.');const r=snap.data();if(r.status!=='drafting')throw new Error('Draft şu anda aktif değil.');const order=r.draftOrder?.length?r.draftOrder:(r.memberOrder||[]);const idx=Number(r.currentPick||0),round=Math.floor(idx/order.length),inRound=idx%order.length;const expected=(round%2===0?order:[...order].reverse())[inRound];if(expected!==uid)throw new Error('Sıra artık sende değil; ekran güncellendi.');const picks=r.picks||[];if(picks.some(p=>p.id===id))throw new Error('Bu futbolcu başka bir takımda seçildi.');const mine=picks.filter(p=>p.uid===uid);if(mine.length>=11)throw new Error('Kadron tamamlandı.');const current=playerCopy(player);if(mine.some(p=>p.position===current.position)&&mine.filter(p=>p.position===current.position).length>=LIMITS[current.position])throw new Error('Bu mevkide kontenjanın doldu.');const reserve=minimumReserveAgainst(picks,mine,current,playerPool);const spentNow=mine.reduce((s,p)=>s+p.fee,0);if(spentNow+current.fee+reserve>BUDGET)throw new Error(`Bütçe yetmiyor. Bu seçimden sonra kalan mevkileri doldurmak için en az ${reserve} M€ gerekir.`);const nextPicks=[...picks,{...current,uid,turn:idx+1}];const next=idx+1;const finished=next>=order.length*11;tx.update(ref,{picks:nextPicks,currentPick:next,status:finished?'finished':'drafting',updatedAt:firebase.firestore.FieldValue.serverTimestamp()});});notify(`${player.name} kadrona eklendi.`);if(room?.status==='finished')showView('squad');}catch(err){notify(firebaseError(err),true);}finally{setBusy(false);}}
function minimumReserveAgainst(allPicks,mine,candidate,pool){const squad=[...mine,candidate];const counts=countsFor(squad), slots=[];Object.keys(LIMITS).forEach(k=>{for(let i=counts[k];i<LIMITS[k];i++)slots.push(k);});const unavailable=new Set(allPicks.map(p=>p.id));unavailable.add(candidate.id);let reserve=0;for(const pos of slots){const options=pool.filter(p=>p.position===pos&&!unavailable.has(p.id)).sort((a,b)=>a.fee-b.fee);if(!options.length)return Infinity;reserve+=options[0].fee;unavailable.add(options[0].id);}return reserve;}

function renderRoom(){const active=!!room;$('roomCodeLarge').textContent=active?roomCode:'------';$('homeRoomCode').textContent=active?roomCode:'Henüz yok';$('homeRoomStatus').textContent=active?statusLabel(room.status):'Bekleniyor';$('roomStatePill').textContent=active?statusLabel(room.status):'Oda bekleniyor';$('managerName').textContent=currentMember()?.name||'Menajer';$('managerStatus').textContent=active?(isHost()?'Oda sahibi':'Oda oyuncusu'):'Odaya bağlı değil';$('homePlayerCount').textContent=active?`${room.memberOrder?.length||0} / 6`:'—';$('copyCode').disabled=!active;$('leaveRoom').disabled=!active||(!isHost()&&!['lobby','cancelled'].includes(room?.status));$('leaveRoom').textContent=active&&isHost()?'Oyunu İptal Et / Odayı Kapat':'Odadan Ayrıl';$('leaveRoom').classList.toggle('danger',active&&isHost());$('startDraft').disabled=!canStart()||busy;$('startDraft').classList.toggle('hidden',!isHost()||room?.status!=='lobby');$('hostHint').textContent=!active?'Draftı başlatmak için oda oluştur.':room.status==='cancelled'?'Oyun oda sahibi tarafından iptal edildi.':room.status==='lobby'?(isHost()?'En az 2 oyuncu olunca draftı başlatabilirsin.':'Oda sahibinin draftı başlatması bekleniyor.'):room.status==='finished'?'Draft tamamlandı. Kadroları inceleyebilirsiniz.':'Draft devam ediyor.';
 const list=$('membersList');if(!active){list.innerHTML='<div class="empty-state">Henüz bir odaya bağlı değilsin.</div>';return;}const displayOrder=room.draftOrder?.length?room.draftOrder:room.memberOrder||[];list.innerHTML=displayOrder.map((id,i)=>`<div class="member"><div class="member-avatar">${esc((room.members[id]?.name||'M').slice(0,1).toUpperCase())}</div><div class="member-info"><b>${esc(room.members[id]?.name||'Menajer')}</b><small>${room.draftOrder?.length?`Kura sırası: ${i+1}`:(id===uid?'Sen':`Oyuncu ${i+1}`)}</small></div>${id===room.hostUid?'<span class="host-badge">ODA SAHİBİ</span>':''}</div>`).join('');}
function statusLabel(s){return s==='lobby'?'Oyuncular bekleniyor':s==='drafting'?'Draft devam ediyor':s==='finished'?'Draft tamamlandı':s==='cancelled'?'Oyun iptal edildi':'Bilinmiyor';}
function renderPlayers(){const grid=$('playerGrid');if(!grid)return;const q=$('playerSearch').value.trim().toLocaleLowerCase('tr-TR'),pos=$('positionFilter').value,sort=$('sortFilter').value;const picked=pickedIds();let list=playerPool.filter(p=>(!q||p.name.toLocaleLowerCase('tr-TR').includes(q)||p.country.toLocaleLowerCase('tr-TR').includes(q))&&(!pos||p.position===pos));list.sort((a,b)=>sort==='fee'?a.fee-b.fee:sort==='name'?a.name.localeCompare(b.name,'tr'):b.rating-a.rating);$('poolCount').textContent=`${list.length} futbolcu`;const turn=turnUid();$('pickMeta').textContent=room?.status==='drafting'?`Sıra: ${displayName(turn)}`:room?.status==='finished'?'Draft tamamlandı':'Draft başlamadı';if(!list.length){grid.innerHTML='<div class="empty-state">Aramana uygun futbolcu bulunamadı.</div>';return;}grid.innerHTML=list.map(p=>{const used=picked.has(p.id),mine=myPicks();const full=(countsFor(mine)[p.position]||0)>=LIMITS[p.position];const isMyTurn=room?.status==='drafting'&&turn===uid;const valid=isMyTurn&&!used&&!full&&mine.length<11;let btnText=used?'Seçildi':full?'Mevki dolu':!room||room.status!=='drafting'?'Bekleniyor':!isMyTurn?'Sıra rakipte':'Seç';return `<article class="player-card"><div class="rating">${p.rating}</div><div class="player-info"><b title="${esc(p.name)}">${esc(p.name)}</b><small>${esc(p.country)}${p.link?` · Bağ: ${esc(p.link)}`:''}</small></div><div class="player-card-foot"><span class="fee">${fmt(p.fee)} <small>M€</small></span><span class="position-tag">${POSITIONS[p.position]}</span><button class="pick-btn" data-pick="${p.id}" ${valid?'':'disabled'}>${btnText}</button></div></article>`;}).join('');grid.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>pickPlayer(b.dataset.pick)));}
function renderDraftSide(){const squad=myPicks(),spend=spent(squad),captainId=room?.captains?.[uid],parts=scoreParts(squad,captainId);$('draftBudget').innerHTML=`${fmt(BUDGET-spend)} <i>M€</i>`;$('budgetBar').style.width=`${Math.max(0,(BUDGET-spend)/BUDGET*100)}%`;$('spentLabel').textContent=`${fmt(spend)} M€ harcandı`;$('draftSquadCount').textContent=`${squad.length} / 11`;$('squadBar').style.width=`${squad.length/11*100}%`;$('draftScore').textContent=fmt(parts.total);$('draftScoreDetail').textContent=`Temel ${parts.base} · Bonus +${parts.total-parts.base}`;$('positionProgress').innerHTML=Object.entries(LIMITS).map(([key,max])=>{const n=squad.filter(p=>p.position===key).length;return `<div class="pos-progress-row"><span>${POSITIONS[key]}</span><b>${n}/${max}</b></div>`;}).join('');$('turnChip').textContent=room?.status==='finished'?'Draft tamamlandı':room?.status==='drafting'?(turnUid()===uid?'Sıra sende':`Sıra: ${displayName(turnUid())}`):'Odaya katıl';}
function renderSquad(){const squad=myPicks(),captainId=room?.captains?.[uid],parts=scoreParts(squad,captainId);$('squadTotalScore').textContent=fmt(parts.total);const rows=$('squadRows');if(!squad.length)rows.innerHTML='<div class="empty-state">Henüz futbolcu seçmedin. Draft başlayınca futbolcu seçtikçe kadron burada görünecek.</div>';else{const sorted=[...squad].sort((a,b)=>Object.keys(LIMITS).indexOf(a.position)-Object.keys(LIMITS).indexOf(b.position));rows.innerHTML=sorted.map(p=>`<div class="squad-row"><span><b>${esc(p.name)}</b><br><small>${POSITIONS[p.position]} · ${esc(p.country)} · Güç ${p.rating}${p.link&&squad.some(x=>x.name===p.link)?` · Bağ +${p.linkBonus}`:''}${p.id===captainId?' · KAPTAN':''}</small></span><span class="subfee">${fmt(p.fee)} M€</span></div>`).join('');}
 $('scoreBreakdown').innerHTML=[['Temel güç',parts.base],['Ülke bonusu',`+${parts.country}`],['Özel bağlantı',`+${parts.links}`],['Kaptan bonusu',`+${parts.captain}`]].map(([label,val])=>`<div class="breakdown-row"><span>${label}</span><b>${val}</b></div>`).join('')+`<div class="breakdown-row total"><span>Toplam güç</span><b>${fmt(parts.total)}</b></div><div class="breakdown-row"><span>Bonservis toplamı</span><b>${fmt(spent(squad))} M€</b></div><div class="breakdown-row"><span>Kalan bütçe</span><b>${fmt(BUDGET-spent(squad))} M€</b></div>`;
 const sel=$('captainSelect');const eligible=squad.filter(p=>captainBonus(p.name)>0);const leagueStarted=Object.keys(room?.league?.results||{}).length>0;sel.innerHTML='<option value="">Kaptan seç</option>'+eligible.map(p=>`<option value="${p.id}">${esc(p.name)} (+${captainBonus(p.name)})</option>`).join('');sel.value=captainId||'';sel.disabled=squad.length!==11||room?.status!=='finished'||eligible.length===0||leagueStarted;$('captainInfo').textContent=squad.length<11?'Kaptan seçmek için 11 kişilik kadronu tamamla.':room?.status!=='finished'?'Kaptan draft tamamlandıktan sonra seçilir.':leagueStarted?'Lig maçları başladığı için kaptan değiştirilemez.':eligible.length===0?'Kadronuzda kaptan bonusu alabilecek futbolcu yok; kaptan bonusu uygulanmayacak.':'Efsane kaptan +4 • Büyük lider +2. Fikstürden önce kaptanını seç.';renderOpponentSquads();}
function renderOpponentSquads(){const host=$('opponentSquads');if(!host)return;if(!room){host.innerHTML='<div class="empty-state">Rakip kadrolarını görmek için bir oyun odasına katıl.</div>';return;}const order=room.memberOrder||[];const picks=room.picks||[];const opponents=order.filter(id=>id!==uid).map(id=>{const squad=picks.filter(p=>p.uid===id);const captainId=room.captains?.[id];const parts=scoreParts(squad,captainId);const sorted=[...squad].sort((a,b)=>Object.keys(LIMITS).indexOf(a.position)-Object.keys(LIMITS).indexOf(b.position));return {id,name:room.members?.[id]?.name||'Menajer',squad,sorted,captainId,parts,spend:spent(squad)};});if(!opponents.length){host.innerHTML='<div class="empty-state">Henüz rakip yok. Başka menajerler odaya katıldığında kadroları burada görünecek.</div>';return;}host.innerHTML=opponents.map(t=>`<details class="team-details"><summary><span class="team-summary-rank">⚽</span><span class="team-summary-name"><b>${esc(t.name)}</b><small>${t.squad.length}/11 futbolcu · Güç ${fmt(t.parts.total)} · ${fmt(t.spend)} M€</small></span><span class="team-summary-action">Kadroyu gör⌄</span></summary><div class="team-roster">${t.sorted.length?t.sorted.map(p=>`<div class="team-player-row"><span><b>${esc(p.name)}</b><small>${POSITIONS[p.position]} · ${esc(p.country)} · Güç ${p.rating}${p.id===t.captainId?' · KAPTAN':''}${p.link&&t.squad.some(x=>x.name===p.link)?` · Bağ +${p.linkBonus}`:''}</small></span><span>${fmt(p.fee)} M€</span></div>`).join(''):'<div class="empty-state">Bu menajer henüz futbolcu seçmedi.</div>'}<div class="team-roster-footer"><span>Temel güç <b>${fmt(t.parts.base)}</b></span><span>Bonus <b>+${fmt(t.parts.total-t.parts.base)}</b></span><span>Kadro değeri <b>${fmt(t.spend)} M€</b></span></div></div></details>`).join('');}
function renderLeaderboard(){
 const table=$('leaderboardTable'), status=$('leaderboardStatus'), hint=$('leaderboardHint');
 if(!table)return;
 if(!room){status.textContent='Oda bekleniyor';table.innerHTML='<div class="empty-state">Puan tablosunu görmek için bir odaya katıl veya oda oluştur.</div>';hint.textContent='Aynı odadaki tüm menajerlerin puanları burada gösterilecek.';return;}
 const order=room.memberOrder||[], picks=room.picks||[];
 const rows=order.map(id=>{const squad=picks.filter(p=>p.uid===id);const captainId=room.captains?.[id];const parts=scoreParts(squad,captainId);const legendCount=squad.filter(p=>LEGEND_CAPTAINS.has(p.name)).length;const leaderCount=squad.filter(p=>GREAT_LEADERS.has(p.name)).length;return {id,name:room.members?.[id]?.name||'Menajer',squad,parts,spend:spent(squad),captainId,legendCount,leaderCount};}).sort((a,b)=>b.parts.total-a.parts.total||b.spend-a.spend||b.legendCount-a.legendCount||b.leaderCount-a.leaderCount||b.parts.base-a.parts.base);
 const complete=room.status==='finished'&&rows.every(r=>r.squad.length===11);
 const captainsDone=complete&&rows.every(r=>r.captainId&&r.squad.some(p=>p.id===r.captainId)&&captainBonus(r.squad.find(p=>p.id===r.captainId)?.name)>0);
 status.textContent=room.status==='cancelled'?'Oyun iptal edildi':complete?'Draft tamamlandı':room.status==='drafting'?'Draft devam ediyor':'Oyuncular bekleniyor';
 const squadRows=rows.map((r,i)=>{const sorted=[...r.squad].sort((a,b)=>Object.keys(LIMITS).indexOf(a.position)-Object.keys(LIMITS).indexOf(b.position));return `<details class="team-details" ${r.id===uid?'open':''}><summary><span class="team-summary-rank">${i===0?'🏆':i+1}</span><span class="team-summary-name"><b>${esc(r.name)}${r.id===uid?' (Sen)':''}</b><small>${r.squad.length}/11 futbolcu · ${fmt(r.parts.total)} puan · ${fmt(r.spend)} M€</small></span><span class="team-summary-action">Kadroyu gör⌄</span></summary><div class="team-roster">${sorted.length?sorted.map(p=>`<div class="team-player-row"><span><b>${esc(p.name)}</b><small>${POSITIONS[p.position]} · ${esc(p.country)} · Güç ${p.rating}${p.id===r.captainId?' · KAPTAN':''}${p.link&&r.squad.some(x=>x.name===p.link)?` · Bağ +${p.linkBonus}`:''}</small></span><span>${fmt(p.fee)} M€</span></div>`).join(''):'<div class="empty-state">Bu menajer henüz futbolcu seçmedi.</div>'}<div class="team-roster-footer"><span>Temel puan <b>${fmt(r.parts.base)}</b></span><span>Bonus <b>+${fmt(r.parts.total-r.parts.base)}</b></span><span>Kadro değeri <b>${fmt(r.spend)} M€</b></span><span>Efsane Kaptan <b>${r.legendCount}</b></span><span>Büyük Lider <b>${r.leaderCount}</b></span></div></div></details>`;}).join('');
 table.innerHTML=`<div class="leaderboard-table"><div class="leaderboard-row leaderboard-head"><span>Sıra</span><span>Menajer / Kadro</span><span>Güç</span><span>Bonus</span><span>Kalan</span></div>${rows.map((r,i)=>`<div class="leaderboard-row ${complete&&i===0?'leaderboard-winner':''}"><span class="rank">${i===0?'🏆':i+1}</span><span class="leader-name"><b>${esc(r.name)}${r.id===uid?' (Sen)':''}</b><small>${r.squad.length}/11 futbolcu${r.captainId?' · Kaptan seçildi':''}</small></span><b class="leader-score">${fmt(r.parts.total)}</b><span class="leader-bonus">+${fmt(r.parts.total-r.parts.base)}</span><span class="leader-budget">${fmt(BUDGET-r.spend)} M€</span></div>`).join('')}</div><div class="team-rosters-heading"><h3>👥 Tüm Menajerlerin Kadroları</h3><p>Bir takıma dokunarak 11 kişilik kadrosunu, futbolcularını ve puan dökümünü görebilirsin.</p></div><div class="team-rosters">${squadRows}</div>${room.status==='cancelled'?`<div class="winner-banner"><span class="trophy">⛔</span><div><small>OYUN İPTAL EDİLDİ</small><b>Draft durduruldu</b><span>Oda sahibi oyunu iptal etti.</span></div></div>`:''}${complete?`<div class="winner-banner"><span class="trophy">🏆</span><div><small>${captainsDone?'ŞAMPİYON':'GEÇİCİ LİDER'}</small><b>${esc(rows[0]?.name||'—')}</b><span>${fmt(rows[0]?.parts.total||0)} toplam güç puanı</span></div></div>`:''}`;
 hint.textContent=room.status==='cancelled'?'Oda sahibi oyunu iptal etti. Draft durduruldu.':!complete?'Sıralama canlı güncellenir. Şampiyon, tüm kadrolar tamamlandığında belirlenir. Eşitlik sırası: toplam puan → kadro değeri → Efsane Kaptan sayısı → Büyük Lider sayısı → bonuslar hariç temel puan.':!captainsDone?'Tüm kadrolar tamamlandı. Nihai sıralama için kaptan seçimleri de yapılmalı; sonuçlar anlık güncellenir.':'Tüm kadrolar ve kaptan seçimleri tamamlandı. Eşitlik ölçütleri uygulanarak şampiyon belirlendi.';
}

function leagueTeams(){
  if(!room)return [];
  return (room.memberOrder||[]).map(id=>{
    const squad=(room.picks||[]).filter(p=>p.uid===id);
    const captainId=room.captains?.[id]||null;
    const parts=scoreParts(squad,captainId);
    return {id,name:room.members?.[id]?.name||'Menajer',squad,captainId,power:parts.total};
  });
}
function validLeagueTeams(){
  const teams=leagueTeams();
  if(!room||room.status!=='finished')return {ok:false,message:'Lig için önce draftın tamamlanması gerekiyor.'};
  if(teams.length<2)return {ok:false,message:'Lig kurmak için en az 2 menajer gerekli.'};
  const incomplete=teams.filter(t=>t.squad.length!==11);
  if(incomplete.length)return {ok:false,message:`Şu takımların kadrosu 11 kişi değil: ${incomplete.map(t=>t.name).join(', ')}.`};
  const missingCaptains=teams.filter(t=>{const eligible=t.squad.filter(p=>captainBonus(p.name)>0);return eligible.length>0&&(!t.captainId||!t.squad.some(p=>p.id===t.captainId&&captainBonus(p.name)>0));});
  if(missingCaptains.length)return {ok:false,message:`Ligden önce şu menajerler kaptan seçmeli: ${missingCaptains.map(t=>t.name).join(', ')}.`};
  return {ok:true,teams};
}
function buildDoubleRoundRobin(teamIds){
  const base=[...teamIds];
  if(base.length%2===1)base.push(null);
  const n=base.length, rounds=[];
  let rotating=[...base];
  for(let r=0;r<n-1;r++){
    const matches=[];
    for(let i=0;i<n/2;i++){
      const a=rotating[i],b=rotating[n-1-i];
      if(a&&b){
        const home=(r+i)%2===0?a:b;
        const away=home===a?b:a;
        matches.push({homeUid:home,awayUid:away,round:r+1});
      }
    }
    rounds.push(matches);
    rotating=[rotating[0],rotating[n-1],...rotating.slice(1,n-1)];
  }
  const all=[...rounds.flat()];
  const second=all.map((m,i)=>({homeUid:m.awayUid,awayUid:m.homeUid,round:rounds.length+Math.floor(i/(Math.max(1,teamIds.length/2)))+1}));
  // Group second leg by original round to retain a readable schedule.
  const leg2=[];
  rounds.forEach((matches,idx)=>leg2.push(matches.map(m=>({homeUid:m.awayUid,awayUid:m.homeUid,round:rounds.length+idx+1}))));
  return [...rounds.flat(),...leg2.flat()].map((m,i)=>({...m,id:`m${i+1}`,played:false}));
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function poissonGoals(expected){
  // Poisson örneklemesi: gol olasılığı, takımın ürettiği beklenen gol (xG) ile ilişkilidir.
  const lambda=clamp(expected,0.12,3.8), limit=Math.exp(-lambda);
  let product=1,k=0;
  do{k++;product*=Math.random();}while(product>limit&&k<12);
  return Math.min(7,k-1);
}
function averageRating(squad,positions){
  const players=squad.filter(p=>positions.includes(p.position));
  if(!players.length)return squad.reduce((sum,p)=>sum+Number(p.rating||0),0)/Math.max(1,squad.length);
  return players.reduce((sum,p)=>sum+Number(p.rating||0),0)/players.length;
}
function sumRatings(squad, positions){
  return (squad||[]).filter(p=>positions.includes(p.position)).reduce((sum,p)=>sum+Number(p.rating||0),0);
}
function averageRating(squad,positions){
  const players=(squad||[]).filter(p=>positions.includes(p.position));
  if(!players.length)return 50;
  return players.reduce((sum,p)=>sum+Number(p.rating||0),0)/players.length;
}
function teamProfile(team){
  const squad=team.squad||[];
  const parts=scoreParts(squad,team.captainId);
  // Dört temel: toplam güç -> topa sahip olma; savunma -> savunma aksiyonları;
  // CM/CAM/RW/LW + ülke bonusu -> xG; CAM/RW/LW/ST -> şut isabeti/hücum.
  const possessionPower=parts.total;
  const defenseRaw=sumRatings(squad,['GK','RB','LB','CB','DM'])+parts.captain;
  const defenseAvg=defenseRaw/6;
  const xgRaw=sumRatings(squad,['CM','CAM','RW','LW'])+parts.country;
  const xgAvg=xgRaw/4;
  const attackRaw=sumRatings(squad,['CAM','RW','LW','ST']);
  const attackAvg=attackRaw/4;
  const goalkeeper=averageRating(squad,['GK']);
  const midfield=averageRating(squad,['CM','CAM','RW','LW']);
  return {parts,power:parts.total,possessionPower,defenseRaw,defenseAvg,xgRaw,xgAvg,attackRaw,attackAvg,goalkeeper,midfield};
}
function simulateScore(home,away){
  const h=teamProfile(home),a=teamProfile(away);
  // xG, hücum üretim profili ile rakip savunmasının karşılaştırılmasından doğar.
  const homeExpected=clamp(1.28+(h.xgAvg-a.defenseAvg)*0.035+(h.attackAvg-a.defenseAvg)*0.018+(h.midfield-a.midfield)*0.012+0.16,0.18,3.65);
  const awayExpected=clamp(1.28+(a.xgAvg-h.defenseAvg)*0.035+(a.attackAvg-h.defenseAvg)*0.018+(a.midfield-h.midfield)*0.012,0.15,3.45);
  return {homeGoals:poissonGoals(homeExpected),awayGoals:poissonGoals(awayExpected),homeXg:Number(homeExpected.toFixed(2)),awayXg:Number(awayExpected.toFixed(2))};
}
async function createLeagueFixtures(){
  const valid=validLeagueTeams();
  if(!valid.ok){notify(valid.message,true);return;}
  const ref=db.collection('rooms').doc(roomCode);
  try{
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);if(!snap.exists)throw new Error('Oda bulunamadı.');
      const data=snap.data();
      if(data.league?.fixtures?.length)return;
      if(data.status!=='finished')throw new Error('Draft tamamlanmadan lig kurulamaz.');
      const teams=(data.memberOrder||[]).map(id=>({id,name:data.members?.[id]?.name||'Menajer',squad:(data.picks||[]).filter(p=>p.uid===id),captainId:data.captains?.[id]||null}));
      if(teams.length<2||teams.some(t=>t.squad.length!==11))throw new Error('Her menajerin 11 kişilik kadrosu olmalı.');
      const missing=teams.filter(t=>{const eligible=t.squad.filter(p=>captainBonus(p.name)>0);return eligible.length>0&&(!t.captainId||!t.squad.some(p=>p.id===t.captainId&&captainBonus(p.name)>0));});
      if(missing.length)throw new Error(`Önce kaptan seçmeli: ${missing.map(t=>t.name).join(', ')}.`);
      const fixtures=buildDoubleRoundRobin(teams.map(t=>t.id));
      tx.update(ref,{league:{fixtures,results:{},createdAt:Date.now()},updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    });
    notify('Çift devreli lig fikstürü oluşturuldu.');
  }catch(err){notify(firebaseError(err),true);}
}
function weightedPick(players,weightFn){
  if(!players.length)return null;
  const weights=players.map(p=>Math.max(0.1,weightFn(p))),total=weights.reduce((a,b)=>a+b,0);
  let roll=Math.random()*total;
  for(let i=0;i<players.length;i++){roll-=weights[i];if(roll<=0)return players[i];}
  return players[players.length-1];
}
function chooseScorer(team){
  const squad=team.squad||[];
  return weightedPick(squad,p=>{
    const role={ST:4.8,RW:3.0,LW:3.0,CAM:2.8,CM:1.45,DM:.55,RB:.45,LB:.45,CB:.30,GK:.03}[p.position]||1;
    return role*Math.max(.25,Number(p.rating||50)/75);
  });
}
function chooseAssist(team,scorer){
  const squad=(team.squad||[]).filter(p=>p.id!==scorer?.id&&p.position!=='GK');
  return weightedPick(squad,p=>{
    const role={CAM:3.4,RW:3.0,LW:3.0,CM:2.6,ST:1.25,DM:1.0,RB:.85,LB:.85,CB:.25}[p.position]||1;
    return role*Math.max(.25,Number(p.rating||50)/75);
  });
}
function makeMatchReport(home,away,score){
  const events=[];
  for(let i=0;i<score.homeGoals;i++){
    const p=chooseScorer(home),assist=Math.random()<.78?chooseAssist(home,p):null;
    events.push({minute:1+Math.floor(Math.random()*90),teamUid:home.id,teamName:home.name,playerId:p?.id||null,playerName:p?.name||'Gol',assistId:assist?.id||null,assistName:assist?.name||null,type:'goal'});
  }
  for(let i=0;i<score.awayGoals;i++){
    const p=chooseScorer(away),assist=Math.random()<.78?chooseAssist(away,p):null;
    events.push({minute:1+Math.floor(Math.random()*90),teamUid:away.id,teamName:away.name,playerId:p?.id||null,playerName:p?.name||'Gol',assistId:assist?.id||null,assistName:assist?.name||null,type:'goal'});
  }
  // Kartlar maçın gidişatına bağlı küçük olasılıklarla üretilir.
  for(const team of [home,away]){
    const yellows=Math.random()<.16?0:Math.floor(Math.random()*3)+1;
    for(let i=0;i<yellows;i++){
      const candidates=team.squad.filter(p=>p.position!=='GK');
      const player=weightedPick(candidates,p=>({CB:1.8,DM:1.8,RB:1.4,LB:1.4,CM:1.2,ST:.65,RW:.6,LW:.6,CAM:.7}[p.position]||1));
      events.push({minute:1+Math.floor(Math.random()*90),teamUid:team.id,teamName:team.name,playerId:player?.id||null,playerName:player?.name||'Oyuncu',type:'yellow'});
    }
    if(Math.random()<.055){
      const candidates=team.squad.filter(p=>p.position!=='GK');
      const player=weightedPick(candidates,p=>['CB','DM','RB','LB'].includes(p.position)?1.7:1);
      events.push({minute:1+Math.floor(Math.random()*90),teamUid:team.id,teamName:team.name,playerId:player?.id||null,playerName:player?.name||'Oyuncu',type:'red'});
    }
  }
  events.sort((a,b)=>a.minute-b.minute);
  const hp=teamProfile(home),ap=teamProfile(away);
  // Temel 1: toplam takım gücü topa sahip olmayı belirgin biçimde etkiler.
  const possessionDelta=clamp((hp.possessionPower-ap.possessionPower)*0.035,-13,13);
  const homePoss=clamp(Math.round(50+possessionDelta+(Math.random()*8-4)),30,70);
  const awayPoss=100-homePoss;
  const hXg=score.homeXg??1.2,aXg=score.awayXg??1.1;
  // Temel 4: CAM/RW/LW/ST toplamı şut isabetini ve hücum verimini belirler.
  const homeShots=Math.max(score.homeGoals,Math.round(hXg*2.8+3+Math.random()*4));
  const awayShots=Math.max(score.awayGoals,Math.round(aXg*2.8+3+Math.random()*4));
  const homeAccuracy=clamp(0.27+(hp.attackAvg-50)*0.006,0.18,0.66);
  const awayAccuracy=clamp(0.27+(ap.attackAvg-50)*0.006,0.18,0.66);
  const homeOnTarget=Math.min(homeShots,Math.max(score.homeGoals,Math.round(homeShots*homeAccuracy+Math.random()*2)));
  const awayOnTarget=Math.min(awayShots,Math.max(score.awayGoals,Math.round(awayShots*awayAccuracy+Math.random()*2)));
  // Temel 2: savunma toplamı + kaptan bonusu; her aksiyonun girişim ve başarı sayısı ayrı tutulur.
  function defenseActions(defendingTeam, attackingShots, attackingOnTarget){
    const dp=teamProfile(defendingTeam);
    const strength=clamp((dp.defenseAvg-45)*0.012,-0.35,0.35);
    const blockAttempts=Math.max(1,Math.round(attackingShots*(0.48+Math.random()*0.20)));
    const blockSuccess=clamp(0.34+strength,0.12,0.72);
    const blocks=Math.min(attackingShots,Math.round(blockAttempts*blockSuccess));
    const tackleAttempts=clamp(Math.round(8+Math.random()*8+(100-dp.possessionPower%100)*0.02),5,20);
    const tackleRate=clamp(0.48+strength,0.20,0.82);
    const tackles=Math.round(tackleAttempts*tackleRate);
    const interceptAttempts=clamp(Math.round(5+Math.random()*7),3,15);
    const interceptRate=clamp(0.42+strength*0.75,0.18,0.78);
    const interceptions=Math.round(interceptAttempts*interceptRate);
    const attackStops=Math.round((tackles+interceptions)*clamp(0.35+strength*0.5,0.18,0.65));
    const qualityReduced=Math.max(0,Math.round((attackingShots-blocks)*clamp(0.18+strength*0.5,0.05,0.42)));
    return {blockAttempts,blocks,tackleAttempts,tackles,interceptAttempts,interceptions,attackStops,qualityReduced};
  }
  const homeDefense=defenseActions(home,awayShots,awayOnTarget);
  const awayDefense=defenseActions(away,homeShots,homeOnTarget);
  const h=hp.parts,a=ap.parts;
  const goalEvents=events.filter(e=>e.type==='goal');
  const scorers={};goalEvents.forEach(e=>{const key=`${e.teamUid}:${e.playerId||e.playerName}`;scorers[key]??={teamName:e.teamName,playerName:e.playerName,goals:0};scorers[key].goals++;});
  const summary=score.homeGoals===score.awayGoals?`${home.name} ve ${away.name} sahadan ${score.homeGoals}-${score.awayGoals} beraberlikle ayrıldı.`:score.homeGoals>score.awayGoals?`${home.name}, ${away.name} karşısında ${score.homeGoals}-${score.awayGoals} kazanarak 3 puanı aldı.`:`${away.name}, deplasmanda ${home.name} takımını ${score.awayGoals}-${score.homeGoals} yenerek 3 puanı aldı.`;
  return {events,scorers:Object.values(scorers),stats:{homePossession:homePoss,awayPossession:awayPoss,homeShots,awayShots,homeShotsOnTarget:homeOnTarget,awayShotsOnTarget:awayOnTarget,homeCorners:clamp(Math.round(homeShots*.42+Math.random()*3),0,14),awayCorners:clamp(Math.round(awayShots*.42+Math.random()*3),0,14),homeSaves:Math.max(0,awayOnTarget-score.awayGoals),awaySaves:Math.max(0,homeOnTarget-score.homeGoals),homeXg:hXg,awayXg:aXg,homeYellow:events.filter(e=>e.teamUid===home.id&&e.type==='yellow').length,awayYellow:events.filter(e=>e.teamUid===away.id&&e.type==='yellow').length,homeRed:events.filter(e=>e.teamUid===home.id&&e.type==='red').length,awayRed:events.filter(e=>e.teamUid===away.id&&e.type==='red').length,homePower:hp.power,awayPower:ap.power,homeAttack:Number(hp.attack.toFixed(1)),awayAttack:Number(ap.attack.toFixed(1)),homeMidfield:Number(hp.midfield.toFixed(1)),awayMidfield:Number(ap.midfield.toFixed(1)),homeDefense:Number(hp.defense.toFixed(1)),awayDefense:Number(ap.defense.toFixed(1)),homeGoalkeeper:Number(hp.goalkeeper.toFixed(1)),awayGoalkeeper:Number(ap.goalkeeper.toFixed(1)),homeBase:h.base,awayBase:a.base,homeCountry:h.country,awayCountry:a.country,homeLinks:h.links,awayLinks:a.links,homeCaptain:h.captain,awayCaptain:a.captain,
  homeAttackTotal:hp.attackRaw,awayAttackTotal:ap.attackRaw,homeXgTotal:hp.xgRaw,awayXgTotal:ap.xgRaw,homeDefenseTotal:hp.defenseRaw,awayDefenseTotal:ap.defenseRaw,
  homeBlockAttempts:awayDefense.blockAttempts,awayBlockAttempts:homeDefense.blockAttempts,homeBlocks:awayDefense.blocks,awayBlocks:homeDefense.blocks,
  homeTackleAttempts:homeDefense.tackleAttempts,awayTackleAttempts:awayDefense.tackleAttempts,homeTackles:homeDefense.tackles,awayTackles:awayDefense.tackles,
  homeInterceptAttempts:homeDefense.interceptAttempts,awayInterceptAttempts:awayDefense.interceptAttempts,homeInterceptions:homeDefense.interceptions,awayInterceptions:awayDefense.interceptions,
  homeAttackStops:awayDefense.attackStops,awayAttackStops:homeDefense.attackStops,homeQualityReduced:awayDefense.qualityReduced,awayQualityReduced:homeDefense.qualityReduced},summary};
}
async function simulateSingleMatch(matchId){
  if(!room||room.status!=='finished'){notify('Önce draft tamamlanmalı.',true);return;}
  const valid=validLeagueTeams();if(!valid.ok){notify(valid.message,true);return;}
  const ref=db.collection('rooms').doc(roomCode);
  try{
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);if(!snap.exists)throw new Error('Oda bulunamadı.');
      const data=snap.data(),league=data.league;
      if(!league?.fixtures?.length)throw new Error('Önce fikstürü oluştur.');
      const match=league.fixtures.find(m=>m.id===matchId);if(!match)throw new Error('Bu maç fikstürde bulunamadı.');
      const results={...(league.results||{})};if(results[matchId])throw new Error('Bu maç daha önce oynanmış.');
      const teams=(data.memberOrder||[]).map(id=>{const squad=(data.picks||[]).filter(p=>p.uid===id);const captainId=data.captains?.[id]||null;return {id,name:data.members?.[id]?.name||'Menajer',squad,captainId,power:scoreParts(squad,captainId).total};});
      const byId=Object.fromEntries(teams.map(t=>[t.id,t])),home=byId[match.homeUid],away=byId[match.awayUid];
      if(!home||!away)throw new Error('Fikstürde geçersiz takım bulundu.');
      const score=simulateScore(home,away),report=makeMatchReport(home,away,score);
      results[matchId]={...score,...report,played:true,playedAt:Date.now()};
      tx.update(ref,{'league.results':results,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    });
    // Snapshot beklenmeden de sonucu ekrana getir; ilgili maçın detayları açılır.
    const fresh=await ref.get();
    if(fresh.exists){room=fresh.data();renderAll();}
    const details=$(`matchDetails-${matchId}`);
    if(details)details.classList.remove('hidden');
    notify('Maç simüle edildi. Gol anları ve istatistikler kaydedildi.');
  }catch(err){notify(firebaseError(err),true);}
}

function renderLeague(){
  const status=$('leagueStatus');if(!status)return;
  const standingsEl=$('leagueStandings'),fixturesEl=$('leagueFixtures');
  const createBtn=$('createFixtures');
  if(!room){
    status.textContent='Lig bekleniyor';$('leagueDescription').textContent='Lig kurmak için önce bir oyun odasına katıl.';
    $('leagueSummary').innerHTML='';standingsEl.innerHTML='<div class="empty-state">Henüz lig tablosu oluşturulmadı.</div>';
    fixturesEl.innerHTML='<div class="empty-state">Henüz fikstür yok.</div>';$('fixtureCount').textContent='Fikstür oluşturulduğunda maçlar burada görünür.';
    createBtn.disabled=true;return;
  }
  const teams=leagueTeams(),league=room.league||null,fixtures=league?.fixtures||[],results=league?.results||{};
  const valid=validLeagueTeams(),played=fixtures.filter(m=>results[m.id]).length;
  status.textContent=!league?'Fikstür bekleniyor':played===fixtures.length&&fixtures.length?'Lig tamamlandı':played?'Maçlar oynanıyor':'Fikstür hazır';
  $('leagueDescription').textContent=valid.ok?'Kadrolar hazır. Çift devreli ligde her takım diğerleriyle iki kez karşılaşır.':valid.message;
  createBtn.disabled=!valid.ok||!!fixtures.length;

  $('leagueSummary').innerHTML=[
    ['TAKIM SAYISI',teams.length],
    ['TOPLAM MAÇ',fixtures.length||'—'],
    ['OYNANAN MAÇ',`${played} / ${fixtures.length||0}`]
  ].map(([label,value])=>`<div class="league-stat"><small>${label}</small><strong>${value}</strong></div>`).join('');
  $('fixtureCount').textContent=fixtures.length?`${fixtures.length} maç · ${played} oynandı`:'Fikstür oluşturulduğunda maçlar burada görünür.';
  if(!fixtures.length){
    standingsEl.innerHTML='<div class="empty-state">Fikstür maçlarını tek tek oynattıkça puan tablosu burada güncellenir.</div>';
    fixturesEl.innerHTML='<div class="empty-state">Fikstür oluşturmak için yukarıdaki düğmeye bas.</div>';return;
  }
  const stats=Object.fromEntries(teams.map(t=>[t.id,{...t,played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}]));
  fixtures.forEach(m=>{const r=results[m.id];if(!r)return;const h=stats[m.homeUid],a=stats[m.awayUid];if(!h||!a)return;h.played++;a.played++;h.gf+=r.homeGoals;h.ga+=r.awayGoals;a.gf+=r.awayGoals;a.ga+=r.homeGoals;if(r.homeGoals>r.awayGoals){h.w++;h.pts+=3;a.l++;}else if(r.homeGoals<r.awayGoals){a.w++;a.pts+=3;h.l++;}else{h.d++;a.d++;h.pts++;a.pts++;}});
  const sorted=Object.values(stats).sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||b.power-a.power);
  standingsEl.innerHTML=`<div class="league-table-wrap"><table class="league-table"><thead><tr><th>#</th><th>Menajer</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AG</th><th>YG</th><th>AV</th><th>P</th></tr></thead><tbody>${sorted.map((t,i)=>`<tr class="${i===0&&played===fixtures.length?'league-top':''}"><td>${i+1}</td><td>${esc(t.name)}${t.id===uid?' (Sen)':''}</td><td>${t.played}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${t.gf-t.ga}</td><td><b>${t.pts}</b></td></tr>`).join('')}</tbody></table></div>`;
  const teamNames=Object.fromEntries(teams.map(t=>[t.id,t.name]));
  const rounds={};fixtures.forEach(m=>(rounds[m.round]??=[]).push(m));
  fixturesEl.innerHTML=Object.entries(rounds).sort((a,b)=>Number(a[0])-Number(b[0])).map(([round,matches])=>`<div class="league-fixture-round"><h4>${Math.ceil(Number(round)/Math.max(1,teams.length-1))===1?'1. DEVRE':'2. DEVRE'} · ${round}. HAFTA</h4>${matches.map(m=>{const r=results[m.id],homeName=teamNames[m.homeUid]||'Takım',awayName=teamNames[m.awayUid]||'Takım';const report=r?.stats?`<div class="match-detail-grid"><div><small>TOPA SAHİP OLMA</small><b>${r.stats.homePossession}% – ${r.stats.awayPossession}%</b></div><div><small>ŞUT</small><b>${r.stats.homeShots} – ${r.stats.awayShots}</b></div><div><small>İSABETLİ ŞUT</small><b>${r.stats.homeShotsOnTarget} – ${r.stats.awayShotsOnTarget}</b></div><div><small>KORNER</small><b>${r.stats.homeCorners} – ${r.stats.awayCorners}</b></div><div><small>BEKLENEN GOL (xG)</small><b>${Number(r.stats.homeXg||0).toFixed(2)} – ${Number(r.stats.awayXg||0).toFixed(2)}</b></div><div><small>KALECİ KURTARIŞI</small><b>${r.stats.homeSaves??'—'} – ${r.stats.awaySaves??'—'}</b></div><div><small>ŞUT ENGELLEME</small><b>${r.stats.homeBlocks??'—'} – ${r.stats.awayBlocks??'—'}</b></div><div><small>TOP KAPMA</small><b>${r.stats.homeTackles??'—'} / ${r.stats.homeTackleAttempts??'—'} – ${r.stats.awayTackles??'—'} / ${r.stats.awayTackleAttempts??'—'}</b></div><div><small>PAS ARASI</small><b>${r.stats.homeInterceptions??'—'} / ${r.stats.homeInterceptAttempts??'—'} – ${r.stats.awayInterceptions??'—'} / ${r.stats.awayInterceptAttempts??'—'}</b></div><div><small>RAKİP HÜCUMUNU KESME</small><b>${r.stats.homeAttackStops??'—'} – ${r.stats.awayAttackStops??'—'}</b></div><div><small>ŞUT KALİTESİNİ DÜŞÜRME</small><b>${r.stats.homeQualityReduced??'—'} – ${r.stats.awayQualityReduced??'—'}</b></div><div><small>SARI / KIRMIZI KART</small><b>${r.stats.homeYellow??0}/${r.stats.homeRed??0} – ${r.stats.awayYellow??0}/${r.stats.awayRed??0}</b></div></div><div class="match-power-grid"><div><b>${esc(homeName)}</b><span>Temel ${r.stats.homeBase} · Ülke +${r.stats.homeCountry} · Bağ +${r.stats.homeLinks} · Kaptan +${r.stats.homeCaptain}</span><strong>Toplam güç ${r.stats.homePower}</strong><span>Savunma ${r.stats.homeDefenseTotal??'—'} · Orta saha/xG ${r.stats.homeXgTotal??'—'} · Hücum ${r.stats.homeAttackTotal??'—'}</span></div><div><b>${esc(awayName)}</b><span>Temel ${r.stats.awayBase} · Ülke +${r.stats.awayCountry} · Bağ +${r.stats.awayLinks} · Kaptan +${r.stats.awayCaptain}</span><strong>Toplam güç ${r.stats.awayPower}</strong><span>Savunma ${r.stats.awayDefenseTotal??'—'} · Orta saha/xG ${r.stats.awayXgTotal??'—'} · Hücum ${r.stats.awayAttackTotal??'—'}</span></div></div><p class="match-summary">${esc(r.summary||'Maç tamamlandı.')}</p><div class="match-events"><h5>📋 Maç olayları</h5>${r.events?.length?r.events.map(e=>`<div class="match-event"><span>${e.minute}’</span><b>${e.type==='goal'?'⚽':e.type==='yellow'?'🟨':'🟥'} ${esc(e.playerName)}${e.type==='goal'&&e.assistName?` <small>(Asist: ${esc(e.assistName)})</small>`:''}</b><small>${esc(e.teamName)}${e.type==='goal'?' · Gol':e.type==='yellow'?' · Sarı kart':' · Kırmızı kart'}</small></div>`).join(''):'<p>Kayda değer olay olmadı.</p>'}</div><div class="match-scorers"><h5>🥅 Gol katkıları</h5>${r.scorers?.length?r.scorers.map(g=>`<div class="match-event"><span>${g.goals} gol</span><b>${esc(g.playerName)}</b><small>${esc(g.teamName)}</small></div>`).join(''):'<p>Bu maçta gol olmadı.</p>'}</div>`:`<p class="hint">${r?'Bu maç eski sürümde simüle edilmiş; ayrıntılı istatistik kaydı bulunmuyor.':'Maç oynandığında skor, gol anları, takım güçleri ve maç istatistikleri burada gösterilecek.'}</p>`;return `<article class="league-match-card"><div class="league-match"><span class="league-team">${esc(homeName)}</span><span class="league-score ${r?'':'pending'}">${r?`${r.homeGoals} – ${r.awayGoals}`:'VS'}</span><span class="league-team">${esc(awayName)}</span><small class="league-match-meta">${r?'Maç tamamlandı':'Henüz oynanmadı'}</small></div><div class="league-match-controls">${!r?`<button class="primary small" data-sim-match="${esc(m.id)}">⚽ Maçı Simüle Et</button>`:''}<button class="secondary small" data-match-details="${esc(m.id)}">${r?'Maç Detaylarını Göster':'Maç Bilgisi'}</button></div><div class="league-match-details ${r?'':'hidden'}" id="matchDetails-${esc(m.id)}">${report}</div></article>`;}).join('')}</div>`).join('');
  fixturesEl.querySelectorAll('[data-sim-match]').forEach(btn=>btn.addEventListener('click',()=>simulateSingleMatch(btn.dataset.simMatch)));
  fixturesEl.querySelectorAll('[data-match-details]').forEach(btn=>btn.addEventListener('click',()=>{const panel=$(`matchDetails-${btn.dataset.matchDetails}`);if(panel){panel.classList.toggle('hidden');btn.textContent=panel.classList.contains('hidden')?(results[btn.dataset.matchDetails]?'Maç Detaylarını Göster':'Maç Bilgisi'):'Detayları Gizle';}}));
}

function renderAll(){renderRoom();renderPlayers();renderDraftSide();renderSquad();renderLeaderboard();renderLeague();}
init();
