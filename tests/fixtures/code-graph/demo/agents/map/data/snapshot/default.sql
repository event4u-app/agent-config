--
-- PostgreSQL database dump
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    legacy_flag boolean,
    deleted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);

CREATE TABLE public.orders (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    agent_id bigint NOT NULL,
    coupon_id integer NOT NULL,
    shop_id integer NOT NULL,
    warehouse_id bigint NOT NULL,
    status character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    message text
);
