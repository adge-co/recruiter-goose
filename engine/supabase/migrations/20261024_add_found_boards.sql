-- Boards the first crawl's probe found with open jobs, checked by hand (Palmetto's hit was an animal hospital, Slate's was a different company: left out).
insert into public.boards (ats, token, name, industries) values
  ('greenhouse','fourkites','FourKites',array['logistics','saas']::text[]),
  ('greenhouse','roofstock','Roofstock',array['proptech']::text[]),
  ('greenhouse','setpoint','Setpoint',array['proptech']::text[]),
  ('lever','latch','Latch',array['proptech']::text[]),
  ('greenhouse','taskrabbit','Taskrabbit',array['trades-software']::text[]),
  ('greenhouse','homelight','HomeLight',array['proptech']::text[]),
  ('greenhouse','orennia','Orennia',array['energy']::text[]),
  ('greenhouse','pacaso','Pacaso',array['proptech']::text[])
on conflict do nothing;
