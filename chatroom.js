  /* ---------- Imports (Firebase v10) ---------- */
import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  increment, 
  getDocs, 
  where,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { 
  getDatabase, 
  ref as rtdbRef, 
  set as rtdbSet, 
  onDisconnect, 
  onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { 
  getAuth, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ---------- Firebase Config ---------- */
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

/* ---------- Firebase Setup ---------- */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

/* ---------- Globals ---------- */
let currentUser = null;

/* ===============================
   🔔 Notification Helpers
================================= */
async function pushNotification(userId, message) {
  if (!userId) return;
  const notifRef = doc(collection(db, "users", userId, "notifications"));
  await setDoc(notifRef, {
    message,
    timestamp: serverTimestamp(),
    read: false,
  });
}

function pushNotificationTx(tx, userId, message) {
  const notifRef = doc(collection(db, "users", userId, "notifications"));
  tx.set(notifRef, {
    message,
    timestamp: serverTimestamp(),
    read: false,
  });
}

/* ---------- Auth State Watcher ---------- */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    console.log("✅ Logged in as:", user.uid);
    localStorage.setItem("userId", user.uid);

    // Wait for DOM elements
    const notificationsList = document.getElementById("notificationsList");
    const markAllBtn = document.getElementById("markAllRead");

    if (!notificationsList) {
      console.warn("⚠️ notificationsList element not found in DOM");
      return;
    }

    try {
      console.log("🔔 Setting up live notification listener...");
      const notifRef = collection(db, "users", currentUser.uid, "notifications");

      onSnapshot(notifRef, (snapshot) => {
        console.log("🔔 Notifications update:", snapshot.docs.map(d => d.data()));
        console.log("📡 Snapshot received:", snapshot.size, "docs");

        if (snapshot.empty) {
          notificationsList.innerHTML = `<p style="opacity:0.7;">No new notifications yet.</p>`;
          return;
        }

        const items = snapshot.docs.map((docSnap) => {
          const n = docSnap.data();
          const time = n.timestamp?.seconds
            ? new Date(n.timestamp.seconds * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--";
          return `
            <div class="notification-item ${n.read ? "" : "unread"}" data-id="${docSnap.id}">
              <span>${n.message || "(no message)"}</span>
              <span class="notification-time">${time}</span>
            </div>
          `;
        });

        notificationsList.innerHTML = items.join("");
      });

      // ✅ Mark all as read
      if (markAllBtn) {
        markAllBtn.addEventListener("click", async () => {
          console.log("🟡 Marking all notifications as read...");
          const snapshot = await getDocs(notifRef);
          for (const docSnap of snapshot.docs) {
            const ref = doc(db, "users", currentUser.uid, "notifications", docSnap.id);
            await updateDoc(ref, { read: true });
          }
          alert("✅ All notifications marked as read.");
        });
      }

    } catch (err) {
      console.error("❌ Notification listener error:", err);
    }

  } else {
    console.warn("⚠️ No logged-in user found");
    currentUser = null;
    localStorage.removeItem("userId");
  }
}); // ✅ properly closed


/* ---------- Helper: Get current user ID ---------- */
export function getCurrentUserId() {
  return currentUser ? currentUser.uid : localStorage.getItem("userId");
}
window.currentUser = currentUser;

/* ---------- Exports for other scripts ---------- */
export { app, db, rtdb, auth };

/* ---------- Global State ---------- */
const ROOM_ID = "room5";
const CHAT_COLLECTION = "messages_room5";
const BUZZ_COST = 50;
const SEND_COST = 1;

let lastMessagesArray = [];
let starInterval = null;
let refs = {};

/* ---------- Helpers ---------- */
const generateGuestName = () => `GUEST ${Math.floor(1000 + Math.random() * 9000)}`;
const formatNumberWithCommas = n => new Intl.NumberFormat('en-NG').format(n || 0);
const sanitizeKey = key => key.replace(/[.#$[\]]/g, ',');

function randomColor() {
  const palette = ["#FFD700","#FF69B4","#87CEEB","#90EE90","#FFB6C1","#FFA07A","#8A2BE2","#00BFA6","#F4A460"];
  return palette[Math.floor(Math.random() * palette.length)];
}

function showStarPopup(text) {
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if (!popup || !starText) return;
  starText.innerText = text;
  popup.style.display = "block";
  setTimeout(() => popup.style.display = "none", 1700);
}


/* ----------------------------
   ⭐ GIFT MODAL / CHAT BANNER ALERT
----------------------------- */
async function showGiftModal(targetUid, targetData) {
  const modal = document.getElementById("giftModal");
  const titleEl = document.getElementById("giftModalTitle");
  const amountInput = document.getElementById("giftAmountInput");
  const confirmBtn = document.getElementById("giftConfirmBtn");
  const closeBtn = document.getElementById("giftModalClose");

  if (!modal || !titleEl || !amountInput || !confirmBtn) return;

  // Show modal
  titleEl.textContent = `Gift ⭐️`;
  amountInput.value = "";
  modal.style.display = "flex";

  const close = () => (modal.style.display = "none");
  closeBtn.onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  // Prevent duplicate handlers
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener("click", async () => {
    const amt = parseInt(amountInput.value);
    if (!amt || amt < 100) return showStarPopup("🔥 Minimum gift is 100 ⭐️");
    if ((currentUser?.stars || 0) < amt) return showStarPopup("Not enough stars 💫");

    const fromRef = doc(db, "users", currentUser.uid);
    const toRef = doc(db, "users", targetUid);

    // Generate a random gradient for glow
    const glowColor = `linear-gradient(90deg, #${Math.floor(Math.random()*16777215).toString(16)}, #${Math.floor(Math.random()*16777215).toString(16)})`;

    // Chat banner message
    const messageData = {
      content: `💫 ${currentUser.chatId} gifted ${amt} ⭐️ to ${targetData.chatId}!`,
      uid: currentUser.uid,
      timestamp: serverTimestamp(),
      highlight: true,
      buzzColor: glowColor,
      systemBanner: true // renders full-width without username
    };

    // Save to chat collection
    const docRef = await addDoc(collection(db, CHAT_COLLECTION), messageData);

    // Update stars balances
    await Promise.all([
      updateDoc(fromRef, { stars: increment(-amt), starsGifted: increment(amt) }),
      updateDoc(toRef, { stars: increment(amt) })
    ]);

    // Show local popup feedback
    showStarPopup(`You sent ${amt} ⭐️ to ${targetData.chatId}!`);
    close();

    // Render banner in chat
    renderMessagesFromArray([{ id: docRef.id, data: messageData }]);

    // Apply glow animation
    const msgEl = document.getElementById(docRef.id);
    if (msgEl) {
      const contentEl = msgEl.querySelector(".content") || msgEl;
      contentEl.style.setProperty("--pulse-color", glowColor);
      contentEl.classList.add("baller-highlight");

      setTimeout(() => {
        contentEl.classList.remove("baller-highlight");
        contentEl.style.boxShadow = "none";
      }, 21000);
    }
  });
}

/* ---------- Gift Alert (Optional Popup) ---------- */
function showGiftAlert(text) {
  const alertEl = document.getElementById("giftAlert");
  if (!alertEl) return;

  alertEl.textContent = text; // just text
  alertEl.classList.add("show", "glow"); // banner glow

  // ✅ Floating stars removed
  setTimeout(() => alertEl.classList.remove("show", "glow"), 4000);
}

/* ---------- Redeem Link ---------- */
function updateRedeemLink() {
  if (!refs.redeemBtn || !currentUser) return;
  refs.redeemBtn.href = `https://golalaland.github.io/crdb/shop.html?uid=${encodeURIComponent(currentUser.uid)}`;
  refs.redeemBtn.style.display = "inline-block";
}

/* ---------- Tip Link ---------- */
function updateTipLink() {
  if (!refs.tipBtn || !currentUser) return;
  refs.tipBtn.href = `https://golalaland.github.io/crdb/moneytrain.html?uid=${encodeURIComponent(currentUser.uid)}`;
  refs.tipBtn.style.display = "inline-block";
}

/* ---------- Presence (Realtime) ---------- */
function setupPresence(user) {
  if (!rtdb) return;
  const pRef = rtdbRef(rtdb, `presence/${ROOM_ID}/${sanitizeKey(user.uid)}`);
  rtdbSet(pRef, { online: true, chatId: user.chatId, email: user.email }).catch(() => {});
  onDisconnect(pRef).remove().catch(() => {});
}

if (rtdb) {
  onValue(rtdbRef(rtdb, `presence/${ROOM_ID}`), snap => {
    const users = snap.val() || {};
    if (refs.onlineCountEl) refs.onlineCountEl.innerText = `(${Object.keys(users).length} online)`;
  });
}

/* ---------- User Colors ---------- */
function setupUsersListener() {
  onSnapshot(collection(db, "users"), snap => {
    refs.userColors = refs.userColors || {};
    snap.forEach(docSnap => {
      refs.userColors[docSnap.id] = docSnap.data()?.usernameColor || "#ffffff";
    });
    if (lastMessagesArray.length) renderMessagesFromArray(lastMessagesArray);
  });
}
setupUsersListener();

/* ---------- Render Messages (full-width banners + inner glass panel + confetti) ---------- */
let scrollPending = false;

function createConfetti(wrapper) {
  const confettiContainer = document.createElement("div");
  confettiContainer.className = "confetti-container";
  confettiContainer.style.position = "absolute";
  confettiContainer.style.top = 0;
  confettiContainer.style.left = 0;
  confettiContainer.style.width = "100%";
  confettiContainer.style.height = "100%";
  confettiContainer.style.pointerEvents = "none";
  confettiContainer.style.overflow = "hidden";
  wrapper.appendChild(confettiContainer);

  const colors = ["#ffcc00", "#ff33cc", "#33ffcc", "#ff3366", "#00ccff", "#ffffff"];
  const total = 50;

  for (let i = 0; i < total; i++) {
    const confetti = document.createElement("div");
    confetti.style.position = "absolute";
    confetti.style.width = Math.random() * 8 + 4 + "px";
    confetti.style.height = confetti.style.width;
    confetti.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.top = "0px";
    confetti.style.left = Math.random() * 100 + "%";
    confetti.style.opacity = Math.random();
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    confettiContainer.appendChild(confetti);

    const fallDistance = 100 + Math.random() * 200;
    const duration = 4000 + Math.random() * 2000;
    const delay = Math.random() * 200;
    const drift = Math.random() * 80 - 40;

    confetti.animate(
      [
        { transform: `translate(0,0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${drift}px, ${fallDistance}px) rotate(360deg)`, opacity: 0 }
      ],
      { duration, delay, easing: "ease-out", fill: "forwards" }
    );
  }

  setTimeout(() => confettiContainer.remove(), 6000);
}

function renderMessagesFromArray(messages) {
  if (!refs.messagesEl) return;

  messages.forEach(item => {
    if (document.getElementById(item.id)) return;

    const m = item.data;
    const wrapper = document.createElement("div");
    wrapper.className = "msg";
    wrapper.id = item.id;
    wrapper.style.position = "relative";

    // --- System/banner message ---
    if (m.systemBanner) {
      wrapper.style.display = "block";
      wrapper.style.width = "100%";
      wrapper.style.textAlign = "center";
      wrapper.style.padding = "14px 0";
      wrapper.style.margin = "8px 0";
      wrapper.style.borderRadius = "6px";
      wrapper.style.fontWeight = "700";
      wrapper.style.color = "#000";
      wrapper.style.background = m.buzzColor || "linear-gradient(90deg,#ffcc00,#ff33cc)";
      wrapper.classList.add("buzz-content");

      // Confetti behind the message
      createConfetti(wrapper);

      // --- Inner translucent text panel ---
      const innerPanel = document.createElement("div");
      innerPanel.style.display = "inline-block";
      innerPanel.style.padding = "6px 14px";
      innerPanel.style.borderRadius = "8px";
      innerPanel.style.background = "rgba(255, 255, 255, 0.3)";
      innerPanel.style.backdropFilter = "blur(6px)";
      innerPanel.style.boxShadow = "0 0 12px rgba(255,255,255,0.3)";
      innerPanel.style.margin = "auto";
      innerPanel.style.color = "#000";
      innerPanel.style.fontWeight = "700";
      innerPanel.textContent = m.content || "";
      wrapper.appendChild(innerPanel);
    } else {
      // Normal chat message
      const usernameEl = document.createElement("span");
      usernameEl.className = "meta";
      usernameEl.innerHTML = `<span class="chat-username" data-username="${m.uid}">${m.chatId || "Guest"}</span>:`;
      usernameEl.style.color = (m.uid && refs.userColors?.[m.uid]) ? refs.userColors[m.uid] : "#fff";
      usernameEl.style.marginRight = "4px";
      wrapper.appendChild(usernameEl);

      const contentEl = document.createElement("span");
      contentEl.className = m.highlight || m.buzzColor ? "buzz-content content" : "content";
      contentEl.textContent = " " + (m.content || "");
      if (m.buzzColor) contentEl.style.background = m.buzzColor;
      wrapper.appendChild(contentEl);
    }

    refs.messagesEl.appendChild(wrapper);
  });

  // --- Smooth auto-scroll on new messages ---
  const nearBottom =
    refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight < 100;

  if (messages.some(msg => msg.data.systemBanner || msg.data.uid === currentUser?.uid) || nearBottom) {
    refs.messagesEl.scrollTo({
      top: refs.messagesEl.scrollHeight,
      behavior: "smooth"
    });
  }
}
/* ---------- 🔔 Messages Listener ---------- */
function attachMessagesListener() {
  const q = query(collection(db, CHAT_COLLECTION), orderBy("timestamp", "asc"));

  // 💾 Load previously shown gift IDs from localStorage
  const shownGiftAlerts = new Set(JSON.parse(localStorage.getItem("shownGiftAlerts") || "[]"));

  // 💾 Save helper
  function saveShownGift(id) {
    shownGiftAlerts.add(id);
    localStorage.setItem("shownGiftAlerts", JSON.stringify([...shownGiftAlerts]));
  }

  onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type !== "added") return;

      const msg = change.doc.data();
      const msgId = change.doc.id;

      // Prevent duplicate render
      if (document.getElementById(msgId)) return;

      // Add to memory + render
      lastMessagesArray.push({ id: msgId, data: msg });
      renderMessagesFromArray([{ id: msgId, data: msg }]);

/* 💝 Detect personalized gift messages */
if (msg.highlight && msg.content?.includes("gifted")) {
  const myId = currentUser?.chatId?.toLowerCase();
  if (!myId) return;

  const parts = msg.content.split(" ");
  const sender = parts[0];
  const receiver = parts[2];
  const amount = parts[3];

  if (!sender || !receiver || !amount) return;

  // 🎯 Only receiver sees it once
  if (receiver.toLowerCase() === myId) {
    if (shownGiftAlerts.has(msgId)) return; // skip if seen before

    showGiftAlert(`${sender} gifted you ${amount} stars ⭐️`);
    saveShownGift(msgId);
  }

  // ❌ Remove any extra popups for gifting since showGiftAlert already covers it
  // (No need to trigger showStarPopup or similar)
}
      // 🌀 Keep scroll for your own messages
      if (refs.messagesEl && msg.uid === currentUser?.uid) {
        refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      }
    });
  });
}
  

