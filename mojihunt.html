// ------------------- MojiHunt + Firebase integration -------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- Config ---------------- */
  const INITIAL_POT    = 1_000_000; // $1,000,000 daily
  const EMOJI_REWARD    = 5 * 8;    // 40 stars per emoji
  const EMOJI_CASH      = 1_000;    // ₦1,000 per emoji
  const STAR_COST       = 10;       // cost to join game
  const ROUND_DURATION  = 30_000;   // 30s per round
  const EMOJI_INTERVAL  = 1000;     // spawn emoji every 1s

  const EMOJIS = ["🎉","🪄","💎","✨","🔥","🧸","🍀","🌟","🎁","🤑"];

  /* ---------------- Firebase ---------------- */
  const firebaseConfig = {
    apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
    authDomain: "metaverse-1010.firebaseapp.com",
    projectId: "metaverse-1010",
    storageBucket: "metaverse-1010.appspot.com",
    messagingSenderId: "1044064238233",
    appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
    measurementId: "G-S77BMC266C",
    databaseURL: "https://metaverse-1010-default-rtdb.firebaseio.com/"
  };
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  /* ---------------- UI Refs ---------------- */
  const joinBtn     = document.getElementById('joinTrainBtn');
  const confirmModal= document.getElementById('confirmModal');
  const confirmYes  = document.getElementById('confirmYes');
  const confirmNo   = document.getElementById('confirmNo');
  const popupEl     = document.getElementById('popup');
  const profileEl   = document.getElementById('profileName') || document.getElementById('username');
  const starEl      = document.getElementById('starCount') || document.getElementById('stars-count');
  const cashEl      = document.getElementById('cashCount') || document.getElementById('cash-count');
  const arenaEl     = document.getElementById('problemBoard'); // reused container

  /* ---------------- Sounds ---------------- */
  const SOUND_PATHS = {
    ding: './sounds/cha_ching.mp3',
    error: './sounds/error_bell.mp3',
    start: './sounds/train_start.mp3'
  };
  function playAudio(src, opts={}) {
    try { const a = new Audio(src); a.volume = opts.volume??0.8; if(opts.loop)a.loop=true;a.play().catch(()=>{}); } catch(e){};
  }

  /* ---------------- Local State ---------------- */
  let currentUser=null, currentUserUnsub=null;
  let gameActive=false, emojiTimer=null, roundTimer=null;
  let caughtCount=0;

  /* ---------------- Helpers ---------------- */
  const sanitizeEmail = (raw) => String(raw||'').replace(/[.#$[\]]/g,',');

  function showPopup(text, ms=1800){
    if(!popupEl) return;
    popupEl.textContent=text;
    popupEl.style.display='block';
    popupEl.style.opacity='1';
    setTimeout(()=>{
      popupEl.style.opacity='0';
      setTimeout(()=>popupEl.style.display='none',300);
    },ms);
  }

  function updateProfileUI(){
    if(!currentUser) return;
    if(profileEl) profileEl.textContent=currentUser.chatId;
    if(starEl) starEl.textContent=(currentUser.stars||0).toLocaleString();
    if(cashEl)  cashEl.textContent=`₦${(currentUser.cash||0).toLocaleString()}`;
  }

  /* ---------------- Firestore Integration ---------------- */
  async function loadUser(){
    try {
      const stored = JSON.parse(localStorage.getItem('vipUser') || localStorage.getItem('hostUser') || '{}');
      if(!stored?.email){ currentUser=null; updateProfileUI(); return; }

      const uid = sanitizeEmail(stored.email);
      const userRef = doc(db,'users',uid);
      const snap = await getDoc(userRef);
      if(!snap.exists()){
        currentUser={uid,stars:0,cash:0,isHost:false,chatId:stored.displayName||stored.email.split('@')[0],email:stored.email};
        updateProfileUI(); return;
      }
      currentUser={uid,...snap.data()};
      if(currentUserUnsub) currentUserUnsub();
      currentUserUnsub = onSnapshot(userRef,(docSnap)=>{
        if(!docSnap.exists()) return;
        currentUser={uid,...docSnap.data()};
        localStorage.setItem(currentUser.isVIP?'vipUser':'hostUser',JSON.stringify(currentUser));
        updateProfileUI();
      });
    } catch(e){ console.error('loadUser error',e); }
  }

  async function tryDeductStars(cost){
    if(!currentUser?.uid) return {ok:false,message:'Not logged in'};
    const ref = doc(db,'users',currentUser.uid);
    try {
      await runTransaction(db, async t=>{
        const u = await t.get(ref); if(!u.exists()) throw new Error('User not found');
        const curStars = Number(u.data().stars||0);
        if(curStars<cost) throw new Error('Not enough stars');
        t.update(ref,{stars:curStars-cost});
      });
      return {ok:true};
    } catch(e){ return {ok:false,message:e.message||'Deduction failed'}; }
  }

  async function giveRewards(cash,stars){
    if(!currentUser?.uid){
      if(cashEl) cashEl.textContent=String((parseInt(cashEl.textContent.replace(/,/g,''),10)||0)+cash);
      if(starEl) starEl.textContent=String((parseInt(starEl.textContent.replace(/,/g,''),10)||0)+stars);
      return;
    }
    const ref = doc(db,'users',currentUser.uid);
    try {
      await runTransaction(db, async t=>{
        const u = await t.get(ref); if(!u.exists()) throw new Error('User not found');
        t.update(ref,{
          cash: Number(u.data().cash||0)+Number(cash),
          stars:Number(u.data().stars||0)+Number(stars)
        });
      });
    } catch(e){ console.error('giveRewards error',e); }
  }

  /* ---------------- MojiHunt Mechanics ---------------- */
  function spawnEmoji(){
    if(!arenaEl) return;
    const emoji = document.createElement('div');
    emoji.textContent=EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
    emoji.style.position='absolute';
    emoji.style.fontSize='28px';
    emoji.style.cursor='pointer';
    emoji.style.userSelect='none';
    emoji.style.top = Math.random()*(arenaEl.clientHeight-40)+'px';
    emoji.style.left= Math.random()*(arenaEl.clientWidth-40)+'px';
    arenaEl.appendChild(emoji);

    emoji.addEventListener('click', async ()=>{
      if(!gameActive) return;
      arenaEl.removeChild(emoji);
      caughtCount++;
      playAudio(SOUND_PATHS.ding);
      showPopup(`+${EMOJI_CASH}₦ & +${EMOJI_REWARD}⭐`,1500);
      await giveRewards(EMOJI_CASH,EMOJI_REWARD);
    });

    setTimeout(()=>{ if(arenaEl.contains(emoji)) arenaEl.removeChild(emoji); },1000+Math.random()*2000);
  }

  function startRound(){
    if(gameActive) return;
    gameActive=true;
    caughtCount=0;
    playAudio(SOUND_PATHS.start,true);
    emojiTimer=setInterval(spawnEmoji,EMOJI_INTERVAL);
    roundTimer=setTimeout(endRound,ROUND_DURATION);
  }

  function endRound(){
    gameActive=false;
    clearInterval(emojiTimer);
    clearTimeout(roundTimer);
    showPopup(`🏁 Round over! You caught ${caughtCount} emojis.`,3000);
    playAudio(SOUND_PATHS.ding);
  }

  /* ---------------- Join Flow ---------------- */
  joinBtn?.addEventListener('click',()=>{
    if(confirmModal) confirmModal.style.display='flex';
  });
  confirmYes?.addEventListener('click', async ()=>{
    if(confirmModal) confirmModal.style.display='none';
    if(!currentUser) { showPopup('Not logged in'); playAudio(SOUND_PATHS.error); return; }
    if((currentUser.stars||0)<STAR_COST){ showPopup('Not enough stars'); playAudio(SOUND_PATHS.error); return; }
    const deduct = await tryDeductStars(STAR_COST);
    if(!deduct.ok){ showPopup(deduct.message); playAudio(SOUND_PATHS.error); return; }
    updateProfileUI(); // deduct stars
    startRound();
  });
  confirmNo?.addEventListener('click',()=>{if(confirmModal) confirmModal.style.display='none';});

  /* ---------------- Init ---------------- */
  loadUser().catch(e=>console.error(e));
});