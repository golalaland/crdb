// mojihunt.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  // ---------------- CONFIG ----------------
  const EMOJIS = ["🎉","🪄","💎","✨","🔥","🧸","🍀","🌟","🎁","🤑"];
  const ROUND_DURATION = 20000; // 20s
  const EMOJI_INTERVAL = 600;   // spawn every 0.6s
  const STAR_COST = 10;
  const EMOJI_STARS = 40;
  const EMOJI_COINS = 1000;

  // ---------------- FIREBASE ----------------
  const firebaseConfig = {
    apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
    authDomain: "metaverse-1010.firebaseapp.com",
    projectId: "metaverse-1010",
    storageBucket: "metaverse-1010.appspot.com",
    messagingSenderId: "1044064238233",
    appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
    measurementId: "G-S77BMC266C"
  };
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // ---------------- STATE ----------------
  let currentUser = null;
  let userUnsub = null;
  let gameActive = false;
  let emojiTimer = null;
  let roundTimer = null;
  let caughtCount = 0;

  // ---------------- REFS ----------------
  const joinBtn = document.getElementById("joinHuntBtn");
  const confirmModal = document.getElementById("confirmModal");
  const confirmYes = document.getElementById("confirmYes");
  const confirmNo = document.getElementById("confirmNo");
  const emojiBoard = document.getElementById("emojiBoard");
  const profileNameEl = document.getElementById("profileName");
  const starEl = document.getElementById("starCount");
  const coinEl = document.getElementById("coinCount");
  const dailyPotEl = document.getElementById("dailyPot");

  // ---------------- HELPERS ----------------
  function sanitizeEmail(email) {
    return String(email || "").replace(/[.#$[\]]/g, ",");
  }

  function showPopup(text, ms = 1200) {
    const popup = document.createElement("div");
    popup.textContent = text;
    popup.style.position = "fixed";
    popup.style.top = "10%";
    popup.style.left = "50%";
    popup.style.transform = "translateX(-50%)";
    popup.style.background = "#FFD700";
    popup.style.padding = "8px 14px";
    popup.style.borderRadius = "8px";
    popup.style.fontWeight = "700";
    popup.style.zIndex = "9999";
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), ms);
  }

  function updateProfileUI() {
    if (!currentUser) return;
    profileNameEl.textContent = currentUser.chatId;
    starEl.textContent = currentUser.stars || 0;
    coinEl.textContent = currentUser.coins || 0;
    dailyPotEl.textContent = `$ ${(currentUser.dailyPot || 0)}`;
  }

  // ---------------- FIRESTORE ----------------
  async function loadUser() {
    try {
      // Example: load VIP user from localStorage
      const stored = JSON.parse(localStorage.getItem("vipUser") || '{}');
      if (!stored?.email) {
        currentUser = { chatId: "HUNTER 0001", stars: 100, coins: 0, dailyPot: 0, email: null };
        updateProfileUI();
        return;
      }

      const uid = sanitizeEmail(stored.email);
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        currentUser = { uid, chatId: stored.displayName || stored.email.split("@")[0], stars: 100, coins: 0, dailyPot: 0, email: stored.email };
        updateProfileUI();
        return;
      }
      currentUser = { uid, ...snap.data() };

      if (userUnsub) userUnsub();
      userUnsub = onSnapshot(userRef, (docSnap) => {
        if (!docSnap.exists()) return;
        currentUser = { uid, ...docSnap.data() };
        updateProfileUI();
      });
    } catch (e) {
      console.error("loadUser error", e);
    }
  }

  async function tryDeductStars(cost) {
    if (!currentUser?.uid) return { ok: false, message: "Not logged in" };
    const ref = doc(db, "users", currentUser.uid);
    try {
      await runTransaction(db, async (t) => {
        const u = await t.get(ref);
        if (!u.exists()) throw new Error("User not found");
        const curStars = Number(u.data().stars || 0);
        if (curStars < cost) throw new Error("Not enough stars");
        t.update(ref, { stars: curStars - cost });
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message || "Deduction failed" };
    }
  }

  async function giveRewards(coins, stars) {
    if (!currentUser?.uid) return;
    const ref = doc(db, "users", currentUser.uid);
    try {
      await runTransaction(db, async (t) => {
        const u = await t.get(ref);
        if (!u.exists()) throw new Error("User not found");
        const curCoins = Number(u.data().coins || 0);
        const curStars = Number(u.data().stars || 0);
        const curPot = Number(u.data().dailyPot || 0);
        t.update(ref, {
          coins: curCoins + coins,
          stars: curStars + stars,
          dailyPot: curPot + coins
        });
      });
    } catch (e) {
      console.error("giveRewards error", e);
    }
  }

  // ---------------- GAME ----------------
  function spawnEmoji() {
    const emojiEl = document.createElement("div");
    emojiEl.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    emojiEl.style.position = "absolute";
    emojiEl.style.left = Math.random() * (emojiBoard.clientWidth - 40) + "px";
    emojiEl.style.top = "-40px";
    emojiEl.style.fontSize = "28px";
    emojiEl.style.cursor = "pointer";
    emojiEl.style.userSelect = "none";
    emojiBoard.appendChild(emojiEl);

    const speed = 2 + Math.random() * 3;
    let pos = -40;
    const fallInterval = setInterval(() => {
      if (!gameActive) { clearInterval(fallInterval); emojiEl.remove(); return; }
      pos += speed;
      emojiEl.style.top = pos + "px";
      if (pos > emojiBoard.clientHeight) { clearInterval(fallInterval); emojiEl.remove(); }
    }, 16);

    emojiEl.addEventListener("click", async () => {
      if (!gameActive) return;
      caughtCount++;
      await giveRewards(EMOJI_COINS, EMOJI_STARS);
      updateProfileUI();
      showPopup(`+${EMOJI_COINS}₦ & +${EMOJI_STARS}⭐`, 1000);
      clearInterval(fallInterval);
      emojiEl.remove();
    });
  }

  function startRound() {
    if (gameActive) return;
    if ((currentUser.stars || 0) < STAR_COST) {
      showPopup("❌ Not enough stars!");
      return;
    }
    gameActive = true;
    tryDeductStars(STAR_COST).then(res => {
      if (!res.ok) { showPopup(res.message); gameActive = false; return; }
      caughtCount = 0;
      emojiTimer = setInterval(spawnEmoji, EMOJI_INTERVAL);
      roundTimer = setTimeout(endRound, ROUND_DURATION);
      joinBtn.disabled = true;
      showPopup("🟢 MojiHunt Started!");
    });
  }

  function endRound() {
    gameActive = false;
    clearInterval(emojiTimer);
    clearTimeout(roundTimer);
    joinBtn.disabled = false;
    showPopup(`🏁 Round over! You caught ${caughtCount} emojis.`, 2000);
  }

  // ---------------- EVENTS ----------------
  joinBtn.addEventListener("click", () => confirmModal.style.display = "flex");
  confirmYes.addEventListener("click", () => { confirmModal.style.display = "none"; startRound(); });
  confirmNo.addEventListener("click", () => confirmModal.style.display = "none");

  // ---------------- INIT ----------------
  loadUser();
});