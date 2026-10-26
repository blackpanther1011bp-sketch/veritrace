-- Produits d'exemple VeriTrace (FICTIFS). Le détail carbone est reconstruit à partir des niveaux.
with v(ean, brand_id, name, category, origin_country, composition, transport, cg, sg, gg, ml, mc, fl, tl, trl) as (values
  ('2001000000012', 'urbanline', 'T-shirt col rond', 'T-shirt', 'Bangladesh', '60 % coton, 40 % polyester', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2001000000029', 'urbanline', 'Jean slim brut', 'Jean', 'Bangladesh', '98 % coton, 2 % élasthanne', 'Bateau, puis camion', 'C', 'E', 'D', 'moyen', 'coton', 'fort', 'moyen', 'faible'),
  ('2001000000036', 'urbanline', 'Chemise satinée', 'Chemise', 'Chine', '100 % polyester', 'Avion, puis camion', 'E', 'E', 'E', 'fort', 'synth', 'fort', 'moyen', 'fort'),
  ('2001000000043', 'urbanline', 'Robe fluide imprimée', 'Robe', 'Chine', '100 % viscose', 'Bateau, puis camion', 'C', 'E', 'D', 'moyen', 'visc', 'fort', 'moyen', 'faible'),
  ('2001000000050', 'urbanline', 'Sweat à capuche', 'Sweat', 'Bangladesh', '50 % coton, 50 % polyester', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2001000000067', 'urbanline', 'Veste matelassée', 'Veste', 'Chine', '100 % polyester', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2001000000074', 'urbanline', 'Pantalon chino', 'Pantalon', 'Bangladesh', '97 % coton, 3 % élasthanne', 'Bateau, puis camion', 'C', 'E', 'D', 'moyen', 'coton', 'fort', 'moyen', 'faible'),
  ('2001000000081', 'urbanline', 'Pull col V', 'Pull', 'Chine', '70 % acrylique, 30 % polyamide', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2002000000019', 'trendo', 'T-shirt oversize', 'T-shirt', 'Turquie', '100 % coton', 'Camion', 'B', 'D', 'C', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2002000000026', 'trendo', 'Jean droit délavé', 'Jean', 'Turquie', '99 % coton, 1 % élasthanne', 'Camion', 'B', 'D', 'C', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2002000000033', 'trendo', 'Chemise à carreaux', 'Chemise', 'Chine', '65 % polyester, 35 % coton', 'Bateau, puis camion', 'D', 'D', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2002000000040', 'trendo', 'Robe portefeuille', 'Robe', 'Turquie', '100 % viscose', 'Camion', 'B', 'D', 'C', 'moyen', 'visc', 'moyen', 'moyen', 'faible'),
  ('2002000000057', 'trendo', 'Sweat col rond', 'Sweat', 'Chine', '60 % coton, 40 % polyester', 'Bateau, puis camion', 'D', 'D', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2002000000064', 'trendo', 'Veste en jean', 'Veste', 'Turquie', '100 % coton', 'Camion', 'B', 'D', 'C', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2002000000071', 'trendo', 'Pantalon cargo', 'Pantalon', 'Chine', '100 % polyester', 'Avion, puis camion', 'E', 'D', 'D', 'fort', 'synth', 'fort', 'moyen', 'fort'),
  ('2002000000088', 'trendo', 'Pull maille épaisse', 'Pull', 'Chine', '80 % acrylique, 20 % laine', 'Bateau, puis camion', 'D', 'D', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2003000000016', 'nova-street', 'T-shirt graphique', 'T-shirt', 'Inde', '100 % coton', 'Bateau, puis camion', 'C', 'D', 'C', 'moyen', 'coton', 'fort', 'moyen', 'faible'),
  ('2003000000023', 'nova-street', 'Jean skinny noir', 'Jean', 'Bangladesh', '92 % coton, 6 % polyester, 2 % élasthanne', 'Bateau, puis camion', 'C', 'D', 'C', 'moyen', 'coton', 'fort', 'moyen', 'faible'),
  ('2003000000030', 'nova-street', 'Chemise en lin mélangé', 'Chemise', 'Inde', '55 % lin, 45 % viscose', 'Bateau, puis camion', 'B', 'D', 'C', 'faible', 'lin', 'fort', 'moyen', 'faible'),
  ('2003000000047', 'nova-street', 'Robe longue plissée', 'Robe', 'Inde', '100 % polyester', 'Bateau, puis camion', 'D', 'D', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2003000000054', 'nova-street', 'Sweat zippé', 'Sweat', 'Bangladesh', '50 % coton, 50 % polyester', 'Bateau, puis camion', 'D', 'D', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2003000000061', 'nova-street', 'Blouson aviateur', 'Veste', 'Chine', '100 % polyamide', 'Avion, puis camion', 'E', 'D', 'D', 'fort', 'synth', 'fort', 'moyen', 'fort'),
  ('2003000000078', 'nova-street', 'Pantalon large', 'Pantalon', 'Inde', '100 % viscose', 'Bateau, puis camion', 'C', 'D', 'C', 'moyen', 'visc', 'fort', 'moyen', 'faible'),
  ('2003000000085', 'nova-street', 'Pull côtelé', 'Pull', 'Bangladesh', '50 % acrylique, 50 % coton', 'Bateau, puis camion', 'D', 'D', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2004000000013', 'flashwear', 'T-shirt basique', 'T-shirt', 'Pakistan', '50 % coton, 50 % polyester', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2004000000020', 'flashwear', 'Jean mom', 'Jean', 'Pakistan', '100 % coton', 'Bateau, puis camion', 'C', 'E', 'D', 'moyen', 'coton', 'fort', 'moyen', 'faible'),
  ('2004000000037', 'flashwear', 'Chemise imprimée', 'Chemise', 'Chine', '100 % polyester', 'Avion, puis camion', 'E', 'E', 'E', 'fort', 'synth', 'fort', 'moyen', 'fort'),
  ('2004000000044', 'flashwear', 'Robe moulante', 'Robe', 'Chine', '95 % polyester, 5 % élasthanne', 'Avion, puis camion', 'E', 'E', 'E', 'fort', 'synth', 'fort', 'moyen', 'fort'),
  ('2004000000051', 'flashwear', 'Sweat court', 'Sweat', 'Chine', '80 % polyester, 20 % coton', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2004000000068', 'flashwear', 'Veste en simili cuir', 'Veste', 'Chine', '100 % polyuréthane, doublure polyester', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2004000000075', 'flashwear', 'Legging', 'Pantalon', 'Chine', '88 % polyester, 12 % élasthanne', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2004000000082', 'flashwear', 'Pull duveteux', 'Pull', 'Chine', '100 % polyester', 'Bateau, puis camion', 'D', 'E', 'D', 'fort', 'synth', 'fort', 'moyen', 'faible'),
  ('2005000000010', 'pulse-co', 'T-shirt col V', 'T-shirt', 'Maroc', '100 % coton', 'Camion', 'B', 'C', 'B', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2005000000027', 'pulse-co', 'Jean regular', 'Jean', 'Maroc', '99 % coton, 1 % élasthanne', 'Camion', 'B', 'C', 'B', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2005000000034', 'pulse-co', 'Chemise Oxford', 'Chemise', 'Maroc', '100 % coton', 'Camion', 'B', 'C', 'B', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2005000000041', 'pulse-co', 'Robe chemise', 'Robe', 'Maroc', '100 % coton', 'Camion', 'B', 'C', 'B', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2005000000058', 'pulse-co', 'Sweat basique', 'Sweat', 'Turquie', '80 % coton, 20 % polyester', 'Camion', 'B', 'C', 'B', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2005000000065', 'pulse-co', 'Veste chemise', 'Veste', 'Turquie', '100 % coton', 'Camion', 'B', 'C', 'B', 'moyen', 'coton', 'moyen', 'moyen', 'faible'),
  ('2005000000072', 'pulse-co', 'Pantalon de costume', 'Pantalon', 'Maroc', '65 % polyester, 35 % viscose', 'Camion', 'C', 'C', 'C', 'fort', 'synth', 'moyen', 'moyen', 'faible'),
  ('2005000000089', 'pulse-co', 'Pull col roulé', 'Pull', 'Turquie', '50 % laine, 50 % acrylique', 'Camion', 'C', 'C', 'C', 'fort', 'synth', 'moyen', 'moyen', 'faible'),
  ('2006000000017', 'atelier-oued', 'T-shirt coton biologique', 'T-shirt', 'Maroc', '100 % coton bio', 'Camion', 'A', 'A', 'A', 'faible', 'bio', 'moyen', 'faible', 'faible'),
  ('2006000000024', 'atelier-oued', 'Chemise en lin', 'Chemise', 'Maroc', '100 % lin', 'Camion', 'A', 'A', 'A', 'faible', 'lin', 'moyen', 'faible', 'faible'),
  ('2006000000031', 'atelier-oued', 'Robe en coton biologique', 'Robe', 'Maroc', '100 % coton bio', 'Camion', 'A', 'A', 'A', 'faible', 'bio', 'moyen', 'faible', 'faible'),
  ('2006000000048', 'atelier-oued', 'Pantalon en lin', 'Pantalon', 'Maroc', '100 % lin', 'Camion', 'A', 'A', 'A', 'faible', 'lin', 'moyen', 'faible', 'faible'),
  ('2007000000014', 'sable-coton', 'T-shirt lin et coton recyclé', 'T-shirt', 'Portugal', '50 % lin, 50 % coton recyclé', 'Camion', 'A', 'B', 'A', 'faible', 'recy', 'faible', 'faible', 'faible'),
  ('2007000000021', 'sable-coton', 'Sweat coton recyclé', 'Sweat', 'Portugal', '80 % coton recyclé, 20 % polyester recyclé', 'Camion', 'A', 'B', 'A', 'faible', 'recy', 'faible', 'faible', 'faible'),
  ('2007000000038', 'sable-coton', 'Pull en laine recyclée', 'Pull', 'Portugal', '100 % laine recyclée', 'Camion', 'A', 'B', 'A', 'faible', 'recy', 'faible', 'faible', 'faible'),
  ('2008000000011', 'seconde-vie', 'T-shirt de seconde main', 'T-shirt', 'Maroc', 'Coton (pièce de seconde main)', 'Local', 'A', 'A', 'A', 'faible', 'occas', 'faible', 'faible', 'faible'),
  ('2008000000028', 'seconde-vie', 'Jean de seconde main', 'Jean', 'Maroc', 'Coton (pièce de seconde main)', 'Local', 'A', 'A', 'A', 'faible', 'occas', 'faible', 'faible', 'faible'),
  ('2008000000035', 'seconde-vie', 'Veste de seconde main', 'Veste', 'Maroc', 'Mixte (pièce de seconde main)', 'Local', 'A', 'A', 'A', 'faible', 'occas', 'faible', 'faible', 'faible')
), lv(level, share) as (values ('faible', 20), ('moyen', 50), ('fort', 80))
insert into public.products (ean, brand_id, name, category, origin_country, composition, transport, carbon_grade, social_grade, global_grade, carbon_breakdown)
select v.ean, v.brand_id, v.name, v.category, v.origin_country, v.composition, v.transport, v.cg, v.sg, v.gg,
  jsonb_build_array(
    jsonb_build_object('label', 'Matière première', 'level', v.ml, 'share', m.share + 2, 'detail', case v.mc
      when 'synth' then 'Fibres synthétiques issues du pétrole'
      when 'coton' then 'Coton conventionnel, gourmand en eau et pesticides'
      when 'visc' then 'Viscose : forte chimie et pression sur les forêts'
      when 'bio' then 'Coton biologique'
      when 'lin' then 'Lin, peu gourmand en eau'
      when 'recy' then 'Fibres recyclées'
      else 'Vêtement déjà produit, réutilisé' end),
    jsonb_build_object('label', 'Fabrication', 'level', v.fl, 'share', f.share - 6, 'detail', case
      when b.kind = 'seconde_main' then 'Aucune nouvelle fabrication'
      when v.fl = 'fort' then 'Électricité majoritairement fossile (charbon)'
      when v.fl = 'moyen' then 'Électricité en partie fossile'
      else 'Électricité majoritairement bas carbone' end),
    jsonb_build_object('label', 'Teinture et finitions', 'level', v.tl, 'share', t.share - 2, 'detail', case
      when b.kind = 'seconde_main' then 'Aucune nouvelle teinture'
      when b.kind = 'responsable' then 'Teintures à faible impact'
      else 'Teinture synthétique, forte consommation d''eau' end),
    jsonb_build_object('label', 'Transport', 'level', v.trl, 'share', tr.share - 2, 'detail', v.transport)
  )
from v
join public.brands b on b.id = v.brand_id
join lv m on m.level = v.ml
join lv f on f.level = v.fl
join lv t on t.level = v.tl
join lv tr on tr.level = v.trl;
