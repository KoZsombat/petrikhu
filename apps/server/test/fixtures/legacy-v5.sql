-- A database created by the previous app (schema version 5) with test content: posts in every status
-- (including a test-mode approval and an imported post with image/gallery/embed blocks), Creator pages
-- (one overriding a built-in page, one in the trash), an edited menu and library, accounts with various
-- permission sets, terms, audit entries, sessions and media. Built with the old code (see PR_DESCRIPTION.md).
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id text NOT NULL,
    post_id text,
    user_id text,
    action text NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    note text,
    created_at timestamp with time zone NOT NULL,
    entity_type text DEFAULT 'post'::text NOT NULL,
    entity_id text,
    subject text
);


--
-- Name: creator_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creator_pages (
    id text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    blocks jsonb NOT NULL,
    status text NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    author_id text,
    created_at timestamp with time zone NOT NULL,
    modified_at timestamp with time zone NOT NULL,
    modified_by_id text
);


--
-- Name: media_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_files (
    path text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    modified_at timestamp with time zone NOT NULL,
    data bytea NOT NULL
);
ALTER TABLE ONLY public.media_files ALTER COLUMN data SET STORAGE EXTERNAL;


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content jsonb NOT NULL,
    excerpt text DEFAULT ''::text NOT NULL,
    category_ids jsonb NOT NULL,
    tag_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    featured_image text,
    image_position text DEFAULT 'top'::text NOT NULL,
    origin text DEFAULT 'hirkezelo'::text NOT NULL,
    author_id text,
    status text NOT NULL,
    review_note text,
    last_reviewer_id text,
    last_reviewed_at timestamp with time zone,
    scheduled_for timestamp with time zone,
    scheduled_by_id text,
    archived_at timestamp with time zone,
    archived_by_id text,
    created_at timestamp with time zone NOT NULL,
    modified_at timestamp with time zone NOT NULL,
    date timestamp with time zone NOT NULL,
    search_text text
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version integer NOT NULL,
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid text NOT NULL,
    data text NOT NULL,
    expires bigint NOT NULL
);


--
-- Name: site_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_library (
    id integer NOT NULL,
    data jsonb NOT NULL,
    modified_at timestamp with time zone NOT NULL,
    CONSTRAINT site_library_id_check CHECK ((id = 1))
);


--
-- Name: site_menu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_menu (
    id integer NOT NULL,
    data jsonb NOT NULL,
    modified_at timestamp with time zone NOT NULL,
    CONSTRAINT site_menu_id_check CHECK ((id = 1))
);