/* ---------- 🆔 ChatID Modal ---------- */
async function promptForChatID(userRef, userData) {
  if (!refs.chatIDModal || !refs.chatIDInput || !refs.chatIDConfirmBtn)
    return userData?.chatId || null;

  // Skip if user already set chatId
  if (userData?.chatId && !userData.chatId.startsWith("GUEST"))
    return userData.chatId;

  refs.chatIDInput.value = "";
  refs.chatIDModal.style.display = "flex";
  if (refs.sendAreaEl) refs.sendAreaEl.style.display = "none";

  return new Promise(resolve => {
    refs.chatIDConfirmBtn.onclick = async () => {
      const chosen = refs.chatIDInput.value.trim();
      if (chosen.length < 3 || chosen.length > 12)
        return alert("Chat ID must be 3–12 characters");

      const lower = chosen.toLowerCase();
      const q = query(collection(db, "users"), where("chatIdLower", "==", lower));
      const snap = await getDocs(q);

      let taken = false;
      snap.forEach(docSnap => {
        if (docSnap.id !== userRef.id) taken = true;
      });
      if (taken) return alert("This Chat ID is taken 💬");

      try {
        await updateDoc(userRef, { chatId: chosen, chatIdLower: lower });
        currentUser.chatId = chosen;
        currentUser.chatIdLower = lower;
        refs.chatIDModal.style.display = "none";
        if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
        showStarPopup(`Welcome ${chosen}! 🎉`);
        resolve(chosen);
      } catch (err) {
        console.error(err);
        alert("Failed to save Chat ID");
      }
    };
  });
}


/* ===============================
   🔐 VIP Login (Whitelist Check)
================================= */
async function loginWhitelist(email, phone) {
  const loader = document.getElementById("postLoginLoader");
  try {
    if (loader) loader.style.display = "flex";
    await sleep(50);

    // 🔍 Query whitelist
    const whitelistQuery = query(
      collection(db, "whitelist"),
      where("email", "==", email),
      where("phone", "==", phone)
    );
    const whitelistSnap = await getDocs(whitelistQuery);
    console.log("📋 Whitelist result:", whitelistSnap.docs.map(d => d.data()));

    if (whitelistSnap.empty) {
      return showStarPopup("You’re not on the whitelist. Please check your email and phone format.");
    }

    const uidKey = sanitizeKey(email);
    const userRef = doc(db, "users", uidKey);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return showStarPopup("User not found. Please sign up on the main page first.");
    }

    const data = userSnap.data() || {};

    // 🧍🏽 Set current user details
    currentUser = {
      uid: uidKey,
      email: data.email,
      phone: data.phone,
      chatId: data.chatId,
      chatIdLower: data.chatIdLower,
      stars: data.stars || 0,
      cash: data.cash || 0,
      usernameColor: data.usernameColor || randomColor(),
      isAdmin: !!data.isAdmin,
      isVIP: !!data.isVIP,
      fullName: data.fullName || "",
      gender: data.gender || "",
      subscriptionActive: !!data.subscriptionActive,
      subscriptionCount: data.subscriptionCount || 0,
      lastStarDate: data.lastStarDate || todayDate(),
      starsGifted: data.starsGifted || 0,
      starsToday: data.starsToday || 0,
      hostLink: data.hostLink || null,
      invitedBy: data.invitedBy || null,
      inviteeGiftShown: !!data.inviteeGiftShown,
      isHost: !!data.isHost
    };

    // 🧠 Setup post-login systems
    updateRedeemLink();
    updateTipLink();
    setupPresence(currentUser);
    attachMessagesListener();
    startStarEarning(currentUser.uid);

    localStorage.setItem("vipUser", JSON.stringify({ email, phone }));

    // Prompt guests for a permanent chatID
    if (currentUser.chatId?.startsWith("GUEST")) {
      await promptForChatID(userRef, data);
    }

    // 🎨 Update UI
    showChatUI(currentUser);

    return true;

  } catch (err) {
    console.error("❌ Login error:", err);
    showStarPopup("Login failed. Try again!");
    return false;
  } finally {
    if (loader) loader.style.display = "none";
  }
}

/* ----------------------------
   🔁 Auto Login Session
----------------------------- */
window.addEventListener("DOMContentLoaded", async () => {
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if (vipUser?.email && vipUser?.phone) {
    const loader = document.getElementById("postLoginLoader");
    const loadingBar = document.getElementById("loadingBar");

    try {
      // ✅ Make sure loader and bar are visible
      if (loader) loader.style.display = "flex";
      if (loadingBar) loadingBar.style.width = "0%";

      // 🩷 Animate bar while logging in
      let progress = 0;
      const interval = 80;
      const loadingInterval = setInterval(() => {
        if (progress < 90) { // don’t fill completely until login ends
          progress += Math.random() * 5;
          loadingBar.style.width = `${Math.min(progress, 90)}%`;
        }
      }, interval);

      // 🧠 Run the login
      const success = await loginWhitelist(vipUser.email, vipUser.phone);

      // Finish bar smoothly
      clearInterval(loadingInterval);
      loadingBar.style.width = "100%";

      if (success) {
        await sleep(400);
        updateRedeemLink();
        updateTipLink();
      }

    } catch (err) {
      console.error("❌ Auto-login error:", err);
    } finally {
      await sleep(300);
      if (loader) loader.style.display = "none";
    }
  }
});


