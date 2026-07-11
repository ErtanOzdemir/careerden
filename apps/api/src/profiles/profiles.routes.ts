import { Router } from "express";
import type { Request, Router as ExpressRouter } from "express";
import multer from "multer";
import type {
  CreateProfileUseCase,
  GetOrCreateCurrentProfileUseCase,
  GetProfileUseCase,
  ListDocumentTemplatesUseCase,
  SetDefaultDocumentTemplateUseCase,
  UpdateDocumentTemplateMappingsUseCase,
  UpdateDocumentTemplateVariableAliasesUseCase,
  UpdateProfileUseCase,
  UploadDocumentTemplateUseCase,
} from "@link2cv/application";
import {
  createProfileSchema,
  updateDocumentTemplateMappingsSchema,
  updateDocumentTemplateVariableAliasesSchema,
  updateProfileSchema,
} from "@link2cv/contracts";
import { validateBody } from "../middleware/validate-body.js";
import type { AuthenticatedRequest } from "../auth/session.middleware.js";

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function createProfileRouter(dependencies: {
  createProfile: CreateProfileUseCase;
  getCurrentProfile: GetOrCreateCurrentProfileUseCase;
  getProfile: GetProfileUseCase;
  updateProfile: UpdateProfileUseCase;
  listDocumentTemplates: ListDocumentTemplatesUseCase;
  uploadDocumentTemplate: UploadDocumentTemplateUseCase;
  updateDocumentTemplateMappings: UpdateDocumentTemplateMappingsUseCase;
  updateDocumentTemplateVariableAliases: UpdateDocumentTemplateVariableAliasesUseCase;
  setDefaultDocumentTemplate: SetDefaultDocumentTemplateUseCase;
}): ExpressRouter {
  const router = Router();

  router.get("/me", async (request, response, next) => {
    try {
      response.json(await dependencies.getCurrentProfile.execute(currentUser(request)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/me", validateBody(updateProfileSchema), async (request, response, next) => {
    try {
      const user = currentUser(request);
      const profile = await dependencies.getCurrentProfile.execute(user);
      const updated = await dependencies.updateProfile.execute(profile.id, user.id, request.body);

      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", validateBody(createProfileSchema), async (request, response, next) => {
    try {
      const profile = await dependencies.createProfile.execute(request.body);
      response.status(201).json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      response.json(
        await dependencies.getProfile.execute(request.params.id, currentUser(request).id),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", validateBody(updateProfileSchema), async (request, response, next) => {
    try {
      response.json(
        await dependencies.updateProfile.execute(
          request.params.id,
          currentUser(request).id,
          request.body,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/document-templates", async (request, response, next) => {
    try {
      response.json(
        await dependencies.listDocumentTemplates.execute(
          request.params.id,
          currentUser(request).id,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/document-templates", upload.single("file"), async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ code: "validation", error: "DOCX file is required" });
        return;
      }

      if (!isDocxUpload(request.file)) {
        response
          .status(400)
          .json({ code: "validation", error: "Only .docx templates are supported" });
        return;
      }

      const template = await dependencies.uploadDocumentTemplate.execute({
        profileId: request.params.id,
        userId: currentUser(request).id,
        fileName: request.file.originalname,
        body: request.file.buffer,
        size: request.file.size,
      });

      response.status(201).json(template);
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id/document-templates/:templateId/mappings",
    validateBody(updateDocumentTemplateMappingsSchema),
    async (request, response, next) => {
      try {
        const updated = await dependencies.updateDocumentTemplateMappings.execute(
          request.params.id,
          request.params.templateId,
          currentUser(request).id,
          request.body.fieldMappings,
        );

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id/document-templates/:templateId/variable-aliases",
    validateBody(updateDocumentTemplateVariableAliasesSchema),
    async (request, response, next) => {
      try {
        const updated = await dependencies.updateDocumentTemplateVariableAliases.execute(
          request.params.id,
          request.params.templateId,
          currentUser(request).id,
          request.body.variableAliases,
        );

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch("/:id/document-templates/:templateId/default", async (request, response, next) => {
    try {
      const template = await dependencies.setDefaultDocumentTemplate.execute(
        request.params.id,
        request.params.templateId,
        currentUser(request).id,
      );

      response.json(template);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function isDocxUpload(file: Express.Multer.File): boolean {
  return file.originalname.toLowerCase().endsWith(".docx") || file.mimetype === docxContentType;
}

function currentUser(request: Request): AuthenticatedRequest["user"] {
  return (request as AuthenticatedRequest).user;
}
