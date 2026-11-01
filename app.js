import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, onAuthStateChanged, signOut, deleteUser, setPersistence, browserLocalPersistence, reload } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocs, runTransaction, serverTimestamp, arrayUnion } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { firebaseConfig, ADMIN_UID } from './firebase-config.js';

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
// Cloudflare Worker handles username/email login without Firebase Cloud Functions.
const AUTH_WORKER_URL='https://futbol-draft-auth.ardahanorhan.workers.dev';
// E-posta doğrulama bağlantıları her zaman yetkili ana domaine döner.
const EMAIL_ACTION_URL='https://futboldraft.com.tr';
// Keep the account signed in on this browser until the user explicitly logs out.
const authPersistenceReady=setPersistence(auth,browserLocalPersistence);
const $=id=>document.getElementById(id);
const CLUBS=["Galatasaray","Fenerbahçe","Beşiktaş","Trabzonspor","Barcelona","Real Madrid","Inter","PSG","Bayern Münih","Manchester City","Arsenal","Liverpool","Atlético Madrid","Juventus","Manchester United"];
const WHEEL_SLICES=["Galatasaray","PAS","Arsenal","Atlético Madrid","KORUMA","Beşiktaş","Real Madrid","PAS","Juventus","PSG","Fenerbahçe","Manchester City","Bayern Münih","Inter","TAKAS","Trabzonspor","Liverpool","Barcelona","Manchester United","KORUMA"];
const CLUB_COLORS = {
  "Galatasaray": "#A90432",
  "Fenerbahçe": "#FFED00",
  "Beşiktaş": "#222222",
  "Trabzonspor": "#6B1839",
  "Barcelona": "#004D98",
  "Real Madrid": "#E8D9A9",
  "Inter": "#00529F",
  "PSG": "#004170",
  "Bayern Münih": "#DC052D",
  "Manchester City": "#6CABDD",
  "Arsenal": "#EF0107",
  "Liverpool": "#C8102E",
  "Atlético Madrid": "#CB3524",
  "Juventus": "#252525",
  "Manchester United": "#DA291C"
};

const SPECIAL_COLORS = {
  "PAS": "#6B7280",
  "KORUMA": "#7C3AED",
  "TAKAS": "#F59E0B"
};

function getWheelSliceColor(slice) {
  if (SPECIAL_COLORS[slice]) return SPECIAL_COLORS[slice];
  return CLUB_COLORS[slice] || "#64748B";
}
const CLUB_TEXT_COLORS = {
  "Galatasaray": "#FDB912",       // Sarı
  "Fenerbahçe": "#002D72",        // Lacivert
  "Beşiktaş": "#FFFFFF",          // Beyaz
  "Trabzonspor": "#75AADB",       // Açık mavi
  "Barcelona": "#A50044",         // Bordo
  "Real Madrid": "#00529F",       // Mavi
  "Inter": "#000000",             // Siyah
  "PSG": "#E30613",               // Kırmızı
  "Bayern Münih": "#FFFFFF",      // Beyaz
  "Manchester City": "#1C2C5B",   // Lacivert
  "Arsenal": "#FFFFFF",           // Beyaz
  "Liverpool": "#00B2A9",         // Turkuaz
  "Atlético Madrid": "#FFFFFF",   // Beyaz
  "Juventus": "#FFFFFF",          // Beyaz
  "Manchester United": "#FBE122"  // Sarı
};

const SPECIAL_TEXT_COLORS = {
  "PAS": "#FFFFFF",
  "KORUMA": "#FFFFFF",
  "TAKAS": "#222222"
};

