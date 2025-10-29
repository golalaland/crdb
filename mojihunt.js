// mojihunt.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

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
  const joinBtn       = document.getElementById('joinHuntBtn');
  const confirmModal  = document.getElementById('confirmModal');
  const confirmYes    = document.getElementById('confirmYes');
  const confirmNo     = document.getElementById('confirmNo');
  const emojiBoard    = document.getElementById('emojiBoard');
  const profileNameEl = document.getElementById('profileName');
  const starEl        = document.getElementById('starCount');
  const coinEl        = document.getElementById('coinCount');
  const dailyPotEl    = document.getElementById('dailyPot');

  /* ---------------- Game Config ---------------- */
  const EMOJIS        = ["🎉","🪄","💎","✨","🔥","🧸","🍀","🌟","🎁","🤑"];
  const STAR_COST     = 10;       // cost to join
  const EMOJI_REWARD  = 40;       // stars per emoji
  const EMOJI_COIN    = 1000;     // coins per emoji
  const ROUND_DURATION= 20000;    // 20s per round
  const EMOJI_INTERVAL= 800;      // spawn emoji every 0.8s
  let gameActive      = false;
  let emojiTimer      = null;
  let roundTimer      = null;
  let caughtCount     = 0;
  let dailyPot        = 0;
  let currentUser     = null;
  let userUnsub       = null;

  /* ---------------- Helpers ---------------- */
  const sanitizeEmail = e => String(e||'').replace(/[.#$[\]]/g,',');

  function showPopup(text, ms=1500){
    const popupEl = document.createElement('div');
    popupEl.textContent = text;
    popupEl.style.position = 'fixed';
    popupEl.style.top = '10%';
    popupEl.style.left = '50%';
    popupEl.style.transform = 'translateX(-50%)';
    popupEl.style.background = '#FFD700';
    popupEl.style.padding = '10px 18px';
    popupEl.style.borderRadius = '8px';
    popupEl.style.fontWeight = '700';
    popupEl.style.zIndex = '9999';
    document.body.appendChild(popupEl);
    setTimeout(() => popupEl.remove(), ms);
  }

  function updateProfileUI(){
    if(!currentUser) return;
    profileNameEl.textContent = currentUser.chatId || "HUNTER";
    starEl.textContent = currentUser.stars?.toLocaleString() || "0";
    coinEl.textContent = currentUser.coins?.toLocaleString() || "0";
  }

  /* ---------------- Load User ---------------- */
  async function loadUser(){
    try {
      const stored = JSON.parse(localStorage.getItem('vipUser') || localStorage.getItem('hostUser') || '{}');
      if(!stored?.email){ currentUser=null; updateProfileUI(); return; }
      const uid = sanitizeEmail(stored.email);
      const userRef = doc(db,'users',uid);

      const snap = await getDoc(userRef);
      if(!snap.exists()){
        currentUser = {
          uid,
          stars: 50,
          coins: 0,
          chatId: stored.displayName || stored.email.split('@')[0],
          email: stored.email
        };
        await runTransaction(db, async t=>{
          t.set(userRef,currentUser);
        });
      } else currentUser = {uid, ...snap.data()};

      if(userUnsub) userUnsub();
      userUnsub = onSnapshot(userRef, docSnap => {
        if(!docSnap.exists()) return;
        currentUser = {uid, ...docSnap.data()};
        updateProfileUI();
      });

    } catch(e){ console.error('loadUser error',e); }
  }

  /* ---------------- Deduct Stars ---------------- */
  async function tryDeductStars(cost){
    if(!currentUser?.uid) return {ok:false,message:'Not logged in'};
    const ref = doc(db,'users',currentUser.uid);
    try{
      await runTransaction(db, async t=>{
        const u = await t.get(ref);
        if(!u.exists()) throw new Error('User not found');
        const curStars = Number(u.data().stars||0);
        if(curStars < cost) throw new Error('Not enough stars');
        t.update(ref,{stars: curStars - cost});
      });
      return {ok:true};
    } catch(e){ return {ok:false,message:e.message||'Deduction failed'}; }
  }

  /* ---------------- Give Rewards ---------------- */
  async function giveRewards(stars, coins){
    if(!currentUser?.uid) return;
    const ref = doc(db,'users',currentUser.uid);
    try{
      await runTransaction(db, async t=>{
        const u = await t.get(ref);
        if(!u.exists()) throw new Error('User not found');
        t.update(ref,{
          stars: Number(u.data().stars||0)+stars,
          coins: Number(u.data().coins||0)+coins
        });
      });
      dailyPot += coins;
      dailyPotEl.textContent = `$ ${dailyPot.toLocaleString()}`;
    } catch(e){ console.error('giveRewards error',e); }
  }

  /* ---------------- Emoji Mechanics ---------------- */
  function spawnEmoji(){
    const emojiEl = document.createElement('div');
    emojiEl.textContent = EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
    emojiEl.className = 'emoji-block';
    emojiEl.style.position = 'absolute';
    emojiEl.style.top = Math.random() * (emojiBoard.clientHeight-50) + 'px';
    emojiEl.style.left = Math.random() * (emojiBoard.clientWidth-50) + 'px';
    emojiBoard.appendChild(emojiEl);

    emojiEl.addEventListener('click', ()=>{
      if(!gameActive) return;
      emojiBoard.removeChild(emojiEl);
      caughtCount++;
      giveRewards(EMOJI_REWARD, EMOJI_COIN);
      showPopup(`+${EMOJI_COIN}₦ & +${EMOJI_REWARD}⭐`,1200);
    });

    setTimeout(()=> {
      if(emojiBoard.contains(emojiEl)) emojiBoard.removeChild(emojiEl);
    }, 1500 + Math.random()*1500);
  }

  function startRound(){
    if(gameActive) return;
    gameActive = true;
    caughtCount = 0;
    emojiTimer = setInterval(spawnEmoji, EMOJI_INTERVAL);
    roundTimer = setTimeout(endRound, ROUND_DURATION);
    joinBtn.disabled = true;
    showPopup("🟢 MojiHunt Started!");
  }

  function endRound(){
    gameActive = false;
    clearInterval(emojiTimer);
    clearTimeout(roundTimer);
    joinBtn.disabled = false;
    showPopup(`🏁 Round over! You caught ${caughtCount} emojis.`,2500);
  }

  /* ---------------- Join Flow ---------------- */
  joinBtn.addEventListener('click', ()=> confirmModal.style.display='flex');
  confirmYes.addEventListener('click', async ()=>{
    confirmModal.style.display='none';
    if(!currentUser) { showPopup("❌ Not logged in!"); return; }
    const deduct = await tryDeductStars(STAR_COST);
    if(!deduct.ok){ showPopup(`❌ ${deduct.message}`); return; }
    startRound();
  });
  confirmNo.addEventListener('click', ()=> confirmModal.style.display='none');

  /* ---------------- Init ---------------- */
  loadUser().catch(e=>console.error(e));

});