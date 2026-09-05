-- Correct the vehicle-model applicability lookup used by the catalog booking command.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.create_catalog_appointments(uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz,text,text,text,uuid,uuid,uuid[],integer)'::regprocedure
  ) into v_definition;

  execute replace(v_definition, 'vm.code', 'vm.model_code');
end;
$$;