/* ===============================
   💫 Auto Star Earning System
================================= */
function startStarEarning(uid) {
  if (!uid) return;
  if (starInterval) clearInterval(starInterval);

  const userRef = doc(db, "users", uid);
  let displayedStars = currentUser.stars || 0;
  let animationTimeout = null;

  // ✨ Smooth UI update
  const animateStarCount = target => {
    if (!refs.starCountEl) return;
    const diff = target - displayedStars;

    if (Math.abs(diff) < 1) {
      displayedStars = target;
      refs.starCountEl.textContent = formatNumberWithCommas(displayedStars);
      return;
    }

    displayedStars += diff * 0.25; // smoother easing
    refs.starCountEl.textContent = formatNumberWithCommas(Math.floor(displayedStars));
    animationTimeout = setTimeout(() => animateStarCount(target), 40);
  };

  // 🔄 Real-time listener
  onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const targetStars = data.stars || 0;
    currentUser.stars = targetStars;

    if (animationTimeout) clearTimeout(animationTimeout);
    animateStarCount(targetStars);

    // 🎉 Milestone popup
    if (targetStars > 0 && targetStars % 1000 === 0) {
      showStarPopup(`🔥 Congrats! You’ve reached ${formatNumberWithCommas(targetStars)} stars!`);
    }
  });

  // ⏱️ Increment loop
  starInterval = setInterval(async () => {
    if (!navigator.onLine) return;

    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const today = todayDate();

    // Reset daily count
    if (data.lastStarDate !== today) {
      await updateDoc(userRef, { starsToday: 0, lastStarDate: today });
      return;
    }

    // Limit: 250/day
    if ((data.starsToday || 0) < 250) {
      await updateDoc(userRef, {
        stars: increment(10),
        starsToday: increment(10)
      });
    }
  }, 60000);

  // 🧹 Cleanup
  window.addEventListener("beforeunload", () => clearInterval(starInterval));
}

/* ===============================
   🧩 Helper Functions
================================= */
const todayDate = () => new Date().toISOString().split("T")[0];
const sleep = ms => new Promise(res => setTimeout(res, ms));

/* ===============================
   🧠 UI Updates After Auth
================================= */
function updateUIAfterAuth(user) {
  const subtitle = document.getElementById("roomSubtitle");
  const helloText = document.getElementById("helloText");
  const roomDescText = document.querySelector(".room-desc .text");
  const hostsBtn = document.getElementById("openHostsBtn");

  if (user) {
    // Hide intro texts and show host button
    if (subtitle) subtitle.style.display = "none";
    if (helloText) helloText.style.display = "none";
    if (roomDescText) roomDescText.style.display = "none";
    if (hostsBtn) hostsBtn.style.display = "block";
  } else {
    // Restore intro texts and hide host button
    if (subtitle) subtitle.style.display = "block";
    if (helloText) helloText.style.display = "block";
    if (roomDescText) roomDescText.style.display = "block";
    if (hostsBtn) hostsBtn.style.display = "none";
  }
}

/* ===============================
   💬 Show Chat UI After Login
================================= */
function showChatUI(user) {
  const { authBox, sendAreaEl, profileBoxEl, profileNameEl, starCountEl, cashCountEl, adminControlsEl } = refs;

  // Hide login/auth elements
  document.getElementById("emailAuthWrapper")?.style?.setProperty("display", "none");
  document.getElementById("googleSignInBtn")?.style?.setProperty("display", "none");
  document.getElementById("vipAccessBtn")?.style?.setProperty("display", "none");

  // Show chat interface
  authBox && (authBox.style.display = "none");
  sendAreaEl && (sendAreaEl.style.display = "flex");
  profileBoxEl && (profileBoxEl.style.display = "block");

  if (profileNameEl) {
    profileNameEl.innerText = user.chatId;
    profileNameEl.style.color = user.usernameColor;
  }

  if (starCountEl) starCountEl.textContent = formatNumberWithCommas(user.stars);
  if (cashCountEl) cashCountEl.textContent = formatNumberWithCommas(user.cash);
  if (adminControlsEl) adminControlsEl.style.display = user.isAdmin ? "flex" : "none";

  // 🔹 Apply additional UI updates (hide intro, show hosts)
  updateUIAfterAuth(user);
}

/* ===============================
   🚪 Hide Chat UI On Logout
================================= */
function hideChatUI() {
  const { authBox, sendAreaEl, profileBoxEl, adminControlsEl } = refs;

  authBox && (authBox.style.display = "block");
  sendAreaEl && (sendAreaEl.style.display = "none");
  profileBoxEl && (profileBoxEl.style.display = "none");
  if (adminControlsEl) adminControlsEl.style.display = "none";

  // 🔹 Restore intro UI (subtitle, hello text, etc.)
  updateUIAfterAuth(null);
}

/* =======================================
   🚀 DOMContentLoaded Bootstrap
======================================= */
window.addEventListener("DOMContentLoaded", () => {

  /* ----------------------------
     ⚡ Smooth Loading Bar Helper
  ----------------------------- */
  function showLoadingBar(duration = 1000) {
    const postLoginLoader = document.getElementById("postLoginLoader");
    const loadingBar = document.getElementById("loadingBar");
    if (!postLoginLoader || !loadingBar) return;

    postLoginLoader.style.display = "flex";
    loadingBar.style.width = "0%";

    let progress = 0;
    const interval = 50;
    const step = 100 / (duration / interval);

    const loadingInterval = setInterval(() => {
      progress += step + Math.random() * 4; // adds organic feel
      loadingBar.style.width = `${Math.min(progress, 100)}%`;

      if (progress >= 100) {
        clearInterval(loadingInterval);
        setTimeout(() => postLoginLoader.style.display = "none", 250);
      }
    }, interval);
  }

  /* ----------------------------
     🧩 Cache DOM References
  ----------------------------- */
  refs = {
    authBox: document.getElementById("authBox"),
    messagesEl: document.getElementById("messages"),
    sendAreaEl: document.getElementById("sendArea"),
    messageInputEl: document.getElementById("messageInput"),
    sendBtn: document.getElementById("sendBtn"),
    buzzBtn: document.getElementById("buzzBtn"),
    profileBoxEl: document.getElementById("profileBox"),
    profileNameEl: document.getElementById("profileName"),
    starCountEl: document.getElementById("starCount"),
    cashCountEl: document.getElementById("cashCount"),
    redeemBtn: document.getElementById("redeemBtn"),
    tipBtn: document.getElementById("tipBtn"),
    onlineCountEl: document.getElementById("onlineCount"),
    adminControlsEl: document.getElementById("adminControls"),
    adminClearMessagesBtn: document.getElementById("adminClearMessagesBtn"),
    chatIDModal: document.getElementById("chatIDModal"),
    chatIDInput: document.getElementById("chatIDInput"),
    chatIDConfirmBtn: document.getElementById("chatIDConfirmBtn")
  };

  if (refs.chatIDInput) refs.chatIDInput.maxLength = 12;

  /* ----------------------------
     🔐 VIP Login Setup
  ----------------------------- */
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const loginBtn = document.getElementById("whitelistLoginBtn");

  async function handleLogin() {
    const email = (emailInput?.value || "").trim().toLowerCase();
    const phone = (phoneInput?.value || "").trim();

    if (!email || !phone) {
      return showStarPopup("Enter your email and phone to get access.");
    }

    showLoadingBar(1000);
    await sleep(50);

    const success = await loginWhitelist(email, phone);
    if (!success) return;

    await sleep(400);
    updateRedeemLink();
    updateTipLink();
  }

  loginBtn?.addEventListener("click", handleLogin);

  /* ----------------------------
     🔁 Auto Login Session
  ----------------------------- */
 async function autoLogin() {
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if (vipUser?.email && vipUser?.phone) {
    showLoadingBar(1000);
    await sleep(60);
    const success = await loginWhitelist(vipUser.email, vipUser.phone);
    if (!success) return;
    await sleep(400);
    updateRedeemLink();
    updateTipLink();
  }
}

// Call on page load
autoLogin();


  /* ----------------------------
     💬 Send Message Handler
  ----------------------------- */
  refs.sendBtn?.addEventListener("click", async () => {
    if (!currentUser) return showStarPopup("Sign in to chat.");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first.");
    if ((currentUser.stars || 0) < SEND_COST)
      return showStarPopup("Not enough stars to send message.");

    // Deduct star cost
    currentUser.stars -= SEND_COST;
    refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-SEND_COST) });

    // Add to chat
    const newMsg = {
      content: txt,
      uid: currentUser.uid,
      chatId: currentUser.chatId,
      timestamp: serverTimestamp(),
      highlight: false,
      buzzColor: null
    };
    const docRef = await addDoc(collection(db, CHAT_COLLECTION), newMsg);

    // Render immediately (optimistic)
    refs.messageInputEl.value = "";
    renderMessagesFromArray([{ id: docRef.id, data: newMsg }], true);
    scrollToBottom(refs.messagesEl);
  });

  /* ----------------------------
     🚨 BUZZ Message Handler
  ----------------------------- */
  refs.buzzBtn?.addEventListener("click", async () => {
  if (!currentUser) return showStarPopup("Sign in to BUZZ.");
  const txt = refs.messageInputEl?.value.trim();
  if (!txt) return showStarPopup("Type a message to BUZZ 🚨");

  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  const stars = snap.data()?.stars || 0;
  if (stars < BUZZ_COST) return showStarPopup("Not enough stars for BUZZ.");

  await updateDoc(userRef, { stars: increment(-BUZZ_COST) });
  const buzzColor = randomColor();

  const newBuzz = {
    content: txt,
    uid: currentUser.uid,
    chatId: currentUser.chatId,
    timestamp: serverTimestamp(),
    highlight: true,
    buzzColor
  };
  const docRef = await addDoc(collection(db, CHAT_COLLECTION), newBuzz);

  refs.messageInputEl.value = "";
  showStarPopup("BUZZ sent!");
  renderMessagesFromArray([{ id: docRef.id, data: newBuzz }]);
  scrollToBottom(refs.messagesEl);

  // Apply BUZZ glow
  const msgEl = document.getElementById(docRef.id);
  if (!msgEl) return;
  const contentEl = msgEl.querySelector(".content") || msgEl;

  contentEl.style.setProperty("--buzz-color", buzzColor);
  contentEl.classList.add("buzz-highlight");
  setTimeout(() => {
    contentEl.classList.remove("buzz-highlight");
    contentEl.style.boxShadow = "none";
  }, 12000); // same as CSS animation
});

  /* ----------------------------
     👋 Rotating Hello Text
  ----------------------------- */
  const greetings = ["HELLO","HOLA","BONJOUR","CIAO","HALLO","こんにちは","你好","안녕하세요","SALUT","OLÁ","NAMASTE","MERHABA"];
  const helloEl = document.getElementById("helloText");
  let greetIndex = 0;

  setInterval(() => {
    if (!helloEl) return;
    helloEl.style.opacity = "0";

    setTimeout(() => {
      helloEl.innerText = greetings[greetIndex++ % greetings.length];
      helloEl.style.color = randomColor();
      helloEl.style.opacity = "1";
    }, 220);
  }, 1500);

  /* ----------------------------
     🧩 Tiny Helpers
  ----------------------------- */
  const scrollToBottom = el => {
    if (!el) return;
    requestAnimationFrame(() => el.scrollTop = el.scrollHeight);
  };
  const sleep = ms => new Promise(res => setTimeout(res, ms));
});

