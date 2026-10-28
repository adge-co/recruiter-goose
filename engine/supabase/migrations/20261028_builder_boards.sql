-- Builders, specialty contractors, homebuilders and supply houses, read from their own hiring systems (10/28/2026).
-- Found by scanning each company's careers page for the system it links to.
insert into public.boards (ats, token, name, industries) values
  ('workday','graybar.wd1.myworkdayjobs.com/graybar/Careers','Graybar',array['building-materials','logistics']),
  ('workday','srsdistribution.wd1.myworkdayjobs.com/srsdistribution/GMS','GMS',array['building-materials']),
  ('workday','taylormorrison.wd1.myworkdayjobs.com/taylormorrison/TaylorMorrisonCareers','Taylor Morrison',array['proptech','contractors']),
  ('workday','clark.wd503.myworkdayjobs.com/clark/ClarkExternal','Clark Construction',array['contractors']),
  ('workday','swinerton.wd1.myworkdayjobs.com/swinerton/Swinerton_External_Career','Swinerton',array['contractors']),
  ('workday','beckgroup.wd12.myworkdayjobs.com/beckgroup/beckgroupexternal','The Beck Group',array['contractors']),
  ('workday','comfortsystemsusa.wd1.myworkdayjobs.com/comfortsystemsusa/Corpcareers','Comfort Systems USA',array['contractors']),
  ('workday','rosendin.wd1.myworkdayjobs.com/rosendin/Careers','Rosendin',array['contractors','energy']),
  ('workday','ferrovial.wd3.myworkdayjobs.com/ferrovial/Ferrovial_Career_Site','Webber (Ferrovial)',array['contractors']),
  ('icims','careers-marvin.icims.com','Marvin',array['building-materials']),
  ('icims','globalcareers-lennox.icims.com','Lennox',array['building-materials']),
  ('icims','careers-fbmsales.icims.com','Foundation Building Materials',array['building-materials','logistics']),
  ('icims','careers-siteone.icims.com','SiteOne Landscape Supply',array['building-materials','logistics']),
  ('icims','careers-gilbaneco.icims.com','Gilbane',array['contractors']),
  ('icims','careers-tdindustries.icims.com','TDIndustries',array['contractors']),
  ('icims','careers-emcorgroup.icims.com','EMCOR',array['contractors']),
  ('icims','careers-quanta.icims.com','Quanta Services',array['contractors','energy']),
  ('ukg','recruiting2.ultipro.com/BOI1001BOIS/d37b562e-1487-4cc9-8cc4-d95be5cacd55','Boise Cascade',array['building-materials','logistics']),
  ('ukg','recruiting.ultipro.com/IBP1000IBP/bfc73ebf-09a2-4831-a2a8-5d7cb5926e1a','Installed Building Products',array['building-materials','contractors']),
  ('ukg','recruiting.ultipro.com/HIG1007/f95ef15e-6a86-2c2d-b18d-2075afc74394','Highland Homes',array['proptech','contractors']),
  ('ukg','recruiting2.ultipro.com/AUS1003AUIN/611d5a38-76c4-4f66-a55f-2bc012d98024','Austin Industries',array['contractors']),
  ('ukg','recruiting2.ultipro.com/AUS1003AUIN/b8542df4-bc14-47ac-9e01-2eb2423bd205','Austin Industries',array['contractors']),
  ('smartrecruiters','Winsupply1','Winsupply',array['building-materials','logistics']),
  ('oracle','eewl.fa.us6.oraclecloud.com/CX_1','Sundt',array['contractors']),
  ('greenhouse','holderconstruction','Holder Construction',array['contractors'])
on conflict (ats, token) do nothing;
