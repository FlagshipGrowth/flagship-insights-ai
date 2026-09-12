-- Migration 0013 stored the Hapad US inventory report as "hapad-us-inventory", which 404s.
-- The live report is actually served at "hapad-inventory" (no region suffix) for the US region
-- -- confirmed via its page title "Hapad Weekly Inventory Updates & PO Recommendations".
update brands
set inventory_report_urls = '[
    {"label": "US", "url": "https://reports.flagshipgrowth.com/hapad-inventory"},
    {"label": "Canada", "url": "https://reports.flagshipgrowth.com/hapad-canada-inventory"}
  ]'
where name = 'Hapad';
