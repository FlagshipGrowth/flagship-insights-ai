-- Phone number dropped from lead info entirely — never collected by the contact form anyway,
-- and not wanted in the CRM at all per Joey.
alter table leads drop column phone;
