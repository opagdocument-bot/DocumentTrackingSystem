-- Reference data — ported from app/src/data/seed.ts (offices, programs).
-- Pure structural data: office names/types and program names/colors.
-- Not the process map (stays in code) and not sample documents (none exist).

insert into offices (code, name, type, is_routable) values
  ('OPAG', 'Office of the Provincial Agriculturist', 'opa_division', true),
  ('ADMIN', 'Administrative Division', 'opa_division', true),
  ('FOD', 'Field Operations Division', 'opa_division', true),
  ('PLANNING', 'Planning Unit', 'opa_division', true),
  ('FISHERIES', 'Fisheries & Aquatic Resources Division', 'opa_division', true),
  ('FMSD', 'Farm Management Services Division', 'opa_division', true),
  ('APADTC', 'Aurora Provincial Agricultural Devt & Training Center', 'opa_facility', false),
  ('AFTC', 'Aurora Fisheries Technology Center', 'opa_facility', false),
  ('GOV', 'Governor''s Office', 'pg_office', true),
  ('BUDGET', 'Provincial Budget Office', 'pg_office', true),
  ('ACCT', 'Provincial Accounting Office', 'pg_office', true),
  ('TREAS', 'Provincial Treasurer’s Office', 'pg_office', true),
  ('HRMO', 'Human Resource Management Office', 'pg_office', true),
  ('GSO', 'General Services Office', 'pg_office', true),
  ('BAC', 'BAC Office', 'pg_office', true),
  ('ADMINOFF', 'Office of the Provincial Administrator', 'pg_office', true),
  ('BANK', 'Land Bank / servicing bank', 'external', true),
  ('EXTERNAL', 'External sender', 'external', false);

insert into programs (code, name, color) values
  ('AGRIBIZ', 'Agribusiness & Marketing Program', '#F9CFA6'),
  ('CORN & CASSAVA', 'Corn & Cassava Program', '#F6E48A'),
  ('FISHERY & AQUATIC', 'Fishery & Aquatic Division', '#CCE7B0'),
  ('GAD', 'Gender & Development Program', '#BFD9EC'),
  ('HVCDP', 'High Value Crops Development Program', '#E0CDEC'),
  ('ORGANIC', 'Organic Agriculture Program', '#C00000'),
  ('4H', '4H Program (RBO)', '#E8751A'),
  ('RIC', 'Rural Improvement Club Program (RBO)', '#7B3F00'),
  ('P4MP', 'Pambansang Mannalon, Magbabaul, Mag-uuma, Magsasaka ng Pilipinas (RBO)', '#1B7F79'),
  ('RICE', 'Rice Program', '#4A4A2A'),
  ('AGRI TOURISM', 'Farm Tourism Development Program', '#D98880'),
  ('APADTC', 'Aurora Provincial Agricultural Development and Training Center', '#0563C1'),
  ('ADESs', 'Agricultural Development Satellite Station', '#8E7CC3'),
  ('AFTEc', 'Aurora Fresh Water Technology Center', '#45B39D'),
  ('PAFES', 'Province-led Agriculture and Fishery Extension System', '#2E8B22'),
  ('SPA', 'Special Program in Agriculture', '#B7950B'),
  ('INSTI', 'Institutional Development Program', '#5D6D7E'),
  ('PCPC', 'Support Projects to Provincial Council for the Protection of Children', '#F04E98'),
  ('ARAW NG AGRI', 'Araw ng Agrikultura', '#D68910'),
  ('ARP', 'Agricultural Resiliency Program', '#A93226'),
  ('LDRRM', '5% LDRRM Funds', '#7A1F7A'),
  ('ADMIN', 'Administrative & Finance', '#F2C4C4');