/* =====================================
   🎥 Video Navigation & UI Fade Logic
======================================= */
(() => {
  const videoPlayer = document.getElementById("videoPlayer");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const container = document.querySelector(".video-container");
  const navButtons = [prevBtn, nextBtn].filter(Boolean);

  if (!videoPlayer || navButtons.length === 0) return;

  // Wrap the video in a relative container if not already
  const videoWrapper = document.createElement("div");
  videoWrapper.style.position = "relative";
  videoWrapper.style.display = "inline-block";
  videoPlayer.parentNode.insertBefore(videoWrapper, videoPlayer);
  videoWrapper.appendChild(videoPlayer);

  // ---------- Create hint overlay inside video ----------
  let hint = document.createElement("div");
hint = document.createElement("div");
hint.className = "video-hint";
hint.style.position = "absolute";
hint.style.bottom = "10%";            // slightly above bottom
hint.style.left = "50%";
hint.style.transform = "translateX(-50%)"; // horizontal center
hint.style.padding = "2px 8px";       // small pill
hint.style.background = "rgba(0,0,0,0.5)";
hint.style.color = "#fff";
hint.style.borderRadius = "12px";     // pill shape
hint.style.fontSize = "14px";         // readable small font
hint.style.opacity = "0";
hint.style.pointerEvents = "none";
hint.style.transition = "opacity 0.4s";
// ensure parent is positioned
videoPlayer.parentElement.style.position = "relative";
videoPlayer.parentElement.appendChild(hint);

  const showHint = (msg, timeout = 1500) => {
    hint.textContent = msg;
    hint.style.opacity = "1";
    clearTimeout(hint._t);
    hint._t = setTimeout(() => (hint.style.opacity = "0"), timeout);
  };

  // 🎞️ Video list (Shopify video)
  const videos = [
    "https://cdn.shopify.com/videos/c/o/v/aa400d8029e14264bc1ba0a47babce47.mp4"
    // Add more Shopify videos if needed
  ];
  let currentVideo = 0;
  let hideTimeout = null;

  /* ----------------------------
     ▶️ Load & Play Video
  ----------------------------- */
  const loadVideo = (index) => {
    if (index < 0) index = videos.length - 1;
    if (index >= videos.length) index = 0;

    currentVideo = index;
    videoPlayer.src = videos[currentVideo];
    videoPlayer.muted = true;

    videoPlayer.addEventListener(
      "canplay",
      function onCanPlay() {
        videoPlayer.play().catch(() => console.warn("Autoplay may be blocked by browser"));
        videoPlayer.removeEventListener("canplay", onCanPlay);
      }
    );
  };

  /* ----------------------------
     🔊 Toggle Mute on Tap
  ----------------------------- */
  videoPlayer.addEventListener("click", () => {
    videoPlayer.muted = !videoPlayer.muted;
    showHint(videoPlayer.muted ? "Tap to unmute" : "Sound on");
  });

  /* ----------------------------
     ⏪⏩ Navigation Buttons
  ----------------------------- */
  prevBtn?.addEventListener("click", () => loadVideo(currentVideo - 1));
  nextBtn?.addEventListener("click", () => loadVideo(currentVideo + 1));

  /* ----------------------------
     👀 Auto Hide/Show Buttons
  ----------------------------- */
  const showButtons = () => {
    navButtons.forEach(btn => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    });
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      navButtons.forEach(btn => {
        btn.style.opacity = "0";
        btn.style.pointerEvents = "none";
      });
    }, 3000);
  };

  navButtons.forEach(btn => {
    btn.style.transition = "opacity 0.6s ease";
    btn.style.opacity = "0";
    btn.style.pointerEvents = "none";
  });

  ["mouseenter", "mousemove", "click"].forEach(evt => container?.addEventListener(evt, showButtons));
  container?.addEventListener("mouseleave", () => {
    navButtons.forEach(btn => {
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
    });
  });

  // Start with first video
  loadVideo(0);

  // Show initial hint inside video
  showHint("Tap to unmute", 1500);
})();

// URL of your custom star SVG
const customStarURL = "https://res.cloudinary.com/dekxhwh6l/image/upload/v1760596116/starssvg_k3hmsu.svg";

// Replace stars in text nodes with SVG + floating stars (invisible)
function replaceStarsWithSVG(root = document.body) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        if (node.nodeValue.includes("⭐") || node.nodeValue.includes("⭐️")) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodesToReplace = [];
  while (walker.nextNode()) nodesToReplace.push(walker.currentNode);

  nodesToReplace.forEach(textNode => {
    const parent = textNode.parentNode;
    if (!parent) return;

    const fragments = textNode.nodeValue.split(/⭐️?|⭐/);

    fragments.forEach((frag, i) => {
      if (frag) parent.insertBefore(document.createTextNode(frag), textNode);

      if (i < fragments.length - 1) {
        // Inline star
        const span = document.createElement("span");
        span.style.display = "inline-flex";
        span.style.alignItems = "center";
        span.style.position = "relative";

        const inlineStar = document.createElement("img");
        inlineStar.src = customStarURL;
        inlineStar.alt = "⭐";
        inlineStar.style.width = "1.2em";
        inlineStar.style.height = "1.2em";
        inlineStar.style.display = "inline-block";
        inlineStar.style.verticalAlign = "text-bottom";
        inlineStar.style.transform = "translateY(0.15em) scale(1.2)";

        span.appendChild(inlineStar);
        parent.insertBefore(span, textNode);

        // Floating star (fully invisible)
        const floatingStar = document.createElement("img");
        floatingStar.src = customStarURL;
        floatingStar.alt = "⭐";
        floatingStar.style.width = "40px";
        floatingStar.style.height = "40px";
        floatingStar.style.position = "absolute";
        floatingStar.style.pointerEvents = "none";
        floatingStar.style.zIndex = "9999";
        floatingStar.style.opacity = "0"; // invisible
        floatingStar.style.transform = "translate(-50%, -50%)";

        const rect = inlineStar.getBoundingClientRect();
        floatingStar.style.top = `${rect.top + rect.height / 2 + window.scrollY}px`;
        floatingStar.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;

        document.body.appendChild(floatingStar);

        // Remove immediately (optional, keeps DOM cleaner)
        setTimeout(() => floatingStar.remove(), 1);
      }
    });

    parent.removeChild(textNode);
  });
}

// Observe dynamic content including BallerAlert
const observer = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) replaceStarsWithSVG(node.parentNode);
      else if (node.nodeType === Node.ELEMENT_NODE) replaceStarsWithSVG(node);
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
replaceStarsWithSVG();


/* ---------- DOM Elements ---------- */
const openBtn = document.getElementById("openHostsBtn");
const modal = document.getElementById("featuredHostsModal");
const closeModal = document.querySelector(".featured-close");
const videoFrame = document.getElementById("featuredHostVideo");
const usernameEl = document.getElementById("featuredHostUsername");
const detailsEl = document.getElementById("featuredHostDetails");
const hostListEl = document.getElementById("featuredHostList");
const giftBtn = document.getElementById("featuredGiftBtn");
const giftSlider = document.getElementById("giftSlider");
const giftAmountEl = document.getElementById("giftAmount");
const prevBtn = document.getElementById("prevHost");
const nextBtn = document.getElementById("nextHost");

let hosts = [];
let currentIndex = 0;

/* ---------- Fetch + Listen to featuredHosts ---------- */
/* ---------- Fetch + Listen to featuredHosts + users merge ---------- */
async function fetchFeaturedHosts() {
  try {
    const q = collection(db, "featuredHosts");
    onSnapshot(q, async snapshot => {
      const tempHosts = [];

      for (const docSnap of snapshot.docs) {
        const hostData = { id: docSnap.id, ...docSnap.data() };
        let merged = { ...hostData };

        if (hostData.userId || hostData.chatId) {
          try {
            const userRef = doc(db, "users", hostData.userId || hostData.chatId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              merged = { ...merged, ...userSnap.data() };
            }
          } catch (err) {
            console.warn("⚠️ Could not fetch user for host:", hostData.userId || hostData.chatId, err);
          }
        }

        tempHosts.push(merged);
      }

      hosts = tempHosts;

      if (!hosts.length) {
        console.warn("⚠️ No featured hosts found.");
        return;
      }

      console.log("✅ Loaded hosts:", hosts.length);
      renderHostAvatars();
      loadHost(currentIndex >= hosts.length ? 0 : currentIndex);
    });
  } catch (err) {
    console.error("❌ Error fetching hosts:", err);
  }
}

/* ---------- Render Avatars ---------- */
function renderHostAvatars() {
  hostListEl.innerHTML = "";
  hosts.forEach((host, idx) => {
    const img = document.createElement("img");
    img.src = host.popupPhoto || "";
    img.alt = host.chatId || "Host";
    img.classList.add("featured-avatar");
    if (idx === currentIndex) img.classList.add("active");

    img.addEventListener("click", () => {
      loadHost(idx);
    });

    hostListEl.appendChild(img);
  });
}

