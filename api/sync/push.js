/**
 * Push Sync Endpoint
 * POST /api/sync/push
 *
 * Uploads client changes to Firestore
 * Handles conflict resolution using timestamps
 */

import { adminAuth, adminDb } from '../../lib/firebase-admin.js';

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin;
  if (origin && origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
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

    // Parse request body
    const { words = [], reviews = [], deviceId, timestamp } = req.body;

    if (!deviceId || typeof deviceId !== 'string' || !timestamp || typeof timestamp !== 'number') {
      return res.status(400).json({ error: 'Missing or invalid deviceId or timestamp' });
    }

    // Prepare updates for Realtime Database
    const updates = {};
    let wordCount = 0;
    let reviewCount = 0;

    // Helper function to encode ID for Firebase Realtime Database
    // Firebase keys cannot contain . $ # [ ] / or ASCII control characters
    const encodeFirebaseKey = (key) => {
      return key
        .replace(/\./g, '%2E')
        .replace(/\$/g, '%24')
        .replace(/#/g, '%23')
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D')
        .replace(/\//g, '%2F');
    };

    // Process word changes
    for (const word of words) {
      const encodedWordId = encodeFirebaseKey(word.id);
      const wordPath = `users/${userId}/words/${encodedWordId}`;

      // Get existing data for conflict resolution
      const existingSnapshot = await adminDb.ref(wordPath).get();

      if (existingSnapshot.exists()) {
        const existingData = existingSnapshot.val();

        // Conflict resolution: latest updatedAt wins
        if (existingData.updatedAt > word.updatedAt) {
          continue; // Skip this word, server version is newer
        }
      }

      // Add metadata
      const wordData = {
        ...word,
        syncedAt: timestamp,
        syncedFrom: deviceId,
      };

      updates[wordPath] = wordData;
      wordCount++;
    }

    // Process review changes
    for (const review of reviews) {
      const encodedReviewId = encodeFirebaseKey(review.id);
      const reviewPath = `users/${userId}/reviews/${encodedReviewId}`;

      // Get existing data for conflict resolution
      const existingSnapshot = await adminDb.ref(reviewPath).get();

      if (existingSnapshot.exists()) {
        const existingData = existingSnapshot.val();

        // Conflict resolution: latest history entry wins
        const existingLastReview = existingData.history?.[existingData.history.length - 1];
        const newLastReview = review.history?.[review.history.length - 1];

        if (existingLastReview && newLastReview && existingLastReview.reviewedAt > newLastReview.reviewedAt) {
          continue; // Skip this review, server version is newer
        }
      }

      // Add metadata
      const reviewData = {
        ...review,
        syncedAt: timestamp,
        syncedFrom: deviceId,
      };

      updates[reviewPath] = reviewData;
      reviewCount++;
    }

    // Apply all updates atomically
    await adminDb.ref().update(updates);

    return res.status(200).json({
      success: true,
      synced: {
        words: wordCount,
        reviews: reviewCount,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Push sync error:', error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(500).json({
      error: 'Push sync failed',
      message: error.message,
    });
  }
}
