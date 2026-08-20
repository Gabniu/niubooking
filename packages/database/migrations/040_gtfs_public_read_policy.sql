-- Permit only the narrow public Schedule metadata projection to cross tenant RLS.
DROP POLICY gtfs_feed_settings_tenant_isolation ON gtfs_feed_settings;
CREATE POLICY gtfs_feed_settings_tenant_isolation ON gtfs_feed_settings
  USING (tenant_id = current_setting('booking.tenant_id', true)
    OR current_setting('booking.public_feed', true) = 'true');

DROP POLICY gtfs_feed_versions_tenant_isolation ON gtfs_feed_versions;
CREATE POLICY gtfs_feed_versions_tenant_isolation ON gtfs_feed_versions
  USING (tenant_id = current_setting('booking.tenant_id', true)
    OR current_setting('booking.public_feed', true) = 'true');