/* ---------- Load Host (Faster Video Loading) ---------- */
async function loadHost(idx) {
  const host = hosts[idx];
  if (!host) return;
  currentIndex = idx;

  const videoContainer = document.getElementById("featuredHostVideo");
  if (!videoContainer) return;
  videoContainer.innerHTML = "";
  videoContainer.style.position = "relative";
  videoContainer.style.touchAction = "manipulation";

  // Shimmer loader
  const shimmer = document.createElement("div");
  shimmer.className = "video-shimmer";
  videoContainer.appendChild(shimmer);

  // Video element
  const videoEl = document.createElement("video");
  Object.assign(videoEl, {
    src: host.videoUrl || "",
    autoplay: true,
    muted: true,
    loop: true,
    playsInline: true,
    preload: "auto", // preload more data
    style: "width:100%;height:100%;object-fit:cover;border-radius:8px;display:none;cursor:pointer;"
  });
  videoEl.setAttribute("webkit-playsinline", "true");
  videoContainer.appendChild(videoEl);

  // Force video to start loading immediately
  videoEl.load();

  // Hint overlay
  const hint = document.createElement("div");
  hint.className = "video-hint";
  hint.textContent = "Tap to unmute";
  videoContainer.appendChild(hint);

  function showHint(msg, timeout = 1400) {
    hint.textContent = msg;
    hint.classList.add("show");
    clearTimeout(hint._t);
    hint._t = setTimeout(() => hint.classList.remove("show"), timeout);
  }

  let lastTap = 0;
  function onTapEvent() {
    const now = Date.now();
    if (now - lastTap < 300) {
      document.fullscreenElement ? document.exitFullscreen?.() : videoEl.requestFullscreen?.();
    } else {
      videoEl.muted = !videoEl.muted;
      showHint(videoEl.muted ? "Tap to unmute" : "Sound on", 1200);
    }
    lastTap = now;
  }
  videoEl.addEventListener("click", onTapEvent);
  videoEl.addEventListener("touchend", (ev) => {
    if (ev.changedTouches.length < 2) {
      ev.preventDefault?.();
      onTapEvent();
    }
  }, { passive: false });

  // Show video as soon as it can play
  videoEl.addEventListener("canplay", () => {
    shimmer.style.display = "none";
    videoEl.style.display = "block";
    showHint("Tap to unmute", 1400);
    videoEl.play().catch(() => {});
  });

/* ---------- Host Info ---------- */
usernameEl.textContent = (host.chatId || "Unknown Host")
  .toLowerCase()
  .replace(/\b\w/g, char => char.toUpperCase());

const gender = (host.gender || "person").toLowerCase();
const pronoun = gender === "male" ? "his" : "her";
const ageGroup = !host.age ? "20s" : host.age >= 30 ? "30s" : "20s";
const flair = gender === "male" ? "😎" : "💋";
const fruit = host.fruitPick || "🍇";
const nature = host.naturePick || "cool";
const city = host.location || "Lagos";
const country = host.country || "Nigeria";

detailsEl.innerHTML = `A ${fruit} ${nature} ${gender} in ${pronoun} ${ageGroup}, currently in ${city}, ${country}. ${flair}`;

// Typewriter bio
if (host.bioPick) {
  const bioText = host.bioPick.length > 160 ? host.bioPick.slice(0, 160) + "…" : host.bioPick;

  // Create a container for bio
  const bioEl = document.createElement("div");
  bioEl.style.marginTop = "6px";
  bioEl.style.fontWeight = "600";  // little bold
  bioEl.style.fontSize = "0.95em";
  bioEl.style.whiteSpace = "pre-wrap"; // keep formatting

  // Pick a random bright color
  const brightColors = ["#FF3B3B", "#FF9500", "#FFEA00", "#00FFAB", "#00D1FF", "#FF00FF", "#FF69B4"];
  bioEl.style.color = brightColors[Math.floor(Math.random() * brightColors.length)];

  detailsEl.appendChild(bioEl);

  // Typewriter effect
  let index = 0;
  function typeWriter() {
    if (index < bioText.length) {
      bioEl.textContent += bioText[index];
      index++;
      setTimeout(typeWriter, 40); // typing speed (ms)
    }
  }
  typeWriter();
}
/* ---------- Meet Button ---------- */
let meetBtn = document.getElementById("meetBtn");
if (!meetBtn) {
  meetBtn = document.createElement("button");
  meetBtn.id = "meetBtn";
  meetBtn.textContent = "Meet";
  Object.assign(meetBtn.style, {
    marginTop: "6px",
    padding: "8px 16px",
    borderRadius: "6px",
    background: "linear-gradient(90deg,#ff0099,#ff6600)",
    color: "#fff",
    border: "none",
    fontWeight: "bold",
    cursor: "pointer"
  });
  detailsEl.insertAdjacentElement("afterend", meetBtn);
}
meetBtn.onclick = () => showMeetModal(host);

/* ---------- Avatar Highlight ---------- */
hostListEl.querySelectorAll("img").forEach((img, i) => {
  img.classList.toggle("active", i === idx);
});

giftSlider.value = 1;
giftAmountEl.textContent = "1";
}

