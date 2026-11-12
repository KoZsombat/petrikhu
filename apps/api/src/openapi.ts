import "./zod-openapi";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { env } from "./env";
import { postCategoryInputSchema, postCategoryUpdateSchema } from "./types/categoryTypes";
import {
  categoryInputSchema,
  categoryUpdateSchema,
  documentInputSchema,
  documentUpdateSchema,
} from "./types/docTypes";
import {
  postInputSchema,
  postListQuerySchema,
  postReviewSchema,
  postUpdateSchema,
} from "./types/postTypes";
import { teacherInputSchema, teacherUpdateSchema } from "./types/teacherTypes";
import { createUserSchema, updateUserSchema } from "./types/userTypes";

const registry = new OpenAPIRegistry();

const Json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});
const ErrorResponse = {
  description: "Error",
  content: { "application/json": { schema: z.object({ error: z.string() }) } },
};
const security = [{ cookieAuth: [] }];

const IdParams = z.object({ id: z.string() });
const SlugParams = z.object({ slug: z.string() });

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  content: z.string(),
  contentHtml: z.string().nullable(),
  category: z.string(),
  image: z.string().nullable(),
  gallery: z.array(z.string()),
  published: z.boolean(),
  status: z.enum(["draft", "pending", "published"]),
  reviewNote: z.string().nullable(),
  publishedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const PostSummarySchema = PostSchema.omit({ content: true, contentHtml: true });
const PostListSchema = z.object({
  posts: z.array(PostSummarySchema),
  total: z.number().int(),
});

const TeacherSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  email: z.string().nullable(),
  room: z.string().nullable(),
  photo: z.string().nullable(),
  sortOrder: z.number().int(),
  published: z.boolean(),
});
const PublicTeacherSchema = TeacherSchema.omit({ sortOrder: true, published: true });

const DocumentSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  slug: z.string(),
  title: z.string(),
  file: z.string().nullable(),
  protected: z.boolean(),
  sortOrder: z.number().int(),
});
const DocumentCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  sortOrder: z.number().int(),
  docs: z.array(DocumentSchema),
});
const LibrarySchema = z.object({ categories: z.array(DocumentCategorySchema) });

const PostCategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  sortOrder: z.number().int(),
});

const MediaItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  url: z.string(),
  createdAt: z.string(),
});

const AdminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  permissions: z.array(z.string()),
  isSeededAdmin: z.boolean(),
  createdAt: z.string(),
});
const PermissionInfoSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: z.string(),
});
const PermissionCatalogSchema = z.object({
  permissions: z.array(PermissionInfoSchema),
});
const MyPermissionsSchema = z.object({ permissions: z.array(z.string()) });

registry.register("Post", PostSchema);
registry.register("PostSummary", PostSummarySchema);
registry.register("PostList", PostListSchema);
registry.register("PostInput", postInputSchema);
registry.register("PostUpdate", postUpdateSchema);
registry.register("PostReview", postReviewSchema);
registry.register("Teacher", TeacherSchema);
registry.register("PublicTeacher", PublicTeacherSchema);
registry.register("TeacherInput", teacherInputSchema);
registry.register("TeacherUpdate", teacherUpdateSchema);
registry.register("Document", DocumentSchema);
registry.register("DocumentCategory", DocumentCategorySchema);
registry.register("DocumentLibrary", LibrarySchema);
registry.register("DocumentInput", documentInputSchema);
registry.register("DocumentUpdate", documentUpdateSchema);
registry.register("DocumentCategoryInput", categoryInputSchema);
registry.register("DocumentCategoryUpdate", categoryUpdateSchema);
registry.register("PostCategory", PostCategorySchema);
registry.register("PostCategoryInput", postCategoryInputSchema);
registry.register("PostCategoryUpdate", postCategoryUpdateSchema);
registry.register("MediaItem", MediaItemSchema);
registry.register("AdminUser", AdminUserSchema);
registry.register("CreateUser", createUserSchema);
registry.register("UpdateUser", updateUserSchema);
registry.register("PermissionInfo", PermissionInfoSchema);
registry.register("PermissionCatalog", PermissionCatalogSchema);
registry.register("MyPermissions", MyPermissionsSchema);

registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "better-auth.session_token",
  description: "Admin session cookie issued by better-auth.",
});

/* Posts */
registry.registerPath({
  method: "get",
  path: "/api/posts",
  tags: ["Posts"],
  summary: "List published posts",
  request: { query: postListQuerySchema },
  responses: { 200: { description: "Published posts", ...Json(PostListSchema) } },
});
registry.registerPath({
  method: "get",
  path: "/api/posts/{slug}",
  tags: ["Posts"],
  summary: "Get a published post by slug",
  request: { params: SlugParams },
  responses: {
    200: { description: "Post", ...Json(PostSchema) },
    404: ErrorResponse,
  },
});
registry.registerPath({
  method: "get",
  path: "/api/admin/posts",
  tags: ["Admin posts"],
  summary: "List all posts including drafts",
  security,
  responses: { 200: { description: "All posts", ...Json(z.array(PostSummarySchema)) } },
});
registry.registerPath({
  method: "get",
  path: "/api/admin/posts/{id}",
  tags: ["Admin posts"],
  summary: "Get one post with full content",
  security,
  request: { params: IdParams },
  responses: { 200: { description: "Post", ...Json(PostSchema) }, 404: ErrorResponse },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/posts",
  tags: ["Admin posts"],
  summary: "Create a draft",
  security,
  request: { body: { required: true, content: { "application/json": { schema: postInputSchema } } } },
  responses: {
    201: { description: "Created post", ...Json(PostSchema) },
    409: ErrorResponse,
  },
});
registry.registerPath({
  method: "put",
  path: "/api/admin/posts/{id}",
  tags: ["Admin posts"],
  summary: "Update a post",
  security,
  request: {
    params: IdParams,
    body: { required: true, content: { "application/json": { schema: postUpdateSchema } } },
  },
  responses: {
    200: { description: "Updated post", ...Json(PostSchema) },
    403: ErrorResponse,
    404: ErrorResponse,
    409: ErrorResponse,
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/admin/posts/{id}",
  tags: ["Admin posts"],
  summary: "Delete a post",
  security,
  request: { params: IdParams },
  responses: { 204: { description: "Deleted" }, 404: ErrorResponse },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/posts/{id}/submit",
  tags: ["Admin posts"],
  summary: "Submit a draft for review",
  security,
  request: { params: IdParams },
  responses: { 200: { description: "Submitted post", ...Json(PostSchema) }, 404: ErrorResponse },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/posts/{id}/review",
  tags: ["Admin posts"],
  summary: "Approve or reject a pending post",
  security,
  request: {
    params: IdParams,
    body: { required: true, content: { "application/json": { schema: postReviewSchema } } },
  },
  responses: {
    200: { description: "Reviewed post", ...Json(PostSchema) },
    404: ErrorResponse,
    409: ErrorResponse,
  },
});

/* Teachers */
registry.registerPath({
  method: "get",
  path: "/api/teachers",
  tags: ["Teachers"],
  summary: "List published teachers",
  responses: { 200: { description: "Teachers", ...Json(z.array(PublicTeacherSchema)) } },
});
registry.registerPath({
  method: "get",
  path: "/api/admin/teachers",
  tags: ["Admin teachers"],
  summary: "List all teachers",
  security,
  responses: { 200: { description: "Teachers", ...Json(z.array(TeacherSchema)) } },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/teachers",
  tags: ["Admin teachers"],
  summary: "Create a teacher",
  security,
  request: { body: { required: true, content: { "application/json": { schema: teacherInputSchema } } } },
  responses: { 201: { description: "Created teacher", ...Json(TeacherSchema) }, 409: ErrorResponse },
});
registry.registerPath({
  method: "put",
  path: "/api/admin/teachers/{id}",
  tags: ["Admin teachers"],
  summary: "Update a teacher",
  security,
  request: {
    params: IdParams,
    body: { required: true, content: { "application/json": { schema: teacherUpdateSchema } } },
  },
  responses: {
    200: { description: "Updated teacher", ...Json(TeacherSchema) },
    404: ErrorResponse,
    409: ErrorResponse,
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/admin/teachers/{id}",
  tags: ["Admin teachers"],
  summary: "Delete a teacher",
  security,
  request: { params: IdParams },
  responses: { 204: { description: "Deleted" }, 404: ErrorResponse },
});

/* Documents */
registry.registerPath({
  method: "get",
  path: "/api/documents",
  tags: ["Documents"],
  summary: "List the document library",
  responses: { 200: { description: "Document library", ...Json(LibrarySchema) } },
});
registry.registerPath({
  method: "get",
  path: "/api/admin/documents",
  tags: ["Admin documents"],
  summary: "List all documents",
  security,
  responses: { 200: { description: "Documents", ...Json(z.array(DocumentSchema)) } },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/documents",
  tags: ["Admin documents"],
  summary: "Create a document",
  security,
  request: { body: { required: true, content: { "application/json": { schema: documentInputSchema } } } },
  responses: { 201: { description: "Created document", ...Json(DocumentSchema) }, 409: ErrorResponse },
});
registry.registerPath({
  method: "put",
  path: "/api/admin/documents/{id}",
  tags: ["Admin documents"],
  summary: "Update a document",
  security,
  request: {
    params: IdParams,
    body: { required: true, content: { "application/json": { schema: documentUpdateSchema } } },
  },
  responses: {
    200: { description: "Updated document", ...Json(DocumentSchema) },
    404: ErrorResponse,
    409: ErrorResponse,
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/admin/documents/{id}",
  tags: ["Admin documents"],
  summary: "Delete a document",
  security,
  request: { params: IdParams },
  responses: { 204: { description: "Deleted" }, 404: ErrorResponse },
});
registry.registerPath({
  method: "get",
  path: "/api/admin/document-categories",
  tags: ["Admin documents"],
  summary: "List document categories",
  security,
  responses: { 200: { description: "Categories", ...Json(z.array(DocumentCategorySchema)) } },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/document-categories",
  tags: ["Admin documents"],
  summary: "Create a document category",
  security,
  request: { body: { required: true, content: { "application/json": { schema: categoryInputSchema } } } },
  responses: { 201: { description: "Created category", ...Json(DocumentCategorySchema) } },
});
registry.registerPath({
  method: "put",
  path: "/api/admin/document-categories/{id}",
  tags: ["Admin documents"],
  summary: "Update a document category",
  security,
  request: {
    params: IdParams,
    body: { required: true, content: { "application/json": { schema: categoryUpdateSchema } } },
  },
  responses: { 200: { description: "Updated category", ...Json(DocumentCategorySchema) } },
});
registry.registerPath({
  method: "delete",
  path: "/api/admin/document-categories/{id}",
  tags: ["Admin documents"],
  summary: "Delete a document category",
  security,
  request: { params: IdParams },
  responses: { 204: { description: "Deleted" }, 404: ErrorResponse },
});

/* Post categories */
registry.registerPath({
  method: "get",
  path: "/api/post-categories",
  tags: ["Categories"],
  summary: "List post categories",
  responses: { 200: { description: "Categories", ...Json(z.array(PostCategorySchema)) } },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/post-categories",
  tags: ["Admin categories"],
  summary: "Create a post category",
  security,
  request: { body: { required: true, content: { "application/json": { schema: postCategoryInputSchema } } } },
  responses: { 201: { description: "Created category", ...Json(PostCategorySchema) }, 409: ErrorResponse },
});
registry.registerPath({
  method: "put",
  path: "/api/admin/post-categories/{id}",
  tags: ["Admin categories"],
  summary: "Rename a post category",
  security,
  request: {
    params: IdParams,
    body: { required: true, content: { "application/json": { schema: postCategoryUpdateSchema } } },
  },
  responses: { 200: { description: "Updated category", ...Json(PostCategorySchema) } },
});
registry.registerPath({
  method: "delete",
  path: "/api/admin/post-categories/{id}",
  tags: ["Admin categories"],
  summary: "Delete an unused post category",
  security,
  request: { params: IdParams },
  responses: { 204: { description: "Deleted" }, 404: ErrorResponse, 409: ErrorResponse },
});

/* Media */
registry.registerPath({
  method: "get",
  path: "/api/admin/media",
  tags: ["Media"],
  summary: "List media",
  security,
  request: {
    query: z.object({
      kind: z.enum(["image", "document"]).optional(),
      limit: z.coerce.number().int().min(1).max(120).optional(),
      offset: z.coerce.number().int().min(0).optional(),
      q: z.string().optional(),
    }),
  },
  responses: { 200: { description: "Media items", ...Json(z.array(MediaItemSchema)) } },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/media",
  tags: ["Media"],
  summary: "Upload an image or document",
  security,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({ file: z.string() }),
        },
      },
    },
  },
  responses: { 201: { description: "Created media", ...Json(MediaItemSchema) } },
});
registry.registerPath({
  method: "delete",
  path: "/api/admin/media/{id}",
  tags: ["Media"],
  summary: "Delete media",
  security,
  request: { params: IdParams },
  responses: { 204: { description: "Deleted" }, 404: ErrorResponse },
});
registry.registerPath({
  method: "get",
  path: "/api/media/{id}",
  tags: ["Media"],
  summary: "Read public media bytes",
  request: { params: IdParams },
  responses: {
    200: {
      description: "Media bytes",
      content: { "application/octet-stream": { schema: z.string() } },
    },
    404: ErrorResponse,
  },
});