function getWheelTextColor(slice) {
  if (SPECIAL_TEXT_COLORS[slice]) {
    return SPECIAL_TEXT_COLORS[slice];
  }
  return CLUB_TEXT_COLORS[slice] || "#FFFFFF";
}
const RESUME_ROOM_KEY='carkFutbolResumeRoomId';
function readStored(key){try{return localStorage.getItem(key)||null}catch{return null}}
function writeStored(key,value){try{if(value)localStorage.setItem(key,String(value));else localStorage.removeItem(key)}catch{}}
let authFlowInProgress=false;
let actionLockTimer=null;
let user=null,profile=null,players=[],rooms=[],roomsUnsub=null,roomUnsub=null,room=null,roomId=null,roomRef=null,toastTimer=null,selectedCountry=null,pendingSpinCountry=null,lastWheelCountry=null,lastWheelSpinAt=0,lastPickAnnouncementId=null,lastSpinAnnouncementId=null,pendingSpinAnnouncementId=null,pickAnnouncementTimer=null,spinCooldownTimer=null,spinCooldownUntil=0,scheduledTurnKey=null,roomSnapshotInitialized=false,resumeInProgress=false;
const isAdmin=()=>!!user&&user.uid===ADMIN_UID;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function msg(text,error=false){const t=$('toast');if(!t)return;clearTimeout(toastTimer);if(!error){t.className='toast';return}t.textContent=text;t.className='toast show error';toastTimer=setTimeout(()=>t.className='toast',4500)}
const CLUB_CRESTS={
 'Galatasaray':'./assets/crests/Galatasaray.png',
 'Fenerbahçe':'./assets/crests/Fenerbahçe.png',
 'Beşiktaş':'./assets/crests/Beşiktaş.png',
 'Trabzonspor':'./assets/crests/Trabzonspor.png',
 'Barcelona':'./assets/crests/Barcelona.png',
 'Real Madrid':'./assets/crests/Real Madrid.png',
 'Inter':'./assets/crests/İnter.png',
 'PSG':'./assets/crests/PSG.png',
 'Bayern Münih':'./assets/crests/Bayern Münih.png',
 'Manchester City':'./assets/crests/Manchester City.png',
 'Arsenal':'./assets/crests/Arsenal.png',
 'Liverpool':'./assets/crests/Liverpool.png',
 'Atlético Madrid':'./assets/crests/Atletico Madrid.png',
 'Juventus':'./assets/crests/Juventus.png',
 'Manchester United':'./assets/crests/Manchester United.png'
};
const SPECIAL_SPIN_RESULTS={PAS:{label:'PAS',src:'./assets/crests/PAS.png'},KORUMA:{label:'KORUMA',src:'./assets/crests/KORUMA.png'},TAKAS:{label:'TAKAS',src:'./assets/crests/TAKAS.png'}};
function crestFallback(result){const initials=({'Galatasaray':'GS','Arsenal':'ARS','Beşiktaş':'BJK','Atlético Madrid':'ATM','Real Madrid':'RMA','Juventus':'JUV','PSG':'PSG','Fenerbahçe':'FB','Manchester City':'MCI','Bayern Münih':'FCB','Inter':'INT','Trabzonspor':'TS','Liverpool':'LIV','Barcelona':'BAR','Manchester United':'MUN'})[result]||'FC';return `<div class="spin-crest-fallback" aria-label="${esc(result)} arması"><span>${esc(initials)}</span></div>`}
function presentAnnouncement(html,duration){const box=$('pickAnnouncement');if(!box)return;box.innerHTML=html;box.style.animationDuration=`${duration/1000}s`;box.classList.remove('hidden','pick-announcement-show');void box.offsetWidth;box.classList.add('pick-announcement-show');clearTimeout(pickAnnouncementTimer);pickAnnouncementTimer=setTimeout(()=>{box.classList.remove('pick-announcement-show');box.classList.add('hidden')},duration)}
function showSpinAnnouncement(announcement){if(!announcement?.id||announcement.id===lastSpinAnnouncementId)return;lastSpinAnnouncementId=announcement.id;const result=String(announcement.result||'');const special=SPECIAL_SPIN_RESULTS[result];const crestSrc=special?.src||CLUB_CRESTS[result];let middle='';if(crestSrc){middle=`<img class="${special?'spin-special-crest':'spin-club-crest'}" src="${crestSrc}" alt="${esc(special?.label||result)} logosu" onerror="this.outerHTML=window.__spinCrestFallback('${result.replace(/'/g, '&#39;')}')">`}else{middle=`<div class="spin-special-icon">🎡</div>`}presentAnnouncement(`<div class="pick-announcement-main"><div class="pick-announcement-user">${esc(announcement.managerName||'Menajer')}</div><div class="pick-announcement-crest">${middle}</div><div class="pick-announcement-result">${esc(special?.label||result)}</div></div>`,3000)}
function queueSpinAnnouncement(announcement){if(!announcement?.id||announcement.id===lastSpinAnnouncementId||announcement.id===pendingSpinAnnouncementId)return;pendingSpinAnnouncementId=announcement.id;const elapsed=Math.max(0,Date.now()-Number(announcement.at||Date.now()));const delay=Math.max(0,3300-elapsed);setTimeout(()=>{if(pendingSpinAnnouncementId!==announcement.id)return;pendingSpinAnnouncementId=null;if(room?.lastSpinAnnouncement?.id===announcement.id)showSpinAnnouncement(announcement)},delay)}
function showPickAnnouncement(announcement){if(!announcement?.id||announcement.id===lastPickAnnouncementId)return;lastPickAnnouncementId=announcement.id;presentAnnouncement(`<div class="pick-announcement-main pick-player-announcement"><div class="pick-announcement-user">${esc(announcement.managerName||'Menajer')}</div><div class="pick-announcement-club">${esc(announcement.club||'Kulüp')}</div><div class="pick-announcement-player">${esc(announcement.playerName||'Futbolcu')}</div></div>`,3000)}
window.__spinCrestFallback=(result)=>crestFallback(result);
function authMsg(text,error=false){$('authMsg').textContent=text;$('authMsg').style.color=error?'#ffaaa3':'#8bd7a8'}
const normalizeNickname=value=>String(value||'').trim().toLowerCase();
function authErrorMessage(err){const code=err?.code||'';const message=err?.message||'';if(message.includes('EMAIL_NOT_VERIFIED')||code==='auth/email-not-verified'||code==='functions/failed-precondition')return 'E-posta adresin henüz doğrulanmamış. E-posta kutundaki doğrulama bağlantısını aç; ardından giriş yap.';if(code.includes('email-already-in-use'))return 'Bu e-posta adresiyle zaten hesap var. Giriş yapmayı dene.';if(code.includes('invalid-email'))return 'Geçerli bir e-posta adresi gir.';if(code.includes('weak-password'))return 'Şifre en az 6 karakter olmalı.';if(code.includes('user-not-found')||code.includes('wrong-password')||code.includes('invalid-credential')||code.includes('functions/unauthenticated')||message.includes('INVALID_CREDENTIALS'))return 'Kullanıcı adı/e-posta veya şifre hatalı.';if(message.includes('USERNAME_NOT_FOUND'))return 'Bu kullanıcı adıyla kayıtlı hesap bulunamadı.';if(message.includes('AUTH_SERVICE_UNAVAILABLE')||message.includes('SERVER_NOT_CONFIGURED'))return 'Giriş servisine şu anda ulaşılamıyor. Biraz sonra tekrar dene.';if(message.includes('USERNAME_TAKEN'))return 'Bu kullanıcı adı alınmış. Başka bir ad seç.';return (code?code+': ':'')+(message.replace(/^Firebase:\s*/,'')||'İşlem tamamlanamadı. Lütfen tekrar dene.')}
function userName(uid){return uid===ADMIN_UID?'Arda':(room?.members?.[uid]?.name||'Menajer')}
function countryPlayers(club){return players.filter(p=>p.club===club)}
function normalizePlayer(p){return {...p,country:p.club,rating:Number(p.overall||0),technique:Math.round((Number(p.attack||0)+Number(p.defense||0))/2)}}
function canAdminRoomAction(){return isAdmin()}
function rightsFor(kind,uid=user?.uid){return Number(room?.[kind]?.[uid]||0)}
function pickedIds(){return new Set((room?.picks||[]).map(p=>p.id))}
function myPicks(){return (room?.picks||[]).filter(p=>p.uid===user?.uid)}
function orderedTurns(){return room?.memberOrder||[]}
function isActionLocked(data=room){return Number(data?.actionLock?.until||0)>Date.now()}
function isMyTurn(){if(room?.status!=='drafting'||!room.memberOrder?.length||room.memberOrder[room.turnIndex%room.memberOrder.length]!==user?.uid||room.pendingPick||isActionLocked())return false;if(Date.now()<spinCooldownUntil)return false;const picks=room.picks||[];return starterCount(picks,user.uid)<11}
function currentTurnUid(){return room?.memberOrder?.[room.turnIndex%Math.max(1,room.memberOrder?.length||1)]}
function rosterFor(uid){return (room?.picks||[]).filter(p=>p.uid===uid)}
function formationSlots(){return ['GK','RB','CB','CB','LB','CM','CM','CAM','RW','LW','ST']}
function positionGroup(p){const x=String(p?.position||'').toLocaleLowerCase('tr-TR');if(x.includes('kaleci'))return 'GK';if(x.includes('bek'))return 'FB';if(x.includes('stoper'))return 'CB';if(x.includes('ofansif orta'))return 'CAM';if(x.includes('kanat'))return 'W';if(x.includes('santrfor'))return 'ST';if(x.includes('orta saha'))return 'CM';return 'CM'}
function slotGroup(slot){if(slot==='GK')return 'GK';if(['RB','LB'].includes(slot))return 'FB';if(slot==='CB')return 'CB';if(slot==='CAM')return 'CAM';if(['RW','LW'].includes(slot))return 'W';if(slot==='ST')return 'ST';return 'CM'}
const STARTER_POSITIONS=['Kaleci','Sağ bek','Stoper','Stoper','Sol bek','Merkez orta saha','Merkez orta saha','Ofansif orta saha','Sağ kanat','Sol kanat','Santrfor'];
function exactPos(p){return String(p?.position||'').trim().toLocaleLowerCase('tr-TR')}
function starterCount(picks,uid){return picks.filter(p=>p.uid===uid&&p.starterIndex!==null&&p.starterIndex!==undefined&&Number(p.starterIndex)>=0&&Number(p.starterIndex)<11).length}
function draftStage(){return 'starter'}
function validPickCandidates(club,picks,uid,members){const mine=picks.filter(p=>p.uid===uid);if(starterCount(picks,uid)>=11)return [];const used=new Set(picks.map(p=>p.id));const filled=new Set(mine.map(p=>Number(p.starterIndex)).filter(i=>Number.isInteger(i)&&i>=0&&i<11));return players.filter(p=>p.club===club&&!used.has(p.id)&&STARTER_POSITIONS.some((pos,i)=>!filled.has(i)&&exactPos(p)===pos.toLocaleLowerCase('tr-TR')))}
function nextTurnIndex(members,picks,currentIndex){if(!members.length)return 0;for(let step=1;step<=members.length;step++){const idx=(currentIndex+step)%members.length,uid=members[idx];if(starterCount(picks,uid)<11)return idx;}return (currentIndex+1)%members.length}
function stageMessage(){return 'İlk 11 seçim aşaması'}
function posCode(p){const x=(p.position||'').toLocaleLowerCase('tr-TR');if(x.includes('kaleci'))return 'GK';if(x.includes('bek'))return 'FB';if(x.includes('stoper'))return 'CB';if(x.includes('orta'))return 'CM';if(x.includes('hücum')||x.includes('forvet')||x.includes('santr'))return 'ST';return 'CM'}
function avg(arr,key){return arr.length?arr.reduce((s,p)=>s+Number(p[key]||0),0)/arr.length:65}
function teamProfile(team){
 const squad=(team.squad||[]).filter(p=>p.starter!==false),byPosition=pos=>squad.filter(p=>p.position===pos),avg=(arr,key)=>arr.length?arr.reduce((s,p)=>s+Number(p[key]||0),0)/arr.length:65;
 const keeper=byPosition('Kaleci')[0]||squad.find(p=>String(p.position||'').toLocaleLowerCase('tr-TR').includes('kaleci'));
 const cbs=byPosition('Stoper'),fullbacks=[...byPosition('Sağ bek'),...byPosition('Sol bek')],cms=byPosition('Merkez orta saha'),cam=byPosition('Ofansif orta saha'),wingers=[...byPosition('Sağ kanat'),...byPosition('Sol kanat')],strikers=byPosition('Santrfor');
 const tactic=team.tactic||'balanced',attack=avg(squad,'attack'),defense=avg(squad,'defense'),overall=avg(squad,'overall'),forwardAttack=avg([...cam,...wingers,...strikers],'attack');
 const defensiveCore=avg(cbs,'defense')*.34+avg(fullbacks,'defense')*.18+avg(cms,'defense')*.18+Number(keeper?.defense||65)*.30;
 // Topa sahip olma tüm ilk 11'in GENEL GÜÇ toplamına; pas becerisi ise
 // merkez orta saha + ofansif orta saha + kanatların GENEL GÜÇ ortalamasına dayanır.
 const overallPowerTotal=squad.reduce((sum,p)=>sum+Number(p.overall||0),0);
 const passPlayers=[...cms,...cam,...wingers];
 const passSkill=passPlayers.length?avg(passPlayers,'overall'):overall;
 return {id:team.id,name:team.name,squad,tactic,attack,defense,overall,forwardAttack,defensiveCore,keeperDef:Number(keeper?.defense||65),passSkill,overallPowerTotal,power:overall};
}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function randInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}
function choose(arr){return arr.length?arr[randInt(0,arr.length-1)]:null}
function simulateMatch(home,away){
 // Her maçta takımın kaydedilmiş taktik/pas/pres tercihleri ilgili gol kuralına uygulanır.
 const h=scoreTeam(home),a=scoreTeam(away);
 let homeGoals=0,awayGoals=0;
 const events=[],ruleAudit=[];
 const addGoal=(team,profile,reason)=>{
  const scorers=profile.squad.filter(p=>String(p.position||'').trim()!=='Kaleci');
  const scorer=choose(scorers);
  events.push({minute:randInt(1,90),type:'goal',team:team.id,playerId:scorer?.id||null,playerName:scorer?.name||'Bilinmeyen oyuncu',reason,text:`${scorer?.name||'Bilinmeyen oyuncu'}`});
  if(team.id===h.id)homeGoals++;else awayGoals++;
 };
 const addAudit=(rule,homeValue,awayValue,threshold,homeEffects,awayEffects,winner)=>ruleAudit.push({rule,homeValue,awayValue,threshold,homeEffects,awayEffects,winner});
 const teamLabel=team=>team.name||team.id;

 // 1. Ev sahibi Overall dezavantajı. Taktik bonusları bu kurala uygulanmaz.
 let winner=null;
 if(h.overallTotal<a.overallTotal){addGoal(home,h,'1. Ev sahibi Overall dezavantajı');winner=teamLabel(home)}
 addAudit('1. Ev sahibi Overall dezavantajı',h.overallTotal,a.overallTotal,'Ev sahibi Overall < rakip Overall','Taktik bonusu uygulanmaz','Taktik bonusu uygulanmaz',winner);

 // 2. Takım Overall üstünlüğü. Taktik bonusları bu kurala uygulanmaz.
 winner=null;
 if(h.overallTotal-a.overallTotal>=20){addGoal(home,h,'2. Takım Overall üstünlüğü (20+)');winner=teamLabel(home)}
 else if(a.overallTotal-h.overallTotal>=20){addGoal(away,a,'2. Takım Overall üstünlüğü (20+)');winner=teamLabel(away)}
 addAudit('2. Takım Overall üstünlüğü',h.overallTotal,a.overallTotal,20,'Taktik bonusu uygulanmaz','Taktik bonusu uygulanmaz',winner);

 // 3. Savunma: Defansif +15, Uzun Top +10; rakibin Önde Pres'i -10.
 const hDefEffects=[home.tactic==='defensive'?'+15 Defansif':'',home.passFocus==='longBall'?'+10 Uzun Top':'',away.pressType==='highPress'?'−10 rakibin Önde Pres’i':''].filter(Boolean);
 const aDefEffects=[away.tactic==='defensive'?'+15 Defansif':'',away.passFocus==='longBall'?'+10 Uzun Top':'',home.pressType==='highPress'?'−10 rakibin Önde Pres’i':''].filter(Boolean);
 h.defenseTotal += Number(home.tactic==='defensive'?15:0) + Number(home.passFocus==='longBall'?10:0) - Number(away.pressType==='highPress'?10:0);
 a.defenseTotal += Number(away.tactic==='defensive'?15:0) + Number(away.passFocus==='longBall'?10:0) - Number(home.pressType==='highPress'?10:0);
 winner=null;
 if(h.defenseTotal-a.defenseTotal>=15){addGoal(home,h,'3. Savunma üstünlüğü (15+ DEF; bonuslar uygulandı)');winner=teamLabel(home)}
 else if(a.defenseTotal-h.defenseTotal>=15){addGoal(away,a,'3. Savunma üstünlüğü (15+ DEF; bonuslar uygulandı)');winner=teamLabel(away)}
 addAudit('3. Savunma üstünlüğü',h.defenseTotal,a.defenseTotal,15,hDefEffects.join(', ')||'Ek etki yok',aDefEffects.join(', ')||'Ek etki yok',winner);

 // 4. Orta saha: Dengeli +15, Kısa Pas +10; rakibin Orta Blok Pres'i -10.
 const hMidEffects=[home.tactic==='balanced'?'+15 Dengeli':'',home.passFocus==='shortPass'?'+10 Kısa Pas':'',away.pressType==='midBlock'?'−10 rakibin Orta Blok Pres’i':''].filter(Boolean);
 const aMidEffects=[away.tactic==='balanced'?'+15 Dengeli':'',away.passFocus==='shortPass'?'+10 Kısa Pas':'',home.pressType==='midBlock'?'−10 rakibin Orta Blok Pres’i':''].filter(Boolean);
 h.midfieldTotal += Number(home.tactic==='balanced'?15:0) + Number(home.passFocus==='shortPass'?10:0) - Number(away.pressType==='midBlock'?10:0);
 a.midfieldTotal += Number(away.tactic==='balanced'?15:0) + Number(away.passFocus==='shortPass'?10:0) - Number(home.pressType==='midBlock'?10:0);
 winner=null;
 if(h.midfieldTotal-a.midfieldTotal>=15){addGoal(home,h,'4. Orta saha Overall üstünlüğü (15+; bonuslar uygulandı)');winner=teamLabel(home)}
 else if(a.midfieldTotal-h.midfieldTotal>=15){addGoal(away,a,'4. Orta saha Overall üstünlüğü (15+; bonuslar uygulandı)');winner=teamLabel(away)}
 addAudit('4. Orta saha üstünlüğü',h.midfieldTotal,a.midfieldTotal,15,hMidEffects.join(', ')||'Ek etki yok',aMidEffects.join(', ')||'Ek etki yok',winner);

 // 5. Hücum üçlüsü: Hücumcu +15, Kanat Oyunu +10; rakibin Geride Pres'i -10.
 const hAtkEffects=[home.tactic==='attacking'?'+15 Hücumcu':'',home.passFocus==='wingPlay'?'+10 Kanat Oyunu':'',away.pressType==='deepBlock'?'−10 rakibin Geride Pres’i':''].filter(Boolean);
 const aAtkEffects=[away.tactic==='attacking'?'+15 Hücumcu':'',away.passFocus==='wingPlay'?'+10 Kanat Oyunu':'',home.pressType==='deepBlock'?'−10 rakibin Geride Pres’i':''].filter(Boolean);
 h.attackTrioTotal += Number(home.tactic==='attacking'?15:0) + Number(home.passFocus==='wingPlay'?10:0) - Number(away.pressType==='deepBlock'?10:0);
 a.attackTrioTotal += Number(away.tactic==='attacking'?15:0) + Number(away.passFocus==='wingPlay'?10:0) - Number(home.pressType==='deepBlock'?10:0);
 winner=null;
 if(h.attackTrioTotal-a.attackTrioTotal>=15){addGoal(home,h,'5. Hücum üçlüsü üstünlüğü (15+ ATT; bonuslar uygulandı)');winner=teamLabel(home)}
 else if(a.attackTrioTotal-h.attackTrioTotal>=15){addGoal(away,a,'5. Hücum üçlüsü üstünlüğü (15+ ATT; bonuslar uygulandı)');winner=teamLabel(away)}
 addAudit('5. Hücum üçlüsü üstünlüğü',h.attackTrioTotal,a.attackTrioTotal,15,hAtkEffects.join(', ')||'Ek etki yok',aAtkEffects.join(', ')||'Ek etki yok',winner);

 // 6. Ev sahibi ATT düşükse +20 telafi bonusu. Taktik/pas/pres bonusları bu kurala uygulanmaz.
 let adjustedHomeAttack=h.totalAttack;
 let rule6HomeEffects='Taktik bonusu uygulanmaz',rule6AwayEffects='Taktik bonusu uygulanmaz';
 if(h.totalAttack<a.totalAttack){
  adjustedHomeAttack+=20;rule6HomeEffects='+20 ev sahibi telafi bonusu';
  events.push({minute:0,type:'bonus',team:home.id,playerId:null,playerName:'Ev sahibi bonusu',reason:'6. Ev sahibi toplam ATT düşük: +20 bonus',text:`ATT ${h.totalAttack} → ${adjustedHomeAttack}`});
 }
 winner=null;
 if(adjustedHomeAttack>a.totalAttack){addGoal(home,h,'6. Bonus sonrası toplam Hücum (ATT) üstünlüğü');winner=teamLabel(home)}
 else if(a.totalAttack>adjustedHomeAttack){addGoal(away,a,'6. Bonus sonrası toplam Hücum (ATT) üstünlüğü');winner=teamLabel(away)}
 addAudit('6. Toplam hücum ve ev sahibi bonusu',adjustedHomeAttack,a.totalAttack,'Yüksek ATT değeri kazanır; eşitlikte gol yok',rule6HomeEffects,rule6AwayEffects,winner);
 events.sort((x,y)=>x.minute-y.minute);
 return {homeGoals,awayGoals,events,ruleAudit,tacticsApplied:{home:{tactic:home.tactic||'balanced',passFocus:home.passFocus||'shortPass',pressType:home.pressType||'midBlock'},away:{tactic:away.tactic||'balanced',passFocus:away.passFocus||'shortPass',pressType:away.pressType||'midBlock'}}};
}
function scoreTeam(team){
 const squad=(team.squad||[]).filter(p=>p.starter!==false);
 const by=position=>squad.filter(p=>String(p.position||'').trim()===position);
 const sum=(arr,key)=>arr.reduce((total,p)=>total+Number(p[key]||0),0);
 const keeper=by('Kaleci')[0];
 const cbs=by('Stoper'),cms=by('Merkez orta saha');
 const cam=by('Ofansif orta saha')[0],rb=by('Sağ bek')[0],lb=by('Sol bek')[0];
 const rw=by('Sağ kanat')[0],lw=by('Sol kanat')[0],st=by('Santrfor')[0];
 const overallTotal=sum(squad,'overall');
 const defenseTotal=sum([keeper,...cbs.slice(0,2),rb,lb].filter(Boolean),'defense');
 const midfieldTotal=sum([...cms.slice(0,2),cam].filter(Boolean),'overall');
 const attackTrioTotal=sum([st,rw,lw].filter(Boolean),'attack');
 const totalAttack=sum(squad,'attack');
 return {id:team.id,name:team.name,squad,overallTotal,defenseTotal,midfieldTotal,attackTrioTotal,totalAttack};
}
function awardByDifference(home,homeScore,away,awayScore,key,threshold,reason,addGoal){
 const difference=homeScore[key]-awayScore[key];
 if(difference>=threshold)addGoal(home,homeScore,reason);
 else if(difference<=-threshold)addGoal(away,awayScore,reason);
}
function buildFixtures(teamIds){let a=[...teamIds];if(a.length%2)a.push(null);let n=a.length,rot=[...a],rounds=[];for(let r=0;r<n-1;r++){let m=[];for(let i=0;i<n/2;i++){let x=rot[i],y=rot[n-1-i];if(x&&y){let home=(r+i)%2===0?x:y;m.push({homeUid:home,awayUid:home===x?y:x,round:r+1,leg:1})}}rounds.push(m);rot=[rot[0],rot[n-1],...rot.slice(1,n-1)]}const first=rounds.flat();const second=rounds.map((ms,i)=>ms.map(m=>({homeUid:m.awayUid,awayUid:m.homeUid,round:rounds.length+i+1,leg:2}))).flat();return [...first,...second].map((m,i)=>({...m,id:'match-'+(i+1),played:false}))}
function standings(){const teams=(room?.memberOrder||[]).map(id=>({id,name:userName(id),squad:rosterFor(id),formation:'4-2-3-1',tactic:room?.tactics?.[id]?.tactic||'balanced',played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}));for(const m of room?.league?.fixtures||[]){const r=room?.league?.results?.[m.id];if(!r)continue;const h=teams.find(t=>t.id===m.homeUid),a=teams.find(t=>t.id===m.awayUid);if(!h||!a)continue;h.played++;a.played++;h.gf+=r.homeGoals;h.ga+=r.awayGoals;a.gf+=r.awayGoals;a.ga+=r.homeGoals;if(r.homeGoals>r.awayGoals){h.w++;h.pts+=3;a.l++}else if(r.homeGoals<r.awayGoals){a.w++;a.pts+=3;h.l++}else{h.d++;a.d++;h.pts++;a.pts++}}return teams.sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf)}
function drawWheel(){const c=$('wheelCanvas');if(!c)return;const ctx=c.getContext('2d'),cx=c.width/2,cy=c.height/2,r=196,n=WHEEL_SLICES.length;ctx.clearRect(0,0,c.width,c.height);for(let i=0;i<n;i++){const a=2*Math.PI/n,start=-Math.PI/2+i*a,end=start+a;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,end);ctx.closePath();ctx.fillStyle=getWheelSliceColor(WHEEL_SLICES[i]);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();ctx.save();ctx.translate(cx,cy);ctx.rotate(start+a/2);ctx.textAlign='right';ctx.fillStyle=getWheelTextColor(WHEEL_SLICES[i]);ctx.font=`bold ${WHEEL_SLICES[i].length>10?9:11}px system-ui`;ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.fillText(WHEEL_SLICES[i],r-10,4);ctx.restore()}ctx.save();const rim=ctx.createRadialGradient(cx,cy,r+1,cx,cy,r+9);rim.addColorStop(0,'#6f4d18');rim.addColorStop(.28,'#f8e5a6');rim.addColorStop(.55,'#b88b3d');rim.addColorStop(.82,'#fff0bd');rim.addColorStop(1,'#674511');ctx.beginPath();ctx.arc(cx,cy,r+4,0,Math.PI*2);ctx.strokeStyle=rim;ctx.lineWidth=8;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,r+9,0,Math.PI*2);ctx.strokeStyle='rgba(255,226,157,.55)';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();ctx.beginPath();ctx.arc(cx,cy,43,0,Math.PI*2);ctx.fillStyle='#101827';ctx.fill();ctx.strokeStyle='#d8b56a';ctx.lineWidth=3;ctx.stroke()}
function drawWheelSpin(slice){const c=$('wheelCanvas');const idx=WHEEL_SLICES.indexOf(slice);if(idx<0)return;const a=2*Math.PI/WHEEL_SLICES.length;const center=-Math.PI/2+(idx+.5)*a;const angle=-(center+Math.PI/2);c.style.transition='transform 3.2s cubic-bezier(.12,.78,.12,1)';c.style.transform=`rotate(${360*5+angle*180/Math.PI}deg)`;setTimeout(()=>{c.style.transition='none';c.style.transform=`rotate(${angle*180/Math.PI}deg)`},3300)}
function isLeagueSimulationComplete(data){
 const fixtures=data?.league?.fixtures||[],results=data?.league?.results||{};
 return data?.status==='finished'&&fixtures.length>0&&fixtures.every(m=>!!results[m.id]);
}
function renderRooms(){
 const list=$('roomList');if(!list)return;
 if(!isAdmin()){list.innerHTML='<div class="empty-state">Odaya yalnızca geçerli oda koduyla katılabilirsin.</div>';return}
 if(!rooms.length){list.innerHTML='<div class="empty-state">Şu anda açık oyun odası bulunmuyor.</div>';return}
 const statusLabel={waiting:'Oyuncu bekliyor',drafting:'Draft devam ediyor',finished:'Lig aşaması'};
 list.innerHTML=`<div class="admin-room-list-head"><b>Yönetici oda listesi</b><span>${rooms.length} oda</span></div>`+rooms.map(r=>{
  const members=(r.memberOrder||[]).length,capacity=Number(r.capacity||members),fixtures=r.league?.fixtures||[],results=r.league?.results||{},played=fixtures.filter(m=>!!results[m.id]).length,complete=isLeagueSimulationComplete(r);
  return `<article class="admin-room-card"><div class="admin-room-card-main"><b>${esc(r.name||'İsimsiz oda')}</b><span class="muted">${esc(r.code||r.id)} · ${members}/${capacity} oyuncu</span><span class="muted">${statusLabel[r.status]||r.status} · ${fixtures.length?`${played}/${fixtures.length} maç oynandı`:'Henüz fikstür yok'}</span></div><div class="admin-room-card-actions"><button type="button" class="btn small secondary" data-admin-open-room="${esc(r.id)}">Odayı aç</button>${complete?`<button type="button" class="btn small danger" data-admin-close-room="${esc(r.id)}">Odayı kapat</button>`:''}</div></article>`
 }).join('');
 list.querySelectorAll('[data-admin-open-room]').forEach(b=>b.onclick=()=>enterRoom(b.dataset.adminOpenRoom,true));
 list.querySelectorAll('[data-admin-close-room]').forEach(b=>b.onclick=()=>closeAdminRoom(b.dataset.adminCloseRoom));
}
function renderRoom(){
 if(!room)return;
 scheduleTurnTimeout();$('roomView').classList.remove('hidden');$('spinResult').classList.toggle('hidden',room.status==='finished');
 if(room.lastSpin?.at&&room.lastSpin.at!==lastWheelSpinAt){drawWheelSpin(room.lastSpin.slice);lastWheelSpinAt=room.lastSpin.at;spinCooldownUntil=Date.now()+3400;const spinAt=room.lastSpin.at;clearTimeout(spinCooldownTimer);spinCooldownTimer=setTimeout(()=>{if(room?.lastSpin?.at===spinAt){spinCooldownUntil=0;renderRoom()}},3450)}
 const locked=isActionLocked();clearTimeout(actionLockTimer);actionLockTimer=null;
 if(locked){actionLockTimer=setTimeout(()=>{if(room){renderRoom()}},Math.max(30,Number(room.actionLock.until)-Date.now()+40))}
 $('roomTitle').textContent=room.name||'Çark Futbol Odası';$('roomCode').textContent=room.code||roomId;
 const closeBtn=$('closeRoomBtn');if(closeBtn){closeBtn.classList.toggle('hidden',!isAdmin()||!isLeagueSimulationComplete(room));closeBtn.onclick=closeRoom;}
 $('roomStatus').textContent=({waiting:'Oyuncuların katılması bekleniyor',drafting:locked?'Hamle penceresi açık · Bekleniyor':'Draft devam ediyor',finished:'Kadrolar tamamlandı · Lig aşaması',cancelled:'Oda iptal edildi'})[room.status]||room.status;
 $('startDraftBtn').classList.toggle('hidden',!(isAdmin()||room.ownerUid===user.uid)||room.status!=='waiting'||room.memberOrder.length<2);
 $('startDraftBtn').textContent='Draftı başlat';$('turnHeading').textContent=room.status==='drafting'?`${userName(currentTurnUid())} seçiyor · ${stageMessage(room.picks||[],room.memberOrder||[])}`:'Draft başlamadı';
 $('turnPill').textContent=room.status==='drafting'?(locked?'Sonuç penceresi açık':isMyTurn()?'Sıra sende':`Sıra: ${userName(currentTurnUid())}`):room.status==='finished'?'Draft tamamlandı':'Başlamayı bekliyor';
 $('spinBtn').disabled=!isMyTurn();$('spinBtn').textContent='🎡 Çarkı çevir';$('pickPanel').classList.add('hidden');
 if(room.pendingPick&&room.pendingPick.uid===user.uid&&room.pendingPick.club){selectedCountry=room.pendingPick.club;if(!locked)renderPlayerOptions(selectedCountry);else $('spinResult').textContent='Çark sonucu penceresi kapanınca futbolcunu seçebilirsin.'}
 else if(room.pendingPick){$('spinResult').textContent=`${userName(room.pendingPick.uid)} çark sonucunu uyguluyor: ${room.pendingPick.slice}.`}
 else if(locked){$('spinResult').textContent='Sonuç penceresi kapanana kadar yeni hamle yapılamaz.'}
 else if(room.status==='drafting'&&isMyTurn())$('spinResult').textContent=`Sıra sende! ${stageMessage(room.picks||[],room.memberOrder||[])}. Çarkı çevir.`;
 else if(room.status==='drafting'&&starterCount(room.picks||[],user.uid)>=11)$('spinResult').textContent='İlk 11’in tamamlandı. Diğer oyuncuların da ilk 11’lerini tamamlamasını bekle.';
 else if(room.status==='waiting')$('spinResult').textContent='Oda sahibi draftı başlattığında çark aktif olacak.';else $('spinResult').textContent='';
 const phase=room.postDraftPhase||'protection',protectionDone=room.protectionDone||{},swapConfirmed=room.swapConfirmed||{},myProtectionDone=!!protectionDone[user.uid],mySwapConfirmed=!!swapConfirmed[user.uid];
 $('specialActions').innerHTML=`<div class="special-rights"><div class="rights-card protection-card"><span class="rights-icon" aria-hidden="true">♜</span><span class="rights-label">KORUMA</span><strong>${rightsFor('protectionRights')}<small>/3</small></strong></div><div class="rights-card swap-card"><span class="rights-icon" aria-hidden="true">⇄</span><span class="rights-label">TAKAS</span><strong>${rightsFor('swapRights')}<small>/3</small></strong></div><p class="rights-note"><span class="rights-info">i</span>${phase==='protection'?(myProtectionDone?'Koruma seçimin onaylandı. Diğer oyuncular bekleniyor.':'Koruma ve takas pencereleri açılacak.') :phase==='swaps'?(mySwapConfirmed?'Takasların onaylandı. Diğer oyuncular bekleniyor.':'Takas penceresi açılacak.'):'Koruma ve takas aşamaları tamamlandı.'}</p></div>`;
 $('turnOrder').innerHTML=(room.memberOrder||[]).map((id,i)=>`<div class="turn-item ${id===currentTurnUid()&&room.status==='drafting'?'current':''}"><span class="turn-num">${i+1}</span><span><b>${esc(userName(id))}</b><small>${starterCount(room.picks||[],id)}/11 ilk 11</small></span><span class="turn-mark">${id===user.uid?'SEN':id===currentTurnUid()&&room.status==='drafting'?'SIRA':''}</span></div>`).join('');
 $('draftTeams').innerHTML=(room.memberOrder||[]).map(id=>{const sq=rosterFor(id);return `<div class="team-mini"><div><b>${esc(userName(id))}</b><small>${starterCount(room.picks||[],id)}/11 ilk 11</small></div><div class="progress"><i style="width:${starterCount(room.picks||[],id)/11*100}%"></i></div></div>`}).join('');
 renderSquad();renderLeague();renderPersistentSwapReport();syncPostDraftModal();
}
function renderPlayerOptions(country){const panel=$('pickPanel');if(panel)panel.classList.remove('hidden');const avail=validPickCandidates(country,room?.picks||[],user?.uid,room?.memberOrder||[]).map(normalizePlayer);$('playerSelect').innerHTML=avail.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.position)}</option>`).join('');$('pickBtn').disabled=!avail.length;$('pickBtn').textContent='Oyuncuyu seç';$('pickBtn').classList.remove('hidden');$('playerPreview').innerHTML=avail.length?playerCard(avail[0]):'<p>Bu takımda boş mevkiye uygun futbolcu yok. Bu el PAS sayılacak.</p>';if(!avail.length){setTimeout(()=>advanceEmptyCountry(country),350)}$('playerSelect').onchange=()=>{$('playerPreview').innerHTML=playerCard(players.find(p=>p.id===$('playerSelect').value))}}
function playerCard(p){p=normalizePlayer(p||{});return `<div class="player-card"><div class="player-top"><div><b>${esc(p.name)}</b><small>${esc(p.club||p.country)} · ${esc(p.position)}</small></div></div></div>`}
async function advanceEmptyCountry(club){if(!room||!room.pendingPick||room.pendingPick.club!==club||room.pendingPick.uid!==currentTurnUid())return;try{await runTransaction(db,async tx=>{const s=await tx.get(roomRef);if(!s.exists())return;const d=s.data();if(!d.pendingPick||d.pendingPick.club!==club)return;const candidates=validPickCandidates(club,d.picks||[],d.pendingPick.uid,d.memberOrder||[]);if(candidates.length)return;const next=nextTurnIndex(d.memberOrder||[],d.picks||[],d.turnIndex);tx.update(roomRef,{pendingPick:null,turnIndex:next,turnStartedAt:Date.now(),lastSpin:{...(d.lastSpin||{}),slice:club,at:Date.now()},updatedAt:serverTimestamp()})});}catch(e){console.error(e)}}
function scheduleTurnTimeout(){
 if(!room||room.status!=='drafting'||room.pendingPick||!room.memberOrder?.length)return;
 const uid=currentTurnUid();if(!uid||starterCount(room.picks||[],uid)>=11)return;
 // Süre sınırı ve otomatik çevirme yoktur; oyuncu istediği zaman kendi çarkını çevirir.
 const turnKey=`${room.id||roomId}:${room.turnIndex}:${uid}`;
 if(scheduledTurnKey===turnKey)return;
 scheduledTurnKey=turnKey;
 if(!room.turnStartedAt){
  const started=Date.now();room.turnStartedAt=started;
  runTransaction(db,async tx=>{const snap=await tx.get(roomRef);if(!snap.exists())return;const d=snap.data();if(d.status==='drafting'&&d.turnIndex===room.turnIndex&&d.memberOrder?.[d.turnIndex%d.memberOrder.length]===uid&&!d.turnStartedAt)tx.update(roomRef,{turnStartedAt:started,updatedAt:serverTimestamp()})}).catch(e=>console.warn('Tur başlangıcı kaydedilemedi:',e));
 }
}
async function spin(){if(!user?.uid){msg('Önce giriş yapmalısın.',true);return;}if(!isMyTurn()){msg('Şu anda çarkı çeviremezsin.',true);return;}await spinFor(user.uid,false)}
async function spinFor(requestedUid,automatic=false){
 if(automatic)return; // Çark yalnızca oyuncu tarafından çevrilir.
 if(!room||!roomRef)return;
 try{
  await runTransaction(db,async tx=>{
   const snap=await tx.get(roomRef);if(!snap.exists())throw new Error('Oda bulunamadı.');const d=snap.data();
   if(d.status!=='drafting'||!d.memberOrder?.length)throw new Error('Draft aktif değil.');
   const uid=d.memberOrder[d.turnIndex%d.memberOrder.length];
   if(uid!==requestedUid)throw new Error('Sıra değişti; güncel sırayı bekle.');
   if(uid!==user?.uid)throw new Error('Şu anda sıra sende değil.');
   if(d.pendingPick)throw new Error('Önce seçimini tamamla.');
   if(isActionLocked(d))throw new Error('Sonuç penceresi kapanana kadar beklemelisin.');
   if(starterCount(d.picks||[],uid)>=11)throw new Error('Bu oyuncunun ilk 11’i tamamlandı.');
   if(d.lastSpin?.at&&Date.now()-Number(d.lastSpin.at)<3400)throw new Error('Çarkın durmasını bekle.');
   const slice=WHEEL_SLICES[Math.floor(Math.random()*WHEEL_SLICES.length)],at=Date.now();
   const managerName=d.members?.[uid]?.name||'Menajer';
   const spinAnnouncement={id:`spin_${at}_${uid}`,uid,managerName,result:slice,at,automatic:false};
   const picks=[...(d.picks||[])];
   const updates={lastSpin:{uid,slice,at,automatic:false},lastSpinAnnouncement:spinAnnouncement,actionLock:{id:spinAnnouncement.id,kind:'spin',startedAt:at,until:at+6300},turnStartedAt:at,updatedAt:serverTimestamp()};
   if(CLUBS.includes(slice)){
    const candidates=validPickCandidates(slice,picks,uid,d.memberOrder||[]);
    if(candidates.length){
     // Oyuncu listesi açılır; futbolcu seçilene kadar sıra ve kadro değişmez.
     updates.pendingPick={uid,club:slice,slice,at};
     tx.update(roomRef,updates);
     return;
    }
    // Bu kulüpte uygun mevki yoksa bu tur PAS sayılır.
   }else if(slice==='KORUMA'||slice==='TAKAS'){
    const field=slice==='KORUMA'?'protectionRights':'swapRights';
    const earnedField=slice==='KORUMA'?'protectionRightsEarned':'swapRightsEarned';
    const rights={...(d[field]||{})},earned={...(d[earnedField]||{})},current=Number(earned[uid]??0);
    if(current<3){rights[uid]=Number(rights[uid]||0)+1;earned[uid]=current+1;updates[field]=rights;updates[earnedField]=earned;}
   }
   // PAS, özel sonuç veya uygun oyuncusu olmayan kulüp: sonraki oyuncuya geç.
   updates.pendingPick=null;
   updates.turnIndex=nextTurnIndex(d.memberOrder||[],picks,d.turnIndex);
   tx.update(roomRef,updates);
  });
 }catch(e){msg(e.message||'Çark çevrilemedi.',true);}
}
async function pickPlayer(){
 if(!room||!roomRef||!user)return;
 const club=room.pendingPick?.club;
 if(!club||room.pendingPick.uid!==user.uid||currentTurnUid()!==user.uid){msg('Önce kendi sıranda çarkı çevir.');return;}
 if(isActionLocked()){msg('Çark sonucu penceresi kapanana kadar beklemelisin.');return;}
 const playerId=$('playerSelect')?.value;
 if(!playerId){msg('Lütfen bir futbolcu seç.',true);return;}
 try{
  await runTransaction(db,async tx=>{
   const snap=await tx.get(roomRef);if(!snap.exists())throw new Error('Oda bulunamadı.');
   const d=snap.data(),pending=d.pendingPick;
   if(d.status!=='drafting'||!pending||pending.uid!==user.uid||pending.club!==club)throw new Error('Seçim sırası değişti; tekrar kontrol et.');
   if(isActionLocked(d))throw new Error('Çark sonucu penceresi kapanana kadar beklemelisin.');
   if(d.memberOrder?.[d.turnIndex%d.memberOrder.length]!==user.uid)throw new Error('Şu anda sıra sende değil.');
   const candidates=validPickCandidates(club,d.picks||[],user.uid,d.memberOrder||[]);
   const raw=candidates.find(p=>String(p.id)===String(playerId));
   if(!raw)throw new Error('Bu futbolcu artık seçilebilir değil. Listeyi yenile.');
   const picks=[...(d.picks||[])];
   const filled=new Set(picks.filter(x=>x.uid===user.uid).map(x=>Number(x.starterIndex)).filter(i=>Number.isInteger(i)&&i>=0&&i<11));
   const starterIndex=STARTER_POSITIONS.findIndex((pos,i)=>!filled.has(i)&&exactPos(raw)===pos.toLocaleLowerCase('tr-TR'));
   if(starterIndex<0)throw new Error('Bu futbolcu için uygun boş mevki bulunamadı.');
   const at=Date.now(),managerName=d.members?.[user.uid]?.name||'Menajer';
   const player={...normalizePlayer(raw),uid:user.uid,starter:true,starterIndex,selectedAt:at,autoSelected:false};
   picks.push(player);
   const done=(d.memberOrder||[]).every(id=>starterCount(picks,id)>=11);
   const pickAnnouncement={id:`${at}_${user.uid}_${player.id}`,uid:user.uid,managerName,club:player.club,playerName:player.name,position:player.position,at,automatic:false};
   const updates={picks,pendingPick:null,turnIndex:nextTurnIndex(d.memberOrder||[],picks,d.turnIndex),turnStartedAt:at,lastPickAnnouncement:pickAnnouncement,actionLock:{id:pickAnnouncement.id,kind:'pick',startedAt:at,until:at+3000},updatedAt:serverTimestamp()};
   if(done){updates.status='finished';updates.postDraftPhase='protection';updates.protectionDone={};updates.swapRequests=[];updates.swapConfirmed={};updates.swapResolved=false;}
   tx.update(roomRef,updates);
  });
 }catch(e){msg(e.message||'Oyuncu seçilemedi.',true);}
}
function closePostDraftModal(){const modal=$('postDraftModal');if(modal)modal.remove();postDraftModalStage=null;}
function makePostDraftModal(stage,title,subtitle){
 let modal=$('postDraftModal');
 if(modal&&modal.dataset.stage===stage)return modal;
 if(modal)modal.remove();
 modal=document.createElement('div');modal.id='postDraftModal';modal.dataset.stage=stage;postDraftModalStage=stage;
 modal.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(2,6,23,.82);display:flex;align-items:center;justify-content:center;padding:16px;';
 modal.innerHTML=`<section style="width:min(760px,100%);max-height:92vh;overflow:auto;background:#101827;color:#f8fafc;border:1px solid #475569;border-radius:18px;padding:20px;box-shadow:0 24px 80px #0009"><h2 style="margin:0 0 8px">${esc(title)}</h2><p style="color:#cbd5e1;margin:0 0 16px">${esc(subtitle)}</p><div class="post-draft-modal-content"></div></section>`;
 document.body.append(modal);return modal;
}
function syncPostDraftModal(){
 if(!room||room.status!=='finished'||!user)return;
 const phase=room.postDraftPhase||'protection';
 if(phase==='tactics'&&!room.tacticsConfirmed?.[user.uid]){if(!$('postDraftModal')||$('postDraftModal').dataset.stage!=='tactics')chooseTactics();}
 else if(phase==='protection'&&!room.protectionDone?.[user.uid]){if(!$('postDraftModal')||$('postDraftModal').dataset.stage!=='protection')protectPlayer();}
 else if(phase==='swaps'&&!room.swapConfirmed?.[user.uid]){if(!$('postDraftModal')||$('postDraftModal').dataset.stage!=='swaps')swapPlayer();}
 else if(phase==='complete'&&room.swapResolved&&room.swapResults){showSwapReport(room);}
 else if($('postDraftModal'))closePostDraftModal();
}
async function protectPlayer(){
 if(!room||room.status!=='finished'||(room.postDraftPhase||'protection')!=='protection'||room.protectionDone?.[user.uid])return;
 try{
  const mine=myPicks().slice().sort((a,b)=>Number(a.starterIndex)-Number(b.starterIndex));
  const secretRef=doc(db,'roomSecrets',`${roomId}_${user.uid}`),snap=await getDoc(secretRef);
  const prior=[...new Set(snap.exists()?snap.data().protectedIds||[]:[])].filter(id=>mine.some(p=>p.id===id));
  const available=Math.max(0,Math.min(3,rightsFor('protectionRights'))-prior.length);
  const modal=makePostDraftModal('protection','Korunacak futbolcularını seç',`Koruma hakkın: ${rightsFor('protectionRights')}. En fazla ${available} yeni futbolcu seçebilirsin.`);
  const content=modal.querySelector('.post-draft-modal-content');
  let selected=new Set(prior);
  content.innerHTML=`<div style="display:grid;gap:8px">${mine.map((p,i)=>{const locked=prior.includes(p.id);return `<button type="button" data-protect-id="${esc(p.id)}" style="display:flex;gap:12px;align-items:center;text-align:left;padding:12px;border-radius:12px;border:1px solid ${locked?'#22c55e':'#475569'};background:${locked?'#14532d':'#1e293b'};color:#fff"><span style="font-weight:800;color:#93c5fd">${String(i+1).padStart(2,'0')}</span><span style="flex:1"><b>${esc(p.name)}</b><small style="display:block;color:#cbd5e1">${esc(p.position)} · ${esc(p.club||'')}</small></span><span class="protect-mark">${locked?'✓ KORUNDU':''}</span></button>`}).join('')}</div><p id="protectCount" style="color:#cbd5e1;margin:12px 0">Seçilen: ${prior.length}/${Math.min(3,rightsFor('protectionRights'))}</p><button type="button" id="confirmProtectionModal" class="btn primary" style="width:100%;padding:14px;font-weight:800">Onayla</button>`;
  const refresh=()=>{content.querySelectorAll('[data-protect-id]').forEach(b=>{const id=b.dataset.protectId,on=selected.has(id),locked=prior.includes(id);b.style.borderColor=on?'#22c55e':'#475569';b.style.background=on?'#14532d':'#1e293b';b.querySelector('.protect-mark').textContent=on?'✓ KORUNDU':'';b.disabled=locked});const count=selected.size-prior.length;content.querySelector('#protectCount').textContent=`Seçilen yeni futbolcu: ${count}/${available}`};
  content.querySelectorAll('[data-protect-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.protectId;if(selected.has(id)){if(!prior.includes(id))selected.delete(id)}else if(selected.size-prior.length<available)selected.add(id);else{msg(`En fazla ${available} yeni futbolcu seçebilirsin.`,true);return}refresh()});
  content.querySelector('#confirmProtectionModal').onclick=()=>finishProtectionSelection([...selected].filter(id=>!prior.includes(id)));
  refresh();
 }catch(e){msg('Koruma penceresi açılamadı: '+e.message,true)}
}
async function finishProtectionSelection(selectedOverride=null){
 try{
  const modal=$('postDraftModal');const selected=selectedOverride||[];
  const secretRef=doc(db,'roomSecrets',`${roomId}_${user.uid}`),latest=await getDoc(secretRef);
  const mine=myPicks(),myIds=new Set(mine.map(p=>p.id));const prior=[...new Set(latest.exists()?latest.data().protectedIds||[]:[])].filter(id=>myIds.has(id));
  const chosen=[...new Set(selected)].filter(id=>myIds.has(id)&&!prior.includes(id));
  const available=Math.max(0,Math.min(3,rightsFor('protectionRights'))-prior.length);
  if(chosen.length>available)throw new Error('Koruma hakkından fazla futbolcu seçildi.');
  if(chosen.length||prior.length)await setDoc(secretRef,{roomId,uid:user.uid,protectedIds:[...prior,...chosen],updatedAt:Date.now()},{merge:true});
  let all=false;
  await runTransaction(db,async tx=>{const snap=await tx.get(roomRef);if(!snap.exists())throw new Error('Oda bulunamadı.');const d=snap.data();if(d.status!=='finished'||(d.postDraftPhase||'protection')!=='protection')throw new Error('Koruma aşaması açık değil.');if(d.protectionDone?.[user.uid])throw new Error('Koruma seçimini zaten tamamladın.');const done={...(d.protectionDone||{}),[user.uid]:true};all=(d.memberOrder||[]).every(id=>done[id]);tx.update(roomRef,{protectionDone:done,postDraftPhase:all?'swaps':'protection',updatedAt:serverTimestamp()})});
  closePostDraftModal();msg(`Koruma onaylandı. ${prior.length+chosen.length} futbolcu korumalı.`+(all?' Takas aşaması açılıyor.':' Diğer oyuncular bekleniyor.'));
 }catch(e){msg(e.message||'Koruma aşaması tamamlanamadı.',true)}
}
async function swapPlayer(){
 if(!room||room.status!=='finished'||room.postDraftPhase!=='swaps'||room.swapConfirmed?.[user.uid])return;
 const modal=makePostDraftModal('swaps','Takaslarını seç','Rakip kadrosundan bir futbolcu seç. Aynı mevkideki kendi futbolcun otomatik eşleşir.');
 const content=modal.querySelector('.post-draft-modal-content');
 const mine=myPicks().slice().sort((a,b)=>Number(a.starterIndex)-Number(b.starterIndex));
 const available=Math.max(0,Math.min(3,rightsFor('swapRights')));
 let requests=[];
 const allPicks=room.picks||[];
 const roster=(uid)=>allPicks.filter(p=>p.uid===uid).sort((a,b)=>Number(a.starterIndex)-Number(b.starterIndex));
 const render=()=>{
  const selectedTargets=new Set(requests.map(r=>r.targetId)),selectedOwn=new Set(requests.map(r=>r.ownId));
  const opponentSections=(room.memberOrder||[]).filter(uid=>uid!==user.uid).map(uid=>{const team=roster(uid);return `<section style="border:1px solid #334155;border-radius:12px;padding:12px;margin-bottom:12px"><h3 style="margin:0 0 8px">${esc(userName(uid))}</h3><div style="display:grid;gap:6px">${team.map(p=>{const used=selectedTargets.has(p.id),eligible=mine.some(x=>x.position===p.position&&!selectedOwn.has(x.id));return `<button type="button" data-target-id="${esc(p.id)}" ${used||!eligible||requests.length>=available?'disabled':''} style="display:flex;align-items:center;gap:10px;text-align:left;padding:9px;border-radius:9px;border:1px solid ${used?'#22c55e':'#475569'};background:${used?'#14532d':'#1e293b'};color:#fff;opacity:${used||!eligible||requests.length>=available?'.55':'1'}"><span style="flex:1"><b>${esc(p.name)}</b><small style="display:block;color:#cbd5e1">${esc(p.position)} · ${esc(p.club||'')}</small></span><span>${used?'SEÇİLDİ':eligible?'⇄ Seç':'Mevki uygun değil'}</span></button>`}).join('')}</div></section>`}).join('');
  const summary=requests.length?`<div style="border:1px solid #334155;border-radius:12px;padding:12px;margin:12px 0"><h3 style="margin:0 0 8px">Oluşturulan takaslar (${requests.length}/${available})</h3>${requests.map((r,i)=>`<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #334155"><span>${i+1}. ${esc(r.targetName)} (${esc(r.position)}) ⇄ <b>${esc(r.ownName)}</b></span><button type="button" data-remove-swap="${i}" class="btn secondary" style="padding:5px 9px">Kaldır</button></div>`).join('')}</div>`:'';
  content.innerHTML=`<p style="color:#cbd5e1">Kullanılabilir takas hakkı: ${available}. Bir rakip oyuncuya tıklayınca aynı mevkideki kendi kadronun ilk uygun oyuncusu otomatik seçilir.</p>${opponentSections||'<p>Rakip kadro bulunamadı.</p>'}${summary}<button type="button" id="confirmSwapModal" class="btn primary" style="width:100%;padding:14px;font-weight:800">Onayla</button>`;
  content.querySelectorAll('[data-target-id]').forEach(b=>b.onclick=()=>{const target=allPicks.find(p=>p.id===b.dataset.targetId);if(!target||requests.length>=available)return;const own=mine.find(p=>p.position===target.position&&!selectedOwn.has(p.id));if(!own){msg('Bu mevki için kullanılabilir kendi futbolcun yok.',true);return}requests.push({id:`${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,fromUid:user.uid,ownId:own.id,ownName:own.name,targetId:target.id,targetName:target.name,targetUid:target.uid,position:target.position,createdAt:Date.now()});render()});
  content.querySelectorAll('[data-remove-swap]').forEach(b=>b.onclick=()=>{requests.splice(Number(b.dataset.removeSwap),1);render()});
  content.querySelector('#confirmSwapModal').onclick=()=>confirmMySwaps(requests);
 };
 render();
}
async function confirmMySwaps(requestsOverride=[]){
 try{
  let all=false;
  await runTransaction(db,async tx=>{const snap=await tx.get(roomRef),d=snap.data();if(d.status!=='finished'||d.postDraftPhase!=='swaps')throw new Error('Takas aşaması açık değil.');if(d.swapConfirmed?.[user.uid])throw new Error('Takaslarını zaten onayladın.');const rights=Math.max(0,Math.min(3,Number(d.swapRights?.[user.uid]||0)));if(requestsOverride.length>rights)throw new Error('Takas hakkından fazla seçim yaptın.');const picks=d.picks||[];const accepted=requestsOverride.map(r=>{const own=picks.find(p=>p.id===r.ownId),target=picks.find(p=>p.id===r.targetId);if(!own||!target||own.uid!==user.uid||target.uid===user.uid||own.position!==target.position)throw new Error('Takas eşleşmesi geçersiz. Lütfen yeniden seç.');return {...r,fromUid:user.uid,ownName:own.name,targetName:target.name,targetUid:target.uid,position:target.position}});const existing=(d.swapRequests||[]).filter(r=>r.fromUid!==user.uid);const confirmed={...(d.swapConfirmed||{}),[user.uid]:true};all=(d.memberOrder||[]).every(id=>confirmed[id]);tx.update(roomRef,{swapRequests:[...existing,...accepted],swapConfirmed:confirmed,updatedAt:serverTimestamp()})});
  closePostDraftModal();msg(all?'Herkes takaslarını onayladı. Sonuçlar hesaplanıyor.':'Takasların onaylandı; diğer oyuncular bekleniyor.');if(all)await resolveSwaps();
 }catch(e){msg(e.message||'Takaslar onaylanamadı.',true)}
}
async function resolveSwaps(){
 const q=query(collection(db,'roomSecrets'),where('roomId','==',roomId)),secrets=await getDocs(q);
 const protectedIds=new Set(secrets.docs.flatMap(d=>d.data().protectedIds||[]));
 const protectedByUid={};for(const d of secrets.docs){const uid=d.data().uid||d.id.slice(String(roomId).length+1);protectedByUid[uid]=d.data().protectedIds||[]}
 await runTransaction(db,async tx=>{
  const snap=await tx.get(roomRef),d=snap.data();if(d.postDraftPhase!=='swaps'||d.swapResolved)return;if(!(d.memberOrder||[]).every(id=>d.swapConfirmed?.[id]))throw new Error('Tüm oyuncular henüz onaylamadı.');
  const requests=d.swapRequests||[],uses={};for(const r of requests){uses[r.ownId]=(uses[r.ownId]||0)+1;uses[r.targetId]=(uses[r.targetId]||0)+1}
  const picks=[...(d.picks||[])],rights={...(d.swapRights||{})};for(const uid of d.memberOrder){const n=requests.filter(r=>r.fromUid===uid).length;rights[uid]=Math.max(0,Number(rights[uid]||0)-n)}
  const conflicted=new Set(Object.entries(uses).filter(([,n])=>n>1).map(([id])=>id));const byId=new Map(picks.map(p=>[p.id,p]));
  const outcomes=requests.map(r=>{let reason='';if(conflicted.has(r.ownId)||conflicted.has(r.targetId))reason='Oyuncu birden fazla takas talebinde kullanıldı';else if(protectedIds.has(r.targetId))reason='Rakip futbolcu korumalı';else if(!byId.has(r.ownId)||!byId.has(r.targetId))reason='Futbolcu bulunamadı';else if(byId.get(r.ownId).uid!==r.fromUid||byId.get(r.targetId).uid!==r.targetUid)reason='Takım sahipliği değişti';else if(byId.get(r.ownId).position!==byId.get(r.targetId).position)reason='Mevkiler eşleşmiyor';return {...r,ownName:byId.get(r.ownId)?.name||r.ownName||'Bilinmeyen',targetName:byId.get(r.targetId)?.name||r.targetName||'Bilinmeyen',fromName:d.members?.[r.fromUid]?.name||'Menajer',targetOwnerName:d.members?.[r.targetUid]?.name||'Menajer',status:reason?'failed':'success',reason}});
  const usedPlayers=new Set(),actual=[];for(const r of outcomes){if(r.status!=='success')continue;if(usedPlayers.has(r.ownId)||usedPlayers.has(r.targetId)){r.status='failed';r.reason='Başka bir takasla çakıştı';continue}usedPlayers.add(r.ownId);usedPlayers.add(r.targetId);actual.push(r)}
  for(const r of actual){const a=picks.findIndex(p=>p.id===r.ownId),b=picks.findIndex(p=>p.id===r.targetId);const oldA=picks[a],oldB=picks[b];picks[a]={...oldA,uid:oldB.uid,starterIndex:oldB.starterIndex,starter:oldB.starter};picks[b]={...oldB,uid:oldA.uid,starterIndex:oldA.starterIndex,starter:oldA.starter}}
  const protectedSummary=[];for(const uid of d.memberOrder||[]){const ids=protectedByUid[uid]||[];protectedSummary.push({uid,name:d.members?.[uid]?.name||'Menajer',players:ids.map(id=>byId.get(id)?.name).filter(Boolean)})}
  tx.update(roomRef,{picks,swapRights:rights,postDraftPhase:'tactics',tacticsConfirmed:{},tactics:{...(d.tactics||{})},swapResolved:true,swapResults:{requested:requests.length,completed:actual.length,cancelled:outcomes.filter(r=>r.status!=='success').length,completedIds:actual.map(r=>r.id),outcomes,protectedSummary,completedAt:Date.now()},updatedAt:serverTimestamp()});
 });
}
function renderPersistentSwapReport(){
 const host=$('persistentSwapReport');if(!host)return;
 const result=room?.swapResults;
 if(!result){host.innerHTML='<div class="empty-state">Koruma ve takas raporu henüz oluşturulmadı. Draft tamamlanıp takas aşaması sonuçlandığında rapor burada kalıcı olarak görünecek.</div>';return;}
 const protectedHtml=(result.protectedSummary||[]).map(x=>`<div class="fixture"><b>${esc(x.name||'Menajer')}</b><p class="muted" style="margin:6px 0 0">${x.players?.length?x.players.map(esc).join(', '):'Korunan futbolcu yok'}</p></div>`).join('');
 const outcomes=(result.outcomes||[]).map((r,i)=>`<div class="fixture" style="padding:10px;border-radius:10px;margin:7px 0;background:${r.status==='success'?'#14532d':'#7f1d1d'};border:1px solid ${r.status==='success'?'#22c55e':'#ef4444'};color:#fff"><div class="fixture-meta" style="color:#fff">${r.status==='success'?'✓ BAŞARILI':'✕ BAŞARISIZ'} · TAKAS ${i+1}</div><div><b>${esc(r.targetName||'Bilinmeyen')}</b> (${esc(r.position||'')}) ⇄ <b>${esc(r.ownName||'Bilinmeyen')}</b></div><p style="color:#e2e8f0;margin:6px 0 0">${esc(r.fromName||'Menajer')} ↔ ${esc(r.targetOwnerName||'Menajer')}${r.reason?' · '+esc(r.reason):''}</p></div>`).join('');
 const completed=result.completedAt?new Date(result.completedAt).toLocaleString('tr-TR'):'—';
 host.innerHTML=`<div class="stats-grid"><div class="stat"><small>TALEP</small><b>${Number(result.requested||0)}</b></div><div class="stat"><small>BAŞARILI</small><b>${Number(result.completed||0)}</b></div><div class="stat"><small>BAŞARISIZ</small><b>${Number(result.cancelled||0)}</b></div><div class="stat"><small>RAPOR TARİHİ</small><b style="font-size:.9rem">${esc(completed)}</b></div></div><h3>Korunan futbolcular</h3><div class="fixtures">${protectedHtml||'<div class="empty-state">Koruma kaydı bulunamadı.</div>'}</div><h3 style="margin-top:20px">Takas sonuçları</h3><div class="fixtures">${outcomes||'<div class="empty-state">Herhangi bir takas talebi oluşturulmadı.</div>'}</div>`;
}
async function chooseTactics(){
 if(!room||room.status!=='finished'||room.postDraftPhase!=='tactics'||room.tacticsConfirmed?.[user.uid])return;
 const current=room.tactics?.[user.uid]||{};
 const modal=makePostDraftModal('tactics','Taktik, pas odağı ve pres türü','Lig başlamadan önce her kategoriden bir seçim yap. Bonus ve cezalar yalnızca ilgili gol kuralının karşılaştırma değerini etkiler.');
 const content=modal.querySelector('.post-draft-modal-content');
 content.innerHTML=`<label style="display:block;margin:12px 0 6px;font-weight:700">Taktik</label><select id="teamTactic" class="input" style="width:100%;padding:12px;border-radius:8px;background:#1e293b;color:#fff"><option value="defensive">Defansif</option><option value="balanced">Dengeli</option><option value="attacking">Hücumcu</option></select><label style="display:block;margin:16px 0 6px;font-weight:700">Pas odağı</label><select id="teamPassFocus" style="width:100%;padding:12px;border-radius:8px;background:#1e293b;color:#fff"><option value="shortPass">Kısa pas</option><option value="wingPlay">Kanat oyunu</option><option value="longBall">Savunmadan Uzun Top</option></select><label style="display:block;margin:16px 0 6px;font-weight:700">Pres türü</label><select id="teamPressType" style="width:100%;padding:12px;border-radius:8px;background:#1e293b;color:#fff"><option value="highPress">Önde Pres</option><option value="midBlock">Orta Blok Pres</option><option value="deepBlock">Geride Pres</option></select><p style="color:#cbd5e1;font-size:.9rem;margin:14px 0">Bonus ve cezalar yalnızca ilgili kuralın karşılaştırma değerine uygulanır. Örneğin Defansif + Savunmadan Uzun Top = +25 DEF; rakibin Önde Pres tercihi varsa savunma karşılaştırmanızdan ayrıca 10 DEF düşer.</p><button id="confirmTactics" class="btn primary" style="width:100%">Seçimlerimi onayla</button><p id="tacticsWaiting" style="color:#cbd5e1;text-align:center;margin-top:10px"></p>`
 content.querySelector('#teamTactic').value=current.tactic||'balanced';content.querySelector('#teamPassFocus').value=current.passFocus||'shortPass';content.querySelector('#teamPressType').value=current.pressType||'midBlock';
 content.querySelector('#confirmTactics').onclick=async()=>{const tactic=content.querySelector('#teamTactic').value,passFocus=content.querySelector('#teamPassFocus').value,pressType=content.querySelector('#teamPressType').value;const btn=content.querySelector('#confirmTactics');btn.disabled=true;btn.textContent='Kaydediliyor…';try{let all=false;await runTransaction(db,async tx=>{const snap=await tx.get(roomRef),d=snap.data();if(d.postDraftPhase!=='tactics')throw new Error('Taktik seçimi aşaması açık değil.');if(d.tacticsConfirmed?.[user.uid])throw new Error('Seçimlerini zaten onayladın.');const tactics={...(d.tactics||{}),[user.uid]:{tactic,passFocus,pressType}},confirmed={...(d.tacticsConfirmed||{}),[user.uid]:true};all=(d.memberOrder||[]).every(id=>confirmed[id]);tx.update(roomRef,{tactics,tacticsConfirmed:confirmed,postDraftPhase:all?'complete':'tactics',updatedAt:serverTimestamp()})});closePostDraftModal();msg(all?'Tüm takımlar taktiklerini onayladı. Lig aşamasına geçebilirsiniz.':'Taktiklerin kaydedildi. Diğer oyuncuların onayı bekleniyor.');}catch(e){btn.disabled=false;btn.textContent='Seçimlerimi onayla';msg(e.message||'Taktikler kaydedilemedi.',true)}};
}
function showSwapReport(currentRoom){
 const result=currentRoom?.swapResults;if(!result)return;const reportId=`${currentRoom.id||roomId}_${result.completedAt||'done'}`;if(lastSwapReportShown===reportId)return;lastSwapReportShown=reportId;closePostDraftModal();
 const modal=makePostDraftModal('results','Koruma ve takas sonuçları','Bu özet 10 saniye içinde kapanacak.');const content=modal.querySelector('.post-draft-modal-content');
 const protectedHtml=(result.protectedSummary||[]).map(x=>`<div style="padding:8px 0;border-bottom:1px solid #334155"><b>${esc(x.name)}</b><small style="display:block;color:#cbd5e1">${x.players.length?x.players.map(esc).join(', '):'Korunan futbolcu yok'}</small></div>`).join('');
 const outcomes=(result.outcomes||[]).map((r,i)=>`<div style="padding:10px;border-radius:10px;margin:7px 0;background:${r.status==='success'?'#14532d':'#7f1d1d'}"><b>${r.status==='success'?'✓ Başarılı':'✕ Başarısız'} · ${i+1}</b><div>${esc(r.targetName||'Bilinmeyen')} (${esc(r.position||'')}) ⇄ ${esc(r.ownName||'Bilinmeyen')}</div><small>${esc(r.fromName||'Menajer')} ↔ ${esc(r.targetOwnerName||'Menajer')}${r.reason?' · '+esc(r.reason):''}</small></div>`).join('');
 content.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px"><div style="padding:10px;background:#1e293b;border-radius:10px"><small>Talep</small><h3>${Number(result.requested||0)}</h3></div><div style="padding:10px;background:#14532d;border-radius:10px"><small>Başarılı</small><h3>${Number(result.completed||0)}</h3></div><div style="padding:10px;background:#7f1d1d;border-radius:10px"><small>Başarısız</small><h3>${Number(result.cancelled||0)}</h3></div></div><h3>Korunan futbolcular</h3>${protectedHtml||'<p>Koruma kaydı bulunamadı.</p>'}<h3 style="margin-top:16px">Takas sonuçları</h3>${outcomes||'<p>Herhangi bir takas talebi oluşturulmadı.</p>'}<p id="reportCountdown" style="color:#cbd5e1;text-align:center;margin-top:14px">10 saniye içinde kapanacak…</p><button id="closeSwapReport" class="btn primary" style="width:100%">Kapat</button>`;
 let remaining=10;const counter=content.querySelector('#reportCountdown');const interval=setInterval(()=>{remaining--;if(counter)counter.textContent=remaining>0?`${remaining} saniye içinde kapanacak…`:'Kapanıyor…';if(remaining<=0){clearInterval(interval);if($('postDraftModal')===modal)closePostDraftModal()}},1000);content.querySelector('#closeSwapReport').onclick=()=>{clearInterval(interval);closePostDraftModal()};
}
async function startDraft(){try{await runTransaction(db,async tx=>{const s=await tx.get(roomRef),d=s.data();if(!(isAdmin()||d.ownerUid===user.uid))throw new Error('Yalnızca oda sahibi veya admin başlatabilir.');if(d.memberOrder.length<2)throw new Error('En az iki oyuncu gerekli.');if(d.status!=='waiting')throw new Error('Oyun zaten başladı.');const shuffled=[...d.memberOrder];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}const protectionRights={},protectionRightsEarned={},swapRights={},swapRightsEarned={};for(const uid of shuffled){protectionRights[uid]=0;protectionRightsEarned[uid]=0;swapRights[uid]=0;swapRightsEarned[uid]=0;}tx.update(roomRef,{status:'drafting',memberOrder:shuffled,turnIndex:0,turnStartedAt:Date.now(),picks:[],pendingPick:null,draftStage:'starter',protectionRights,protectionRightsEarned,swapRights,swapRightsEarned,lastPickAnnouncement:null,updatedAt:serverTimestamp()})});msg('Draft başladı! Herkes 0 koruma ve 0 takas hakkıyla başladı. Her hak türünün üst sınırı 3.')}catch(e){msg(e.message,true)}}
function renderSquad(){
 const allPicks=room?.picks||[],squad=myPicks(),formation=$('formation');
 formation.value='4-2-3-1';formation.disabled=true;
 const myCount=starterCount(allPicks,user?.uid);$('squadCount').textContent=`${myCount}/11 · %${Math.round(myCount/11*100)}`;$('startingSquad').innerHTML='';
 $('benchSquad').innerHTML='';$('benchSquad').closest('div')?.classList.add('hidden');
 const slots=formationSlots();
 for(let i=0;i<11;i++){const p=squad.find(x=>Number(x.starterIndex)===i);const div=document.createElement('div');div.className='squad-slot';div.innerHTML=`<span class="slot-num">${String(i+1).padStart(2,'0')}</span><span class="slot-pos">${slots[i]}</span><span class="slot-player">${p?`${esc(p.name)} <small>${esc(p.club)}</small>`:'Henüz seçilmedi'}</span>`;$('startingSquad').append(div)}
 const members=room?.memberOrder||[];const completed=members.filter(uid=>starterCount(allPicks,uid)>=11).length;
 const progressLabel=$('allSquadsProgress');if(progressLabel)progressLabel.textContent=`${completed}/${members.length} kadro tamamlandı`;
 const list=$('opponentSquads');if(!list)return;
 const others=members.filter(uid=>uid!==user?.uid);
 if(!others.length){list.innerHTML='<div class="empty-state">Henüz rakip oyuncu yok.</div>';return}
 list.innerHTML=others.map(uid=>{const count=starterCount(allPicks,uid),pct=Math.round(count/11*100),team=allPicks.filter(p=>p.uid===uid).sort((a,b)=>Number(a.starterIndex)-Number(b.starterIndex));const rosterRows=slots.map((pos,i)=>{const player=team.find(p=>Number(p.starterIndex)===i);return `<div class="opponent-player ${player?'filled':''}"><span class="opponent-pos">${esc(pos)}</span><span class="opponent-name">${player?esc(player.name):'Henüz seçilmedi'}</span>${player?`<small>${esc(player.club||'')}</small>`:''}</div>`}).join('');return `<section class="opponent-team-card"><div class="opponent-team-head"><div><b>${esc(userName(uid))}</b><small>${count}/11 oyuncu · %${pct} dolu</small></div><strong>${count}/11</strong></div><div class="progress opponent-progress"><i style="width:${pct}%"></i></div><div class="opponent-roster">${rosterRows}</div></section>`}).join('');
}

