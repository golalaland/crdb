const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST")
      return res.status(405).send("Method Not Allowed");

    const { videoId, userId } = req.body;
    if (!videoId || !userId)
      return res.status(400).json({ error: "Missing videoId or userId" });

    const videoRef = db.collection("highlightVideos").doc(videoId);
    const userRef = db.collection("users").doc(userId);

    await db.runTransaction(async (tx) => {
      const videoSnap = await tx.get(videoRef);
      const userSnap = await tx.get(userRef);

      if (!videoSnap.exists()) throw new Error("Video not found");
      if (!userSnap.exists()) throw new Error("User not found");

      const videoData = videoSnap.data();
      const userData = userSnap.data();
      const price = parseInt(videoData.highlightVideoPrice || 100, 10);
      const currentStars = parseInt(userData.stars || 0, 10);

      if (userId === videoData.uploaderId)
        throw new Error("Cannot unlock your own video");
      if (currentStars < price) throw new Error("Insufficient stars ⭐");

      const uploaderRef = db.collection("users").doc(videoData.uploaderId);
      tx.update(userRef, { stars: admin.firestore.FieldValue.increment(-price) });
      tx.update(uploaderRef, { stars: admin.firestore.FieldValue.increment(price) });

      // Record unlock
      const unlockRef = db.collection("highlightUnlocks").doc(`${videoId}_${userId}`);
      tx.set(unlockRef, { videoId, userId, unlockedAt: admin.firestore.Timestamp.now() });
    });

    res.status(200).json({ success: true, videoId });
  } catch (err) {
    console.error("🔥 unlockVideo error:", err);
    res.status(400).json({ error: err.message });
  }
};