/* Users and permissions */
registry.registerPath({
  method: "get",
  path: "/api/me/permissions",
  tags: ["Access"],
  summary: "Effective permissions of the signed-in user",
  security,
  responses: { 200: { description: "Permissions", ...Json(MyPermissionsSchema) } },
});
registry.registerPath({
  method: "get",
  path: "/api/admin/permissions",
  tags: ["Access"],
  summary: "Permission catalog",
  security,
  responses: { 200: { description: "Catalog", ...Json(PermissionCatalogSchema) } },
});
registry.registerPath({
  method: "get",
  path: "/api/admin/users",
  tags: ["Access"],
  summary: "List accounts and their permissions",
  security,
  responses: { 200: { description: "Users", ...Json(z.array(AdminUserSchema)) } },
});
registry.registerPath({
  method: "post",
  path: "/api/admin/users",
  tags: ["Access"],
  summary: "Create an account with permissions",
  security,
  request: { body: { required: true, content: { "application/json": { schema: createUserSchema } } } },
  responses: { 201: { description: "Created user", ...Json(AdminUserSchema) }, 409: ErrorResponse },
});
registry.registerPath({
  method: "put",
  path: "/api/admin/users/{id}",
  tags: ["Access"],
  summary: "Update an account's profile, password or permissions",
  security,
  request: {
    params: IdParams,
    body: { required: true, content: { "application/json": { schema: updateUserSchema } } },
  },
  responses: { 200: { description: "Updated user", ...Json(AdminUserSchema) } },
});
registry.registerPath({
  method: "delete",
  path: "/api/admin/users/{id}",
  tags: ["Access"],
  summary: "Delete an account",
  security,
  request: { params: IdParams },
  responses: { 204: { description: "Deleted" }, 400: ErrorResponse, 404: ErrorResponse },
});

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Liveness check",
  responses: { 200: { description: "OK", ...Json(z.object({ ok: z.boolean() })) } },
});

const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Petrikhu API",
    version: "1.0.0",
    description:
      "Hono API for Petrikhu. Routes are plain handlers with Zod validation; this document is generated separately.",
  },
  servers: [{ url: env.BETTER_AUTH_URL, description: "API origin" }],
});
