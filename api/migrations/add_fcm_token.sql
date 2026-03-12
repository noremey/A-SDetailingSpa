-- Add FCM token column to push_subscriptions table
-- Run this migration to support Firebase Cloud Messaging

ALTER TABLE push_subscriptions
  ADD COLUMN fcm_token VARCHAR(255) DEFAULT NULL AFTER auth,
  ADD UNIQUE INDEX idx_fcm_token (fcm_token);

-- Make endpoint nullable (FCM subscriptions won't have a VAPID endpoint)
ALTER TABLE push_subscriptions
  MODIFY COLUMN endpoint VARCHAR(500) DEFAULT NULL,
  MODIFY COLUMN p256dh VARCHAR(255) DEFAULT NULL,
  MODIFY COLUMN auth VARCHAR(255) DEFAULT NULL;
