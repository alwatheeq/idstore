-- Starter offerings, not mandated service intervals or repair procedures. Price/time remain unset.
do $$
declare org record; s record; template uuid; version uuid;
begin
 for org in select id from public.organizations loop
  for s in select * from (values
('MNT-BRAKE-PADS','Brake pad replacement','تغيير فحمات الفرامل','maintenance'),
('MNT-BRAKE-DISCS','Brake disc replacement','تغيير أقراص الفرامل','maintenance'),
('MNT-BRAKE-FLUID','Brake fluid replacement','تغيير سائل الفرامل','maintenance'),
('MNT-CABIN-FILTER','Cabin air filter replacement','تغيير فلتر المكيف','maintenance'),
('MNT-WIPERS','Wiper blade replacement','تغيير ريش المساحات','maintenance'),
('MNT-TYRES','Tyre replacement','تغيير الإطارات','maintenance'),
('MNT-PUNCTURE','Tyre puncture repair','إصلاح ثقب الإطار','maintenance'),
('MNT-BALANCE','Wheel balancing','ترصيص العجلات','maintenance'),
('MNT-ALIGNMENT','Wheel alignment','ضبط زوايا العجلات','maintenance'),
('MNT-12V-BATTERY','12V battery replacement','تغيير بطارية 12 فولت','maintenance'),
('MNT-ABS-SENSOR','Wheel speed sensor replacement','تغيير حساس سرعة العجلة','maintenance'),
('MNT-PARK-SENSOR','Parking sensor replacement','تغيير حساس الاصطفاف','maintenance'),
('MNT-LIGHTS','Exterior lamp replacement','تغيير المصابيح الخارجية','maintenance'),
('MNT-SHOCKS','Shock absorber replacement','تغيير المساعدات','maintenance'),
('MNT-LINKS','Stabilizer link replacement','تغيير وصلات عمود التوازن','maintenance'),
('MNT-BEARING','Wheel bearing replacement','تغيير رمان العجل','maintenance'),
('MNT-AC-CHECK','Air-conditioning fault diagnosis','تشخيص أعطال المكيف','maintenance'),
('MNT-COOLANT-CHECK','Coolant leak diagnosis','تشخيص تسرب سائل التبريد','maintenance'),
('MNT-FAULT-SCAN','Fault-code scan and diagnosis','قراءة رموز الأعطال وتشخيصها','maintenance'),
('MNT-ROAD-TEST','Post-repair road test','تجربة قيادة بعد الإصلاح','maintenance'),
('BDY-DENT','Dent repair','إصلاح الانبعاجات','bodyshop'),
('BDY-PAINT','Panel painting','دهان جزء من الهيكل','bodyshop'),
('BDY-BUMPER-REPAIR','Bumper repair','إصلاح الصدام','bodyshop'),
('BDY-BUMPER-REPLACE','Bumper replacement','تغيير الصدام','bodyshop'),
('BDY-PANEL','Body panel replacement','تغيير أحد أجزاء الهيكل','bodyshop'),
('BDY-POLISH','Paint correction and polishing','تصحيح الدهان وتلميعه','bodyshop')
  ) as catalog(code,description_en,description_ar,order_type) loop
   if not exists(select 1 from public.service_templates where organization_id=org.id and code=s.code) then
    insert into public.service_templates(organization_id,code,name_en,name_ar,work_order_type)
    values(org.id,s.code,s.description_en,s.description_ar,s.order_type) returning id into template;
    insert into public.service_template_versions(organization_id,template_id,version_no,effective_from,status,source_uri,applicability_json)
    values(org.id,template,1,current_date,'published','workshop:starter-service-catalog',
      '{"entry_mode":"simple","model_codes":[],"service_pricing":{"currency":"JOD","customer_price":null}}'::jsonb) returning id into version;
    insert into public.service_template_tasks(organization_id,version_id,sequence,task_code,description_en,description_ar,standard_minutes,result_schema)
    values(org.id,version,1,s.code,s.description_en,s.description_ar,0,'{"capture":"confirmation","safety_class":"normal"}'::jsonb);
   end if;
  end loop;
 end loop;
end $$;