/* ---------- Meet Modal with WhatsApp / Social / No-Meet Flow ---------- */
function showMeetModal(host) {
  let modal = document.getElementById("meetModal");
  if (modal) modal.remove();

  modal = document.createElement("div");
  modal.id = "meetModal";
  Object.assign(modal.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "999999",
    backdropFilter: "blur(3px)",
    WebkitBackdropFilter: "blur(3px)"
  });

  modal.innerHTML = `
    <div id="meetModalContent" style="background:#111;padding:20px 22px;border-radius:12px;text-align:center;color:#fff;max-width:340px;box-shadow:0 0 20px rgba(0,0,0,0.5);">
      <h3 style="margin-bottom:10px;font-weight:600;">Meet ${host.chatId || "this host"}?</h3>
      <p style="margin-bottom:16px;">Request meet with <b>21 stars ⭐</b>?</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="cancelMeet" style="padding:8px 16px;background:#333;border:none;color:#fff;border-radius:8px;font-weight:500;">Cancel</button>
        <button id="confirmMeet" style="padding:8px 16px;background:linear-gradient(90deg,#ff0099,#ff6600);border:none;color:#fff;border-radius:8px;font-weight:600;">Yes</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector("#cancelMeet");
  const confirmBtn = modal.querySelector("#confirmMeet");
  const modalContent = modal.querySelector("#meetModalContent");

  cancelBtn.onclick = () => modal.remove();

  confirmBtn.onclick = async () => {
    const COST = 21;

    if (!currentUser?.uid) { alert("Please log in to request meets"); modal.remove(); return; }
    if ((currentUser.stars || 0) < COST) { alert("Uh oh, not enough stars ⭐"); modal.remove(); return; }

    confirmBtn.disabled = true;
    confirmBtn.style.opacity = 0.6;
    confirmBtn.style.cursor = "not-allowed";

    try {
      currentUser.stars -= COST;
      if (refs?.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
      updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-COST) }).catch(console.error);

      if (host.whatsapp) {
        // WhatsApp meet flow with staged messages
        const fixedStages = ["Handling your meet request…", "Collecting host’s identity…"];
        const playfulMessages = [
          "Oh, she’s hella cute…💋", "Careful, she may be naughty..😏",
          "Be generous with her, she’ll like you..", "Ohh, she’s a real star.. 🤩",
          "Be a real gentleman, when she texts u..", "She’s ready to dazzle you tonight.. ✨",
          "Watch out, she might steal your heart.. ❤️", "Look sharp, she’s got a sparkle.. ✨",
          "Don’t blink, or you’ll miss her charm.. 😉", "Get ready for some fun surprises.. 😏",
          "She knows how to keep it exciting.. 🎉", "Better behave, she’s watching.. 👀",
          "She might just blow your mind.. 💥", "Keep calm, she’s worth it.. 😘",
          "She’s got a twinkle in her eyes.. ✨", "Brace yourself for some charm.. 😎",
          "She’s not just cute, she’s 🔥", "Careful, her smile is contagious.. 😁",
          "She might make you blush.. 😳", "She’s a star in every way.. 🌟",
          "Don’t miss this chance.. ⏳"
        ];

        const randomPlayful = [];
        while (randomPlayful.length < 3) {
          const choice = playfulMessages[Math.floor(Math.random() * playfulMessages.length)];
          if (!randomPlayful.includes(choice)) randomPlayful.push(choice);
        }

        const stages = [...fixedStages, ...randomPlayful, "Generating secure token…"];
        modalContent.innerHTML = `<p id="stageMsg" style="margin-top:20px;font-weight:500;"></p>`;
        const stageMsgEl = modalContent.querySelector("#stageMsg");

        let totalTime = 0;
        stages.forEach((stage, index) => {
          let duration = (index < 2) ? 1500 + Math.random() * 1000
                        : (index < stages.length - 1) ? 1700 + Math.random() * 600
                        : 2000 + Math.random() * 500;
          totalTime += duration;

          setTimeout(() => {
            stageMsgEl.textContent = stage;
            if (index === stages.length - 1) {
              setTimeout(() => {
                modalContent.innerHTML = `
                  <h3 style="margin-bottom:10px;font-weight:600;">Meet Request Sent!</h3>
                  <p style="margin-bottom:16px;">Your request to meet <b>${host.chatId}</b> is approved.</p>
                  <button id="letsGoBtn" style="margin-top:6px;padding:10px 18px;border:none;border-radius:8px;font-weight:600;background:linear-gradient(90deg,#ff0099,#ff6600);color:#fff;cursor:pointer;">Send Message</button>
                `;
                const letsGoBtn = modalContent.querySelector("#letsGoBtn");
                letsGoBtn.onclick = () => {
                  const countryCodes = { Nigeria: "+234", Ghana: "+233", "United States": "+1", "United Kingdom": "+44", "South Africa": "+27" };
                  const hostCountry = host.country || "Nigeria";
                  let waNumber = host.whatsapp.trim();
                  if (waNumber.startsWith("0")) waNumber = waNumber.slice(1);
                  waNumber = countryCodes[hostCountry] + waNumber;
                  const firstName = currentUser.fullName.split(" ")[0];
                  const msg = `Hey! ${host.chatId}, my name’s ${firstName} (VIP on xixi live) & I’d like to meet you.`;
                  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
                  modal.remove();
                };
                setTimeout(() => modal.remove(), 7000 + Math.random() * 500);
              }, 500);
            }
          }, totalTime);
        });
      } else {
        // No WhatsApp → check social links or fallback
        showSocialRedirectModal(modalContent, host);
      }

    } catch (err) {
      console.error("Meet deduction failed:", err);
      alert("Something went wrong. Please try again later.");
      modal.remove();
    }
  };
}

/* ---------- Social / No-Meet Fallback Modal ---------- */
function showSocialRedirectModal(modalContent, host) {
  const socialUrl = host.tiktok || host.instagram || "";
  const socialName = host.tiktok ? "TikTok" : host.instagram ? "Instagram" : "";
  const hostName = host.chatId || "This host";

  if (socialUrl) {
    modalContent.innerHTML = `
      <h3 style="margin-bottom:10px;font-weight:600;">Meet ${hostName}?</h3>
      <p style="margin-bottom:16px;">${hostName} isn’t meeting new people via WhatsApp yet.</p>
      <p style="margin-bottom:16px;">Check her out on <b>${socialName}</b> instead?</p>
      <button id="goSocialBtn" style="padding:8px 16px;background:linear-gradient(90deg,#ff0099,#ff6600);border:none;color:#fff;border-radius:8px;font-weight:600;">Go</button>
      <button id="cancelMeet" style="margin-top:10px;padding:8px 16px;background:#333;border:none;color:#fff;border-radius:8px;font-weight:500;">Close</button>
    `;
    modalContent.querySelector("#goSocialBtn").onclick = () => { 
      window.open(socialUrl, "_blank"); 
      modalContent.parentElement.remove(); 
    };
    modalContent.querySelector("#cancelMeet").onclick = () => modalContent.parentElement.remove();
  } else {
    modalContent.innerHTML = `
      <h3 style="margin-bottom:10px;font-weight:600;">Meet ${hostName}?</h3>
      <p style="margin-bottom:16px;">${hostName} isn’t meeting new people yet. Please check back later!</p>
      <button id="cancelMeet" style="padding:8px 16px;background:#333;border:none;color:#fff;border-radius:8px;font-weight:500;">Close</button>
    `;
    modalContent.querySelector("#cancelMeet").onclick = () => modalContent.parentElement.remove();
  }
}

/* ---------- Gift Slider ---------- */
const fieryColors = [
  ["#ff0000", "#ff8c00"], // red to orange
  ["#ff4500", "#ffd700"], // orange to gold
  ["#ff1493", "#ff6347"], // pinkish red
  ["#ff0055", "#ff7a00"], // magenta to orange
  ["#ff5500", "#ffcc00"], // deep orange to yellow
  ["#ff3300", "#ff0066"], // neon red to hot pink
];

// Generate a random fiery gradient
function randomFieryGradient() {
  const [c1, c2] = fieryColors[Math.floor(Math.random() * fieryColors.length)];
  return `linear-gradient(90deg, ${c1}, ${c2})`;
}

/* ---------- Gift Slider ---------- */
giftSlider.addEventListener("input", () => {
  giftAmountEl.textContent = giftSlider.value;
  giftSlider.style.background = randomFieryGradient(); // change fiery color as it slides
});

/* ---------- Modal open (new color each popup) ---------- */
openBtn.addEventListener("click", () => {
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";

  // Give it a fiery flash on open
  giftSlider.style.background = randomFieryGradient();
  console.log("📺 Modal opened");
});

/* ===============================
   🎁 Send Gift + Dual Notification
================================= */

async function sendGift() {
  const receiver = hosts[currentIndex];
  if (!receiver?.id) return showGiftAlert("⚠️ No host selected.");
  if (!currentUser?.uid) return showGiftAlert("Please log in to send stars ⭐");

  const giftStars = parseInt(giftSlider.value, 10);
  if (isNaN(giftStars) || giftStars <= 0)
    return showGiftAlert("Invalid star amount ❌");

  const originalText = giftBtn.textContent;
  const buttonWidth = giftBtn.offsetWidth + "px";
  giftBtn.style.width = buttonWidth;
  giftBtn.disabled = true;
  giftBtn.innerHTML = `<span class="gift-spinner"></span>`;

  try {
    const senderRef = doc(db, "users", currentUser.uid);
    const receiverRef = doc(db, "users", receiver.id);
    const featuredReceiverRef = doc(db, "featuredHosts", receiver.id);

    await runTransaction(db, async (tx) => {
      const senderSnap = await tx.get(senderRef);
      const receiverSnap = await tx.get(receiverRef);

      if (!senderSnap.exists()) throw new Error("Your user record not found.");
      if (!receiverSnap.exists())
        tx.set(receiverRef, { stars: 0, starsGifted: 0, lastGiftSeen: {} }, { merge: true });

      const senderData = senderSnap.data();
      if ((senderData.stars || 0) < giftStars)
        throw new Error("Insufficient stars");

      tx.update(senderRef, { stars: increment(-giftStars), starsGifted: increment(giftStars) });
      tx.update(receiverRef, { stars: increment(giftStars) });
      tx.set(featuredReceiverRef, { stars: increment(giftStars) }, { merge: true });

      tx.update(receiverRef, {
        [`lastGiftSeen.${currentUser.username || "Someone"}`]: giftStars
      });
    });

    // ✅ Notify both sender and receiver
    const senderName = currentUser.username || "Someone";
    const receiverName = receiver.chatId || "User";

    await Promise.all([
      pushNotification(receiver.id, `🎁 ${senderName} sent you ${giftStars} stars ⭐`),
      pushNotification(currentUser.uid, `💫 You sent ${giftStars} stars ⭐ to ${receiverName}`)
    ]);

    showGiftAlert(`✅ You sent ${giftStars} stars ⭐ to ${receiverName}!`);

    if (currentUser.uid === receiver.id) {
      setTimeout(() => {
        showGiftAlert(`🎁 ${senderName} sent you ${giftStars} stars ⭐`);
      }, 1000);
    }

    console.log(`✅ Sent ${giftStars} stars ⭐ to ${receiverName}`);
  } catch (err) {
    console.error("❌ Gift sending failed:", err);
    showGiftAlert(`⚠️ Something went wrong: ${err.message}`);
  } finally {
    giftBtn.innerHTML = originalText;
    giftBtn.disabled = false;
    giftBtn.style.width = "auto";
  }
}

/* ---------- Assign gift button click ---------- */
giftBtn.onclick = sendGift;

/* ---------- Navigation ---------- */
prevBtn.addEventListener("click", e => {
  e.preventDefault();
  loadHost((currentIndex - 1 + hosts.length) % hosts.length);
});

nextBtn.addEventListener("click", e => {
  e.preventDefault();
  loadHost((currentIndex + 1) % hosts.length);
});

/* ---------- Modal control ---------- */
openBtn.addEventListener("click", () => {
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  console.log("📺 Modal opened");
});

closeModal.addEventListener("click", () => {
  modal.style.display = "none";
  console.log("❎ Modal closed");
});

window.addEventListener("click", e => {
  if (e.target === modal) {
    modal.style.display = "none";
    console.log("🪟 Modal dismissed");
  }
});
/* ---------- Init ---------- */
fetchFeaturedHosts();


// --- ✅ Prevent redeclaration across reloads ---
if (!window.verifyHandlersInitialized) {
  window.verifyHandlersInitialized = true;

  // ---------- ✨ SIMPLE GOLD MODAL ALERT ----------
  window.showGoldAlert = function (message, duration = 3000) {
    const existing = document.getElementById("goldAlert");
    if (existing) existing.remove();

    const alertEl = document.createElement("div");
    alertEl.id = "goldAlert";
    Object.assign(alertEl.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "linear-gradient(90deg, #ffcc00, #ff9900)",
      color: "#111",
      padding: "12px 40px",
      borderRadius: "10px",
      fontWeight: "500",
      zIndex: "999999",
      boxShadow: "0 0 12px rgba(255, 215, 0, 0.5)",
      animation: "slideFade 0.4s ease-out",
    });
    alertEl.innerHTML = message;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideFade {
        from {opacity: 0; transform: translate(-50%, -60%);}
        to {opacity: 1; transform: translate(-50%, -50%);}
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(alertEl);
    setTimeout(() => alertEl.remove(), duration);
  };

  // ---------- 🌍 PHONE NORMALIZER (for backend only) ----------
  function normalizePhoneForSearch(number) {
    number = number.replace(/\D/g, "");
    if (number.startsWith("0")) number = number.slice(1);
    return number;
  }

  // ---------- 🔘 CLICK HANDLER ----------
  document.addEventListener("click", (e) => {
    if (e.target.id === "verifyNumberBtn") {
      const numberInput = document.getElementById("verifyNumberInput");
      const numberRaw = numberInput?.value.trim();
      const COST = 21;

      if (!currentUser?.uid) return showGoldAlert("⚠️ Please log in first.");
      if (!numberRaw) return showGoldAlert("⚠️ Please enter a phone number.");

      const normalized = normalizePhoneForSearch(numberRaw);
      showConfirmModal(numberRaw, normalized, COST);
    }
  });

  // ---------- 🟡 CONFIRM MODAL ----------
  window.showConfirmModal = function (displayNumber, normalizedNumber, cost) {
    let modal = document.getElementById("verifyConfirmModal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "verifyConfirmModal";
    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "999999",
      backdropFilter: "blur(2px)",
    });

    modal.innerHTML = `
      <div style="background:#111;padding:16px 18px;border-radius:10px;text-align:center;color:#fff;max-width:280px;box-shadow:0 0 12px rgba(0,0,0,0.5);">
        <h3 style="margin-bottom:10px;font-weight:600;">Verification</h3>
        <p>Scan phone number <b>${displayNumber}</b> for <b>${cost} stars ⭐</b>?</p>
        <div style="display:flex;justify-content:center;gap:10px;margin-top:12px;">
          <button id="cancelVerify" style="padding:6px 12px;border:none;border-radius:6px;background:#333;color:#fff;font-weight:600;cursor:pointer;">Cancel</button>
          <button id="confirmVerify" style="padding:6px 12px;border:none;border-radius:6px;background:linear-gradient(90deg,#ff0099,#ff6600);color:#fff;font-weight:600;cursor:pointer;">Yes</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector("#cancelVerify").onclick = () => modal.remove();
    modal.querySelector("#confirmVerify").onclick = async () => {
      modal.remove();
      await runNumberVerification(normalizedNumber, cost);
    };
  };

  // ---------- 🔍 RUN VERIFICATION ----------
  async function runNumberVerification(number, cost) {
    try {
      // Deduct stars
      currentUser.stars -= cost;
      if (refs?.starCountEl)
        refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);

      await updateDoc(doc(db, "users", currentUser.uid), {
        stars: increment(-cost),
      }).catch(console.error);

      const cleanInput = number.replace(/\D/g, "");
      const lastDigits = cleanInput.slice(-10);

      const usersRef = collection(db, "users");
      const qSnap = await getDocs(usersRef);

      let verifiedUser = null;
      qSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.whatsapp) {
          const storedDigits = data.whatsapp.replace(/\D/g, "").slice(-10);
          if (storedDigits === lastDigits) verifiedUser = data;
        }
      });

      showVerificationModal(verifiedUser);
    } catch (err) {
      console.error("Error verifying number:", err);
      showGoldAlert("❌ Verification failed, please retry!");
    }
  }

  // ---------- 🧾 RESULT MODAL ----------
  function showVerificationModal(user) {
    let modal = document.getElementById("verifyModal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "verifyModal";
    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.75)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "999999",
      backdropFilter: "blur(2px)",
    });

    modal.innerHTML = `
      <div id="verifyModalContent" style="background:#111;padding:14px 16px;border-radius:10px;text-align:center;color:#fff;max-width:280px;box-shadow:0 0 12px rgba(0,0,0,0.5);">
        <p id="stageMsg" style="margin-top:12px;font-weight:500;"></p>
      </div>
    `;
    document.body.appendChild(modal);

    const modalContent = modal.querySelector("#verifyModalContent");
    const stageMsgEl = modalContent.querySelector("#stageMsg");

    // ---------- 🌟 Dynamic Stage Messages ----------
    const fixedStages = [
      "Gathering information…",
      "Checking phone number validity…"
    ];

    const playfulMessages = [
      "Always meet in public spaces for the first time..",
      "Known hotels are safer for meetups 😉",
      "Condoms should be in the conversation always..",
      "Trust your instincts, always..",
      "Keep things fun and safe 😎",
      "Be polite and confident when messaging..",
      "Avoid sharing sensitive info too soon..",
      "Remember, first impressions last ✨",
      "Don’t rush, enjoy the conversation..",
      "Check for verified accounts before proceeding..",
      "Safety first, fun second 😏",
      "Listen carefully to their plans..",
      "Pick neutral locations for first meets..",
      "Be respectful and courteous..",
      "Share your location with a friend..",
      "Always verify identity before meeting..",
      "Plan ahead, stay alert 👀",
      "Keep communication clear and honest..",
      "Bring a friend if unsure..",
      "Set boundaries clearly..",
      "Have fun, but stay safe!"
    ];

    const randomPlayful = [];
    while (randomPlayful.length < 5) {
      const choice = playfulMessages[Math.floor(Math.random() * playfulMessages.length)];
      if (!randomPlayful.includes(choice)) randomPlayful.push(choice);
    }

    const stages = [...fixedStages, ...randomPlayful, "Finalizing check…"];

    let totalTime = 0;
    stages.forEach((stage, index) => {
      const duration = 1400 + Math.random() * 600;
      totalTime += duration;

      setTimeout(() => {
        stageMsgEl.textContent = stage;
        if (index === stages.length - 1) {
          setTimeout(() => {
            modalContent.innerHTML = user
              ? `<h3>Number Verified! ✅</h3>
                 <p>This number belongs to <b>${user.fullName}</b></p>
                 <button id="closeVerifyModal"
                   style="margin-top:12px;padding:6px 14px;border:none;
                   border-radius:8px;background:linear-gradient(90deg,#ff0099,#ff6600);
                   color:#fff;font-weight:600;cursor:pointer;">Close</button>`
              : `<h3>Number Not Verified! ❌</h3>
                 <p>This number doesn’t exist on verified records — be careful!</p>
                 <button id="closeVerifyModal"
                   style="margin-top:12px;padding:6px 14px;border:none;
                   border-radius:8px;background:linear-gradient(90deg,#ff0099,#ff6600);
                   color:#fff;font-weight:600;cursor:pointer;">Close</button>`;

            modal
              .querySelector("#closeVerifyModal")
              .addEventListener("click", () => modal.remove());

            if (user)
              setTimeout(() => modal.remove(), 8000 + Math.random() * 1000);
          }, 500);
        }
      }, totalTime);
    });
  }
}
  // --- Initial random values for first load ---
