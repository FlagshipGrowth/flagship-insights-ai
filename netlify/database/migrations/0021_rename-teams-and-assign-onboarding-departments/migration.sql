-- Renames team values to the "<Name> Team" convention Joey wants ("Account Manager" is the one
-- deliberate exception — his own list keeps it as-is, no "Team" suffix), adds a new "SEO Team"
-- (needed for "SEO Copy" below, not in the original six), and widens the CHECK constraint to
-- match. "Customer Service Team" isn't assigned to any onboarding task below but is kept as a
-- selectable option rather than dropped, since removing it is a bigger behavioral change than
-- just leaving an unused-for-now option in place.
alter table tasks drop constraint tasks_team_check;

update tasks set team = 'Creative Team' where team = 'Creative';
update tasks set team = 'Inventory Team' where team = 'Inventory';
update tasks set team = 'Ads Team' where team = 'Ads';
update tasks set team = 'Customer Service Team' where team = 'Customer Service';

alter table tasks add constraint tasks_team_check
  check (team in ('Creative Team', 'Inventory Team', 'Ads Team', 'Customer Service Team', 'Catalog Team', 'Account Manager', 'SEO Team'));

-- Auto-assigns every brand's copy of each standard onboarding-checklist task (migration 0017) to
-- its department, per Joey's mapping. Scoped to `category is not null` so this only ever touches
-- the seeded checklist rows, not an unrelated manually-created task that happens to share a title
-- (manual tasks, via the "Add task" form, never get a category).
update tasks set team = 'Catalog Team' where category is not null and title = 'Account Health (INFORM Act & Compliance)';
update tasks set team = 'Account Manager' where category is not null and title = 'Complete Master Spec Sheet';
update tasks set team = 'Account Manager' where category is not null and title = 'Brand Registry Access';
update tasks set team = 'Catalog Team' where category is not null and title = 'Category Approval';
update tasks set team = 'Catalog Team' where category is not null and title = 'Manufacturing vs. Amazon Barcode Setup';
update tasks set team = 'Catalog Team' where category is not null and title = 'SKU Creation';
update tasks set team = 'Catalog Team' where category is not null and title = 'FBA Listing Creation';
update tasks set team = 'Catalog Team' where category is not null and title = 'Variant Merging';
update tasks set team = 'Inventory Team' where category is not null and title = 'Capacity Manager Health';
update tasks set team = 'Inventory Team' where category is not null and title = 'Warehouse Address';
update tasks set team = 'Inventory Team' where category is not null and title = 'Return Handling';
update tasks set team = 'Inventory Team' where category is not null and title = 'FBA Inventory Plan';
update tasks set team = 'Inventory Team' where category is not null and title = 'Handling Time';
update tasks set team = 'Inventory Team' where category is not null and title = 'Weekend Operations';
update tasks set team = 'Inventory Team' where category is not null and title = 'Fulfilled by Merchant (FBM)';
update tasks set team = 'Inventory Team' where category is not null and title = 'Pilot Order — FBM';
update tasks set team = 'SEO Team' where category is not null and title = 'SEO Copy';
update tasks set team = 'Creative Team' where category is not null and title = 'Infographic Images';
update tasks set team = 'Creative Team' where category is not null and title = 'Main Image';
update tasks set team = 'Creative Team' where category is not null and title = 'A+ Content (Basic)';
update tasks set team = 'Creative Team' where category is not null and title = 'A+ Premium Content';
update tasks set team = 'Creative Team' where category is not null and title = 'Brand Story';
update tasks set team = 'Creative Team' where category is not null and title = 'Brand Store';
update tasks set team = 'Creative Team' where category is not null and title = 'Product Video';
update tasks set team = 'Ads Team' where category is not null and title = 'Ad Account Setup';
update tasks set team = 'Ads Team' where category is not null and title = 'Ad Strategy & Launch Plan';
update tasks set team = 'Ads Team' where category is not null and title = 'Budget Alignment';
update tasks set team = 'Ads Team' where category is not null and title = 'Pricing Strategy';
update tasks set team = 'Account Manager' where category is not null and title = 'Attribution Links';
update tasks set team = 'Account Manager' where category is not null and title = 'Cross Promotions';
update tasks set team = 'Account Manager' where category is not null and title = 'Vine Enrollment';
update tasks set team = 'Account Manager' where category is not null and title = 'Subscribe & Save';
update tasks set team = 'Account Manager' where category is not null and title = 'Virtual Bundles';
update tasks set team = 'Account Manager' where category is not null and title = 'Business Pricing — Tier Discount';
update tasks set team = 'Account Manager' where category is not null and title = 'Creator Connections';
update tasks set team = 'Account Manager' where category is not null and title = 'Helium 10';
update tasks set team = 'Catalog Team' where category is not null and title = 'Shelf Life';
update tasks set team = 'Catalog Team' where category is not null and title = 'Product Documentation (Lab Test, COA, SDS)';
