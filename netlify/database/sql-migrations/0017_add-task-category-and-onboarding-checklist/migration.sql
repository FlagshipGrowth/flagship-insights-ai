-- Groups tasks by section (Catalog & Setup, Advertising, etc.) so the standard onboarding
-- checklist below doesn't render as one flat 38-row list on the internal brand hub.
alter table tasks add column category text;

-- Every brand gets the same standard onboarding checklist Joey handed over, seeded as 'todo'
-- ("Pending" in his sheet). "Capacity Manager Health" had no status marked in his sheet (unlike
-- its siblings) — included anyway as a real task rather than dropped, since that's the safer,
-- easily-correctable assumption. Owner/ClickUp notes only existed for one row (Manufacturing vs.
-- Amazon Barcode Setup); everything else has no assignee/description.
-- New brands going forward get this same list via lib/onboarding-tasks.ts, run from the Clerk
-- "organization.created" webhook — kept as a separate TS copy rather than generated from this
-- migration, since a migration is a frozen, one-time historical statement.
insert into tasks (brand_id, category, title, description, assignee, status)
select b.id, t.category, t.title, t.description, t.assignee, 'todo'
from brands b
cross join (
  values
    ('Catalog & Setup', 'Account Health (INFORM Act & Compliance)', null, null),
    ('Catalog & Setup', 'Complete Master Spec Sheet', null, null),
    ('Catalog & Setup', 'Brand Registry Access', null, null),
    ('Catalog & Setup', 'Category Approval', null, null),
    ('Catalog & Setup', 'Manufacturing vs. Amazon Barcode Setup', 'See ClickUp SOP.', 'FSG'),
    ('Catalog & Setup', 'SKU Creation', null, null),
    ('Catalog & Setup', 'FBA Listing Creation', null, null),
    ('Catalog & Setup', 'Variant Merging', null, null),
    ('Inventory Management (FBA)', 'Capacity Manager Health', null, null),
    ('Inventory Management (FBA)', 'Warehouse Address', null, null),
    ('Inventory Management (FBA)', 'Return Handling', null, null),
    ('Inventory Management (FBA)', 'FBA Inventory Plan', null, null),
    ('FBM Capabilities', 'Handling Time', null, null),
    ('FBM Capabilities', 'Weekend Operations', null, null),
    ('FBM Capabilities', 'Fulfilled by Merchant (FBM)', null, null),
    ('FBM Capabilities', 'Pilot Order — FBM', null, null),
    ('Listing Optimization', 'SEO Copy', null, null),
    ('Listing Optimization', 'Infographic Images', null, null),
    ('Listing Optimization', 'Main Image', null, null),
    ('Listing Optimization', 'A+ Content (Basic)', null, null),
    ('Listing Optimization', 'A+ Premium Content', null, null),
    ('Listing Optimization', 'Brand Story', null, null),
    ('Listing Optimization', 'Brand Store', null, null),
    ('Listing Optimization', 'Product Video', null, null),
    ('Advertising', 'Ad Account Setup', null, null),
    ('Advertising', 'Ad Strategy & Launch Plan', null, null),
    ('Advertising', 'Budget Alignment', null, null),
    ('Advertising', 'Pricing Strategy', null, null),
    ('Marketing Initiatives', 'Attribution Links', null, null),
    ('Marketing Initiatives', 'Cross Promotions', null, null),
    ('Marketing Initiatives', 'Vine Enrollment', null, null),
    ('Marketing Initiatives', 'Subscribe & Save', null, null),
    ('Marketing Initiatives', 'Virtual Bundles', null, null),
    ('Marketing Initiatives', 'Business Pricing — Tier Discount', null, null),
    ('Marketing Initiatives', 'Creator Connections', null, null),
    ('Software', 'Helium 10', null, null),
    ('Optional', 'Shelf Life', null, null),
    ('Optional', 'Product Documentation (Lab Test, COA, SDS)', null, null)
) as t(category, title, description, assignee);