(function() {
  const onlineCountEl = document.getElementById('onlineCount');
  const storageKey = 'lastOnlineCount';
  
  // Helper: format number as K if > 999
  function formatCount(n) {
    if(n >= 1000) return (n/1000).toFixed(n%1000===0?0:1) + 'K';
    return n;
  }
  
  // Function to get a random starting value
  function getRandomStart() {
    const options = [100, 105, 405, 455, 364, 224];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  // Initialize count from storage or random
  let count = parseInt(localStorage.getItem(storageKey)) || getRandomStart();
  onlineCountEl.textContent = formatCount(count);
  
  // Increment pattern
  const increments = [5,3,4,1];
  let idx = 0;

  // Random threshold to start decreasing (2K–5K)
  let decreaseThreshold = 2000 + Math.floor(Math.random()*3000); 
  
  setInterval(() => {
    if(count < 5000) {
      // Occasionally spike
      if(Math.random() < 0.05) {
        count += Math.floor(Math.random()*500); 
      } else {
        count += increments[idx % increments.length];
      }
      if(count > 5000) count = 5000;
      idx++;
    }
    onlineCountEl.textContent = formatCount(count);
    localStorage.setItem(storageKey, count);
    
    // Reset threshold occasionally
    if(count >= decreaseThreshold) {
      decreaseThreshold = 2000 + Math.floor(Math.random()*3000);
    }
    
  }, 4000);

  // Slow decrease every 30s if above threshold
  setInterval(() => {
    if(count > decreaseThreshold) {
      count -= 10;
      if(count < 500) count = 500;
      onlineCountEl.textContent = formatCount(count);
      localStorage.setItem(storageKey, count);
    }
  }, 30000);
})();



document.addEventListener("DOMContentLoaded", () => {

// ========== 🟣 HOST SETTINGS LOGIC ==========
const isHost = true; // <-- later dynamic
const hostSettingsWrapper = document.getElementById("hostSettingsWrapper");
const hostModal = document.getElementById("hostModal");
const hostSettingsBtn = document.getElementById("hostSettingsBtn");
const closeModal = hostModal?.querySelector(".close");

if (isHost && hostSettingsWrapper) hostSettingsWrapper.style.display = "block";

if (hostSettingsBtn && hostModal && closeModal) {
  hostSettingsBtn.onclick = async () => {
    hostModal.style.display = "block";

    if (!currentUser?.uid) return showStarPopup("⚠️ Please log in first.");

    // Populate fields from Firestore (kept blank until user edits)
    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return showStarPopup("⚠️ User data not found.");

    const data = snap.data();
    document.getElementById("fullName").value = data.fullName || "";
    document.getElementById("city").value = data.city || "";
    document.getElementById("location").value = data.location || "";
    document.getElementById("bio").value = data.bioPick || "";
    document.getElementById("bankAccountNumber").value = data.bankAccountNumber || "";
    document.getElementById("bankName").value = data.bankName || "";
    document.getElementById("telegram").value = data.telegram || "";
    document.getElementById("tiktok").value = data.tiktok || "";
    document.getElementById("whatsapp").value = data.whatsapp || "";
    document.getElementById("instagram").value = data.instagram || "";

    // Update photo preview if exists
    if (data.popupPhoto) {
      const photoPreview = document.getElementById("photoPreview");
      const photoPlaceholder = document.getElementById("photoPlaceholder");
      photoPreview.src = data.popupPhoto;
      photoPreview.style.display = "block";
      photoPlaceholder.style.display = "none";
    }
  };

  closeModal.onclick = () => (hostModal.style.display = "none");
  window.onclick = (e) => {
    if (e.target === hostModal) hostModal.style.display = "none";
  };
}

// ========== 🟠 TAB LOGIC ==========
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((tab) => (tab.style.display = "none"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).style.display = "block";
  };
});

// ========== 🖼️ PHOTO PREVIEW ==========
document.addEventListener("change", (e) => {
  if (e.target.id === "popupPhoto") {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photoPreview = document.getElementById("photoPreview");
      const photoPlaceholder = document.getElementById("photoPlaceholder");
      if (photoPreview && photoPlaceholder) {
        photoPreview.src = reader.result;
        photoPreview.style.display = "block";
        photoPlaceholder.style.display = "none";
      }
    };
    reader.readAsDataURL(file);
  }
});

// ========== 📝 SAVE INFO & MEDIA HANDLER ==========
const saveInfoBtn = document.getElementById("saveInfo");
const saveMediaBtn = document.getElementById("saveMedia");


// -------- Firestore update helper --------
async function updateFirestoreDoc(userId, data) {
  const userRef = doc(db, "users", userId);

  // Only filter undefined (allow clearing fields to "")
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );

  await updateDoc(userRef, { ...filteredData, lastUpdated: serverTimestamp() });

  // Sync to featuredHosts if doc exists
  const hostRef = doc(db, "featuredHosts", userId);
  const hostSnap = await getDoc(hostRef);
  if (hostSnap.exists()) {
    await updateDoc(hostRef, { ...filteredData, lastUpdated: serverTimestamp() });
  }
}

// -------- Save Info --------
if (saveInfoBtn) {
  saveInfoBtn.onclick = async () => {
    if (!currentUser?.uid) return showStarPopup("⚠️ Please log in first.");

    const fullName = document.getElementById("fullName")?.value || "";
    const city = document.getElementById("city")?.value || "";
    const location = document.getElementById("location")?.value || "";
    const bio = document.getElementById("bio")?.value || "";
    const bankAccountNumber = document.getElementById("bankAccountNumber")?.value || "";
    const bankName = document.getElementById("bankName")?.value || "";
    const telegram = document.getElementById("telegram")?.value || "";
    const tiktok = document.getElementById("tiktok")?.value || "";
    const whatsapp = document.getElementById("whatsapp")?.value || "";
    const instagram = document.getElementById("instagram")?.value || "";
    const naturePickEl = document.getElementById("naturePick");
    const fruitPickEl = document.getElementById("fruitPick");
    const naturePick = naturePickEl?.value || "";
    const fruitPick = fruitPickEl?.value || "";

    if (bankAccountNumber && !/^\d{1,11}$/.test(bankAccountNumber)) {
      return showStarPopup("⚠️ Bank account number must be digits only (max 11).");
    }
    if (whatsapp && !/^\d+$/.test(whatsapp)) {
      return showStarPopup("⚠️ WhatsApp number must be numbers only.");
    }

    const dataToUpdate = {
      fullName: fullName ? fullName.replace(/\b\w/g, l => l.toUpperCase()) : "",
      city,
      location,
      bioPick: bio,
      bankAccountNumber,
      bankName,
      telegram,
      tiktok,
      whatsapp,
      instagram,
      naturePick,
      fruitPick
    };

    // ---------- Tiny centered spinner ----------
    const originalHTML = saveInfoBtn.innerHTML;
    saveInfoBtn.innerHTML = `
      <div class="spinner" style="
        width:12px;
        height:12px;
        border:2px solid #fff;
        border-top-color:transparent;
        border-radius:50%;
        animation: spin 0.6s linear infinite;
        margin:auto;
      "></div>
    `;
    saveInfoBtn.disabled = true;
    saveInfoBtn.style.display = "flex";
    saveInfoBtn.style.alignItems = "center";
    saveInfoBtn.style.justifyContent = "center";

    try {
      await updateFirestoreDoc(currentUser.uid, dataToUpdate);
      showStarPopup("✅ Profile updated successfully!");

      // Keep dropdown selections visible
      if (naturePickEl) naturePickEl.value = naturePick;
      if (fruitPickEl) fruitPickEl.value = fruitPick;

      document.querySelectorAll("#mediaTab input, #mediaTab textarea, #mediaTab select")
              .forEach(input => input.blur());
    } catch (err) {
      console.error("❌ Error updating Firestore:", err);
      showStarPopup("⚠️ Failed to update info. Please try again.");
    } finally {
      saveInfoBtn.innerHTML = originalHTML;
      saveInfoBtn.disabled = false;
      saveInfoBtn.style.display = "";
      saveInfoBtn.style.alignItems = "";
      saveInfoBtn.style.justifyContent = "";
    }
  };
}

