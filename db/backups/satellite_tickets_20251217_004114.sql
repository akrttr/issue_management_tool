--
-- PostgreSQL database dump
--

\restrict n5HCcP6LBxSnaPYCj7w3jiWCY3UVe9tqSIdz0LemaIvIqGG0DQZIeZ28J5PGvkm

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE IF EXISTS satellite_tickets;
--
-- Name: satellite_tickets; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE satellite_tickets WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE satellite_tickets OWNER TO postgres;

\unrestrict n5HCcP6LBxSnaPYCj7w3jiWCY3UVe9tqSIdz0LemaIvIqGG0DQZIeZ28J5PGvkm
\connect satellite_tickets
\restrict n5HCcP6LBxSnaPYCj7w3jiWCY3UVe9tqSIdz0LemaIvIqGG0DQZIeZ28J5PGvkm

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- PostgreSQL database dump complete
--

\unrestrict n5HCcP6LBxSnaPYCj7w3jiWCY3UVe9tqSIdz0LemaIvIqGG0DQZIeZ28J5PGvkm

