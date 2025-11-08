import admin from "firebase-admin";

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const snapshot = await db.collection("highlightVideos")
      .where("uploaderId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ videos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch highlights" });
  }
}