// -------- Save Media --------
if (saveMediaBtn) {
  saveMediaBtn.onclick = async () => {
    if (!currentUser?.uid) return showStarPopup("⚠️ Please log in first.");

    const popupPhotoFile = document.getElementById("popupPhoto")?.files[0];
    const uploadVideoFile = document.getElementById("uploadVideo")?.files[0];

    if (!popupPhotoFile && !uploadVideoFile) {
      return showStarPopup("⚠️ Please select a photo or video to upload.");
    }

    try {
      showStarPopup("⏳ Uploading media...");

      const formData = new FormData();
      if (popupPhotoFile) formData.append("photo", popupPhotoFile);
      if (uploadVideoFile) formData.append("video", uploadVideoFile);

      const res = await fetch("/api/uploadShopify", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed. Check your network.");

      const data = await res.json(); // { photoUrl: "...", videoUrl: "..." }

      await updateFirestoreDoc(currentUser.uid, {
        ...(data.photoUrl && { popupPhoto: data.photoUrl }),
        ...(data.videoUrl && { videoUrl: data.videoUrl }),
      });

      // Update preview if photo exists
      if (data.photoUrl) {
        const photoPreview = document.getElementById("photoPreview");
        const photoPlaceholder = document.getElementById("photoPlaceholder");
        photoPreview.src = data.photoUrl;
        photoPreview.style.display = "block";
        photoPlaceholder.style.display = "none";
      }

      showStarPopup("✅ Media uploaded successfully!");
      hostModal.style.display = "none";

    } catch (err) {
      console.error("❌ Media upload error:", err);
      showStarPopup(`⚠️ Failed to upload media: ${err.message}`);
    }
  };
}
/* ======================================================
  Social Card + Gift Stars System — Firestore + Chat Banner
  Paste AFTER Firebase/Firestore initialized
====================================================== */
(async function initSocialCardSystem() {
  const allUsers = [];
  const usersByChatId = {};

  try {
    const usersRef = collection(db, "users");
    const snaps = await getDocs(usersRef);
    snaps.forEach(docSnap => {
      const data = docSnap.data();
      const chatIdLower = (data.chatIdLower || (data.chatId || "")).toLowerCase();
      data._docId = docSnap.id;
      data.chatIdLower = chatIdLower;
      allUsers.push(data);
      usersByChatId[chatIdLower] = data;
    });
    console.log('Social card: loaded', allUsers.length, 'users');
  } catch (err) {
    console.error("Failed to fetch users for social card:", err);
  }

  function showSocialCard(user) {
    if (!user) return;

    // Remove existing
    document.getElementById('socialCard')?.remove();

    const card = document.createElement('div');
    card.id = 'socialCard';
    Object.assign(card.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'linear-gradient(135deg,#0f0f10,#19191b)',
      borderRadius: '16px',
      padding: '18px 20px',
      color: '#fff',
      width: '260px',
      maxWidth: '90%',
      zIndex: '999999',
      textAlign: 'center',
      boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
      fontFamily: 'Poppins, sans-serif',
      opacity: '0',
      transition: 'opacity .18s ease, transform .18s ease'
    });

    // --- Header ---
    const chatIdDisplay = user.chatId ? user.chatId.charAt(0).toUpperCase() + user.chatId.slice(1) : 'Unknown';
    const color = user.isHost ? '#ff6600' : user.isVIP ? '#ff0099' : '#cccccc';
    const header = document.createElement('h3');
    header.textContent = chatIdDisplay;
    Object.assign(header.style, {
      margin: '0 0 8px',
      fontSize: '18px',
      fontWeight: '700',
      background: `linear-gradient(90deg, ${color}, #ff33cc)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    });
    card.appendChild(header);

    // --- Details ---
    const detailsEl = document.createElement('p');
    detailsEl.style.margin = '0 0 12px';
    detailsEl.style.fontSize = '14px';
    detailsEl.style.lineHeight = '1.4';
    const flairText = user.flair || '';
    const pronoun = user.pronoun || 'their';
    const ageGroup = user.ageGroup || (user.age ? `${user.age} yrs` : 'young');
    const gender = user.gender || 'User';
    const country = user.country || '';
    const city = user.city || '';
    if (user.isHost) {
      const fruit = user.fruitPick || '🍒';
      const nature = user.naturePick || 'vibe';
      detailsEl.innerHTML = `A ${fruit} ${nature} ${gender} in ${pronoun} ${ageGroup}, currently in ${city || 'somewhere'}, ${country || ''}. ${flairText}`;
    } else if (user.isVIP) {
      detailsEl.innerHTML = `A ${gender} in ${pronoun} ${ageGroup}, currently in ${city || 'somewhere'}, ${country || ''}. ${flairText}`;
    } else {
      detailsEl.innerHTML = `A ${gender} from ${city || 'somewhere'}, ${country || ''}. ${flairText}`;
    }
    card.appendChild(detailsEl);

    // --- Bio ---
    const bioEl = document.createElement('div');
    bioEl.style.margin = '8px 0 14px';
    bioEl.style.fontStyle = 'italic';
    bioEl.style.fontSize = '13px';
    card.appendChild(bioEl);
    typeWriterEffect(bioEl, user.bioPick || '✨ Nothing shared yet...');

    // --- Buttons wrapper ---
    const btnWrap = document.createElement('div');
    Object.assign(btnWrap.style, { display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginTop: '6px' });

    // Meet button (hosts only)
    if (user.isHost) {
      const meetBtn = document.createElement('button');
      meetBtn.textContent = 'Meet';
      Object.assign(meetBtn.style, {
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        fontWeight: '600',
        background: 'linear-gradient(90deg,#ff6600,#ff0099)',
        color: '#fff',
        cursor: 'pointer'
      });
      meetBtn.onclick = () => { if (typeof showMeetModal === 'function') showMeetModal(user); };
      btnWrap.appendChild(meetBtn);
    }

    // --- Slider to choose stars ---
    const sliderWrapper = document.createElement('div');
    sliderWrapper.style.display = 'flex';
    sliderWrapper.style.alignItems = 'center';
    sliderWrapper.style.width = '100%';
    sliderWrapper.style.gap = '10px';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 999;
    slider.value = 0;
    slider.style.flex = '1';
    sliderWrapper.appendChild(slider);

    const sliderLabel = document.createElement('span');
    sliderLabel.textContent = `${slider.value} ⭐️`;
    sliderLabel.style.fontSize = '14px';
    sliderWrapper.appendChild(sliderLabel);

    slider.oninput = () => sliderLabel.textContent = `${slider.value} ⭐️`;

    btnWrap.appendChild(sliderWrapper);

    // --- Gift button ---
    const giftBtnLocal = document.createElement('button');
    giftBtnLocal.textContent = 'Gift Stars ⭐️';
    Object.assign(giftBtnLocal.style, {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      fontWeight: '600',
      background: 'linear-gradient(90deg,#ff0099,#ff33cc)',
      color: '#fff',
      cursor: 'pointer'
    });
    giftBtnLocal.onclick = () => {
      const amt = parseInt(slider.value);
      if (!amt || amt < 100) return showStarPopup("🔥 Minimum gift is 100 ⭐️");
      if ((currentUser?.stars || 0) < amt) return showStarPopup("Not enough stars 💫");
      sendStarsToUser(user, amt);
      slider.value = 0;
      sliderLabel.textContent = `0 ⭐️`;
    };
    btnWrap.appendChild(giftBtnLocal);

    card.appendChild(btnWrap);

    // Append & animate
    document.body.appendChild(card);
    requestAnimationFrame(() => { card.style.opacity = '1'; card.style.transform = 'translate(-50%, -50%) scale(1.02)'; setTimeout(() => card.style.transform = 'translate(-50%, -50%) scale(1)', 120); });

    // Click outside to close
    const closeHandler = (ev) => { if (!card.contains(ev.target)) { card.remove(); document.removeEventListener('click', closeHandler); } };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  function typeWriterEffect(el, text, speed = 35) {
    el.textContent = '';
    let i = 0;
    const iv = setInterval(() => { el.textContent += text.charAt(i) || ''; i++; if (i >= text.length) clearInterval(iv); }, speed);
  }

  // --- USERNAME TAP DETECTOR ---
  document.addEventListener('pointerdown', (e) => {
    const target = e.target;
    if (!target || !target.textContent) return;

    const txt = target.textContent.trim();
    if (!txt || txt.includes(':')) return; // avoid chat line clicks
    const chatId = txt.split(' ')[0].trim(); // exact username
    if (!chatId) return;

    const user = usersByChatId[chatId.toLowerCase()] || allUsers.find(u => (u.chatId || '').toLowerCase() === chatId.toLowerCase());
    if (!user || user._docId === currentUser?.uid) return;

    // Blink effect
    const originalColor = target.style.backgroundColor;
    target.style.backgroundColor = '#ffcc00';
    setTimeout(() => target.style.backgroundColor = originalColor, 180);

    // Show popup
    showSocialCard(user);
  });

  // --- SEND STARS FUNCTION ---
  async function sendStarsToUser(targetUser, amt) {
  const fromRef = doc(db, "users", currentUser.uid);
  const toRef = doc(db, "users", targetUser._docId);
  const glowColor = randomColor();

  await Promise.all([
    updateDoc(fromRef, { stars: increment(-amt), starsGifted: increment(amt) }),
    updateDoc(toRef, { stars: increment(amt) })
  ]);

  // System banner message — UID and chatId are irrelevant here
  const bannerMsg = {
    content: `💫 ${currentUser.chatId} gifted ${amt} ⭐️ to ${targetUser.chatId}!`,
    timestamp: serverTimestamp(),
    highlight: true,
    buzzColor: glowColor,
    systemBanner: true // add a flag so renderer knows it’s pure text
  };

  const docRef = await addDoc(collection(db, CHAT_COLLECTION), bannerMsg);

  // Render banner without prepending chatId/uid
  renderMessagesFromArray([{ id: docRef.id, data: bannerMsg }], true); // pass `true` to indicate pure banner

  // Apply glow effect
  const msgEl = document.getElementById(docRef.id);
  if (!msgEl) return;
  const contentEl = msgEl.querySelector(".content") || msgEl;
  contentEl.style.setProperty("--pulse-color", glowColor);
  contentEl.classList.add("baller-highlight");
  setTimeout(() => { contentEl.classList.remove("baller-highlight"); contentEl.style.boxShadow = "none"; }, 21000);
}

})();

// 🌤️ Dynamic Host Panel Greeting
function capitalizeFirstLetter(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setGreeting() {
  const chatId = currentUser?.chatId || "Guest";
  const name = capitalizeFirstLetter(chatId);
  const hour = new Date().getHours();

  let greeting, emoji;
  if (hour < 12) {
    greeting = `Good Morning, ${name}! ☀️`;
  } else if (hour < 18) {
    greeting = `Good Afternoon, ${name}! ⛅️`;
  } else {
    greeting = `Good Evening, ${name}! 🌙`;
  }

  document.getElementById("hostPanelTitle").textContent = greeting;
}

// Run whenever the modal opens
hostSettingsBtn.addEventListener("click", () => {
  setGreeting();
});


const scrollArrow = document.getElementById('scrollArrow');
  const chatContainer = document.querySelector('#chatContainer'); // your chat wrapper
  let fadeTimeout;

  function showArrow() {
    scrollArrow.classList.add('show');
    if (fadeTimeout) clearTimeout(fadeTimeout);
    fadeTimeout = setTimeout(() => {
      scrollArrow.classList.remove('show');
    }, 2000); // disappears after 2 seconds
  }

  function checkScroll() {
    const distanceFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
    if (distanceFromBottom > 200) { // threshold for showing arrow
      showArrow();
    }
  }

  chatContainer.addEventListener('scroll', checkScroll);

  scrollArrow.addEventListener('click', () => {
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: 'smooth'
    });
  });

  checkScroll(); // initial check
}); // ✅ closes DOMContentLoaded event listener