--
-- Name: terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terms (
    id text NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    route text,
    created_at timestamp with time zone NOT NULL,
    created_by_id text
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    username text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.audit_log VALUES ('bca5ca9e-fd21-4572-a1e9-d35cd5df030f', '06ee7c65-526b-41c4-a85f-1dd58817f74f', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'created_draft', '', 'draft', NULL, '2026-11-07 10:37:51.421+00', 'post', '06ee7c65-526b-41c4-a85f-1dd58817f74f', NULL);
INSERT INTO public.audit_log VALUES ('2f22220b-96ef-468d-9f98-6efa2cb02aee', 'f9336e9a-8f45-41d9-aae8-653c353e86de', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'created_draft', '', 'draft', NULL, '2026-11-07 10:37:51.436+00', 'post', 'f9336e9a-8f45-41d9-aae8-653c353e86de', NULL);
INSERT INTO public.audit_log VALUES ('481a9435-92a8-4e11-a09d-9e29d332cd9e', 'f9336e9a-8f45-41d9-aae8-653c353e86de', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'submitted', 'draft', 'pending', NULL, '2026-11-07 10:37:51.448+00', 'post', 'f9336e9a-8f45-41d9-aae8-653c353e86de', NULL);
INSERT INTO public.audit_log VALUES ('b791332f-edae-4f15-9d7a-5cf092182845', '29a4dd11-a02a-4f1c-a701-bf3902bdb186', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'created_draft', '', 'draft', NULL, '2026-11-07 10:37:51.457+00', 'post', '29a4dd11-a02a-4f1c-a701-bf3902bdb186', NULL);
INSERT INTO public.audit_log VALUES ('471980fa-babd-404b-9518-a47caef1957e', '29a4dd11-a02a-4f1c-a701-bf3902bdb186', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'submitted', 'draft', 'pending', NULL, '2026-11-07 10:37:51.469+00', 'post', '29a4dd11-a02a-4f1c-a701-bf3902bdb186', NULL);
INSERT INTO public.audit_log VALUES ('575a186c-a398-4ab1-a9a8-324e2f405022', '29a4dd11-a02a-4f1c-a701-bf3902bdb186', '31dff44d-81eb-46ff-998b-d9d33214f79e', 'rejected', 'pending', 'pnw_revision', 'Kérlek javítsd a címet.', '2026-11-07 10:37:51.48+00', 'post', '29a4dd11-a02a-4f1c-a701-bf3902bdb186', NULL);
INSERT INTO public.audit_log VALUES ('45286748-db42-4212-9d55-10d716c0f4d9', 'e93aa8be-ea57-4af9-b7d7-46498566a491', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'created_draft', '', 'draft', NULL, '2026-11-07 10:37:51.492+00', 'post', 'e93aa8be-ea57-4af9-b7d7-46498566a491', NULL);
INSERT INTO public.audit_log VALUES ('a883332e-7b6d-4dba-b86e-6ed6930c7c2e', 'e93aa8be-ea57-4af9-b7d7-46498566a491', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'submitted', 'draft', 'pending', NULL, '2026-11-07 10:37:51.503+00', 'post', 'e93aa8be-ea57-4af9-b7d7-46498566a491', NULL);
INSERT INTO public.audit_log VALUES ('1ccd6242-7c06-4eba-af2f-539aa8a8003b', 'e93aa8be-ea57-4af9-b7d7-46498566a491', '31dff44d-81eb-46ff-998b-d9d33214f79e', 'approved', 'pending', 'publish', NULL, '2026-11-07 10:37:51.511+00', 'post', 'e93aa8be-ea57-4af9-b7d7-46498566a491', NULL);
INSERT INTO public.audit_log VALUES ('23d3154d-e4d3-40b7-9c84-d30db71a9fea', '79611f02-d122-4b26-b867-f7c1a2d52c69', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'created_draft', '', 'draft', NULL, '2026-11-07 10:37:51.519+00', 'post', '79611f02-d122-4b26-b867-f7c1a2d52c69', NULL);
INSERT INTO public.audit_log VALUES ('63c06762-38ef-42ac-911b-12739dd84997', '79611f02-d122-4b26-b867-f7c1a2d52c69', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'submitted', 'draft', 'pending', NULL, '2026-11-07 10:37:51.532+00', 'post', '79611f02-d122-4b26-b867-f7c1a2d52c69', NULL);
INSERT INTO public.audit_log VALUES ('077ae618-8f74-4c0c-ad84-62b4e113177d', '79611f02-d122-4b26-b867-f7c1a2d52c69', '31dff44d-81eb-46ff-998b-d9d33214f79e', 'scheduled', 'pending', 'future', 'Publikálás: 2026. 12. 07. 10:37:51', '2026-11-07 10:37:51.569+00', 'post', '79611f02-d122-4b26-b867-f7c1a2d52c69', NULL);
INSERT INTO public.audit_log VALUES ('8b6e0b92-0024-4d69-9d8d-6bb7bd8d0dec', 'f93115f8-b7f4-4984-a1e9-3f7317628da3', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'created_draft', '', 'draft', NULL, '2026-11-07 10:37:51.579+00', 'post', 'f93115f8-b7f4-4984-a1e9-3f7317628da3', NULL);
INSERT INTO public.audit_log VALUES ('4460732a-0ad9-44b6-be93-78daa043ad1b', 'f93115f8-b7f4-4984-a1e9-3f7317628da3', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'submitted', 'draft', 'pending', NULL, '2026-11-07 10:37:51.589+00', 'post', 'f93115f8-b7f4-4984-a1e9-3f7317628da3', NULL);
INSERT INTO public.audit_log VALUES ('173aa82d-50cf-4831-9122-8bc5b750c7b0', 'f93115f8-b7f4-4984-a1e9-3f7317628da3', '31dff44d-81eb-46ff-998b-d9d33214f79e', 'approved', 'pending', 'publish', NULL, '2026-11-07 10:37:51.597+00', 'post', 'f93115f8-b7f4-4984-a1e9-3f7317628da3', NULL);
INSERT INTO public.audit_log VALUES ('a0ca30f5-c8b2-41b2-b8fe-bdd2b9eca2d5', 'f93115f8-b7f4-4984-a1e9-3f7317628da3', '31dff44d-81eb-46ff-998b-d9d33214f79e', 'published_archived', 'publish', 'pnw_archived', NULL, '2026-11-07 10:37:51.605+00', 'post', 'f93115f8-b7f4-4984-a1e9-3f7317628da3', NULL);
INSERT INTO public.audit_log VALUES ('2d886164-7868-4049-bb2f-a7f0a7a8ee4a', 'db0496a9-9be7-4080-81ab-4a7a8a7e3ee9', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'created_draft', '', 'draft', NULL, '2026-11-07 10:37:51.614+00', 'post', 'db0496a9-9be7-4080-81ab-4a7a8a7e3ee9', NULL);
INSERT INTO public.audit_log VALUES ('ca40d3c4-b24e-40fb-a9cf-a759b01ee41f', 'db0496a9-9be7-4080-81ab-4a7a8a7e3ee9', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'trashed', 'draft', 'trash', NULL, '2026-11-07 10:37:51.622+00', 'post', 'db0496a9-9be7-4080-81ab-4a7a8a7e3ee9', 'Lomtár hír');
INSERT INTO public.audit_log VALUES ('5f6c600f-d0f4-43f9-8615-c0c7b8080a87', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'page_created', '', '', '/teszt-oldal (kiadva)', '2026-11-07 10:37:51.645+00', 'page', '366290b9-c973-4628-b79f-85335e2bdd9f', 'Teszt oldal');
INSERT INTO public.audit_log VALUES ('b32561bc-42cc-4b2c-abb5-65b49fc9c249', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'page_created', '', '', '/bemutatkozas (kiadva)', '2026-11-07 10:37:51.652+00', 'page', '6e84db2d-8fb4-4856-be9a-1d522fe965a9', 'Bemutatkozás (szerkesztett)');
INSERT INTO public.audit_log VALUES ('21b5b49a-3167-4c59-b59a-741d237275e7', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'page_created', '', '', '/piszkozat-oldal (piszkozat)', '2026-11-07 10:37:51.66+00', 'page', '86329887-c3a4-4d15-a6ef-a79acc9a3132', 'Piszkozat oldal');
INSERT INTO public.audit_log VALUES ('e594f45d-1529-41cf-afbc-5ed99973874f', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'page_trashed', '', '', NULL, '2026-11-07 10:37:51.666+00', 'page', '86329887-c3a4-4d15-a6ef-a79acc9a3132', 'Piszkozat oldal');
INSERT INTO public.audit_log VALUES ('f02bd97c-cb6c-48ea-89ba-033a6f2e5304', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'menu_updated', '', '', '3 menüpont', '2026-11-07 10:37:51.672+00', 'menu', NULL, NULL);
INSERT INTO public.audit_log VALUES ('d15f4c0f-58d6-4aaa-a6d0-deaf04db3937', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'library_updated', '', '', '1 kategória, 2 dokumentum', '2026-11-07 10:37:51.691+00', 'library', NULL, NULL);
INSERT INTO public.audit_log VALUES ('2586dd79-21ea-4845-91f4-d4d11f50f194', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'user_created', '', '', 'Jogok: pnw_manage_pages, pnw_manage_library', '2026-11-07 10:37:51.778+00', 'user', '99e94583-c36d-4d5e-ba98-9b185fa14e3c', 'szerkeszto');
INSERT INTO public.audit_log VALUES ('657e4311-dad6-44bb-a644-8d7bbc818db9', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'user_created', '', '', 'Nincs jogosultság', '2026-11-07 10:37:51.875+00', 'user', 'f9e0cd32-b366-4d7d-be9a-59a4fb653e79', 'ures');
INSERT INTO public.audit_log VALUES ('44f169d5-77bc-4c34-982f-4a6bdfe75995', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', 'user_created', '', '', 'Jogok: pnw_submit_news, pnw_manage_terms', '2026-11-07 10:37:51.973+00', 'user', 'f357ac2c-2e01-4b26-bd18-43bfc1f74410', 'cimkes');
INSERT INTO public.audit_log VALUES ('imp-1', 'mirror-1', NULL, 'imported', '', 'publish', 'Importálva', '2026-11-07 10:37:51.982+00', 'post', 'mirror-1', NULL);
INSERT INTO public.audit_log VALUES ('e9becbcb-1d7d-4d78-aed3-c199ebb0adf4', '6476452a-df41-4fde-b124-abbc900cc700', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'created_draft', '', 'draft', NULL, '2026-11-07 10:37:51.992+00', 'post', '6476452a-df41-4fde-b124-abbc900cc700', NULL);


--
-- Data for Name: creator_pages; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.creator_pages VALUES ('366290b9-c973-4628-b79f-85335e2bdd9f', 'teszt-oldal', 'Teszt oldal', 'Leírás', '[{"values": {"intro": "Bevezető", "title": "Teszt oldal", "breadcrumb": [{"href": "/", "label": "Kezdőlap"}, {"label": "Teszt"}]}, "component": "PageTitle"}, {"values": {"html": "<h2>Cím</h2><p>Szöveg <strong>vastag</strong> <a href=\"https://example.com\" target=\"_blank\" rel=\"noopener noreferrer\">link</a><br />sor</p><ul><li>egy</li></ul><img src=\"/uploads/x.png\" alt=\"kép\" />"}, "component": "RichText"}, {"values": {"items": [{"html": "<p>Válasz <em>dőlt</em></p>", "title": "Kérdés"}]}, "component": "Accordion"}, {"values": {"text": "Kiemelt szöveg", "title": "Fontos"}, "variant": "highlight", "component": "CardGrid"}, {"values": {"rows": [{"label": "A", "value": "B"}]}, "variant": "fact", "component": "RowList"}]', 'publish', false, '31dff44d-81eb-46ff-998b-d9d33214f79e', '2026-11-07 10:37:51.643+00', '2026-11-07 10:37:51.643+00', '31dff44d-81eb-46ff-998b-d9d33214f79e');
INSERT INTO public.creator_pages VALUES ('6e84db2d-8fb4-4856-be9a-1d522fe965a9', 'bemutatkozas', 'Bemutatkozás (szerkesztett)', '', '[{"values": {"html": "<p>Felülírt bemutatkozás</p>"}, "component": "RichText"}]', 'publish', false, '31dff44d-81eb-46ff-998b-d9d33214f79e', '2026-11-07 10:37:51.651+00', '2026-11-07 10:37:51.651+00', '31dff44d-81eb-46ff-998b-d9d33214f79e');
INSERT INTO public.creator_pages VALUES ('86329887-c3a4-4d15-a6ef-a79acc9a3132', 'piszkozat-oldal', 'Piszkozat oldal', '', '[{"values": {"html": "<p>hello</p>", "tone": "accent"}, "component": "Callout"}]', 'draft', true, '31dff44d-81eb-46ff-998b-d9d33214f79e', '2026-11-07 10:37:51.659+00', '2026-11-07 10:37:51.665+00', '31dff44d-81eb-46ff-998b-d9d33214f79e');


--
-- Data for Name: media_files; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.media_files VALUES ('/uploads/4a2bb9f9-a98a-4f42-a162-93ac4783bf04.png', 'image/png', 70, '2026-11-07 10:37:51.433+00', '\x89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fccfc0500f000485018084a98c210000000049454e44ae426082');
INSERT INTO public.media_files VALUES ('/uploads/66d20219-601a-4335-83db-0af61f56d88c.png', 'image/png', 70, '2026-11-07 10:37:51.489+00', '\x89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fccfc0500f000485018084a98c210000000049454e44ae426082');
INSERT INTO public.media_files VALUES ('/uploads/hazirend-2024-932b19.pdf', 'application/pdf', 13, '2026-11-07 10:37:51.681+00', '\x255044462d312e342074657374');
INSERT INTO public.media_files VALUES ('/media/wp-content/uploads/2019/05/kep.jpg', 'image/jpeg', 3, '2026-11-07 10:37:51.982+00', '\xffd8ff');


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.posts VALUES ('f9336e9a-8f45-41d9-aae8-653c353e86de', 'bekuldott-hir', 'Beküldött hír', '[{"id": "b1", "runs": [{"text": "Alcím"}], "type": "heading", "level": 3}, {"id": "b2", "runs": [{"text": "x "}, {"bold": true, "text": "félkövér"}, {"text": " és "}, {"href": "/hirek", "text": "link", "italic": true}, {"text": " színes", "color": "#2b8272"}, {"text": "\nújsor"}], "type": "paragraph", "align": "center"}, {"id": "b3", "runs": [{"text": "első"}], "type": "bulleted-list"}, {"id": "b4", "runs": [{"text": "második", "underline": true}], "type": "bulleted-list"}, {"id": "b5", "runs": [{"text": "egy"}], "type": "numbered-list"}, {"id": "b6", "runs": [{"text": "Idézet"}], "type": "blockquote"}, {"id": "b7", "runs": [{"text": ""}], "type": "table", "table": {"rows": [["A", "B"], ["1", "2"]], "header": true}}]', '', '["/kategoria/hirek/"]', '[]', '/uploads/4a2bb9f9-a98a-4f42-a162-93ac4783bf04.png', 'top', 'hirkezelo', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-07 10:37:51.435+00', '2026-11-07 10:37:51.447+00', '2026-11-07 10:37:51.435+00', 'beküldött hír
alcím
x félkövér és link színes
újsor
első
második
egy
idézet
a b 1 2');
INSERT INTO public.posts VALUES ('29a4dd11-a02a-4f1c-a701-bf3902bdb186', 'visszakuldott-hir', 'Visszaküldött hír', '[{"id": "b1", "runs": [{"text": "Alcím"}], "type": "heading", "level": 3}, {"id": "b2", "runs": [{"text": "y "}, {"bold": true, "text": "félkövér"}, {"text": " és "}, {"href": "/hirek", "text": "link", "italic": true}, {"text": " színes", "color": "#2b8272"}, {"text": "\nújsor"}], "type": "paragraph", "align": "center"}, {"id": "b3", "runs": [{"text": "első"}], "type": "bulleted-list"}, {"id": "b4", "runs": [{"text": "második", "underline": true}], "type": "bulleted-list"}, {"id": "b5", "runs": [{"text": "egy"}], "type": "numbered-list"}, {"id": "b6", "runs": [{"text": "Idézet"}], "type": "blockquote"}, {"id": "b7", "runs": [{"text": ""}], "type": "table", "table": {"rows": [["A", "B"], ["1", "2"]], "header": true}}]', '', '["/kategoria/hirek/"]', '[]', NULL, 'top', 'hirkezelo', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'pnw_revision', 'Kérlek javítsd a címet.', '31dff44d-81eb-46ff-998b-d9d33214f79e', '2026-11-07 10:37:51.478+00', NULL, NULL, NULL, NULL, '2026-11-07 10:37:51.456+00', '2026-11-07 10:37:51.478+00', '2026-11-07 10:37:51.456+00', 'visszaküldött hír
alcím
y félkövér és link színes
újsor
első
második
egy
idézet
a b 1 2');
INSERT INTO public.posts VALUES ('e93aa8be-ea57-4af9-b7d7-46498566a491', 'publikalt-hir', 'Publikált hír', '[{"id": "b1", "runs": [{"text": "Alcím"}], "type": "heading", "level": 3}, {"id": "b2", "runs": [{"text": "z "}, {"bold": true, "text": "félkövér"}, {"text": " és "}, {"href": "/hirek", "text": "link", "italic": true}, {"text": " színes", "color": "#2b8272"}, {"text": "\nújsor"}], "type": "paragraph", "align": "center"}, {"id": "b3", "runs": [{"text": "első"}], "type": "bulleted-list"}, {"id": "b4", "runs": [{"text": "második", "underline": true}], "type": "bulleted-list"}, {"id": "b5", "runs": [{"text": "egy"}], "type": "numbered-list"}, {"id": "b6", "runs": [{"text": "Idézet"}], "type": "blockquote"}, {"id": "b7", "runs": [{"text": ""}], "type": "table", "table": {"rows": [["A", "B"], ["1", "2"]], "header": true}}]', 'Publikus kivonat', '["/kategoria/hirek/"]', '[]', '/uploads/66d20219-601a-4335-83db-0af61f56d88c.png', 'top', 'hirkezelo', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'publish', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', '2026-11-07 10:37:51.51+00', NULL, NULL, NULL, NULL, '2026-11-07 10:37:51.491+00', '2026-11-07 10:37:51.51+00', '2026-11-07 10:37:51.51+00', 'publikált hír
alcím
z félkövér és link színes
újsor
első
második
egy
idézet
a b 1 2');
INSERT INTO public.posts VALUES ('79611f02-d122-4b26-b867-f7c1a2d52c69', 'idozitett-hir', 'Időzített hír', '[{"id": "b1", "runs": [{"text": "Alcím"}], "type": "heading", "level": 3}, {"id": "b2", "runs": [{"text": "s "}, {"bold": true, "text": "félkövér"}, {"text": " és "}, {"href": "/hirek", "text": "link", "italic": true}, {"text": " színes", "color": "#2b8272"}, {"text": "\nújsor"}], "type": "paragraph", "align": "center"}, {"id": "b3", "runs": [{"text": "első"}], "type": "bulleted-list"}, {"id": "b4", "runs": [{"text": "második", "underline": true}], "type": "bulleted-list"}, {"id": "b5", "runs": [{"text": "egy"}], "type": "numbered-list"}, {"id": "b6", "runs": [{"text": "Idézet"}], "type": "blockquote"}, {"id": "b7", "runs": [{"text": ""}], "type": "table", "table": {"rows": [["A", "B"], ["1", "2"]], "header": true}}]', '', '["/kategoria/hirek/"]', '[]', NULL, 'top', 'hirkezelo', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'future', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', '2026-11-07 10:37:51.539+00', '2026-12-07 10:37:51.535+00', '31dff44d-81eb-46ff-998b-d9d33214f79e', NULL, NULL, '2026-11-07 10:37:51.518+00', '2026-11-07 10:37:51.539+00', '2026-12-07 10:37:51.535+00', 'időzített hír
alcím
s félkövér és link színes
újsor
első
második
egy
idézet
a b 1 2');
INSERT INTO public.posts VALUES ('06ee7c65-526b-41c4-a85f-1dd58817f74f', 'piszkozat-hir', 'Piszkozat hír', '[{"id": "b1", "runs": [{"text": "Alcím"}], "type": "heading", "level": 3}, {"id": "b2", "runs": [{"text": "Piszkozat hír "}, {"bold": true, "text": "félkövér"}, {"text": " és "}, {"href": "/hirek", "text": "link", "italic": true}, {"text": " színes", "color": "#2b8272"}, {"text": "\nújsor"}], "type": "paragraph", "align": "center"}, {"id": "b3", "runs": [{"text": "első"}], "type": "bulleted-list"}, {"id": "b4", "runs": [{"text": "második", "underline": true}], "type": "bulleted-list"}, {"id": "b5", "runs": [{"text": "egy"}], "type": "numbered-list"}, {"id": "b6", "runs": [{"text": "Idézet"}], "type": "blockquote"}, {"id": "b7", "runs": [{"text": ""}], "type": "table", "table": {"rows": [["A", "B"], ["1", "2"]], "header": true}}]', 'Kivonat Piszkozat hír', '["/kategoria/hirek/"]', '[]', NULL, 'top', 'hirkezelo', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'pnw_test_ok', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-07 10:37:51.418+00', '2026-11-07 10:37:51.418+00', '2026-11-07 10:37:51.418+00', 'piszkozat hír
alcím
piszkozat hír félkövér és link színes
újsor
első
második
egy
idézet
a b 1 2');
INSERT INTO public.posts VALUES ('f93115f8-b7f4-4984-a1e9-3f7317628da3', 'archivalt-hir', 'Archivált hír', '[{"id": "b1", "runs": [{"text": "Alcím"}], "type": "heading", "level": 3}, {"id": "b2", "runs": [{"text": "a "}, {"bold": true, "text": "félkövér"}, {"text": " és "}, {"href": "/hirek", "text": "link", "italic": true}, {"text": " színes", "color": "#2b8272"}, {"text": "\nújsor"}], "type": "paragraph", "align": "center"}, {"id": "b3", "runs": [{"text": "első"}], "type": "bulleted-list"}, {"id": "b4", "runs": [{"text": "második", "underline": true}], "type": "bulleted-list"}, {"id": "b5", "runs": [{"text": "egy"}], "type": "numbered-list"}, {"id": "b6", "runs": [{"text": "Idézet"}], "type": "blockquote"}, {"id": "b7", "runs": [{"text": ""}], "type": "table", "table": {"rows": [["A", "B"], ["1", "2"]], "header": true}}]', '', '["/kategoria/hirek/"]', '[]', NULL, 'top', 'hirkezelo', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'pnw_archived', NULL, '31dff44d-81eb-46ff-998b-d9d33214f79e', '2026-11-07 10:37:51.595+00', NULL, NULL, '2026-11-07 10:37:51.603+00', '31dff44d-81eb-46ff-998b-d9d33214f79e', '2026-11-07 10:37:51.578+00', '2026-11-07 10:37:51.603+00', '2026-11-07 10:37:51.595+00', 'archivált hír
alcím
a félkövér és link színes
újsor
első
második
egy
idézet
a b 1 2');
INSERT INTO public.posts VALUES ('db0496a9-9be7-4080-81ab-4a7a8a7e3ee9', 'lomtar-hir', 'Lomtár hír', '[{"id": "b1", "runs": [{"text": "Alcím"}], "type": "heading", "level": 3}, {"id": "b2", "runs": [{"text": "Lomtár hír "}, {"bold": true, "text": "félkövér"}, {"text": " és "}, {"href": "/hirek", "text": "link", "italic": true}, {"text": " színes", "color": "#2b8272"}, {"text": "\nújsor"}], "type": "paragraph", "align": "center"}, {"id": "b3", "runs": [{"text": "első"}], "type": "bulleted-list"}, {"id": "b4", "runs": [{"text": "második", "underline": true}], "type": "bulleted-list"}, {"id": "b5", "runs": [{"text": "egy"}], "type": "numbered-list"}, {"id": "b6", "runs": [{"text": "Idézet"}], "type": "blockquote"}, {"id": "b7", "runs": [{"text": ""}], "type": "table", "table": {"rows": [["A", "B"], ["1", "2"]], "header": true}}]', 'Kivonat Lomtár hír', '["/kategoria/hirek/"]', '[]', NULL, 'top', 'hirkezelo', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'trash', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-07 10:37:51.612+00', '2026-11-07 10:37:51.62+00', '2026-11-07 10:37:51.612+00', 'lomtár hír
alcím
lomtár hír félkövér és link színes
újsor
első
második
egy
idézet
a b 1 2');
INSERT INTO public.posts VALUES ('mirror-1', 'regi-hir', 'Régi hír a tükörből', '[{"id": "m1", "runs": [{"text": "Div szöveg", "style": {"fontSize": "18px"}}], "type": "div"}, {"id": "m2", "runs": [{"text": ""}], "type": "image", "image": {"alt": "Régi kép", "src": "/media/wp-content/uploads/2019/05/kep.jpg", "href": "/media/wp-content/uploads/2019/05/kep.jpg", "width": 800, "height": 600, "caption": "Képaláírás"}}, {"id": "m3", "runs": [{"text": ""}], "type": "gallery", "gallery": [{"alt": "a", "src": "/media/a.jpg", "full": "/media/a-full.jpg"}, {"alt": "b", "src": "/media/b.jpg"}]}, {"id": "m4", "runs": [{"text": ""}], "type": "embed", "embed": {"src": "https://www.youtube.com/embed/NnanAwvV8FI", "title": "Videó", "aspect": 0.5625}}, {"id": "m5", "runs": [{"text": "plain szöveg"}], "type": "plain"}]', '', '["/kategoria/hirek/"]', '[]', NULL, 'top', 'mirror', NULL, 'publish', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-07 10:37:51.982+00', '2026-11-07 10:37:51.982+00', '2019-05-01 10:00:00+00', 'régi');
INSERT INTO public.posts VALUES ('6476452a-df41-4fde-b124-abbc900cc700', 'sima-piszkozat', 'Sima piszkozat', '[{"id": "b1", "runs": [{"text": "Alcím"}], "type": "heading", "level": 3}, {"id": "b2", "runs": [{"text": "Sima piszkozat "}, {"bold": true, "text": "félkövér"}, {"text": " és "}, {"href": "/hirek", "text": "link", "italic": true}, {"text": " színes", "color": "#2b8272"}, {"text": "\nújsor"}], "type": "paragraph", "align": "center"}, {"id": "b3", "runs": [{"text": "első"}], "type": "bulleted-list"}, {"id": "b4", "runs": [{"text": "második", "underline": true}], "type": "bulleted-list"}, {"id": "b5", "runs": [{"text": "egy"}], "type": "numbered-list"}, {"id": "b6", "runs": [{"text": "Idézet"}], "type": "blockquote"}, {"id": "b7", "runs": [{"text": ""}], "type": "table", "table": {"rows": [["A", "B"], ["1", "2"]], "header": true}}]', 'Kivonat Sima piszkozat', '["/kategoria/hirek/"]', '[]', NULL, 'top', 'hirkezelo', 'fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'draft', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-07 10:37:51.991+00', '2026-11-07 10:37:51.991+00', '2026-11-07 10:37:51.991+00', 'sima piszkozat
alcím
sima piszkozat félkövér és link színes
újsor
első
második
egy
idézet
a b 1 2');


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.schema_migrations VALUES (1, '001_initial', '2026-11-07 10:37:50.777549+00');
INSERT INTO public.schema_migrations VALUES (2, '002_media_storage_external', '2026-11-07 10:37:50.805484+00');
INSERT INTO public.schema_migrations VALUES (3, '003_posts_search_text', '2026-11-07 10:37:50.807337+00');
INSERT INTO public.schema_migrations VALUES (4, '004_typed_columns', '2026-11-07 10:37:50.811455+00');
INSERT INTO public.schema_migrations VALUES (5, '005_audit_entities', '2026-11-07 10:37:50.874984+00');


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sessions VALUES ('szNYAiTqOAs-DfFRANgaf3cIGPXTNHfy', '{"cookie":{"originalMaxAge":604800000,"expires":"2026-11-14T10:37:51.392Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"31dff44d-81eb-46ff-998b-d9d33214f79e"}', 1794652671981);
INSERT INTO public.sessions VALUES ('6L9eTe69uLMOnIuFmQ4THFEKCaAs172n', '{"cookie":{"originalMaxAge":604800000,"expires":"2026-11-14T10:37:51.297Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"fafdba1b-43ee-43ae-b26d-9cf6306cadef"}', 1794652671993);


--
-- Data for Name: site_library; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.site_library VALUES (1, '{"categories": [{"docs": [{"file": "/uploads/hazirend-2024-932b19.pdf", "slug": "hazirend", "title": "Házirend"}, {"slug": "vedett", "title": "Védett dok"}], "slug": "alap", "title": "Alapdokumentumok"}]}', '2026-11-07 10:37:51.689+00');


--
-- Data for Name: site_menu; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.site_menu VALUES (1, '[{"href": "/", "label": "Kezdőlap"}, {"href": "/hirek", "label": "Hírek"}, {"label": "Kapcsolat", "children": [{"href": "/elerhetoseg", "label": "Elérhetőség"}, {"href": "/teszt-oldal", "label": "Teszt"}]}]', '2026-11-07 10:37:51.671+00');


--
-- Data for Name: terms; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.terms VALUES ('/kategoria/egyeb/', 'category', 'Egyéb kategória', '/kategoria/egyeb/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/allasajanlatok/', 'category', 'Állásajánlatok', '/kategoria/egyeb/allasajanlatok/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/dijak-es-elismeresek/', 'category', 'Díjak és elismerések', '/kategoria/egyeb/dijak-es-elismeresek/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/in-memoriam/', 'category', 'In Memoriam', '/kategoria/egyeb/in-memoriam/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/iskolai-egeszsegugy/', 'category', 'Iskolai-egészségügy', '/kategoria/egyeb/iskolai-egeszsegugy/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/orokos-okoiskola/', 'category', 'Örökös ökoiskola', '/kategoria/egyeb/orokos-okoiskola/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/', 'category', 'Projekt', '/kategoria/egyeb/projekt/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/dthpetrik2020/', 'category', '#dthpetrik2020', '/kategoria/egyeb/projekt/dthpetrik2020/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/dthpetrik2021/', 'category', '#dthpetrik2021', '/kategoria/egyeb/projekt/dthpetrik2021/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/dthpetrik2022/', 'category', '#dthpetrik2022', '/kategoria/egyeb/projekt/dthpetrik2022/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/dthpetrik2023/', 'category', '#dthpetrik2023', '/kategoria/egyeb/projekt/dthpetrik2023/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/dthpetrik2024/', 'category', '#dthpetrik2024', '/kategoria/egyeb/projekt/dthpetrik2024/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/dthpetrik2025/', 'category', '#dthpetrik2025', '/kategoria/egyeb/projekt/dthpetrik2025/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/dthpetrik2026/', 'category', '#dthpetrik2026', '/kategoria/egyeb/projekt/dthpetrik2026/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/erasmus/', 'category', 'Erasmus+', '/kategoria/egyeb/projekt/erasmus/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/etwinning/', 'category', 'eTwinning', '/kategoria/egyeb/projekt/etwinning/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/petrikcodeweek2024/', 'category', '#petrikcodeweek2024', '/kategoria/egyeb/projekt/petrikcodeweek2024/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/petrikcodeweek2025/', 'category', '#petrikcodeweek2025', '/kategoria/egyeb/projekt/petrikcodeweek2025/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/projekt/petrikcodeweek2026/', 'category', '#petrikcodeweek2026', '/kategoria/egyeb/projekt/petrikcodeweek2026/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/egyeb/versenyeredmeny/', 'category', 'Versenyeredmény', '/kategoria/egyeb/versenyeredmeny/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/english/', 'category', 'English', '/kategoria/english/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/etkezesek/', 'category', 'Étkezések', '/kategoria/etkezesek/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/hirek/', 'category', 'Hírek', '/kategoria/hirek/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/hirek/fooldali-kiemelt-hirek/', 'category', 'Főoldali kiemelt hirek', '/kategoria/hirek/fooldali-kiemelt-hirek/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/hirek/kiemelt-hirek/', 'category', 'Kiemelt hírek', '/kategoria/hirek/kiemelt-hirek/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/oktatas/', 'category', 'Oktatás', '/kategoria/oktatas/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/oktatas/esti-munkarend/', 'category', 'Esti munkarend', '/kategoria/oktatas/esti-munkarend/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/oktatas/nappali-kepzes/', 'category', 'Nappali képzés', '/kategoria/oktatas/nappali-kepzes/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/oktatas/nappali-kepzes/kozoktatas/', 'category', 'Közoktatás', '/kategoria/oktatas/nappali-kepzes/kozoktatas/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/oktatas/nappali-kepzes/szakkepzes/', 'category', 'Szakképzés', '/kategoria/oktatas/nappali-kepzes/szakkepzes/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/oktatas/nyari-gyakorlat/', 'category', 'Nyári gyakorlat', '/kategoria/oktatas/nyari-gyakorlat/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/oktatas/nyolcadikosoknak/', 'category', 'Nyolcadikosoknak', '/kategoria/oktatas/nyolcadikosoknak/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/vizsga/', 'category', 'Vizsga', '/kategoria/vizsga/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/vizsga/agazati-alapvizsga/', 'category', 'Ágazati alapvizsga', '/kategoria/vizsga/agazati-alapvizsga/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/vizsga/erettsegi/', 'category', 'Érettségi', '/kategoria/vizsga/erettsegi/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/vizsga/mellek-szakkepesites/', 'category', 'Mellék-szakképesítés', '/kategoria/vizsga/mellek-szakkepesites/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('/kategoria/vizsga/szakmai-vizsga/', 'category', 'Szakmai vizsga', '/kategoria/vizsga/szakmai-vizsga/', '2026-11-07 10:37:51.15+00', NULL);
INSERT INTO public.terms VALUES ('c8053e5c-b179-4a94-b4ed-bc1b287750ba', 'tag', 'Verseny', NULL, '2026-11-07 10:37:51.979+00', '31dff44d-81eb-46ff-998b-d9d33214f79e');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES ('fafdba1b-43ee-43ae-b26d-9cf6306cadef', 'mk.vezeto', 'Kovács Anna', '$2b$10$tlFXGCe/3r2UEW2.nOX5VuUV0rkU8uiKfv0glf9g6TDOSXP.TLlBq', '["pnw_submit_news"]');
INSERT INTO public.users VALUES ('31dff44d-81eb-46ff-998b-d9d33214f79e', 'helyettes', 'Nagy Péter', '$2b$10$oZLP9dgfmQWpCFogCZiLy.vDxQ86Z28dO9Qux33w5Gpml..EtP0Ai', '["pnw_review_news", "pnw_manage_published_news", "pnw_view_audit_log", "pnw_manage_terms", "pnw_manage_users", "pnw_manage_pages", "pnw_manage_library"]');
INSERT INTO public.users VALUES ('16129deb-b652-4552-9ee1-2653361cab2e', 'igazgato', 'Szabó Éva', '$2b$10$gn5OUjarSnnsyHgTR5.p2uAIY/7bbjVN9E.V3PKuJKH6tkSWadkpu', '["pnw_review_news", "pnw_manage_published_news", "pnw_view_audit_log", "pnw_manage_terms", "pnw_manage_users", "pnw_manage_pages", "pnw_manage_library"]');
INSERT INTO public.users VALUES ('99e94583-c36d-4d5e-ba98-9b185fa14e3c', 'szerkeszto', 'Szerkesztő Sári', '$2b$10$69bPHtbtxs75Ftt7MNLH/.3.Y9eXEpZXrT4YjJNeBiQCimqAbSxUe', '["pnw_manage_pages", "pnw_manage_library"]');
INSERT INTO public.users VALUES ('f9e0cd32-b366-4d7d-be9a-59a4fb653e79', 'ures', 'Üres Ödön', '$2b$10$i7R4Pt235XFXKKLWx/E4V.14Wm1UDKn6XVmYXnWbOZbEzlPyh98Pi', '[]');
INSERT INTO public.users VALUES ('f357ac2c-2e01-4b26-bd18-43bfc1f74410', 'cimkes', 'Címkés Cili', '$2b$10$1Q.7gs450LjXwTr.mAa4aewdbEpCqBZxS9K.7Jakv24QP1hiRq9iy', '["pnw_submit_news", "pnw_manage_terms"]');


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: creator_pages creator_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages
    ADD CONSTRAINT creator_pages_pkey PRIMARY KEY (id);


--
-- Name: creator_pages creator_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages
    ADD CONSTRAINT creator_pages_slug_key UNIQUE (slug);


--
-- Name: media_files media_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_files
    ADD CONSTRAINT media_files_pkey PRIMARY KEY (path);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: posts posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_slug_key UNIQUE (slug);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: site_library site_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_library
    ADD CONSTRAINT site_library_pkey PRIMARY KEY (id);


--
-- Name: site_menu site_menu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_menu
    ADD CONSTRAINT site_menu_pkey PRIMARY KEY (id);


--
-- Name: terms terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms
    ADD CONSTRAINT terms_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: audit_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_created_idx ON public.audit_log USING btree (created_at);


--
-- Name: audit_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_entity_idx ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: audit_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_post_idx ON public.audit_log USING btree (post_id);


--
-- Name: posts_author_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_author_idx ON public.posts USING btree (author_id);


--
-- Name: posts_category_ids_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_category_ids_idx ON public.posts USING gin (category_ids);


--
-- Name: posts_status_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_status_date_idx ON public.posts USING btree (status, date);


--
-- Name: posts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_status_idx ON public.posts USING btree (status);


--
-- Name: posts_status_modified_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_status_modified_idx ON public.posts USING btree (status, modified_at);


--
-- Name: sessions_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_idx ON public.sessions USING btree (expires);


--
-- Name: terms_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX terms_kind_idx ON public.terms USING btree (kind);


--
-- Name: audit_log audit_log_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE SET NULL;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: creator_pages creator_pages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages
    ADD CONSTRAINT creator_pages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: creator_pages creator_pages_modified_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creator_pages
    ADD CONSTRAINT creator_pages_modified_by_id_fkey FOREIGN KEY (modified_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: posts posts_archived_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_archived_by_id_fkey FOREIGN KEY (archived_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: posts posts_last_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_last_reviewer_id_fkey FOREIGN KEY (last_reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: posts posts_scheduled_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_scheduled_by_id_fkey FOREIGN KEY (scheduled_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: terms terms_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms
    ADD CONSTRAINT terms_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