function statValue(value, suffix=''){
  if(value===null||value===undefined||value===''||value==='—'||!Number.isFinite(Number(value)))return '—';
  const n=Number(value);
  return `${suffix==='%'?Math.round(n):Number(n.toFixed(2))}${suffix}`;
}
function firstStat(obj, keys){
  for(const key of keys){const value=obj?.[key];if(value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value)))return Number(value)}
  return null;
}
function possessionPair(r){
  let h=firstStat(r,['homePossession','homePossessionPct','homePossessionPercent','possessionHome','homePossessionPercentage']);
  let a=firstStat(r,['awayPossession','awayPossessionPct','awayPossessionPercent','possessionAway','awayPossessionPercentage']);
  if(h===null&&a!==null)h=100-a;if(a===null&&h!==null)a=100-h;
  if(h===null&&a===null)return ['—','—'];
  if(h===null)h=100-a;if(a===null)a=100-h;
  h=Math.max(0,Math.min(100,h));a=Math.max(0,Math.min(100,a));
  const total=h+a;if(total>0&&Math.abs(total-100)>0.5){h=Math.round(h/total*100);a=100-h}else{h=Math.round(h);a=Math.round(a)}
  return [h,a];
}
function passAccuracyPair(r){
  let h=firstStat(r,['homePassAccuracy','homePassAccuracyPct','homePassAccuracyPercent','homePassCompletion','passAccuracyHome']);
  let a=firstStat(r,['awayPassAccuracy','awayPassAccuracyPct','awayPassAccuracyPercent','awayPassCompletion','passAccuracyAway']);
  if(h===null)h=firstStat(r,['homePassesCompleted','homePassesAccurate']);
  if(a===null)a=firstStat(r,['awayPassesCompleted','awayPassesAccurate']);
  if(h===null&&a===null)return ['—','—'];
  if(h===null)h=100-a;if(a===null)a=100-h;
  return [Math.max(0,Math.min(100,Math.round(h))),Math.max(0,Math.min(100,Math.round(a)))];
}
let dismissedMatchReportId=null;
let lastSwapReportShown=null;
let postDraftModalStage=null;
function renderMatchReport(live,league){const box=$('matchReport');if(!box)return;if(!live||live.status!=='finished'){box.classList.add('hidden');return}const currentReportId=live.fixtureId||`${live.homeUid||live.homeName}-${live.awayUid||live.awayName}-${live.finishedAt||''}`;if(dismissedMatchReportId===currentReportId){box.classList.add('hidden');return}box.classList.remove('hidden');box.classList.add('match-report-modal');const r=live.stats||(live.fixtureId?(league?.results||{})[live.fixtureId]:null);if(!r){box.innerHTML='<div class="empty-state">Maç özeti bulunamadı.</div>';return}const goals=(r.events||[]).filter(e=>e.type==='goal').sort((a,b)=>a.minute-b.minute);const teamName=e=>e.team===live.homeUid?live.homeName:e.team===live.awayUid?live.awayName:'';const auditRows=(r.ruleAudit||[]).map(a=>`<tr><td>${esc(a.rule)}</td><td>${esc(a.homeValue)}</td><td>${esc(a.awayValue)}</td><td>${esc(a.homeEffects||'')}</td><td>${esc(a.awayEffects||'')}</td><td>${esc(a.winner||'Gol yok')}</td></tr>`).join('');const tactics=r.tacticsApplied?`<p class="muted"><b>Taktikler:</b> ${esc(live.homeName)} — ${esc(r.tacticsApplied.home.tactic)} / ${esc(r.tacticsApplied.home.passFocus)} / ${esc(r.tacticsApplied.home.pressType)} · ${esc(live.awayName)} — ${esc(r.tacticsApplied.away.tactic)} / ${esc(r.tacticsApplied.away.passFocus)} / ${esc(r.tacticsApplied.away.pressType)}</p>`:'';box.innerHTML=`<button type="button" class="match-report-close" aria-label="Maç özetini kapat">×</button><div class="eyebrow">ÇARK FUTBOL · MAÇ ÖZETİ</div><div class="match-report-head"><h2>${esc(live.homeName)} ${r.homeGoals} – ${r.awayGoals} ${esc(live.awayName)}</h2><div class="live-score"><span>${r.homeGoals}</span><i>–</i><span>${r.awayGoals}</span></div></div>${tactics}<h3>Gol kuralı ve bonus dökümü</h3><div style="overflow-x:auto"><table><thead><tr><th>Kural</th><th>${esc(live.homeName)} puanı</th><th>${esc(live.awayName)} puanı</th><th>${esc(live.homeName)} etkileri</th><th>${esc(live.awayName)} etkileri</th><th>Gol kazananı</th></tr></thead><tbody>${auditRows||'<tr><td colspan="6">Bu maç eski sürümde oynanmış; kural dökümü kayıtlı değil.</td></tr>'}</tbody></table></div><h3>Goller</h3><div class="arena-event-list">${goals.map(e=>`<div class="arena-event"><b>${e.minute}'</b><span>⚽ ${esc(e.playerName||'Bilinmeyen oyuncu')}</span><small>${esc(teamName(e))} · ${esc(e.reason||'')}</small></div>`).join('')||'<p class="muted">Gol olmadı.</p>'}</div>`;box.querySelector('.match-report-close').onclick=()=>{dismissedMatchReportId=currentReportId;box.classList.add('hidden')};}
function renderLeague(){if(!room)return;const league=room.league||{},fixtures=league.fixtures||[],results=league.results||{};renderMatchReport(league.liveMatch,league);const played=fixtures.filter(m=>results[m.id]).length;$('leagueName').value=league.name||'Çark Futbol Ligi';$('createFixturesBtn').disabled=!(isAdmin()||room.ownerUid===user.uid)||room.status!=='finished'||room.postDraftPhase!=='complete'||fixtures.length>0;$('saveLeagueNameBtn').disabled=!(isAdmin()||room.ownerUid===user.uid);$('leagueStats').innerHTML=[['TAKIM',room.memberOrder.length],['TOPLAM MAÇ',fixtures.length||'—'],['OYNANAN',`${played}/${fixtures.length||0}`],['AŞAMA',played===fixtures.length&&fixtures.length?'Tamamlandı':played?'Devam ediyor':'Hazır değil']].map(([a,b])=>`<div class="stat"><small>${a}</small><b>${b}</b></div>`).join('');const rows=standings();$('standings').innerHTML=rows.length?`<table><thead><tr><th>#</th><th>Takım</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AG</th><th>YG</th><th>AV</th><th>P</th></tr></thead><tbody>${rows.map((t,i)=>`<tr class="${i===0&&played===fixtures.length&&fixtures.length?'champion':''}"><td>${i===0&&played===fixtures.length&&fixtures.length?'🏆':i+1}</td><td>${esc(t.name)}</td><td>${t.played}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${t.gf-t.ga}</td><td><b>${t.pts}</b></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">Lig puan tablosu için kadrolar tamamlanmalı.</div>';$('fixtureProgress').textContent=fixtures.length?`${played}/${fixtures.length} maç`:'Fikstür yok';if(!fixtures.length){$('fixtures').innerHTML='<div class="empty-state">İlk 11 tamamlandıktan sonra admin fikstürü oluşturabilir.</div>';return}const names=Object.fromEntries(rows.map(t=>[t.id,t.name]));$('fixtures').innerHTML=fixtures.map(m=>{const r=results[m.id];const adminCan=(isAdmin()||room.ownerUid===user.uid)&&!r;return `<div class="fixture"><div class="fixture-meta">${m.leg===1?'1. AŞAMA':'2. AŞAMA'} · ${m.round}. hafta</div><div class="fixture-main"><span>${esc(names[m.homeUid]||userName(m.homeUid))}</span><b>${r?`${r.homeGoals} – ${r.awayGoals}`:'vs'}</b><span>${esc(names[m.awayUid]||userName(m.awayUid))}</span></div>${r?`<button class="btn small secondary" data-open-report="${m.id}">Gol özeti</button>`:''}${adminCan?`<button class="btn small primary" data-sim="${m.id}">Maçı simüle et</button>`:''}</div>`}).join('');document.querySelectorAll('[data-sim]').forEach(b=>b.onclick=()=>simulateOne(b.dataset.sim));document.querySelectorAll('[data-open-report]').forEach(b=>b.onclick=()=>{const id=b.dataset.openReport,match=(room?.league?.fixtures||[]).find(x=>x.id===id),r=(room?.league?.results||{})[id];if(!match||!r){msg('Bu maçın raporu bulunamadı.',true);return}dismissedMatchReportId=null;const live={fixtureId:id,status:'finished',homeUid:match.homeUid,awayUid:match.awayUid,homeName:userName(match.homeUid),awayName:userName(match.awayUid),homeGoals:r.homeGoals,awayGoals:r.awayGoals,minute:90,stats:r};renderMatchReport(live,room.league);});}
async function createFixtures(){if(!room)return;const teams=room.memberOrder||[];if(room.status!=='finished'||room.postDraftPhase!=='complete'||teams.some(id=>starterCount(room.picks||[],id)!==11)){msg('Her oyuncunun 11 futbolcusu tamamlanmalı.',true);return}try{await runTransaction(db,async tx=>{const s=await tx.get(roomRef),d=s.data();if(d.league?.fixtures?.length)throw new Error('Fikstür zaten oluşturulmuş.');const fixtures=buildFixtures(d.memberOrder);tx.update(roomRef,{league:{name:$('leagueName').value.trim()||'Çark Futbol Ligi',fixtures,results:{},createdAt:Date.now()},updatedAt:serverTimestamp()})});msg('Çift devreli fikstür oluşturuldu.')}catch(e){msg(e.message,true)}}
async function simulateOne(id){try{await runTransaction(db,async tx=>{const snap=await tx.get(roomRef),d=snap.data();if(!(user.uid===ADMIN_UID||user.uid===d.ownerUid))throw new Error('Maçları yalnızca admin veya oda sahibi başlatabilir.');const league=d.league||{},m=(league.fixtures||[]).find(x=>x.id===id);if(!m)throw new Error('Maç bulunamadı.');if(league.results?.[id])throw new Error('Bu maç zaten oynandı.');const makeTeam=uid=>({id:uid,name:d.members?.[uid]?.name||'Menajer',squad:(d.picks||[]).filter(p=>p.uid===uid).map(p=>({...p,starter:p.starterIndex!==undefined&&p.starterIndex!==null})),...(d.tactics?.[uid]||{})});const home=makeTeam(m.homeUid),away=makeTeam(m.awayUid),result=simulateMatch(home,away),results={...(league.results||{}),[id]:{...result,playedAt:Date.now()}};tx.update(roomRef,{'league.results':results,'league.liveMatch':{fixtureId:id,status:'finished',homeUid:m.homeUid,awayUid:m.awayUid,homeName:home.name,awayName:away.name,homeGoals:result.homeGoals,awayGoals:result.awayGoals,minute:90,stats:result,finishedAt:Date.now()},updatedAt:serverTimestamp()})});msg('Maç tamamlandı. Skor ve gol özeti kaydedildi.')}catch(e){msg(e.message||'Maç simülasyonu sırasında hata oluştu.',true)}}
async function enterRoom(id,quiet=false){try{const ref=doc(db,'rooms',id);await runTransaction(db,async tx=>{const s=await tx.get(ref);if(!s.exists())throw new Error('Oda bulunamadı.');const d=s.data();if(!d.memberOrder.includes(user.uid)&&!isAdmin()){if(d.status!=='waiting')throw new Error('Bu oda başladı; yeni oyuncu katılamaz.');if(d.memberOrder.length>=d.capacity)throw new Error('Oda dolu.');tx.update(ref,{memberOrder:[...d.memberOrder,user.uid],members:{...d.members,[user.uid]:{name:profile.name||user.displayName||'Menajer',joinedAt:Date.now()}},updatedAt:serverTimestamp()})}});if(roomUnsub)roomUnsub();writeStored(RESUME_ROOM_KEY,id);lastWheelSpinAt=0;spinCooldownUntil=0;lastSpinAnnouncementId=null;lastPickAnnouncementId=null;roomSnapshotInitialized=false;roomId=id;roomRef=doc(db,'rooms',id);roomUnsub=onSnapshot(roomRef,s=>{if(s.exists()){const nextRoom={id:s.id,...s.data()};const isFirstSnapshot=!roomSnapshotInitialized;room=nextRoom;if(isFirstSnapshot){lastSpinAnnouncementId=nextRoom.lastSpinAnnouncement?.id||null;lastPickAnnouncementId=nextRoom.lastPickAnnouncement?.id||null;pendingSpinAnnouncementId=null;}else{const spinAnnouncement=nextRoom.lastSpinAnnouncement;if(spinAnnouncement?.id&&spinAnnouncement.id!==lastSpinAnnouncementId&&spinAnnouncement.id!==pendingSpinAnnouncementId)queueSpinAnnouncement(spinAnnouncement);const pickAnnouncement=nextRoom.lastPickAnnouncement;if(pickAnnouncement?.id&&pickAnnouncement.id!==lastPickAnnouncementId)showPickAnnouncement(pickAnnouncement);}roomSnapshotInitialized=true;renderRoom()}else{room=null;closeRoomUI()}},e=>msg(e.message,true));$('roomView').classList.remove('hidden');document.querySelectorAll('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.pane==='draftPane'));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('hidden',p.id!=='draftPane'));if(!quiet)msg('Odaya bağlandın.')}catch(e){if(!quiet)msg(e.message,true);else console.warn('Odaya yeniden bağlanılamadı:',e)}}
function closeRoomUI(){if(roomUnsub){roomUnsub();roomUnsub=null}room=null;roomId=null;roomRef=null;$('roomView').classList.add('hidden')}
async function closeAdminRoom(id){
 if(!isAdmin()){msg('Bu işlem yalnızca admin tarafından yapılabilir.',true);return}
 const target=rooms.find(r=>r.id===id);
 if(!target||!isLeagueSimulationComplete(target)){msg('Yalnızca lig simülasyonu tamamlanan odalar kapatılabilir.',true);return}
 if(!confirm(`“${target.name||'İsimsiz oda'}” odasının lig simülasyonu tamamlandı. Oda kapatılsın mı?`))return;
 try{
  await updateDoc(doc(db,'rooms',id),{status:'cancelled',closedAt:Date.now(),updatedAt:serverTimestamp()});
  if(roomId===id)closeRoomUI();
  msg('Tamamlanan oyun odası kapatıldı.');
 }catch(e){msg('Oda kapatılamadı: '+(e.message||e),true)}
}
async function closeRoom(){if(!isAdmin()||!roomRef||!room){msg('Odayı yalnızca admin kapatabilir.',true);return}if(!isLeagueSimulationComplete(room)){msg('Oda yalnızca lig simülasyonu tamamlandıktan sonra kapatılabilir.',true);return}if(!confirm('Lig simülasyonu tamamlanan bu oda kapatılsın mı?'))return;try{await updateDoc(roomRef,{status:'cancelled',closedAt:Date.now(),updatedAt:serverTimestamp()});closeRoomUI();msg('Oda admin tarafından kapatıldı.')}catch(e){msg('Oda kapatılamadı: '+e.message,true)}}
async function leaveRoom(){closeRoomUI();msg('Oda görünümünden çıktın. Oda üyeliğin korunur.');}
async function createRoom(e){
 e.preventDefault();
 if(!user?.uid||!user.emailVerified){msg('Oda oluşturmak için doğrulanmış e-posta ile giriş yapmalısın.',true);return}
 const btn=$('createRoomForm').querySelector('button[type="submit"],button:not([type])');
 let stage='oturum doğrulaması';
 if(btn){btn.disabled=true;btn.textContent='Oda oluşturuluyor…'}
 try{
  // Refresh the Firebase ID token so Firestore receives the current email_verified claim.
  await user.getIdToken(true);
  const name=$('roomName').value.trim(),capacity=Number($('roomCapacity').value);
  if(!name)throw new Error('Oda adı gir.');
  if(!Number.isInteger(capacity)||capacity<2||capacity>6)throw new Error('Oyuncu sayısı 2 ile 6 arasında olmalı.');
  let id='',exists=true;
  stage='oda kodu kontrolü';
  while(exists){
   id=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n=>String(n%10)).join('');
   const check=await getDocs(query(collection(db,'rooms'),where('code','==',id)));
   exists=!check.empty;
  }
  stage='oda kaydı';
  const ref=doc(collection(db,'rooms'));
  const data={name,code:id,capacity,ownerUid:user.uid,memberOrder:[user.uid],members:{[user.uid]:{name:profile.name||user.displayName||'Menajer',joinedAt:Date.now()}},status:'waiting',turnIndex:0,picks:[],pendingPick:null,actionLock:null,protectionRights:{},swapRights:{[user.uid]:0},protectionRightsEarned:{},swapRightsEarned:{[user.uid]:0},postDraftPhase:'protection',protectionDone:{},swapRequests:[],swapConfirmed:{},swapResolved:false,tactics:{},league:{name,fixtures:[],results:{}},createdAt:Date.now(),updatedAt:serverTimestamp()};
  await setDoc(ref,data);
  stage='odaya giriş';
  $('createRoomForm').reset();
  await enterRoom(ref.id);
  msg(`Oda oluşturuldu. Katılma kodu: ${id}`);
 }catch(e){
  console.error('Oda oluşturma aşaması:',stage,e);
  msg(`${stage} aşamasında hata: ${e.message||'Bilinmeyen hata'}`,true);
 }finally{
  if(btn){btn.disabled=false;btn.textContent='Oda Oluştur'}
 }
}
async function initDashboard(u){
 await authPersistenceReady;
 await reload(u);
 if(!u.emailVerified){
  user=null;profile=null;
  $('authView').classList.remove('hidden');$('appView').classList.add('hidden');
  throw new Error('E-posta adresin doğrulanmamış. Gelen kutundaki bağlantıyı onayladıktan sonra tekrar giriş yap.');
 }
 user=u;
 let p=null;
 if(u.uid!==ADMIN_UID){
  const snap=await getDoc(doc(db,'users',u.uid));
  if(!snap.exists())throw new Error('Hesap kaydın bulunamadı. Lütfen destek al.');
  p=snap.data();
 }
 profile=u.uid===ADMIN_UID?{name:'Arda',nickname:'Arda'}:p;
 $('authView').classList.add('hidden');$('appView').classList.remove('hidden');
 $('userBadge').textContent=profile.nickname||profile.name||u.email;
 $('logoutBtn').classList.remove('hidden');$('helloName').textContent=profile.nickname||profile.name||'Menajer';
 // Oda oluşturma tüm doğrulanmış kullanıcılar için açık.
 $('adminBox').classList.remove('hidden');$('newRoomBtn').classList.remove('hidden');
 if(roomsUnsub)roomsUnsub();
 roomsUnsub=onSnapshot(query(collection(db,'rooms'),where('status','in',['waiting','drafting','finished'])),snap=>{rooms=snap.docs.map(d=>({id:d.id,...d.data()}));renderRooms()},e=>{console.error(e);msg('Odalar okunamadı: '+e.message,true)});
}

async function loginAccount(e){
 e.preventDefault();const identifier=$('accountLoginEmail').value.trim(),password=$('accountLoginPassword').value;
 const submit=$('loginForm').querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Giriş yapılıyor…';authFlowInProgress=true;
 try{
  await authPersistenceReady;
  const response=await fetch(`${AUTH_WORKER_URL}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(result.error||'AUTH_SERVICE_UNAVAILABLE');if(result.error==='EMAIL_NOT_VERIFIED')error.code='auth/email-not-verified';else if(result.error==='INVALID_CREDENTIALS')error.code='auth/invalid-credential';throw error}
  if(!result.customToken)throw new Error('AUTH_SERVICE_UNAVAILABLE');
  const {signInWithCustomToken}=await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js');
  const credential=await signInWithCustomToken(auth,result.customToken);
  await initDashboard(credential.user);authMsg('Giriş başarılı. Hoş geldin '+(profile.nickname||profile.name||'Menajer')+'.');
 }catch(err){console.error('Giriş hatası:',err);authMsg(authErrorMessage(err),true);if(auth.currentUser){try{await signOut(auth)}catch{}}}
 finally{authFlowInProgress=false;submit.disabled=false;submit.textContent='GİRİŞ YAP'}
}

async function registerAccount(e){
 e.preventDefault();
 const nickname=$('registerNickname').value.trim(),nicknameLower=normalizeNickname(nickname),email=$('registerEmail').value.trim().toLowerCase(),password=$('registerPassword').value;
 if(!/^[A-Za-z0-9_]{3,16}$/.test(nickname)){authMsg('Kullanıcı adı 3–16 karakter olmalı; İngilizce harf, rakam ve alt çizgi kullanılabilir.',true);return}
 if(nicknameLower==='arda'){authMsg('Bu kullanıcı adı sistem tarafından ayrılmış.',true);return}
 if(password.length<6){authMsg('Şifre en az 6 karakter olmalı.',true);return}
 const submit=$('registerForm').querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Hesap oluşturuluyor…';authFlowInProgress=true;
 let credential=null,profileCreated=false;
 try{
  await authPersistenceReady;
  credential=await createUserWithEmailAndPassword(auth,email,password);
  const uid=credential.user.uid,usernameRef=doc(db,'usernames',nicknameLower),userRef=doc(db,'users',uid);
  await runTransaction(db,async tx=>{
   const existing=await tx.get(usernameRef);if(existing.exists())throw new Error('USERNAME_TAKEN');
   tx.set(usernameRef,{uid,nickname,nicknameLower,createdAt:serverTimestamp()});
   tx.set(userRef,{uid,email,nickname,name:nickname,nicknameLower,createdAt:serverTimestamp(),accountType:'player'});
  });
  profileCreated=true;
  await sendEmailVerification(credential.user,{url:EMAIL_ACTION_URL,handleCodeInApp:false});
  await signOut(auth);
  $('registerForm').reset();showAuthMode('login');
  authMsg('Hesabın oluşturuldu. '+email+' adresine doğrulama bağlantısı gönderdik. E-postanı doğruladıktan sonra giriş yapabilirsin.');
 }catch(err){
  console.error('Kayıt hatası:',err);authMsg(err.message==='USERNAME_TAKEN'?'Bu kullanıcı adı alınmış. Başka bir ad seç.':authErrorMessage(err),true);
  if(credential?.user&&auth.currentUser?.uid===credential.user.uid){if(!profileCreated){try{await deleteUser(credential.user)}catch{await signOut(auth)}}else{try{await signOut(auth)}catch{}}}
 }finally{authFlowInProgress=false;submit.disabled=false;submit.textContent='HESAP OLUŞTUR'}
}

async function resetPassword(){
 const value=$('accountLoginEmail').value.trim();
 if(!value||!value.includes('@')){authMsg('Şifre sıfırlama için kullanıcı adı değil, kayıtlı e-posta adresini gir.',true);$('accountLoginEmail').focus();return}
 try{await sendPasswordResetEmail(auth,value);authMsg('Şifre sıfırlama bağlantısı e-posta adresine gönderildi.')}catch(err){authMsg(authErrorMessage(err),true)}
}

async function resendVerification(){
 const email=$('resendVerifyEmail').value.trim().toLowerCase(),password=$('resendVerifyPassword').value;
 if(!email||!email.includes('@')||!password){authMsg('Doğrulama bağlantısını yeniden göndermek için e-posta ve şifreni gir.',true);return}
 const button=$('resendVerificationBtn');button.disabled=true;
 try{const cred=await signInWithEmailAndPassword(auth,email,password);await reload(cred.user);if(cred.user.emailVerified){authMsg('E-posta adresin zaten doğrulanmış. Giriş yapabilirsin.')}else{await sendEmailVerification(cred.user,{url:EMAIL_ACTION_URL,handleCodeInApp:false});authMsg('Yeni doğrulama bağlantısı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.')}await signOut(auth)}
 catch(err){authMsg(authErrorMessage(err),true);if(auth.currentUser){try{await signOut(auth)}catch{}}}
 finally{button.disabled=false}
}

async function joinRoomByCode(e){
 e.preventDefault();
 const code=$('roomCodeInput').value.trim();
 if(!/^\d{6}$/.test(code)){msg('6 haneli geçerli oda kodu gir.',true);return}
 const btn=$('joinRoomForm').querySelector('button[type="submit"]');
 if(btn){btn.disabled=true;btn.textContent='Odaya bağlanılıyor…'}
 try{
  if(!user?.uid)throw new Error('Önce giriş yapmalısın.');
  await user.getIdToken(true);
  const result=await getDocs(query(collection(db,'rooms'),where('code','==',code)));
  if(result.empty)throw new Error('Bu kodla eşleşen oda bulunamadı. Oda kodunu kontrol et.');
  await enterRoom(result.docs[0].id);
 }catch(err){console.error('Odaya katılma hatası:',err);msg(err.message||'Odaya katılınamadı.',true)}
 finally{if(btn){btn.disabled=false;btn.textContent='Odaya katıl'}}
}

function showAuthMode(mode){
 const isRegister=mode==='register';
 $('loginForm').classList.toggle('hidden',isRegister);
 $('registerForm').classList.toggle('hidden',!isRegister);
 $('showLoginBtn').classList.toggle('active',!isRegister);
 $('showRegisterBtn').classList.toggle('active',isRegister);
 $('authMsg').textContent='';
}
function bindUI(){
 $('loginForm').onsubmit=loginAccount;
 $('registerForm').onsubmit=registerAccount;
 $('showLoginBtn').onclick=()=>showAuthMode('login');
 $('showRegisterBtn').onclick=()=>showAuthMode('register');
 $('forgotPasswordBtn').onclick=resetPassword;
 $('resendVerificationBtn').onclick=resendVerification;
 const adminFormApp=$('adminLoginFormApp');
 if(adminFormApp)adminFormApp.onsubmit=async e=>{
  e.preventDefault();
  const submit=adminFormApp.querySelector('button[type=submit],button:not([type])');
  if(submit){submit.disabled=true;submit.textContent='Giriş yapılıyor…'}
  try{
   const credential=await signInWithEmailAndPassword(auth,$('adminEmail').value.trim(),$('adminPassword').value);
   if(credential.user.uid!==ADMIN_UID){await signOut(auth);throw new Error('Bu hesap yönetici olarak yetkilendirilmemiş.')}
   await initDashboard(credential.user);msg('Admin girişi başarılı.');
  }catch(err){msg('Admin girişi başarısız: '+authErrorMessage(err),true)}
  finally{if(submit){submit.disabled=false;submit.textContent='Admin olarak giriş yap'}}
 };
 $('logoutBtn').onclick=async()=>{
  writeStored(RESUME_ROOM_KEY,null);profile=null;user=null;
  if(roomsUnsub){roomsUnsub();roomsUnsub=null}
  closeRoomUI();await signOut(auth);
 };
 $('createRoomForm').onsubmit=createRoom;
 $('joinRoomForm').onsubmit=joinRoomByCode;
 $('newRoomBtn').onclick=()=>{$('roomName').focus();$('adminBox').scrollIntoView({behavior:'smooth',block:'center'})};
 $('startDraftBtn').onclick=startDraft;$('spinBtn').onclick=spin;$('pickBtn').onclick=pickPlayer;
 $('leaveRoomBtn').onclick=leaveRoom;
 $('copyCodeBtn').onclick=async()=>{try{await navigator.clipboard.writeText(room.code||roomId);msg('Oda kodu kopyalandı.')}catch{msg('Oda kodu: '+(room.code||roomId))}};
 $('createFixturesBtn').onclick=createFixtures;$('saveLeagueNameBtn').onclick=saveLeagueName;
 document.querySelectorAll('.nav-tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.nav-tab').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('.pane').forEach(x=>x.classList.toggle('hidden',x.id!==b.dataset.pane))
 });
}
let resumeAttemptAt=0;
async function resumeSavedRoom(){
 if(resumeInProgress||!user||!roomId&&roomUnsub)return;
 const saved=roomId||readStored(RESUME_ROOM_KEY);
 if(!saved)return;
 const now=Date.now();
 if(now-resumeAttemptAt<1500)return;
 resumeAttemptAt=now;resumeInProgress=true;
 try{await enterRoom(saved,true)}finally{resumeInProgress=false}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(roomId){resumeSavedRoom()}else if(user&&readStored(RESUME_ROOM_KEY)){resumeSavedRoom()}}});
window.addEventListener('pageshow',()=>{if(roomId||readStored(RESUME_ROOM_KEY))resumeSavedRoom()});
window.addEventListener('online',()=>{if(roomId||readStored(RESUME_ROOM_KEY))resumeSavedRoom()});

async function boot(){
 drawWheel();
 try{
  const res=await fetch('./players.json');const data=await res.json();players=Array.isArray(data)?data:(data.players||[]);
  if(players.length!==300)throw new Error(`Oyuncu veritabanında 300 futbolcu bekleniyordu; ${players.length} bulundu.`);
  if(players.some(p=>!p.club||!p.id||!p.name))throw new Error('Oyuncu listesinde gerekli alanlar eksik.');
 }catch(e){msg('Oyuncu listesi yüklenemedi: '+e.message,true)}
 bindUI();
 try{await authPersistenceReady}catch(e){console.warn('Oturum kalıcılığı ayarlanamadı:',e)}
 onAuthStateChanged(auth,async u=>{
  if(authFlowInProgress)return;
  if(u&&!u.isAnonymous){
   try{await initDashboard(u)}catch(e){
    console.error(e);user=null;profile=null;if(auth.currentUser&&!auth.currentUser.emailVerified){try{await signOut(auth)}catch{}}
    $('authView').classList.remove('hidden');$('appView').classList.add('hidden');
    authMsg(e.message||'Hesap bilgileri okunamadı.',true);
   }
  }else{
   user=null;profile=null;$('authView').classList.remove('hidden');$('appView').classList.add('hidden');
   $('logoutBtn').classList.add('hidden');
   if(roomsUnsub){roomsUnsub();roomsUnsub=null}
   closeRoomUI();
  }
 });
}
boot();
