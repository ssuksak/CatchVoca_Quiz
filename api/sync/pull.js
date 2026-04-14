/**
 * Pull Sync Endpoint
 * GET /api/sync/pull
 *
 * Downloads server changes to client
 * Supports incremental sync using lastSyncedAt timestamp
 */

import { adminAuth, adminDb } from '../../lib/firebase-admin.js';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  if (origin && origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    // Verify Firebase ID Token (secure signature verification)
    const idToken = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token: missing uid' });
    }

    // Parse query parameters
    const lastSyncedAt = parseInt(req.query.lastSyncedAt || '0', 10);

    // Helper function to decode Firebase key back to original ID
    const decodeFirebaseKey = (key) => {
      return key
        .replace(/%2E/g, '.')
        .replace(/%24/g, '$')
        .replace(/%23/g, '#')
        .replace(/%5B/g, '[')
        .replace(/%5D/g, ']')
        .replace(/%2F/g, '/');
    };

    // Query words from Realtime Database
    const wordsRef = adminDb.ref(`users/${userId}/words`);
    const wordsSnapshot = await wordsRef.get();

    let words = [];
    if (wordsSnapshot.exists()) {
      const wordsData = wordsSnapshot.val();
      words = Object.values(wordsData).filter((word) => {
        // Incremental sync: only include changes since last sync
        if (lastSyncedAt > 0) {
          return word.updatedAt > lastSyncedAt;
        }
        return true;
      });
    }

    // Query reviews from Realtime Database
    const reviewsRef = adminDb.ref(`users/${userId}/reviews`);
    const reviewsSnapshot = await reviewsRef.get();

    let reviews = [];
    if (reviewsSnapshot.exists()) {
      const reviewsData = reviewsSnapshot.val();
      reviews = Object.values(reviewsData).filter((review) => {
        // Incremental sync: only include changes since last sync
        if (lastSyncedAt > 0) {
          return review.updatedAt > lastSyncedAt;
        }
        return true;
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        words,
        reviews,
      },
      timestamp: Date.now(),
      totalWords: words.length,
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error('Pull sync error:', error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(500).json({
      error: 'Pull sync failed',
      message: error.message,
    });
  }
}
