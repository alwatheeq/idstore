create schema net;
create table net.http_request_queue(id bigint generated always as identity primary key,url text,body jsonb,headers jsonb);
create table net._http_response(id bigint primary key,status_code integer,timed_out boolean,error_msg text);
create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 1000) returns bigint language plpgsql as $$ declare request bigint; begin insert into net.http_request_queue(url,body,headers) values(url,body,headers) returning id into request; return request; end; $$;
create schema cron;
create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
